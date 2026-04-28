import React, { useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { FieldLabel, Input } from '../../ui/ToolUi';

const randomInt = (min: number, max: number) => {
  const lower = Math.ceil(min);
  const upper = Math.floor(max);
  if (upper < lower) return lower;
  const range = upper - lower + 1;
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return lower + (array[0] % range);
};

export const RandomNumberTool: React.FC = () => {
  const [min, setMin] = useState(1);
  const [max, setMax] = useState(100);
  const [count, setCount] = useState(12);
  const [numbers, setNumbers] = useState<number[]>(() => Array.from({ length: 12 }, () => randomInt(1, 100)));

  const generate = () => {
    const safeCount = Math.min(500, Math.max(1, count));
    setNumbers(Array.from({ length: safeCount }, () => randomInt(min, max)));
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader title="随机数生成器" description="使用 Web Crypto 生成指定范围内的随机整数。" actions={<Button size="sm" icon={<RefreshCcw className="h-4 w-4" />} onClick={generate}>生成</Button>} />
      <CardContent className="flex flex-1 flex-col gap-5 overflow-auto">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <FieldLabel>最小值</FieldLabel>
            <Input type="number" value={min} onChange={event => setMin(Number(event.target.value))} />
          </div>
          <div>
            <FieldLabel>最大值</FieldLabel>
            <Input type="number" value={max} onChange={event => setMax(Number(event.target.value))} />
          </div>
          <div>
            <FieldLabel>数量</FieldLabel>
            <Input type="number" min={1} max={500} value={count} onChange={event => setCount(Number(event.target.value))} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {numbers.map((number, index) => (
            <div key={`${number}-${index}`} className="tool-panel p-3 text-center font-mono text-lg font-semibold text-slate-900">
              {number}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
