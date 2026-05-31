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

- `npm run lint` still reports warnings, mainly deliberate `any` usage around dynamic JSON transforms, SQLite WASM, OpenPGP, and CDN-loaded crypto globals.
- Several large vendor chunks remain by nature of Three.js, pdf-lib, and data tooling. They are lazy-loaded and cached, but deeper splitting can be revisited if real-user performance data shows a problem.
- Browser-only remote CDN dependencies should have clearer offline/error states in tools that rely on sql.js, OpenPGP, sm-crypto, MediaPipe, and PDF.js.
- The existing `IMPLEMENTATION_PLAN.md` still has several feature stages marked not started.

## Recommended Next Iterations

1. Type the dynamic data layer:
   Define reusable `JsonValue`, SQLite result, OpenPGP facade, and sm-crypto facade types. This should clear most remaining lint warnings without changing behavior.

2. Add per-tool smoke tests:
   Start with pure utilities and high-value flows: JSON diff merge, cURL import/export, SQL formatting, SVG sanitizer, scratchpad import/export, and route mapping.

3. Improve offline resilience:
   Add shared script/CDN loader states with retry, version display, timeout, and fallback messaging for tools that require remote runtime assets.

4. Finish product feature stages:
   Continue the staged roadmap from `IMPLEMENTATION_PLAN.md`: scratchpad routing shortcuts, color accessibility analyzer, security key conversion/bruteforce sandbox, animation frame extraction, and 3D wall-thickness/PBR improvements.

5. Tighten CI over time:
   Once warnings are reduced, run `eslint . --max-warnings=0` in CI to prevent new warning debt.
