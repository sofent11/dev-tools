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
**Status**: Complete, hardening ongoing

- Color converter includes WCAG 2.1 contrast analysis, HSL micro-adjusters, and accessible color suggestions.
- JWT weak-secret auditing runs in a cancellable Web Worker with custom dictionary support and progress feedback.
- Animation Frame Extractor for GIF, Lottie JSON, APNG, and animated WebP is integrated in the Image Studio with browser capability and memory-budget safeguards.
- PDF.js now loads through the shared runtime asset loader.
- STL repair includes browser-side wall-thickness heatmap sampling, fast/precise modes, cancellation, and PBR material/environment controls.
- Remaining hardening: fixtures and E2E coverage for APNG/WebP and representative STL models.

## Stage 4: Quality Gates
**Status**: Complete

- Added Vitest unit tests for JSON Diff paths and cURL import.
- Added Playwright smoke tests for legacy routes, locale/dark-mode controls, and HTTP cURL import.
- CI now runs unit tests and Playwright E2E smoke tests in addition to typecheck, lint, i18n, route map, production audit, and build.
- Modified modules pass TypeScript and ESLint checks.

## Next Iteration

- Continue exposing shared runtime loader states in sql.js, OpenPGP, sm-crypto, zxcvbn, FaceSwap, and MediaPipe tool panels.
- Add scratchpad persistence/quota tests and mobile viewport E2E coverage.
- Add fixture-backed tests for APNG/WebP frame extraction and STL wall-thickness fast/precise diagnostics.
