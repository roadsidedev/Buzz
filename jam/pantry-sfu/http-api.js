/**
 * HTTP API wrapper for pantry-sfu
 *
 * Exposes REST endpoints that call mediasoup functions directly.
 * This bridges the gap between the frontend's WebRTCAudioBridge (which
 * expects REST) and the pantry-sfu (which normally speaks WebSocket).
 *
 * Endpoints:
 *   GET  /rooms/:roomId/router-rtp-capabilities
 *   POST /rooms/:roomId/create-transport
 *   POST /transports/:transportId/connect
 *   POST /transports/:transportId/produce
 *   POST /transports/:transportId/close-producer
 */

import http from 'http';
import {
  getRouterCapabilities,
  handleCreateTransport,
  handleConnectTransport,
  handleProduce,
  handleCloseProducer,
  findTransport,
} from './mediasoup.js';

export function startHttpApi(port = 30002) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;
    const method = req.method;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const routerCapsMatch = path.match(/^\/rooms\/([^/]+)\/router-rtp-capabilities$/);
    if (method === 'GET' && routerCapsMatch) {
      handleRouterCapabilities(routerCapsMatch[1], res);
      return;
    }

    const createTransportMatch = path.match(/^\/rooms\/([^/]+)\/create-transport$/);
    if (method === 'POST' && createTransportMatch) {
      handleCreateTransportEndpoint(createTransportMatch[1], req, res);
      return;
    }

    const connectTransportMatch = path.match(/^\/transports\/([^/]+)\/connect$/);
    if (method === 'POST' && connectTransportMatch) {
      handleConnectTransportEndpoint(connectTransportMatch[1], req, res);
      return;
    }

    const produceMatch = path.match(/^\/transports\/([^/]+)\/produce$/);
    if (method === 'POST' && produceMatch) {
      handleProduceEndpoint(produceMatch[1], req, res);
      return;
    }

    const closeProducerMatch = path.match(/^\/transports\/([^/]+)\/close-producer$/);
    if (method === 'POST' && closeProducerMatch) {
      handleCloseProducerEndpoint(closeProducerMatch[1], req, res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`[SFU HTTP API] Listening on port ${port}`);
  });

  server.on('error', (err) => {
    console.error('[SFU HTTP API] Error:', err.message);
  });

  return server;
}

async function handleRouterCapabilities(roomId, res) {
  try {
    const result = await getRouterCapabilities(roomId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (err) {
    console.error('[SFU HTTP] Failed to get router capabilities:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to get router capabilities', details: err.message }));
  }
}

async function handleCreateTransportEndpoint(roomId, req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    try {
      const data = JSON.parse(body);
      const { producing, consuming, rtpCapabilities, peerId } = data;
      const effectivePeerId = peerId || `http-api-${roomId}-${Date.now()}`;

      const result = await handleCreateTransport(roomId, {
        producing,
        consuming,
        rtpCapabilities,
        peerId: effectivePeerId,
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ transportOptions: result }));
    } catch (err) {
      console.error('[SFU HTTP] Failed to create transport:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to create transport', details: err.message }));
    }
  });
}

async function handleConnectTransportEndpoint(transportId, req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    try {
      const data = JSON.parse(body);
      const { dtlsParameters } = data;

      const transportInfo = findTransport(transportId);
      if (!transportInfo) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Transport not found' }));
        return;
      }

      await handleConnectTransport(transportInfo.roomId, transportInfo.peerId, transportId, {
        dtlsParameters,
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      console.error('[SFU HTTP] Failed to connect transport:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to connect transport', details: err.message }));
    }
  });
}

async function handleProduceEndpoint(transportId, req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    try {
      const data = JSON.parse(body);
      const { kind, rtpParameters, appData } = data;

      const transportInfo = findTransport(transportId);
      if (!transportInfo) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Transport not found' }));
        return;
      }

      const result = await handleProduce(transportInfo.roomId, transportInfo.peerId, transportId, {
        kind,
        rtpParameters,
        appData,
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: result.id }));
    } catch (err) {
      console.error('[SFU HTTP] Failed to produce:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to produce', details: err.message }));
    }
  });
}

async function handleCloseProducerEndpoint(transportId, req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    try {
      const data = JSON.parse(body);
      const { producerId } = data;

      const transportInfo = findTransport(transportId);
      if (!transportInfo) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Transport not found' }));
        return;
      }

      await handleCloseProducer(transportInfo.roomId, transportInfo.peerId, { producerId });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      console.error('[SFU HTTP] Failed to close producer:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to close producer', details: err.message }));
    }
  });
}
