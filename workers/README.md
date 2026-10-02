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

## Deployment controls

The Worker rejects private IP literals, credential-bearing URLs and unsupported protocols, checks every redirect, limits redirects to three, limits fetched bodies to 4 MB and request bodies to 16 KB, and applies an eight-second deadline to each fetch including body reads. Domain validation does not establish where an arbitrary domain will resolve; configure `ALLOWED_HOSTS` for deployments that require a restricted target set and apply provider-level egress controls.

Optional environment settings:

- `ACCESS_TOKEN`: require `Authorization: Bearer <token>` on extraction requests. Do not embed deployment secrets in a public frontend bundle.
- `ALLOWED_ORIGINS`: comma-separated browser origins. Origin checks are not authentication.
- `ALLOWED_HOSTS`: comma-separated exact initial target hostnames.
- `RATE_LIMITER`: Cloudflare rate-limit binding exposing `limit({ key })`. Configure this binding for a public deployment; the Worker does not pretend an in-memory counter is a distributed limit.

The embedded source download in the frontend imports this exact file as raw text, so deployment examples cannot drift into a second implementation. Existing public Workers are separate deployments and are not changed by pushing this repository.
