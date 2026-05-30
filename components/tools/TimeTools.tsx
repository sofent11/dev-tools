import React, { useState, useEffect } from 'react';
import { Calculator, ArrowRight, Copy, Check } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';

// --- Timestamp Tool ---
export const TimestampTool: React.FC = () => {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [inputTs, setInputTs] = useState<string>('');
  const [inputDate, setInputDate] = useState<string>('');
  const [resultDate, setResultDate] = useState<string>('');
  const [resultTs, setResultTs] = useState<string>('');

  const [copiedDate, setCopiedDate] = useState(false);
  const [copiedTs, setCopiedTs] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  const convertTsToDate = () => {
      const ts = parseInt(inputTs);
      if (!isNaN(ts)) {
          const date = new Date(ts * (inputTs.length > 11 ? 1 : 1000)); // Auto detect ms/s
          setResultDate(date.toLocaleString());
      } else {
          setResultDate("Invalid Timestamp");
      }
  };

  const convertDateToTs = () => {
      const date = new Date(inputDate);
      if (!isNaN(date.getTime())) {
          setResultTs(Math.floor(date.getTime() / 1000).toString());
      } else {
          setResultTs("Invalid Date");
      }
  };

  const setPresetNow = () => {
    const ts = Math.floor(Date.now() / 1000).toString();
    setInputTs(ts);
    const date = new Date(parseInt(ts) * 1000);
    setResultDate(date.toLocaleString());
  };

  const setPresetStartOfToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const formatted = d.getFullYear() + '-' + 
                      String(d.getMonth() + 1).padStart(2, '0') + '-' + 
                      String(d.getDate()).padStart(2, '0') + ' 00:00:00';
    setInputDate(formatted);
    setResultTs(Math.floor(d.getTime() / 1000).toString());
  };

  const setPresetEndOfToday = () => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    const formatted = d.getFullYear() + '-' + 
                      String(d.getMonth() + 1).padStart(2, '0') + '-' + 
                      String(d.getDate()).padStart(2, '0') + ' 23:59:59';
    setInputDate(formatted);
    setResultTs(Math.floor(d.getTime() / 1000).toString());
  };

  const setPresetPlusOneDay = () => {
    const d = new Date(Date.now() + 86400000);
    const formatted = d.getFullYear() + '-' + 
                      String(d.getMonth() + 1).padStart(2, '0') + '-' + 
                      String(d.getDate()).padStart(2, '0') + ' ' +
                      String(d.getHours()).padStart(2, '0') + ':' +
                      String(d.getMinutes()).padStart(2, '0') + ':' +
                      String(d.getSeconds()).padStart(2, '0');
    setInputDate(formatted);
    setResultTs(Math.floor(d.getTime() / 1000).toString());
  };

  const handleCopyDate = () => {
    if (!resultDate) return;
    navigator.clipboard.writeText(resultDate);
    setCopiedDate(true);
    setTimeout(() => setCopiedDate(false), 2000);
  };

  const handleCopyTs = () => {
    if (!resultTs) return;
    navigator.clipboard.writeText(resultTs);
    setCopiedTs(true);
    setTimeout(() => setCopiedTs(false), 2000);
  };

  return (
    <Card className="h-full flex flex-col space-y-4">
      <CardHeader 
        title="时间戳转换" 
        description={`Current Unix Timestamp: ${now}`} 
        actions={
          <div className="flex gap-1.5 flex-wrap justify-end">
            <Button size="sm" variant="secondary" onClick={setPresetNow}>当前时间</Button>
            <Button size="sm" variant="secondary" onClick={setPresetStartOfToday}>今日零点</Button>
            <Button size="sm" variant="secondary" onClick={setPresetEndOfToday}>今日早鸣</Button>
            <Button size="sm" variant="secondary" onClick={setPresetPlusOneDay}>+24 小时</Button>
          </div>
        }
      />
      <CardContent className="space-y-6">

        {/* Timestamp -> Date */}
        <div className="flex flex-col md:flex-row gap-4 items-end">
             <div className="flex-1 w-full">
                <label className="text-sm font-medium text-slate-700">Timestamp (s/ms)</label>
                <input
                    className="w-full p-2 border rounded-lg mt-1"
                    placeholder="1678888888"
                    value={inputTs}
                    onChange={(e) => setInputTs(e.target.value)}
                />
             </div>
             <Button onClick={convertTsToDate} icon={<ArrowRight className="w-4 h-4"/>}>Convert</Button>
             <div className="flex-1 w-full relative">
                <label className="text-sm font-medium text-slate-700">Date Time</label>
                <div className="relative mt-1">
                    <input
                        readOnly
                        className="w-full p-2 bg-slate-100 border rounded-lg text-slate-600 pr-10"
                        value={resultDate}
                    />
                    {resultDate && (
                        <button
                            onClick={handleCopyDate}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                        >
                            {copiedDate ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                    )}
                </div>
             </div>
        </div>

        <div className="border-t border-slate-100"></div>

        {/* Date -> Timestamp */}
        <div className="flex flex-col md:flex-row gap-4 items-end">
             <div className="flex-1 w-full">
                <label className="text-sm font-medium text-slate-700">Date Time String</label>
                <input
                    className="w-full p-2 border rounded-lg mt-1"
                    placeholder="YYYY-MM-DD HH:mm:ss"
                    value={inputDate}
                    onChange={(e) => setInputDate(e.target.value)}
                />
             </div>
             <Button onClick={convertDateToTs} icon={<ArrowRight className="w-4 h-4"/>}>Convert</Button>
             <div className="flex-1 w-full relative">
                <label className="text-sm font-medium text-slate-700">Timestamp (s)</label>
                <div className="relative mt-1">
                    <input
                        readOnly
                        className="w-full p-2 bg-slate-100 border rounded-lg text-slate-600 pr-10"
                        value={resultTs}
                    />
                    {resultTs && (
                        <button
                            onClick={handleCopyTs}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                        >
                            {copiedTs ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                    )}
                </div>
             </div>
        </div>

      </CardContent>
    </Card>
  );
};

// --- Date Diff Tool ---
export const DateDiffTool: React.FC = () => {
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const [diff, setDiff] = useState('');

    const calculateDiff = () => {
        const d1 = new Date(start);
        const d2 = new Date(end);
        if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
            const diffMs = Math.abs(d2.getTime() - d1.getTime());
            const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            setDiff(`${days} days, ${hours} hours`);
        } else {
            setDiff("Invalid dates");
        }
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader title="日期差值计算" description="计算两个日期之间的间隔" />
            <CardContent className="space-y-4">
                 <div className="flex gap-4">
                    <div className="flex-1">
                        <label className="block text-sm mb-1">Start Date</label>
                        <input type="datetime-local" className="w-full p-2 border rounded" onChange={e => setStart(e.target.value)} />
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm mb-1">End Date</label>
                        <input type="datetime-local" className="w-full p-2 border rounded" onChange={e => setEnd(e.target.value)} />
                    </div>
                 </div>
                 <Button onClick={calculateDiff} className="w-full" icon={<Calculator className="w-4 h-4"/>}>Calculate Difference</Button>
                 <div className="p-4 bg-slate-100 rounded-lg text-center font-bold text-lg text-primary-700">
                    {diff || "Result will appear here"}
                 </div>
            </CardContent>
        </Card>
    );
};
