import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = path => readFileSync(join(root, path), 'utf8');

const registrySource = read('components/tools/registry.ts');

const getStudioIdsByComponent = () => {
  const studioIdsByComponent = new Map();
  const toolPattern = /\{\s*id:\s*'([^']+)'[\s\S]*?component:\s*(\w+)\s*\}/g;

  for (const match of registrySource.matchAll(toolPattern)) {
    studioIdsByComponent.set(match[2], match[1]);
  }

  return studioIdsByComponent;
};

const getCurrentSubTools = () => {
  const studioIdsByComponent = getStudioIdsByComponent();
  const studioDir = join(root, 'components/tools/studios');
  const subTools = [];

  for (const file of readdirSync(studioDir).filter(name => name.endsWith('.tsx'))) {
    const source = read(`components/tools/studios/${file}`);
    const exportName = source.match(/export const (\w+):/)?.[1];
    const studioId = exportName ? studioIdsByComponent.get(exportName) : undefined;
    if (!studioId || !source.includes('<TabbedToolbox')) continue;

    const subToolBlock = source.match(/const subTools:[\s\S]*?=\s*\[([\s\S]*?)\];/)?.[1];
    if (!subToolBlock) continue;

    for (const match of subToolBlock.matchAll(/\{\s*id:\s*'([^']+)'/g)) {
      subTools.push({ studioId, subToolId: match[1] });
    }
  }

  return subTools;
};

const getLegacyRoutes = () => {
  const routes = [];
  const legacyPattern = /'([^']+)':\s*\{\s*studioId:\s*'([^']+)',\s*subToolId:\s*'([^']+)'\s*\}/g;

  for (const match of registrySource.matchAll(legacyPattern)) {
    routes.push({ key: match[1], studioId: match[2], subToolId: match[3] });
  }

  return routes;
};

const currentSubTools = getCurrentSubTools();
const legacyRoutes = getLegacyRoutes();
const validTargets = new Set(currentSubTools.map(item => `${item.studioId}#${item.subToolId}`));
const legacyByKey = new Map(legacyRoutes.map(item => [item.key, item]));

const missing = currentSubTools.filter(item => {
  const legacy = legacyByKey.get(item.subToolId);
  return !legacy || legacy.studioId !== item.studioId || legacy.subToolId !== item.subToolId;
});

const stale = legacyRoutes.filter(item => !validTargets.has(`${item.studioId}#${item.subToolId}`));

if (missing.length > 0 || stale.length > 0) {
  if (missing.length > 0) {
    console.error('Missing direct legacy routes for current sub-tools:');
    for (const item of missing) {
      console.error(`- /tools/${item.subToolId} -> /tools/${item.studioId}#${item.subToolId}`);
    }
  }

  if (stale.length > 0) {
    console.error('Legacy routes point to missing studio tabs:');
    for (const item of stale) {
      console.error(`- /tools/${item.key} -> /tools/${item.studioId}#${item.subToolId}`);
    }
  }

  process.exit(1);
}

console.log(`Route map OK: ${currentSubTools.length} sub-tool direct routes and ${legacyRoutes.length} legacy aliases checked.`);
