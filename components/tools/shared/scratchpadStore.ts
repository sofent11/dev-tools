import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { saveEntity, deleteEntity, getEntity, clearEntities } from './scratchpadDb';

export type ScratchpadStorageStatus = 'ok' | 'degraded' | 'error';

export interface ScratchpadItem {
  id: string;
  name: string;
  content: string;
  type: string;
  timestamp: number;
  size: number;
  mime?: string;
  mimeType?: string;
  sourceTool?: string;
  isLarge?: boolean;
  isBinary?: boolean;
  thumbnail?: string;
}

export interface ScratchpadPayload {
  id?: string;
  name: string;
  content: string | Blob | ArrayBuffer;
  type?: string;
  mime?: string;
  mimeType?: string;
  sourceTool?: string;
  timestamp?: number;
}

interface ScratchpadState {
  items: ScratchpadItem[];
  storageStatus: ScratchpadStorageStatus;
  lastStorageError?: string;
  addItem: (nameOrPayload: string | ScratchpadPayload, content?: string | Blob | ArrayBuffer, type?: string, mimeType?: string) => void;
  addItemAsync: (nameOrPayload: string | ScratchpadPayload, content?: string | Blob | ArrayBuffer, type?: string, mimeType?: string) => Promise<string>;
  estimateQuota: () => Promise<StorageEstimate | null>;
  updateItem: (id: string, updates: Partial<Pick<ScratchpadItem, 'name' | 'type' | 'mime' | 'mimeType' | 'sourceTool'>>) => void;
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

const toPayload = (
  nameOrPayload: string | ScratchpadPayload,
  content: string | Blob | ArrayBuffer = '',
  type = 'text',
  mimeType?: string,
): ScratchpadPayload =>
  typeof nameOrPayload === 'string'
    ? { name: nameOrPayload, content, type, mimeType }
    : nameOrPayload;

const getContentSize = (content: string | Blob | ArrayBuffer) => {
  if (content instanceof Blob) return content.size;
  if (content instanceof ArrayBuffer) return content.byteLength;
  return new Blob([content]).size;
};

const createVersionedScratchpadName = (name: string, existingNames: Set<string>) => {
  if (!existingNames.has(name)) return name;

  const extensionMatch = name.match(/(\.[^./\\]+)$/);
  const extension = extensionMatch?.[1] || '';
  const stem = extension ? name.slice(0, -extension.length) : name;
  let index = 2;
  let candidate = `${stem} (${index})${extension}`;

  while (existingNames.has(candidate)) {
    index += 1;
    candidate = `${stem} (${index})${extension}`;
  }

  return candidate;
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
    } else if (content.startsWith('data:image/') || content.startsWith('http')) {
      img.src = content;
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
      storageStatus: 'ok',
      lastStorageError: undefined,

      addItem: (nameOrPayload, content = '', type = 'text', mimeType) => {
        get().addItemAsync(nameOrPayload, content, type, mimeType).catch((err) => {
          console.error('Background scratchpad stashing failed:', err);
        });
      },

      addItemAsync: async (nameOrPayload, content = '', type = 'text', mimeType) => {
        const payload = toPayload(nameOrPayload, content, type, mimeType);
        const id = payload.id || createScratchpadItemId();
        const timestamp = payload.timestamp || Date.now();
        const itemType = payload.type || 'text';
        const resolvedMime = payload.mime || payload.mimeType;
        const size = getContentSize(payload.content);
        const isBinary = payload.content instanceof Blob || payload.content instanceof ArrayBuffer;
        const isLarge = typeof payload.content === 'string' && size >= 100000;
        let contentForZustand = '';
        let thumbnail: string | undefined;
        let nextMime = resolvedMime;

        if (typeof payload.content === 'string') {
          contentForZustand = isLarge ? '' : payload.content;
          if (itemType === 'image' || payload.content.startsWith('data:image/')) {
            thumbnail = await generateImageThumbnail(payload.content);
            if (!nextMime && payload.content.startsWith('data:')) {
              nextMime = payload.content.match(/^data:([^;]+);/)?.[1];
            }
          }
        } else if (payload.content instanceof Blob) {
          nextMime = nextMime || payload.content.type;
          if (payload.content.type.startsWith('image/')) {
            thumbnail = await generateImageThumbnail(payload.content);
          }
        }

        try {
          await saveEntity(id, payload.content);
          set({ storageStatus: 'ok', lastStorageError: undefined });
        } catch (err) {
          const message = err instanceof Error ? err.message : '暂存箱 IndexedDB 写入失败';
          const canDegradeToMetadata = typeof payload.content === 'string' && !isLarge;
          set({ storageStatus: canDegradeToMetadata ? 'degraded' : 'error', lastStorageError: message });
          if (!canDegradeToMetadata) {
            throw new Error(`暂存箱存储失败：${message}`);
          }
        }

        set((state) => {
          const resolvedName = createVersionedScratchpadName(payload.name, new Set(state.items.map(item => item.name)));
          const newItem: ScratchpadItem = {
            id,
            name: resolvedName,
            content: contentForZustand,
            type: itemType,
            timestamp,
            size,
            mime: nextMime,
            mimeType: nextMime,
            sourceTool: payload.sourceTool,
            isLarge,
            isBinary,
            thumbnail,
          };
          return { items: [newItem, ...state.items] };
        });

        return id;
      },

      estimateQuota: async () => {
        if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
        try {
          return await navigator.storage.estimate();
        } catch (err) {
          const message = err instanceof Error ? err.message : '无法读取浏览器存储配额';
          set({ storageStatus: 'degraded', lastStorageError: message });
          return null;
        }
      },

      updateItem: (id, updates) => set((state) => ({
        items: state.items.map((item) => (item.id === id ? { ...item, ...updates } : item)),
      })),

      removeItem: (id) => {
        deleteEntity(id).catch((err) => {
          console.error(`Failed to delete scratchpad IndexedDB entity for ID: ${id}`, err);
        });
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }));
      },

      clearAll: () => {
        clearEntities().catch((err) => {
          console.error('Failed to clear scratchpad IndexedDB entries', err);
          set({ storageStatus: 'degraded', lastStorageError: err instanceof Error ? err.message : '清空 IndexedDB 失败' });
        });
        set({ items: [] });
      },
    }),
    {
      name: 'devtoolbox-scratchpad-storage',
      partialize: (state) => ({
        items: state.items,
        storageStatus: state.storageStatus,
        lastStorageError: state.lastStorageError,
      }),
    },
  ),
);

if (typeof window !== 'undefined') {
  if (window.__devToolboxScratchpadBridge) {
    window.removeEventListener('add-scratchpad-item', window.__devToolboxScratchpadBridge);
  }

  const scratchpadBridge = ((event: CustomEvent<ScratchpadPayload>) => {
    if (event.detail && event.detail.name && event.detail.content !== undefined) {
      useScratchpadStore.getState().addItem(event.detail);
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
