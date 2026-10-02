import { assertJsonBudget, convertIdentifierCase } from '../text/contentCore';

export const generateJsonCode = (value: unknown, target: string, rootType = 'Root'): string => {
  assertJsonBudget(value);
  const sanitizeName = (value: string) => {
    const clean = value.replace(/[^a-zA-Z0-9_$]/g, ' ').replace(/(?:^|\s)(\w)/g, (_, char: string) => char.toUpperCase()).replace(/\s/g, '');
    return /^[A-Za-z_$]/.test(clean) ? clean : `Type${clean}`;
  };

  const typeShape = (value: unknown): string => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return `[${[...new Set(value.map(typeShape))].sort().join('|')}]`;
    if (typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${typeShape(child)}`).join(',')}}`;
    return typeof value === 'number' && Number.isSafeInteger(value) ? 'integer' : typeof value;
  };
  const nativeField = (key: string, index: number, target: string, used: Set<string>) => {
    let field = convertIdentifierCase(key, target === 'go' ? 'PascalCase' : target === 'java' ? 'camelCase' : 'snake_case').replace(/[^a-zA-Z0-9_]/g, '_');
    if (!/^[A-Za-z]/.test(field)) field = `${target === 'go' ? 'Field' : 'field_'}${field || index + 1}`;
    const reserved = new Set('as async await break case catch class const continue crate def default del do else enum except extends false final finally fn for from global if implements import in instanceof interface lambda let loop match mod move mut new None nonlocal null package pass private protected pub public raise ref return self Self static struct super switch synchronized this throw throws trait true try type typeof unsafe use var virtual void volatile while with yield True False model_config model_fields'.split(' '));
    if (reserved.has(field)) field = `field_${field}`;
    const base = field; let suffix = 2;
    while (used.has(field)) field = `${base}_${suffix++}`;
    used.add(field); return field;
  };
  const inlineTs = (value: unknown): string => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return value.length ? `Array<${[...new Set(value.map(inlineTs))].join(' | ')}>` : 'unknown[]';
    if (typeof value === 'object') return `{ ${Object.entries(value as Record<string, unknown>).map(([key, child]) => `${JSON.stringify(key)}: ${inlineTs(child)}`).join('; ')} }`;
    return typeof value;
  };
  const inferTypeScript = (value: unknown, name: string, interfaces: string[]): string => {
    if (value === null) return 'null';
    if (Array.isArray(value)) {
      if (value.length === 0) return 'unknown[]';
      const childTypes = Array.from(new Set(value.map(inlineTs)));
      return childTypes.length === 1 ? `${childTypes[0]}[]` : `Array<${childTypes.join(' | ')}>`;
    }
    if (typeof value !== 'object') {
      return typeof value === 'string' ? 'string' : typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'unknown';
    }

    let interfaceName = sanitizeName(name);
    const entries = Object.entries(value as Record<string, unknown>);
    const body = entries.map(([key, child], index) => {
      const prop = /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
      return `  ${prop}: ${inferTypeScript(child, `${interfaceName}Field${index + 1}`, interfaces)};`;
    }).join('\n');
    const existing = interfaces.find(item => item.startsWith(`export interface ${interfaceName} `));
    if (existing && existing !== `export interface ${interfaceName} {\n${body || '  [key: string]: unknown;'}\n}`) {
      const base = interfaceName; let suffix = 2;
      while (interfaces.some(item => item.startsWith(`export interface ${interfaceName} `))) interfaceName = `${base}${suffix++}`;
    }
    const declaration = `export interface ${interfaceName} {\n${body || '  [key: string]: unknown;'}\n}`;
    if (!interfaces.some(item => item.startsWith(`export interface ${interfaceName} `))) {
      interfaces.unshift(declaration);
    }
    return interfaceName;
  };

  const inferRust = (value: unknown, name: string, structs: string[]): string => {
    if (value === null) return 'Option<serde_json::Value>';
    if (Array.isArray(value)) {
      if (value.length === 0) return 'Vec<serde_json::Value>';
      if (new Set(value.map(typeShape)).size > 1) return 'Vec<serde_json::Value>';
      const childType = inferRust(value[0], name, structs);
      return `Vec<${childType}>`;
    }
    if (typeof value !== 'object') {
      if (typeof value === 'string') return 'String';
      if (typeof value === 'number') return Number.isSafeInteger(value) ? 'i64' : 'f64';
      if (typeof value === 'boolean') return 'bool';
      return 'serde_json::Value';
    }

    const structName = sanitizeName(name);
    const entries = Object.entries(value as Record<string, unknown>);
    const used = new Set<string>();
    const body = entries.map(([key, child], index) => {
      const rustKey = nativeField(key, index, 'rust', used);
      if (/[\uD800-\uDFFF]/u.test(key)) throw new Error('Rust field names must contain valid Unicode scalar values.');
      const rustLiteral = JSON.stringify(key).replace(/\\u([0-9a-f]{4})/gi, '\\u{$1}');
      const renameAttr = rustKey !== key ? `  #[serde(rename = ${rustLiteral})]\n` : '';
      const typeStr = inferRust(child, `${structName}Field${index + 1}`, structs);
      return `${renameAttr}  pub ${rustKey}: ${typeStr},`;
    }).join('\n');
    const declaration = `#[derive(Debug, Clone, Serialize, Deserialize)]\npub struct ${structName} {\n${body}\n}`;
    if (!structs.includes(declaration)) {
      structs.push(declaration);
    }
    return structName;
  };

  const inferPython = (value: unknown, name: string, models: string[]): string => {
    if (value === null) return 'Optional[Any]';
    if (Array.isArray(value)) {
      if (value.length === 0) return 'List[Any]';
      if (new Set(value.map(typeShape)).size > 1) return 'List[Any]';
      const childType = inferPython(value[0], name, models);
      return `List[${childType}]`;
    }
    if (typeof value !== 'object') {
      if (typeof value === 'string') return 'str';
      if (typeof value === 'number') return Number.isSafeInteger(value) ? 'int' : 'float';
      if (typeof value === 'boolean') return 'bool';
      return 'Any';
    }

    const modelName = sanitizeName(name);
    const entries = Object.entries(value as Record<string, unknown>);
    const used = new Set<string>();
    const body = entries.map(([key, child], index) => {
      const field = nativeField(key, index, 'python', used);
      const typeStr = inferPython(child, `${modelName}Field${index + 1}`, models);
      return `    ${field}: ${typeStr}${field !== key ? ` = Field(alias=${JSON.stringify(key)})` : ''}`;
    }).join('\n');
    const declaration = `class ${modelName}(BaseModel):\n${body || '    pass'}`;
    if (!models.includes(declaration)) {
      models.push(declaration);
    }
    return modelName;
  };

  const inferGo = (value: unknown, name: string, structs: string[]): string => {
    if (value === null) return 'interface{}';
    if (Array.isArray(value)) {
      if (value.length === 0) return '[]interface{}';
      if (new Set(value.map(typeShape)).size > 1) return '[]interface{}';
      const childType = inferGo(value[0], name, structs);
      return `[]${childType}`;
    }
    if (typeof value !== 'object') {
      if (typeof value === 'string') return 'string';
      if (typeof value === 'number') return Number.isSafeInteger(value) ? 'int64' : 'float64';
      if (typeof value === 'boolean') return 'bool';
      return 'interface{}';
    }

    const structName = sanitizeName(name);
    const entries = Object.entries(value as Record<string, unknown>);
    const used = new Set<string>();
    const body = entries.map(([key, child], index) => {
      if (!key || /[^\p{L}\p{N}!#$%&()*+\-./:;<=>?@[\]^_{|}~ ]/u.test(key)) throw new Error('Go JSON field name cannot be represented by a struct tag.');
      const goField = nativeField(key, index, 'go', used);
      const typeStr = inferGo(child, `${structName}Field${index + 1}`, structs);
      return `\t${goField} ${typeStr} ${JSON.stringify(`json:${JSON.stringify(key)}`)}`;
    }).join('\n');
    const declaration = `type ${structName} struct {\n${body}\n}`;
    if (!structs.includes(declaration)) {
      structs.push(declaration);
    }
    return structName;
  };

  const inferJava = (value: unknown, name: string, classes: string[]): string => {
    if (value === null) return 'Object';
    if (Array.isArray(value)) {
      if (value.length === 0) return 'List<Object>';
      if (new Set(value.map(typeShape)).size > 1) return 'List<Object>';
      const childType = inferJava(value[0], name, classes);
      return `List<${childType}>`;
    }
    if (typeof value !== 'object') {
      if (typeof value === 'string') return 'String';
      if (typeof value === 'number') return Number.isSafeInteger(value) ? 'Long' : 'Double';
      if (typeof value === 'boolean') return 'Boolean';
      return 'Object';
    }

    const className = sanitizeName(name);
    const entries = Object.entries(value as Record<string, unknown>);
    const used = new Set<string>();
    const fieldNames = entries.map(([key], index) => nativeField(key, index, 'java', used));
    const fields = entries.map(([key, child], index) => {
      const typeStr = inferJava(child, `${className}Field${index + 1}`, classes);
      return `${fieldNames[index] !== key ? `    // JSON field: ${JSON.stringify(key).replace(/\\u/gi, 'U+')}\n` : ''}    private ${typeStr} ${fieldNames[index]};`;
    }).join('\n');
    const gettersAndSetters = entries.map(([_key, child], index) => {
      const typeStr = inferJava(child, `${className}Field${index + 1}`, classes);
      const camelKey = fieldNames[index];
      const pascalKey = camelKey.charAt(0).toUpperCase() + camelKey.slice(1);
      return `    public ${typeStr} get${pascalKey}() {\n        return this.${camelKey};\n    }\n\n    public void set${pascalKey}(${typeStr} ${camelKey}) {\n        this.${camelKey} = ${camelKey};\n    }`;
    }).join('\n\n');
    const declaration = `public class ${className} {\n${fields}\n\n${gettersAndSetters}\n}`;
    if (!classes.includes(declaration)) {
      classes.push(declaration);
    }
    return className;
  };

  const inferSql = (value: unknown, tableName: string): string => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('SQL DDL requires a JSON object at the root.');
    }

    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.length) throw new Error('SQL DDL requires at least one sample field.');
    const fields = entries.map(([key, child]) => {
      let sqlType = 'VARCHAR(255)';
      if (child === null) sqlType = 'VARCHAR(255) DEFAULT NULL';
      else if (typeof child === 'number') sqlType = Number.isSafeInteger(child) ? Math.abs(child) <= 2147483647 ? 'INT' : 'BIGINT' : 'DOUBLE';
      else if (typeof child === 'boolean') sqlType = 'TINYINT(1)';
      else if (Array.isArray(child) || typeof child === 'object') sqlType = 'JSON';

      return `  \`${key.replace(/`/g, '``')}\` ${sqlType}`;
    }).join(',\n');

    return `CREATE TABLE \`${sanitizeName(tableName)}\` (\n${fields}\n);`;
  };

  const renderCode = (parsed: unknown, targetLanguage: string, rootName: string) => {
    if (!['typescript', 'rust', 'python', 'go', 'java', 'sql'].includes(targetLanguage)) throw new Error('Unsupported target language');
    rootName = sanitizeName(rootName).replace(/\$/g, '_');
    const rootIsObject = Boolean(parsed && typeof parsed === 'object' && !Array.isArray(parsed));
    const childName = Array.isArray(parsed) ? `${rootName}Item` : rootName;
    if (targetLanguage === 'sql') {
      return inferSql(parsed, rootName);
    }

    const declarations: string[] = [];

    if (targetLanguage === 'rust') {
      const rootType = inferRust(parsed, childName, declarations);
      return `use serde::{Serialize, Deserialize};\n\n${declarations.join('\n\n')}${rootIsObject ? '' : `\n\npub type ${rootName} = ${rootType};`}`;
    }

    if (targetLanguage === 'python') {
      const rootType = inferPython(parsed, childName, declarations);
      return `from pydantic import BaseModel, Field\nfrom typing import List, Optional, Any\n\n${declarations.join('\n\n')}${rootIsObject ? '' : `\n\n${rootName} = ${rootType}`}`;
    }

    if (targetLanguage === 'go') {
      const rootType = inferGo(parsed, childName, declarations);
      return `package main\n\n${declarations.join('\n\n')}${rootIsObject ? '' : `\n\ntype ${rootName} ${rootType}`}`;
    }

    if (targetLanguage === 'java') {
      if (!rootIsObject) throw new Error('Java class generation requires a JSON object at the root.');
      inferJava(parsed, rootName, declarations);
      return `import java.util.List;\n\n${declarations.map(declaration => declaration.startsWith(`public class ${rootName} `) ? declaration : declaration.replace(/^public class/, 'class')).join('\n\n')}`;
    }

    const interfaces: string[] = [];
    const rootType = inferTypeScript(parsed, rootName, interfaces);
    if (targetLanguage === 'typescript') {
      return interfaces.join('\n\n') + (rootIsObject ? '' : `\n\nexport type ${sanitizeName(rootName)} = ${rootType};`);
    }

    throw new Error('Unsupported target language');
  };

  return renderCode(value, target, rootType);
};
