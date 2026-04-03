import {config} from 'dotenv';
config();

const jamHost = process.env.JAM_HOST || 'beta.jam.systems';
const pantryUrl = process.env.JAM_PANTRY_URL || `https://${jamHost}/_/pantry`;
const pantryWsUrl = pantryUrl.replace('http', 'ws');
const pantryRestUrl = process.env.PANTRY_REST_URL || pantryUrl.replace('/_/pantry', '');

const local = process.env.LOCAL;
const sfuHttpPort = parseInt(process.env.SFU_HTTP_PORT || '30002', 10);

export {jamHost, pantryWsUrl, pantryRestUrl, local, sfuHttpPort};
