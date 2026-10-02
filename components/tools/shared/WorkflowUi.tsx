import React, { useId, useRef, useState } from 'react';
import { FileUp, X, ArrowRight } from 'lucide-react';
import { useI18n } from '../../../src/i18n';

export const FileDropzone: React.FC<{
  accept?: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  title?: string;
  hint?: string;
  fileName?: string;
  disabled?: boolean;
  compact?: boolean;
}> = ({ accept, multiple = false, onFiles, title = '选择文件或拖到这里', hint = '文件在浏览器本地处理', fileName, disabled = false, compact = false }) => {
  const { t } = useI18n();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const selectFiles = (files: FileList | null) => {
    if (!files || disabled) return;
    const selected = Array.from(files);
    onFiles(multiple ? selected : selected.slice(0, 1));
  };
  return (
    <div
      className={`workflow-upload ${compact || fileName ? 'is-compact' : ''} ${dragging ? 'is-dragging' : ''}`}
      onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
      onDrop={event => { event.preventDefault(); setDragging(false); selectFiles(event.dataTransfer.files); }}
    >
      <label htmlFor={id} className={disabled ? 'pointer-events-none opacity-50' : ''}>
        <span className="workflow-upload-icon"><FileUp className="h-5 w-5" /></span>
        <span className="min-w-0"><strong data-i18n-skip={fileName ? true : undefined}>{fileName || t(title)}</strong><small>{t(fileName ? '选择其他文件' : hint)}</small></span>
        <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
      </label>
      <input id={id} ref={input} className="sr-only" type="file" accept={accept} multiple={multiple} disabled={disabled} onChange={event => { selectFiles(event.target.files); event.target.value = ''; }} />
    </div>
  );
};

export const WorkflowEmpty: React.FC<{ title: string; description: string; icon?: React.ReactNode; children?: React.ReactNode }> = ({ title, description, icon, children }) => {
  const { t } = useI18n();
  return <div className="workflow-empty">{icon && <span>{icon}</span>}<h3>{t(title)}</h3><p>{t(description)}</p>{children}</div>;
};

export const WorkflowSteps: React.FC<{ steps: string[]; active: number }> = ({ steps, active }) => {
  const { t } = useI18n();
  return <ol className="workflow-steps" aria-label={t('操作流程')}>{steps.map((step, index) => <li key={step} data-state={index < active ? 'complete' : index === active ? 'current' : 'waiting'} aria-current={index === active ? 'step' : undefined}><span>{String(index + 1).padStart(2, '0')}</span>{t(step)}</li>)}</ol>;
};

export const WorkflowNotice: React.FC<{ children: React.ReactNode; tone?: 'info' | 'error'; onDismiss?: () => void }> = ({ children, tone = 'info', onDismiss }) => {
  const { t } = useI18n();
  return <div className={`workflow-notice is-${tone}`} role={tone === 'error' ? 'alert' : 'status'}><span>{children}</span>{onDismiss && <button type="button" aria-label={t('关闭提示')} onClick={onDismiss}><X className="h-4 w-4" /></button>}</div>;
};
