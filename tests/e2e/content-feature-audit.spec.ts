import { expect, test, type Page } from '@playwright/test';

const open = async (page: Page, studio: string, tool: string) => {
  await page.goto(`/tools/${studio}-studio#${tool}`);
  await expect(page.locator('.studio-current')).toBeVisible();
};
const editor = (page: Page, label: string) => page.getByLabel(label, { exact: true });
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('locale', 'zh-CN')); });

test('JSON formats, compresses, reuses output, recovers from invalid input and keeps a session draft', async ({ page }) => {
  await open(page, 'data-format', 'json');
  await editor(page, '原始 JSON').fill('{"a":1,"b":null}');
  await button(page, '格式化').click();
  await expect(editor(page, '格式化结果')).toHaveValue('{\n  "a": 1,\n  "b": null\n}');
  await editor(page, '缩进').selectOption('4'); await button(page, '格式化').click();
  await expect(editor(page, '格式化结果')).toHaveValue('{\n    "a": 1,\n    "b": null\n}');
  await button(page, '压缩').click(); await expect(editor(page, '压缩结果')).toHaveValue('{"a":1,"b":null}');
  await button(page, '继续处理').click(); await expect(editor(page, '原始 JSON')).toHaveValue('{"a":1,"b":null}');
  await page.locator('a[href="/tools/text-markup-studio"]').first().click(); await expect(editor(page, '原始文本')).toBeVisible(); await page.locator('a[href="/tools/data-format-studio"]').first().click();
  await expect(editor(page, '原始 JSON')).toHaveValue('{"a":1,"b":null}');
  await editor(page, '原始 JSON').fill('{'); await button(page, '格式化').click(); await expect(page.getByRole('alert')).toBeVisible();
  await button(page, '清空').click(); await expect(editor(page, '原始 JSON')).toHaveValue('');
});

for (const [tool, encoded] of [['base64', '5Lit8J+Riw=='], ['url', '%E4%B8%AD%F0%9F%91%8B']] as const) {
  test(`${tool} round trips Unicode and rejects malformed encoded text`, async ({ page }) => {
    await open(page, 'encoding-binary', tool); await editor(page, '原始文本').fill('中👋');
    await button(page, '开始编码').click(); await expect(editor(page, '编码结果')).toHaveValue(encoded);
    await button(page, '反向转换').click(); await button(page, '开始解码').click(); await expect(editor(page, '解码文本')).toHaveValue('中👋');
    await editor(page, tool === 'url' ? 'URL 编码输入' : 'Base64 输入').fill('%zz');
    await button(page, '开始解码').click(); await expect(page.getByRole('alert')).toBeVisible();
  });
}

test('XML preserves attributes, namespaces, leading zeros and mixed content across modes', async ({ page }) => {
  await open(page, 'data-format', 'xml');
  const xml = '<r xmlns:x="urn:x" id="001"><x:n>001</x:n><p>Hello <b>world</b> !</p></r>';
  await editor(page, 'XML 输入').fill(xml);
  await page.locator('main select').last().selectOption('minify'); await button(page, '开始处理').click();
  await expect(editor(page, 'XML 输出')).toHaveValue(xml);
  await page.locator('main select').last().selectOption('format'); await button(page, '开始处理').click();
  const output = await editor(page, 'XML 输出').inputValue();
  expect(output).toContain('id="001"'); expect(output).toContain('<x:n>001</x:n>'); expect(await page.evaluate(value => new DOMParser().parseFromString(value, 'application/xml').querySelector('p')?.textContent, output)).toBe('Hello world !');
  await page.locator('main select').last().selectOption('json'); await button(page, '开始处理').click();
  expect(JSON.parse(await editor(page, 'JSON 输出').inputValue()).r['x:n']).toBe('001');
  await editor(page, 'XML 输入').fill('<r>'); await button(page, '开始处理').click(); await expect(page.getByRole('alert')).toBeVisible();
});

test('YAML converts both ways and round trips structured values', async ({ page }) => {
  await open(page, 'data-format', 'yaml'); await editor(page, 'YAML 输入').fill('name: 中\nactive: true\nitems: [1, 2]');
  await button(page, '转换').click(); expect(JSON.parse(await editor(page, 'JSON 输出').inputValue())).toEqual({ name: '中', active: true, items: [1, 2] });
  await button(page, '反向转换').click(); await button(page, '转换').click(); await expect(editor(page, 'YAML 输出')).toHaveValue(/active: true/);
});

test('CSV supports automatic delimiters, headerless rows, quoted cells and reverse conversion', async ({ page }) => {
  await open(page, 'data-format', 'csv'); await editor(page, 'CSV 输入').fill('name;note\n中;"a;b"');
  await button(page, '转换').click(); expect(JSON.parse(await editor(page, 'JSON 输出').inputValue())).toEqual([{ name: '中', note: 'a;b' }]);
  await page.getByText('处理选项', { exact: true }).click(); await page.getByLabel('首行作为字段名').uncheck();
  await button(page, '转换').click(); expect(JSON.parse(await editor(page, 'JSON 输出').inputValue())).toEqual([['name', 'note'], ['中', 'a;b']]);
  await button(page, '反向转换').click(); await page.locator('main select').last().selectOption(';'); await button(page, '转换').click();
  await expect(editor(page, 'CSV 输出')).toHaveValue('name;note\n中;"a;b"');
});

test('JSON code exposes six real targets, generates each, and rejects unsupported root shapes', async ({ page }) => {
  await open(page, 'data-format', 'json2ts');
  await editor(page, 'JSON 样例').fill('{"__proto__":null,"class":1,"items":[{"a":1},{"b":"x"}]}');
  const targets = [['typescript', 'export interface'], ['go', 'type Root struct'], ['java', 'public class Root'], ['python', 'class Root(BaseModel)'], ['rust', 'pub struct Root'], ['sql', 'CREATE TABLE']] as const;
  await expect(editor(page, '目标语言').locator('option')).toHaveCount(6);
  for (const [value, marker] of targets) {
    await editor(page, '目标语言').selectOption(value); await button(page, '生成代码').click(); await expect(editor(page, '生成的代码')).toHaveValue(new RegExp(marker.replace(/[()]/g, '\\$&')));
  }
  await editor(page, 'JSON 样例').fill('[1,"x"]'); await editor(page, '目标语言').selectOption('java'); await button(page, '生成代码').click();
  await expect(page.getByRole('alert')).toBeVisible(); await expect(editor(page, '生成的代码')).toHaveValue('');
});

test('Schema runs real AJV constraints and infers all mixed array samples', async ({ page }) => {
  await open(page, 'data-format', 'json-schema'); await editor(page, 'JSON 数据').fill('[1,"x",null]');
  await button(page, '从样例生成 Schema').click(); await expect(editor(page, 'Schema 定义')).toHaveValue(/anyOf/);
  await editor(page, 'Schema 定义').fill('{"type":"object","properties":{"email":{"type":"string","format":"email"},"age":{"type":"integer","minimum":18}},"required":["email","age"],"additionalProperties":false}');
  await editor(page, 'JSON 数据').fill('{"email":"bad","age":17}'); await button(page, '校验数据').click(); await expect(page.getByRole('alert')).toContainText('项校验问题');
  await editor(page, 'JSON 数据').fill('{"email":"a@example.com","age":18}'); await button(page, '校验数据').click(); await expect(page.getByText('支持的规则检查通过。')).toBeVisible();
  await editor(page, 'Schema 定义').fill('{"unknownKeyword":true}'); await button(page, '校验数据').click(); await expect(page.getByRole('alert')).toBeVisible();
});

test('JSON diff merges literal prototype keys safely, undoes, swaps and produces escaped JSON Patch', async ({ page }) => {
  await open(page, 'data-format', 'json-diff'); await editor(page, '原始 JSON · 左侧').fill('{}'); await editor(page, '修改 JSON · 右侧').fill('{"__proto__":{"a/b~":1}}');
  await page.getByTitle('将此差异项合并到左侧').first().click(); expect(JSON.parse(await editor(page, '原始 JSON · 左侧').inputValue())).toHaveProperty('__proto__');
  await button(page, '撤销上次合并').click(); await expect(editor(page, '原始 JSON · 左侧')).toHaveValue('{}');
  await button(page, '交换左右').click(); await expect(editor(page, '修改 JSON · 右侧')).toHaveValue('{}');
  await page.getByTitle('将此差异项合并到右侧').first().click(); expect(JSON.parse(await editor(page, '修改 JSON · 右侧').inputValue())).toHaveProperty('__proto__');
});

test('SQL formatting offers dialect and case, while minification preserves literals and comments', async ({ page }) => {
  await open(page, 'sql-database', 'sql-format'); await editor(page, '输入 SQL').fill("SELECT  'a  b' AS  x --keep\n FROM  t;");
  await button(page, '压缩').click(); await expect(editor(page, 'SQL 输出')).toHaveValue("SELECT 'a  b' AS x --keep\nFROM t;");
  await page.getByText('数据库方言与格式选项', { exact: true }).click(); await page.locator('main select').last().selectOption('lower');
  await button(page, '格式化').click(); await expect(editor(page, 'SQL 输出')).toHaveValue(/select/);
});

test('SQLite executes locally, exports and imports writes, and rolls back failed bounded tasks', async ({ page }) => {
  test.setTimeout(45_000); await open(page, 'sql-database', 'sqlite-sandbox');
  await expect(button(page, '执行 SQL (Ctrl+Enter)')).toBeEnabled();
  await editor(page, 'SQL 查询终端').fill('CREATE TABLE "a""b" (v TEXT); INSERT INTO "a""b" VALUES (\'中\'); SELECT * FROM "a""b";');
  await button(page, '执行 SQL (Ctrl+Enter)').click(); await expect(page.locator('tbody')).toContainText('中');
  const downloading = page.waitForEvent('download'); await button(page, '导出数据库').click(); const download = await downloading;
  await button(page, '载入演示库').click(); await expect(button(page, '执行 SQL (Ctrl+Enter)')).toBeEnabled();
  await page.locator('input[type=file]').setInputFiles((await download.path())!); await expect(page.getByRole('button', { name: /a"b.*查看数据/ })).toBeVisible(); await expect(button(page, '执行 SQL (Ctrl+Enter)')).toBeEnabled();
  await editor(page, 'SQL 查询终端').fill('INSERT INTO "a""b" VALUES (\'discard\'); WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<1001) SELECT * FROM n;');
  await button(page, '执行 SQL (Ctrl+Enter)').click(); await expect(page.getByRole('alert')).toContainText('Result limit');
  await editor(page, 'SQL 查询终端').fill('SELECT COUNT(*) AS c FROM "a""b";'); await button(page, '执行 SQL (Ctrl+Enter)').click(); await expect(page.locator('tbody td')).toHaveCount(1); await expect(page.locator('tbody td')).toHaveText('1');
});

test('identifier cases preserve separate lines and acronym boundaries for every mode', async ({ page }) => {
  await open(page, 'text-markup', 'case'); await editor(page, '原始文本').fill('HTTPResponse\nuser_profile');
  for (const [mode, output] of [['camelCase', 'httpResponse\nuserProfile'], ['PascalCase', 'HttpResponse\nUserProfile'], ['snake_case', 'http_response\nuser_profile'], ['kebab-case', 'http-response\nuser-profile'], ['UPPERCASE', 'HTTPRESPONSE\nUSER_PROFILE'], ['lowercase', 'httpresponse\nuser_profile']]) {
    await editor(page, '目标格式').selectOption(mode); await expect(editor(page, mode)).toHaveValue(output);
  }
});

test('text manipulation exercises trim, dedup, sort and reversible fullwidth conversion', async ({ page }) => {
  await open(page, 'text-markup', 'text-manip');
  for (const [mode, input, output] of [['trim', ' b \n\n a ', 'b\na'], ['dedup', 'b\nb\na', 'b\na'], ['sort', 'b\na', 'a\nb'], ['full', 'A 1!', 'Ａ　１！'], ['half', 'Ａ　１！', 'A 1!']]) {
    await editor(page, '原始文本').fill(input); await editor(page, '处理方式').selectOption(mode); await button(page, '处理文本').click(); await expect(editor(page, '处理结果')).toHaveValue(output);
  }
});

test('slug keeps optional Unicode and respects a chosen URL prefix', async ({ page }) => {
  await open(page, 'text-markup', 'slug'); await editor(page, '页面标题').fill('你好 World!'); await page.getByText('处理选项', { exact: true }).click();
  await page.getByLabel('保留中文与其他 Unicode 字母').check(); await editor(page, 'URL 前缀').fill('/blog/');
  await expect(page.getByText('你好-world', { exact: true })).toBeVisible(); await expect(page.getByText('/blog/你好-world', { exact: true })).toBeVisible();
});

test('text stats distinguish UTF-16, code points and UTF-8 bytes', async ({ page }) => {
  await open(page, 'text-markup', 'stats'); await editor(page, '待统计文本').fill('A中👋');
  await expect(page.getByText('字符总数', { exact: true }).locator('..')).toContainText('4');
  await expect(page.getByText('Unicode 码点', { exact: true }).locator('..')).toContainText('3');
  await expect(page.getByText('UTF-8 字节', { exact: true }).locator('..')).toContainText('8');
});

test('regex reports real positions and captures, invalid patterns, cancellation and recovery', async ({ page }) => {
  await open(page, 'text-markup', 'regex'); await editor(page, '正则表达式').fill('(a)(b)'); await editor(page, '匹配标记').fill(''); await editor(page, '测试文本').fill('zab ab');
  await expect(page.getByText('1个匹配', { exact: true })).toBeVisible(); await expect(page.getByText('位置1', { exact: true })).toBeVisible(); await expect(page.getByText('捕获组：["a","b"]')).toBeVisible();
  await editor(page, '匹配标记').fill('g'); await expect(page.getByText('2个匹配', { exact: true })).toBeVisible();
  await editor(page, '正则表达式').fill('['); await expect(page.getByRole('alert')).toBeVisible();
  await editor(page, '正则表达式').fill('(a+)+$'); await editor(page, '测试文本').fill('a'.repeat(30000) + '!'); await button(page, '取消匹配').click(); await expect(page.getByRole('alert')).toContainText('已取消');
  await editor(page, '正则表达式').fill('!'); await expect(page.getByText('1个匹配', { exact: true })).toBeVisible();
});

test('line diff offers both layouts, all lines, swapped inputs and a bounded failure state', async ({ page }) => {
  await open(page, 'text-markup', 'diff'); await editor(page, '原始文本').fill('same\nold'); await editor(page, '修改后文本').fill('same\nnew');
  await button(page, '左右对照').click(); await page.getByLabel('仅显示改动').uncheck(); await expect(page.locator('main')).toContainText('same');
  await button(page, '统一视图').click(); await button(page, '交换左右').click(); await expect(editor(page, '原始文本')).toHaveValue('same\nnew');
  await editor(page, '原始文本').fill('x\n'.repeat(1600)); await editor(page, '修改后文本').fill('y\n'.repeat(1600)); await expect(page.getByRole('alert')).toBeVisible();
});

test('Markdown previews sanitized markup and exposes the same safe HTML source', async ({ page }) => {
  await open(page, 'text-markup', 'markdown'); await editor(page, 'Markdown 输入').fill('# Safe\n\n<script>window.xss=1</script>\n<a href="javascript:alert(1)">unsafe</a>');
  await expect(page.getByRole('heading', { name: 'Safe', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { xss?: number }).xss)).toBeUndefined();
  await button(page, 'HTML 源码').click(); await expect(editor(page, 'HTML 输出')).not.toHaveValue(/<script|javascript:/);
});

test('HTML to Markdown supports heading and code styles, and formatting retains semantic whitespace', async ({ page }) => {
  await open(page, 'text-markup', 'html-markdown'); await editor(page, 'HTML 输入').fill('<h1>Title</h1><pre><code>a  b</code></pre>');
  await expect(editor(page, 'Markdown 输出')).toHaveValue(/# Title/); await page.getByText('Markdown 输出选项', { exact: true }).click();
  await editor(page, '标题格式').selectOption('setext'); await editor(page, '代码块').selectOption('indented'); await expect(editor(page, 'Markdown 输出')).toHaveValue(/Title\n=+/);
  await open(page, 'text-markup', 'html-format'); const html = '<p><span>A</span> <span>B</span></p><pre>a  b\n c</pre><!--keep-->';
  await editor(page, 'HTML 输入').fill(html); for (const mode of ['格式化', '压缩']) { await button(page, mode).click(); const output = await editor(page, 'HTML 输出').inputValue(); expect(output).toContain('</span> <span>'); expect(output).toContain('a  b\n c'); expect(output).toContain('<!--keep-->'); }
});

test('escaping supports every bidirectional encoding, code-point escapes, safe HTML entities and previewed masking', async ({ page }) => {
  await open(page, 'encoding-binary', 'escape'); await editor(page, '原始字符串').fill('A<&');
  for (const [mode, marker] of [['unicode', '\\u0041'], ['hex', '\\x41'], ['b64', 'QTw'], ['url', 'A%3C'], ['html', 'A&lt;']]) {
    await editor(page, '输出编码').selectOption(mode); await expect(page.locator('textarea').nth(1)).toHaveValue(new RegExp(marker.replace(/\\/g, '\\\\')));
  }
  await editor(page, '原始字符串').fill('手机号 13800138000'); await button(page, '预览脱敏').click(); await expect(editor(page, '原始字符串')).toHaveValue('手机号 13800138000'); await button(page, '应用脱敏结果').click(); await expect(editor(page, '原始字符串')).not.toHaveValue(/13800138000/);
  await button(page, '解码与还原').click(); await editor(page, '输入编码').selectOption('unicode'); await editor(page, '待解码字符串').fill('\\u{1F44B}'); await button(page, '解码').click(); await expect(editor(page, '还原文本')).toHaveValue('👋');
  await editor(page, '输入编码').selectOption('html'); await editor(page, '待解码字符串').fill('<b>A</b>&amp;'); await button(page, '解码').click(); await expect(editor(page, '还原文本')).toHaveValue('<b>A</b>&');
  await editor(page, '输入编码').selectOption('hex'); await editor(page, '待解码字符串').fill('\\xzz'); await button(page, '解码').click(); await expect(page.getByRole('alert')).toBeVisible();
  await button(page, '文件字节').click(); await page.locator('input[type=file]').setInputFiles({ name: 'empty.txt', mimeType: 'text/plain', buffer: Buffer.alloc(0) }); await expect(page.getByText('empty.txt', { exact: true })).toBeVisible();
});

test('binary viewer searches UTF-8 and hex, jumps to offsets and exports the original bytes', async ({ page }) => {
  await open(page, 'encoding-binary', 'hex-viewer'); const bytes = Buffer.from('A中AB'); await page.locator('input[type=file]').setInputFiles({ name: 'same.bin', mimeType: 'application/octet-stream', buffer: bytes });
  await editor(page, '搜索文件字节').fill('中'); await expect(page.locator('main')).toContainText('3高亮字节');
  await editor(page, '搜索文件字节').fill('0x4142'); await expect(page.locator('main')).toContainText('2高亮字节');
  await editor(page, '跳转偏移').fill('0x4'); await button(page, '跳转').click(); await expect(page.locator('main')).toContainText('位置 (Index):4');
  await editor(page, '跳转偏移').fill('9999'); await button(page, '跳转').click(); await expect(page.getByRole('alert')).toBeVisible();
  const pending = page.waitForEvent('download'); await button(page, '下载该文件').click(); const downloaded = await pending; const fs = await import('node:fs/promises'); expect(await fs.readFile((await downloaded.path())!)).toEqual(bytes);
});

test('Hex text decodes every encoding and exposes invalid input errors', async ({ page }) => {
  await open(page, 'encoding-binary', 'hex-text');
  for (const [encoding, input, output] of [['utf-8', 'E4 B8 AD', '中'], ['utf-16le', '2D 4E', '中'], ['utf-16be', '4E 2D', '中'], ['windows-1252', '80', '€'], ['iso-8859-1', '41', 'A'], ['latin1', '41', 'A']]) {
    await editor(page, '字符编码').selectOption(encoding); await editor(page, '十六进制输入').fill(input); await expect(editor(page, '解码结果')).toHaveValue(output);
  }
  await editor(page, '十六进制输入').fill('GG'); await expect(page.getByRole('alert')).toContainText('非十六进制');
  await editor(page, '十六进制输入').fill('A'); await expect(page.getByRole('alert')).toContainText('偶数');
});

test('Unicode inspector shows repeated characters, blocks, emoji, name data and point lookups with bounded rows', async ({ page }) => {
  await open(page, 'encoding-binary', 'unicode-inspector'); await editor(page, '待分析文本').fill('AA中👍🏽');
  await expect(page.locator('tbody tr')).toHaveCount(4); await page.getByLabel('保留重复字符').check(); await expect(page.locator('tbody tr')).toHaveCount(5);
  await page.getByLabel('显示 UTF-16 编码').check(); await expect(page.getByRole('columnheader', { name: 'UTF-16 BE', exact: true })).toBeVisible();
  await button(page, '区块统计').click(); await expect(page.locator('main')).toContainText('Basic Latin'); await button(page, 'Emoji 序列').click(); await expect(page.locator('main')).toContainText('👍🏽');
  await page.getByText('按码点或名称查询 · 加载字符名称数据', { exact: true }).click(); await editor(page, '按码点查询').fill('U+4E2D'); await expect(page.locator('tbody')).toContainText('U+4E2D');
  await page.locator('input[type=file]').setInputFiles({ name: 'UnicodeData.txt', mimeType: 'text/plain', buffer: Buffer.from('0041;CUSTOM LETTER A;Lu;0;L;;;;;N;;;;0061;') }); await editor(page, '按名称查询').fill('CUSTOM'); await expect(page.locator('tbody').last()).toContainText('CUSTOM LETTER A');
  await editor(page, '待分析文本').fill('a'.repeat(10001)); await expect(page.getByRole('alert')).toContainText('10,000');
});

test('random string enforces length and selected alphabet while NanoID uses its own safe alphabet', async ({ page }) => {
  await open(page, 'generator-utility', 'random-str'); await editor(page, '生成长度').fill('64'); await page.getByLabel('包含数字').uncheck(); await page.getByLabel('包含符号').uncheck();
  await button(page, '生成随机字符串').click(); await expect(editor(page, '生成的字符串')).toHaveValue(/^[A-Za-z]{64}$/);
  await button(page, '生成 NanoID').click(); await expect(editor(page, '生成的字符串')).toHaveValue(/^[A-Za-z0-9_-]{64}$/);
  await editor(page, '生成长度').fill('2000'); await expect(editor(page, '生成长度')).toHaveValue('1024');
});

test('RMB uppercase uses decimal rounding and keeps very large amounts exact', async ({ page }) => {
  await open(page, 'generator-utility', 'rmb-uppercase'); await editor(page, '金额').fill('1.005'); await expect(page.getByText('壹元零壹分', { exact: true })).toBeVisible();
  await editor(page, '金额').fill('100000001.05'); await expect(page.getByText('壹亿零壹元零伍分', { exact: true })).toBeVisible();
  await editor(page, '金额').fill('-1'); await expect(button(page, '复制结果')).toBeDisabled();
});
