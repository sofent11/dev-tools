import fs from 'node:fs';
import zlib from 'node:zlib';
const html = fs.readFileSync('dist/index.html','utf8');
const entries = [...html.matchAll(/(?:src|href)="([^\"]+\.js)"/g)].map(m => m[1]);
let gzip = 0;
for (const file of entries) {
 const code = fs.readFileSync(`dist${file}`);
 gzip += zlib.gzipSync(code).length;
 if (/vendor-(documents|three)/.test(file)) throw new Error(`Heavy engine preloaded by app shell: ${file}`);
}
if (gzip > 240_000) throw new Error(`App shell exceeds 240 KB gzip budget: ${gzip}`);
console.log(`App shell JS: ${(gzip/1000).toFixed(1)} KB gzip (budget 240 KB)`);
