# video-catch Cloudflare Worker

This folder contains a Worker-compatible JavaScript port of `temjoy/video-catch`.

## Deploy

Copy `video-catch-worker.js` into a Cloudflare Worker, or deploy it with Wrangler.

```bash
wrangler deploy workers/video-catch-worker.js --name video-catch
```

## API

```bash
curl "https://YOUR_WORKER_DOMAIN/api/extract?url=https%3A%2F%2Fvimeo.com%2F76979871"
```

```bash
curl -X POST "https://YOUR_WORKER_DOMAIN/api/extract" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.bilibili.com/video/BV..."}'
```

Response:

```json
{
  "ok": true,
  "title": "Video title",
  "platform": "vimeo",
  "thumbnail": "https://...",
  "duration": "1:23",
  "author": "Author",
  "formats": [
    {
      "quality": "720p",
      "resolution": "1280x720",
      "url": "https://...",
      "format": "mp4"
    }
  ]
}
```

Twitter/X is not included because the upstream parser depends on `yt-dlp`, which cannot run inside Cloudflare Workers.
