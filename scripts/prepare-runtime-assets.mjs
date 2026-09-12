import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { build } from 'esbuild';
const root = 'public/vendor';
fs.mkdirSync(root, { recursive: true });
const specs = [
 ['pdfjs', 'pdfjs-dist', 'build/pdf.min.mjs'], ['pdfWorker', 'pdfjs-dist', 'build/pdf.worker.min.mjs'],
 ['openpgp', 'openpgp', 'dist/openpgp.min.js'], 
 ['zxcvbn', 'zxcvbn', 'dist/zxcvbn.js'], ['lottie', 'lottie-web', 'build/player/lottie.min.js'],
];
for (const file of fs.readdirSync('node_modules/@mediapipe/tasks-vision/wasm').filter(file => /\.(js|wasm)$/.test(file))) specs.push([file, '@mediapipe/tasks-vision', `wasm/${file}`]);
const manifest = {};
const writeAsset = (key, pkg, file, bytes) => {
 const version = JSON.parse(fs.readFileSync(`node_modules/${pkg}/package.json`, 'utf8')).version;
 const name = `${pkg.replaceAll('/','-')}/${version}/${path.basename(file)}`;
 const target = `${root}/${name}`;
 fs.mkdirSync(path.dirname(target),{recursive:true}); fs.writeFileSync(target,bytes);
 manifest[key] = { path: `vendor/${name}`, package: pkg, version, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
 const packageRoot = `node_modules/${pkg}`;
 for (const license of fs.readdirSync(packageRoot).filter(f=> /^(LICENSE|LICENCE|COPYING|NOTICE)([._]|$)/i.test(f))) {
  const source = `${packageRoot}/${license}`;
  if (fs.statSync(source).isFile()) fs.copyFileSync(source,`${path.dirname(target)}/${license}`);
 }
};
for (const [key,pkg,file] of specs) writeAsset(key,pkg,file,fs.readFileSync(`node_modules/${pkg}/${file}`));
const sm = await build({entryPoints:['node_modules/sm-crypto/src/index.js'],bundle:true,format:'iife',globalName:'smCrypto',write:false,minify:true});
writeAsset('smCrypto','sm-crypto','sm-crypto.js',sm.outputFiles[0].contents);
const bundled = await build({entryPoints:['node_modules/gifuct-js/lib/index.js'],bundle:true,format:'iife',globalName:'gifuct',write:false,minify:true});
writeAsset('gifuct','gifuct-js','gifuct.js',bundled.outputFiles[0].contents);
const output = JSON.stringify(manifest,null,2)+'\n';
if(process.argv.includes('--check')) {
 if(fs.readFileSync('src/runtime-assets.json','utf8')!==output) throw new Error('Runtime manifest differs from locked dependencies. Run npm run assets:prepare.');
} else fs.writeFileSync('src/runtime-assets.json',output);
console.log(`Prepared ${Object.keys(manifest).length} local runtime assets and license notices`);
