import React, { useEffect, useRef } from 'react';
import { FolderOpen, Hand, MousePointer2, PenLine, Save, Trash2, Undo2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';
import { GeometryCanvas } from './components/GeometryCanvas';
import { TeachingSlides } from './components/TeachingSlides';
import { MOCK_QUESTION } from './data/mockData';
import { cn } from './lib/utils';
import { useGeometryStore } from './store/useGeometryStore';
import type { GeometryQuestion } from './types';

function isGeometryQuestion(value: unknown): value is GeometryQuestion {
  if (!value || typeof value !== 'object') return false;

  const maybeQuestion = value as Partial<GeometryQuestion>;
  return Boolean(
    maybeQuestion.id &&
    maybeQuestion.meta &&
    maybeQuestion.entities?.points &&
    maybeQuestion.entities?.lines &&
    maybeQuestion.entities?.polygons &&
    Array.isArray(maybeQuestion.constraints) &&
    Array.isArray(maybeQuestion.slides),
  );
}

export const SmartGeometryTool: React.FC = () => {
  const {
    auxHistory,
    clearAuxiliaryLines,
    mode,
    question,
    setMode,
    setQuestion,
    setTool,
    tool,
    undoLastAux,
  } = useGeometryStore();
  const jsonInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQuestion(MOCK_QUESTION);
  }, [setQuestion]);

  const handleSaveJson = () => {
    if (!question) return;

    const jsonString = JSON.stringify(question, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${question.meta.title || 'geometry_question'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleLoadJson = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const content = loadEvent.target?.result as string;
        const parsed = JSON.parse(content);
        if (!isGeometryQuestion(parsed)) {
          throw new Error('JSON does not match the geometry question schema.');
        }
        setQuestion(parsed);
        setMode('interactive');
      } catch (error) {
        window.alert('JSON 文件格式不正确，请检查题目结构。');
        console.error(error);
      } finally {
        if (jsonInputRef.current) jsonInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="tool-section flex h-full min-h-[620px] w-full flex-col overflow-hidden bg-slate-50 text-slate-900">
      <header className="relative z-10 flex h-auto min-h-16 shrink-0 flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex flex-wrap items-center gap-4 md:gap-6">
          <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-1">
            <button
              onClick={() => setMode('interactive')}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-all md:px-4',
                mode === 'interactive'
                  ? 'bg-white text-primary-700 shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              交互模式
            </button>
            <button
              onClick={() => setMode('teaching')}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-all md:px-4',
                mode === 'teaching'
                  ? 'bg-white text-primary-700 shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              教学模式
            </button>
          </div>

          <div className="hidden h-6 w-px bg-slate-200 md:block" />
          <div>
            <h1 className="text-base font-bold text-slate-900 md:text-lg">
              {question?.meta.title || '智能几何练习'}
            </h1>
            <p className="text-xs font-semibold uppercase text-slate-500">小学几何解题工作区</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <input
            ref={jsonInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleLoadJson}
          />
          <button
            onClick={() => jsonInputRef.current?.click()}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            <FolderOpen size={16} />
            加载 JSON
          </button>
          <button
            onClick={handleSaveJson}
            disabled={!question}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={16} />
            保存 JSON
          </button>

          <span
            className={cn(
              'rounded border px-2 py-1 text-[10px] font-bold uppercase',
              question?.meta.difficulty === 'easy' && 'border-green-200 bg-green-50 text-green-700',
              question?.meta.difficulty === 'medium' && 'border-amber-200 bg-amber-50 text-amber-700',
              question?.meta.difficulty === 'hard' && 'border-rose-200 bg-rose-50 text-rose-700',
            )}
          >
            {question?.meta.difficulty === 'easy'
              ? '简单'
              : question?.meta.difficulty === 'hard'
                ? '困难'
                : '中等'}
          </span>
        </div>
      </header>

      <main className="relative flex min-h-0 flex-1 overflow-hidden">
        {mode === 'interactive' && (
          <nav className="relative z-20 flex w-14 shrink-0 flex-col items-center gap-6 border-r border-slate-200 bg-white py-5 md:w-16">
            <div className="flex flex-col items-center gap-3">
              <ToolButton active={tool === 'pan'} onClick={() => setTool('pan')} icon={<Hand size={20} />} label="漫游画布" />
              <ToolButton
                active={tool === 'move'}
                onClick={() => setTool('move')}
                icon={<MousePointer2 size={20} />}
                label="移动端点"
              />
              <ToolButton
                active={tool === 'line'}
                onClick={() => setTool('line')}
                icon={<PenLine size={20} />}
                label="画辅助线"
              />
              <div className="my-1 h-px w-8 bg-slate-100" />
              <ToolButton
                onClick={undoLastAux}
                icon={<Undo2 size={20} />}
                label="撤销辅助线"
                disabled={auxHistory.length === 0}
              />
              <ToolButton onClick={clearAuxiliaryLines} icon={<Trash2 size={20} />} label="清空辅助线" />
            </div>
          </nav>
        )}

        <div className="relative flex-1 overflow-hidden bg-white">
          <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.03]" width="100%" height="100%">
            <defs>
              <pattern id="smart-geometry-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#000" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#smart-geometry-grid)" />
          </svg>

          {mode === 'interactive' ? <GeometryCanvas /> : <TeachingSlides />}

          {mode === 'interactive' && question?.meta?.originalText && (
            <div className="pointer-events-none absolute left-4 top-4 z-10 max-w-[min(24rem,calc(100%-2rem))] rounded-lg border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur-sm md:left-6 md:top-6">
              <h3 className="mb-2 border-b border-slate-200 pb-2 text-sm font-bold text-slate-800">题目已知条件</h3>
              <div className="markdown-body text-sm font-medium leading-relaxed text-slate-700">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {question.meta.originalText}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

function ToolButton({
  active,
  disabled,
  icon,
  label,
  onClick,
}: {
  active?: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      disabled={disabled}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-lg border transition-all',
        active
          ? 'border-primary-200 bg-primary-50 text-primary-700'
          : disabled
            ? 'pointer-events-none border-transparent text-slate-300'
            : 'border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900',
      )}
    >
      {icon}
    </button>
  );
}

export default SmartGeometryTool;
