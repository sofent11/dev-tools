import React from 'react';
import { ClipboardList } from 'lucide-react';
import { Select } from '../../ui/ToolUi';
import { getScratchpadItemContent, useScratchpadStore, type ScratchpadItem } from './scratchpadStore';

type ScratchpadFilter = (item: ScratchpadItem) => boolean;

const defaultFilter: ScratchpadFilter = () => true;

export const isScratchpadTextLike = (item: ScratchpadItem) =>
  !item.isBinary ||
  item.mimeType?.startsWith('text/') ||
  ['text', 'json', 'svg', 'jsx', 'tsx'].includes(item.type);

export const isScratchpadImageLike = (item: ScratchpadItem) =>
  item.type === 'image' || Boolean(item.mimeType?.startsWith('image/'));

export const isScratchpadPdfLike = (item: ScratchpadItem) =>
  item.type === 'pdf' || item.mimeType === 'application/pdf' || item.name.toLowerCase().endsWith('.pdf');

export const isScratchpadKeyLike = (item: ScratchpadItem) =>
  isScratchpadTextLike(item) && (
    item.type === 'json' ||
    item.name.endsWith('.pem') ||
    item.name.endsWith('.json') ||
    item.name.endsWith('.key') ||
    item.name.endsWith('.txt')
  );

export const ScratchpadPicker: React.FC<{
  label?: string;
  placeholder?: string;
  filter?: ScratchpadFilter;
  onLoad: (content: string | Blob | ArrayBuffer, item: ScratchpadItem) => void | Promise<void>;
}> = ({
  label = '从暂存箱载入',
  placeholder = '选择暂存内容...',
  filter = defaultFilter,
  onLoad,
}) => {
  const items = useScratchpadStore(state => state.items);
  const compatibleItems = items.filter(filter);

  if (compatibleItems.length === 0) return null;

  return (
    <label className="grid gap-1.5 text-xs font-medium text-slate-500">
      <span className="inline-flex items-center gap-1.5">
        <ClipboardList className="h-3.5 w-3.5" />
        {label}
      </span>
      <Select
        value=""
        onChange={async event => {
          const selected = compatibleItems.find(item => item.id === event.target.value);
          if (!selected) return;
          const content = await getScratchpadItemContent(selected);
          await onLoad(content, selected);
          event.target.value = '';
        }}
      >
        <option value="" disabled>{placeholder}</option>
        {compatibleItems.map(item => (
          <option key={item.id} value={item.id}>
            {item.name} · {Math.max(1, Math.round(item.size / 1024))}KB
          </option>
        ))}
      </Select>
    </label>
  );
};

export const ScratchpadActionBar: React.FC<{
  children?: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div className={`rounded-xl border border-slate-200 bg-slate-50 p-3 ${className}`}>
    {children}
  </div>
);
