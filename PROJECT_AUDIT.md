# Project Audit

Last updated: 2026-05-31

## Current Functional Map

The app is a Vite + React browser-side developer toolbox with 11 top-level studios:

- JSON and data formatting
- Security and cryptography
- Text editing and diffing
- Encoding and escaping
- HTML and Markdown preview
- Network request and client inspection
- CSS and vector styling
- Image and media tools
- File and PDF processing
- CAD and 3D tools
- System, time, generators, and AI tools

Cross-cutting capabilities include deep-link routing, a global scratchpad drawer, dark mode, lazy-loaded studios, local-only processing for most tools, and Vercel SPA fallback.

## Fixed In This Audit Branch

- Fixed JSON Diff path handling with structured path segments and RFC 6901 JSON Pointer escaping.
- Hardened JSON Patch generation for special object keys and array removals.
- Improved HTTP cURL import for `--url`, `-G`, repeated data flags, `--data-urlencode`, basic auth, escaped quotes, and form fields.
- Scoped the HTTP Mock sandbox to the HTTP tool request flow instead of monkey-patching global `window.fetch`.
- Added a global toast surface and routed non-critical `alert` calls into accessible non-blocking feedback.
- Expanded scratchpad items with metadata, source labels, size display, rename support, multi-version retention, and mobile-visible actions.
- Added WCAG 2.1 contrast analysis, HSL micro-adjustment, and accessible color suggestions to the color tool.
- Moved JWT weak-secret auditing into a cancellable Web Worker with custom dictionary support and progress reporting.
- Added a shared runtime asset loader and wired PDF.js through the timeout/cached loader path.
- Fixed studio tab back/forward sync by listening to both `hashchange` and `popstate`.
- Added Vitest unit tests, Playwright smoke tests, and CI coverage for both.
- Restored a real typecheck quality gate with `npm run typecheck`.
- Fixed all TypeScript errors reported by `tsc --noEmit`.
- Added Vite and remote PDF.js module type declarations.
- Fixed `fast-xml-parser` option casing for namespace handling.
- Surfaced shared runtime loader state in sql.js, OpenPGP, sm-crypto, zxcvbn, and Headshot/MediaPipe panels.
- Removed the browser-only WebGL face-swap tool because its mesh-warping result did not meet product-quality expectations and browser-local execution cannot reliably deliver photorealistic identity transfer.
- Added runtime timeout cleanup tests, retry/cached state coverage, and unified retry affordances for major CDN-backed tools.
- Added scratchpad degraded/error persistence handling, background failure toasts, and Drawer storage health/quota visibility.
- Added animation batch progress/cancel flows, ZIP filename sanitization, and WebCodecs APNG/WebP unknown-frame probing.
- Moved STL wall-thickness analysis into a Worker, added partial reports, fast/precise controls, and grid-based candidate prefiltering.
- Added Playwright smoke coverage for mobile scratchpad, APNG/WebP capability messaging, and STL wall-thickness controls.
- Stabilized React hook dependencies in network pinging, SQLite setup, image vectorization, and 3D material rendering.
- Moved mock WebSocket/SSE classes out of React component bodies so React Compiler can optimize the component.
- Hardened scratchpad SVG preview sanitization before `dangerouslySetInnerHTML`.
- Hardened scratchpad ZIP filenames and added accessible drawer controls.
- Added object URL cleanup for image vectorization previews.
- Added stable vendor chunking for production builds and removed noisy chunk warnings.
- Added a local favicon, Chinese document language, description, and theme color metadata.
- Added GitHub Actions quality checks for typecheck, lint, and build.
- Clarified video downloader capability boundaries: private Workers improve CORS-limited fetches but do not bypass login, DRM, region, anti-abuse, copyright, or platform policy limits.
- Removed remaining blocking `alert()` calls from tool components in favor of inline status and `notifyToast`, including PGP/SM crypto operations, animation batch failures, image compression, network parsing, and data tools.
- Added explicit PGP key handoff controls so generated private keys are no longer auto-filled into decrypt/sign inputs; sensitive scratchpad outputs can now carry metadata such as `sensitive` and `originAction`.
- Removed global `window.alert` / `window.confirm` monkey-patching from the i18n provider; tool feedback now stays explicit through toast or inline state.
- Replaced blacklist-style HTML/SVG cleanup with allowlist sanitization for preview surfaces.
- Added runtime asset fallback URL, active source, and optional SHA-256 verification state support, with initial adoption in PDF.js, SQL.js, and OpenPGP.
- Hardened Headshot/MediaPipe failure recovery with a visible manual-crop mode when models fail or no face is detected.

## Remaining Known Issues

- Several large vendor chunks remain by nature of Three.js, pdf-lib, and data tooling. They are lazy-loaded and cached, but deeper splitting can be revisited if real-user performance data shows a problem.
- Browser-only remote CDN dependencies now share a common runtime loader compatibility path and visible panels in the highest-risk tools. Remaining work is self-hosted asset mirrors and deeper fixture-backed failure simulation.
- Runtime loader now supports fallback URLs and optional SHA-256 verification metadata. Remaining work is adding vetted self-hosted files under `public/vendor` where license and bundle size allow.
- Animation frame extraction supports GIF, Lottie JSON, APNG, and animated WebP. APNG/WebP rely on browser WebCodecs `ImageDecoder`, now probe unknown frame counts, and still enforce frame/pixel budgets.
- STL wall-thickness and PBR environment controls are implemented as browser-side engineering aids. The worker now uses grid prefiltering and partial reports, but the result remains a sampling estimate rather than slicer or industrial inspection truth.

## Recommended Next Iterations

1. Improve runtime loader UI adoption:
   Add vetted `public/vendor` mirrors and fixture-backed offline simulations for the remaining CDN-backed engines.

2. Expand per-tool tests:
   Add more fixture-backed tests for SQL formatting, SVG sanitizer, JWT worker auditing, APNG/WebP probing, video parser boundaries, PGP/SM failure states, and STL wall-thickness high-face models.

3. Improve offline resilience:
   Add local `public/vendor` mirrors for self-hostable browser assets where licenses allow.

4. Harden product feature stages:
   Add real media/STL fixture suites for APNG/WebP frame extraction and STL wall-thickness fast/precise numeric diagnostics.

5. Tighten CI over time:
   Broaden mobile viewport Playwright coverage beyond the scratchpad drawer to key Studio tabs, sensitive crypto flows, and long-running worker cancellation flows.
