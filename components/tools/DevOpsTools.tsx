import React, { useMemo, useState } from 'react';
import { Check, Copy, RefreshCw } from 'lucide-react';
import { CronExpressionParser } from 'cron-parser';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { CodePanel, FieldLabel, Input, Select } from '../ui/ToolUi';

interface PermissionGroupProps {
    label: string;
    role: 'owner' | 'group' | 'public';
    permissions: {
        owner: { read: boolean; write: boolean; execute: boolean; };
        group: { read: boolean; write: boolean; execute: boolean; };
        public: { read: boolean; write: boolean; execute: boolean; };
    };
    toggle: (role: 'owner' | 'group' | 'public', perm: 'read' | 'write' | 'execute') => void;
}

const PermissionGroup: React.FC<PermissionGroupProps> = ({ label, role, permissions, toggle }) => (
    <div className="tool-panel flex flex-col gap-3 p-4">
        <span className="font-semibold text-slate-700">{label}</span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={permissions[role].read} onChange={() => toggle(role, 'read')} className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500" />
                <span className="text-sm">读取 (4)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={permissions[role].write} onChange={() => toggle(role, 'write')} className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500" />
                <span className="text-sm">写入 (2)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={permissions[role].execute} onChange={() => toggle(role, 'execute')} className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500" />
                <span className="text-sm">执行 (1)</span>
            </label>
        </div>
    </div>
);

export const ChmodTool: React.FC = () => {
  const [permissions, setPermissions] = useState({
    owner: { read: true, write: true, execute: false }, // 6
    group: { read: true, write: false, execute: false }, // 4
    public: { read: true, write: false, execute: false }, // 4
  });

  const { octal, symbolic } = useMemo(() => {
    const calcDigit = (p: typeof permissions.owner) => (p.read ? 4 : 0) + (p.write ? 2 : 0) + (p.execute ? 1 : 0);
    const o = calcDigit(permissions.owner);
    const g = calcDigit(permissions.group);
    const p = calcDigit(permissions.public);

    const sym = (p: typeof permissions.owner) =>
        (p.read ? 'r' : '-') + (p.write ? 'w' : '-') + (p.execute ? 'x' : '-');

    return {
      octal: `${o}${g}${p}`,
      symbolic: `-${sym(permissions.owner)}${sym(permissions.group)}${sym(permissions.public)}`,
    };
  }, [permissions]);

  const { copied, copy } = useCopy();
  const applyPreset = (value: string) => {
    const digit = (index: number) => { const n = Number(value[index]); return { read: !!(n & 4), write: !!(n & 2), execute: !!(n & 1) }; };
    setPermissions({ owner: digit(0), group: digit(1), public: digit(2) });
  };
  const toggle = (role: 'owner' | 'group' | 'public', perm: 'read' | 'write' | 'execute') => {
      setPermissions(prev => ({
          ...prev,
          [role]: { ...prev[role], [perm]: !prev[role][perm] }
      }));
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader title="Chmod 计算器" description="Linux 文件权限计算 (Octal & Symbolic)。" />
      <CardContent className="flex-1 overflow-auto space-y-5">
        <div className="flex flex-wrap gap-2">
          {[['644', '普通文件'], ['755', '可执行文件'], ['600', '私有文件'], ['700', '私有目录']].map(([value,label]) => <Button key={value} size="sm" variant={octal === value ? 'primary' : 'secondary'} onClick={() => applyPreset(value)}>{label} · {value}</Button>)}
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">设置访问权限</h3>
            <PermissionGroup label="所有者" role="owner" permissions={permissions} toggle={toggle} />
            <PermissionGroup label="用户组" role="group" permissions={permissions} toggle={toggle} />
            <PermissionGroup label="其他用户" role="public" permissions={permissions} toggle={toggle} />
          </section>
          <section className="tool-panel p-5 space-y-5 self-start lg:sticky lg:top-0">
            <div><span className="text-xs text-slate-500">八进制权限</span><p className="text-6xl font-mono font-semibold text-primary-700 mt-2">{octal}</p></div>
            <div><span className="text-xs text-slate-500">符号权限</span><p className="font-mono text-xl mt-1">{symbolic}</p></div>
            <CodePanel>chmod {octal} filename</CodePanel>
            <Button className="w-full" onClick={() => copy(`chmod ${octal} filename`)} icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>复制命令</Button>
          </section>
        </div>
      </CardContent>
    </Card>
  );
};

const cronOptions = {
  minute: ['*', '*/5', '*/10', '*/15', '*/30', '0'],
  hour: ['*', '*/2', '*/4', '*/6', '9-18', '0'],
  day: ['*', '1', '*/2', '1,15'],
  month: ['*', '1', '1,4,7,10'],
  weekday: ['*', '1-5', '0,6', '1'],
};

const useCopy = () => {
  const [copied, setCopied] = useState(false);
  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  return { copied, copy };
};

export const CronTool: React.FC = () => {
  const [fields, setFields] = useState({
    minute: '*/15',
    hour: '*',
    day: '*',
    month: '*',
    weekday: '1-5',
  });
  const [expression, setExpression] = useState('*/15 * * * 1-5');
  const { copied, copy } = useCopy();

  const generatedExpression = `${fields.minute} ${fields.hour} ${fields.day} ${fields.month} ${fields.weekday}`;

  const preview = useMemo(() => {
    try {
      const interval = CronExpressionParser.parse(expression.trim());
      return {
        dates: Array.from({ length: 5 }, () => interval.next().toDate()),
        error: '',
      };
    } catch (error) {
      return { dates: [], error: (error as Error).message };
    }
  }, [expression]);

  const updateField = (key: keyof typeof fields, value: string) => {
    const next = { ...fields, [key]: value };
    setFields(next);
    setExpression(`${next.minute} ${next.hour} ${next.day} ${next.month} ${next.weekday}`);
  };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Cron 表达式"
        description="生成 5 字段 Unix Cron，反向解析并预览未来 5 次执行时间。"
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={() => setExpression(generatedExpression)} icon={<RefreshCw className="h-4 w-4" />}>使用表单值</Button>
            <Button size="sm" variant="secondary" onClick={() => copy(expression)} icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>复制</Button>
          </>
        }
      />
      <CardContent className="grid min-h-0 flex-1 gap-5 overflow-auto lg:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="tool-panel p-4 space-y-4">
          <h3 className="text-sm font-semibold">逐项构建</h3>
          {([
            ['minute', '分钟'],
            ['hour', '小时'],
            ['day', '日期'],
            ['month', '月份'],
            ['weekday', '星期'],
          ] as const).map(([key, label]) => (
            <div key={key}>
              <FieldLabel>{label}</FieldLabel>
              <Select value={fields[key]} onChange={event => updateField(key, event.target.value)}>
                {cronOptions[key].map(item => <option key={item} value={item}>{item}</option>)}
              </Select>
            </div>
          ))}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">表单生成</div>
            <code className="mt-1 block break-all text-sm font-semibold text-slate-900">{generatedExpression}</code>
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {[['每分钟', '* * * * *'], ['每小时', '0 * * * *'], ['每天 09:00', '0 9 * * *'], ['工作日 09:00', '0 9 * * 1-5']].map(([label,value]) => <Button key={value} size="sm" variant={expression === value ? 'primary' : 'secondary'} onClick={() => setExpression(value)}>{label}</Button>)}
          </div>
          <div>
            <FieldLabel hint="minute hour day month weekday">Cron 表达式</FieldLabel>
            <Input aria-invalid={!!preview.error} className="font-mono" value={expression} onChange={event => setExpression(event.target.value)} />
          </div>
          {preview.error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{preview.error}</div>
          ) : (
            <div className="space-y-3"><div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500"><span>未来 5 次执行</span><span>{Intl.DateTimeFormat().resolvedOptions().timeZone}</span></div><CodePanel className="space-y-2">
              {preview.dates.map((date, index) => (
                <div key={date.toISOString()} className="flex items-center justify-between gap-3 border-b border-slate-700/40 pb-2 last:border-0 last:pb-0">
                  <span className="text-slate-400">#{index + 1}</span>
                  <span>{date.toLocaleString()}</span>
                </div>
              ))}
            </CodePanel></div>
          )}
          <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-3">
            <div className="tool-panel p-3"><code>*</code><span className="ml-2">每个单位</span></div>
            <div className="tool-panel p-3"><code>*/15</code><span className="ml-2">每 15 个单位</span></div>
            <div className="tool-panel p-3"><code>1-5</code><span className="ml-2">范围</span></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
