import fs from 'node:fs';
import ts from 'typescript';
const registry = fs.readFileSync('components/tools/registry.ts', 'utf8');
const imports = new Map([...registry.matchAll(/const (\w+) = lazyNamed\(\(\) => import\('([^']+)'\)/g)].map(m => [m[1], m[2]]));
const catalog = [];
for (const entry of registry.matchAll(/\{\s*id:\s*'([^']+)'[\s\S]*?component:\s*(\w+)\s*\}/g)) {
  const file = `components/tools/${imports.get(entry[2]).replace('./','')}.tsx`;
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'subTools' && ts.isArrayLiteralExpression(node.initializer)) {
      for (const tool of node.initializer.elements) {
        const values = Object.fromEntries(tool.properties.filter(p => ts.isPropertyAssignment(p) && ts.isStringLiteral(p.initializer)).map(p => [p.name.getText(source), p.initializer.text]));
        const experimental = ['stl-repair','voronoi','smart-geometry','jewelry','csg','video-download'].some(id => values.id.includes(id));
        catalog.push({ studioId: entry[1], id: values.id, name: values.name, description: values.description || '', stage: experimental ? 'experimental' : 'supported', route: `/tools/${entry[1]}#${values.id}` });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}
const outputs = {
  'src/tool-catalog.json': JSON.stringify(catalog, null, 2) + '\n',
  'docs/tool-catalog.md': '# Tool catalog\n\nGenerated from the registered Studio definitions. Run `npm run catalog:generate` to update.\n\n| Tool | Route | Stage |\n|---|---|---|\n' + catalog.map(t => `| ${t.name} | ${t.route} | ${t.stage} |`).join('\n') + '\n',
};
for (const [file, content] of Object.entries(outputs)) {
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(file) || fs.readFileSync(file,'utf8') !== content) throw new Error(`Stale tool catalog: ${file}`);
  } else fs.writeFileSync(file, content);
}
console.log(`Tool catalog: ${catalog.length} entries`);
