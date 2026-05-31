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
];

const errors = stalePatterns.filter(item => item.pattern.test(read(item.file)));

if (errors.length > 0) {
  console.error('Docs roadmap check failed:');
  for (const error of errors) {
    console.error(`- ${error.file}: ${error.message}`);
  }
  process.exit(1);
}

console.log('Docs roadmap OK: completed APNG/WebP and STL wall-thickness items are not listed as remaining.');
