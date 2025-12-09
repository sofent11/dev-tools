import React, { useState, useEffect } from 'react';
import { Clock, RefreshCcw } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';

export const TimeTool: React.FC = () => {
  const [now, setNow] = useState(new Date());
  const [timestampInput, setTimestampInput] = useState('');
  const [humanOutput, setHumanOutput] = useState('');
  const [dateInput, setDateInput] = useState('');
  const [tsOutput, setTsOutput] = useState('');

  // Update "Current Time" ticker
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    // Initialize inputs
    const currentTs = Math.floor(Date.now() / 1000).toString();
    setTimestampInput(currentTs);
    setDateInput(new Date().toISOString().slice(0, 16)); // YYYY-MM-DDTHH:mm
    convertTsToHuman(currentTs);
    convertHumanToTs(new Date().toISOString().slice(0, 16));
    
    return () => clearInterval(timer);
  }, []);

  const convertTsToHuman = (ts: string) => {
    const val = parseInt(ts, 10);
    if (isNaN(val)) {
        setHumanOutput("Invalid Timestamp");
        return;
    }
    // Detect ms vs seconds (heuristic: usually seconds < 10000000000)
    const date = new Date(val < 10000000000 ? val * 1000 : val);
    setHumanOutput(date.toLocaleString());
  };

  const convertHumanToTs = (dateStr: string) => {
      const date = new Date(dateStr);
      if (date.toString() === 'Invalid Date') {
          setTsOutput("Invalid Date");
          return;
      }
      setTsOutput(Math.floor(date.getTime() / 1000).toString());
  };

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
        title="Time Converter" 
        description="Convert between Unix Timestamp and Human Readable dates." 
        actions={
            <div className="text-xs font-mono bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                Current: {Math.floor(now.getTime() / 1000)}
            </div>
        }
      />
      <CardContent className="flex-1 space-y-8">
        
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

      </CardContent>
    </Card>
  );
};