import { expect, test } from '@playwright/test';
import { PDFDocument, degrees } from 'pdf-lib';
import { readFile } from 'node:fs/promises';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('locale', 'zh-CN'));
});

test('chroma key, erase and restore change exported canvas alpha', async ({ page }) => {
  await page.goto('/tools/image-media-studio#background-removal');
  const fixture = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 30; canvas.height = 30;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#00ff00'; ctx.fillRect(0, 0, 30, 30);
    ctx.fillStyle = '#ff0000'; ctx.fillRect(10, 10, 10, 10);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('input[type=file]').setInputFiles({ name: 'mask.png', mimeType: 'image/png', buffer: Buffer.from(fixture, 'base64') });
  const canvas = page.locator('canvas').first();
  await expect.poll(() => canvas.evaluate(node => (node as HTMLCanvasElement).width)).toBe(30);
  const alpha = (x: number, y: number) => canvas.evaluate((node, point) => (node as HTMLCanvasElement).getContext('2d')!.getImageData(point[0], point[1], 1, 1).data[3], [x, y]);
  await page.getByRole('button', { name: '吸色背景抠除', exact: true }).click();
  await canvas.click({ position: { x: 2, y: 2 } });
  await expect.poll(() => alpha(2, 2)).toBe(0);
  await expect.poll(() => alpha(15, 15)).toBe(255);
  await page.getByRole('button', { name: '擦除背景', exact: true }).click();
  await canvas.click({ position: { x: 15, y: 15 } });
  await expect.poll(() => alpha(15, 15)).toBe(0);
  await page.getByRole('button', { name: '画笔还原', exact: true }).click();
  await canvas.click({ position: { x: 15, y: 15 } });
  await expect.poll(() => alpha(15, 15)).toBe(255);
});

test('PDF merge adds editor rotation to the source page rotation', async ({ page }) => {
  const input = await PDFDocument.create(); const sourcePage = input.addPage([100, 160]); sourcePage.setRotation(degrees(90));
  await page.goto('/tools/file-document-studio#pdf');
  await page.locator('input[type=file]').setInputFiles({ name: 'rotated.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await input.save()) });
  await expect(page.getByTitle('向右旋转 90°')).toBeVisible();
  await page.getByTitle('向右旋转 90°').click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /导出.*PDF|导出合并/ }).click();
  const download = await downloadPromise; const output = await PDFDocument.load(await readFile((await download.path())!));
  expect(output.getPage(0).getRotation().angle).toBe(180);
});

test('scratchpad is a focus-contained dialog and returns focus on close', async ({ page }) => {
  await page.goto('/tools/data-format-studio#json');
  const opener = page.getByLabel('打开全局数据暂存箱', { exact: true }); await opener.click();
  const dialog = page.getByRole('dialog', { name: '全局数据暂存箱' }); await expect(dialog).toBeVisible();
  await expect(page.getByLabel('关闭全局数据暂存箱', { exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(opener).toBeFocused();
});

test('image compression works offline, resizes real pixels, and invalidates changed settings', async ({ page }) => {
  await page.route(/^https:\/\//, route => route.abort());
  await page.goto('/tools/image-media-studio#image');
  const fixture = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 50;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#336699'; ctx.fillRect(0, 0, 100, 50);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('input[type=file]').setInputFiles({ name: 'source.png', mimeType: 'image/png', buffer: Buffer.from(fixture, 'base64') });
  await page.getByLabel('最大边长（px）', { exact: true }).fill('60');
  await page.getByRole('button', { name: '压缩图片', exact: true }).click();
  const downloadButton = page.getByRole('button', { name: '下载', exact: true });
  await expect(downloadButton).toBeEnabled();
  const downloading = page.waitForEvent('download'); await downloadButton.click();
  const downloaded = await downloading; const bytes = await readFile((await downloaded.path())!);
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  expect(bytes.readUInt32BE(16)).toBe(60); expect(bytes.readUInt32BE(20)).toBe(30);
  await page.getByRole('button', { name: 'Switch to English', exact: true }).click();
  await expect(page.getByLabel('Maximum edge (px)', { exact: true })).toHaveValue('60');
  await expect(page.locator('main')).not.toContainText(/[\p{Script=Han}]/u);
  await page.getByLabel('Output format', { exact: true }).selectOption('image/webp');
  await expect(page.getByRole('button', { name: 'Download', exact: true })).toBeDisabled();
});

test('image compression cancellation prevents a result from a pending runtime load', async ({ page }) => {
  await page.route('**/vendor/browser-image-compression/**', async route => {
    await new Promise(resolve => setTimeout(resolve, 500)); await route.continue();
  });
  await page.goto('/tools/image-media-studio#image');
  const fixture = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 30; canvas.height = 30;
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('input[type=file]').setInputFiles({ name: 'source.png', mimeType: 'image/png', buffer: Buffer.from(fixture, 'base64') });
  await page.getByRole('button', { name: '压缩图片', exact: true }).click();
  await page.getByRole('button', { name: '取消压缩', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('压缩已取消或超时');
  await expect(page.getByRole('button', { name: '下载', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '压缩图片', exact: true })).toBeEnabled();
});
