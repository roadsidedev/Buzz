import {runMediasoup} from './mediasoup.js';
import {startHttpApi} from './http-api.js';

runMediasoup();

// Start HTTP API for REST-based SFU control (used by WebRTCAudioBridge)
const httpPort = parseInt(process.env.SFU_HTTP_PORT || '30002', 10);
startHttpApi(httpPort);
