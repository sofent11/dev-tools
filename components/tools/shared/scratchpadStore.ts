import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ScratchpadItem {
  id: string;
  name: string;
  content: string;
  type: string;
  timestamp: number;
}

interface ScratchpadState {
  items: ScratchpadItem[];
  addItem: (name: string, content: string, type?: string) => void;
  removeItem: (id: string) => void;
  clearAll: () => void;
}

declare global {
  interface Window {
    __devToolboxScratchpadBridge?: EventListener;
  }
}

const createScratchpadItemId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const useScratchpadStore = create<ScratchpadState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (name, content, type = 'text') => set((state) => {
        const newItem: ScratchpadItem = {
          id: createScratchpadItemId(),
          name,
          content,
          type,
          timestamp: Date.now()
        };
        // Filter out items with the same name to prevent duplicates, then place new item on top
        const filtered = state.items.filter(item => item.name !== name);
        return { items: [newItem, ...filtered] };
      }),
      removeItem: (id) => set((state) => ({
        items: state.items.filter((item) => item.id !== id)
      })),
      clearAll: () => set({ items: [] }),
    }),
    {
      name: 'devtoolbox-scratchpad-storage',
    }
  )
);

// Optional global bridge listener for tools that dispatch via CustomEvent
if (typeof window !== 'undefined') {
  if (window.__devToolboxScratchpadBridge) {
    window.removeEventListener('add-scratchpad-item', window.__devToolboxScratchpadBridge);
  }

  const scratchpadBridge = ((e: CustomEvent<{ name: string; content: string; type?: string }>) => {
    if (e.detail && e.detail.name && typeof e.detail.content === 'string') {
      useScratchpadStore.getState().addItem(e.detail.name, e.detail.content, e.detail.type || 'text');
    }
  }) as EventListener;

  window.__devToolboxScratchpadBridge = scratchpadBridge;
  window.addEventListener('add-scratchpad-item', scratchpadBridge);

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      window.removeEventListener('add-scratchpad-item', scratchpadBridge);
      if (window.__devToolboxScratchpadBridge === scratchpadBridge) {
        delete window.__devToolboxScratchpadBridge;
      }
    });
  }
}
