import { expect, test } from '@playwright/test';

test('legacy JSON diff route redirects and activates the sub-tool', async ({ page }) => {
  await page.goto('/tools/json-diff');

  await expect(page).toHaveURL(/\/tools\/json-studio#json-diff$/);
  await expect(page.getByText(/RFC 6902 JSON Patch|RFC 6902 JSON PATCH/)).toBeVisible();
});

test('language and dark mode controls stay usable', async ({ page }) => {
  await page.goto('/tools/json-studio#json-diff');

  const languageButton = page.getByRole('button', { name: /Switch to English|Switch to Chinese/ });
  await languageButton.click();
  await expect(page.locator('html')).toHaveAttribute('lang', /en-US|zh-CN/);

  await page.getByTitle(/Switch to dark mode|切换到深色模式/).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('HTTP tool imports cURL into request fields', async ({ page }) => {
  await page.goto('/tools/http');
  await page.getByRole('button', { name: /导入 cURL|Import cURL/ }).click();
  await page.getByPlaceholder(/curl -X POST|例如/).fill(`curl -X POST 'https://api.example.com/users' -H 'X-Trace: abc' -d '{"name":"Ada"}'`);
  await page.getByRole('button', { name: '解析并填充', exact: true }).click();

  await expect(page.locator('input[value="https://api.example.com/users"]')).toBeVisible();
  await expect(page.getByText('"X-Trace": "abc"')).toBeVisible();
  await expect(page.getByText('{"name":"Ada"}')).toBeVisible();
});

test('mobile scratchpad drawer opens from the header', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tools/json-studio#json-diff');
  await page.getByLabel(/打开全局数据暂存箱|Open global scratchpad/).click();
  await expect(page.getByRole('heading', { name: /全局数据暂存箱|Global Scratchpad/ })).toBeVisible();
  await expect(page.getByText(/暂存箱暂无内容|scratchpad is empty/i)).toBeVisible();
});

test('animation frame tool documents APNG and WebP browser limits', async ({ page }) => {
  await page.goto('/tools/image-studio#animation-frame');
  await expect(page.getByText(/支持上传标准 GIF、APNG、animated WebP/)).toBeVisible();
  await expect(page.getByText(/WebCodecs ImageDecoder/)).toBeVisible();
});

test('STL repair exposes wall thickness fast and precise controls', async ({ page }) => {
  await page.goto('/tools/cad-3d-studio#stl-repair');
  await expect(page.getByLabel('开启壁厚热力图')).toBeVisible();
  await page.getByLabel('开启壁厚热力图').check();
  const modeSelect = page.getByLabel('壁厚分析模式');
  await expect(modeSelect).toBeVisible();
  await expect(modeSelect).toHaveValue('fast');
  await modeSelect.selectOption('precise');
  await expect(modeSelect).toHaveValue('precise');
});

test('video downloader states private Worker limits without overpromising', async ({ page }) => {
  await page.goto('/tools/network-studio#video-download');
  await page.getByRole('button', { name: /部署私有解析 Worker/ }).click();

  await expect(page.getByText(/不会绕过平台权限或内容保护/)).toBeVisible();
  await expect(page.getByText(/它不是破解器/)).toBeVisible();
  await expect(page.getByText(/完美解锁全部解析功能/)).toHaveCount(0);
});

test('security PGP missing-key failure is inline and non-blocking', async ({ page }) => {
  page.on('dialog', dialog => {
    throw new Error(`Unexpected blocking dialog: ${dialog.message()}`);
  });

  await page.goto('/tools/crypto-studio#pgp-keymaster');
  await page.getByRole('button', { name: /文本加密 \/ 解密/ }).click();
  await page.getByRole('button', { name: /加密消息/ }).click();

  await expect(page.getByText(/请先输入收件人公钥/)).toBeVisible();
});
