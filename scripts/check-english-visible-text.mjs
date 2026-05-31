import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appUrl = process.env.CHECK_I18N_APP_URL || 'http://127.0.0.1:3000';
const hasHan = /[\u3400-\u9fff]/;
const textSkipClosest = 'script,style,noscript,textarea,input,select,option,code,pre,[contenteditable="true"]';
const attributeSkipClosest = 'script,style,noscript,code,pre,[contenteditable="true"]';

const read = relativePath => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const discoverStudioRoutes = () => {
  const registry = read('components/tools/registry.ts');
  const importMap = new Map(
    [...registry.matchAll(/const (\w+) = lazyNamed\(\(\) => import\('([^']+)'\)/g)]
      .map(match => [match[1], match[2]]),
  );
  const routes = [];

  for (const match of registry.matchAll(/\{\s*id:\s*'([^']+)'[\s\S]*?component:\s*(\w+)\s*\}/g)) {
    const [_, studioId, componentName] = match;
    const importPath = importMap.get(componentName);
    if (!importPath) continue;

    const studioSource = read(`components/tools/${importPath.replace('./', '')}.tsx`);
    for (const subToolMatch of studioSource.matchAll(/\{\s*id:\s*'([^']+)'/g)) {
      routes.push(`/tools/${studioId}#${subToolMatch[1]}`);
    }
  }

  return routes;
};

const scanRoute = async (page, route) => {
  await page.goto(`${appUrl}${route}`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.setItem('locale', 'en-US'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);

  return page.evaluate(({ hasHanSource, textSkipClosestSelector, attributeSkipClosestSelector }) => {
    const hasHan = new RegExp(hasHanSource);
    const isVisible = element => {
      if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) return false;
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const residuals = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement;
      if (!parent || parent.closest(textSkipClosestSelector) || !isVisible(parent)) continue;
      const text = node.nodeValue.replace(/\s+/g, ' ').trim();
      if (text && hasHan.test(text)) residuals.push({ kind: 'text', text });
    }

    for (const element of document.querySelectorAll('[placeholder],[title],[aria-label]')) {
      if (element.closest(attributeSkipClosestSelector)) continue;
      for (const attr of ['placeholder', 'title', 'aria-label']) {
        const value = element.getAttribute(attr);
        if (value && hasHan.test(value)) {
          residuals.push({ kind: attr, text: value.replace(/\s+/g, ' ').trim() });
        }
      }
    }

    for (const select of document.querySelectorAll('select')) {
      if (!isVisible(select)) continue;
      const selectedText = [...select.selectedOptions]
        .map(option => option.textContent?.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join(' / ');
      if (selectedText && hasHan.test(selectedText)) {
        residuals.push({ kind: 'selected-option', text: selectedText });
      }

      for (const option of select.options) {
        const text = option.textContent?.replace(/\s+/g, ' ').trim();
        if (text && hasHan.test(text)) residuals.push({ kind: 'option', text });
      }
    }

    return [...new Map(residuals.map(item => [`${item.kind}|${item.text}`, item])).values()];
  }, {
    hasHanSource: hasHan.source,
    textSkipClosestSelector: textSkipClosest,
    attributeSkipClosestSelector: attributeSkipClosest,
  });
};

const routes = discoverStudioRoutes();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
page.setDefaultTimeout(5_000);

await page.route('**/*', route => {
  const requestUrl = route.request().url();
  if (requestUrl.startsWith(appUrl)) return route.continue();
  if (/127\.0\.0\.1:3000|localhost:3000/.test(requestUrl)) return route.continue();
  if (/cdn|jsdelivr|cdnjs|google|mediapipe|api-dev|workers|vimeo|bilibili|ipify|cloudflare/i.test(requestUrl)) {
    return route.abort().catch(() => {});
  }
  return route.continue();
});

const failures = [];
for (const route of routes) {
  const residuals = await scanRoute(page, route);
  if (residuals.length > 0) failures.push({ route, residuals });
}

await browser.close();

if (failures.length > 0) {
  console.error(`English visible text check failed: ${failures.length}/${routes.length} routes still contain visible Chinese text.`);
  for (const failure of failures) {
    console.error(`\n${failure.route}`);
    for (const residual of failure.residuals) {
      console.error(`- [${residual.kind}] ${residual.text}`);
    }
  }
  process.exit(1);
}

console.log(`English visible text OK: ${routes.length} studio tabs checked.`);
