# Reliability implementation plan

Updated: 2026-09-12

The September reliability work is implemented across the ten findings recorded in PROJECT_AUDIT.md. Release requires `npm run verify` to pass and a clean generated catalog/runtime manifest.

## Maintenance sequence

1. Add regression fixtures before changing parsers, storage semantics, or geometry algorithms.
2. Keep runtime dependencies pinned by package-lock.json; regenerate assets and inspect manifest/license changes when upgrading.
3. Register tool metadata in Studio definitions, regenerate the catalog, and update bilingual interface strings together.
4. Preserve worker cancellation, bounded outputs and draft privacy while extending tools.
5. Measure actual production route loading before changing bundle boundaries.

## Future product work

- Broaden browser/device compatibility coverage beyond Chromium.
- Add more independently verified geometry and media corpora.
- Evaluate model/font self-hosting with explicit redistribution rights.
- Refine feature priorities using task-completion feedback without collecting user inputs or private files.
