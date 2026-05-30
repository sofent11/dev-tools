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

const randomChoice = <T,>(array: T[]): T => array[randomInt(0, array.length - 1)];

const generateUuid = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10xx
  return Array.from(bytes)
    .map((b, i) => (i === 4 || i === 6 || i === 8 || i === 10 ? '-' : '') + b.toString(16).padStart(2, '0'))
    .join('');
};

const eNames = ['Alice', 'Bob', 'Charlie', 'David', 'Eva', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack', 'Kate', 'Leo'];
const mailDomains = ['gmail.com', 'outlook.com', 'qq.com', '163.com', 'example.com'];
const products = ['智能手机 X12', '无线降噪耳机', '机械键盘 Pro', '电竞显示器 4K', '多功能笔记本', '超长续航移动电源', '人体工学椅', '扫地机器人', '智能手环 8', '高速 SSD 1TB'];
const categories = ['电子产品', '办公外设', '影音娱乐', '生活家居'];
const logMsgs = ['User login successful', 'Database connection timeout', 'Failed to compile chunk', 'API request throttled', 'Cache refreshed successfully', 'Payment transaction completed'];
const logLevels = ['INFO', 'WARNING', 'ERROR', 'DEBUG'];
const logPaths = ['/api/v1/auth', '/api/v2/users', '/api/v1/payment', '/api/v3/orders', '/api/v1/health'];

const generateMockData = (template: 'users' | 'products' | 'logs', count: number) => {
  return Array.from({ length: count }, (_, index) => {
    if (template === 'users') {
      const name = randomChoice(eNames);
      return {
        id: generateUuid(),
        name,
        email: `${name.toLowerCase()}${randomInt(10, 99)}@${randomChoice(mailDomains)}`,
        phone: `13${randomInt(0, 9)}${String(crypto.getRandomValues(new Uint32Array(1))[0]).slice(-8)}`,
        role: randomChoice(['admin', 'editor', 'user']),
        status: randomChoice(['active', 'inactive', 'pending']),
        createdAt: new Date(Date.now() - randomInt(0, 30) * 86400000).toISOString(),
      };
    } else if (template === 'products') {
      return {
        id: 1000 + index + 1,
        title: randomChoice(products),
        category: randomChoice(categories),
        price: parseFloat((randomInt(99, 8999) + randomInt(0, 99) / 100).toFixed(2)),
        stock: randomInt(0, 450),
        rating: parseFloat((randomInt(35, 50) / 10).toFixed(1)),
        inStock: randomInt(0, 100) > 10,
      };
    } else {
      return {
        timestamp: new Date(Date.now() - randomInt(0, 3600) * 1000).toISOString(),
        level: randomChoice(logLevels),
        message: randomChoice(logMsgs),
        path: randomChoice(logPaths),
        latencyMs: randomChoice([randomInt(5, 50), randomInt(50, 500), randomInt(500, 2500)]),
        clientIp: `${randomInt(1, 254)}.${randomInt(1, 254)}.${randomInt(1, 254)}.${randomInt(1, 254)}`,
      };
    }
  });
};

export const LoremIpsumTool: React.FC = () => {
  const [language, setLanguage] = useState<'en' | 'zh'>('zh');
  const [unit, setUnit] = useState<'paragraphs' | 'sentences' | 'list' | 'mock_json'>('paragraphs');
  const [template, setTemplate] = useState<'users' | 'products' | 'logs'>('users');
  const [count, setCount] = useState(3);
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);

  const generate = () => {
    const safeCount = Math.min(100, Math.max(1, count));
    if (unit === 'mock_json') {
      const mockList = generateMockData(template, safeCount);
      setOutput(JSON.stringify(mockList, null, 2));
      return;
    }

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

  const download = () => {
    if (!output) return;
    const blob = new Blob([output], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mock_data_${template}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="假文与 Mock 数据生成器"
        description="生成中英文段落、句子、列表或结构化 API Mock 数据，用于开发和占位测试。"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={!output} onClick={copy} icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>复制</Button>
            {unit === 'mock_json' && (
              <Button size="sm" variant="secondary" disabled={!output} onClick={download}>下载 JSON</Button>
            )}
            <Button size="sm" onClick={generate} icon={<RefreshCcw className="h-4 w-4" />}>生成</Button>
          </div>
        }
      />
      <CardContent className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="space-y-4">
          <div>
            <FieldLabel>生成类型</FieldLabel>
            <Select value={unit} onChange={event => setUnit(event.target.value as typeof unit)}>
              <option value="paragraphs">占位段落</option>
              <option value="sentences">占位句子</option>
              <option value="list">占位列表</option>
              <option value="mock_json">API Mock JSON</option>
            </Select>
          </div>
          {unit !== 'mock_json' ? (
            <div>
              <FieldLabel>语言</FieldLabel>
              <Select value={language} onChange={event => setLanguage(event.target.value as typeof language)}>
                <option value="zh">中文</option>
                <option value="en">English</option>
              </Select>
            </div>
          ) : (
            <div>
              <FieldLabel>数据模版</FieldLabel>
              <Select value={template} onChange={event => setTemplate(event.target.value as typeof template)}>
                <option value="users">用户列表 (User Profiles)</option>
                <option value="products">商品目录 (E-commerce Products)</option>
                <option value="logs">系统日志 (System Logs)</option>
              </Select>
            </div>
          )}
          <div>
            <FieldLabel>{unit === 'mock_json' ? '生成记录数' : '数量'}</FieldLabel>
            <Input type="number" min={1} max={unit === 'mock_json' ? 100 : 50} value={count} onChange={event => setCount(Number(event.target.value))} />
          </div>
        </div>
        <Textarea readOnly className="min-h-0 flex-1 resize-none bg-slate-50 font-mono text-xs leading-6" value={output || (unit === 'mock_json' ? '点击生成后显示 API Mock JSON 数据' : '点击生成后显示假文')} />
      </CardContent>
    </Card>
  );
};
