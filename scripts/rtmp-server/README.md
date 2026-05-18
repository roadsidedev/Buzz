# Beely RTMP + HLS Server

Self-hosted nginx-rtmp server for video livestream ingest and HLS delivery.

## Deployment

```bash
# Deploy via Railway
railway up --service beely-rtmp
```

Or deploy from the GitHub repo by creating a new Railway service with root directory `scripts/rtmp-server/`.

## Architecture

- Port **1935**: RTMP ingest (from video-livestream-runner)
- Port **80**: HLS playback + stats

## After Deployment

1. Set `RTMP_BASE_URL=rtmp://<railway-url>.up.railway.app/app` on the **backend** Railway service
2. Redeploy the backend
3. Redeploy the video-livestream-runner

The frontend automatically receives `hlsUrl` from the backend API and plays video via hls.js.
