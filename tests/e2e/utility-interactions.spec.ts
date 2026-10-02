import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('locale', 'zh-CN'));
});

test('URL inspection retains repeated parameters and decoded values', async ({ page }) => {
  await page.goto('/tools/network-studio#urlparser');
  await page.getByPlaceholder('https://example.com/path?key=value').fill('https://example.com/path?tag=design&tag=code&name=Ada%20Lovelace');
  await expect(page.locator('tbody tr')).toHaveCount(3);
  await expect(page.locator('td').filter({ hasText: /^tag$/ })).toHaveCount(2);
  await expect(page.locator('td').filter({ hasText: /^Ada Lovelace$/ })).toBeVisible();
  await page.getByPlaceholder('https://example.com/path?key=value').fill('not a url');
  await expect(page.getByRole('alert')).toContainText('请输入完整有效的 URL');
});

test('PX REM conversion validates root size and converts both directions', async ({ page }) => {
  await page.goto('/tools/css-studio#pxrem');
  const fields=page.locator('input[type="number"]');
  await fields.nth(1).fill('32');
  await expect(fields.nth(2)).toHaveValue('2');
  await fields.nth(2).fill('1.5');
  await expect(fields.nth(1)).toHaveValue('24');
  await fields.nth(0).fill('0');
  await expect(page.getByRole('alert')).toContainText('根字号需要大于 0');
  await expect(page.getByRole('button', {name:'复制 CSS', exact:true})).toBeDisabled();
});

test('Mock records preview is tabular and download keeps generated format', async ({ page }) => {
  await page.goto('/tools/system-ai-studio#lorem');
  await page.getByRole('button', {name:'用户列表模板', exact:true}).click();
  await page.getByRole('button', {name:'生成数据', exact:true}).click();
  await expect(page.locator('tbody tr')).toHaveCount(20);
  await expect(page.locator('th')).toHaveText(['id','name','email']);
  await page.getByRole('button', {name:/^csv$/i}).click();
  const pending=page.waitForEvent('download');
  await page.getByRole('button', {name:'导出文件', exact:true}).click();
  expect((await pending).suggestedFilename()).toMatch(/\.json$/);
});

test('time studio selects tasks and unit switch preserves represented instant', async ({ page }) => {
  await page.goto('/tools/system-ai-studio#unix-time-studio');
  const timestamp=page.getByPlaceholder('例如: 1780148255');
  await timestamp.fill('1700000000');
  await page.locator('select:has(option[value="ms"])').selectOption('ms');
  await expect(timestamp).toHaveValue('1700000000000');
  await page.locator('select:has(option[value="ms"])').selectOption('s');
  await expect(timestamp).toHaveValue('1700000000');
  await page.getByRole('button', {name:'世界时钟', exact:true}).click();
  await expect(page.getByText('世界主要城市时区时钟', {exact:false})).toBeVisible();
  await expect(timestamp).toBeHidden();
  await page.getByRole('button', {name:'日期跨度', exact:true}).click();
  await expect(page.getByText('日期时间跨度计算器', {exact:false})).toBeVisible();
});

test('QR generator provides PNG export and MIME search handles no results', async ({ page }) => {
  await page.goto('/tools/system-ai-studio#qrcode');
  await expect(page.getByAltText('二维码预览')).toBeVisible();
  const pending=page.waitForEvent('download');
  await page.getByRole('link', {name:'下载 PNG', exact:true}).click();
  expect((await pending).suggestedFilename()).toBe('qrcode.png');
  await page.goto('/tools/file-studio#mime');
  await page.getByPlaceholder('.svg / json / image').fill('svg');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('td').filter({hasText:/^image\/svg\+xml$/})).toBeVisible();
  await page.getByPlaceholder('.svg / json / image').fill('unknown-format-123');
  await expect(page.getByText('没有匹配类型，尝试扩展名或 MIME 关键词。', {exact:true})).toBeVisible();
});

test('SVG React component controls fit mobile and export the selected language', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tools/css-studio#svg-react');
  const componentName=page.getByPlaceholder('e.g. MyIcon');
  await componentName.fill('CompactIcon');
  const bounds=await componentName.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(390);
  await page.getByRole('checkbox', {name:'TypeScript (TSX)', exact:true}).uncheck();
  const pending=page.waitForEvent('download');
  await page.getByRole('button', {name:'下载组件', exact:true}).click();
  expect((await pending).suggestedFilename()).toBe('CompactIcon.jsx');
});
