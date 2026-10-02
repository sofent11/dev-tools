import { expect, test, type Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

const imageFixture = async (page: Page) => Buffer.from(await page.evaluate(() => {
  const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 80;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#d6ed8a'; ctx.fillRect(10, 10, 60, 60);
  return canvas.toDataURL('image/png').split(',')[1];
}), 'base64');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('locale', 'zh-CN'));
});

test('studio picker searches, selects a tool, and supports browser back', async ({ page }) => {
  await page.goto('/tools/file-studio#file-info');
  await page.locator('.studio-current').click();
  await page.getByLabel('查找当前工作室的工具', { exact: true }).fill('文件名');
  await page.locator('.studio-catalog-grid button').click();
  await expect(page).toHaveURL(/#filename$/);
  await page.getByRole('button', { name: '示例', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(3);
  await page.goBack();
  await expect(page).toHaveURL(/#file-info$/);
  await expect(page.getByRole('button', { name: '计算 SHA-256' })).toBeVisible();
});

test('global search opens exact pages across studios and in the same studio', async ({ page }) => {
  await page.goto('/tools/json-studio#json');
  const search = page.getByPlaceholder('搜索工作室或工具...');
  await search.fill('文件名');
  await page.locator('a.catalog-page-link').click();
  await expect(page).toHaveURL(/\/tools\/file-studio#filename$/);
  await expect(page.getByLabel('路径 / URL 列表', { exact: true })).toBeVisible();
  await search.fill('MIME');
  await page.locator('a.catalog-page-link').click();
  await expect(page).toHaveURL(/\/tools\/file-studio#mime$/);
  await expect(page.getByPlaceholder('.svg / json / image')).toBeVisible();
});

test('malformed path or hash falls back to a usable page', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/tools/file-studio#%');
  await expect(page.getByRole('button', { name: 'PDF 转图片', exact: true })).toBeVisible();
  await page.evaluate(() => { history.pushState(null, '', '/tools/%'); dispatchEvent(new PopStateEvent('popstate')); });
  await expect(page.locator('.studio-current')).toBeVisible();
  expect(errors).toEqual([]);
});

test('file hashes keep separate content for files with the same name and size', async ({ page }) => {
  await page.goto('/tools/file-studio#file-info');
  await page.locator('input[type="file"]').setInputFiles([
    { name: 'same.txt', mimeType: 'text/plain', buffer: Buffer.from('first') },
    { name: 'same.txt', mimeType: 'text/plain', buffer: Buffer.from('other') },
  ]);
  await page.getByRole('button', { name: '计算 SHA-256' }).click();
  await expect(page.locator('tbody code')).toHaveCount(2);
  const hashes = await page.locator('tbody code').allTextContents();
  expect(hashes[0]).not.toEqual(hashes[1]);
});

test('file Base64 output switches from resource URL to plain payload', async ({ page }) => {
  await page.goto('/tools/encoding-studio#file-base64');
  await page.locator('input[type="file"]').setInputFiles({ name: 'sample.txt', mimeType: 'text/plain', buffer: Buffer.from('Hello') });
  await expect(page.getByLabel('编码结果', { exact: true })).toHaveValue('data:text/plain;base64,SGVsbG8=');
  await page.getByRole('button', { name: 'Base64', exact: true }).click();
  await expect(page.getByLabel('编码结果', { exact: true })).toHaveValue('SGVsbG8=');
});

test('watermark updates the canvas and exports the current result', async ({ page }) => {
  await page.goto('/tools/image-studio#image-watermark');
  await page.locator('input[type="file"]').setInputFiles({ name: 'sample.png', mimeType: 'image/png', buffer: await imageFixture(page) });
  const downloadButton = page.getByRole('button', { name: '下载 PNG', exact: true });
  await expect(downloadButton).toBeEnabled();
  const before = await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  await page.getByLabel('水印文字', { exact: true }).fill('DESIGN');
  await page.getByRole('button', { name: '居中', exact: true }).click();
  await expect(downloadButton).toBeEnabled();
  const after = await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  expect(after).not.toBe(before);
  const pending = page.waitForEvent('download'); await downloadButton.click();
  expect((await pending).suggestedFilename()).toBe('sample.png_watermarked.png');
});

test('visual centroid computes transparent image centers and resets background edits', async ({ page }) => {
  await page.goto('/tools/image-studio#visual-centroid');
  await page.locator('input[type="file"]').setInputFiles({ name: 'sample.png', mimeType: 'image/png', buffer: await imageFixture(page) });
  await expect(page.getByText('39.5, 39.5', { exact: true })).toHaveCount(2);
  await page.getByText('背景预处理', { exact: true }).click();
  await page.locator('input[type="color"]').fill('#d6ed8a');
  await page.getByRole('button', { name: '移除背景', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('没有有效像素');
  await page.getByRole('button', { name: '恢复原图', exact: true }).click();
  await expect(page.getByText('39.5, 39.5', { exact: true })).toHaveCount(2);
});

test('PDF image output supports a ZIP containing every rendered page', async ({ page }) => {
  test.setTimeout(60_000);
  const pdf = await PDFDocument.create(); pdf.addPage([120, 160]); pdf.addPage([120, 160]);
  await page.goto('/tools/file-studio#pdf');
  await page.getByRole('button', { name: 'PDF 转图片', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: 'sample.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await page.getByRole('button', { name: '开始转换为高清图片', exact: true }).click();
  await expect(page.getByRole('link', { name: '下载 PNG', exact: true })).toHaveCount(2, { timeout: 45_000 });
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: '下载全部 ZIP', exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/\.zip$/);
  const JSZip = (await import('jszip')).default;
  const fs = await import('node:fs/promises');
  const zip = await JSZip.loadAsync(await fs.readFile((await download.path())!));
  expect(Object.keys(zip.files)).toEqual(['page_001.png', 'page_002.png']);
});

test('file name extraction preserves local fragments and extensionless dotfiles', async ({ page }) => {
  await page.goto('/tools/file-studio#filename');
  await page.getByLabel('路径 / URL 列表', { exact: true }).fill('/folder/report#2026.pdf\n/folder/.env\nhttps://example.com/app.js?version=2#code');
  await expect(page.locator('tbody tr').nth(0).locator('td')).toHaveText(['report#2026.pdf', 'report#2026', 'pdf']);
  await expect(page.locator('tbody tr').nth(1).locator('td')).toHaveText(['.env', '.env', '-']);
  await expect(page.locator('tbody tr').nth(2).locator('td')).toHaveText(['app.js', 'app', 'js']);
});

test('CSG enables only valid inputs and exports a completed worker result', async ({ page }) => {
  await page.goto('/tools/cad-3d-studio#3d-csg');
  const operation = page.getByRole('button', { name: '相减', exact: true });
  const tool = page.locator('input[type="checkbox"]').first();
  const enabledTool = page.locator('input[type="checkbox"]:enabled').first();
  await expect(tool).toBeDisabled();
  await enabledTool.uncheck(); await expect(operation).toBeDisabled();
  await enabledTool.check(); await expect(operation).toBeEnabled();
  await operation.click();
  const exportButton = page.getByRole('button', { name: '导出 3D STL 文件 (二进制)', exact: true });
  await expect(exportButton).toBeVisible({ timeout: 20_000 });
  const pending = page.waitForEvent('download'); await exportButton.click();
  expect((await pending).suggestedFilename()).toMatch(/\.stl$/);
  await page.getByRole('button', { name: '返回场景树大纲继续设计', exact: true }).click();
  for (let i=0;i<3;i++) await page.getByTitle('添加立方体', { exact: true }).click();
  await expect(page.getByRole('group', { name: /^选择实体/ })).toHaveCount(5);
  await page.getByRole('group', { name: '选择实体 基准立方体 A', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.getByText('实体尺寸、坐标与导入', { exact: true }).click();
  await expect(page.getByText('当前实体：基准立方体 A', { exact: true })).toBeVisible();
});
