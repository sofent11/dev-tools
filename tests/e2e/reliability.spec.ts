import { expect, test } from '@playwright/test';
import path from 'node:path';
const fixture = (name: string) => path.resolve('tests/fixtures', name);

test('Schema rejects unsupported constraints and retains drafts across tabs and language changes', async ({ page }) => {
  await page.goto('/tools/data-format-studio#json-schema');
  await page.locator('textarea').nth(0).fill('3');
  await page.locator('textarea').nth(1).fill('{"type":"number","minimum":10}');
  await page.getByRole('button', { name: '运行 Schema 本地校验' }).click();
  await expect(page.getByText(/must be >= 10/)).toBeVisible();
  await page.getByRole('tab', { name: 'XML 工具', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'XML 工具', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'JSON Schema', exact: true }).click();
  await expect(page.locator('textarea').nth(0)).toHaveValue('3');
  await expect(page.locator('textarea').nth(1)).toHaveValue('{"type":"number","minimum":10}');
  await page.getByRole('button', { name:'Switch to English' }).click();
  await page.locator('textarea').nth(0).fill('20');
  await page.getByRole('button', { name:/Run local schema validation|本地校验/i }).click();
  await expect(page.getByText(/Validation passed/)).toBeVisible();
});

test('search finds a sub-tool and navigates directly to its tab', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('搜索工具...').fill('正则');
  await page.getByRole('link', { name:/正则测试/ }).click();
  await expect(page).toHaveURL(/text-markup-studio#regex$/);
  await expect(page.getByRole('heading', { name:'正则表达式测试', exact:true })).toBeVisible();
});

test('path decoding and disabled storage cannot break the app shell', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('blocked','SecurityError'); };
    Storage.prototype.setItem = () => { throw new DOMException('blocked','SecurityError'); };
  });
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
  await page.evaluate(() => { history.pushState(null,'','/tools/%E0%A4%A'); dispatchEvent(new PopStateEvent('popstate')); });
  await expect(page.locator('main')).toBeVisible();
  await page.getByRole('button',{name:'Switch to English'}).click();
  await expect(page.locator('html')).toHaveAttribute('lang','en-US');
});

test('pathological regex times out while navigation remains usable', async ({ page }) => {
  await page.goto('/tools/text-markup-studio#regex');
  await page.getByPlaceholder(/正则表达式/).fill('(a+)+$');
  await page.locator('textarea').fill('a'.repeat(36)+'!');
  await expect(page.getByText(/time budget/)).toBeVisible({timeout:7000});
  await page.getByRole('tab',{name:'文本统计',exact:true}).click();
  await expect(page).toHaveURL(/#stats$/);
});

test('SQLite runs offline and cancellation preserves the completed database', async ({ page }) => {
  await page.route('https://**/*',route=>route.abort());
  await page.goto('/tools/sql-database-studio#sqlite-sandbox');
  await expect(page.getByRole('cell',{name:'Alice',exact:true})).toBeVisible({timeout:15000});
  await page.locator('textarea').fill('WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n) SELECT sum(x) FROM n;');
  await page.getByRole('button',{name:'执行 SQL (Ctrl+Enter)'}).click();
  await page.getByRole('button',{name:'Cancel task'}).click();
  await expect(page.getByText(/last completed database/)).toBeVisible();
  await page.locator('textarea').fill('SELECT COUNT(*) AS count FROM users;');
  await page.getByRole('button',{name:'执行 SQL (Ctrl+Enter)'}).click();
  await expect(page.getByRole('columnheader',{name:'count',exact:true})).toBeVisible();
  await expect(page.getByRole('cell',{name:'2',exact:true})).toBeVisible();
});

test('GIF extraction uses local assets and preserves both frames', async ({ page }) => {
  await page.route('https://**/*',route=>route.abort());
  await page.goto('/tools/image-media-studio#animation-frame');
  await page.locator('input[type=file]').setInputFiles(fixture('two-frames.gif'));
  await expect(page.getByText('FRAME 1 / 2')).toBeVisible();
  await expect(page.getByText('50 ms · 1x1')).toBeVisible();
  await page.getByTitle('后一帧').click();
  await expect(page.getByText('FRAME 2 / 2')).toBeVisible();
  await expect(page.getByText('100 ms · 1x1')).toBeVisible();
});

test('PDF rendering works without a CDN', async ({ page }) => {
  await page.route('https://**/*',route=>route.abort());
  await page.goto('/tools/file-document-studio#pdf');
  await page.locator('input[type=file]').first().setInputFiles(fixture('two-pages.pdf'));
  await expect(page.locator('img').filter({ hasNot: page.locator('[src=""]') }).first()).toBeVisible({timeout:15000});
  await expect(page.getByRole('button',{name:'开始混编并导出 PDF'})).toBeEnabled();
  const download = page.waitForEvent('download');
  await page.getByRole('button',{name:'开始混编并导出 PDF'}).click();
  const result=await download;
  expect(result.suggestedFilename()).toMatch(/\.pdf$/);
});

test('sensitive scratchpad content stays out of both persistent stores', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => dispatchEvent(new CustomEvent('add-scratchpad-item', { detail: { name:'private-fixture.pem', content:'private-fixture-secret', sensitive:true, type:'text' } })));
  await page.getByLabel('打开全局数据暂存箱').click();
  await expect(page.getByRole('button',{name:'private-fixture.pem',exact:true})).toBeVisible();
  const persisted = await page.evaluate(async () => {
    const text = localStorage.getItem('devtoolbox-scratchpad-storage');
    const records = await new Promise<unknown[]>((resolve,reject)=>{
      const request=indexedDB.open('devtoolbox-scratchpad-db',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('entries');
      request.onerror=()=>reject(request.error);
      request.onsuccess=()=>{const db=request.result;const get=db.transaction('entries').objectStore('entries').getAll();get.onsuccess=()=>{resolve(get.result);db.close();};get.onerror=()=>reject(get.error);};
    });
    return JSON.stringify({text,records});
  });
  expect(persisted).not.toContain('private-fixture-secret');
  expect(persisted).not.toContain('private-fixture.pem');
  await page.reload();
  await page.getByLabel('打开全局数据暂存箱').click();
  await expect(page.getByRole('button',{name:'private-fixture.pem',exact:true})).toHaveCount(0);
});

test('PGP key generation works from locally deployed runtime assets', async ({ page }) => {
  await page.route('https://**/*',route=>route.abort());
  await page.goto('/tools/security-key-studio#pgp-keymaster');
  await page.getByRole('button',{name:'生成 GPG/PGP 密钥对',exact:true}).click();
  await expect(page.locator('textarea').nth(0)).toHaveValue(/BEGIN PGP PUBLIC KEY BLOCK/);
  await expect(page.locator('textarea').nth(1)).toHaveValue(/BEGIN PGP PRIVATE KEY BLOCK/);
});

test('APNG preserves frame count and delays where ImageDecoder is supported', async ({ page }) => {
  await page.goto('/tools/image-media-studio#animation-frame');
  const supported=await page.evaluate(async()=>{
    const decoder=(globalThis as typeof globalThis & { ImageDecoder?: { isTypeSupported(type:string):Promise<boolean> } }).ImageDecoder;
    return decoder ? decoder.isTypeSupported('image/png') : false;
  });
  await page.locator('input[type=file]').setInputFiles(fixture('two-frames.apng'));
  if (!supported) { await expect(page.getByText(/WebCodecs ImageDecoder/).last()).toBeVisible(); return; }
  await expect(page.getByText('FRAME 1 / 2')).toBeVisible();
  await expect(page.getByText('100 ms · 1x1')).toBeVisible();
  await page.getByTitle('后一帧').click();
  await expect(page.getByText('200 ms · 1x1')).toBeVisible();
});

 test('legacy aliases preserve tools added on main', async ({ page }) => {
  for (const [alias, studio, tab] of [
    ['numerology', 'generator-utility-studio', 'arithmancy'],
    ['hex-text', 'encoding-binary-studio', 'hex-text'],
    ['github-repos', 'repo-dependency-studio', 'github-repos'],
  ]) {
    await page.goto(`/tools/${alias}`);
    await expect(page).toHaveURL(new RegExp(`/tools/${studio}#${tab}$`));
    await expect(page.getByRole('tab', { selected: true })).toBeVisible();
  }
});

test('IP success state translates its public-service notice', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('locale', 'en-US'));
  await page.route('https://ipapi.co/json/', route => route.fulfill({ json: { ip: '203.0.113.1', city: 'Test', country_name: 'Test', timezone: 'UTC' } }));
  await page.goto('/tools/network-diagnostics-studio#ip');
  await expect(page.getByText('Information is provided by free public services • fetched and displayed locally in your browser')).toBeVisible();
});
