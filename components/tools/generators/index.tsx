import { translateUi as tr, useLocaleRender } from '../../../src/i18n/render';
import React, { useState } from 'react';
import { Check, Copy, RefreshCcw } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { useCopyToClipboard } from '../shared/useCopyToClipboard';
import { FieldLabel, Input } from '../../ui/ToolUi';

import { randomInteger as randomInt } from './randomInteger';

export const RandomNumberTool: React.FC = () => {
  useLocaleRender();
  const [min, setMin] = useState(1);
  const [max, setMax] = useState(100);
  const [count, setCount] = useState(12);
  const [numbers, setNumbers] = useState<number[]>(() => Array.from({ length: 12 }, () => randomInt(1, 100)));
  const [view, setView] = useState<'grid' | 'text'>('grid');
  const [generatedRange, setGeneratedRange] = useState('1–100');
  const { copied, copy } = useCopyToClipboard();
  const valid = Number.isSafeInteger(min) && Number.isSafeInteger(max) && min <= max && max - min < 4294967296 && Number.isInteger(count) && count >= 1 && count <= 500;
  const generate = () => { if (!valid) return; setNumbers(Array.from({ length: count }, () => randomInt(min, max))); setGeneratedRange(`${min}–${max}`); };
  return (
    <Card className="h-full flex flex-col">
      <CardHeader title={tr("随机数生成器")} description={tr("设置整数范围与数量，批量生成后可复制到表格或代码。")} />
      <CardContent className="grid gap-5 overflow-auto lg:grid-cols-[18rem_1fr]">
        <section className="tool-panel p-4 space-y-4 self-start">
          <div className="flex flex-wrap gap-2">{[[1, 6, tr('骰子')], [0, 1, tr('二选一')], [1, 100, '1–100']].map(([lo,hi,label]) => <Button key={label} size="sm" variant="secondary" onClick={() => { setMin(Number(lo)); setMax(Number(hi)); }}>{label}</Button>)}</div>
          <div><FieldLabel>{tr("最小值")}</FieldLabel><Input type="number" value={min} onChange={event => setMin(Number(event.target.value))} /></div>
          <div><FieldLabel>{tr("最大值")}</FieldLabel><Input type="number" value={max} onChange={event => setMax(Number(event.target.value))} /></div>
          <div><FieldLabel hint="1–500">{tr("数量")}</FieldLabel><Input type="number" min={1} max={500} value={count} onChange={event => setCount(Number(event.target.value))} /></div>
          {!valid && <p role="alert" className="text-xs text-red-600">{tr("请输入有效整数范围和 1–500 的数量，范围跨度需小于 2³²。")}</p>}
          <Button className="w-full" disabled={!valid} icon={<RefreshCcw className="h-4 w-4" />} onClick={generate}>{tr("生成随机数")}</Button>
        </section>
        <section className="space-y-4 min-w-0">
          <div className="flex flex-wrap justify-between items-center gap-3"><span className="text-xs text-slate-500">{numbers.length}{tr("个结果 ·")}{generatedRange}</span><div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => setView(view === 'grid' ? 'text' : 'grid')}>{view === 'grid' ? tr('纯文本') : tr('数字网格')}</Button><Button size="sm" onClick={() => copy(numbers.join('\n'))} icon={copied ? <Check className="h-4 w-4"/> : <Copy className="h-4 w-4"/>}>{tr("复制全部")}</Button></div></div>
          {view === 'grid' ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">{numbers.map((number,index) => <div key={index} className="tool-panel p-4 text-center font-mono text-xl font-semibold">{number}</div>)}</div> : <textarea readOnly value={numbers.join('\n')} className="tool-panel p-4 min-h-80 w-full font-mono text-sm" />}
        </section>
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

import { Plus, Trash2, Download } from 'lucide-react';

interface SchemaField {
  id: string;
  name: string;
  type: 'id' | 'uuid' | 'name' | 'phone' | 'email' | 'number' | 'text' | 'enum';
  min?: number;
  max?: number;
  options?: string;
}

type SchemaFieldType = SchemaField['type'];
type MockValue = string | number;
type MockRecord = Record<string, MockValue>;

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
  useLocaleRender();
  const [fields, setFields] = useState<SchemaField[]>([
    { id: 'f-1', name: 'id', type: 'id' },
    { id: 'f-2', name: 'name', type: 'name' },
    { id: 'f-3', name: 'email', type: 'email' },
    { id: 'f-4', name: 'age', type: 'number', min: 18, max: 65 },
    { id: 'f-5', name: 'role', type: 'enum', options: 'admin,editor,user' }
  ]);

  const [count, setCount] = useState<number>(20);
  const [sqlTableName, setSqlTableName] = useState<string>('tb_users');
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'sql' | 'msw' | 'express'>('json');

  const [output, setOutput] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [generatedFormat, setGeneratedFormat] = useState(exportFormat);
  const [previewRows, setPreviewRows] = useState<MockRecord[]>([]);
  const [view, setView] = useState<'table' | 'code'>('table');
  const validationError = !Number.isInteger(count) || count < 1 || count > 500 ? '记录数量必须是 1–500 的整数。' : fields.some(field => field.type === 'enum' && !field.options?.split(',').some(value => value.trim())) ? '枚举字段至少需要一个选项。' : !fields.length ? '至少添加一个字段。' : fields.some(field => !field.name.trim()) ? '字段名不能为空。' : new Set(fields.map(field => field.name.trim())).size !== fields.length ? '字段名不能重复。' : fields.some(field => field.type === 'number' && (!Number.isSafeInteger(field.min ?? 0) || !Number.isSafeInteger(field.max ?? 100) || (field.min ?? 0) > (field.max ?? 100) || (field.max ?? 100) - (field.min ?? 0) >= 2 ** 32)) ? '数值字段必须是有效整数范围，跨度需小于 2³²。' : '';
  const applyTemplate = (kind: 'users' | 'products') => {
    setFields(kind === 'users' ? [{ id: 't-1', name: 'id', type: 'id' }, { id: 't-2', name: 'name', type: 'name' }, { id: 't-3', name: 'email', type: 'email' }] : [{ id: 't-1', name: 'id', type: 'uuid' }, { id: 't-2', name: 'price', type: 'number', min: 10, max: 999 }, { id: 't-3', name: 'status', type: 'enum', options: 'available,sold_out,draft' }]);
    setSqlTableName(kind);
  };

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
    if (validationError) return;
    const safeCount = Math.min(500, Math.max(1, count));
    const rawData: MockRecord[] = [];

    // 1. Core Generator Engine
    for (let index = 0; index < safeCount; index++) {
      const row: MockRecord = Object.create(null);
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
            row[field.name] = `13${randomInt(0, 9)}${String(randomInt(0, 99999999)).padStart(8, '0')}`;
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

    setPreviewRows(rawData);
    setGeneratedFormat(exportFormat);
    const tName = sqlTableName.trim() || 'users';

    // 2. Export Compiler Engine
    if (exportFormat === 'json') {
      setOutput(JSON.stringify(rawData, null, 2));
    } else if (exportFormat === 'csv') {
      if (rawData.length === 0) {
        setOutput('');
        return;
      }
      const headers = Object.keys(rawData[0]).map(value => /[,"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value).join(',');
      const rows = rawData.map(row =>
        Object.values(row).map(val => {
          const s = String(val);
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
      const keys = Object.keys(rawData[0]).map(key => `"${key.replace(/"/g, '""')}"`).join(', ');
      const statements = rawData.map(row => {
        const values = Object.values(row).map(val => {
          if (typeof val === 'number') return val;
          return `'${String(val).replace(/'/g, "''")}'`;
        }).join(', ');
        return `INSERT INTO "${tName.replace(/"/g, '""')}" (${keys}) VALUES (${values});`;
      });
      setOutput(statements.join('\n'));
    } else if (exportFormat === 'msw') {
      const handlerName = tName.replace(/[^a-zA-Z0-9]/g, '');
      const apiPath = `/api/${handlerName}`;
      setOutput(`import { http, HttpResponse } from 'msw';

// 定义 Mock 数据集
const mock${handlerName.charAt(0).toUpperCase() + handlerName.slice(1)}List = ${JSON.stringify(rawData, null, 2)};

export const handlers = [
  // GET 请求拦截器
  http.get('${apiPath}', () => {
    return HttpResponse.json(mock${handlerName.charAt(0).toUpperCase() + handlerName.slice(1)}List);
  }),

  // POST 新增请求拦截器
  http.post('${apiPath}', async ({ request }) => {
    const newRecord = await request.json() as any;
    newRecord.id = mock${handlerName.charAt(0).toUpperCase() + handlerName.slice(1)}List.length + 1;
    return HttpResponse.json({
      success: true,
      data: newRecord
    }, { status: 201 });
  })
];`);
    } else if (exportFormat === 'express') {
      const handlerName = tName.replace(/[^a-zA-Z0-9]/g, '');
      const apiPath = `/api/${handlerName}`;
      setOutput(`const express = require('express');
const router = express.Router();

// Mock 数据集
const mockData = ${JSON.stringify(rawData, null, 2)};

/**
 * GET ${apiPath}
 * 获取 Mock 数据列表
 */
router.get('/${handlerName}', (req, res) => {
  const { limit } = req.query;
  if (limit) {
    return res.json(mockData.slice(0, parseInt(limit, 10)));
  }
  res.json(mockData);
});

/**
 * POST ${apiPath}
 * 新增 Mock 记录
 */
router.post('/${handlerName}', (req, res) => {
  const newRecord = req.body;
  newRecord.id = mockData.length + 1;
  newRecord.created_at = new Date().toISOString();
  mockData.push(newRecord);
  res.status(201).json({
    success: true,
    data: newRecord
  });
});

module.exports = router;`);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = () => {
    if (!output) return;
    const isJson = generatedFormat === 'json';
    const isCsv = generatedFormat === 'csv';
    const isSql = generatedFormat === 'sql';
    const isMsw = generatedFormat === 'msw';

    const ext = isJson ? 'json' : isCsv ? 'csv' : isSql ? 'sql' : isMsw ? 'ts' : 'js';
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
        title={tr("可视化 Schema 数据 Mock 发生器")}
        description={tr("选模板或配置字段，生成可检查的表格预览，再导出 JSON、CSV、SQL 或 API Mock 代码。")}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={!output} onClick={handleCopy} icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>
              {tr("一键复制")}</Button>
            <Button size="sm" variant="secondary" disabled={!output} onClick={handleDownload} icon={<Download className="h-4 w-4" />}>{tr("导出文件")}</Button>
            <Button size="sm" disabled={!!validationError} onClick={handleGenerate} icon={<RefreshCcw className="h-4 w-4" />}>{tr("生成数据")}</Button>
          </div>
        }
      />
      <CardContent className="grid min-h-0 flex-1 gap-5 overflow-auto lg:grid-cols-12">

        {/* Left Side: Schema Builder (5 cols equivalent) */}
        <div className="lg:col-span-5 flex flex-col gap-4 min-h-0 border-r border-slate-100 dark:border-slate-800 pr-3">
          <div className="flex items-center justify-between border-b pb-2 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-500 uppercase">{tr("Schema 字段配置")}</span>
            <button
              onClick={addField}
              className="flex items-center gap-1 py-1 px-2.5 rounded bg-primary-50 text-primary-600 hover:bg-primary-100 text-[10px] font-bold transition-all dark:bg-primary-950/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{tr("添加字段")}</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => applyTemplate('users')}>{tr("用户列表模板")}</Button><Button size="sm" variant="secondary" onClick={() => applyTemplate('products')}>{tr("商品列表模板")}</Button></div>
          {validationError && <p role="alert" className="text-xs text-red-600">{validationError}</p>}
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
                    placeholder={tr("字段名 (key)")}
                  />
                  <button
                    onClick={() => deleteField(field.id)}
                    className="text-slate-400 hover:text-rose-500 transition-colors opacity-70 hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-slate-400 block mb-0.5">{tr("类型")}</span>
                    <select
                      value={field.type}
                      onChange={e => updateField(field.id, { type: e.target.value as SchemaFieldType })}
                      className="w-full p-1 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded font-semibold"
                    >
                      <option value="id">{tr("自增 ID")}</option>
                      <option value="uuid">{tr("随机 UUID")}</option>
                      <option value="name">{tr("逼真中文姓名")}</option>
                      <option value="phone">{tr("中国手机号")}</option>
                      <option value="email">{tr("电子邮箱")}</option>
                      <option value="number">{tr("数值区间")}</option>
                      <option value="enum">{tr("固定枚举")}</option>
                      <option value="text">{tr("随机段落文本")}</option>
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
                      <span className="text-slate-400 block mb-0.5">{tr("枚举选项 (逗号隔开)")}</span>
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
          <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3.5 flex-none text-xs">
            <div>
              <FieldLabel>{tr("输出目标格式")}</FieldLabel>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                {(['json', 'csv', 'sql', 'msw', 'express'] as const).map(fmt => (
                  <button
                    key={fmt}
                    onClick={() => setExportFormat(fmt)}
                    className={`py-1.5 rounded-lg border text-xs font-semibold uppercase flex items-center justify-center gap-1 transition-all last:col-span-2 last:sm:col-span-1 ${exportFormat === fmt ? 'bg-primary-600 border-primary-600 text-white shadow-sm' : 'bg-white border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800'}`}
                  >
                    <span>{fmt}</span>
                  </button>
                ))}
              </div>
            </div>

            {exportFormat !== 'json' && exportFormat !== 'csv' && <div>
              <FieldLabel>{tr("API / 数据库表名")}</FieldLabel>
              <Input
                className="font-mono text-xs font-bold mt-1"
                value={sqlTableName}
                onChange={e => setSqlTableName(e.target.value)}
                placeholder="e.g. users"
              />
            </div>}

            <div>
              <FieldLabel>{tr("生成记录条数")}</FieldLabel>
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
              {previewRows.length ? "" + (previewRows.length) + tr(" 条记录 · ") + (generatedFormat.toUpperCase()) + "" : tr('生成结果')}
            </span>
          </div>
          {output && <div className="flex gap-2 px-4 py-2 bg-slate-900"><Button size="sm" variant={view === 'table' ? 'primary' : 'secondary'} onClick={() => setView('table')}>{tr("表格预览")}</Button><Button size="sm" variant={view === 'code' ? 'primary' : 'secondary'} onClick={() => setView('code')}>{tr("导出代码")}</Button></div>}
          {output && view === 'table' ? <div className="flex-1 overflow-auto bg-white"><table data-i18n-skip className="min-w-full text-left text-xs"><thead className="sticky top-0 bg-slate-50"><tr>{Object.keys(previewRows[0] || {}).map(key => <th key={key} className="p-3 border-b border-slate-200 font-mono">{key}</th>)}</tr></thead><tbody>{previewRows.slice(0,100).map((row,index) => <tr key={index} className="border-b border-slate-100">{Object.entries(row).map(([key,value]) => <td key={key} className="p-3 max-w-60 truncate" title={String(value)}>{value}</td>)}</tr>)}</tbody></table>{previewRows.length > 100 && <p className="p-3 text-xs text-slate-500">{tr("预览显示前 100 条，导出包含全部记录。")}</p>}</div> : <textarea
            readOnly
            className="flex-1 w-full h-full p-4 font-mono text-xs text-emerald-400 dark:text-emerald-300 bg-transparent border-0 outline-none resize-none leading-relaxed overflow-auto"
            value={output || '在左侧配置 Schema 字段，点击上方“生成数据”按钮查看结果...'}
            placeholder={tr("生成的假数据在此处呈现")}
          />}
        </div>

      </CardContent>
    </Card>
  );
};
