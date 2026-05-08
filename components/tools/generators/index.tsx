import React, { useState } from 'react';
import { Check, Copy, RefreshCcw } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { FieldLabel, Input, Select, Textarea } from '../../ui/ToolUi';

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

const englishWords = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua'.split(' ');
const chinesePhrases = ['这是', '一段', '用于', '版面', '测试', '的', '示例', '文本', '可以', '快速', '填充', '界面', '验证', '排版', '节奏'];

const buildSentence = (language: 'en' | 'zh', wordsPerSentence: number) => {
  if (language === 'zh') {
    return Array.from({ length: wordsPerSentence }, (_, index) => chinesePhrases[index % chinesePhrases.length]).join('') + '。';
  }
  const words = Array.from({ length: wordsPerSentence }, (_, index) => englishWords[index % englishWords.length]);
  const sentence = words.join(' ');
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.';
};

export const LoremIpsumTool: React.FC = () => {
  const [language, setLanguage] = useState<'en' | 'zh'>('zh');
  const [unit, setUnit] = useState<'paragraphs' | 'sentences' | 'list'>('paragraphs');
  const [count, setCount] = useState(3);
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);

  const generate = () => {
    const safeCount = Math.min(50, Math.max(1, count));
    const sentences = Array.from({ length: safeCount }, () => buildSentence(language, language === 'zh' ? 14 : 12));
    if (unit === 'sentences') {
      setOutput(sentences.join(language === 'zh' ? '' : ' '));
      return;
    }
    if (unit === 'list') {
      setOutput(sentences.map(item => `- ${item}`).join('\n'));
      return;
    }
    setOutput(sentences.map((_, index) =>
      Array.from({ length: 3 }, (__, sentenceIndex) => buildSentence(language, 10 + ((index + sentenceIndex) % 6))).join(language === 'zh' ? '' : ' '),
    ).join('\n\n'));
  };

  const copy = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="假文生成器"
        description="生成中英文段落、句子或列表，用于排版和占位测试。"
        actions={
          <>
            <Button size="sm" variant="secondary" disabled={!output} onClick={copy} icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>复制</Button>
            <Button size="sm" onClick={generate} icon={<RefreshCcw className="h-4 w-4" />}>生成</Button>
          </>
        }
      />
      <CardContent className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="space-y-4">
          <div>
            <FieldLabel>语言</FieldLabel>
            <Select value={language} onChange={event => setLanguage(event.target.value as typeof language)}>
              <option value="zh">中文</option>
              <option value="en">English</option>
            </Select>
          </div>
          <div>
            <FieldLabel>类型</FieldLabel>
            <Select value={unit} onChange={event => setUnit(event.target.value as typeof unit)}>
              <option value="paragraphs">段落</option>
              <option value="sentences">句子</option>
              <option value="list">列表</option>
            </Select>
          </div>
          <div>
            <FieldLabel>数量</FieldLabel>
            <Input type="number" min={1} max={50} value={count} onChange={event => setCount(Number(event.target.value))} />
          </div>
        </div>
        <Textarea readOnly className="min-h-0 flex-1 resize-none bg-slate-50 leading-7" value={output || '点击生成后显示假文'} />
      </CardContent>
    </Card>
  );
};
