import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Copy,
  Check,
  Calculator,
  Compass,
  ListOrdered
} from 'lucide-react';
import { CronExpressionParser } from 'cron-parser';
import { Card, CardContent, CardHeader } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { FieldLabel, Input, Select } from '../../ui/ToolUi';

const WORLD_ZONES = [
  { id: 'Asia/Shanghai', name: '上海 (Asia/Shanghai)', flag: '🇨🇳' },
  { id: 'Asia/Tokyo', name: '东京 (Asia/Tokyo)', flag: '🇯🇵' },
  { id: 'Asia/Singapore', name: '新加坡 (Asia/Singapore)', flag: '🇸🇬' },
  { id: 'Europe/London', name: '伦敦 (Europe/London)', flag: '🇬🇧' },
  { id: 'Europe/Berlin', name: '柏林 (Europe/Berlin)', flag: '🇩🇪' },
  { id: 'America/New_York', name: '纽约 (America/New_York)', flag: '🇺🇸' },
  { id: 'America/Los_Angeles', name: '洛杉矶 (America/Los_Angeles)', flag: '🇺🇸' },
  { id: 'Australia/Sydney', name: '悉尼 (Australia/Sydney)', flag: '🇦🇺' },
  { id: 'UTC', name: '协调世界时 (UTC)', flag: '🌐' },
];

const formatInZone = (date: Date, timeZone: string) => {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
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
  } catch {
    return date.toLocaleString();
  }
};

const getDayOfWeekCN = (date: Date): string => {
  const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return days[date.getDay()];
};

export const UnixTimeStudio: React.FC = () => {
  const [tickerNow, setTickerNow] = useState(() => new Date());

  // Conversion States
  const [timestampInput, setTimestampInput] = useState(() => Math.floor(Date.now() / 1000).toString());
  const [unit, setUnit] = useState<'ms' | 's'>('s');
  const [targetZone, setTargetZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai');
  
  const [dateStrInput, setDateStrInput] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  });

  // Date Diff States
  const [diffStart, setDiffStart] = useState(() => new Date().toISOString().slice(0, 16));
  const [diffEnd, setDiffEnd] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 16);
  });

  // Cron Predictor States
  const [cronExpression, setCronExpression] = useState('*/15 * * * 1-5');

  // Copy status maps
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

  const handleCopy = useCallback((text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedStates(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setCopiedStates(prev => ({ ...prev, [key]: false }));
    }, 1500);
  }, []);

  // Update ticks
  useEffect(() => {
    const timer = setInterval(() => setTickerNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Convert Timestamp -> Date Time Info
  const timestampConversionOutput = useMemo(() => {
    const numeric = Number(timestampInput.trim());
    if (!Number.isFinite(numeric) || timestampInput.trim() === '') {
      return null;
    }
    const date = new Date(unit === 's' ? numeric * 1000 : numeric);
    if (isNaN(date.getTime())) return null;

    return {
      local: date.toLocaleString('zh-CN', { hour12: false }),
      utc: date.toUTCString(),
      iso: date.toISOString(),
      zoned: formatInZone(date, targetZone),
      seconds: Math.floor(date.getTime() / 1000).toString(),
      milliseconds: date.getTime().toString(),
    };
  }, [timestampInput, unit, targetZone]);

  // Convert Date Time String -> Timestamp Info
  const dateStrConversionOutput = useMemo(() => {
    if (!dateStrInput.trim()) return null;
    const date = new Date(dateStrInput.trim());
    if (isNaN(date.getTime())) return null;

    return {
      seconds: Math.floor(date.getTime() / 1000).toString(),
      milliseconds: date.getTime().toString(),
      iso: date.toISOString(),
      local: date.toLocaleString('zh-CN', { hour12: false }),
    };
  }, [dateStrInput]);

  // Presets Handlers
  const applyPresetNow = () => {
    const now = Date.now();
    if (unit === 's') {
      setTimestampInput(Math.floor(now / 1000).toString());
    } else {
      setTimestampInput(now.toString());
    }
  };

  const applyPresetStartOfToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (unit === 's') {
      setTimestampInput(Math.floor(d.getTime() / 1000).toString());
    } else {
      setTimestampInput(d.getTime().toString());
    }
  };

  const applyPresetEndOfToday = () => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    if (unit === 's') {
      setTimestampInput(Math.floor(d.getTime() / 1000).toString());
    } else {
      setTimestampInput(d.getTime().toString());
    }
  };

  const applyPresetPlus24Hours = () => {
    const current = Number(timestampInput.trim());
    if (Number.isFinite(current)) {
      const delta = unit === 's' ? 86400 : 86400000;
      setTimestampInput((current + delta).toString());
    }
  };

  const applyDatePresetNow = () => {
    const d = new Date();
    setDateStrInput(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`);
  };

  // Date Diff Output
  const dateDiffOutput = useMemo(() => {
    if (!diffStart || !diffEnd) return null;
    const d1 = new Date(diffStart);
    const d2 = new Date(diffEnd);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null;

    const diffMs = Math.abs(d2.getTime() - d1.getTime());
    const totalSeconds = Math.floor(diffMs / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    const days = Math.floor(totalHours / 24);
    const remainingHours = totalHours % 24;

    return {
      daysAndHours: `${days} 天 ${remainingHours} 小时`,
      totalDays: (diffMs / (1000 * 60 * 60 * 24)).toFixed(2) + ' 天',
      totalHours: totalHours.toLocaleString() + ' 小时',
      totalMinutes: totalMinutes.toLocaleString() + ' 分钟',
      totalSeconds: totalSeconds.toLocaleString() + ' 秒',
    };
  }, [diffStart, diffEnd]);

  // Cron occurrence prediction
  const cronPreview = useMemo(() => {
    const expression = cronExpression.trim();
    if (!expression) {
      return { dates: [], error: '请输入有效的 Cron 表达式' };
    }
    try {
      const interval = CronExpressionParser.parse(expression);
      const nextDates: Date[] = [];
      // Get next 5 execution times
      for (let i = 0; i < 5; i++) {
        nextDates.push(interval.next().toDate());
      }
      return {
        dates: nextDates,
        error: '',
      };
    } catch (err) {
      return {
        dates: [],
        error: err instanceof Error ? err.message : '解析失败，请检查表达式语法',
      };
    }
  }, [cronExpression]);

  return (
    <div className="space-y-6">
      
      {/* 🚀 Active Real-time Clock Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2 border-primary-100 bg-gradient-to-r from-primary-500/10 via-transparent to-transparent dark:border-primary-950/30">
          <CardContent className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5">
            <div>
              <h3 className="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-1">
                ⏱️ 当前时间与全局时间戳
              </h3>
              <p className="text-2xl font-black text-slate-800 dark:text-slate-100 font-mono tracking-tight">
                {tickerNow.toLocaleString('zh-CN', { hour12: false })}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                时区: {Intl.DateTimeFormat().resolvedOptions().timeZone}
              </p>
            </div>
            
            <div className="flex gap-3">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col justify-center min-w-[120px] shadow-sm relative group">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase mb-0.5">秒级 (s)</span>
                <span className="font-mono text-sm font-black text-slate-700 dark:text-slate-300">
                  {Math.floor(tickerNow.getTime() / 1000)}
                </span>
                <button
                  onClick={() => handleCopy(Math.floor(tickerNow.getTime() / 1000).toString(), 'ticker-s')}
                  className="absolute top-1.5 right-1.5 p-1 text-slate-400 hover:text-primary-600 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="复制秒级时间戳"
                >
                  {copiedStates['ticker-s'] ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col justify-center min-w-[140px] shadow-sm relative group">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase mb-0.5">毫秒级 (ms)</span>
                <span className="font-mono text-sm font-black text-slate-700 dark:text-slate-300">
                  {tickerNow.getTime()}
                </span>
                <button
                  onClick={() => handleCopy(tickerNow.getTime().toString(), 'ticker-ms')}
                  className="absolute top-1.5 right-1.5 p-1 text-slate-400 hover:text-primary-600 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="复制毫秒级时间戳"
                >
                  {copiedStates['ticker-ms'] ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent border-emerald-100 dark:border-emerald-950/20">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">今日时间进度</span>
              <div className="mt-2.5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 font-mono">
                <span>00:00</span>
                <span>{((tickerNow.getHours() * 3600 + tickerNow.getMinutes() * 60 + tickerNow.getSeconds()) / 86400 * 100).toFixed(2)}%</span>
                <span>24:00</span>
              </div>
              <div className="mt-1.5 h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-1000 ease-out"
                  style={{ width: `${(tickerNow.getHours() * 3600 + tickerNow.getMinutes() * 60 + tickerNow.getSeconds()) / 86400 * 100}%` }}
                />
              </div>
            </div>
            <div className="text-[10px] text-slate-500 mt-2 font-mono flex items-center gap-1">
              <Compass className="w-3 h-3 text-emerald-600" />
              <span>今日剩余秒数: {86400 - (tickerNow.getHours() * 3600 + tickerNow.getMinutes() * 60 + tickerNow.getSeconds())} 秒</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ⏰ Column 1 & 2: Main Conversions */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card: Timestamp -> Date Time */}
          <Card>
            <CardHeader
              title="时间戳 ➔ 日期时间转换"
              description="双向无缝转换，支持自定义时区与丰富的毫秒级秒级自动兼容转换"
              actions={
                <div className="flex gap-1.5 flex-wrap">
                  <Button size="sm" variant="secondary" onClick={applyPresetNow}>现在</Button>
                  <Button size="sm" variant="secondary" onClick={applyPresetStartOfToday}>今日零点</Button>
                  <Button size="sm" variant="secondary" onClick={applyPresetEndOfToday}>今日早鸣</Button>
                  <Button size="sm" variant="secondary" onClick={applyPresetPlus24Hours}>+24 小时</Button>
                </div>
              }
            />
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <FieldLabel>输入 Unix 时间戳</FieldLabel>
                  <Input
                    className="font-mono text-sm"
                    value={timestampInput}
                    onChange={event => setTimestampInput(event.target.value)}
                    placeholder="例如: 1780148255"
                  />
                </div>
                <div>
                  <FieldLabel>单位</FieldLabel>
                  <Select value={unit} onChange={event => setUnit(event.target.value as 'ms' | 's')}>
                    <option value="s">秒 (s)</option>
                    <option value="ms">毫秒 (ms)</option>
                  </Select>
                </div>
              </div>

              <div>
                <FieldLabel hint="选择转换输出所对应的参考时区">目标显示时区</FieldLabel>
                <Select value={targetZone} onChange={event => setTargetZone(event.target.value)}>
                  {WORLD_ZONES.map(z => (
                    <option key={z.id} value={z.id}>{z.flag} {z.name}</option>
                  ))}
                </Select>
              </div>

              {timestampConversionOutput ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  <div className="tool-panel p-3.5 relative group">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">本地时间 (Locale)</div>
                    <div className="font-mono text-sm text-slate-800 dark:text-slate-200 font-bold">{timestampConversionOutput.local}</div>
                    <button
                      onClick={() => handleCopy(timestampConversionOutput.local, 'conv-local')}
                      className="absolute top-2 right-2 p-1 text-slate-400 hover:text-primary-600 transition-colors opacity-0 group-hover:opacity-100 rounded"
                    >
                      {copiedStates['conv-local'] ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="tool-panel p-3.5 relative group">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">选定目标时区时间 (Zoned)</div>
                    <div className="font-mono text-sm text-slate-800 dark:text-slate-200 font-bold">{timestampConversionOutput.zoned}</div>
                    <button
                      onClick={() => handleCopy(timestampConversionOutput.zoned, 'conv-zoned')}
                      className="absolute top-2 right-2 p-1 text-slate-400 hover:text-primary-600 transition-colors opacity-0 group-hover:opacity-100 rounded"
                    >
                      {copiedStates['conv-zoned'] ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="tool-panel p-3.5 relative group">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">ISO 8601 格式</div>
                    <div className="font-mono text-sm text-slate-800 dark:text-slate-200 break-all">{timestampConversionOutput.iso}</div>
                    <button
                      onClick={() => handleCopy(timestampConversionOutput.iso, 'conv-iso')}
                      className="absolute top-2 right-2 p-1 text-slate-400 hover:text-primary-600 transition-colors opacity-0 group-hover:opacity-100 rounded"
                    >
                      {copiedStates['conv-iso'] ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="tool-panel p-3.5 relative group">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">UTC 格式</div>
                    <div className="font-mono text-xs text-slate-800 dark:text-slate-200">{timestampConversionOutput.utc}</div>
                    <button
                      onClick={() => handleCopy(timestampConversionOutput.utc, 'conv-utc')}
                      className="absolute top-2 right-2 p-1 text-slate-400 hover:text-primary-600 transition-colors opacity-0 group-hover:opacity-100 rounded"
                    >
                      {copiedStates['conv-utc'] ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="status-error p-3 text-xs leading-5">⚠️ 请输入有效的数字时间戳以查看转换。</div>
              )}
            </CardContent>
          </Card>

          {/* Card: Date Time -> Timestamp */}
          <Card>
            <CardHeader
              title="日期时间 ➔ 时间戳转换"
              description="支持标准 ISO-8601 或自定义的文本日期格式智能解析"
              actions={
                <Button size="sm" variant="secondary" onClick={applyDatePresetNow}>现在</Button>
              }
            />
            <CardContent className="space-y-4">
              <div>
                <FieldLabel hint="支持任意标准可解析日期格式，例如 YYYY-MM-DD HH:mm:ss 或 ISO">
                  输入日期时间字符串
                </FieldLabel>
                <Input
                  className="font-mono text-sm"
                  value={dateStrInput}
                  onChange={event => setDateStrInput(event.target.value)}
                  placeholder="例如: 2026-05-30 23:00:00"
                />
              </div>

              {dateStrConversionOutput ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                  <div className="tool-panel p-3.5 relative group">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">秒级时间戳 (s)</div>
                    <div className="font-mono text-sm text-slate-900 dark:text-slate-100 font-extrabold">{dateStrConversionOutput.seconds}</div>
                    <button
                      onClick={() => handleCopy(dateStrConversionOutput.seconds, 'd-sec')}
                      className="absolute top-2 right-2 p-1 text-slate-400 hover:text-primary-600 transition-colors opacity-0 group-hover:opacity-100 rounded"
                    >
                      {copiedStates['d-sec'] ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="tool-panel p-3.5 relative group">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">毫秒级时间戳 (ms)</div>
                    <div className="font-mono text-sm text-slate-900 dark:text-slate-100 font-extrabold">{dateStrConversionOutput.milliseconds}</div>
                    <button
                      onClick={() => handleCopy(dateStrConversionOutput.milliseconds, 'd-ms')}
                      className="absolute top-2 right-2 p-1 text-slate-400 hover:text-primary-600 transition-colors opacity-0 group-hover:opacity-100 rounded"
                    >
                      {copiedStates['d-ms'] ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="tool-panel p-3.5 relative group">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">解析为 ISO 格式</div>
                    <div className="font-mono text-xs text-slate-700 dark:text-slate-350 break-all">{dateStrConversionOutput.iso}</div>
                    <button
                      onClick={() => handleCopy(dateStrConversionOutput.iso, 'd-iso')}
                      className="absolute top-2 right-2 p-1 text-slate-400 hover:text-primary-600 transition-colors opacity-0 group-hover:opacity-100 rounded"
                    >
                      {copiedStates['d-iso'] ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="status-error p-3 text-xs leading-5">⚠️ 日期格式不正确，解析失败。</div>
              )}
            </CardContent>
          </Card>

          {/* Card: Date Diff Calculator */}
          <Card>
            <CardHeader
              title="📅 日期时间跨度计算器"
              description="支持高精度跨度统计，快速计算两个精确时刻之间的差距"
            />
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div>
                  <FieldLabel>起始时间 (Start Date)</FieldLabel>
                  <input
                    type="datetime-local"
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-200 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 text-sm font-semibold"
                    value={diffStart}
                    onChange={e => setDiffStart(e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel>结束时间 (End Date)</FieldLabel>
                  <input
                    type="datetime-local"
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-200 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 text-sm font-semibold"
                    value={diffEnd}
                    onChange={e => setDiffEnd(e.target.value)}
                  />
                </div>
              </div>

              {dateDiffOutput ? (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="tool-panel p-3 col-span-2 bg-gradient-to-r from-primary-500/5 to-transparent flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">总时间差距</span>
                      <span className="text-base font-extrabold text-primary-700 dark:text-primary-400 font-mono">
                        {dateDiffOutput.daysAndHours}
                      </span>
                    </div>
                    <Calculator className="w-5 h-5 text-primary-600 opacity-60" />
                  </div>
                  <div className="tool-panel p-3">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">折合天数</span>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 font-mono">{dateDiffOutput.totalDays}</span>
                  </div>
                  <div className="tool-panel p-3">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">折合小时</span>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 font-mono">{dateDiffOutput.totalHours}</span>
                  </div>
                  <div className="tool-panel p-3">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">折合分钟</span>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 font-mono">{dateDiffOutput.totalMinutes}</span>
                  </div>
                  <div className="tool-panel p-3">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">折合秒数</span>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 font-mono">{dateDiffOutput.totalSeconds}</span>
                  </div>
                </div>
              ) : (
                <div className="status-error p-3 text-xs leading-5">⚠️ 请配置有效的起止时间。</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 🌏 Column 3: World Clocks & Cron Triggers */}
        <div className="space-y-6">
          
          {/* Card: World Clock Comparison */}
          <Card className="flex flex-col max-h-[460px]">
            <CardHeader
              title="🌐 世界主要城市时区时钟"
              description="高精度秒级同步跳秒比较表"
            />
            <CardContent className="app-scrollbar overflow-y-auto space-y-2.5 flex-1 pr-1">
              {WORLD_ZONES.map(zone => (
                <div
                  key={zone.id}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-850 bg-slate-50/50 hover:bg-slate-50 dark:bg-slate-900/50 dark:hover:bg-slate-900 transition-all gap-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg flex-none select-none">{zone.flag}</span>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold text-slate-700 dark:text-slate-350 truncate">{zone.id.split('/')[1] || zone.id}</div>
                      <div className="text-[9px] text-slate-400 uppercase font-semibold truncate">{zone.id}</div>
                    </div>
                  </div>
                  <div className="font-mono text-xs font-black text-primary-700 dark:text-primary-400 whitespace-nowrap text-right">
                    {formatInZone(tickerNow, zone.id).split(' ')[1] || '---'}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Card: Cron Trigger Predictor */}
          <Card>
            <CardHeader
              title="⏳ Cron 表达式执行预测"
              description="使用 cron-parser 瞬间展现未来 5 次的精确执行时刻"
            />
            <CardContent className="space-y-4">
              <div>
                <FieldLabel hint="支持 5 位标准 Cron 表达式">输入 Cron 表达式</FieldLabel>
                <Input
                  className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200"
                  value={cronExpression}
                  onChange={event => setCronExpression(event.target.value)}
                  placeholder="*/15 * * * 1-5"
                />
              </div>

              {cronPreview.error ? (
                <div className="status-error p-3 text-xs leading-5">
                  {cronPreview.error}
                </div>
              ) : (
                <div className="space-y-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block flex items-center gap-1">
                    <ListOrdered className="w-3.5 h-3.5 text-primary-600" />
                    未来 5 次触发预测
                  </span>
                  
                  <div className="space-y-1.5">
                    {cronPreview.dates.map((date, idx) => {
                      const localStr = date.toLocaleString('zh-CN', { hour12: false });
                      const dayOfWeek = getDayOfWeekCN(date);
                      const timestampStr = Math.floor(date.getTime() / 1000).toString();
                      const key = `cron-${idx}`;
                      
                      return (
                        <div
                          key={idx}
                          className="tool-panel p-2.5 flex flex-col gap-1 text-xs relative group"
                        >
                          <div className="flex items-center justify-between text-slate-400">
                            <span className="font-bold text-primary-600">第 {idx + 1} 次</span>
                            <span className="font-semibold">{dayOfWeek}</span>
                          </div>
                          <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            {localStr}
                          </div>
                          <div className="font-mono text-[10px] text-slate-500 flex items-center gap-1">
                            <span>TS: {timestampStr}</span>
                          </div>

                          <button
                            onClick={() => handleCopy(timestampStr, key)}
                            className="absolute top-2.5 right-2.5 p-1 text-slate-400 hover:text-primary-600 transition-colors opacity-0 group-hover:opacity-100 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                            title="复制触发时刻秒级时间戳"
                          >
                            {copiedStates[key] ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default UnixTimeStudio;
