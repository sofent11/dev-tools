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
