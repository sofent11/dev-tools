import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('locale', 'zh-CN'));
});

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

test('animation ZIP exports the decoded frames and corrupt WebCodecs frames fail visibly', async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
  await page.goto('/tools/image-media-studio#animation-frame');
  await page.locator('input[type=file]').setInputFiles(fixture('two-frames.gif'));
  await expect(page.getByText('FRAME 1 / 2', { exact: true })).toBeVisible();
  await page.getByTitle('后一帧', { exact: true }).click();
  await expect(page.getByText('100 ms · 1x1', { exact: true })).toBeVisible();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: '打包 ZIP 下载', exact: true }).click();
  const archive = await JSZip.loadAsync(await readFile((await (await pending).path())!));
  expect(Object.values(archive.files).filter(file => !file.dir)).toHaveLength(2);

  await page.addInitScript(() => {
    class CorruptDecoder {
      tracks = { selectedTrack: { frameCount: 1 }, ready: Promise.resolve() };
      static async isTypeSupported() { return true; }
      async decode({ frameIndex }: { frameIndex: number }) {
        if (frameIndex > 0) throw new Error('Invalid frame data');
        const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
        return { image: new VideoFrame(canvas, { timestamp: 0, duration: 100_000 }) };
      }
      close() { (window as typeof window & { decoderClosed?: boolean }).decoderClosed = true; }
    }
    Object.defineProperty(window, 'ImageDecoder', { configurable: true, value: CorruptDecoder });
  });
  await page.reload();
  await page.locator('input[type=file]').setInputFiles(fixture('two-frames.apng'));
  await expect(page.getByText('Invalid frame data', { exact: true })).toBeVisible();
  await expect(page.getByText('FRAME 1 / 1', { exact: true })).toHaveCount(0);
  await expect(page.locator('input[type=file]')).toBeEnabled();
  expect(await page.evaluate(() => (window as typeof window & { decoderClosed?: boolean }).decoderClosed)).toBe(true);
});

test('headshot model failure allows a manual crop at original image resolution', async ({ browser }) => {
  const context = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem('locale', 'zh-CN'));
  await page.route('https://**/*', route => route.abort());
  await page.goto('/tools/image-media-studio#headshot');
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 500;
    canvas.getContext('2d')!.fillRect(0, 0, 400, 500);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('input[type=file]').setInputFiles({ name: 'portrait.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') });
  const download = page.getByRole('button', { name: '保存裁剪结果', exact: true });
  await expect(download).toBeEnabled();
  await expect(page.getByText('手动裁剪模式', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '4:5', exact: true }).click();
  const pending = page.waitForEvent('download'); await download.click();
  const bytes = await readFile((await (await pending).path())!);
  const dimensions = await page.evaluate(async source => {
    const image = await createImageBitmap(new Blob([new Uint8Array(source)], { type: 'image/png' }));
    const size = [image.width, image.height]; image.close(); return size;
  }, [...bytes]);
  expect(dimensions[0] / dimensions[1]).toBeCloseTo(4 / 5, 1);
  expect(dimensions[0]).toBeLessThanOrEqual(400); expect(dimensions[1]).toBeLessThanOrEqual(500);
  await page.locator('input[type=file]').setInputFiles({ name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('bad image') });
  await expect(page.getByText('无法解码图片，请选择有效的 JPG、PNG 或 WebP。', { exact: true })).toBeVisible();
  await expect(page.locator('input[type=file]')).toBeEnabled();
  await context.close();
});

test('sticker exports are blocked until changed output settings are regenerated', async ({ page }) => {
  await page.goto('/tools/image-media-studio#image');
  await page.getByRole('button', { name: '表情包拆分', exact: true }).click();
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 360; canvas.height = 160;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 360, 160);
    ctx.fillStyle = 'red'; ctx.fillRect(30, 30, 80, 80); ctx.fillStyle = 'blue'; ctx.fillRect(220, 30, 80, 80);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('input[type=file]').setInputFiles({ name: 'stickers.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') });
  const split = page.getByRole('button', { name: '自动拆分表情包', exact: true }); await split.click();
  await expect(page.getByRole('button', { name: '下载单张', exact: true })).toHaveCount(2);
  const download = page.getByRole('button', { name: '下载 ZIP', exact: true }); await expect(download).toBeEnabled();
  await page.locator('select').filter({ has: page.locator('option[value="image/jpeg"]') }).selectOption('image/jpeg');
  await expect(download).toBeDisabled();
  await expect(page.getByText('拆分设置已变化，请重新拆分后下载。', { exact: true })).toBeVisible();
  await split.click(); await expect(download).toBeEnabled();
});

test('a disjoint CSG intersection is empty and cannot export an STL', async ({ page }) => {
  await page.goto('/tools/cad-geometry-studio#3d-csg');
  const sphere = page.getByRole('group', { name: '选择实体 开孔球体 B', exact: true });
  await sphere.focus(); await page.keyboard.press('Enter');
  await page.getByText('实体尺寸、坐标与导入', { exact: true }).click();
  await page.getByLabel('位置 X', { exact: true }).fill('30');
  await page.getByRole('button', { name: '相交', exact: true }).click();
  await expect(page.getByText('运算结果为空', { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: '导出 3D STL 文件 (二进制)', exact: true })).toBeDisabled();
});

test('repository data remains usable when IndexedDB is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = indexedDB.open.bind(indexedDB);
    indexedDB.open = (name, version) => {
      if (name === 'devtoolbox-repo-research-db') throw new Error('fixture storage unavailable');
      return version === undefined ? original(name) : original(name, version);
    };
  });
  await page.route('https://api.github.com/users/openai', route => route.fulfill({ json: { type: 'Organization' } }));
  await page.route('https://api.github.com/orgs/openai/repos**', route => route.fulfill({ json: [{ name: 'fresh-result', stargazers_count: 2, language: 'TypeScript', created_at: '2026-01-01', updated_at: '2026-01-02', pushed_at: '2026-01-02', description: 'fixture', html_url: 'https://github.com/openai/fresh-result' }] }));
  await page.goto('/tools/repo-dependency-studio#github-repos');
  await page.getByRole('button', { name: '拉取仓库', exact: true }).click();
  await expect(page.getByRole('link', { name: 'fresh-result', exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('数据已读取，但本地缓存不可用');
  await expect(page.getByRole('button', { name: '检查 Release', exact: true })).toBeEnabled();
});

async function nugetArchive(signature: Buffer) {
  const archive = new JSZip();
  archive.file('.signature.p7s', signature);
  archive.file('fixture.nuspec', '<package><metadata><authors>Fixture</authors><description>Local test package</description></metadata></package>');
  return archive.generateAsync({ type: 'nodebuffer' });
}

test('NuGet certificate metadata and signer identity load without a forge or CDN runtime', async ({ page }) => {
  const signature = await readFile(fixture('nuget-signed-data.p7s'));
  const der = await readFile(fixture('nuget-test-certificate.der'));
  const bytes = await nugetArchive(signature);
  const forbiddenRuntimeRequests: string[] = [];
  page.on('request', request => {
    const url = request.url();
    if (/forge|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com/i.test(url)) forbiddenRuntimeRequests.push(url);
  });
  await page.clock.setFixedTime(new Date('2026-01-01T00:00:00Z'));
  await page.route('https://**/*', route => route.abort());
  await page.route('https://api.nuget.org/v3-flatcontainer/**', route => route.request().url().endsWith('/index.json')
    ? route.fulfill({ json: { versions: ['1.0.0'] } })
    : route.fulfill({ body: bytes, contentType: 'application/octet-stream' }));
  await page.goto('/tools/repo-dependency-studio#nuget-signature');
  await page.getByLabel('包名', { exact: true }).fill('fixture');
  await page.getByRole('button', { name: '加载版本', exact: true }).click();
  await page.getByRole('button', { name: '解析签名', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('签名文件与证书已解析；尚未验证签名有效性。');
  await expect(page.getByText('CN=Fixture certificate', { exact: true })).toBeVisible();
  await expect(page.getByText('CN=Fixture issuer', { exact: true })).toBeVisible();
  await expect(page.locator('summary').filter({ hasText: '证书 1' })).toContainText('签名者标记');
  await expect(page.getByText('序列号', { exact: true }).locator('xpath=following-sibling::dd[1]')).toHaveText('01');
  await expect(page.getByText('日期范围', { exact: true }).locator('xpath=following-sibling::dd[1]')).toContainText('2025');
  await expect(page.getByText('日期范围', { exact: true }).locator('xpath=following-sibling::dd[1]')).toContainText('2030');
  for (const algorithm of ['sha1', 'sha256']) {
    const fingerprint = createHash(algorithm).update(der).digest('hex').toUpperCase().match(/../g)!.join(':');
    await expect(page.getByText(fingerprint, { exact: true })).toBeVisible();
  }
  await expect(page.getByText(createHash('sha256').update(bytes).digest('hex'), { exact: true })).toBeVisible();
  await page.getByText('查看 PEM 证书', { exact: true }).click();
  const pem = await page.getByLabel('证书 1 PEM', { exact: true }).inputValue();
  expect(pem).toContain('-----BEGIN CERTIFICATE-----');
  expect(pem).toContain('-----END CERTIFICATE-----');
  expect(pem.replace(/-----[^\n]+-----/g, '').replace(/\s/g, '')).toBe(der.toString('base64'));
  expect(forbiddenRuntimeRequests).toEqual([]);
});

test('invalid and truncated NuGet CMS fail visibly and a subsequent package can still be parsed', async ({ page }) => {
  const signature = await readFile(fixture('nuget-signed-data.p7s'));
  const valid = await nugetArchive(signature);
  const truncated = await nugetArchive(signature.subarray(0, 32));
  const invalid = await nugetArchive(Buffer.from('invalid CMS data'));
  await page.route('https://**/*', route => route.abort());
  await page.route('https://api.nuget.org/v3-flatcontainer/**', route => {
    const url = route.request().url();
    return url.endsWith('/index.json')
      ? route.fulfill({ json: { versions: ['1.0.0', '2.0.0', '3.0.0'] } })
      : route.fulfill({ body: url.includes('/3.0.0/') ? invalid : url.includes('/2.0.0/') ? truncated : valid, contentType: 'application/octet-stream' });
  });
  await page.goto('/tools/repo-dependency-studio#nuget-signature');
  await page.getByLabel('包名', { exact: true }).fill('fixture');
  await page.getByRole('button', { name: '加载版本', exact: true }).click();
  const analyze = page.getByRole('button', { name: '解析签名', exact: true });
  for (const version of ['3.0.0', '2.0.0']) {
    await page.getByLabel('版本', { exact: true }).selectOption(version);
    await analyze.click();
    await expect(page.getByRole('alert')).toContainText('错误');
    await expect(analyze).toBeEnabled();
    await expect(page.getByText('CN=Fixture certificate', { exact: true })).toHaveCount(0);
  }
  await page.getByLabel('版本', { exact: true }).selectOption('1.0.0');
  await analyze.click();
  await expect(page.getByRole('status')).toContainText('签名文件与证书已解析；尚未验证签名有效性。');
  await expect(page.getByText('CN=Fixture certificate', { exact: true })).toBeVisible();
  await expect(analyze).toBeEnabled();
});
