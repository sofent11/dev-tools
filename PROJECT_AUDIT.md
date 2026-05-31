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
- Stabilized React hook dependencies in network pinging, SQLite setup, image vectorization, and 3D material rendering.
- Moved mock WebSocket/SSE classes out of React component bodies so React Compiler can optimize the component.
- Hardened scratchpad SVG preview sanitization before `dangerouslySetInnerHTML`.
- Hardened scratchpad ZIP filenames and added accessible drawer controls.
- Added object URL cleanup for image vectorization previews.
- Added stable vendor chunking for production builds and removed noisy chunk warnings.
- Added a local favicon, Chinese document language, description, and theme color metadata.
- Added GitHub Actions quality checks for typecheck, lint, and build.

## Remaining Known Issues

- Several large vendor chunks remain by nature of Three.js, pdf-lib, and data tooling. They are lazy-loaded and cached, but deeper splitting can be revisited if real-user performance data shows a problem.
- Browser-only remote CDN dependencies should continue moving onto the shared loader path; PDF.js is covered, while sql.js, OpenPGP, sm-crypto, zxcvbn, and MediaPipe still need the same UI-level retry/status treatment.
- Animation frame extraction and STL wall-thickness/PBR enhancements remain product feature work.

## Recommended Next Iterations

1. Finish runtime loader adoption:
   Move sql.js, OpenPGP, sm-crypto, zxcvbn, and MediaPipe to the shared loader with retry/status UI.

2. Expand per-tool tests:
   Add focused tests for scratchpad persistence/quota behavior, runtime loader timeout/retry, SQL formatting, SVG sanitizer, and JWT worker auditing.

3. Improve offline resilience:
   Add local `public/vendor` mirrors for self-hostable browser assets where licenses allow.

4. Finish product feature stages:
   Continue the staged roadmap from `IMPLEMENTATION_PLAN.md`: animation frame extraction and 3D wall-thickness/PBR improvements.

5. Tighten CI over time:
   Add mobile viewport Playwright coverage for the scratchpad drawer and key Studio tabs.
