import JSZip from 'jszip';
import { downloadBlob } from '../shared/fileUtils';
import type { DiscoveredRemoteFile, FileTreeNode, RepositorySource } from './types';

export const parseRepositoryUrl = (urlString: string): RepositorySource | null => {
  try {
    const url = new URL(urlString.trim());
    const hostname = url.hostname.toLowerCase();
    const parts = url.pathname.split('/').filter(Boolean);

    if (hostname === 'github.com' || hostname.endsWith('.github.com')) {
      if (parts.length < 2) return null;
      const [owner, repo] = parts;
      let branch = '';
      let folderPath = '';
      const treeIndex = parts.indexOf('tree');
      if (treeIndex >= 0 && parts.length > treeIndex + 1) {
        branch = parts[treeIndex + 1];
        folderPath = parts.slice(treeIndex + 2).join('/');
      }
      return { platform: 'github', owner, repo, branch, folderPath, originalUrl: urlString };
    }

    if (hostname === 'huggingface.co' || hostname.endsWith('.huggingface.co')) {
      let platform: RepositorySource['platform'] = 'huggingface-model';
      let startIndex = 0;
      if (parts[0] === 'datasets') {
        platform = 'huggingface-dataset';
        startIndex = 1;
      }
      if (parts.length - startIndex < 2) return null;
      const owner = parts[startIndex];
      const repo = parts[startIndex + 1];
      let branch = 'main';
      let folderPath = '';
      const treeIndex = parts.indexOf('tree', startIndex + 2);
      if (treeIndex >= 0 && parts.length > treeIndex + 1) {
        branch = parts[treeIndex + 1];
        folderPath = parts.slice(treeIndex + 2).join('/');
      }
      return { platform, owner, repo, branch, folderPath, originalUrl: urlString };
    }
  } catch {
    return null;
  }
  return null;
};

export const applyCorsProxy = (url: string, template = '') =>
  template.trim() ? template.trim().replace('{TheUrl}', encodeURIComponent(url)) : url;

export const createRemoteFile = (
  path: string,
  fullPath: string,
  downloadUrl: string,
  size = 0,
): DiscoveredRemoteFile => ({
  id: `${fullPath}-${downloadUrl}`.replace(/[^a-z0-9]+/gi, '-'),
  path,
  fullPath,
  downloadUrl,
  size,
  selected: true,
  status: 'pending',
});

const insertFile = (root: FileTreeNode, file: DiscoveredRemoteFile) => {
  const parts = file.path.split('/').filter(Boolean);
  let current = root;
  parts.forEach((part, index) => {
    const path = parts.slice(0, index + 1).join('/');
    let child = current.children.find(item => item.name === part && item.path === path);
    if (!child) {
      child = { name: part, path, size: 0, selected: true, partial: false, children: [] };
      current.children.push(child);
    }
    if (index === parts.length - 1) {
      child.file = file;
      child.size = file.size;
      child.selected = file.selected;
    }
    current = child;
  });
};

const refreshNodeState = (node: FileTreeNode): FileTreeNode => {
  if (node.file) return { ...node, selected: node.file.selected, partial: false, size: node.file.size };
  const children = node.children.map(refreshNodeState);
  const selectedChildren = children.filter(child => child.selected).length;
  const partialChildren = children.filter(child => child.partial).length;
  const size = children.reduce((total, child) => total + child.size, 0);
  return {
    ...node,
    children,
    size,
    selected: children.length > 0 && selectedChildren === children.length && partialChildren === 0,
    partial: partialChildren > 0 || (selectedChildren > 0 && selectedChildren < children.length),
  };
};

export const buildFileTree = (files: DiscoveredRemoteFile[]): FileTreeNode => {
  const root: FileTreeNode = { name: '/', path: '', size: 0, selected: true, partial: false, children: [] };
  files.forEach(file => insertFile(root, file));
  return refreshNodeState(root);
};

export const setFileSelectionByPrefix = (
  files: DiscoveredRemoteFile[],
  pathPrefix: string,
  selected: boolean,
) => files.map(file => (
  pathPrefix === '' || file.path === pathPrefix || file.path.startsWith(`${pathPrefix}/`)
    ? { ...file, selected }
    : file
));

export interface DownloadQueueOptions {
  concurrency: number;
  fetchFile: (file: DiscoveredRemoteFile, signal: AbortSignal) => Promise<Blob>;
  saveFile: (file: DiscoveredRemoteFile, blob: Blob) => Promise<void>;
  onFileUpdate?: (file: DiscoveredRemoteFile) => void;
  signal?: AbortSignal;
}

export const runDownloadQueue = async (
  files: DiscoveredRemoteFile[],
  options: DownloadQueueOptions,
) => {
  const queue = files.filter(file => file.selected);
  const concurrency = Math.max(1, Math.min(10, options.concurrency || 3));
  let cursor = 0;
  let completed = 0;
  let failed = 0;

  const worker = async () => {
    while (cursor < queue.length) {
      const file = queue[cursor++];
      if (options.signal?.aborted) break;
      try {
        options.onFileUpdate?.({ ...file, status: 'downloading' });
        const blob = await options.fetchFile(file, options.signal || new AbortController().signal);
        await options.saveFile(file, blob);
        completed += 1;
        options.onFileUpdate?.({ ...file, status: 'completed' });
      } catch (error) {
        failed += 1;
        options.onFileUpdate?.({ ...file, status: 'failed', error: (error as Error).message });
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));
  return { total: queue.length, completed, failed };
};

export const zipRemoteFiles = async (
  files: DiscoveredRemoteFile[],
  fetchFile: (file: DiscoveredRemoteFile) => Promise<Blob>,
  fileName: string,
) => {
  const zip = new JSZip();
  for (const file of files.filter(item => item.selected)) {
    const blob = await fetchFile(file);
    zip.file(file.path, blob);
  }
  const content = await zip.generateAsync({ type: 'blob' });
  downloadBlob(content, fileName);
};

