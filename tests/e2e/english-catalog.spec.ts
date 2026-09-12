import { test } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
test('all 73 tool tabs render English interface text', async ({ baseURL }) => {
  test.setTimeout(180_000);
  await promisify(execFile)(process.execPath, ['scripts/check-english-visible-text.mjs'], {
    env: { ...process.env, CHECK_I18N_APP_URL: baseURL }, timeout: 165_000, maxBuffer: 4 * 1024 * 1024,
  });
});
