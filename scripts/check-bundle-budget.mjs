import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const distAssetsDir = join(process.cwd(), 'dist', 'assets');

const budgets = {
  maxJsAssetBytes: 650 * 1024,
  maxCssAssetBytes: 160 * 1024,
  maxTotalJsBytes: 4.75 * 1024 * 1024,
};

const formatKiB = bytes => `${(bytes / 1024).toFixed(1)} KiB`;

const assets = readdirSync(distAssetsDir)
  .map(name => {
    const absolutePath = join(distAssetsDir, name);
    const stat = statSync(absolutePath);
    return { name, bytes: stat.size };
  })
  .filter(asset => asset.name.endsWith('.js') || asset.name.endsWith('.css'));

const jsAssets = assets.filter(asset => asset.name.endsWith('.js'));
const cssAssets = assets.filter(asset => asset.name.endsWith('.css'));
const totalJsBytes = jsAssets.reduce((sum, asset) => sum + asset.bytes, 0);

const errors = [];

for (const asset of jsAssets) {
  if (asset.bytes > budgets.maxJsAssetBytes) {
    errors.push(`${asset.name} is ${formatKiB(asset.bytes)}, over JS asset budget ${formatKiB(budgets.maxJsAssetBytes)}.`);
  }
}

for (const asset of cssAssets) {
  if (asset.bytes > budgets.maxCssAssetBytes) {
    errors.push(`${asset.name} is ${formatKiB(asset.bytes)}, over CSS asset budget ${formatKiB(budgets.maxCssAssetBytes)}.`);
  }
}

if (totalJsBytes > budgets.maxTotalJsBytes) {
  errors.push(`Total JS is ${formatKiB(totalJsBytes)}, over total JS budget ${formatKiB(budgets.maxTotalJsBytes)}.`);
}

if (errors.length > 0) {
  console.error('Bundle budget check failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const largest = [...assets]
  .sort((a, b) => b.bytes - a.bytes)
  .slice(0, 8)
  .map(asset => `${asset.name} ${formatKiB(asset.bytes)}`)
  .join(', ');

console.log(`Bundle budget OK: total JS ${formatKiB(totalJsBytes)}. Largest assets: ${largest}`);
