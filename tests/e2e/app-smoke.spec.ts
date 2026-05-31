import { expect, test } from '@playwright/test';

test('data format route activates the JSON diff sub-tool', async ({ page }) => {
  await page.goto('/tools/data-format-studio#json-diff');

  await expect(page).toHaveURL(/\/tools\/data-format-studio#json-diff$/);
  await expect(page.getByText(/RFC 6902 JSON Patch|RFC 6902 JSON PATCH/)).toBeVisible();
});

test('language and dark mode controls stay usable', async ({ page }) => {
  await page.goto('/tools/data-format-studio#json-diff');

  const languageButton = page.getByRole('button', { name: /Switch to English|Switch to Chinese/ });
  await languageButton.click();
  await expect(page.locator('html')).toHaveAttribute('lang', /en-US|zh-CN/);

  await page.getByTitle(/Switch to dark mode|切换到深色模式/).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('HTTP tool imports cURL into request fields', async ({ page }) => {
  await page.goto('/tools/network-diagnostics-studio#http');
  await page.getByRole('button', { name: /导入 cURL|Import cURL/ }).click();
  await page.getByPlaceholder(/curl -X POST|例如/).fill(`curl -X POST 'https://api.example.com/users' -H 'X-Trace: abc' -d '{"name":"Ada"}'`);
  await page.getByRole('button', { name: '解析并填充', exact: true }).click();

  await expect(page.locator('input[value="https://api.example.com/users"]')).toBeVisible();
  await expect(page.getByText('"X-Trace": "abc"')).toBeVisible();
  await expect(page.getByText('{"name":"Ada"}')).toBeVisible();
});

test('mobile scratchpad drawer opens from the header', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tools/data-format-studio#json-diff');
  await page.getByLabel(/打开全局数据暂存箱|Open global scratchpad/).click();
  await expect(page.getByRole('heading', { name: /全局数据暂存箱|Global Scratchpad/ })).toBeVisible();
  await expect(page.getByText(/暂存箱暂无内容|scratchpad is empty/i)).toBeVisible();
});

test('animation frame tool documents APNG and WebP browser limits', async ({ page }) => {
  await page.goto('/tools/image-media-studio#animation-frame');
  await expect(page.getByText(/支持上传标准 GIF、APNG、animated WebP/)).toBeVisible();
  await expect(page.getByText(/WebCodecs ImageDecoder/)).toBeVisible();
});

test('STL repair exposes wall thickness fast and precise controls', async ({ page }) => {
  await page.goto('/tools/cad-geometry-studio#stl-repair');
  await expect(page.getByLabel('开启壁厚热力图')).toBeVisible();
  await page.getByLabel('开启壁厚热力图').check();
  const modeSelect = page.getByLabel('壁厚分析模式');
  await expect(modeSelect).toBeVisible();
  await expect(modeSelect).toHaveValue('fast');
  await modeSelect.selectOption('precise');
  await expect(modeSelect).toHaveValue('precise');
});

test('video downloader states private Worker limits without overpromising', async ({ page }) => {
  await page.goto('/tools/image-media-studio#video-download');
  await expect(page.locator('input[value="https://api-dev.sopace.top"]')).toBeVisible();
  await page.getByRole('button', { name: /配置解析 Worker/ }).click();

  await expect(page.getByText(/默认提供 sopace 公共 Worker/)).toBeVisible();
  await expect(page.getByText(/不会绕过平台权限或内容保护/)).toBeVisible();
  await expect(page.getByText(/它不是破解器/)).toBeVisible();
  await expect(page.getByText(/完美解锁全部解析功能/)).toHaveCount(0);
});

test('security PGP missing-key failure is inline and non-blocking', async ({ page }) => {
  page.on('dialog', dialog => {
    throw new Error(`Unexpected blocking dialog: ${dialog.message()}`);
  });

  await page.goto('/tools/security-key-studio#pgp-keymaster');
  await page.getByRole('button', { name: /文本加密 \/ 解密/ }).click();
  await page.getByRole('button', { name: /加密消息/ }).click();

  await expect(page.getByText(/请先输入收件人公钥/)).toBeVisible();
});

test('SVG optimizer sanitizes active content before preview', async ({ page }) => {
  page.on('dialog', dialog => {
    throw new Error(`Unexpected blocking dialog: ${dialog.message()}`);
  });

  await page.goto('/tools/frontend-style-studio#svg-optimizer');
  await page.locator('textarea').first().fill(`
    <svg viewBox="0 0 20 20" onload="alert('xss')">
      <foreignObject><iframe srcdoc="&lt;script&gt;alert('xss')&lt;/script&gt;"></iframe></foreignObject>
      <path d="M0 0L20 20" stroke="red" style="stroke-width: 2; background: url(javascript:alert(1))" />
    </svg>
  `);

  await expect(page.locator('textarea').first()).toHaveValue(/foreignObject/);
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.locator('foreignObject')).toHaveCount(0);
});

test('headshot extractor exposes manual mode when MediaPipe cannot load', async ({ page }) => {
  await page.route('**/*', route => {
    const url = route.request().url();
    const isExternalMediaPipeAsset =
      url.includes('cdn.jsdelivr.net/npm/@mediapipe/tasks-vision') ||
      url.includes('storage.googleapis.com/mediapipe-models') ||
      url.includes('vision_wasm_internal.wasm') ||
      url.includes('blaze_face_short_range.tflite');
    if (isExternalMediaPipeAsset) {
      return route.abort();
    }
    return route.continue();
  });
  await page.goto('/tools/image-media-studio#headshot');

  await expect(page.getByRole('heading', { name: /Headshot Extraction/ }).last()).toBeVisible();
  await expect(page.getByText('手动裁剪模式', { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: /重试/ }).first()).toBeVisible();
});
