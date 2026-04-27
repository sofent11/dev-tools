import React from 'react';
import { twMerge } from 'tailwind-merge';

type NativeInputProps = React.InputHTMLAttributes<HTMLInputElement>;
type NativeTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;
type NativeSelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Input = React.forwardRef<HTMLInputElement, NativeInputProps>(
  ({ className = '', ...props }, ref) => (
    <input
      ref={ref}
      className={twMerge(
        'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-none outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, NativeTextareaProps>(
  ({ className = '', ...props }, ref) => (
    <textarea
      ref={ref}
      className={twMerge(
        'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-950 shadow-none outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className = '', children, ...props }, ref) => (
    <select
      ref={ref}
      className={twMerge(
        'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-none outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

export const FieldLabel: React.FC<{
  children: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}> = ({ children, hint, className = '' }) => (
  <label className={twMerge('field-label', className)}>
    <span>{children}</span>
    {hint && <span className="text-xs font-medium text-slate-400">{hint}</span>}
  </label>
);

export const ToolShell: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div className={twMerge('flex h-full min-h-0 flex-col gap-4', className)}>{children}</div>
);

export const CodePanel: React.FC<{
  children?: React.ReactNode;
  className?: string;
  muted?: boolean;
}> = ({ children, className = '', muted = false }) => (
  <div
    className={twMerge(
      muted
        ? 'rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-sm text-slate-700'
        : 'code-surface p-3 font-mono text-sm',
      className,
    )}
  >
    {children}
  </div>
);

export const ResultPanel: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div className={twMerge('tool-section p-4', className)}>{children}</div>
);

export const UploadPanel: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div className={twMerge('tool-upload', className)}>{children}</div>
);

export const Tabs: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div className={twMerge('flex flex-wrap gap-1 border-b border-slate-200 bg-white px-4', className)}>
    {children}
  </div>
);

export const TabButton: React.FC<{
  active?: boolean;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}> = ({ active = false, children, className = '', onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={twMerge(
      'border-b-2 px-3 py-3 text-sm font-medium transition-colors',
      active
        ? 'border-primary-500 text-primary-700'
        : 'border-transparent text-slate-500 hover:text-slate-900',
      className,
    )}
  >
    {children}
  </button>
);
