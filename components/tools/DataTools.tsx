import { findByteHighlights } from './encoding/binarySearchCore';
import { translateUi as tr, useLocaleRender } from '../../src/i18n/render';
import { assertJsonBudget, collapseSqlWhitespace } from './text/contentCore';
import { useCopyToClipboard } from './shared/useCopyToClipboard';
import { useDraftState } from './shared/useDraftState';
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Check, Minimize2, Wand2, Database, Play, Download, Upload, Search, ShieldAlert, Cpu } from 'lucide-react';
import { runWorkerTask } from './shared/workerTask';
import type { SqliteResult } from './data/sqliteEngine';
import { ScratchpadPicker, isScratchpadBinaryLike } from './shared/ScratchpadControls';
import { notifyToast } from './shared/notifyToast';
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
} from './data/jsonDiffCore';

export { buildDiff, generateJsonPatch, toJsonPointer } from './data/jsonDiffCore';

type SqlExecResult = SqliteResult['results'][number];

interface JsonDiffContextProps {
  onMergeLeft: (node: DiffNode) => void;
  onMergeRight: (node: DiffNode) => void;
}
const JsonDiffContext = React.createContext<JsonDiffContextProps | null>(null);

const DiffTree: React.FC<{ node: DiffNode; depth?: number; hideSame?: boolean }> = ({ node, depth = 0, hideSame = false }) => {
  useLocaleRender();
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
                  title={tr("将此差异项合并到左侧")}
                >{tr("← 合并至左")}</button>
                <button
                  onClick={() => context.onMergeRight(node)}
                  className="px-1.5 py-0.5 rounded border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors text-[9px] font-bold"
                  title={tr("将此差异项合并到右侧")}
                >{tr("合并至右 →")}</button>
              </div>
            )}
            {hasChildren && !isOpen && (
              <span className="text-xs text-slate-400 font-medium">
                ({node.children!.length}{tr("个属性已折叠)")}</span>
            )}
          </div>
        </div>
        {!node.children && (
          <div className="mt-1.5 grid gap-1.5 font-mono text-xs md:grid-cols-2 border-t border-slate-100/60 pt-1.5">
            <div className="break-all opacity-85"><span className="font-semibold text-rose-600 mr-1">{tr("左:")}</span> {previewValue(node.left)}</div>
            <div className="break-all"><span className="font-semibold text-emerald-600 mr-1">{tr("右:")}</span> {previewValue(node.right)}</div>
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
  useLocaleRender();
  const [left, setLeft] = useDraftState('components/tools/DataTools.tsx:JsonDiffTool:left', '');
  const [right, setRight] = useDraftState('components/tools/DataTools.tsx:JsonDiffTool:right', '');
  const [hideSame, setHideSame] = useState(true);
  const [beforeMerge, setBeforeMerge] = useState<{ left: string; right: string } | null>(null);
  const patchCopy = useCopyToClipboard();

  const result = useMemo(() => {
    try {
      if (!left.trim() || !right.trim()) return { diff: null, counts: null, leftJson: null, rightJson: null, error: '' };
      if (left.length + right.length > 2_000_000) throw new Error('JSON diff input limit: 2 MB');
      const leftJson = JSON.parse(left);
      const rightJson = JSON.parse(right);
      assertJsonBudget(leftJson); assertJsonBudget(rightJson);
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
  }, [left, right, setLeft]);

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
  }, [left, right, setRight]);

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
      <Button size="sm" variant="secondary" onClick={() => { setLeft(right); setRight(left); setBeforeMerge(null); }} disabled={!left && !right}>{tr("交换左右")}</Button>
      <Button size="sm" variant="ghost" disabled={!beforeMerge} onClick={() => { if (beforeMerge) { setLeft(beforeMerge.left); setRight(beforeMerge.right); setBeforeMerge(null); } }}>{tr("撤销上次合并")}</Button>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={hideSame} onChange={event => setHideSame(event.target.checked)} />{tr("仅显示差异")}</label>
    </ContentToolbar>
    <div className="grid gap-4 lg:grid-cols-2"><ContentEditor label={tr("原始 JSON · 左侧")} value={left} onChange={value => { setLeft(value); setBeforeMerge(null); }} placeholder={tr("粘贴原始 JSON，键顺序和空白不影响比较。")} /><ContentEditor label={tr("修改 JSON · 右侧")} value={right} onChange={value => { setRight(value); setBeforeMerge(null); }} placeholder={tr("粘贴修改后的 JSON。")} /></div>
    {result.error && <p role="alert" className="status-error p-3 text-sm">{tr("JSON 解析失败：")}{result.error}</p>}
    <div className="tool-panel space-y-3 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{tr("结构化差异")}</h3>{result.diff && <span className="text-xs text-slate-500">{generateJsonPatch(result.diff).length}{tr("处变更")}</span>}</div><JsonDiffContext.Provider value={contextValue}>{result.diff ? result.diff.kind === 'same' && hideSame ? <p className="py-8 text-center text-sm text-primary-700">{tr("两个 JSON 内容相同。")}</p> : <DiffTree node={result.diff} hideSame={hideSame} /> : <p className="py-8 text-center text-sm text-slate-400">{tr("载入两份 JSON 后查看差异；每个节点可合并到任一侧。")}</p>}</JsonDiffContext.Provider></div>
    <details className="tool-panel p-4"><summary className="cursor-pointer text-sm font-medium">{tr("导出 JSON Patch · 左侧 → 右侧")}</summary><div className="mt-3 flex justify-end"><Button size="sm" variant="secondary" disabled={!result.diff} onClick={() => patchCopy.copy(jsonPatchText)}>{patchCopy.copied ? tr('已复制') : tr('复制 Patch')}</Button></div><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs">{result.diff ? jsonPatchText : '先载入有效的 JSON'}</pre></details>
  </CardContent></Card>;
};

const sampleSql = `select u.id,u.name,count(o.id) as orders from users u left join orders o on o.user_id=u.id where u.created_at>='2026-01-01' group by u.id,u.name order by orders desc`;

export const SqlFormatterTool: React.FC = () => {
  useLocaleRender();
  const [input, setInput] = useDraftState('components/tools/DataTools.tsx:SqlFormatterTool:input', sampleSql);
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
    try { setOutput(collapseSqlWhitespace(input, dialect === 'mysql' || dialect === 'mariadb')); setError(''); }
    catch (error) { setOutput(''); setError((error as Error).message); }
  };

  const updateInput = (value: string) => { setInput(value); setOutput(''); setError(''); };
  return <Card className="flex h-full min-h-0 flex-col"><CardContent className="min-h-0 flex-1 space-y-4 overflow-auto">
    <ContentToolbar onSample={() => updateInput(sampleSql)} onClear={() => updateInput('')}><Button onClick={runFormat} disabled={!input.trim()} icon={<Wand2 className="h-4 w-4" />}>{tr("格式化")}</Button><Button variant="secondary" onClick={minify} disabled={!input.trim()} icon={<Minimize2 className="h-4 w-4" />}>{tr("压缩")}</Button><span className="text-xs text-slate-500">{dialect === 'sql' ? 'Standard SQL' : dialect}</span></ContentToolbar>
    <ContentOptions title={tr("数据库方言与格式选项")}><label className="flex flex-col gap-2 text-sm">{tr("数据库方言")}<Select value={dialect} onChange={event => { setDialect(event.target.value as SqlLanguage | 'sql'); setOutput(''); }}><option value="sql">Standard SQL</option>{supportedDialects.map(item => <option key={item} value={item}>{item}</option>)}</Select></label><label className="flex flex-col gap-2 text-sm">{tr("关键字大小写")}<Select value={keywordCase} onChange={event => { setKeywordCase(event.target.value as typeof keywordCase); setOutput(''); }}><option value="upper">UPPER</option><option value="lower">lower</option><option value="preserve">Preserve</option></Select></label></ContentOptions>
    <div className="grid gap-4 lg:grid-cols-2"><ContentEditor label={tr("输入 SQL")} value={input} onChange={updateInput} error={error} placeholder={tr("粘贴 SQL，选择数据库方言后格式化。")} /><ContentEditor label={tr("SQL 输出")} value={output} output placeholder={tr("格式化结果保留原始 SQL，便于核对。")} onUseResult={() => updateInput(output)} /></div>
  </CardContent></Card>;
};

// --- JSON Schema Generator & Local Validator ---
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
  useLocaleRender();
  const [jsonText, setJsonText] = useDraftState('components/tools/DataTools.tsx:JsonSchemaTool:jsonText', '');
  const [schemaText, setSchemaText] = useDraftState('components/tools/DataTools.tsx:JsonSchemaTool:schemaText', '');
  const [generationError, setGenerationError] = useState('');
  
  const [validationOutput, setValidationOutput] = useState<{
    status: 'idle' | 'valid' | 'invalid';
    errors: string[];
  }>({ status: 'idle', errors: [] });


  const schemaTask = useRef<AbortController | null>(null);
  const [schemaBusy, setSchemaBusy] = useState(false);
  useEffect(() => () => schemaTask.current?.abort(), []);
  const resetStatus = () => {
    schemaTask.current?.abort();
    schemaTask.current = null;
    setSchemaBusy(false);
    setValidationOutput({ status: 'idle', errors: [] });
    setGenerationError('');
  };
  const runSchema = async (action: 'generate' | 'validate') => {
    schemaTask.current?.abort();
    const controller = new AbortController();
    schemaTask.current = controller;
    setSchemaBusy(true);
    setGenerationError('');
    setValidationOutput({ status: 'idle', errors: [] });
    try {
      const result = await runWorkerTask<Record<string, unknown> | string[]>(
        new Worker(new URL('./data/schema.worker.ts', import.meta.url), { type: 'module' }),
        { action, json: jsonText, schema: schemaText }, { signal: controller.signal, timeoutMs: 2500 });
      if (controller.signal.aborted || schemaTask.current !== controller) return;
      if (action === 'generate') setSchemaText(JSON.stringify(result, null, 2));
      else {
        const errors = result as string[];
        setValidationOutput({ status: errors.length ? 'invalid' : 'valid', errors });
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        if (action === 'generate') setGenerationError((error as Error).message);
        else setValidationOutput({ status: 'invalid', errors: [(error as Error).message] });
      }
    } finally { if (schemaTask.current === controller) setSchemaBusy(false); }
  };
  const handleGenerateSchema = () => { void runSchema('generate'); };
  const handleValidate = () => { void runSchema('validate'); };
  return <Card className="flex h-full min-h-0 flex-col"><CardContent className="min-h-0 flex-1 space-y-4 overflow-auto">
    <ContentToolbar onSample={() => { setJsonText(defaultJsonSample); setSchemaText(defaultSchemaSample); resetStatus(); }} onClear={() => { setJsonText(''); setSchemaText(''); resetStatus(); }}><Button onClick={handleGenerateSchema} disabled={schemaBusy || !jsonText.trim()} icon={<Wand2 className="h-4 w-4" />}>{tr("从样例生成 Schema")}</Button><Button variant="secondary" onClick={handleValidate} disabled={schemaBusy || !jsonText.trim() || !schemaText.trim()} icon={<Check className="h-4 w-4" />}>{tr("校验数据")}</Button>{schemaBusy && <Button variant="ghost" onClick={resetStatus}>{tr("取消任务")}</Button>}</ContentToolbar>
    <div className="grid gap-4 lg:grid-cols-2"><ContentEditor label={tr("JSON 数据")} value={jsonText} onChange={value => { setJsonText(value); resetStatus(); }} error={generationError} placeholder={tr("输入 JSON 样例生成 Schema，或配合已有 Schema 进行校验。")} /><ContentEditor label={tr("Schema 定义")} value={schemaText} onChange={value => { setSchemaText(value); resetStatus(); }} output placeholder={tr("从左侧样例生成，或粘贴已有 Schema。")} /></div>
    <section className="tool-panel p-4" aria-live="polite">{schemaBusy ? <p className="text-sm text-slate-500">{tr("正在处理 Schema，修改输入会取消当前任务…")}</p> : validationOutput.status === 'idle' ? <p className="text-sm text-slate-500">{tr("生成 Schema 后可以编辑规则，再运行校验。")}</p> : validationOutput.status === 'valid' ? <p className="text-sm font-medium text-emerald-700">{tr("支持的规则检查通过。")}</p> : <div role="alert"><p className="mb-2 text-sm font-semibold text-red-700">{validationOutput.errors.length}{tr("项校验问题")}</p><ul className="max-h-52 list-disc space-y-1 overflow-auto pl-5 font-mono text-xs text-red-700">{validationOutput.errors.map((error, index) => <li key={index}>{error}</li>)}</ul></div>}</section>
    <details className="text-xs text-slate-500"><summary className="cursor-pointer">{tr("本地校验支持范围")}</summary><p className="mt-2 leading-5">{tr("使用 AJV 校验 draft-07 Schema，包含格式、数值范围、枚举与组合规则。不支持的关键字会报错；混合数组按全部样例推断。输入上限 2 MB，单次任务最多 2.5 秒。")}</p></details>
  </CardContent></Card>;
};

// ================= SQLite WebAssembly Sandbox =================
export const SqliteSandboxTool: React.FC = () => {
  useLocaleRender();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [db, setDb] = useState<Uint8Array | null>(null);
  const [sql, setSql] = useDraftState('components/tools/DataTools.tsx:SqliteSandboxTool:sql', 'SELECT * FROM users;');
  const [queryResult, setQueryResult] = useState<SqlExecResult[] | null>(null);
  const [queryError, setQueryError] = useState('');
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const [queryTime, setQueryTime] = useState<number | null>(null);
  const [databaseName, setDatabaseName] = useState('演示数据库');
  const [tables, setTables] = useState<SqliteResult['tables']>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const taskRef = useRef<AbortController | null>(null);
  const fileReadVersion = useRef(0);
  const execute = useCallback(async (snapshot?: Uint8Array, query?: string, nextName?: string) => {
    taskRef.current?.abort();
    const controller = new AbortController();
    taskRef.current = controller;
    const started = performance.now();
    setIsLoading(true);
    setQueryError('');
    setError('');
    try {
      const result = await runWorkerTask<SqliteResult>(
        new Worker(new URL('./data/sqlite.worker.ts', import.meta.url), { type: 'module' }),
        { snapshot, sql: query }, { signal: controller.signal, timeoutMs: 10000 });
      if (controller.signal.aborted) return;
      setDb(result.snapshot);
      setQueryResult(result.results);
      setTables(result.tables);
      setQueryTime(performance.now() - started);
      if (nextName) setDatabaseName(nextName);
      if (query) setQueryHistory(history => [query, ...history.filter(item => item !== query)].slice(0, 6));
    } catch (error) {
      if (!controller.signal.aborted) setQueryError((error as Error).message);
    } finally { if (taskRef.current === controller) setIsLoading(false); }
  }, []);
  useEffect(() => {
    const reads = fileReadVersion;
    const timer = setTimeout(() => { void execute(undefined, 'SELECT * FROM users;'); }, 0);
    return () => { clearTimeout(timer); taskRef.current?.abort(); reads.current++; };
  }, [execute]);
  const handleExecute = () => { if (db && !isLoading && sql.trim()) void execute(db, sql); };
  const handleExport = () => {
    if (!db || isLoading) return;
    const url = URL.createObjectURL(new Blob([new Uint8Array(db)], { type: 'application/x-sqlite3' }));
    const link = document.createElement('a');
    link.href = url; link.download = databaseName === '演示数据库' ? 'sandbox.sqlite' : databaseName; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    if (file.size > 64 * 1024 * 1024) { setError('数据库大小上限为 64 MB。'); return; }
    const version = ++fileReadVersion.current;
    taskRef.current?.abort();
    taskRef.current = null;
    setIsLoading(true);
    setError('');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (version === fileReadVersion.current) await execute(bytes, undefined, file.name);
    } catch (error) {
      if (version === fileReadVersion.current) { setError((error as Error).message); setIsLoading(false); }
    }
  };
  const cancelTask = () => {
    fileReadVersion.current++;
    taskRef.current?.abort();
    setIsLoading(false);
    setQueryError('任务已取消；上次完成的数据库已保留。');
  };
  const loadPresetQuery = (presetSql: string) => { setSql(presetSql); };
  return (
    <Card className="flex h-full flex-col">
      <CardContent className="grid min-h-0 flex-1 gap-4 overflow-auto lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="lg:col-span-2">
          <ContentToolbar status={<><span data-i18n-skip>{databaseName === '演示数据库' ? tr('演示数据库') : databaseName}</span> · {tables.length} {tr('张表')}</>}>
            <input type="file" accept=".sqlite,.db,.sqlite3" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
            <Button size="sm" variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={() => fileInputRef.current?.click()}>{tr("导入数据库")}</Button>
            <Button size="sm" variant="secondary" icon={<Download className="h-4 w-4" />} onClick={handleExport} disabled={!db || isLoading}>{tr("导出数据库")}</Button>
          {isLoading ? <Button size="sm" variant="ghost" onClick={cancelTask}>{tr("取消任务")}</Button> : <Button size="sm" variant="ghost" onClick={() => { fileReadVersion.current++; void execute(undefined, 'SELECT * FROM users;', '演示数据库'); }}>{tr("载入演示库")}</Button>}
          </ContentToolbar>
          <p className="mt-3 text-xs leading-5 text-slate-500">{tr("本地 SQLite Worker：任务最多 10 秒，数据库最多 64 MB，结果最多 1,000 行 / 2 MB。失败或取消会保留上次完成的数据库。")}</p>
        </div>
        {/* Left column: Schema Browser & Boilerplates */}
        <div className="flex flex-col gap-4 lg:border-r border-slate-200 dark:border-slate-800 lg:pr-4 overflow-auto">
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              <span>{tr("数据表 Schema (")}{tables.length})</span>
            </h4>
            {tables.length === 0 ? (
              <div className="text-xs text-slate-400 italic">{tr("暂无自定义表")}</div>
            ) : (
              <div className="space-y-3">
                {tables.map(t => (
                  <div key={t.name} className="tool-panel p-2.5 rounded-lg text-xs">
                    <button type="button" className="mb-2 flex w-full items-center justify-between gap-2 text-left font-mono font-semibold text-primary-700" onClick={() => loadPresetQuery(`SELECT * FROM "${t.name.replace(/"/g, '""')}" LIMIT 100;`)}><span>{t.name}</span><span className="text-[10px]">{tr("查看数据 →")}</span></button>
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
            <summary className="mb-2 cursor-pointer text-xs font-semibold text-slate-500">{tr("快速测试 SQL")}</summary>
            <div className="space-y-2">
              <button
                onClick={() => loadPresetQuery("SELECT * FROM users;")}
                className="w-full text-left text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-primary-400 transition-all font-mono"
              >{tr("查询用户表 (SELECT)")}</button>
              <button
                onClick={() =>
                  loadPresetQuery(
                    `SELECT u.name, COUNT(l.id) AS log_count\nFROM users u\nLEFT JOIN logs l ON l.user_id = u.id\nGROUP BY u.id;`
                  )
                }
                className="w-full text-left text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-primary-400 transition-all font-mono"
              >{tr("多表关联聚合 (JOIN)")}</button>
              <button
                onClick={() =>
                  loadPresetQuery(
                    `INSERT INTO users (name, email, role) VALUES ('Dave Brown', 'dave@dev.com', 'Manager');\nSELECT * FROM users;`
                  )
                }
                className="w-full text-left text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-primary-400 transition-all font-mono"
              >{tr("写入新记录 (INSERT)")}</button>
            </div>
          </details>
        </div>

        {/* Right column: Terminal & Output */}
        <div className="flex flex-col gap-4 min-h-0 flex-1 overflow-hidden">
          {isLoading && (
            <div className="p-3 bg-blue-50 text-blue-700 rounded-xl text-xs flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
              <span>{tr("正在本地执行 SQLite 任务…")}</span>
            </div>
          )}

          {error && (
            <div role="alert" className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs">
              {error}
            </div>
          )}

          {queryHistory.length > 0 && <details className="tool-panel p-3"><summary className="cursor-pointer text-xs font-medium">{tr("最近执行 ·")}{queryHistory.length}</summary><div className="mt-2 space-y-2">{queryHistory.map((query, index) => <button key={index} type="button" className="block w-full truncate rounded border p-2 text-left font-mono text-xs text-slate-500 hover:border-primary-300" onClick={() => loadPresetQuery(query)}>{query}</button>)}</div></details>}
          {/* Terminal input */}
          <div className="flex flex-col min-h-0 flex-1 gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <FieldLabel hint="⌘ / Ctrl + Enter">{tr("SQL 查询终端")}</FieldLabel>
              <Button size="sm" variant="ghost" onClick={() => { setSql(''); setQueryResult(null); setQueryError(''); setQueryTime(null); }}>{tr("清空查询")}</Button>
              <Button
                size="sm"
                onClick={handleExecute}
                disabled={!db || isLoading || !sql.trim()}
                icon={<Play className="w-4 h-4" />}
              >{tr("执行 SQL (Ctrl+Enter)")}</Button>
            </div>
            <textarea
              aria-label={tr("SQL 查询终端")}
              placeholder={tr("输入 SQL，按 ⌘ / Ctrl + Enter 执行。")}
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
            <div className="flex flex-wrap items-center justify-between gap-2"><FieldLabel>{tr("运行结果")}</FieldLabel>{queryResult && <span className="text-xs text-slate-500" aria-live="polite">{queryResult.reduce((count, result) => count + result.values.length, 0)}{tr("行 ·")}{queryTime === null ? tr('就绪') : `${queryTime.toFixed(1)} ms`}</span>}</div>
            
            {queryError && (
              <div role="alert" className="p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl text-rose-800 dark:text-rose-400 text-xs font-mono">{tr("🔴 SQL 语法或执行错误:")}{queryError}
              </div>
            )}

            {!queryError && !queryResult && (
              <div className="flex-1 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center text-xs text-slate-400">{tr("等待 SQL 查询运行...")}</div>
            )}

            {!queryError && queryResult && queryResult.length === 0 && (
              <div className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/10 flex items-center justify-center text-xs text-slate-500">{tr("语句成功执行，影响了数据但没有结果集返回。")}</div>
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
  useLocaleRender();
  const fileReader = useRef<FileReader | null>(null);
  const loadVersion = useRef(0);
  useEffect(() => { const version = loadVersion; return () => { version.current++; fileReader.current?.abort(); }; }, []);
  const [fileData, setFileData] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [magicMime, setMagicMime] = useState('');
  const [magicName, setMagicName] = useState('');
  const [safetyStatus, setSafetyStatus] = useState<'safe' | 'alert' | 'unknown'>('unknown');
  
  const loadScratchpadContent = async (content: string | Blob | ArrayBuffer, name: string) => {
    const version = ++loadVersion.current;
    fileReader.current?.abort();
    const size = typeof content === 'string' ? content.length : content instanceof Blob ? content.size : content.byteLength;
    if (size > 10 * 1024 * 1024) throw new Error('Binary file limit: 10 MB');
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

    if (version !== loadVersion.current) return;
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

    const version = ++loadVersion.current;
    fileReader.current?.abort();
    const reader = new FileReader();
    fileReader.current = reader;
    reader.onload = () => {
      if (version !== loadVersion.current || !(reader.result instanceof ArrayBuffer)) return;
      const uint8 = new Uint8Array(reader.result);
      setFileName(file.name); setFileSize(uint8.length); setSelectedIdx(null); setCurrentPage(0);
      setFileData(uint8); detectMagicHeader(uint8, file.name);
    };
    reader.onerror = () => { if (version === loadVersion.current) notifyToast({ title: '文件读取失败', description: reader.error?.message, tone: 'error' }); };
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

    const newMatches = findByteHighlights(fileData, searchQuery);
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
        
        <ContentToolbar onSample={() => processFile(new File([new TextEncoder().encode('Atelier · Binary workspace\n0123456789\nHello, world!')], 'sample.txt', { type: 'text/plain' }))} onClear={() => { loadVersion.current++; fileReader.current?.abort(); setFileData(null); setFileName(''); setFileSize(0); setSelectedIdx(null); setSearchQuery(''); setOffsetInput(''); setOffsetError(''); }} status={fileData ? `${fileSize.toLocaleString()} 字节` : '本地解析 · 最大 10MB'} />
        {/* Top bar: Upload zone and details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start flex-none">
          <div onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) processFile(file); }} className="p-4 border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 rounded-2xl flex flex-col items-center justify-center gap-3">
            <Upload className="w-8 h-8 text-primary-500" />
            <div className="text-center">
              <span className="text-[11px] font-bold text-slate-500 block">{tr("拖放或选择二进制文件")}</span>
              <span className="text-[9px] text-slate-400 block mt-0.5">{tr("支持任意格式，最高 10MB")}</span>
            </div>
            <div className="flex flex-col gap-1.5 w-full items-center">
              <label className="relative cursor-pointer w-full">
                <input 
                  type="file" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
                <span className="bg-primary-600 hover:bg-primary-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-xl transition-all shadow-sm block text-center">{tr("选取本地文件")}</span>
              </label>
              <ScratchpadPicker
                label={tr("暂存箱文件")}
                placeholder={tr("📂 从暂存箱载入文件...")}
                filter={item => isScratchpadBinaryLike(item) || item.type === 'text'}
                onLoad={(content, item) => loadScratchpadContent(content, item.name)}
              />
            </div>
          </div>

          {fileData ? (
            <div className="p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-2xl space-y-2 lg:col-span-2 text-xs">
              <div className="flex justify-between items-center border-b pb-2 border-slate-100 dark:border-slate-900">
                <span className="font-bold text-slate-700 dark:text-slate-300">{tr("当前文件:")}</span>
                <span className="font-mono text-slate-600 dark:text-slate-400 break-all pl-4 text-right">{fileName}</span>
              </div>
              <div className="flex justify-between border-b pb-2 border-slate-100 dark:border-slate-900">
                <span className="font-bold text-slate-700 dark:text-slate-300">{tr("文件大小:")}</span>
                <span className="font-mono text-slate-600 dark:text-slate-400">
                  {fileSize < 1024 ? `${fileSize} Bytes` : fileSize < 1024 * 1024 ? `${(fileSize / 1024).toFixed(2)} KB` : `${(fileSize / (1024 * 1024)).toFixed(2)} MB`}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2 border-slate-100 dark:border-slate-900">
                <span className="font-bold text-slate-700 dark:text-slate-300">{tr("底层签名类型 (魔数检测):")}</span>
                <span className="font-bold text-primary-500">{tr(magicName)}</span>
              </div>
              
              {/* Threat warning card */}
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 dark:text-slate-300">{tr("签名与后缀:")}</span>
                {safetyStatus === 'safe' ? (
                  <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold">{tr("签名与后缀一致")}</span>
                ) : safetyStatus === 'alert' ? (
                  <span className="bg-rose-500/10 text-rose-500 border border-rose-500/20 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ">
                    <ShieldAlert className="w-3.5 h-3.5" />{tr("签名与后缀不一致")}</span>
                ) : (
                  <span className="bg-slate-500/10 text-slate-400 border border-slate-500/20 px-2 py-0.5 rounded text-[10px] font-bold">{tr("未分析后缀匹配度")}</span>
                )}
              </div>
            </div>
          ) : (
            <div className="lg:col-span-2 border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-900/20 flex flex-col items-center justify-center p-6 text-slate-400 text-xs gap-2">
              <Cpu className="w-8 h-8 stroke-1 animate-pulse" />
              <span>{tr("载入二进制文件后自动开展魔数头及十六进制比对")}</span>
            </div>
          )}
        </div>

        {fileData && (
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
              <label className="flex items-center gap-2 text-xs">{tr("跳转偏移")}<input aria-label={tr("跳转偏移")} className="w-32 rounded border px-2 py-1.5 font-mono" placeholder={tr("0 或 0x100")} value={offsetInput} onChange={event => { setOffsetInput(event.target.value); setOffsetError(''); }} /></label>
              <Button size="sm" variant="secondary" onClick={() => { const offset = Number(offsetInput); if (!offsetInput.trim() || !Number.isInteger(offset) || offset < 0 || offset >= fileData.length) { setOffsetError('偏移量超出文件范围。'); return; } setSelectedIdx(offset); setCurrentPage(Math.floor(offset / pageSize)); }}>{tr("跳转")}</Button>
              {matches.size > 0 && <Button size="sm" variant="secondary" onClick={() => { const indexes = Array.from(matches).sort((a, b) => a - b); const next = indexes.find(index => index > (selectedIdx ?? -1)) ?? indexes[0]; setSelectedIdx(next); setCurrentPage(Math.floor(next / pageSize)); }}>{tr("下一个匹配字节")}</Button>}
              {searchQuery && <span className="text-xs text-slate-500">{matches.size}{tr("高亮字节 · 最多 5,000")}</span>}
              {offsetError && <span role="alert" className="text-xs text-red-600">{tr(offsetError)}</span>}
            </div>
            {/* Search and Navigation Bar */}
            <div className="p-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-3 text-xs flex-none">
              <div className="relative w-full md:w-80">
                <input 
                  type="text"
                  aria-label={tr("搜索文件字节")} maxLength={1024}
                  placeholder={tr("UTF-8 文本或 HEX；text: 强制文本")}
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
                >{tr("上一页")}</button>
                <span className="font-mono font-bold text-[10px] text-slate-500">
                  PAGE {currentPage + 1} / {totalPages}{tr("(字节范围:")}{currentPage * pageSize} - {Math.min(fileData.length, (currentPage + 1) * pageSize) - 1})
                </span>
                <button
                  disabled={currentPage === totalPages - 1}
                  onClick={() => {
                    setCurrentPage(prev => Math.min(totalPages - 1, prev + 1));
                    setSelectedIdx(null);
                  }}
                  className="px-2.5 py-1 border rounded-lg bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-850 hover:bg-slate-50 disabled:opacity-40 text-[10px] font-bold"
                >{tr("下一页")}</button>
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={handleDownload} icon={<Download className="w-3.5 h-3.5" />}>{tr("下载该文件")}</Button>
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
                    <span className="text-[10px] font-bold text-slate-500 block uppercase">{tr("选定字节明细")}</span>
                    <div className="grid grid-cols-2 text-[10px] gap-y-1">
                      <span className="text-slate-500">{tr("位置 (Index):")}</span>
                      <span className="text-slate-300 font-bold">{selectedIdx}</span>
                      <span className="text-slate-500">{tr("十六进制:")}</span>
                      <span className="text-primary-400 font-bold">0x{fileData[selectedIdx].toString(16).toUpperCase()}</span>
                      <span className="text-slate-500">{tr("二进制:")}</span>
                      <span className="text-slate-300 font-mono">{fileData[selectedIdx].toString(2).padStart(8, '0')}</span>
                      <span className="text-slate-500">{tr("十进制 (DEC):")}</span>
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
