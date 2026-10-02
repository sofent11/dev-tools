import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';

import { ContentEditor, ContentToolbar, ContentOptions } from './shared/ContentWorkflow';

export const JsonToTsTool: React.FC = () => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [language, setLanguage] = useState('typescript');
  const [typeName, setTypeName] = useState('Root');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sanitizeName = (value: string) => {
    const clean = value.replace(/[^a-zA-Z0-9_$]/g, ' ').replace(/(?:^|\s)(\w)/g, (_, char: string) => char.toUpperCase()).replace(/\s/g, '');
    return /^[A-Za-z_$]/.test(clean) ? clean : `Type${clean}`;
  };

  const toCamelCase = (str: string): string => {
    return str.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
  };

  const toPascalCase = (str: string): string => {
    const camel = toCamelCase(str);
    return camel.charAt(0).toUpperCase() + camel.slice(1);
  };

  const inferTypeScript = (value: unknown, name: string, interfaces: string[]): string => {
    if (value === null) return 'null';
    if (Array.isArray(value)) {
      if (value.length === 0) return 'unknown[]';
      const childTypes = Array.from(new Set(value.map(item => inferTypeScript(item, name, interfaces))));
      return childTypes.length === 1 ? `${childTypes[0]}[]` : `Array<${childTypes.join(' | ')}>`;
    }
    if (typeof value !== 'object') {
      return typeof value === 'string' ? 'string' : typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'unknown';
    }

    const interfaceName = sanitizeName(name);
    const entries = Object.entries(value as Record<string, unknown>);
    const body = entries.map(([key, child]) => {
      const optional = child === null ? '?' : '';
      const prop = /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
      return `  ${prop}${optional}: ${inferTypeScript(child, `${interfaceName}_${key}`, interfaces)};`;
    }).join('\n');
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
      const childType = inferRust(value[0], name, structs);
      return `Vec<${childType}>`;
    }
    if (typeof value !== 'object') {
      if (typeof value === 'string') return 'String';
      if (typeof value === 'number') return Number.isInteger(value) ? 'i64' : 'f64';
      if (typeof value === 'boolean') return 'bool';
      return 'serde_json::Value';
    }

    const structName = sanitizeName(name);
    const entries = Object.entries(value as Record<string, unknown>);
    const body = entries.map(([key, child]) => {
      const isSnake = key.includes('_');
      const rustKey = isSnake ? key : key.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_+/, '');
      const renameAttr = rustKey !== key ? `  #[serde(rename = "${key}")]\n` : '';
      const typeStr = inferRust(child, `${structName}_${key}`, structs);
      return `${renameAttr}  pub ${rustKey}: ${typeStr},`;
    }).join('\n');
    const declaration = `#[derive(Debug, Clone, Serialize, Deserialize)]\npub struct ${structName} {\n${body || '  pub extra: serde_json::Value,'}\n}`;
    if (!structs.includes(declaration)) {
      structs.push(declaration);
    }
    return structName;
  };

  const inferPython = (value: unknown, name: string, models: string[]): string => {
    if (value === null) return 'Optional[Any]';
    if (Array.isArray(value)) {
      if (value.length === 0) return 'List[Any]';
      const childType = inferPython(value[0], name, models);
      return `List[${childType}]`;
    }
    if (typeof value !== 'object') {
      if (typeof value === 'string') return 'str';
      if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'float';
      if (typeof value === 'boolean') return 'bool';
      return 'Any';
    }

    const modelName = sanitizeName(name);
    const entries = Object.entries(value as Record<string, unknown>);
    const body = entries.map(([key, child]) => {
      const typeStr = inferPython(child, `${modelName}_${key}`, models);
      return `    ${key}: ${typeStr}`;
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
      const childType = inferGo(value[0], name, structs);
      return `[]${childType}`;
    }
    if (typeof value !== 'object') {
      if (typeof value === 'string') return 'string';
      if (typeof value === 'number') return Number.isInteger(value) ? 'int64' : 'float64';
      if (typeof value === 'boolean') return 'bool';
      return 'interface{}';
    }

    const structName = sanitizeName(name);
    const entries = Object.entries(value as Record<string, unknown>);
    const body = entries.map(([key, child]) => {
      const goField = toPascalCase(key);
      const typeStr = inferGo(child, `${structName}_${key}`, structs);
      return `\t${goField} ${typeStr} \`json:"${key}"\``;
    }).join('\n');
    const declaration = `type ${structName} struct {\n${body || '\tExtra interface{} `json:"extra"`'}\n}`;
    if (!structs.includes(declaration)) {
      structs.push(declaration);
    }
    return structName;
  };

  const inferJava = (value: unknown, name: string, classes: string[]): string => {
    if (value === null) return 'Object';
    if (Array.isArray(value)) {
      if (value.length === 0) return 'List<Object>';
      const childType = inferJava(value[0], name, classes);
      return `List<${childType}>`;
    }
    if (typeof value !== 'object') {
      if (typeof value === 'string') return 'String';
      if (typeof value === 'number') return Number.isInteger(value) ? 'Long' : 'Double';
      if (typeof value === 'boolean') return 'Boolean';
      return 'Object';
    }

    const className = sanitizeName(name);
    const entries = Object.entries(value as Record<string, unknown>);
    const fields = entries.map(([key, child]) => {
      const typeStr = inferJava(child, `${className}_${key}`, classes);
      return `    private ${typeStr} ${toCamelCase(key)};`;
    }).join('\n');
    const gettersAndSetters = entries.map(([key, child]) => {
      const typeStr = inferJava(child, `${className}_${key}`, classes);
      const camelKey = toCamelCase(key);
      const pascalKey = toPascalCase(key);
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
      return `-- SQL DDL conversion expects a JSON object at root.\nCREATE TABLE ${sanitizeName(tableName)} (\n  id INT AUTO_INCREMENT PRIMARY KEY,\n  value TEXT\n);`;
    }

    const entries = Object.entries(value as Record<string, unknown>);
    const fields = entries.map(([key, child]) => {
      let sqlType = 'VARCHAR(255)';
      if (child === null) sqlType = 'VARCHAR(255) DEFAULT NULL';
      else if (typeof child === 'number') sqlType = Number.isInteger(child) ? 'INT' : 'DECIMAL(10, 2)';
      else if (typeof child === 'boolean') sqlType = 'TINYINT(1)';
      else if (Array.isArray(child) || typeof child === 'object') sqlType = 'JSON';

      const isPrimaryKey = key.toLowerCase() === 'id' ? ' PRIMARY KEY' : '';
      return `  ${key} ${sqlType}${isPrimaryKey}`;
    }).join(',\n');

    return `CREATE TABLE ${sanitizeName(tableName)} (\n${fields}\n);`;
  };

  const renderCode = (parsed: unknown, targetLanguage: string, rootName: string) => {
    if (targetLanguage === 'sql') {
      return inferSql(parsed, rootName);
    }

    const declarations: string[] = [];

    if (targetLanguage === 'rust') {
      inferRust(parsed, rootName, declarations);
      return `use serde::{Serialize, Deserialize};\n\n${declarations.join('\n\n')}`;
    }

    if (targetLanguage === 'python') {
      inferPython(parsed, rootName, declarations);
      return `from pydantic import BaseModel\nfrom typing import List, Optional, Any\n\n${declarations.join('\n\n')}`;
    }

    if (targetLanguage === 'go') {
      inferGo(parsed, rootName, declarations);
      return `package main\n\n${declarations.join('\n\n')}`;
    }

    if (targetLanguage === 'java') {
      inferJava(parsed, rootName, declarations);
      return declarations.join('\n\n');
    }

    const interfaces: string[] = [];
    const rootType = inferTypeScript(parsed, rootName, interfaces);
    if (targetLanguage === 'typescript') {
      return interfaces.join('\n\n') || `export type ${sanitizeName(rootName)} = ${rootType};`;
    }

    const schema = JSON.stringify(parsed, null, 2);
    const languageNames: Record<string, string> = {
      swift: 'Swift',
      kotlin: 'Kotlin',
      csharp: 'C#',
    };
    return `// 轻量模式当前优先生成 TypeScript/Rust/Go/Python/Java/SQL 代码。\n// ${languageNames[targetLanguage] || targetLanguage} 目标可基于下方 JSON 样例继续扩展。\n\n${interfaces.join('\n\n')}\n\n// Source sample:\n${schema.split('\n').map(line => `// ${line}`).join('\n')}`;
  };

  const handleConvert = async () => {
    if (!input.trim()) {
      setError("Please enter JSON content.");
      return;
    }

    setLoading(true);
    setError(null);
    setOutput('');

    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(input);
      } catch (e) {
        throw new Error("Invalid JSON: " + (e as Error).message);
      }

      setOutput(renderCode(parsed, language, typeName));
    } catch (e) {
      console.error(e);
      setError((e as Error).message || "Conversion failed");
    } finally {
      setLoading(false);
    }
  };

  const updateInput = (value: string) => { setInput(value); setError(null); setOutput(''); };
  return <Card className="flex h-full min-h-0 flex-col"><CardContent className="min-h-0 flex-1 space-y-4 overflow-auto">
    <ContentToolbar onSample={() => updateInput('{"id":1,"name":"Atelier","active":true,"tags":["design","tools"],"profile":{"locale":"zh-CN"}}')} onClear={() => updateInput('')}>
      <label className="flex items-center gap-2 text-sm">目标语言<select aria-label="目标语言" value={language} onChange={event => { setLanguage(event.target.value); setOutput(''); }} className="rounded-lg border p-2">
        <option value="typescript">TypeScript</option><option value="go">Go Struct</option><option value="java">Java Class</option><option value="python">Python Pydantic</option><option value="rust">Rust Struct</option><option value="sql">SQL DDL</option>
        <option value="csharp">C# · 参考模式</option><option value="swift">Swift · 参考模式</option><option value="kotlin">Kotlin · 参考模式</option>
      </select></label>
      <Button onClick={handleConvert} disabled={loading || !input.trim()} icon={<ArrowRight className="h-4 w-4" />} isLoading={loading}>生成代码</Button>
    </ContentToolbar>
    <ContentOptions title="命名与生成选项"><label className="flex items-center gap-2 text-sm">根类型名称<input aria-label="根类型名称" className="rounded-lg border px-3 py-2 font-mono" value={typeName} onChange={event => { setTypeName(event.target.value); setOutput(''); }} /></label><p className="text-xs text-slate-500">由当前样例推断字段类型；请用具有代表性的数据检查生成结果。</p></ContentOptions>
    {['csharp', 'swift', 'kotlin'].includes(language) && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">此目标提供 TypeScript 类型与 JSON 参考，不生成该语言的可执行代码。</p>}
    <div className="grid gap-4 lg:grid-cols-2"><ContentEditor label="JSON 样例" value={input} onChange={updateInput} error={error} placeholder="粘贴 API 响应或有代表性的数据样例。" /><ContentEditor label="生成的代码" value={output} output placeholder="选择目标语言并生成代码。" /></div>
  </CardContent></Card>;
};
