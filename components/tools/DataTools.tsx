import React, { useMemo, useState } from 'react';
import { Check, Copy, Minimize2, Wand2 } from 'lucide-react';
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

const DiffTree: React.FC<{ node: DiffNode; depth?: number }> = ({ node, depth = 0 }) => {
  const [isOpen, setIsOpen] = useState(() => node.kind !== 'same');

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
          {hasChildren && !isOpen && (
            <span className="text-xs text-slate-400 font-medium">
              ({node.children!.length} 个属性已折叠)
            </span>
          )}
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

  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="JSON 结构化对比" description="解析两段 JSON，忽略格式差异并按键值树展示增删改。" />
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

        <div className="tool-panel min-h-0 flex-1 overflow-auto p-3">
          {result.diff ? <DiffTree node={result.diff} /> : <div className="text-sm text-slate-400">修正 JSON 后显示结构化差异。</div>}
        </div>
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

