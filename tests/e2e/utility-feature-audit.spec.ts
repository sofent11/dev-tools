import { expect, test } from '@playwright/test';
import ts from 'typescript';

test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('locale','zh-CN')); });

test('HTTP cancellation also cancels a delayed local mock response', async ({ page }) => {
  await page.goto('/tools/network-diagnostics-studio#http');
  await page.locator('input[placeholder="https://api.example.com/data"]').fill('https://example.com/api/v1/user');
  await page.getByText('未开启',{exact:true}).click();
  await page.getByText('编辑拦截规则 (',{exact:false}).click();
  await page.locator('input[type=number]').first().fill('5000');
  await page.getByRole('button',{name:'发送请求',exact:true}).click();
  await page.getByRole('button',{name:'取消请求',exact:true}).click();
  await expect(page.getByRole('button',{name:'发送请求',exact:true})).toBeEnabled();
  await expect(page.locator('textarea[readonly]')).toHaveValue(/取消/);
});

test('QR event rejects impossible dates and restores export after correction', async ({ page }) => {
  await page.goto('/tools/generator-utility-studio#qrcode');
  await page.getByRole('button',{name:'事件',exact:true}).click();
  const start=page.getByPlaceholder('开始 YYYYMMDDTHHmmss');
  const end=page.getByPlaceholder('结束 YYYYMMDDTHHmmss');
  await start.fill('20250229T090000'); await end.fill('20250301T100000');
  await expect(page.getByRole('alert')).toContainText('真实有效');
  await expect(page.getByRole('link',{name:'下载 PNG',exact:true})).toBeHidden();
  await start.fill('20240229T090000'); await end.fill('20240229T100000');
  await expect(page.getByAltText('二维码预览')).toBeVisible();
  await expect(page.getByRole('link',{name:'下载 PNG',exact:true})).toBeVisible();
});

test('SVG component export preserves gradients and JSX syntax with a valid identifier', async ({ page }) => {
  await page.goto('/tools/frontend-style-studio#svg-react');
  await page.getByPlaceholder('e.g. MyIcon').fill('123 icon');
  await page.locator('textarea').first().fill('<svg width="32" height="32" viewBox="0 0 32 32" aria-label="A"><defs><linearGradient id="g"><stop stop-color="red"/></linearGradient></defs><path fill="url(#g)" stroke="red"/><text>{a}&amp;</text></svg>');
  const output = await page.locator('.code-surface').innerText();
  const parsed=ts.createSourceFile('icon.tsx',output,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX) as ts.SourceFile & {parseDiagnostics:unknown[]};
  expect(parsed.parseDiagnostics).toEqual([]);
  expect(output).toContain('export const Svg123icon'); expect(output).toContain('linearGradient'); expect(output).toContain('fill={"url(#g)"}');
  expect(output.match(/width=\{size\}/g)).toHaveLength(1);
  await page.locator('textarea').first().fill('<svg><path></svg>');
  await expect(page.getByRole('button',{name:'下载组件',exact:true})).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('SVG 格式无效');
});

test('Cron direct editing and presets keep the field builder synchronized', async ({ page }) => {
  await page.goto('/tools/time-ops-studio#cron');
  await page.locator('input.ui-input.font-mono').fill('7 11 * * 2');
  await expect(page.locator('select:has(option[value="*/30"])')).toHaveValue('7');
  await expect(page.locator('select:has(option[value="9-18"])')).toHaveValue('11');
  await page.getByRole('button',{name:'每天 09:00',exact:true}).click();
  await expect(page.locator('select:has(option[value="*/30"])')).toHaveValue('0');
  await expect(page.locator('select:has(option[value="9-18"])')).toHaveValue('9');
  await page.locator('input.ui-input.font-mono').fill('0 */5 * * * *');
  await expect(page.getByText('请输入 5 字段 Unix Cron 表达式。',{exact:true})).toBeVisible();
});

test('generated local test keys actually convert, while truncated fake PEM fails', async ({ page }) => {
  await page.goto('/tools/security-key-studio#asymmetric-key');
  await page.getByRole('button',{name:'生成本地测试密钥 (JWK)',exact:true}).click();
  await expect(page.locator('textarea').first()).toHaveValue(/"kty": "RSA"/);
  await page.getByRole('button',{name:'转换并检查结构',exact:true}).click();
  await expect(page.locator('textarea[readonly]')).toHaveValue(/"n":/);
  await page.locator('textarea').first().fill('-----BEGIN PUBLIC KEY-----\nMAA=\n-----END PUBLIC KEY-----');
  await page.getByRole('button',{name:'转换并检查结构',exact:true}).click();
  await expect(page.getByText(/转换失败|无法识别/).last()).toBeVisible();
});

test('video parsing cancels a delayed worker response without persisting its test token', async ({ page }) => {
  await page.route('https://test-worker.example/api/extract', async route => {
    await new Promise(resolve => setTimeout(resolve,400));
    await route.fulfill({json:{ok:true,title:'Obsolete result',platform:'direct',formats:[{url:'https://example.com/old.mp4',format:'mp4',quality:'source'}],warnings:[]}}).catch(() => {});
  });
  await page.goto('/tools/image-media-studio#video-download');
  await page.locator('details').first().locator('summary').click();
  await page.getByPlaceholder('https://your-worker.your-name.workers.dev').fill('https://test-worker.example');
  await page.locator('input[type=password]').fill('local-test-token');
  await page.getByRole('button',{name:'开始解析',exact:true}).click();
  await page.getByRole('button',{name:'取消',exact:true}).click();
  await expect(page.getByText('解析已取消。',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'开始解析',exact:true})).toBeEnabled();
  expect(await page.evaluate(() => JSON.stringify([Object.entries(localStorage),Object.entries(sessionStorage)]).includes('local-test-token'))).toBe(false);
  await expect(page.getByText('Obsolete result',{exact:true})).toBeHidden();
});

test('Mock schema preserves special property names and validates numeric ranges', async ({ page }) => {
  await page.goto('/tools/generator-utility-studio#lorem');
  await page.getByRole('button',{name:'用户列表模板',exact:true}).click();
  await page.getByPlaceholder('字段名 (key)').first().fill('__proto__');
  await page.locator('select:has(option[value=phone])').last().selectOption('phone');
  await page.getByRole('button',{name:'生成数据',exact:true}).click();
  await expect(page.locator('th').first()).toHaveText('__proto__');
  const phones=await page.locator('tbody tr td:nth-child(3)').allTextContents();
  expect(phones.every(phone => /^13\d{9}$/.test(phone))).toBe(true);
  await page.getByRole('button',{name:'导出代码',exact:true}).click();
  const json=JSON.parse(await page.locator('textarea[readonly]').inputValue());
  expect(Object.hasOwn(json[0],'__proto__')).toBe(true);
  await page.locator('select:has(option[value=phone])').last().selectOption('number');
  await page.getByPlaceholder('min',{exact:true}).fill('1.5');
  await expect(page.getByRole('button',{name:'生成数据',exact:true})).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('有效整数范围');
});

test('JWT verification cannot restore a valid result after the secret changes', async ({ page }) => {
  await page.addInitScript(() => {
    const original = crypto.subtle.verify.bind(crypto.subtle);
    crypto.subtle.verify = async (...args) => { await new Promise(resolve => setTimeout(resolve,300)); return original(...args); };
  });
  await page.goto('/tools/security-key-studio#jwt');
  const token = await page.evaluate(async () => {
    const base64=(value: string) => btoa(value).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
    const header=base64('{"alg":"HS256","typ":"JWT"}'); const payload=base64('{"sub":"local-test"}');
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode('secret'),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const signature=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${header}.${payload}`)));
    return `${header}.${payload}.${base64(String.fromCharCode(...signature))}`;
  });
  await page.getByPlaceholder('eyJh...').fill(token);
  await page.getByText('验证签名与编辑重签',{exact:true}).click();
  await expect(page.locator('textarea').nth(2)).toHaveValue(/local-test/);
  await page.getByRole('button',{name:'验证签名',exact:true}).click();
  await page.getByPlaceholder('Secret key...',{exact:true}).fill('changed-local-secret');
  await page.waitForTimeout(400);
  await expect(page.getByText(/签名验证成功/)).toBeHidden();
  await page.getByRole('button',{name:'验证签名',exact:true}).click();
  await expect(page.getByText(/签名校验失败/)).toBeVisible();
});
