import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { saveEntity, deleteEntity, getEntity, clearEntities } from './scratchpadDb';

export interface ScratchpadItem {
  id: string;
  name: string;
  content: string; // Lightweight text content, or empty string for large text/binary
  type: string;    // 'text', 'json', 'svg', 'image', 'pdf', 'zip'
  timestamp: number;
  isLarge?: boolean;
  isBinary?: boolean;
  size: number;
  mimeType?: string;
  thumbnail?: string; // Tiny Base64 JPEG for visual image previews
}

interface ScratchpadState {
  items: ScratchpadItem[];
  addItem: (name: string, content: string | Blob | ArrayBuffer, type?: string, mimeType?: string) => void;
  addItemAsync: (name: string, content: string | Blob | ArrayBuffer, type?: string, mimeType?: string) => Promise<string>;
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

const generateImageThumbnail = (content: string | Blob): Promise<string | undefined> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(undefined);
      return;
    }
    const img = new Image();
    let objectUrlToCleanup: string | null = null;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 120;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, w, h);
        try {
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        } catch {
          resolve(undefined);
        }
      } else {
        resolve(undefined);
      }
      if (objectUrlToCleanup) URL.revokeObjectURL(objectUrlToCleanup);
    };

    img.onerror = () => {
      resolve(undefined);
      if (objectUrlToCleanup) URL.revokeObjectURL(objectUrlToCleanup);
    };

    if (content instanceof Blob) {
      objectUrlToCleanup = URL.createObjectURL(content);
      img.src = objectUrlToCleanup;
    } else if (typeof content === 'string') {
      if (content.startsWith('data:image/') || content.startsWith('http')) {
        img.src = content;
      } else {
        resolve(undefined);
      }
    } else {
      resolve(undefined);
    }
  });
};

export const getScratchpadItemContent = async (item: ScratchpadItem): Promise<string | Blob | ArrayBuffer> => {
  if (!item.isLarge && !item.isBinary && item.content) {
    return item.content;
  }
  try {
    return await getEntity(item.id);
  } catch (err) {
    console.error(`Failed to load content for scratchpad item: ${item.id}`, err);
    return item.content || '';
  }
};

export const useScratchpadStore = create<ScratchpadState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (name, content, type = 'text', mimeType) => {
        // Fire-and-forget wrapper around addItemAsync
        get().addItemAsync(name, content, type, mimeType).catch((err) => {
          console.error('Background scratchpad stashing failed:', err);
        });
      },

      addItemAsync: async (name, content, type = 'text', mimeType) => {
        const id = createScratchpadItemId();
        const timestamp = Date.now();
        let isLarge = false;
        let isBinary = false;
        let size = 0;
        let resolvedMime = mimeType;
        let contentForZustand = '';
        let thumbnail: string | undefined = undefined;

        if (content instanceof Blob) {
          isBinary = true;
          size = content.size;
          if (!resolvedMime) resolvedMime = content.type;
          
          if (content.type.startsWith('image/')) {
            thumbnail = await generateImageThumbnail(content);
          }
        } else if (content instanceof ArrayBuffer) {
          isBinary = true;
          size = content.byteLength;
        } else if (typeof content === 'string') {
          size = content.length;
          // Set threshold for IndexedDB transition to 100KB (approx 100,000 characters)
          if (size >= 100000) {
            isLarge = true;
          } else {
            contentForZustand = content;
          }

          if (type === 'image' || content.startsWith('data:image/')) {
            thumbnail = await generateImageThumbnail(content);
            if (content.startsWith('data:')) {
              const match = content.match(/^data:([^;]+);/);
              if (match) resolvedMime = match[1];
            }
          }
        }

        // 1. Asynchronously save content payload to IndexedDB
        await saveEntity(id, content);

        // 2. Save metadata to Zustand store
        set((state) => {
          const newItem: ScratchpadItem = {
            id,
            name,
            content: contentForZustand,
            type,
            timestamp,
            isLarge,
            isBinary,
            size,
            mimeType: resolvedMime,
            thumbnail
          };
          const filtered = state.items.filter((item) => item.name !== name);
          return { items: [newItem, ...filtered] };
        });

        return id;
      },

      removeItem: (id) => {
        // 1. Asynchronously delete entity from IndexedDB
        deleteEntity(id).catch((err) => {
          console.error(`Failed to delete scratchpad IndexedDB entity for ID: ${id}`, err);
        });

        // 2. Remove metadata from Zustand store
        set((state) => ({
          items: state.items.filter((item) => item.id !== id)
        }));
      },

      clearAll: () => {
        // 1. Asynchronously clear all entities in IndexedDB
        clearEntities().catch((err) => {
          console.error('Failed to clear scratchpad IndexedDB entries', err);
        });

        // 2. Reset Zustand store
        set({ items: [] });
      }
    }),
    {
      name: 'devtoolbox-scratchpad-storage',
      partialize: (state) => ({
        // Only persist the metadata list in LocalStorage
        items: state.items
      })
    }
  )
);

// Optional global bridge listener for tools that dispatch via CustomEvent
if (typeof window !== 'undefined') {
  if (window.__devToolboxScratchpadBridge) {
    window.removeEventListener('add-scratchpad-item', window.__devToolboxScratchpadBridge);
  }

  const scratchpadBridge = ((e: CustomEvent<{ name: string; content: string | Blob | ArrayBuffer; type?: string; mimeType?: string }>) => {
    if (e.detail && e.detail.name && e.detail.content) {
      useScratchpadStore.getState().addItem(
        e.detail.name,
        e.detail.content,
        e.detail.type || 'text',
        e.detail.mimeType
      );
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
