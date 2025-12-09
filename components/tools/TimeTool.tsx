import React, { useState, useEffect, useCallback } from 'react';
import { Clock, Calendar, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';

export const TimeTool: React.FC = () => {
  const [now, setNow] = useState(new Date());

  const getInitialTs = () => Math.floor(Date.now() / 1000).toString();
  const getInitialDate = () => new Date().toISOString().slice(0, 16);

  const [timestampInput, setTimestampInput] = useState(getInitialTs);
  const [dateInput, setDateInput] = useState(getInitialDate);

  // Derived initial outputs (lazy)
  const [humanOutput, setHumanOutput] = useState(() => {
     const ts = getInitialTs();
     const val = parseInt(ts, 10);
     if (isNaN(val)) return "Invalid Timestamp";
     const date = new Date(val < 10000000000 ? val * 1000 : val);
     return date.toLocaleString();
  });

  const [tsOutput, setTsOutput] = useState(() => {
     const d = getInitialDate();
     const date = new Date(d);
     if (date.toString() === 'Invalid Date') return "Invalid Date";
     return Math.floor(date.getTime() / 1000).toString();
  });

  // Diff State
  const [diffDate1, setDiffDate1] = useState(() => new Date().toISOString().slice(0, 10));
  const [diffDate2, setDiffDate2] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });

  // Diff result can be derived state (calculated in render)
  // But since we use useState for it in previous code, let's keep it but update it via effect only when inputs change
  // OR better: useMemo.

  const diffResult = React.useMemo(() => {
      if (!diffDate1 || !diffDate2) return '';
      const d1 = new Date(diffDate1);
      const d2 = new Date(diffDate2);

      const diffMs = Math.abs(d2.getTime() - d1.getTime());
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

      return `${diffDays} days (${diffHours} hours)`;
  }, [diffDate1, diffDate2]);


  // Update "Current Time" ticker
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const convertTsToHuman = useCallback((ts: string) => {
    const val = parseInt(ts, 10);
    if (isNaN(val)) {
        setHumanOutput("Invalid Timestamp");
        return;
    }
    // Detect ms vs seconds (heuristic: usually seconds < 10000000000)
    const date = new Date(val < 10000000000 ? val * 1000 : val);
    setHumanOutput(date.toLocaleString());
  }, []);

  const convertHumanToTs = useCallback((dateStr: string) => {
      const date = new Date(dateStr);
      if (date.toString() === 'Invalid Date') {
          setTsOutput("Invalid Date");
          return;
      }
      setTsOutput(Math.floor(date.getTime() / 1000).toString());
  }, []);

  const handleTsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setTimestampInput(v);
      convertTsToHuman(v);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setDateInput(v);
      convertHumanToTs(v);
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader 
        title="时间/日期工具"
        description="时间戳转换、日期计算等。"
        actions={
            <div className="text-xs font-mono bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                Current: {Math.floor(now.getTime() / 1000)}
            </div>
        }
      />
      <CardContent className="flex-1 overflow-auto space-y-8">
        
        {/* Timestamp to Date */}
        <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary-600"/> Unix Timestamp &rarr; Date
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Timestamp</label>
                    <input 
                        type="number" 
                        className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary-200 focus:outline-none"
                        value={timestampInput}
                        onChange={handleTsChange}
                    />
                </div>
                <div>
                    <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Result (Local)</label>
                    <input 
                        readOnly
                        className="w-full p-2 bg-white border border-slate-200 rounded-md text-slate-600"
                        value={humanOutput}
                    />
                </div>
            </div>
        </div>

        {/* Date to Timestamp */}
        <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
             <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary-600"/> Date &rarr; Unix Timestamp
            </h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Date Time</label>
                    <input 
                        type="datetime-local" 
                        className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary-200 focus:outline-none"
                        value={dateInput}
                        onChange={handleDateChange}
                    />
                </div>
                <div>
                    <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Result (Seconds)</label>
                    <input 
                        readOnly
                        className="w-full p-2 bg-white border border-slate-200 rounded-md text-slate-600 font-mono"
                        value={tsOutput}
                    />
                </div>
            </div>
        </div>

        {/* Date Diff */}
        <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
             <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary-600"/> 日期差值计算
            </h3>
             <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="flex-1 w-full">
                    <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Start Date</label>
                    <input
                        type="date"
                        className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary-200 focus:outline-none"
                        value={diffDate1}
                        onChange={e => setDiffDate1(e.target.value)}
                    />
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 mt-5 hidden md:block" />
                <div className="flex-1 w-full">
                    <label className="block text-xs uppercase text-slate-500 font-bold mb-1">End Date</label>
                    <input
                        type="date"
                        className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary-200 focus:outline-none"
                        value={diffDate2}
                        onChange={e => setDiffDate2(e.target.value)}
                    />
                </div>
                <div className="flex-1 w-full">
                    <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Difference</label>
                     <div className="w-full p-2 bg-primary-50 border border-primary-100 text-primary-700 font-bold rounded-md text-center">
                        {diffResult}
                     </div>
                </div>
            </div>
        </div>

      </CardContent>
    </Card>
  );
};
