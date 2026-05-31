import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = path => readFileSync(join(root, path), 'utf8');

const stalePatterns = [
  {
    file: 'IMPLEMENTATION_PLAN.md',
    pattern: /Remaining:\s*APNG\/WebP frame extraction/i,
    message: 'IMPLEMENTATION_PLAN still lists APNG/WebP extraction as remaining work.',
  },
  {
    file: 'IMPLEMENTATION_PLAN.md',
    pattern: /Implement STL wall-thickness heatmap/i,
    message: 'IMPLEMENTATION_PLAN still lists STL wall-thickness heatmap as unimplemented.',
  },
  {
    file: 'PROJECT_AUDIT.md',
    pattern: /Animation frame extraction and STL wall-thickness\/PBR enhancements remain product feature work/i,
    message: 'PROJECT_AUDIT still says animation/STL enhancements remain product feature work.',
  },
  {
    file: 'IMPLEMENTATION_PLAN.md',
    pattern: /Continue exposing shared runtime loader states in sql\.js, OpenPGP, sm-crypto, zxcvbn, FaceSwap, and MediaPipe tool panels/i,
    message: 'IMPLEMENTATION_PLAN still lists completed runtime panel migrations as next work.',
  },
  {
    file: 'PROJECT_AUDIT.md',
    pattern: /Continue surfacing cached\/loading\/retry\/error state inside sql\.js, OpenPGP, sm-crypto, zxcvbn, FaceSwap, and MediaPipe panels/i,
    message: 'PROJECT_AUDIT still lists completed runtime panel migrations as next work.',
  },
  {
    file: 'IMPLEMENTATION_PLAN.md',
    pattern: /Add scratchpad persistence\/quota tests and mobile viewport E2E coverage/i,
    message: 'IMPLEMENTATION_PLAN still lists completed scratchpad/mobile smoke coverage as next work.',
  },
  {
    file: 'PROJECT_AUDIT.md',
    pattern: /Add mobile viewport Playwright coverage for the scratchpad drawer/i,
    message: 'PROJECT_AUDIT still lists completed scratchpad drawer mobile coverage as next work.',
  },
];

const errors = stalePatterns.filter(item => item.pattern.test(read(item.file)));

if (errors.length > 0) {
  console.error('Docs roadmap check failed:');
  for (const error of errors) {
    console.error(`- ${error.file}: ${error.message}`);
  }
  process.exit(1);
}

console.log('Docs roadmap OK: completed runtime, scratchpad, APNG/WebP, and STL items are not listed as remaining.');
