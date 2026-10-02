import { translateUi as tr, useLocaleRender } from '../../src/i18n/render';
import { generateJsonCode } from './data/jsonCode';
import { useDraftState } from './shared/useDraftState';
import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';

import { ContentEditor, ContentToolbar, ContentOptions } from './shared/ContentWorkflow';

export const JsonToTsTool: React.FC = () => {
  useLocaleRender();
  const [input, setInput] = useDraftState('components/tools/JsonToTsTool.tsx:JsonToTsTool:input', '');
  const [output, setOutput] = useState('');
  const [language, setLanguage] = useState('typescript');
  const [typeName, setTypeName] = useState('Root');
  const [error, setError] = useState<string | null>(null);

  const handleConvert = () => {
    if (!input.trim()) {
      setError("Please enter JSON content.");
      return;
    }

    setError(null);
    setOutput('');

    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(input);
      } catch (e) {
        throw new Error("Invalid JSON: " + (e as Error).message);
      }

      if (input.length > 1_000_000) throw new Error('JSON code input limit: 1 MB');
      setOutput(generateJsonCode(parsed, language, typeName));
    } catch (e) {
      console.error(e);
      setError((e as Error).message || "Conversion failed");
    }
  };

  const updateInput = (value: string) => { setInput(value); setError(null); setOutput(''); };
  return <Card className="flex h-full min-h-0 flex-col"><CardContent className="min-h-0 flex-1 space-y-4 overflow-auto">
    <ContentToolbar onSample={() => updateInput('{"id":1,"name":"Atelier","active":true,"tags":["design","tools"],"profile":{"locale":"zh-CN"}}')} onClear={() => updateInput('')}>
      <label className="flex items-center gap-2 text-sm">{tr("目标语言")}<select aria-label={tr("目标语言")} value={language} onChange={event => { setLanguage(event.target.value); setOutput(''); }} className="rounded-lg border p-2">
        <option value="typescript">TypeScript</option><option value="go">Go Struct</option><option value="java">Java Class</option><option value="python">Python Pydantic</option><option value="rust">Rust Struct</option><option value="sql">SQL DDL · MySQL</option>
      </select></label>
      <Button onClick={handleConvert} disabled={!input.trim()} icon={<ArrowRight className="h-4 w-4" />}>{tr("生成代码")}</Button>
    </ContentToolbar>
    <ContentOptions title={tr("命名与生成选项")}><label className="flex items-center gap-2 text-sm">{tr("根类型名称")}<input aria-label={tr("根类型名称")} className="rounded-lg border px-3 py-2 font-mono" value={typeName} onChange={event => { setTypeName(event.target.value); setOutput(''); }} /></label><p className="text-xs text-slate-500">{tr("根据样例推断类型；混合数组保留联合类型或使用通用类型。Java 输出为普通 DTO，JSON 字段名变化会标为注释；SQL 目标使用 MySQL 方言。")}</p></ContentOptions>
    <div className="grid gap-4 lg:grid-cols-2"><ContentEditor label={tr("JSON 样例")} value={input} onChange={updateInput} error={error} placeholder={tr("粘贴 API 响应或有代表性的数据样例。")} /><ContentEditor label={tr("生成的代码")} value={output} output placeholder={tr("选择目标语言并生成代码。")} /></div>
  </CardContent></Card>;
};
