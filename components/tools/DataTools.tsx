import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Check, Minimize2, Wand2, Database, Play, Download, Upload, Search, ShieldAlert, Cpu } from 'lucide-react';
import { loadScriptWithCache } from './shared/cdnCacheManager';
import { RuntimeAssetStatusPanel } from './shared/useRuntimeAsset';
import { ScratchpadPicker, isScratchpadBinaryLike } from './shared/ScratchpadControls';
import { notifyToast } from './shared/notifyToast';
import type { RuntimeAssetLoaderState } from './shared/runtimeAssetLoader';
import { format as formatSql, supportedDialects, type SqlLanguage } from 'sql-formatter';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { ContentEditor, ContentToolbar, ContentOptions } from './shared/ContentWorkflow';
import { FieldLabel, Select } from '../ui/ToolUi';
import {
  buildDiff,
  countDiffs,
  deleteValueAtPath,
  generateJsonPatch,
  previewValue,
  setValueAtPath,
  type DiffNode,
  type JsonValue,
} from './data/jsonDiffCore';

export { buildDiff, generateJsonPatch, toJsonPointer } from './data/jsonDiffCore';

const SQLJS_VERSION = '1.8.0';
const SQLJS_SCRIPT_URL = `https://cdnjs.cloudflare.com/ajax/libs/sql.js/${SQLJS_VERSION}/sql-wasm.js`;
const SQLJS_SCRIPT_FALLBACK_URL = `https://cdn.jsdelivr.net/npm/sql.js@${SQLJS_VERSION}/dist/sql-wasm.js`;
const SQLJS_WASM_BASE_URL = `https://cdnjs.cloudflare.com/ajax/libs/sql.js/${SQLJS_VERSION}`;
const SQLJS_WASM_FALLBACK_BASE_URL = `https://cdn.jsdelivr.net/npm/sql.js@${SQLJS_VERSION}/dist`;

const useCopy = () => {
  const [copied, setCopied] = useState(false);
  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  return { copied, copy };
};

type JsonSchema =
  | { type: 'null' }
  | { type: 'string' }
  | { type: 'integer' | 'number' }
  | { type: 'boolean' }
  | { type: 'array'; items?: JsonSchema }
  | { type: 'object'; properties: Record<string, JsonSchema>; required: string[] }
  | Record<string, never>;

type SqlValue = string | number | Uint8Array | null;

interface SqlExecResult {
  columns: string[];
  values: SqlValue[][];
}

interface SqlDatabase {
  exec(sql: string): SqlExecResult[];
  export(): Uint8Array;
  run(sql: string): void;
}

interface SqlJsStatic {
  Database: new (data?: Uint8Array) => SqlDatabase;
}

type SqlJsInitializer = (options: { locateFile: (file: string) => string }) => Promise<SqlJsStatic>;

interface SqliteColumn {
  name: string;
  type: string;
}

interface SqliteTable {
  name: string;
  sql: string;
  columns: SqliteColumn[];
}

const getSqlJsInitializer = (): SqlJsInitializer | undefined =>
  (window as Window & { initSqlJs?: SqlJsInitializer }).initSqlJs;

interface JsonDiffContextProps {
  onMergeLeft: (node: DiffNode) => void;
  onMergeRight: (node: DiffNode) => void;
}
const JsonDiffContext = React.createContext<JsonDiffContextProps | null>(null);

const DiffTree: React.FC<{ node: DiffNode; depth?: number; hideSame?: boolean }> = ({ node, depth = 0, hideSame = false }) => {
  const [isOpen, setIsOpen] = useState(() => node.kind !== 'same');
  const context = React.useContext(JsonDiffContext);

  const color = {
    same: 'border-slate-200 bg-white text-slate-600',
    added: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    removed: 'border-red-200 bg-red-50 text-red-800',
    changed: 'border-amber-200 bg-amber-50 text-amber-900',
  }[node.kind];

  const hasChildren = node.children && node.children.length > 0;
  if (hideSame && node.kind === 'same') return null;

  return (
    <div className="space-y-1">
      <div
        className={`rounded-lg border px-3 py-2 text-sm select-none transition-colors ${color} ${
          hasChildren ? 'cursor-pointer hover:bg-slate-50/50' : ''
        }`}
        style={{ marginLeft: depth ? Math.min(depth * 16, 96) : 0 }}
        onClick={() => hasChildren && setIsOpen(!isOpen)}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {hasChildren && (
              <span className="font-mono text-xs text-slate-400 font-bold mr-1">
                {isOpen ? '▼' : '▶'}
              </span>
            )}
            <code className="font-semibold">{node.key}</code>
            <span className="rounded border border-current/20 px-1.5 py-0.5 text-[10px] uppercase font-bold">{node.kind}</span>
            <span className="text-[11px] opacity-70 font-mono">{node.displayPath}</span>
          </div>
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            {node.kind !== 'same' && context && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => context.onMergeLeft(node)}
                  className="px-1.5 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors text-[9px] font-bold"
                  title="将此差异项合并到左侧"
                >
                  ← 合并至左
                </button>
                <button
                  onClick={() => context.onMergeRight(node)}
                  className="px-1.5 py-0.5 rounded border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors text-[9px] font-bold"
                  title="将此差异项合并到右侧"
                >
                  合并至右 →
                </button>
              </div>
            )}
            {hasChildren && !isOpen && (
              <span className="text-xs text-slate-400 font-medium">
                ({node.children!.length} 个属性已折叠)
              </span>
            )}
          </div>
        </div>
        {!node.children && (
          <div className="mt-1.5 grid gap-1.5 font-mono text-xs md:grid-cols-2 border-t border-slate-100/60 pt-1.5">
            <div className="break-all opacity-85"><span className="font-semibold text-rose-600 mr-1">左:</span> {previewValue(node.left)}</div>
            <div className="break-all"><span className="font-semibold text-emerald-600 mr-1">右:</span> {previewValue(node.right)}</div>
          </div>
        )}
      </div>
      {hasChildren && isOpen && (
        <div className="space-y-1">
          {node.children!.map(child => (
            <DiffTree key={child.displayPath} node={child} depth={depth + 1} hideSame={hideSame} />
          ))}
        </div>
      )}
    </div>
  );
};

const sampleLeft = `{
  "name": "devtoolbox",
  "version": 1,
  "features": ["json", "hash"],
  "enabled": true
}`;

const sampleRight = `{
  "enabled": true,
  "name": "devtoolbox",
  "version": 2,
  "features": ["json", "hash", "cron"]
}`;

export const JsonDiffTool: React.FC = () => {
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');
  const [hideSame, setHideSame] = useState(true);
  const [beforeMerge, setBeforeMerge] = useState<{ left: string; right: string } | null>(null);
  const patchCopy = useCopy();

  const result = useMemo(() => {
    try {
      if (!left.trim() || !right.trim()) return { diff: null, counts: null, leftJson: null, rightJson: null, error: '' };
      const leftJson = JSON.parse(left);
      const rightJson = JSON.parse(right);
      const diff = buildDiff(leftJson, rightJson);
      return { diff, counts: countDiffs(diff), leftJson, rightJson, error: '' };
    } catch (error) {
      return { diff: null, counts: null, leftJson: null, rightJson: null, error: (error as Error).message };
    }
  }, [left, right]);

  const handleMergeLeft = useCallback((node: DiffNode) => {
    try {
      const leftJson = JSON.parse(left);
      const pathSegments = node.path;

      let newLeft = leftJson;
      if (node.kind === 'added') {
        newLeft = setValueAtPath(leftJson, pathSegments, node.right);
      } else if (node.kind === 'removed') {
        newLeft = deleteValueAtPath(leftJson, pathSegments);
      } else if (node.kind === 'changed') {
        newLeft = setValueAtPath(leftJson, pathSegments, node.right);
      }

      setBeforeMerge({ left, right });
      setLeft(JSON.stringify(newLeft, null, 2));
    } catch (e) {
      notifyToast({ title: '合并至左侧失败', description: (e as Error).message, tone: 'error' });
    }
  }, [left, right]);

  const handleMergeRight = useCallback((node: DiffNode) => {
    try {
      const rightJson = JSON.parse(right);
      const pathSegments = node.path;

      let newRight = rightJson;
      if (node.kind === 'added') {
        newRight = deleteValueAtPath(rightJson, pathSegments);
      } else if (node.kind === 'removed') {
        newRight = setValueAtPath(rightJson, pathSegments, node.left);
      } else if (node.kind === 'changed') {
        newRight = setValueAtPath(rightJson, pathSegments, node.left);
      }

      setBeforeMerge({ left, right });
      setRight(JSON.stringify(newRight, null, 2));
    } catch (e) {
      notifyToast({ title: '合并至右侧失败', description: (e as Error).message, tone: 'error' });
    }
  }, [left, right]);

  const jsonPatchText = useMemo(() => {
    if (!result.diff) return '[]';
    try {
      const ops = generateJsonPatch(result.diff);
      return JSON.stringify(ops, null, 2);
    } catch (e) {
      return `[计算 JSON Patch 失败: ${(e as Error).message}]`;
    }
  }, [result.diff]);

  const contextValue = useMemo(() => ({
    onMergeLeft: handleMergeLeft,
    onMergeRight: handleMergeRight
  }), [handleMergeLeft, handleMergeRight]);

  return <Card className="flex h-full min-h-0 flex-col"><CardContent className="min-h-0 flex-1 space-y-4 overflow-auto">
    <ContentToolbar onSample={() => { setLeft(sampleLeft); setRight(sampleRight); setBeforeMerge(null); }} onClear={() => { setLeft(''); setRight(''); setBeforeMerge(null); }} status="实时结构比较">
      <Button size="sm" variant="secondary" onClick={() => { setLeft(right); setRight(left); setBeforeMerge(null); }} disabled={!left && !right}>交换左右</Button>
      <Button size="sm" variant="ghost" disabled={!beforeMerge} onClick={() => { if (beforeMerge) { setLeft(beforeMerge.left); setRight(beforeMerge.right); setBeforeMerge(null); } }}>撤销上次合并</Button>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={hideSame} onChange={event => setHideSame(event.target.checked)} />仅显示差异</label>
    </ContentToolbar>
    <div className="grid gap-4 lg:grid-cols-2"><ContentEditor label="原始 JSON · 左侧" value={left} onChange={value => { setLeft(value); setBeforeMerge(null); }} placeholder="粘贴原始 JSON，键顺序和空白不影响比较。" /><ContentEditor label="修改 JSON · 右侧" value={right} onChange={value => { setRight(value); setBeforeMerge(null); }} placeholder="粘贴修改后的 JSON。" /></div>
    {result.error && <p role="alert" className="status-error p-3 text-sm">JSON 解析失败：{result.error}</p>}
    <div className="tool-panel space-y-3 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">结构化差异</h3>{result.diff && <span className="text-xs text-slate-500">{generateJsonPatch(result.diff).length} 处变更</span>}</div><JsonDiffContext.Provider value={contextValue}>{result.diff ? result.diff.kind === 'same' && hideSame ? <p className="py-8 text-center text-sm text-primary-700">两个 JSON 内容相同。</p> : <DiffTree node={result.diff} hideSame={hideSame} /> : <p className="py-8 text-center text-sm text-slate-400">载入两份 JSON 后查看差异；每个节点可合并到任一侧。</p>}</JsonDiffContext.Provider></div>
    <details className="tool-panel p-4"><summary className="cursor-pointer text-sm font-medium">导出 JSON Patch · 左侧 → 右侧</summary><div className="mt-3 flex justify-end"><Button size="sm" variant="secondary" disabled={!result.diff} onClick={() => patchCopy.copy(jsonPatchText)}>{patchCopy.copied ? '已复制' : '复制 Patch'}</Button></div><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs">{result.diff ? jsonPatchText : '先载入有效的 JSON'}</pre></details>
  </CardContent></Card>;
};

const sampleSql = `select u.id,u.name,count(o.id) as orders from users u left join orders o on o.user_id=u.id where u.created_at>='2026-01-01' group by u.id,u.name order by orders desc`;

export const SqlFormatterTool: React.FC = () => {
  const [input, setInput] = useState(sampleSql);
  const [dialect, setDialect] = useState<SqlLanguage | 'sql'>('sql');
  const [keywordCase, setKeywordCase] = useState<'preserve' | 'upper' | 'lower'>('upper');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const runFormat = () => {
    try {
      const formatted = formatSql(input, {
        language: dialect === 'sql' ? undefined : dialect,
        keywordCase,
      });
      setOutput(formatted);
      setError('');
    } catch (err) {
      setOutput('');
      setError((err as Error).message);
    }
  };

  const minify = () => {
    setOutput(input.replace(/\s+/g, ' ').trim());
    setError('');
  };

  const updateInput = (value: string) => { setInput(value); setOutput(''); setError(''); };
  return <Card className="flex h-full min-h-0 flex-col"><CardContent className="min-h-0 flex-1 space-y-4 overflow-auto">
    <ContentToolbar onSample={() => updateInput(sampleSql)} onClear={() => updateInput('')}><Button onClick={runFormat} disabled={!input.trim()} icon={<Wand2 className="h-4 w-4" />}>格式化</Button><Button variant="secondary" onClick={minify} disabled={!input.trim()} icon={<Minimize2 className="h-4 w-4" />}>压缩</Button><span className="text-xs text-slate-500">{dialect === 'sql' ? 'Standard SQL' : dialect}</span></ContentToolbar>
    <ContentOptions title="数据库方言与格式选项"><label className="flex flex-col gap-2 text-sm">数据库方言<Select value={dialect} onChange={event => { setDialect(event.target.value as SqlLanguage | 'sql'); setOutput(''); }}><option value="sql">Standard SQL</option>{supportedDialects.map(item => <option key={item} value={item}>{item}</option>)}</Select></label><label className="flex flex-col gap-2 text-sm">关键字大小写<Select value={keywordCase} onChange={event => { setKeywordCase(event.target.value as typeof keywordCase); setOutput(''); }}><option value="upper">UPPER</option><option value="lower">lower</option><option value="preserve">Preserve</option></Select></label></ContentOptions>
    <div className="grid gap-4 lg:grid-cols-2"><ContentEditor label="输入 SQL" value={input} onChange={updateInput} error={error} placeholder="粘贴 SQL，选择数据库方言后格式化。" /><ContentEditor label="SQL 输出" value={output} output placeholder="格式化结果保留原始 SQL，便于核对。" onUseResult={() => updateInput(output)} /></div>
  </CardContent></Card>;
};

// --- JSON Schema Generator & Local Validator ---
const generateSchema = (val: JsonValue): JsonSchema => {
  if (val === null) return { type: 'null' };
  if (typeof val === 'string') return { type: 'string' };
  if (typeof val === 'number') return { type: Number.isInteger(val) ? 'integer' : 'number' };
  if (typeof val === 'boolean') return { type: 'boolean' };
  if (Array.isArray(val)) {
    const items = val.length > 0 ? generateSchema(val[0]) : {};
    return { type: 'array', items };
  }
  if (typeof val === 'object') {
    const properties: Record<string, JsonSchema> = {};
    const required: string[] = [];
    const obj = val as Record<string, JsonValue>;
    for (const key of Object.keys(obj)) {
      properties[key] = generateSchema(obj[key]);
      required.push(key);
    }
    return { type: 'object', properties, required };
  }
  return {};
};

const validateJson = (schema: JsonSchema, data: JsonValue, path = 'root'): string[] => {
  const errors: string[] = [];
  if (!schema || typeof schema !== 'object') return errors;

  const type = schema.type;
  if (type) {
    if (type === 'null' && data !== null) {
      errors.push(`[${path}] 应为 null，但实际为 ${typeof data}`);
    } else if (type === 'string' && typeof data !== 'string') {
      errors.push(`[${path}] 应为 string，但实际为 ${typeof data}`);
    } else if (type === 'boolean' && typeof data !== 'boolean') {
      errors.push(`[${path}] 应为 boolean，但实际为 ${typeof data}`);
    } else if (type === 'number' && typeof data !== 'number') {
      errors.push(`[${path}] 应为 number，但实际为 ${typeof data}`);
    } else if (type === 'integer' && !Number.isInteger(data)) {
      errors.push(`[${path}] 应为 integer，但实际为 ${typeof data === 'number' ? 'float' : typeof data}`);
    } else if (type === 'array' && !Array.isArray(data)) {
      errors.push(`[${path}] 应为 array，但实际为 ${typeof data}`);
    } else if (type === 'object' && (typeof data !== 'object' || data === null || Array.isArray(data))) {
      errors.push(`[${path}] 应为 object，但实际为 ${typeof data}`);
    }
  }

  if (type === 'object' && data && typeof data === 'object' && !Array.isArray(data)) {
    const props = schema.properties;
    if (props) {
      const dataRecord = data as Record<string, JsonValue>;
      for (const key of Object.keys(props)) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          errors.push(...validateJson(props[key], dataRecord[key], `${path}.${key}`));
        }
      }
    }
    const required = schema.required;
    if (Array.isArray(required)) {
      for (const reqKey of required) {
        if (!Object.prototype.hasOwnProperty.call(data, reqKey)) {
          errors.push(`[${path}] 缺失必需的属性: "${reqKey}"`);
        }
      }
    }
  }

  if (type === 'array' && Array.isArray(data)) {
    const itemsSchema = schema.items;
    if (itemsSchema) {
      data.forEach((item, index) => {
        errors.push(...validateJson(itemsSchema, item, `${path}[${index}]`));
      });
    }
  }

  return errors;
};

const defaultJsonSample = `{
  "id": 1,
  "name": "Leanne Graham",
  "email": "Sincere@april.biz",
  "address": {
    "street": "Kulas Light",
    "city": "Gwenborough"
  },
  "tags": ["developer", "curious"],
  "active": true
}`;

const defaultSchemaSample = `{
  "type": "object",
  "properties": {
    "id": { "type": "integer" },
    "name": { "type": "string" },
    "email": { "type": "string" },
    "address": {
      "type": "object",
      "properties": {
        "street": { "type": "string" },
        "city": { "type": "string" }
      },
      "required": ["street", "city"]
    },
    "tags": {
      "type": "array",
      "items": { "type": "string" }
    },
    "active": { "type": "boolean" }
  },
  "required": ["id", "name", "email"]
}`;

export const JsonSchemaTool: React.FC = () => {
  const [jsonText, setJsonText] = useState('');
  const [schemaText, setSchemaText] = useState('');
  const [generationError, setGenerationError] = useState('');
  
  const [validationOutput, setValidationOutput] = useState<{
    status: 'idle' | 'valid' | 'invalid';
    errors: string[];
  }>({ status: 'idle', errors: [] });


  const handleGenerateSchema = () => {
    try {
      const parsed = JSON.parse(jsonText);
      const schema = generateSchema(parsed);
      // Format generated schema nicely
      setSchemaText(JSON.stringify(schema, null, 2));
      setValidationOutput({ status: 'idle', errors: [] });
      setGenerationError('');
    } catch (err) {
      setGenerationError((err as Error).message);
    }
  };

  const handleValidate = () => {
    try {
      const data = JSON.parse(jsonText);
      const schema = JSON.parse(schemaText);
      const errors = validateJson(schema, data);
      
      setValidationOutput({
        status: errors.length === 0 ? 'valid' : 'invalid',
        errors
      });
    } catch (err) {
      setValidationOutput({
        status: 'invalid',
        errors: [`[解析错误] ${ (err as Error).message }`]
      });
    }
  };

  const resetStatus = () => { setValidationOutput({ status: 'idle', errors: [] }); setGenerationError(''); };
  return <Card className="flex h-full min-h-0 flex-col"><CardContent className="min-h-0 flex-1 space-y-4 overflow-auto">
    <ContentToolbar onSample={() => { setJsonText(defaultJsonSample); setSchemaText(defaultSchemaSample); resetStatus(); }} onClear={() => { setJsonText(''); setSchemaText(''); resetStatus(); }}><Button onClick={handleGenerateSchema} disabled={!jsonText.trim()} icon={<Wand2 className="h-4 w-4" />}>从样例生成 Schema</Button><Button variant="secondary" onClick={handleValidate} disabled={!jsonText.trim() || !schemaText.trim()} icon={<Check className="h-4 w-4" />}>校验数据</Button></ContentToolbar>
    <div className="grid gap-4 lg:grid-cols-2"><ContentEditor label="JSON 数据" value={jsonText} onChange={value => { setJsonText(value); resetStatus(); }} error={generationError} placeholder="输入 JSON 样例生成 Schema，或配合已有 Schema 进行校验。" /><ContentEditor label="Schema 定义" value={schemaText} onChange={value => { setSchemaText(value); resetStatus(); }} output placeholder="从左侧样例生成，或粘贴已有 Schema。" /></div>
    <section className="tool-panel p-4" aria-live="polite">{validationOutput.status === 'idle' ? <p className="text-sm text-slate-500">生成 Schema 后可以编辑规则，再运行校验。</p> : validationOutput.status === 'valid' ? <p className="text-sm font-medium text-emerald-700">支持的规则检查通过。</p> : <div role="alert"><p className="mb-2 text-sm font-semibold text-red-700">{validationOutput.errors.length} 项校验问题</p><ul className="max-h-52 list-disc space-y-1 overflow-auto pl-5 font-mono text-xs text-red-700">{validationOutput.errors.map((error, index) => <li key={index}>{error}</li>)}</ul></div>}</section>
    <details className="text-xs text-slate-500"><summary className="cursor-pointer">本地校验支持范围</summary><p className="mt-2 leading-5">检查 type、properties、required 与 items。生成器按数组首项推断类型；其他 JSON Schema 关键字不会被校验。</p></details>
  </CardContent></Card>;
};

// ================= SQLite WebAssembly Sandbox =================
export const SqliteSandboxTool: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [runtimeState, setRuntimeState] = useState<RuntimeAssetLoaderState>({
    status: 'idle',
    label: 'SQL.js',
    source: SQLJS_SCRIPT_URL,
    version: SQLJS_VERSION,
  });
  const sqlJsWasmBaseUrlRef = useRef(SQLJS_WASM_BASE_URL);
  const [db, setDb] = useState<SqlDatabase | null>(null);
  const [sql, setSql] = useState(
    `-- 这是一个 WebAssembly SQLite 离线沙箱。\n-- 您可以点击左下角载入测试表，也可以在这里输入并执行任意 SQL 查询。\nSELECT * FROM users;`
  );
  
  const [queryResult, setQueryResult] = useState<SqlExecResult[] | null>(null);
  const [queryError, setQueryError] = useState('');
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const [queryTime, setQueryTime] = useState<number | null>(null);
  const [databaseName, setDatabaseName] = useState('演示数据库');
  const [tables, setTables] = useState<SqliteTable[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshSchema = useCallback((activeDb: SqlDatabase) => {
    if (!activeDb) return;
    try {
      const res = activeDb.exec("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
      if (res.length > 0) {
        const tablesList: SqliteTable[] = res[0].values.map(row => {
          const tableName = String(row[0] ?? '');
          const createSql = String(row[1] ?? '');
          let cols: SqliteColumn[] = [];
          try {
            const colRes = activeDb.exec(`PRAGMA table_info(${tableName})`);
            if (colRes.length > 0) {
              cols = colRes[0].values.map(c => ({
                name: String(c[1] ?? ''),
                type: String(c[2] ?? '')
              }));
            }
          } catch { /* ignore */ }
          return { name: tableName, sql: createSql, columns: cols };
        });
        setTables(tablesList);
      } else {
        setTables([]);
      }
    } catch (e) {
      console.error('Failed to load schema', e);
    }
  }, []);

  const initDatabase = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const initSqlJs = getSqlJsInitializer();
      if (!initSqlJs) throw new Error('SQL.js 初始化器未加载');
      const SQL = await initSqlJs({
        locateFile: (file: string) => `${sqlJsWasmBaseUrlRef.current}/${file}`
      });
      const newDb = new SQL.Database();
      setDb(newDb);
      
      // Initialize demo data
      newDb.run(`
        CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT, role TEXT);
        CREATE TABLE logs (id INTEGER PRIMARY KEY, user_id INTEGER, action TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP);
        
        INSERT INTO users (name, email, role) VALUES 
          ('Alice Vance', 'alice@dev.com', 'Administrator'),
          ('Bob Newman', 'bob@dev.com', 'Developer'),
          ('Charlie Zheng', 'charlie@dev.com', 'Designer');
          
        INSERT INTO logs (user_id, action) VALUES 
          (1, 'Login'),
          (2, 'Git Commit'),
          (1, 'Database Export');
      `);
      
      refreshSchema(newDb);
      const res = newDb.exec('SELECT * FROM users;');
      setQueryResult(res);
      setIsLoading(false);
    } catch (err) {
      setError('初始化 WASM 数据库失败: ' + (err as Error).message);
      setIsLoading(false);
    }
  }, [refreshSchema]);

  const loadSqlRuntime = useCallback(() => {
    if (getSqlJsInitializer()) {
      Promise.resolve().then(() => initDatabase());
      return;
    }

    Promise.resolve().then(() => setIsLoading(true));
    loadScriptWithCache(SQLJS_SCRIPT_URL, {
      label: 'SQL.js',
      version: SQLJS_VERSION,
      fallbackUrls: [SQLJS_SCRIPT_FALLBACK_URL],
      sourceLabel: 'CDN / fallback',
      onStatus: event => {
        setRuntimeState({
          status: event.status,
          label: event.label,
          version: event.version,
          source: event.src,
          activeUrl: event.activeUrl,
          sourceLabel: event.sourceLabel,
          verified: event.verified,
          attempt: event.attempt,
          progress: event.progress,
          error: event.message,
        });
        if (event.activeUrl === SQLJS_SCRIPT_FALLBACK_URL) {
          sqlJsWasmBaseUrlRef.current = SQLJS_WASM_FALLBACK_BASE_URL;
        }
      },
    })
      .then(() => initDatabase())
      .catch(() => {
        setError('加载 SQLite WebAssembly 库失败，请检查网络连接。');
        setIsLoading(false);
      });
  }, [initDatabase]);

  useEffect(() => {
    loadSqlRuntime();
  }, [loadSqlRuntime]);

  const handleExecute = () => {
    if (!db) return;
    try {
      const started = performance.now();
      const res = db.exec(sql);
      setQueryTime(performance.now() - started);
      setQueryHistory(history => [sql, ...history.filter(item => item !== sql)].slice(0, 6));
      setQueryError('');
      setQueryResult(res);
      refreshSchema(db);
    } catch (err) {
      setQueryError((err as Error).message);
      setQueryResult(null);
    }
  };

  const handleExport = () => {
    if (!db) return;
    try {
      const binaryArray = db.export();
      const blob = new Blob([binaryArray], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'sandbox.sqlite';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      notifyToast({ title: '导出数据库失败', description: (err as Error).message, tone: 'error' });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        setIsLoading(true);
        const initSqlJs = getSqlJsInitializer();
        if (!initSqlJs) throw new Error('SQL.js 初始化器未加载');
        const SQL = await initSqlJs({
          locateFile: (file: string) => `${sqlJsWasmBaseUrlRef.current}/${file}`
        });
        const uInt8Array = new Uint8Array(reader.result as ArrayBuffer);
        const newDb = new SQL.Database(uInt8Array);
        setDb(newDb);
        setDatabaseName(file.name);
        setQueryError('');
        setQueryResult(null);
        refreshSchema(newDb);
        setIsLoading(false);
      } catch (err) {
        notifyToast({ title: '加载 SQLite 文件失败', description: (err as Error).message, tone: 'error' });
        setIsLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const loadPresetQuery = (presetSql: string) => {
    setSql(presetSql);
  };

  return (
    <Card className="flex h-full flex-col">
      <CardContent className="grid min-h-0 flex-1 gap-4 overflow-auto lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="lg:col-span-2">
          <ContentToolbar status={`${databaseName} · ${tables.length} 张表`}>
            <input type="file" accept=".sqlite,.db,.sqlite3" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
            <Button size="sm" variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={() => fileInputRef.current?.click()}>导入数据库</Button>
            <Button size="sm" variant="secondary" icon={<Download className="h-4 w-4" />} onClick={handleExport} disabled={!db}>导出数据库</Button>
          </ContentToolbar>
        </div>
        <div className="lg:col-span-2">
          <RuntimeAssetStatusPanel state={runtimeState} onRetry={loadSqlRuntime} compact />
        </div>
        {/* Left column: Schema Browser & Boilerplates */}
        <div className="flex flex-col gap-4 lg:border-r border-slate-200 dark:border-slate-800 lg:pr-4 overflow-auto">
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              <span>数据表 Schema ({tables.length})</span>
            </h4>
            {tables.length === 0 ? (
              <div className="text-xs text-slate-400 italic">暂无自定义表</div>
            ) : (
              <div className="space-y-3">
                {tables.map(t => (
                  <div key={t.name} className="tool-panel p-2.5 rounded-lg text-xs">
                    <button type="button" className="mb-2 flex w-full items-center justify-between gap-2 text-left font-mono font-semibold text-primary-700" onClick={() => loadPresetQuery(`SELECT * FROM "${t.name.replace(/"/g, '""')}" LIMIT 100;`)}><span>{t.name}</span><span className="text-[10px]">查看数据 →</span></button>
                    <div className="space-y-1 font-mono text-[10px] text-slate-500">
                      {t.columns.map(c => (
                        <div key={c.name} className="flex justify-between">
                          <span>{c.name}</span>
                          <span className="text-primary-600 font-semibold">{c.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <details className="border-t border-slate-200 pt-3">
            <summary className="mb-2 cursor-pointer text-xs font-semibold text-slate-500">快速测试 SQL</summary>
            <div className="space-y-2">
              <button
                onClick={() => loadPresetQuery("SELECT * FROM users;")}
                className="w-full text-left text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-primary-400 transition-all font-mono"
              >
                查询用户表 (SELECT)
              </button>
              <button
                onClick={() =>
                  loadPresetQuery(
                    `SELECT u.name, COUNT(l.id) AS log_count\nFROM users u\nLEFT JOIN logs l ON l.user_id = u.id\nGROUP BY u.id;`
                  )
                }
                className="w-full text-left text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-primary-400 transition-all font-mono"
              >
                多表关联聚合 (JOIN)
              </button>
              <button
                onClick={() =>
                  loadPresetQuery(
                    `INSERT INTO users (name, email, role) VALUES ('Dave Brown', 'dave@dev.com', 'Manager');\nSELECT * FROM users;`
                  )
                }
                className="w-full text-left text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-primary-400 transition-all font-mono"
              >
                写入新记录 (INSERT)
              </button>
            </div>
          </details>
        </div>

        {/* Right column: Terminal & Output */}
        <div className="flex flex-col gap-4 min-h-0 flex-1 overflow-hidden">
          {isLoading && (
            <div className="p-3 bg-blue-50 text-blue-700 rounded-xl text-xs flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
              <span>正在动态载入 WebAssembly SQL.js 引擎，请稍候...</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs">
              {error}
            </div>
          )}

          {queryHistory.length > 0 && <details className="tool-panel p-3"><summary className="cursor-pointer text-xs font-medium">最近执行 · {queryHistory.length}</summary><div className="mt-2 space-y-2">{queryHistory.map((query, index) => <button key={index} type="button" className="block w-full truncate rounded border p-2 text-left font-mono text-xs text-slate-500 hover:border-primary-300" onClick={() => loadPresetQuery(query)}>{query}</button>)}</div></details>}
          {/* Terminal input */}
          <div className="flex flex-col min-h-0 flex-1 gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <FieldLabel hint="⌘ / Ctrl + Enter">SQL 查询终端</FieldLabel>
              <Button size="sm" variant="ghost" onClick={() => { setSql(''); setQueryResult(null); setQueryError(''); setQueryTime(null); }}>清空查询</Button>
              <Button
                size="sm"
                onClick={handleExecute}
                disabled={!db || isLoading || !sql.trim()}
                icon={<Play className="w-4 h-4" />}
              >
                执行 SQL (Ctrl+Enter)
              </Button>
            </div>
            <textarea
              aria-label="SQL 查询终端"
              placeholder="输入 SQL，按 ⌘ / Ctrl + Enter 执行。"
              className="w-full min-h-44 resize-y p-3 font-mono text-xs bg-slate-950 text-emerald-400 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
              value={sql}
              onChange={e => setSql(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleExecute();
                }
              }}
            />
          </div>

          {/* Query Results / Terminal output */}
          <div className="flex-[1.5] min-h-0 flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2"><FieldLabel>运行结果</FieldLabel>{queryResult && <span className="text-xs text-slate-500" aria-live="polite">{queryResult.reduce((count, result) => count + result.values.length, 0)} 行 · {queryTime === null ? '就绪' : `${queryTime.toFixed(1)} ms`}</span>}</div>
            
            {queryError && (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl text-rose-800 dark:text-rose-400 text-xs font-mono">
                🔴 SQL 语法或执行错误: {queryError}
              </div>
            )}

            {!queryError && !queryResult && (
              <div className="flex-1 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center text-xs text-slate-400">
                等待 SQL 查询运行...
              </div>
            )}

            {!queryError && queryResult && queryResult.length === 0 && (
              <div className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/10 flex items-center justify-center text-xs text-slate-500">
                语句成功执行，影响了数据但没有结果集返回。
              </div>
            )}

            {!queryError && queryResult && queryResult.length > 0 && (
              <div className="flex-1 overflow-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950 shadow-inner">
                {queryResult.map((resultBlock, blockIdx) => (
                  <table key={blockIdx} className="min-w-full border-collapse text-left text-xs font-mono">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-850">
                        {resultBlock.columns.map((col: string, colIdx: number) => (
                          <th key={colIdx} className="px-4 py-2 text-slate-600 dark:text-slate-400 font-bold border-r border-slate-200 dark:border-slate-800 last:border-r-0">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {resultBlock.values.map((row, rowIdx) => (
                        <tr key={rowIdx} className="border-b border-slate-100 dark:border-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 last:border-b-0">
                          {row.map((val, valIdx) => (
                            <td key={valIdx} className="px-4 py-2 text-slate-800 dark:text-slate-200 border-r border-slate-100 dark:border-slate-900 last:border-r-0 break-all">
                              {val === null ? <em className="text-slate-400">NULL</em> : String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// --- Binary Hex Viewer & Magic-Number File Analyzer ---

export const BinaryHexViewerTool: React.FC = () => {
  const [fileData, setFileData] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [magicMime, setMagicMime] = useState('');
  const [magicName, setMagicName] = useState('');
  const [safetyStatus, setSafetyStatus] = useState<'safe' | 'alert' | 'unknown'>('unknown');
  
  const loadScratchpadContent = async (content: string | Blob | ArrayBuffer, name: string) => {
    let uint8: Uint8Array;
    if (content instanceof Blob) {
      const buffer = await content.arrayBuffer();
      uint8 = new Uint8Array(buffer);
    } else if (content instanceof ArrayBuffer) {
      uint8 = new Uint8Array(content);
    } else if (typeof content === 'string') {
      if (content.startsWith('data:')) {
        const base64 = content.split(',')[1];
        const binaryString = atob(base64);
        uint8 = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          uint8[i] = binaryString.charCodeAt(i);
        }
      } else {
        uint8 = new TextEncoder().encode(content);
      }
    } else {
      return;
    }

    setFileName(name);
    setFileSize(uint8.length);
    setSelectedIdx(null);
    setCurrentPage(0);
    setFileData(uint8);
    detectMagicHeader(uint8, name);
  };
  
  // Grid Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 512; // 32 rows of 16 bytes each
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // High-frequency Search matching
  const [searchQuery, setSearchQuery] = useState('');
  const [offsetInput, setOffsetInput] = useState('');
  const [offsetError, setOffsetError] = useState('');
  const [matches, setMatches] = useState<Set<number>>(new Set());

  // Handle local file uploads
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      notifyToast({ title: '文件过大', description: '为了浏览器本地运行流畅，当前限制文件大小最高为 10MB。', tone: 'error' });
      return;
    }

    setFileName(file.name);
    setFileSize(file.size);
    setSelectedIdx(null);
    setCurrentPage(0);

    const reader = new FileReader();
    reader.onload = (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer;
      const uint8 = new Uint8Array(arrayBuffer);
      setFileData(uint8);
      
      // Compute magic header
      detectMagicHeader(uint8, file.name);
    };
    reader.readAsArrayBuffer(file);
  };

  const detectMagicHeader = (bytes: Uint8Array, name: string) => {
    if (bytes.length < 3) {
      setMagicMime('未知');
      setMagicName('微小文件 / 无签名特征');
      setSafetyStatus('unknown');
      return;
    }

    // Extract first 4 bytes as Hex representation
    const hexArr = Array.from(bytes.slice(0, 4)).map(b => b.toString(16).padStart(2, '0').toUpperCase());
    const signature4 = hexArr.join(' ');
    const signature3 = hexArr.slice(0, 3).join(' ');

    let mime = '';
    let label = '';
    let status: 'safe' | 'alert' | 'unknown' = 'safe';

    if (signature4.startsWith('89 50 4E 47')) {
      mime = 'image/png';
      label = 'PNG 图像格式';
    } else if (signature3.startsWith('FF D8 FF')) {
      mime = 'image/jpeg';
      label = 'JPEG/JPG 图像格式';
    } else if (signature4.startsWith('47 49 46 38')) {
      mime = 'image/gif';
      label = 'GIF 动图格式';
    } else if (signature4.startsWith('25 50 44 46')) {
      mime = 'application/pdf';
      label = 'PDF 文档数据';
    } else if (signature4.startsWith('50 4B 03 04')) {
      mime = 'application/zip';
      label = 'ZIP 离线压缩包';
    } else if (signature4.startsWith('52 61 72 21')) {
      mime = 'application/x-rar-compressed';
      label = 'RAR 离线压缩包';
    } else if (signature4.startsWith('37 7A BC AF')) {
      mime = 'application/x-7z-compressed';
      label = '7Z 压缩分包';
    } else {
      mime = '';
      label = '通用/纯文本二进制数据流';
      status = 'unknown';
    }

    setMagicMime(mime || '未知 Mime');
    setMagicName(label);

    if (mime) {
      const ext = name.split('.').pop()?.toLowerCase();
      if (mime === 'image/png' && ext !== 'png') status = 'alert';
      else if (mime === 'image/jpeg' && ext !== 'jpg' && ext !== 'jpeg') status = 'alert';
      else if (mime === 'image/gif' && ext !== 'gif') status = 'alert';
      else if (mime === 'application/pdf' && ext !== 'pdf') status = 'alert';
      else if (mime === 'application/zip' && ext !== 'zip') status = 'alert';
      else if (mime === 'application/x-rar-compressed' && ext !== 'rar') status = 'alert';
      else if (mime === 'application/x-7z-compressed' && ext !== '7z') status = 'alert';
      else status = 'safe';
    }

    setSafetyStatus(status);
  };

  // Perform multi-match search highlighting
  useEffect(() => {
    if (!fileData || !searchQuery.trim()) {
      Promise.resolve().then(() => setMatches(new Set()));
      return;
    }

    const query = searchQuery.trim();
    const isHexSearch = /^[0-9a-fA-F\s]+$/.test(query) && query.replace(/\s/g, '').length % 2 === 0;
    const newMatches = new Set<number>();

    if (isHexSearch) {
      // Hex block match
      const cleanHex = query.replace(/\s/g, '').toUpperCase();
      const hexBytes: number[] = [];
      for (let i = 0; i < cleanHex.length; i += 2) {
        hexBytes.push(parseInt(cleanHex.substring(i, i + 2), 16));
      }

      // Scan file
      for (let idx = 0; idx <= fileData.length - hexBytes.length; idx++) {
        let isMatch = true;
        for (let j = 0; j < hexBytes.length; j++) {
          if (fileData[idx + j] !== hexBytes[j]) {
            isMatch = false;
            break;
          }
        }
        if (isMatch) {
          for (let j = 0; j < hexBytes.length; j++) {
            newMatches.add(idx + j);
          }
        }
      }
    } else {
      // Normal string match
      const charArr = Array.from(query).map(c => c.charCodeAt(0));
      for (let idx = 0; idx <= fileData.length - charArr.length; idx++) {
        let isMatch = true;
        for (let j = 0; j < charArr.length; j++) {
          if (fileData[idx + j] !== charArr[j]) {
            isMatch = false;
            break;
          }
        }
        if (isMatch) {
          for (let j = 0; j < charArr.length; j++) {
            newMatches.add(idx + j);
          }
        }
      }
    }

    Promise.resolve().then(() => setMatches(newMatches));
  }, [searchQuery, fileData]);

  // Derived Grid calculations
  const totalPages = fileData ? Math.max(1, Math.ceil(fileData.length / pageSize)) : 0;
  const currentChunk = useMemo(() => {
    if (!fileData) return new Uint8Array(0);
    const start = currentPage * pageSize;
    return fileData.slice(start, start + pageSize);
  }, [fileData, currentPage]);

  const rows: { offset: number; bytes: number[] }[] = [];
  for (let i = 0; i < currentChunk.length; i += 16) {
    const rowOffset = currentPage * pageSize + i;
    const rowBytes = Array.from(currentChunk.slice(i, i + 16));
    rows.push({ offset: rowOffset, bytes: rowBytes });
  }

  // File download helper
  const handleDownload = () => {
    if (!fileData) return;
    const blob = new Blob([fileData], { type: magicMime || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exported_${fileName || 'file.bin'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardContent className="flex-1 flex flex-col gap-4 overflow-auto min-h-0">
        
        <ContentToolbar onSample={() => processFile(new File([new TextEncoder().encode('Atelier · Binary workspace\n0123456789\nHello, world!')], 'sample.txt', { type: 'text/plain' }))} onClear={() => { setFileData(null); setFileName(''); setFileSize(0); setSelectedIdx(null); setSearchQuery(''); setOffsetInput(''); setOffsetError(''); }} status={fileData ? `${fileSize.toLocaleString()} 字节` : '本地解析 · 最大 10MB'} />
        {/* Top bar: Upload zone and details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start flex-none">
          <div onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) processFile(file); }} className="p-4 border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 rounded-2xl flex flex-col items-center justify-center gap-3">
            <Upload className="w-8 h-8 text-primary-500" />
            <div className="text-center">
              <span className="text-[11px] font-bold text-slate-500 block">拖放或选择二进制文件</span>
              <span className="text-[9px] text-slate-400 block mt-0.5">支持任意格式，最高 10MB</span>
            </div>
            <div className="flex flex-col gap-1.5 w-full items-center">
              <label className="relative cursor-pointer w-full">
                <input 
                  type="file" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
                <span className="bg-primary-600 hover:bg-primary-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-xl transition-all shadow-sm block text-center">
                  选取本地文件
                </span>
              </label>
              <ScratchpadPicker
                label="暂存箱文件"
                placeholder="📂 从暂存箱载入文件..."
                filter={item => isScratchpadBinaryLike(item) || item.type === 'text'}
                onLoad={(content, item) => loadScratchpadContent(content, item.name)}
              />
            </div>
          </div>

          {fileData ? (
            <div className="p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-2xl space-y-2 lg:col-span-2 text-xs">
              <div className="flex justify-between items-center border-b pb-2 border-slate-100 dark:border-slate-900">
                <span className="font-bold text-slate-700 dark:text-slate-300">当前文件:</span>
                <span className="font-mono text-slate-600 dark:text-slate-400 break-all pl-4 text-right">{fileName}</span>
              </div>
              <div className="flex justify-between border-b pb-2 border-slate-100 dark:border-slate-900">
                <span className="font-bold text-slate-700 dark:text-slate-300">文件大小:</span>
                <span className="font-mono text-slate-600 dark:text-slate-400">
                  {fileSize < 1024 ? `${fileSize} Bytes` : fileSize < 1024 * 1024 ? `${(fileSize / 1024).toFixed(2)} KB` : `${(fileSize / (1024 * 1024)).toFixed(2)} MB`}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2 border-slate-100 dark:border-slate-900">
                <span className="font-bold text-slate-700 dark:text-slate-300">底层签名类型 (魔数检测):</span>
                <span className="font-bold text-primary-500">{magicName}</span>
              </div>
              
              {/* Threat warning card */}
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 dark:text-slate-300">签名与后缀:</span>
                {safetyStatus === 'safe' ? (
                  <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                    签名与后缀一致
                  </span>
                ) : safetyStatus === 'alert' ? (
                  <span className="bg-rose-500/10 text-rose-500 border border-rose-500/20 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ">
                    <ShieldAlert className="w-3.5 h-3.5" /> 签名与后缀不一致
                  </span>
                ) : (
                  <span className="bg-slate-500/10 text-slate-400 border border-slate-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                    未分析后缀匹配度
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="lg:col-span-2 border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-900/20 flex flex-col items-center justify-center p-6 text-slate-400 text-xs gap-2">
              <Cpu className="w-8 h-8 stroke-1 animate-pulse" />
              <span>载入二进制文件后自动开展魔数头及十六进制比对</span>
            </div>
          )}
        </div>

        {fileData && (
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
              <label className="flex items-center gap-2 text-xs">跳转偏移<input aria-label="跳转偏移" className="w-32 rounded border px-2 py-1.5 font-mono" placeholder="0 或 0x100" value={offsetInput} onChange={event => { setOffsetInput(event.target.value); setOffsetError(''); }} /></label>
              <Button size="sm" variant="secondary" onClick={() => { const offset = Number(offsetInput); if (!offsetInput.trim() || !Number.isInteger(offset) || offset < 0 || offset >= fileData.length) { setOffsetError('偏移量超出文件范围。'); return; } setSelectedIdx(offset); setCurrentPage(Math.floor(offset / pageSize)); }}>跳转</Button>
              {matches.size > 0 && <Button size="sm" variant="secondary" onClick={() => { const indexes = Array.from(matches).sort((a, b) => a - b); const next = indexes.find(index => index > (selectedIdx ?? -1)) ?? indexes[0]; setSelectedIdx(next); setCurrentPage(Math.floor(next / pageSize)); }}>下一个匹配字节</Button>}
              {searchQuery && <span className="text-xs text-slate-500">{matches.size} 字节匹配</span>}
              {offsetError && <span role="alert" className="text-xs text-red-600">{offsetError}</span>}
            </div>
            {/* Search and Navigation Bar */}
            <div className="p-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-3 text-xs flex-none">
              <div className="relative w-full md:w-80">
                <input 
                  type="text"
                  aria-label="搜索文件字节"
                  placeholder="搜索 ASCII(如 PNG) 或 HEX(如 89 50)"
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-primary-500"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
              </div>

              {/* Pagination controls */}
              <div className="flex items-center gap-3">
                <button
                  disabled={currentPage === 0}
                  onClick={() => {
                    setCurrentPage(prev => Math.max(0, prev - 1));
                    setSelectedIdx(null);
                  }}
                  className="px-2.5 py-1 border rounded-lg bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-850 hover:bg-slate-50 disabled:opacity-40 text-[10px] font-bold"
                >
                  上一页
                </button>
                <span className="font-mono font-bold text-[10px] text-slate-500">
                  PAGE {currentPage + 1} / {totalPages} (字节范围: {currentPage * pageSize} - {Math.min(fileData.length, (currentPage + 1) * pageSize) - 1})
                </span>
                <button
                  disabled={currentPage === totalPages - 1}
                  onClick={() => {
                    setCurrentPage(prev => Math.min(totalPages - 1, prev + 1));
                    setSelectedIdx(null);
                  }}
                  className="px-2.5 py-1 border rounded-lg bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-850 hover:bg-slate-50 disabled:opacity-40 text-[10px] font-bold"
                >
                  下一页
                </button>
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={handleDownload} icon={<Download className="w-3.5 h-3.5" />}>
                  下载该文件
                </Button>
              </div>
            </div>

            {/* Main Hex Viewer Grid */}
            <div className="flex-1 flex gap-4 min-h-0 bg-slate-950 p-4 rounded-2xl overflow-auto border border-slate-900 scrollbar-thin">
              {/* Left pane: Hex Grid */}
              <div className="flex-1 min-w-[480px]">
                <table className="w-full border-collapse font-mono text-[11px] leading-relaxed">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-900 text-left">
                      <th className="py-1 font-bold text-center pr-3">OFFSET</th>
                      {Array.from({ length: 16 }).map((_, idx) => (
                        <th key={idx} className="py-1 font-bold text-center">
                          {idx.toString(16).toUpperCase().padStart(2, '0')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-slate-900/40">
                        {/* Offset label */}
                        <td className="text-slate-500 text-center pr-3 font-semibold select-none">
                          {row.offset.toString(16).padStart(8, '0').toUpperCase()}
                        </td>
                        
                        {/* 16 bytes values */}
                        {Array.from({ length: 16 }).map((_, byteIdx) => {
                          const byte = row.bytes[byteIdx];
                          const absoluteIdx = row.offset + byteIdx;
                          const hasByte = byte !== undefined;
                          const isMatch = matches.has(absoluteIdx);
                          const isSelected = selectedIdx === absoluteIdx;

                          return (
                            <td 
                              key={byteIdx}
                              onClick={() => {
                                if (hasByte) setSelectedIdx(absoluteIdx);
                              }}
                              className={`text-center py-1 cursor-pointer rounded-md font-semibold select-all transition-all ${
                                !hasByte ? 'opacity-0 pointer-events-none' : 
                                isSelected ? 'bg-primary-500 text-white font-bold scale-105 shadow' :
                                isMatch ? 'bg-rose-500/20 text-rose-400 font-bold border border-rose-500/40' :
                                'text-slate-300 hover:bg-slate-800'
                              }`}
                            >
                              {hasByte ? byte.toString(16).padStart(2, '0').toUpperCase() : ''}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Split Line */}
              <div className="w-[1px] bg-slate-900 self-stretch"></div>

              {/* Right pane: Printable ASCII translation */}
              <div className="w-56 font-mono text-[11px] leading-relaxed text-slate-400 flex flex-col justify-between">
                <div>
                  <div className="text-slate-500 border-b border-slate-900 pb-1 font-bold select-none mb-1 text-center">
                    PRINTABLE ASCII
                  </div>
                  {rows.map((row, rowIdx) => (
                    <div key={rowIdx} className="flex hover:bg-slate-900/40 py-1 font-semibold justify-center">
                      {Array.from({ length: 16 }).map((_, byteIdx) => {
                        const byte = row.bytes[byteIdx];
                        const absoluteIdx = row.offset + byteIdx;
                        const hasByte = byte !== undefined;
                        const isMatch = matches.has(absoluteIdx);
                        const isSelected = selectedIdx === absoluteIdx;

                        // Check printable character (ASCII 32 to 126)
                        const isPrintable = hasByte && byte >= 32 && byte <= 126;
                        const charStr = isPrintable ? String.fromCharCode(byte) : '.';

                        return (
                          <span 
                            key={byteIdx}
                            onClick={() => {
                              if (hasByte) setSelectedIdx(absoluteIdx);
                            }}
                            className={`w-3.5 text-center cursor-pointer transition-all ${
                              !hasByte ? 'opacity-0' :
                              isSelected ? 'text-primary-400 font-bold underline' :
                              isMatch ? 'text-rose-400 font-bold' :
                              isPrintable ? 'text-emerald-500 hover:text-emerald-400' : 'text-slate-600'
                            }`}
                          >
                            {charStr}
                          </span>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {selectedIdx !== null && fileData && (
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-850 space-y-1.5 animate-in fade-in duration-200 mt-4">
                    <span className="text-[10px] font-bold text-slate-500 block uppercase">选定字节明细</span>
                    <div className="grid grid-cols-2 text-[10px] gap-y-1">
                      <span className="text-slate-500">位置 (Index):</span>
                      <span className="text-slate-300 font-bold">{selectedIdx}</span>
                      <span className="text-slate-500">十六进制:</span>
                      <span className="text-primary-400 font-bold">0x{fileData[selectedIdx].toString(16).toUpperCase()}</span>
                      <span className="text-slate-500">二进制:</span>
                      <span className="text-slate-300 font-mono">{fileData[selectedIdx].toString(2).padStart(8, '0')}</span>
                      <span className="text-slate-500">十进制 (DEC):</span>
                      <span className="text-slate-300">{fileData[selectedIdx]}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
