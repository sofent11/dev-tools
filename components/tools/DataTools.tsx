import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Check, Copy, Minimize2, Wand2, Database, Play, Download, Upload, Terminal, Info, Search, ShieldAlert, FileArchive, Cpu } from 'lucide-react';
import { format as formatSql, supportedDialects } from 'sql-formatter';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { CodePanel, FieldLabel, Select, Textarea } from '../ui/ToolUi';

const useCopy = () => {
  const [copied, setCopied] = useState(false);
  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  return { copied, copy };
};

type DiffKind = 'same' | 'added' | 'removed' | 'changed';

interface DiffNode {
  key: string;
  path: string;
  kind: DiffKind;
  left?: unknown;
  right?: unknown;
  children?: DiffNode[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

const previewValue = (value: unknown) => {
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return String(value);
  return JSON.stringify(value);
};

const buildDiff = (left: unknown, right: unknown, key = 'root', path = 'root'): DiffNode => {
  if (stableStringify(left) === stableStringify(right)) {
    return { key, path, kind: 'same', left, right };
  }

  const bothArrays = Array.isArray(left) && Array.isArray(right);
  const bothObjects = isRecord(left) && isRecord(right);

  if (bothArrays || bothObjects) {
    const leftContainer = left as Record<string, unknown> | unknown[];
    const rightContainer = right as Record<string, unknown> | unknown[];
    const keys = Array.from(
      new Set([...Object.keys(leftContainer), ...Object.keys(rightContainer)]),
    ).sort((a, b) => {
      const aNum = Number(a);
      const bNum = Number(b);
      if (Number.isInteger(aNum) && Number.isInteger(bNum)) return aNum - bNum;
      return a.localeCompare(b);
    });

    const children = keys.map(childKey => {
      const hasLeft = Object.prototype.hasOwnProperty.call(leftContainer, childKey);
      const hasRight = Object.prototype.hasOwnProperty.call(rightContainer, childKey);
      const childPath = bothArrays ? `${path}[${childKey}]` : `${path}.${childKey}`;
      if (!hasLeft) return { key: childKey, path: childPath, kind: 'added' as const, right: rightContainer[childKey as keyof typeof rightContainer] };
      if (!hasRight) return { key: childKey, path: childPath, kind: 'removed' as const, left: leftContainer[childKey as keyof typeof leftContainer] };
      return buildDiff(
        leftContainer[childKey as keyof typeof leftContainer],
        rightContainer[childKey as keyof typeof rightContainer],
        childKey,
        childPath,
      );
    });

    return {
      key,
      path,
      kind: children.some(child => child.kind !== 'same') ? 'changed' : 'same',
      left,
      right,
      children,
    };
  }

  return { key, path, kind: 'changed', left, right };
};

const countDiffs = (node: DiffNode): Record<DiffKind, number> => {
  const counts: Record<DiffKind, number> = { same: 0, added: 0, removed: 0, changed: 0 };
  const visit = (item: DiffNode) => {
    counts[item.kind] += 1;
    item.children?.forEach(visit);
  };
  visit(node);
  return counts;
};

const parsePath = (path: string): (string | number)[] => {
  const segments = path.split('.');
  const result: (string | number)[] = [];
  const startIdx = segments[0] === 'root' ? 1 : 0;
  for (let i = startIdx; i < segments.length; i++) {
    const seg = segments[i];
    const matches = Array.from(seg.matchAll(/([^[]+)|\[(\d+)\]/g));
    for (const match of matches) {
      if (match[1]) {
        result.push(match[1]);
      } else if (match[2]) {
        result.push(parseInt(match[2], 10));
      }
    }
  }
  return result;
};

const setValueAtPath = (obj: any, path: (string | number)[], value: any): any => {
  if (path.length === 0) return value;
  const newObj = Array.isArray(obj) ? [...obj] : { ...obj };
  let curr = newObj;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = path[i];
    const nextSeg = path[i + 1];
    const isNextArray = typeof nextSeg === 'number';
    if (curr[seg] === undefined || curr[seg] === null) {
      curr[seg] = isNextArray ? [] : {};
    } else {
      curr[seg] = Array.isArray(curr[seg]) ? [...curr[seg]] : { ...curr[seg] };
    }
    curr = curr[seg];
  }
  const lastSeg = path[path.length - 1];
  curr[lastSeg] = value;
  return newObj;
};

const deleteValueAtPath = (obj: any, path: (string | number)[]): any => {
  if (path.length === 0) return obj;
  const newObj = Array.isArray(obj) ? [...obj] : { ...obj };
  let curr = newObj;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = path[i];
    if (curr[seg] === undefined || curr[seg] === null) return obj;
    curr[seg] = Array.isArray(curr[seg]) ? [...curr[seg]] : { ...curr[seg] };
    curr = curr[seg];
  }
  const lastSeg = path[path.length - 1];
  if (Array.isArray(curr)) {
    curr.splice(Number(lastSeg), 1);
  } else {
    delete curr[lastSeg];
  }
  return newObj;
};

interface JsonPatchOp {
  op: 'add' | 'remove' | 'replace';
  path: string;
  value?: any;
}

const generateJsonPatch = (node: DiffNode): JsonPatchOp[] => {
  const ops: JsonPatchOp[] = [];
  const visit = (n: DiffNode) => {
    if (n.kind === 'added') {
      ops.push({
        op: 'add',
        path: n.path.replace(/^root/, '').replace(/\./g, '/').replace(/\[(\d+)\]/g, '/$1'),
        value: n.right
      });
    } else if (n.kind === 'removed') {
      ops.push({
        op: 'remove',
        path: n.path.replace(/^root/, '').replace(/\./g, '/').replace(/\[(\d+)\]/g, '/$1')
      });
    } else if (n.kind === 'changed' && !n.children) {
      ops.push({
        op: 'replace',
        path: n.path.replace(/^root/, '').replace(/\./g, '/').replace(/\[(\d+)\]/g, '/$1'),
        value: n.right
      });
    }
    n.children?.forEach(visit);
  };
  visit(node);
  return ops;
};

interface JsonDiffContextProps {
  onMergeLeft: (node: DiffNode) => void;
  onMergeRight: (node: DiffNode) => void;
}
const JsonDiffContext = React.createContext<JsonDiffContextProps | null>(null);

const DiffTree: React.FC<{ node: DiffNode; depth?: number }> = ({ node, depth = 0 }) => {
  const [isOpen, setIsOpen] = useState(() => node.kind !== 'same');
  const context = React.useContext(JsonDiffContext);

  const color = {
    same: 'border-slate-200 bg-white text-slate-600',
    added: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    removed: 'border-red-200 bg-red-50 text-red-800',
    changed: 'border-amber-200 bg-amber-50 text-amber-900',
  }[node.kind];

  const hasChildren = node.children && node.children.length > 0;

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
            <span className="text-[11px] opacity-70 font-mono">{node.path}</span>
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
            <DiffTree key={child.path} node={child} depth={depth + 1} />
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
  const [left, setLeft] = useState(sampleLeft);
  const [right, setRight] = useState(sampleRight);
  const leftCopy = useCopy();
  const rightCopy = useCopy();
  const patchCopy = useCopy();

  const result = useMemo(() => {
    try {
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
      const rightJson = JSON.parse(right);
      const pathSegments = parsePath(node.path);

      let newLeft = leftJson;
      if (node.kind === 'added') {
        newLeft = setValueAtPath(leftJson, pathSegments, node.right);
      } else if (node.kind === 'removed') {
        newLeft = deleteValueAtPath(leftJson, pathSegments);
      } else if (node.kind === 'changed') {
        newLeft = setValueAtPath(leftJson, pathSegments, node.right);
      }

      setLeft(JSON.stringify(newLeft, null, 2));
    } catch (e) {
      alert('合并至左侧失败: ' + (e as Error).message);
    }
  }, [left, right]);

  const handleMergeRight = useCallback((node: DiffNode) => {
    try {
      const leftJson = JSON.parse(left);
      const rightJson = JSON.parse(right);
      const pathSegments = parsePath(node.path);

      let newRight = rightJson;
      if (node.kind === 'added') {
        newRight = deleteValueAtPath(rightJson, pathSegments);
      } else if (node.kind === 'removed') {
        newRight = setValueAtPath(rightJson, pathSegments, node.left);
      } else if (node.kind === 'changed') {
        newRight = setValueAtPath(rightJson, pathSegments, node.left);
      }

      setRight(JSON.stringify(newRight, null, 2));
    } catch (e) {
      alert('合并至右侧失败: ' + (e as Error).message);
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

  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="JSON 结构化对比" description="解析两段 JSON，忽略格式差异并按键值树展示增删改。支持点击节点实时双向合并及导出 RFC 6902 Patch 补丁。" />
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <div className="grid min-h-[16rem] gap-4 md:grid-cols-2">
          <div className="flex min-h-0 flex-col gap-2">
            <FieldLabel hint="Original">左侧 JSON</FieldLabel>
            <Textarea className="min-h-0 flex-1 font-mono text-xs" value={left} onChange={event => setLeft(event.target.value)} />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => result.leftJson && leftCopy.copy(JSON.stringify(result.leftJson, null, 2))}
              icon={leftCopy.copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            >
              复制格式化左侧
            </Button>
          </div>
          <div className="flex min-h-0 flex-col gap-2">
            <FieldLabel hint="Modified">右侧 JSON</FieldLabel>
            <Textarea className="min-h-0 flex-1 font-mono text-xs" value={right} onChange={event => setRight(event.target.value)} />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => result.rightJson && rightCopy.copy(JSON.stringify(result.rightJson, null, 2))}
              icon={rightCopy.copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            >
              复制格式化右侧
            </Button>
          </div>
        </div>

        {result.error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">JSON 解析失败：{result.error}</div>
        ) : (
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">新增 {result.counts?.added}</span>
            <span className="rounded-full bg-red-50 px-3 py-1 font-medium text-red-700">删除 {result.counts?.removed}</span>
            <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-700">修改 {Math.max((result.counts?.changed || 0) - 1, 0)}</span>
          </div>
        )}

        <JsonDiffContext.Provider value={contextValue}>
          <div className="tool-panel min-h-0 flex-1 overflow-auto p-3 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 overflow-auto border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-white dark:bg-slate-950">
              <h4 className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">结构化差异树状视图</h4>
              {result.diff ? <DiffTree node={result.diff} /> : <div className="text-sm text-slate-400">修正 JSON 后显示结构化差异。</div>}
            </div>
            <div className="overflow-auto border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-950 flex flex-col min-h-[200px]">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide">RFC 6902 JSON Patch 补丁</h4>
                <button
                  onClick={() => patchCopy.copy(jsonPatchText)}
                  className="text-[10px] px-1.5 py-0.5 rounded border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition-colors font-semibold"
                >
                  {patchCopy.copied ? '✓ 已复制' : '复制 Patch'}
                </button>
              </div>
              <pre className="flex-1 text-[10px] font-mono text-emerald-400 overflow-auto whitespace-pre-wrap select-all leading-relaxed">
                {jsonPatchText}
              </pre>
            </div>
          </div>
        </JsonDiffContext.Provider>
      </CardContent>
    </Card>
  );
};

const sampleSql = `select u.id,u.name,count(o.id) as orders from users u left join orders o on o.user_id=u.id where u.created_at>='2026-01-01' group by u.id,u.name order by orders desc`;

export const SqlFormatterTool: React.FC = () => {
  const [input, setInput] = useState(sampleSql);
  const [dialect, setDialect] = useState('sql');
  const [keywordCase, setKeywordCase] = useState<'preserve' | 'upper' | 'lower'>('upper');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const { copied, copy } = useCopy();

  const runFormat = () => {
    try {
      const formatted = formatSql(input, {
        language: dialect === 'sql' ? undefined : dialect,
        keywordCase,
      });
      setOutput(formatted);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const minify = () => {
    setOutput(input.replace(/\s+/g, ' ').trim());
    setError('');
  };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="SQL 格式化"
        description="本地格式化 SQL，支持常见数据库方言和关键字大小写。"
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={minify} icon={<Minimize2 className="h-4 w-4" />}>压缩</Button>
            <Button size="sm" onClick={runFormat} icon={<Wand2 className="h-4 w-4" />}>格式化</Button>
          </>
        }
      />
      <CardContent className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_18rem_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col gap-2">
          <FieldLabel>输入 SQL</FieldLabel>
          <Textarea className="min-h-0 flex-1 font-mono text-xs" value={input} onChange={event => setInput(event.target.value)} />
        </div>
        <div className="space-y-4">
          <div>
            <FieldLabel>数据库方言</FieldLabel>
            <Select value={dialect} onChange={event => setDialect(event.target.value)}>
              <option value="sql">Standard SQL</option>
              {supportedDialects.map(item => <option key={item} value={item}>{item}</option>)}
            </Select>
          </div>
          <div>
            <FieldLabel>关键字大小写</FieldLabel>
            <Select value={keywordCase} onChange={event => setKeywordCase(event.target.value as typeof keywordCase)}>
              <option value="upper">UPPER</option>
              <option value="lower">lower</option>
              <option value="preserve">Preserve</option>
            </Select>
          </div>
          {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <Button
            className="w-full"
            variant="secondary"
            disabled={!output}
            onClick={() => copy(output)}
            icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          >
            复制结果
          </Button>
        </div>
        <div className="flex min-h-0 flex-col gap-2">
          <FieldLabel>输出</FieldLabel>
          <CodePanel className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap text-xs">
            {output || '点击格式化生成结果'}
          </CodePanel>
        </div>
      </CardContent>
    </Card>
  );
};

// --- JSON Schema Generator & Local Validator ---
const generateSchema = (val: unknown): Record<string, any> => {
  if (val === null) return { type: 'null' };
  if (typeof val === 'string') return { type: 'string' };
  if (typeof val === 'number') return { type: Number.isInteger(val) ? 'integer' : 'number' };
  if (typeof val === 'boolean') return { type: 'boolean' };
  if (Array.isArray(val)) {
    const items = val.length > 0 ? generateSchema(val[0]) : {};
    return { type: 'array', items };
  }
  if (typeof val === 'object') {
    const properties: Record<string, any> = {};
    const required: string[] = [];
    const obj = val as Record<string, any>;
    for (const key of Object.keys(obj)) {
      properties[key] = generateSchema(obj[key]);
      required.push(key);
    }
    return { type: 'object', properties, required };
  }
  return {};
};

const validateJson = (schema: any, data: any, path = 'root'): string[] => {
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
      for (const key of Object.keys(props)) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          errors.push(...validateJson(props[key], data[key], `${path}.${key}`));
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
  const [jsonText, setJsonText] = useState(defaultJsonSample);
  const [schemaText, setSchemaText] = useState(defaultSchemaSample);
  
  const [validationOutput, setValidationOutput] = useState<{
    status: 'idle' | 'valid' | 'invalid';
    errors: string[];
  }>({ status: 'idle', errors: [] });

  const jsonCopy = useCopy();
  const schemaCopy = useCopy();

  const handleGenerateSchema = () => {
    try {
      const parsed = JSON.parse(jsonText);
      const schema = generateSchema(parsed);
      // Format generated schema nicely
      setSchemaText(JSON.stringify(schema, null, 2));
      setValidationOutput({ status: 'idle', errors: [] });
    } catch (err) {
      setSchemaText(`[JSON 解析失败: ${(err as Error).message}]`);
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

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="JSON Schema 智能验证与生成器"
        description="本地根据 JSON 载荷一键提取 draft-07 Schema；提供多维递归校验沙箱，实时捕获缺失字段与数据类型兼容异常。"
      />
      <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden min-h-0">
        
        {/* Dual Pane Editor */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
          
          {/* Left Pane: JSON Payload */}
          <div className="flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-1.5 text-xs">
              <FieldLabel>JSON 数据载荷 (JSON Payload)</FieldLabel>
              <button
                onClick={() => jsonCopy.copy(jsonText)}
                className="text-slate-400 hover:text-primary-600 transition-colors p-1"
                title="复制 JSON"
              >
                {jsonCopy.copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <textarea
              className="flex-1 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/20 font-mono text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary-500 resize-none leading-relaxed transition-all overflow-auto"
              value={jsonText}
              onChange={e => setJsonText(e.target.value)}
              placeholder="请输入需要验证或提取 Schema 的 JSON 数据..."
            />
            <div className="flex gap-2 mt-2">
              <Button size="sm" className="flex-1" onClick={handleGenerateSchema} icon={<Wand2 className="w-4 h-4" />}>
                一键生成 JSON Schema
              </Button>
            </div>
          </div>

          {/* Right Pane: JSON Schema */}
          <div className="flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-1.5 text-xs">
              <FieldLabel>JSON Schema 实体定义</FieldLabel>
              <button
                onClick={() => schemaCopy.copy(schemaText)}
                className="text-slate-400 hover:text-primary-600 transition-colors p-1"
                title="复制 Schema"
              >
                {schemaCopy.copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <textarea
              className="flex-1 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/20 font-mono text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary-500 resize-none leading-relaxed transition-all overflow-auto"
              value={schemaText}
              onChange={e => setSchemaText(e.target.value)}
              placeholder="请输入或由左侧生成的 JSON Schema 对象..."
            />
            <div className="flex gap-2 mt-2">
              <Button size="sm" className="flex-1" variant="secondary" onClick={handleValidate} icon={<Check className="w-4 h-4" />}>
                运行 Schema 本地校验
              </Button>
            </div>
          </div>

        </div>

        {/* Validation Output Status Panel */}
        <div className="flex-none">
          {validationOutput.status === 'valid' && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-ping" />
              <span>✓ 验证通过！JSON 载荷格式与类型完全符合 JSON Schema 定义。</span>
            </div>
          )}

          {validationOutput.status === 'invalid' && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl text-rose-800 dark:text-rose-300 text-xs font-medium space-y-1.5 leading-relaxed overflow-y-auto max-h-[140px]">
              <div className="font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                <span>✗ 验证失败！共捕获 {validationOutput.errors.length} 项格式异常：</span>
              </div>
              <ul className="list-disc pl-4 space-y-1 font-mono text-[11px]">
                {validationOutput.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  );
};

// ================= SQLite WebAssembly Sandbox =================
export const SqliteSandboxTool: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [db, setDb] = useState<any>(null);
  const [sql, setSql] = useState(
    `-- 这是一个 WebAssembly SQLite 离线沙箱。\n-- 您可以点击左下角载入测试表，也可以在这里输入并执行任意 SQL 查询。\nSELECT * FROM users;`
  );
  
  const [queryResult, setQueryResult] = useState<any>(null);
  const [queryError, setQueryError] = useState('');
  const [tables, setTables] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshSchema = (activeDb: any) => {
    if (!activeDb) return;
    try {
      const res = activeDb.exec("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
      if (res.length > 0) {
        const tablesList = res[0].values.map((row: any) => {
          const tableName = row[0];
          const createSql = row[1];
          let cols: { name: string; type: string }[] = [];
          try {
            const colRes = activeDb.exec(`PRAGMA table_info(${tableName})`);
            if (colRes.length > 0) {
              cols = colRes[0].values.map((c: any) => ({
                name: c[1],
                type: c[2]
              }));
            }
          } catch (e) { /* ignore */ }
          return { name: tableName, sql: createSql, columns: cols };
        });
        setTables(tablesList);
      } else {
        setTables([]);
      }
    } catch (e) {
      console.error('Failed to load schema', e);
    }
  };

  const initDatabase = async () => {
    try {
      setIsLoading(true);
      setError('');
      const initSqlJs = (window as any).initSqlJs;
      const SQL = await initSqlJs({
        locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
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
  };

  useEffect(() => {
    if ((window as any).initSqlJs) {
      Promise.resolve().then(() => initDatabase());
      return;
    }

    Promise.resolve().then(() => setIsLoading(true));
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js';
    script.async = true;
    script.onload = () => {
      Promise.resolve().then(() => initDatabase());
    };
    script.onerror = () => {
      Promise.resolve().then(() => {
        setError('加载 SQLite WebAssembly 库失败，请检查网络连接。');
        setIsLoading(false);
      });
    };
    document.body.appendChild(script);
  }, []);

  const handleExecute = () => {
    if (!db) return;
    try {
      const res = db.exec(sql);
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
      alert('导出数据库失败: ' + (err as Error).message);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        setIsLoading(true);
        const initSqlJs = (window as any).initSqlJs;
        const SQL = await initSqlJs({
          locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
        });
        const uInt8Array = new Uint8Array(reader.result as ArrayBuffer);
        const newDb = new SQL.Database(uInt8Array);
        setDb(newDb);
        setQueryError('');
        setQueryResult(null);
        refreshSchema(newDb);
        setIsLoading(false);
      } catch (err) {
        alert('加载 SQLite 文件失败: ' + (err as Error).message);
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
      <CardHeader
        title="SQLite WebAssembly 离线沙箱"
        description="基于 WASM 100% 本地运行的 SQLite 数据库，支持拖入已有 .db/.sqlite 文件，支持表结构 Schema 浏览及 SQL 语句终端运行。"
        actions={
          <div className="flex gap-2 items-center">
            <input
              type="file"
              accept=".sqlite,.db,.sqlite3"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              size="sm"
              variant="secondary"
              icon={<Upload className="w-4 h-4" />}
              onClick={() => fileInputRef.current?.click()}
            >
              导入 .sqlite 文件
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={<Download className="w-4 h-4" />}
              onClick={handleExport}
              disabled={!db}
            >
              导出数据库 (.sqlite)
            </Button>
          </div>
        }
      />
      <CardContent className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[18rem_minmax(0,1fr)]">
        {/* Left column: Schema Browser & Boilerplates */}
        <div className="flex flex-col gap-4 border-r border-slate-200 dark:border-slate-800 pr-4 overflow-auto max-h-full">
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
                    <strong className="text-slate-800 dark:text-slate-200 font-mono block mb-1">
                      {t.name}
                    </strong>
                    <div className="space-y-1 font-mono text-[10px] text-slate-500">
                      {t.columns.map((c: any) => (
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

          <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              快速测试 SQL
            </h4>
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
          </div>
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

          {/* Terminal input */}
          <div className="flex flex-col min-h-0 flex-1 gap-2">
            <div className="flex items-center justify-between">
              <FieldLabel hint="SQLite Terminal">SQL 查询终端</FieldLabel>
              <Button
                size="sm"
                onClick={handleExecute}
                disabled={!db || isLoading}
                icon={<Play className="w-4 h-4" />}
              >
                执行 SQL (Ctrl+Enter)
              </Button>
            </div>
            <textarea
              className="w-full h-44 p-3 font-mono text-xs bg-slate-950 text-emerald-400 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
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
            <FieldLabel>运行结果</FieldLabel>
            
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
                {queryResult.map((resultBlock: any, blockIdx: number) => (
                  <table key={blockIdx} className="w-full border-collapse text-left text-xs font-mono">
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
                      {resultBlock.values.map((row: any[], rowIdx: number) => (
                        <tr key={rowIdx} className="border-b border-slate-100 dark:border-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 last:border-b-0">
                          {row.map((val: any, valIdx: number) => (
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
  
  // Grid Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 512; // 32 rows of 16 bytes each
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // High-frequency Search matching
  const [searchQuery, setSearchQuery] = useState('');
  const [matches, setMatches] = useState<Set<number>>(new Set());

  // Handle local file uploads
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      alert('为了浏览器本地运行流畅，当前限制文件大小最高为 10MB 🚀');
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
  const totalPages = fileData ? Math.ceil(fileData.length / pageSize) : 0;
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
      <CardHeader 
        title="二进制十六进制查看器 (Binary Hex Viewer)" 
        description="本地离线读取并解析二进制文件结构，提供十六进制字节码、ASCII 可读字符格栅对照、全局特征字节搜索及魔数木马后门篡改预警。" 
      />
      <CardContent className="flex-1 flex flex-col gap-4 overflow-auto min-h-0">
        
        {/* Top bar: Upload zone and details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start flex-none">
          <div className="p-4 border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 rounded-2xl flex flex-col items-center justify-center gap-3">
            <Upload className="w-8 h-8 text-primary-500 animate-pulse" />
            <div className="text-center">
              <span className="text-[11px] font-bold text-slate-500 block">拖放或选择二进制文件</span>
              <span className="text-[9px] text-slate-400 block mt-0.5">支持任意格式，最高 10MB</span>
            </div>
            <label className="relative cursor-pointer">
              <input 
                type="file" 
                onChange={handleFileUpload} 
                className="hidden" 
              />
              <span className="bg-primary-600 hover:bg-primary-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-xl transition-all shadow-sm block text-center">
                选取本地文件
              </span>
            </label>
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
                <span className="font-bold text-slate-700 dark:text-slate-300">安全风险诊断:</span>
                {safetyStatus === 'safe' ? (
                  <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                    后缀契合 🟢 安全
                  </span>
                ) : safetyStatus === 'alert' ? (
                  <span className="bg-rose-500/10 text-rose-500 border border-rose-500/20 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 animate-bounce">
                    <ShieldAlert className="w-3.5 h-3.5" /> 隐写篡改风险 ⚠️ 
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
            {/* Search and Navigation Bar */}
            <div className="p-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-3 text-xs flex-none">
              <div className="relative w-full md:w-80">
                <input 
                  type="text"
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

