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
  const color = {
    same: 'border-slate-200 bg-white text-slate-700',
    added: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    removed: 'border-red-200 bg-red-50 text-red-800',
    changed: 'border-amber-200 bg-amber-50 text-amber-900',
  }[node.kind];

  return (
    <div className="space-y-1">
      <div className={`rounded-lg border px-3 py-2 text-sm ${color}`} style={{ marginLeft: depth ? Math.min(depth * 16, 96) : 0 }}>
        <div className="flex flex-wrap items-center gap-2">
          <code className="font-semibold">{node.key}</code>
          <span className="rounded border border-current/20 px-1.5 py-0.5 text-[11px] uppercase">{node.kind}</span>
          <span className="text-xs opacity-70">{node.path}</span>
        </div>
        {!node.children && (
          <div className="mt-1 grid gap-1 font-mono text-xs md:grid-cols-2">
            <div className="break-all">L: {previewValue(node.left)}</div>
            <div className="break-all">R: {previewValue(node.right)}</div>
          </div>
        )}
      </div>
      {node.children?.map(child => <DiffTree key={child.path} node={child} depth={depth + 1} />)}
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
