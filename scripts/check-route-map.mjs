import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = path => readFileSync(join(root, path), 'utf8');

const registrySource = read('components/tools/registry.ts');

const getStudioImports = () => {
  const imports = new Map();
  const importPattern = /const\s+(\w+)\s*=\s*lazyNamed\(\(\)\s*=>\s*import\('([^']+)'\),\s*'([^']+)'\s*\)/g;
  for (const match of registrySource.matchAll(importPattern)) {
    imports.set(match[1], { importPath: match[2], exportName: match[3] });
  }
  return imports;
};

const getRegistryTools = () => {
  const tools = [];
  const toolPattern = /\{\s*id:\s*'([^']+)'[\s\S]*?component:\s*(\w+)\s*\}/g;
  for (const match of registrySource.matchAll(toolPattern)) {
    tools.push({ studioId: match[1], componentName: match[2] });
  }
  return tools;
};

const resolveStudioFile = importPath => `components/tools/${importPath.replace('./', '')}.tsx`;

const getStudioConfig = tool => {
  const imported = studioImports.get(tool.componentName);
  if (!imported) {
    return { errors: [`Registry component ${tool.componentName} has no lazyNamed studio import.`] };
  }

  const studioFile = resolveStudioFile(imported.importPath);
  if (!existsSync(join(root, studioFile))) {
    return { errors: [`Registry component ${tool.componentName} points to missing file ${studioFile}.`] };
  }

  const source = read(studioFile);
  const errors = [];
  if (!source.includes(`export const ${imported.exportName}:`)) {
    errors.push(`${studioFile} does not export ${imported.exportName}.`);
  }

  const subToolBlock = source.match(/const subTools:[\s\S]*?=\s*\[([\s\S]*?)\];/)?.[1];
  const subTools = subToolBlock
    ? Array.from(subToolBlock.matchAll(/\{\s*id:\s*'([^']+)'/g), match => match[1])
    : [];
  if (subTools.length === 0) {
    errors.push(`${studioFile} has no parseable subTools.`);
  }

  const duplicateTabs = subTools.filter((id, index) => subTools.indexOf(id) !== index);
  for (const tabId of new Set(duplicateTabs)) {
    errors.push(`${studioFile} repeats tab id "${tabId}".`);
  }

  const defaultTab = source.match(/defaultTab="([^"]+)"/)?.[1];
  if (!defaultTab) {
    errors.push(`${studioFile} is missing defaultTab.`);
  } else if (!subTools.includes(defaultTab)) {
    errors.push(`${studioFile} defaultTab "${defaultTab}" is not in subTools.`);
  }

  return { studioFile, subTools, defaultTab, errors };
};

const studioImports = getStudioImports();
const registryTools = getRegistryTools();
const registryIds = registryTools.map(tool => tool.studioId);
const duplicateStudios = registryIds.filter((id, index) => registryIds.indexOf(id) !== index);
const studioConfigById = new Map();
const errors = [];
let subToolCount = 0;

for (const studioId of new Set(duplicateStudios)) {
  errors.push(`Registry repeats studio id "${studioId}".`);
}

for (const tool of registryTools) {
  const config = getStudioConfig(tool);
  if (config.subTools) studioConfigById.set(tool.studioId, config);
  subToolCount += config.subTools?.length || 0;
  errors.push(...config.errors.map(error => `${tool.studioId}: ${error}`));
}

for (const match of registrySource.matchAll(/'([^']+)':\s*\{\s*studioId:\s*'([^']+)',\s*subToolId:\s*'([^']+)'/g)) {
  const [, alias, studioId, subToolId] = match;
  const studioConfig = studioConfigById.get(studioId);
  if (!studioConfig) {
    errors.push(`Legacy alias "${alias}" points to unknown studio "${studioId}".`);
  } else if (!studioConfig.subTools.includes(subToolId)) {
    errors.push(`Legacy alias "${alias}" points to missing tab "${studioId}#${subToolId}".`);
  }
}

if (errors.length > 0) {
  console.error('Route map validation failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Route map OK: ${registryTools.length} studios and ${subToolCount} studio tabs checked.`);
