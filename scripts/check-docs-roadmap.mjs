import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = path => readFileSync(join(root, path), 'utf8');
const readTarget = path => {
  const absolutePath = join(root, path);
  const stats = statSync(absolutePath);
  if (!stats.isDirectory()) return read(path);

  const files = [];
  const walk = current => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
        files.push(readFileSync(fullPath, 'utf8'));
      }
    }
  };
  walk(absolutePath);
  return files.join('\n');
};

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
    pattern: /Continue exposing shared runtime loader states in sql\.js, OpenPGP, sm-crypto, zxcvbn, and MediaPipe tool panels/i,
    message: 'IMPLEMENTATION_PLAN still lists completed runtime panel migrations as next work.',
  },
  {
    file: 'PROJECT_AUDIT.md',
    pattern: /Continue surfacing cached\/loading\/retry\/error state inside sql\.js, OpenPGP, sm-crypto, zxcvbn, and MediaPipe panels/i,
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
  {
    file: 'README.md',
    pattern: /完美解锁全部解析功能/i,
    message: 'README overpromises video parser support.',
  },
  {
    file: 'PROJECT_AUDIT.md',
    pattern: /完美解锁全部解析功能/i,
    message: 'PROJECT_AUDIT overpromises video parser support.',
  },
  {
    file: 'IMPLEMENTATION_PLAN.md',
    pattern: /完美解锁全部解析功能/i,
    message: 'IMPLEMENTATION_PLAN overpromises video parser support.',
  },
  {
    file: 'components/tools/VideoDownloader.tsx',
    pattern: /完美解锁全部解析功能/i,
    message: 'VideoDownloader still claims a private Worker perfectly unlocks all parsing.',
  },
  {
    file: 'components/tools/registry.ts',
    pattern: /faceswap|face-swap|FaceSwap/i,
    message: 'Registry still references the removed low-quality FaceSwap tool.',
  },
  {
    file: 'components/tools/VideoDownloader.tsx',
    pattern: /api-dev\.sopace\.top/i,
    message: 'VideoDownloader should not default to a third-party Worker endpoint.',
  },
  {
    file: 'components/tools',
    pattern: /\b(?:window\.)?alert\s*\(/,
    message: 'Tool components should use notifyToast or inline status instead of blocking alert().',
  },
];

const errors = stalePatterns.filter(item => item.pattern.test(readTarget(item.file)));

if (errors.length > 0) {
  console.error('Docs roadmap check failed:');
  for (const error of errors) {
    console.error(`- ${error.file}: ${error.message}`);
  }
  process.exit(1);
}

console.log('Docs roadmap OK: completed runtime, scratchpad, APNG/WebP, and STL items are not listed as remaining.');
