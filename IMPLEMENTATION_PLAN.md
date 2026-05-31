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
- Studio tab history sync now responds to both hash and browser back/forward navigation.

## Stage 3: Feature Enhancements
**Status**: Partially Complete

- Color converter includes WCAG 2.1 contrast analysis, HSL micro-adjusters, and accessible color suggestions.
- JWT weak-secret auditing runs in a cancellable Web Worker with custom dictionary support and progress feedback.
- Animation Frame Extractor for GIF and Lottie JSON is integrated in the Image Studio.
- PDF.js now loads through the shared runtime asset loader.
- Remaining: APNG/WebP frame extraction, STL wall-thickness heatmap, and full PBR material/environment controls.

## Stage 4: Quality Gates
**Status**: Complete

- Added Vitest unit tests for JSON Diff paths and cURL import.
- Added Playwright smoke tests for legacy routes, locale/dark-mode controls, and HTTP cURL import.
- CI now runs unit tests and Playwright E2E smoke tests in addition to typecheck, lint, i18n, route map, production audit, and build.
- Modified modules pass TypeScript and ESLint checks.

## Next Iteration

- Move sql.js, OpenPGP, sm-crypto, zxcvbn, and MediaPipe to the shared runtime asset loader with visible retry/status UI.
- Add scratchpad persistence/quota tests and mobile viewport E2E coverage.
- Extend animation frame extraction to APNG/WebP.
- Implement STL wall-thickness heatmap and PBR environment presets.
