import React, { useEffect, useMemo, useState } from 'react';
import { Clock, Copy } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { FieldLabel, Input, Select } from '../../ui/ToolUi';
import { useCopyToClipboard } from '../shared/useCopyToClipboard';

const zones = [
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'Australia/Sydney',
  'UTC',
];

const formatInZone = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }).format(date);

export const WorldClockTool: React.FC = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader title="世界时间" description="使用浏览器 Intl API 显示常用时区时间。" />
      <CardContent className="grid flex-1 content-start gap-3 overflow-auto sm:grid-cols-2 xl:grid-cols-3">
        {zones.map(zone => (
          <div key={zone} className="tool-panel p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Clock className="h-4 w-4 text-primary-600" />
              {zone}
            </div>
            <div className="font-mono text-lg text-slate-950">{formatInZone(now, zone)}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export const TimestampPlusTool: React.FC = () => {
  const [timestamp, setTimestamp] = useState(() => Date.now().toString());
  const [unit, setUnit] = useState<'ms' | 's'>('ms');
  const [zone, setZone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai');
  const { copied, copy } = useCopyToClipboard();

  const parsed = useMemo(() => {
    const numeric = Number(timestamp);
    if (!Number.isFinite(numeric)) return null;
    return new Date(unit === 's' ? numeric * 1000 : numeric);
  }, [timestamp, unit]);

  const output = parsed && !Number.isNaN(parsed.getTime()) ? {
    local: parsed.toLocaleString(),
    zoned: formatInZone(parsed, zone),
    seconds: Math.floor(parsed.getTime() / 1000).toString(),
    milliseconds: parsed.getTime().toString(),
    iso: parsed.toISOString(),
  } : null;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader title="时间戳增强转换" description="支持秒/毫秒、ISO 与指定时区显示。" />
      <CardContent className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-5">
        <div className="grid gap-3 md:grid-cols-[1fr_8rem_14rem]">
          <div>
            <FieldLabel>时间戳</FieldLabel>
            <Input value={timestamp} onChange={event => setTimestamp(event.target.value)} />
          </div>
          <div>
            <FieldLabel>单位</FieldLabel>
            <Select value={unit} onChange={event => setUnit(event.target.value as 'ms' | 's')}>
              <option value="ms">毫秒</option>
              <option value="s">秒</option>
            </Select>
          </div>
          <div>
            <FieldLabel>时区</FieldLabel>
            <Input value={zone} onChange={event => setZone(event.target.value)} />
          </div>
        </div>
        {output ? (
          <div className="grid gap-3 md:grid-cols-2">
            {Object.entries(output).map(([label, value]) => (
              <div key={label} className="tool-panel p-4">
                <div className="mb-1 text-xs font-semibold uppercase text-slate-500">{label}</div>
                <div className="break-all font-mono text-sm text-slate-900">{value}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="status-error p-3 text-sm">请输入有效数字时间戳。</div>
        )}
        <Button className="self-start" icon={<Copy className="h-4 w-4" />} onClick={() => output && copy(JSON.stringify(output, null, 2))}>
          {copied ? '已复制' : '复制全部'}
        </Button>
      </CardContent>
    </Card>
  );
};
