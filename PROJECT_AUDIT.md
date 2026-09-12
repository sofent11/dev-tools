# Project reliability audit

Updated: 2026-09-12

## Resolved findings

1. JSON Schema uses strict draft-07 validation, standard formats, heterogeneous-array inference and a bounded worker. Unsupported schemas fail explicitly.
2. Common text inputs use bounded, session-only drafts across tool navigation. Heavy resources still unmount normally.
3. IndexedDB writes resolve on transaction completion. Missing content rejects, archive filenames remain unique after sanitizing, and sensitive items never enter persistent storage.
4. Interface translation occurs at React render time; the DOM observer has been removed. User data retains its language.
5. Runtime assets are prepared from locked dependencies and shipped with license notices. Script/WASM integrity is enforced at runtime; module integrity is checked at build time.
6. MediaPipe no longer replaces global fetch. Video Worker requests have URL checks, bounded bodies, deadlines and redirect validation; deployments support token, origin, hostname and rate-limit controls.
7. Regex and SQLite execute in disposable workers. SQLite commits its snapshot only on successful completion. Tool failures are contained and malformed routes are handled.
8. The app shell dynamically loads ZIP functionality and does not preload PDF/Three.js engines. A gzip budget is enforced against production output.
9. Strict TypeScript is enabled. Regression tests cover schema semantics, transactional aborts, sensitive persistence, worker cancellation, real SQLite queries, GIF delays/pixels, PDF pages and STL wall-thickness measurements. Browser tests use a production build and deterministic locale.
10. The generated 73-entry catalog powers sub-tool search and route documentation. Unreachable Studio wrappers and unused AI SDK/key configuration have been removed.

## Validation

Run `npm run verify` for the release gate. It includes typecheck, lint, translation coverage, routes, generated catalog, documentation, runtime manifest, unit tests, dependency audit, production build budget and browser regression tests. Browser coverage includes the English catalog scan.

Verified on 2026-09-12: all release gates passed, including 59 unit tests across 15 files and 21 Chromium browser tests. The browser suite includes all 73 English tool routes. The production dependency audit reported 0 vulnerabilities. Production app-shell JavaScript measured 121.4 KB gzip, below the 240 KB budget (approximately 363 KB at the initial audit).

## Deliberate product limits

- A browser session is not a durable backup; session drafts and sensitive scratchpad items are cleared on reload.
- MediaPipe models and jewelry fonts may still require a network connection. Model failure retains manual crop mode.
- Remote API access depends on CORS and endpoint permissions. Worker deployment authentication and distributed rate limiting require deployment configuration; application code cannot configure a separately hosted public endpoint.
- Geometry measurements remain estimates and experimental models require manufacturing review.
- Compatibility is validated in Chromium; broader Safari/Firefox and real-device coverage is future compatibility work, not an assertion of current support.
