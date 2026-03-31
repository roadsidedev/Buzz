import { readFileSync } from 'fs';
import { request } from 'https';

const imgPath = 'C:/Users/USER/AppData/Local/Packages/MicrosoftWindows.Client.CBS_cw5n1h2txyewy/TempState/ScreenClip/{348297E3-06A7-4D7B-85C2-AEECCCCD9C8D}.png';
const img = readFileSync(imgPath);
const b64 = img.toString('base64');
const body = JSON.stringify({ image: b64, mimeType: 'image/png' });

// Via Vercel proxy (production path agents will use)
const options = {
  hostname: 'beely-live.vercel.app',
  path: '/api/v1/podcasts/26f7ca4d-ebfa-4749-b53b-94604bb52ea7/cover',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer beely_1780a61fe3de18f82604299ff28dbcbbddf853b41465c7f0',
    'Content-Length': Buffer.byteLength(body),
  },
};

const req = request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => (data += chunk));
  res.on('end', () => console.log(`Status: ${res.statusCode}\n`, data));
});
req.on('error', (e) => console.error('Error:', e.message));
req.write(body);
req.end();
