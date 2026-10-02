import React from 'react';
import { ArrowDownToLine, Copy, FlaskConical, RotateCcw } from 'lucide-react';
import { Button } from '../../ui/Button';
import { useCopyToClipboard } from './useCopyToClipboard';

export const ContentToolbar: React.FC<{
  onSample?: () => void;
  onClear?: () => void;
  children?: React.ReactNode;
  status?: React.ReactNode;
}> = ({ onSample, onClear, children, status }) => (
  <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
    {children}
    <div className="ml-auto flex flex-wrap items-center gap-1">
      {status && <span className="mr-2 text-xs text-slate-500" aria-live="polite">{status}</span>}
      {onSample && <Button size="sm" variant="ghost" icon={<FlaskConical className="h-3.5 w-3.5" />} onClick={onSample}>载入示例</Button>}
      {onClear && <Button size="sm" variant="ghost" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={onClear}>清空</Button>}
    </div>
  </div>
);

export const ContentEditor: React.FC<{
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  actions?: React.ReactNode;
  error?: string | null;
  output?: boolean;
  onUseResult?: () => void;
  children?: React.ReactNode;
}> = ({ label, value, onChange, placeholder, actions, error, output, onUseResult, children }) => {
  const { copied, copy } = useCopyToClipboard();
  const editorId = React.useId();
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><label htmlFor={editorId} className="text-sm font-semibold text-slate-800">{label}</label><span className="font-mono text-[11px] text-slate-400">{value.length.toLocaleString()} 字符</span></div>
        <div className="flex flex-wrap items-center gap-1">
          {actions}
          {output && <Button size="xs" variant="ghost" onClick={() => copy(value)} disabled={!value} icon={<Copy className="h-3.5 w-3.5" />}>{copied ? '已复制' : '复制结果'}</Button>}
          {onUseResult && <Button size="xs" variant="secondary" onClick={onUseResult} disabled={!value} icon={<ArrowDownToLine className="h-3.5 w-3.5" />}>继续处理</Button>}
        </div>
      </div>
      {children || <textarea id={editorId} aria-label={label} value={value} onChange={event => onChange?.(event.target.value)} readOnly={!onChange} placeholder={placeholder} spellCheck={false} className={`min-h-64 w-full flex-1 resize-y rounded-lg border p-4 font-mono text-sm leading-6 outline-none focus:ring-2 focus:ring-primary-200 ${error ? 'border-red-300' : 'border-slate-200'} ${output ? 'bg-slate-50' : 'bg-white'}`} />}
      {error && <p role="alert" className="status-error rounded-lg px-3 py-2 text-sm">{error}</p>}
    </section>
  );
};

export const ContentOptions: React.FC<{ children: React.ReactNode; title?: string }> = ({ children, title = '处理选项' }) => (
  <details className="tool-panel p-3">
    <summary className="cursor-pointer text-sm font-medium text-slate-700">{title}</summary>
    <div className="mt-3 flex flex-wrap items-end gap-4">{children}</div>
  </details>
);
