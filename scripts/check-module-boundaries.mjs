import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = path => readFileSync(join(root, path), 'utf8');

const requiredModules = [
  {
    file: 'components/tools/data/jsonDiffCore.ts',
    exports: ['buildDiff', 'generateJsonPatch', 'toJsonPointer', 'setValueAtPath', 'deleteValueAtPath'],
    importedBy: 'components/tools/DataTools.tsx',
  },
  {
    file: 'components/tools/network/curlParser.ts',
    exports: ['parseCurlCommand', 'parseFormBodyLines'],
    importedBy: 'components/tools/NetworkTools.tsx',
  },
  {
    file: 'components/tools/security/passwordCore.ts',
    exports: ['buildPasswordCharset', 'generateUnbiasedPassword'],
    importedBy: 'components/tools/SecurityTools.tsx',
  },
  {
    file: 'components/tools/images/vectorizerCore.ts',
    exports: ['runMarchingEdges', 'simplifyCollinearPath'],
    importedBy: 'components/tools/images/ImageVectorizerPanel.tsx',
    importPath: './vectorizerCore',
  },
];

const errors = [];

for (const module of requiredModules) {
  const absolutePath = join(root, module.file);
  if (!existsSync(absolutePath)) {
    errors.push(`${module.file} is missing.`);
    continue;
  }

  const source = read(module.file);
  for (const exportName of module.exports) {
    if (!new RegExp(`export\\s+(?:const|function|type|interface)\\s+${exportName}\\b|export\\s*\\{[^}]*\\b${exportName}\\b`).test(source)) {
      errors.push(`${module.file} should export ${exportName}.`);
    }
  }

  const importer = read(module.importedBy);
  const expectedImport = module.importPath ?? module.file.replace('components/tools/', './').replace(/\.ts$/, '');
  if (!importer.includes(expectedImport)) {
    errors.push(`${module.importedBy} should import ${module.file}.`);
  }
}

if (errors.length > 0) {
  console.error('Module boundary check failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Module boundary OK: ${requiredModules.length} extracted core modules checked.`);
