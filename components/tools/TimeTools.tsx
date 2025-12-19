import React, { useState, useEffect } from 'react';
import { Calculator, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';

// --- Timestamp Tool ---
export const TimestampTool: React.FC = () => {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [inputTs, setInputTs] = useState<string>('');
  const [inputDate, setInputDate] = useState<string>('');
  const [resultDate, setResultDate] = useState<string>('');
  const [resultTs, setResultTs] = useState<string>('');

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

  return (
    <Card className="h-full flex flex-col space-y-4">
      <CardHeader title="时间戳转换" description={`Current Unix Timestamp: ${now}`} />
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
             <div className="flex-1 w-full">
                <label className="text-sm font-medium text-slate-700">Date Time</label>
                <input
                    readOnly
                    className="w-full p-2 bg-slate-100 border rounded-lg mt-1 text-slate-600"
                    value={resultDate}
                />
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
             <div className="flex-1 w-full">
                <label className="text-sm font-medium text-slate-700">Timestamp (s)</label>
                <input
                    readOnly
                    className="w-full p-2 bg-slate-100 border rounded-lg mt-1 text-slate-600"
                    value={resultTs}
                />
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
