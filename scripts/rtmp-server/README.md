# Buzz RTMP + HLS Server

Self-hosted nginx-rtmp server for video livestream ingest and HLS delivery.

## Deployment

```bash
# Deploy via Railway
railway up --service Buzz-rtmp
```

Or deploy from the GitHub repo by creating a new Railway service with root directory `scripts/rtmp-server/`.

## Architecture

- Port **1935**: RTMP ingest (from video-livestream-runner)
- Port **80**: HLS playback + stats

## After Deployment

### Railway Networking — Important

Railway's public proxy (`*.up.railway.app`) only handles HTTP/HTTPS, not raw TCP.
RTMP uses port 1935 (raw TCP), so the video runner **cannot** connect via the public URL.

**Use Railway's internal DNS instead:**

1. Set on the **backend** Railway service:
   ```
   RTMP_INGEST_URL=rtmp://<service-name>.internal.railway.app/app
   HLS_BASE_URL=https://<service-name>.up.railway.app
   ```
   Replace `<service-name>` with your RTMP server's Railway service name.

2. Redeploy the backend

3. Redeploy the video-livestream-runner

### How to find your internal Railway URL

In the Railway dashboard, go to your RTMP service → Settings → Networking.
The internal DNS format is: `rtmp://<service-name>.internal.railway.app`

### Env Var Priority

| Variable | Purpose | Used By |
|---|---|---|
| `RTMP_INGEST_URL` | Internal RTMP ingest URL (highest priority) | Backend + video runner |
| `RTMP_BASE_URL` | Public RTMP URL (fallback) | Backend |
| `HLS_BASE_URL` | Public HLS playback URL | Backend + frontend |

The frontend automatically receives `hlsUrl` from the backend API and plays video via hls.js.
