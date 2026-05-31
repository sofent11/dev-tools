# DevToolbox Pro - Current Implementation Plan

## Stage 1: Runtime Correctness
**Status**: Complete

- JSON Diff now uses structured path segments and RFC 6901 JSON Pointer escaping.
- JSON Patch output handles special object keys and array removals safely.
- HTTP cURL import supports common shell/cURL forms including `--url`, `-G`, repeated data flags, `--data-urlencode`, basic auth, escaped quotes, and form fields.
- HTTP Mock sandbox is scoped to the HTTP request tool instead of overriding global `window.fetch`.

## Stage 2: Cross-Tool Experience
**Status**: Complete

- Global scratchpad uses the IndexedDB hybrid store for large text and binary items.
- Scratchpad items carry metadata, size, source, MIME, thumbnails, and retain same-name versions.
- Scratchpad cards support inline renaming and mobile-visible copy/download/delete actions.
- Non-critical `alert` calls are routed into accessible toast feedback.
- Tool components no longer use blocking `alert()` for ordinary failures; feedback is inline or via `notifyToast`, with optional recovery actions.
- Studio tab history sync now responds to both hash and browser back/forward navigation.
- The i18n provider no longer monkey-patches global `window.alert` or `window.confirm`.
- Navigation has been reorganized into 8 task-oriented categories and 12 Studio wrappers; legacy direct tool aliases are intentionally retired.

## Stage 3: Feature Enhancements
**Status**: Complete, hardening ongoing

- Color converter includes WCAG 2.1 contrast analysis, HSL micro-adjusters, and accessible color suggestions.
- JWT weak-secret auditing runs in a cancellable Web Worker with custom dictionary support and progress feedback.
- Animation Frame Extractor for GIF, Lottie JSON, APNG, and animated WebP is integrated in the Image Studio with browser capability and memory-budget safeguards.
- PDF.js, sql.js, OpenPGP, sm-crypto, zxcvbn, and Headshot/MediaPipe now expose shared runtime loader status, retry, cache, and failure states.
- The browser-only WebGL face-swap tool has been removed after product review because its mesh-warping output was not reliable enough for a production toolbox.
- The video downloader is local-first, restores the default sopace public Cloudflare Worker API, and documents Worker capability boundaries; Workers improve CORS-limited parsing but do not bypass login, DRM, region, anti-abuse, copyright, or platform limits.
- PGP key generation now requires explicit user action before generated private keys are loaded into decrypt/sign inputs, and sensitive scratchpad outputs can carry metadata.
- HTML/SVG preview surfaces use allowlist sanitization instead of blacklist cleanup.
- Runtime assets can report fallback source URLs and optional SHA-256 verification state; PDF.js, SQL.js, and OpenPGP use fallback metadata.
- Headshot extraction falls back to manual crop mode when MediaPipe models fail or no face is detected.
- Animation frame batch export/stash flows expose progress and cancellation; APNG/WebP decoding probes unknown WebCodecs frame counts under frame/pixel budgets.
- STL repair includes browser-side wall-thickness heatmap sampling, fast/precise modes, cancellation, partial reports, grid prefiltering, and PBR material/environment controls.

## Stage 4: Quality Gates
**Status**: Complete

- Added Vitest unit tests for JSON Diff paths and cURL import.
- Added Playwright smoke tests for current Studio routes, locale/dark-mode controls, HTTP cURL import, mobile scratchpad drawer, APNG/WebP capability messaging, and STL wall-thickness controls.
- CI now runs unit tests and Playwright E2E smoke tests in addition to typecheck, lint, i18n, route map, production audit, and build.
- Modified modules pass TypeScript and ESLint checks.

## Next Iteration

- Add optional self-hosted mirrors and fixture-backed offline/timeout simulations for CDN-backed engines.
- Expand browser-level fixtures for IndexedDB failure, sensitive scratchpad metadata, video parser boundaries, and PGP/SM error states.
- Add real APNG/WebP, PDF, Headshot image, malicious SVG/HTML, and STL fixture suites for numeric frame delay, unknown frame-count probing, sanitizer behavior, and wall-thickness high-face diagnostics.
- Broaden mobile viewport E2E coverage across key Studio tabs, sensitive crypto flows, and long-running worker cancellation flows.
