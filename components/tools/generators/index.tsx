import React, { useState } from 'react';
import { Check, Copy, RefreshCcw } from 'lucide-react';
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

import { Plus, Trash2, FileJson, Table, Database, Download } from 'lucide-react';

interface SchemaField {
  id: string;
  name: string;
  type: 'id' | 'uuid' | 'name' | 'phone' | 'email' | 'number' | 'text' | 'enum';
  min?: number;
  max?: number;
  options?: string;
}

const cSurnames = ['赵', '钱', '孙', '李', '周', '吴', '郑', '王', '冯', '陈', '褚', '卫', '蒋', '沈', '韩', '杨', '朱', '秦', '尤', '许', '何', '吕', '施', '张', '孔', '曹', '严', '华'];
const cNames = ['伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '秀兰', '建国', '宇', '欣', '晨', '悦', '浩', '轩', '雨', '子', '涵'];

const generateChineseName = () => {
  const surname = randomChoice(cSurnames);
  const name = randomChoice(cNames);
  // 50% probability of double name
  const name2 = randomInt(0, 1) === 1 ? randomChoice(cNames) : '';
  return surname + name + name2;
};

export const LoremIpsumTool: React.FC = () => {
  const [fields, setFields] = useState<SchemaField[]>([
    { id: 'f-1', name: 'id', type: 'id' },
    { id: 'f-2', name: 'name', type: 'name' },
    { id: 'f-3', name: 'email', type: 'email' },
    { id: 'f-4', name: 'age', type: 'number', min: 18, max: 65 },
    { id: 'f-5', name: 'role', type: 'enum', options: 'admin,editor,user' }
  ]);
  
  const [count, setCount] = useState<number>(20);
  const [sqlTableName, setSqlTableName] = useState<string>('tb_users');
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'sql'>('json');
  
  const [output, setOutput] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const addField = () => {
    const newField: SchemaField = {
      id: Date.now().toString(),
      name: `field_${fields.length + 1}`,
      type: 'text'
    };
    setFields([...fields, newField]);
  };

  const deleteField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const updateField = (id: string, updates: Partial<SchemaField>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const handleGenerate = () => {
    const safeCount = Math.min(500, Math.max(1, count));
    const rawData: Record<string, any>[] = [];

    // 1. Core Generator Engine
    for (let index = 0; index < safeCount; index++) {
      const row: Record<string, any> = {};
      fields.forEach(field => {
        if (!field.name) return;
        
        switch (field.type) {
          case 'id':
            row[field.name] = index + 1;
            break;
          case 'uuid':
            row[field.name] = generateUuid();
            break;
          case 'name':
            row[field.name] = generateChineseName();
            break;
          case 'phone':
            row[field.name] = `13${randomInt(0, 9)}${String(crypto.getRandomValues(new Uint32Array(1))[0]).slice(-8)}`;
            break;
          case 'email': {
            const randomEngName = randomChoice(eNames).toLowerCase();
            row[field.name] = `${randomEngName}${randomInt(10, 99)}@${randomChoice(mailDomains)}`;
            break;
          }
          case 'number': {
            const min = field.min ?? 0;
            const max = field.max ?? 100;
            row[field.name] = randomInt(min, max);
            break;
          }
          case 'enum': {
            const opts = (field.options || 'value1,value2').split(',').map(s => s.trim()).filter(Boolean);
            row[field.name] = randomChoice(opts.length > 0 ? opts : ['value1', 'value2']);
            break;
          }
          case 'text':
          default:
            row[field.name] = buildSentence('zh', randomInt(6, 12));
            break;
        }
      });
      rawData.push(row);
    }

    // 2. Export Compiler Engine
    if (exportFormat === 'json') {
      setOutput(JSON.stringify(rawData, null, 2));
    } else if (exportFormat === 'csv') {
      if (rawData.length === 0) {
        setOutput('');
        return;
      }
      const headers = Object.keys(rawData[0]).join(',');
      const rows = rawData.map(row => 
        Object.values(row).map(val => {
          const s = String(val);
          // Escape quotes and wrap in double quotes if special chars exist
          if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        }).join(',')
      );
      setOutput([headers, ...rows].join('\n'));
    } else if (exportFormat === 'sql') {
      if (rawData.length === 0) {
        setOutput('');
        return;
      }
      const tName = sqlTableName.trim() || 'tb_users';
      const keys = Object.keys(rawData[0]).join(', ');
      
      const statements = rawData.map(row => {
        const values = Object.values(row).map(val => {
          if (typeof val === 'number') return val;
          return `'${String(val).replace(/'/g, "''")}'`;
        }).join(', ');
        return `INSERT INTO ${tName} (${keys}) VALUES (${values});`;
      });
      setOutput(statements.join('\n'));
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = () => {
    if (!output) return;
    const isJson = exportFormat === 'json';
    const isCsv = exportFormat === 'csv';
    const ext = isJson ? 'json' : isCsv ? 'csv' : 'sql';
    const mime = isJson ? 'application/json' : 'text/plain';
    
    const blob = new Blob([output], { type: mime });
    const url = URL.createObjectURL(blob);
    aElementClick(url, `mock_data_${Date.now()}.${ext}`);
  };

  const aElementClick = (url: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="可视化 Schema 数据 Mock 发生器"
        description="支持拖拽级配置自定义字段，在本地瞬间批量产出符合前后端与数据库规范的 JSON、CSV 及 SQL INSERT Statements 压测脚本。"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={!output} onClick={handleCopy} icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>
              一键复制
            </Button>
            <Button size="sm" variant="secondary" disabled={!output} onClick={handleDownload} icon={<Download className="h-4 w-4" />}>
              导出文件
            </Button>
            <Button size="sm" onClick={handleGenerate} icon={<RefreshCcw className="h-4 w-4" />}>
              生成数据
            </Button>
          </div>
        }
      />
      <CardContent className="grid min-h-0 flex-1 gap-5 overflow-auto lg:grid-cols-12">
        
        {/* Left Side: Schema Builder (5 cols equivalent) */}
        <div className="lg:col-span-5 flex flex-col gap-4 min-h-0 border-r border-slate-100 dark:border-slate-800 pr-3">
          <div className="flex items-center justify-between border-b pb-2 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-500 uppercase">Schema 字段配置</span>
            <button 
              onClick={addField}
              className="flex items-center gap-1 py-1 px-2.5 rounded bg-primary-50 text-primary-600 hover:bg-primary-100 text-[10px] font-bold transition-all dark:bg-primary-950/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>添加字段</span>
            </button>
          </div>

          {/* Fields list */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[220px]">
            {fields.map(field => (
              <div 
                key={field.id}
                className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/20 text-xs space-y-2.5 relative group shadow-inner"
              >
                <div className="flex gap-2 items-center">
                  <input 
                    className="flex-1 border-b border-dashed border-slate-200 dark:border-slate-800 bg-transparent font-mono font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary-500"
                    value={field.name}
                    onChange={e => updateField(field.id, { name: e.target.value })}
                    placeholder="字段名 (key)"
                  />
                  <button 
                    onClick={() => deleteField(field.id)}
                    className="text-slate-400 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-slate-400 block mb-0.5">类型</span>
                    <select
                      value={field.type}
                      onChange={e => updateField(field.id, { type: e.target.value as any })}
                      className="w-full p-1 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded font-semibold"
                    >
                      <option value="id">自增 ID</option>
                      <option value="uuid">随机 UUID</option>
                      <option value="name">逼真中文姓名</option>
                      <option value="phone">中国手机号</option>
                      <option value="email">电子邮箱</option>
                      <option value="number">数值区间</option>
                      <option value="enum">固定枚举</option>
                      <option value="text">随机段落文本</option>
                    </select>
                  </div>

                  {field.type === 'number' && (
                    <div className="flex gap-1 items-end">
                      <input 
                        type="number" placeholder="min" className="w-full p-1 border rounded text-center"
                        value={field.min ?? 0}
                        onChange={e => updateField(field.id, { min: Number(e.target.value) })}
                      />
                      <span className="text-slate-300 select-none">-</span>
                      <input 
                        type="number" placeholder="max" className="w-full p-1 border rounded text-center"
                        value={field.max ?? 100}
                        onChange={e => updateField(field.id, { max: Number(e.target.value) })}
                      />
                    </div>
                  )}

                  {field.type === 'enum' && (
                    <div className="col-span-2">
                      <span className="text-slate-400 block mb-0.5">枚举选项 (逗号隔开)</span>
                      <input 
                        className="w-full p-1 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded font-mono text-[9px]"
                        value={field.options || ''}
                        onChange={e => updateField(field.id, { options: e.target.value })}
                        placeholder="e.g. active, inactive, pending"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Export config bar */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3.5 flex-none">
            <div>
              <FieldLabel>输出目标格式</FieldLabel>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {(['json', 'csv', 'sql'] as const).map(fmt => (
                  <button
                    key={fmt}
                    onClick={() => setExportFormat(fmt)}
                    className={`py-1.5 rounded-lg border text-xs font-semibold uppercase flex items-center justify-center gap-1 transition-all ${exportFormat === fmt ? 'bg-primary-600 border-primary-600 text-white shadow-sm' : 'bg-white border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800'}`}
                  >
                    {fmt === 'json' ? <FileJson className="w-3.5 h-3.5" /> : fmt === 'csv' ? <Table className="w-3.5 h-3.5" /> : <Database className="w-3.5 h-3.5" />}
                    <span>{fmt}</span>
                  </button>
                ))}
              </div>
            </div>

            {exportFormat === 'sql' && (
              <div className="animate-in fade-in duration-300">
                <FieldLabel>SQL 导出表名</FieldLabel>
                <Input 
                  className="font-mono text-xs font-bold mt-1"
                  value={sqlTableName}
                  onChange={e => setSqlTableName(e.target.value)}
                  placeholder="e.g. tb_users"
                />
              </div>
            )}

            <div>
              <FieldLabel>生成记录条数</FieldLabel>
              <Input 
                type="number" min={1} max={500}
                className="mt-1"
                value={count} 
                onChange={e => setCount(Math.min(500, Math.max(1, Number(e.target.value))))} 
              />
            </div>
          </div>
        </div>

        {/* Right Side: Output area (7 cols equivalent) */}
        <div className="lg:col-span-7 flex flex-col min-h-0 bg-slate-950 rounded-xl overflow-hidden min-h-[300px]">
          <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between flex-none">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Output Data Dashboard
            </span>
          </div>
          <textarea
            readOnly
            className="flex-1 w-full h-full p-4 font-mono text-xs text-emerald-400 dark:text-emerald-300 bg-transparent border-0 outline-none resize-none leading-relaxed overflow-auto"
            value={output || '在左侧配置 Schema 字段，点击上方“生成数据”按钮查看结果...'}
            placeholder="生成的假数据在此处呈现"
          />
        </div>

      </CardContent>
    </Card>
  );
};
