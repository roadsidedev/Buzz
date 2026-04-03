import os from 'os';
import mediasoup from 'mediasoup';
import {local} from './config.js';
import {
  sendRequest,
  onMessage,
  onRemovePeer,
  onAddPeer,
  sendDirect,
} from './ws.js';

export {runMediasoup, getRouterCapabilities, handleCreateTransport, handleConnectTransport, handleProduce, handleCloseProducer, findTransport};

const hasMediasoup = true;
const announcedIp =
  process.env.JAM_SFU_EXTERNAL_IP || (local ? localIp() : null);

const workers = [];
const rooms = new Map();
let workerIndex = 0;

// rooms = Map(roomId => room)
// room = {id: roomId, router, peers: Map(peerId => peer)};
// peer = {id: peerId, doesConsume, rtpCapabilities, transports, producers, consumers, doesConsume, consumerTransport}

function runMediasoup() {
  if (!hasMediasoup) return;

  if (!announcedIp) {
    throw Error(
      `Missing environment variable JAM_SFU_EXTERNAL_IP. Provide your external IP to use mediasoup.
If you do not wish to use mediasoup, make sure the JAM_SFU environment variable is not set.`
    );
  }

  runMediasoupWorkers();

  onAddPeer(async (roomId, peerId) => {
    let room = await getOrCreateRoom(roomId);
    let rtpCapabilities = room.router.rtpCapabilities;
    sendDirect(roomId, peerId, 'mediasoup-info', {rtpCapabilities});
  });

  onMessage('mediasoup', async (roomId, peerId, {type, data}, accept) => {
    const room = await getOrCreateRoom(roomId);
    const router = room.router;
    const peer = await getOrCreatePeer(room, peerId);
    console.log('mediasoup request', type, roomId, peerId);

    switch (type) {
      case 'get-router-capabilities': {
        accept({ rtpCapabilities: router.rtpCapabilities });
        break;
      }
      case 'createWebRtcTransport': {
        let {producing, consuming, rtpCapabilities} = data;
        peer.rtpCapabilities = rtpCapabilities;

        let transportOptions = {
          ...config.mediasoup.webRtcTransportOptions,
          appData: {producing, consuming},
        };

        const transport = await router.createWebRtcTransport(transportOptions);
        if (consuming) {
          peer.doesConsume = true;
          peer.consumerTransport = transport;
        }

        let printTransports = () => {
          console.log(
            'transports',
            roomId,
            peerId.slice(0, 4),
            'consuming',
            [...peer.transports.values()].filter(t => t.appData.consuming)
              .length,
            'producing',
            [...peer.transports.values()].filter(t => t.appData.producing)
              .length
          );
        };

        peer.transports.set(transport.id, transport);
        printTransports();

        transport.on('dtlsstatechange', dtlsState => {
          if (dtlsState === 'failed' || dtlsState === 'closed') {
            console.warn(
              'WebRtcTransport "dtlsstatechange" event, dtlsState',
              dtlsState
            );
            transport.close();
          }
        });

        transport.observer.on('close', () => {
          console.log(
            'transport closed!',
            consuming ? '(consuming)' : '(producing)'
          );
          peer.transports.delete(transport.id);
          if (consuming && transport === peer.consumerTransport) {
            peer.doesConsume = false;
          }
          printTransports();
        });

        accept({
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        });

        const {maxIncomingBitrate} = config.mediasoup.webRtcTransportOptions;
        if (maxIncomingBitrate) {
          try {
            await transport.setMaxIncomingBitrate(maxIncomingBitrate);
          } catch (error) {}
        }

        if (consuming) {
          for (const otherPeer of yieldOtherPeers(room, peerId)) {
            for (const producer of otherPeer.producers.values()) {
              createConsumer(room, {
                consumerPeer: peer,
                producerPeer: otherPeer,
                producer,
              });
            }
          }
        }
        break;
      }

      case 'connectWebRtcTransport': {
        const {transportId, dtlsParameters} = data;
        const transport = peer.transports.get(transportId);
        if (transport === undefined) {
          console.error('transport not found', transportId);
          return;
        }
        await transport.connect({dtlsParameters});
        accept();
        break;
      }

      case 'produce': {
        let {transportId, kind, rtpParameters, appData} = data;
        const transport = peer.transports.get(transportId);

        if (transport === undefined) {
          console.error('transport not found', transportId);
          return;
        }

        const producer = await transport.produce({
          kind,
          rtpParameters,
          appData,
        });
        peer.producers.set(producer.id, producer);

        producer.on('score', score => {
          console.log('producerScore', peerId, score);
        });

        accept({id: producer.id});

        for (const otherPeer of yieldOtherPeers(room, peerId)) {
          createConsumer(room, {
            consumerPeer: otherPeer,
            producerPeer: peer,
            producer,
          });
        }
        break;
      }

      case 'closeProducer': {
        const {producerId} = data;
        const producer = peer.producers.get(producerId);
        if (producer === undefined) {
          console.error('producer not found', producerId);
          return;
        }

        producer.close();
        peer.producers.delete(producer.id);

        accept();
        break;
      }
    }
  });

  onRemovePeer((roomId, peerId) => {
    const room = rooms.get(roomId);
    if (room === undefined) return;
    const peer = room.peers.get(peerId);
    if (peer === undefined) return;
    for (const transport of peer.transports.values()) {
      transport.close();
    }
    room.peers.delete(peerId);
    if (room.peers.size === 0) {
      closeRoom(room);
    }
  });
}

// ── HTTP API helpers (exported for http-api.js) ──────────────────────────────

async function getRouterCapabilities(roomId) {
  const room = await getOrCreateRoom(roomId);
  return { rtpCapabilities: room.router.rtpCapabilities };
}

async function handleCreateTransport(roomId, { producing, consuming, rtpCapabilities, peerId }) {
  const room = await getOrCreateRoom(roomId);
  const router = room.router;
  const peer = await getOrCreatePeer(room, peerId);
  peer.rtpCapabilities = rtpCapabilities;

  const transportOptions = {
    ...config.mediasoup.webRtcTransportOptions,
    appData: { producing, consuming },
  };

  const transport = await router.createWebRtcTransport(transportOptions);
  if (consuming) {
    peer.doesConsume = true;
    peer.consumerTransport = transport;
  }

  peer.transports.set(transport.id, transport);

  console.log(
    'transports (HTTP)',
    roomId,
    peerId.slice(0, 4),
    'consuming',
    [...peer.transports.values()].filter(t => t.appData.consuming).length,
    'producing',
    [...peer.transports.values()].filter(t => t.appData.producing).length
  );

  if (consuming) {
    for (const otherPeer of yieldOtherPeers(room, peerId)) {
      for (const producer of otherPeer.producers.values()) {
        createConsumer(room, {
          consumerPeer: peer,
          producerPeer: otherPeer,
          producer,
        });
      }
    }
  }

  return {
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
  };
}

async function handleConnectTransport(roomId, peerId, transportId, { dtlsParameters }) {
  const room = await getOrCreateRoom(roomId);
  const peer = await getOrCreatePeer(room, peerId);
  const transport = peer.transports.get(transportId);
  if (!transport) {
    throw new Error(`Transport not found: ${transportId}`);
  }
  await transport.connect({ dtlsParameters });
  return { ok: true };
}

async function handleProduce(roomId, peerId, transportId, { kind, rtpParameters, appData }) {
  const room = await getOrCreateRoom(roomId);
  const peer = await getOrCreatePeer(room, peerId);
  const transport = peer.transports.get(transportId);
  if (!transport) {
    throw new Error(`Transport not found: ${transportId}`);
  }

  const producer = await transport.produce({ kind, rtpParameters, appData });
  peer.producers.set(producer.id, producer);

  producer.on('score', score => {
    console.log('producerScore (HTTP)', peerId, score);
  });

  for (const otherPeer of yieldOtherPeers(room, peerId)) {
    createConsumer(room, {
      consumerPeer: otherPeer,
      producerPeer: peer,
      producer,
    });
  }

  return { id: producer.id };
}

async function handleCloseProducer(roomId, peerId, { producerId }) {
  const room = await getOrCreateRoom(roomId);
  const peer = await getOrCreatePeer(room, peerId);
  const producer = peer.producers.get(producerId);
  if (!producer) {
    throw new Error(`Producer not found: ${producerId}`);
  }
  producer.close();
  peer.producers.delete(producer.id);
  return { ok: true };
}

function findTransport(transportId) {
  for (const [roomId, room] of rooms) {
    for (const [peerId, peer] of room.peers) {
      if (peer.transports.has(transportId)) {
        return { roomId, peerId };
      }
    }
  }
  return null;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

async function createConsumer(room, {consumerPeer, producerPeer, producer}) {
  if (
    !consumerPeer.doesConsume ||
    !consumerPeer.rtpCapabilities ||
    !room.router.canConsume({
      producerId: producer.id,
      rtpCapabilities: consumerPeer.rtpCapabilities,
    })
  ) {
    return;
  }

  for (let otherProducer of consumerPeer.consumers.values()) {
    if (producer === otherProducer) return;
  }

  const transport = consumerPeer.consumerTransport;
  let consumer;
  try {
    consumer = await transport.consume({
      producerId: producer.id,
      rtpCapabilities: consumerPeer.rtpCapabilities,
      paused: false,
    });
  } catch (error) {
    console.warn('createConsumer() | transport.consume()', error);
    return;
  }

  consumerPeer.consumers.set(consumer.id, consumer);

  consumer.on('transportclose', () => {
    consumerPeer.consumers.delete(consumer.id);
  });

  consumer.on('producerclose', () => {
    consumerPeer.consumers.delete(consumer.id);
  });

  try {
    await sendRequest(room.id, consumerPeer.id, 'new-consumer', {
      peerId: producerPeer.id,
      producerId: producer.id,
      id: consumer.id,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      type: consumer.type,
      appData: producer.appData,
      producerPaused: consumer.producerPaused,
    });
  } catch (error) {
    console.warn('createConsumer() | failed', error);
  }
}

async function getOrCreatePeer(room, peerId) {
  let peer = room.peers.get(peerId);
  if (peer === undefined) {
    peer = {
      id: peerId,
      doesConsume: false,
      rtpCapabilities: undefined,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
      consumerTransport: null,
    };
    room.peers.set(peerId, peer);
  }
  return peer;
}

function* yieldOtherPeers(room, excludePeerId) {
  for (let peer of room.peers.values()) {
    if (peer.id !== excludePeerId) yield peer;
  }
}

async function getOrCreateRoom(roomId) {
  let room = rooms.get(roomId);
  if (room === undefined) {
    console.log('creating a new Room', roomId);
    const mediasoupWorker = getMediasoupWorker();
    const {mediaCodecs} = config.mediasoup.routerOptions;
    const router = await mediasoupWorker.createRouter({mediaCodecs});
    room = {id: roomId, router, peers: new Map()};
    rooms.set(roomId, room);
  }
  return room;
}

function closeRoom(room) {
  room.router.close();
  rooms.delete(room.id);
}

function getMediasoupWorker() {
  const worker = workers[workerIndex];
  workerIndex = (workerIndex + 1) % workers.length;
  return worker;
}

async function runMediasoupWorkers() {
  const {numWorkers} = config.mediasoup;
  console.log(`running ${numWorkers} mediasoup Workers...`);

  for (let i = 0; i < numWorkers; ++i) {
    const worker = await mediasoup.createWorker({
      ...config.mediasoup.workerSettings,
    });
    worker.on('died', () => {
      console.error('mediasoup Worker died, exiting', worker.pid);
      setTimeout(() => process.exit(1), 2000);
    });
    workers.push(worker);
  }
}

const config = {
  mediasoup: {
    numWorkers: Object.keys(os.cpus()).length,
    workerSettings: {
      logLevel: 'warn',
      logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtx', 'score', 'svc'],
      rtcMinPort: Number(process.env.MEDIASOUP_MIN_PORT || 30000),
      rtcMaxPort: Number(process.env.MEDIASOUP_MAX_PORT || 39999),
    },
    routerOptions: {
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2,
        },
      ],
    },
    webRtcTransportOptions: {
      enableUdp: false,
      enableTcp: true,
      listenIps: [
        {
          ip: '0.0.0.0',
          announcedIp,
        },
      ],
      initialAvailableOutgoingBitrate: 1000000,
      minimumAvailableOutgoingBitrate: 600000,
      maxSctpMessageSize: 262144,
    },
  },
};

function localIp() {
  let interfaces = [].concat(...Object.values(os.networkInterfaces()));
  let ip = interfaces.find(x => !x.internal && x.family === 'IPv4')?.address;
  if (hasMediasoup) console.log('mediasoup: falling back to announced IP', ip);
  return ip;
}
