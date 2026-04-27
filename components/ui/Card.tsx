import React from 'react';
import { twMerge } from 'tailwind-merge';

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <section
    className={twMerge(
      'min-h-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm',
      className,
    )}
  >
    {children}
  </section>
);

export const CardHeader: React.FC<{
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}> = ({ title, description, actions, className = '' }) => (
  <div
    className={twMerge(
      'flex flex-none flex-col gap-3 border-b border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between',
      className,
    )}
  >
    <div className="min-w-0">
      <h2 className="truncate text-base font-semibold tracking-normal text-slate-950">{title}</h2>
      {description && <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export const CardContent: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => <div className={twMerge('p-5', className)}>{children}</div>;
