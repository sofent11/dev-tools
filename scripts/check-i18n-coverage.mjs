import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const hasHan = value => /[\p{Script=Han}]/u.test(value);

const read = path => readFileSync(join(root, path), 'utf8');

const getExactTranslationKeys = () => {
  const source = read('src/i18n/messages.ts');
  const match = source.match(/const enExact:\s*Record<string,\s*string>\s*=\s*\{([\s\S]*?)\n\};/);
  if (!match) {
    throw new Error('Unable to locate enExact in src/i18n/messages.ts');
  }

  const keys = new Set();
  const keyPattern = /^\s*(['"])((?:\\.|(?!\1).)*?)\1\s*:/gm;
  for (const item of match[1].matchAll(keyPattern)) {
    keys.add(item[2]);
  }
  return keys;
};

const collectSourceFiles = () => {
  const studioDir = join(root, 'components/tools/studios');
  const studioFiles = readdirSync(studioDir)
    .filter(file => file.endsWith('.tsx'))
    .map(file => relative(root, join(studioDir, file)))
    .filter(file => read(file).includes('<TabbedToolbox'));

  return [
    'types.ts',
    'components/tools/registry.ts',
    ...studioFiles,
  ];
};

const extractQuotedValues = source => {
  const values = [];
  const propertyPattern = /\b(?:name|description):\s*(['"])((?:\\.|(?!\1).)*?)\1/g;
  const jsxPattern = /\b(?:title|description)=\s*(['"])((?:\\.|(?!\1).)*?)\1/g;
  const enumPattern = /^\s*[A-Z_]+\s*=\s*(['"])((?:\\.|(?!\1).)*?)\1/gm;

  for (const pattern of [propertyPattern, jsxPattern, enumPattern]) {
    for (const match of source.matchAll(pattern)) {
      if (hasHan(match[2])) {
        values.push(match[2]);
      }
    }
  }
  return values;
};

const exactKeys = getExactTranslationKeys();
const missing = [];
let checked = 0;

for (const file of collectSourceFiles()) {
  const values = extractQuotedValues(read(file));
  for (const value of values) {
    checked += 1;
    if (!exactKeys.has(value)) {
      missing.push({ file, value });
    }
  }
}

if (missing.length > 0) {
  console.error('Missing i18n translations for navigation and studio entry strings:');
  for (const item of missing) {
    console.error(`- ${item.file}: ${item.value}`);
  }
  process.exit(1);
}

console.log(`i18n coverage OK: ${checked} navigation and studio entry strings checked.`);
