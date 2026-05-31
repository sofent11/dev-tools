# DevToolbox Pro - Phase V Implementation Plan

## Stage 1: Network & Data Tools
**Goal**: Implement cURL reverse importer for HTTP Client Builder and tree nodes visual merging & RFC 6902 JSON Patch exporter for JSON Diff Tool.
**Success Criteria**:
- Paste raw cURL commands and parse them instantly into URL, Method, Headers, and Body inputs.
- Visual merging controls (`←` / `→`) on JSON Diff tree to align left/right nodes and download the edited JSON payload.
- Generate standard JSON Patch array strings from structural JSON changes.
**Tests**:
- Validate parsing of `curl -X POST` and verify filled state parameters.
- Validate node merge operations on differing JSON structures and confirm correctness of outputs.
**Status**: Complete

## Stage 2: Global Scratchpad & Color Accessibility
**Goal**: Enhance the Global Floating Scratchpad for seamless 11-studio data routing, and implement WCAG 2.1 AAA contrast analyzer & HSL micro-adjuster in Color Extractor.
**Success Criteria**:
- Add direct "Stash to Scratchpad" buttons inside main data-producing tools.
- Provide direct "Load from Scratchpad" shortcuts inside primary tools like Hex Viewer.
- Double-side contrast checks against white and dark text, showing AA/AAA compliant ratings.
- Micro-adjust color values via HSL sliders and export tailwind/css variables.
**Tests**:
- Stash generated data to Scratchpad, select active tools, load data instantly.
- Extract color and verify AA/AAA ratings changing visually as HSL ranges are dragged.
**Status**: In Progress (Scratchpad IndexedDB hybrid store and routing completed)

## Stage 3: Security & Animation Frame Extractor
**Goal**: Add HS256 local JWT SubtleCrypto dictionary brute-forcing sandbox, PEM/DER/JWK triple key converter, and APNG/WebP/Lottie animation frames extractor.
**Success Criteria**:
- Web Worker-driven multi-threaded offline JWT decryption brute-forcer.
- Conversion of keys between PKCS PEM string, HEX DER bytes, and JSON JWK formats.
- Interactive frame scroller for animated WebP/APNG/Lottie and single PNG frame downloads.
**Tests**:
- Run brute-force on simple JWT signature and confirm success.
- Scrub an APNG animation frame and download the single frame.
**Status**: In Progress (Animation Frame Extractor for GIF and Lottie JSON completed)

## Stage 4: 3D printable Wall Thickness Heatmap & PBR Env Renderer
**Goal**: Integrate Three.js raycasting wall thickness heatmap analysis and custom PBR HDR environment & rough-metallic presets in STL viewer.
**Success Criteria**:
- Raycast mesh normal-inverted Opposing Face Intersectors mapping thin walls (< 0.8mm) to high-contrast red/blue vertex colors.
- Interactive roughness, metalness, and environmental map presets with soft shadow toggle.
**Tests**:
- Upload STL file, analyze printable thickness heatmap and inspect visual materials rendering in Three.js canvas.
**Status**: Not Started

## Stage 5: Quality Gates & Deliver
**Goal**: Clean all TypeScript/ESLint warnings & errors and optimize production bundle under 6.0s.
**Success Criteria**:
- Modified modules achieve **0 ESLint errors**.
- Vite production builds succeed in **< 6.0 seconds**.
- Push commits and delete workspace tracker.
**Tests**:
- Run `npm run lint` and `npm run build` in shell.
**Status**: Complete (TypeScript 0 errors, ESLint 0 warnings, production build completed in 5.66s)
