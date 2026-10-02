import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FolderOpen, Hand, Maximize, MousePointer2, PenLine, Save, Trash2, Undo2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';
import { GeometryCanvas } from './components/GeometryCanvas';
import { TeachingSlides } from './components/TeachingSlides';
import { MOCK_QUESTION } from './data/mockData';
import { useGeometryStore, type Tool } from './store/useGeometryStore';
import type { GeometryQuestion } from './types';
import { notifyToast } from '../shared/notifyToast';
import { Button } from '../../ui/Button';
import { ContentToolbar } from '../shared/ContentWorkflow';
import { WorkflowNotice } from '../shared/WorkflowUi';

function isGeometryQuestion(value: unknown): value is GeometryQuestion {
  if (!value || typeof value !== 'object') return false;
  const question = value as Partial<GeometryQuestion>;
  const { points, lines, polygons } = question.entities || {};
  const isRecord = (record: unknown): record is Record<string, unknown> => Boolean(record && typeof record === 'object' && !Array.isArray(record));
  if (typeof question.id !== 'string' || !question.id || typeof question.meta?.title !== 'string' || !isRecord(points) || !isRecord(lines) || !isRecord(polygons) || !Array.isArray(question.constraints) || !Array.isArray(question.slides)) return false;
  if (Object.values(points).some(point => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.label !== undefined && typeof point.label !== 'string')) return false;
  if (Object.values(lines).some(line => !line || typeof line.from !== 'string' || typeof line.to !== 'string' || !Object.hasOwn(points, line.from) || !Object.hasOwn(points, line.to))) return false;
  if (Object.values(polygons).some(polygon => !polygon || !Array.isArray(polygon.vertices) || polygon.vertices.some(id => typeof id !== 'string' || !Object.hasOwn(points, id)))) return false;
  if (question.meta.originalText !== undefined && typeof question.meta.originalText !== 'string') return false;
  const validAnnotations = (annotations: unknown) => annotations === undefined || Array.isArray(annotations) && annotations.every(annotation => annotation && typeof annotation.text === 'string' && Number.isFinite(annotation.x) && Number.isFinite(annotation.y));
  if (!validAnnotations(question.initialAnnotations) || question.slides.some(slide => !slide || typeof slide.caption !== 'string' || !validAnnotations(slide.annotations))) return false;
  return true;
}

const DRAWING_TOOLS: Array<{ id: Tool; label: string; key: string; hint: string; icon: React.ReactNode }> = [
  { id: 'pan', label: '移动画布', key: 'P', hint: '拖拽空白处移动画布；滚轮缩放。', icon: <Hand className="h-4 w-4" /> },
  { id: 'move', label: '移动顶点', key: 'V', hint: '拖拽顶点改变位置，观察图形随之变化。', icon: <MousePointer2 className="h-4 w-4" /> },
  { id: 'line', label: '画辅助线', key: 'L', hint: '从起点拖到终点；靠近顶点、中点或垂足时自动吸附。', icon: <PenLine className="h-4 w-4" /> },
];

export const SmartGeometryTool: React.FC = () => {
  const { auxHistory, clearAuxiliaryLines, mode, question, setMode, setQuestion, setTool, tool, undoLastAux, setViewport, setDraftLine, setSnappedPoint } = useGeometryStore();
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const sourceQuestionRef = useRef(structuredClone(question || MOCK_QUESTION));
  const [inputError, setInputError] = useState('');
  const [questionVersion, setQuestionVersion] = useState(0);

  useEffect(() => {
    if (!useGeometryStore.getState().question) setQuestion(structuredClone(MOCK_QUESTION));
  }, [setQuestion]);

  const fitCanvas = useCallback(() => {
    const host = canvasHostRef.current;
    const activeQuestion = useGeometryStore.getState().question;
    if (!host || !activeQuestion) return;
    const points = Object.values(activeQuestion.entities.points).filter(point => !point.isSolution);
    if (!points.length) return;
    const minX = Math.min(...points.map(point => point.x));
    const maxX = Math.max(...points.map(point => point.x));
    const minY = Math.min(...points.map(point => point.y));
    const maxY = Math.max(...points.map(point => point.y));
    const zoom = Math.max(0.01, Math.min(1.5, (host.clientWidth - 72) / Math.max(1, maxX - minX), (host.clientHeight - 100) / Math.max(1, maxY - minY)));
    setViewport({ x: host.clientWidth / 2 - ((minX + maxX) / 2) * zoom, y: host.clientHeight / 2 - ((minY + maxY) / 2) * zoom, zoom });
  }, [setViewport]);

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host || mode !== 'interactive') return;
    const observer = new ResizeObserver(fitCanvas);
    observer.observe(host);
    return () => observer.disconnect();
  }, [fitCanvas, mode, question?.id, questionVersion]);

  const chooseTool = useCallback((next: Tool) => {
    setDraftLine(null);
    setSnappedPoint(null);
    setTool(next);
  }, [setDraftLine, setSnappedPoint, setTool]);

  useEffect(() => {
    const shortcuts = (event: KeyboardEvent) => {
      if (mode !== 'interactive' || event.target instanceof HTMLElement && (event.target.matches('input, textarea, select') || event.target.isContentEditable)) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); undoLastAux(); return; }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const next = DRAWING_TOOLS.find(item => item.key.toLowerCase() === event.key.toLowerCase());
      if (next) chooseTool(next.id);
      if (event.key === 'Escape') { setDraftLine(null); setSnappedPoint(null); }
    };
    window.addEventListener('keydown', shortcuts);
    return () => window.removeEventListener('keydown', shortcuts);
  }, [chooseTool, mode, setDraftLine, setSnappedPoint, undoLastAux]);

  const loadQuestion = (next: GeometryQuestion) => {
    sourceQuestionRef.current = structuredClone(next);
    setQuestion(structuredClone(next));
    setMode('interactive');
    chooseTool('pan');
    setQuestionVersion(version => version + 1);
    setInputError('');
  };
  const resetExercise = () => {
    setQuestion(structuredClone(sourceQuestionRef.current));
    chooseTool('pan');
    setQuestionVersion(version => version + 1);
  };
  const handleSaveJson = () => {
    if (!question) return;
    const blob = new Blob([JSON.stringify(question, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${question.meta.title || 'geometry_question'}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const handleLoadJson = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isGeometryQuestion(parsed)) throw new Error('题目结构或图形引用不完整。');
      loadQuestion(parsed);
    } catch {
      const message = '请检查题目包含 points、lines、polygons、constraints 与 slides，且线段和多边形引用有效顶点。';
      setInputError(message);
      notifyToast({ title: 'JSON 文件格式不正确', description: message, tone: 'error' });
    } finally { if (jsonInputRef.current) jsonInputRef.current.value = ''; }
  };
  const auxiliaryCount = Object.values(question?.entities.lines || {}).filter(line => line.isAuxiliary).length;
  const currentTool = DRAWING_TOOLS.find(item => item.id === tool)!;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-auto">
      <section className="tool-section space-y-4 p-4">
        <ContentToolbar onSample={() => loadQuestion(MOCK_QUESTION)}>
          <input ref={jsonInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleLoadJson} />
          <Button size="sm" variant="secondary" onClick={() => jsonInputRef.current?.click()} icon={<FolderOpen className="h-4 w-4" />}>导入题目</Button>
          <Button size="sm" variant="secondary" onClick={handleSaveJson} disabled={!question} icon={<Save className="h-4 w-4" />}>保存练习</Button>
          <Button size="sm" variant="ghost" onClick={resetExercise} disabled={!question}>重置练习</Button>
        </ContentToolbar>
        {inputError && <WorkflowNotice tone="error" onDismiss={() => setInputError('')}>{inputError}</WorkflowNotice>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-base font-semibold">{question?.meta.title || '智能几何练习'}</h2><p className="mt-1 text-xs text-slate-500">{question?.meta.difficulty === 'easy' ? '简单' : question?.meta.difficulty === 'hard' ? '困难' : '中等'} · {mode === 'interactive' ? '动手作图，探索辅助线' : '按步骤观察图形与解题思路'}</p></div>
          <div className="flex rounded-lg border p-1"><Button size="sm" variant={mode === 'interactive' ? 'primary' : 'ghost'} aria-pressed={mode === 'interactive'} onClick={() => { setMode('interactive'); chooseTool('pan'); }}>自由作图</Button><Button size="sm" variant={mode === 'teaching' ? 'primary' : 'ghost'} aria-pressed={mode === 'teaching'} disabled={!question?.slides.length} onClick={() => { setMode('teaching'); setDraftLine(null); setSnappedPoint(null); }}>分步讲解</Button></div>
        </div>
        {question && !question.slides.length && <p className="text-xs text-slate-500">此题没有讲解步骤，请使用自由作图。</p>}
      </section>
      <div className="grid min-h-0 flex-1 items-start gap-4 xl:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="tool-section space-y-4 p-4">
          <details open><summary className="cursor-pointer text-sm font-semibold">题目已知条件</summary><div className="markdown-body mt-3 text-sm leading-7 text-slate-700"><ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{question?.meta.originalText || '此题未提供文字条件，请直接观察图形。'}</ReactMarkdown></div></details>
          <div className="border-t pt-3 text-xs text-slate-500"><div className="flex justify-between"><span>顶点</span><span>{Object.keys(question?.entities.points || {}).length}</span></div><div className="mt-2 flex justify-between"><span>辅助线</span><span>{auxiliaryCount}</span></div></div>
          <details><summary className="cursor-pointer text-xs font-medium text-slate-500">操作提示与快捷键</summary><ul className="mt-3 space-y-2 text-xs leading-5 text-slate-500"><li>P · 移动画布</li><li>V · 移动顶点</li><li>L · 绘制辅助线</li><li>⌘ / Ctrl + Z · 撤销辅助线</li><li>Esc · 取消正在绘制的线</li></ul></details>
        </aside>
        <section className="tool-section flex min-w-0 flex-col overflow-hidden">
          {mode === 'interactive' && <div className="space-y-3 border-b p-3">
            <div className="flex flex-wrap items-center gap-2">{DRAWING_TOOLS.map(item => <Button key={item.id} size="sm" variant={tool === item.id ? 'primary' : 'ghost'} aria-pressed={tool === item.id} onClick={() => chooseTool(item.id)} icon={item.icon}>{item.label}</Button>)}<span className="hidden h-5 w-px bg-slate-200 sm:block" /><Button size="sm" variant="ghost" disabled={!auxHistory.length} onClick={undoLastAux} icon={<Undo2 className="h-4 w-4" />}>撤销</Button><Button size="sm" variant="ghost" disabled={!auxiliaryCount} onClick={clearAuxiliaryLines} icon={<Trash2 className="h-4 w-4" />}>清空辅助线</Button><Button size="sm" variant="secondary" onClick={fitCanvas} icon={<Maximize className="h-4 w-4" />}>适应画布</Button></div>
            <p className="text-xs text-slate-500" aria-live="polite"><span className="font-semibold text-primary-700">{currentTool.label} · {currentTool.key}</span> — {currentTool.hint}</p>
          </div>}
          <div ref={canvasHostRef} className="relative min-h-[420px] w-full bg-white xl:h-[min(65vh,650px)]">
            <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.03]" aria-hidden="true"><defs><pattern id="smart-geometry-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" /></pattern></defs><rect width="100%" height="100%" fill="url(#smart-geometry-grid)" /></svg>
            {mode === 'interactive' ? <GeometryCanvas /> : <div className="min-h-[520px] [&>div]:p-3"><TeachingSlides key={`${question?.id}-${questionVersion}`} /></div>}
          </div>
        </section>
      </div>
    </div>
  );
};

export default SmartGeometryTool;
