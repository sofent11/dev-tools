import React, { useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import type * as Forge from 'node-forge';
import {
  AlertCircle,
  Archive,
  Boxes,
  CheckCircle2,
  ChevronRight,
  Download,
  FileArchive,
  FolderTree,
  GitBranch,
  Info,
  Loader2,
  Network,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  Square,
  XCircle,
} from 'lucide-react';
import { useI18n } from '../../../src/i18n';
import { Button } from '../../ui/Button';
import { downloadBlob, formatBytes } from '../shared/fileUtils';
import { loadRemoteScript } from '../shared/runtimeAssetLoader';
import {
  applyCorsProxy,
  buildFileTree,
  createRemoteFile,
  parseRepositoryUrl,
  setFileSelectionByPrefix,
} from './repositoryCore';
import {
  collectNamespaces,
  createDependencyBudget,
  createDependencyNode,
  DEFAULT_DEPENDENCY_LIMITS,
  flattenDependencyTree,
  normalizeNuGetVersionConstraint,
  parsePyPiRequirement,
  shouldIncludePyPiRequirement,
} from './dependencyCore';
import { getCertificateDateStatus, normalizeFingerprint, parseNuspecMetadata, type NuspecMetadata } from './nugetSignatureCore';
import type { DependencyNode, DiscoveredRemoteFile, FileTreeNode, RepositorySource } from './types';

declare global {
  interface Window {
    forge?: typeof Forge;
  }
}

const FORGE_SCRIPT_URL = 'https://cdnjs.cloudflare.com/ajax/libs/forge/1.3.1/forge.min.js';

const loadForge = async () => {
  if (!window.forge) {
    await loadRemoteScript(FORGE_SCRIPT_URL, 'node-forge', 20000);
  }
  if (!window.forge) throw new Error('node-forge runtime is unavailable');
  return window.forge;
};

const copyText = {
  'zh-CN': {
    token: '访问令牌',
    optional: '可选',
    run: '运行',
    search: '搜索',
    scan: '扫描',
    cancel: '取消',
    export: '导出',
    import: '导入',
    clear: '清除',
    refresh: '刷新',
    copy: '复制',
    status: '状态',
    results: '结果',
    loading: '处理中',
    error: '错误',
    empty: '暂无数据',
    proxy: 'CORS 代理模板',
    depth: '深度',
    limit: '节点上限',
    repoExplorer: 'GitHub 仓库浏览器',
    entity: '用户或组织',
    fetchRepos: '拉取仓库',
    fetchReleases: '检查 Release',
    language: '语言',
    release: 'Release',
    description: '描述',
    stars: '星标',
    updated: '更新',
    cached: '缓存',
    orgResearch: 'GitHub 组织关联研究',
    parentOrg: '父组织',
    query: '搜索词',
    verifiedDomain: '验证域名',
    sharedMembers: '共享成员',
    folderDownloader: 'GitHub / HuggingFace 文件夹下载',
    repoUrl: '仓库文件夹 URL',
    concurrency: '并发数',
    selected: '已选',
    downloadZip: '下载 ZIP',
    directSave: '保存到文件夹',
    nugetDeps: 'NuGet 依赖树',
    pypiDeps: 'PyPI 依赖树',
    rustDeps: 'Rust crate 依赖树',
    packageName: '包名',
    crateName: 'Crate 名称',
    extras: 'Extras',
    tree: '树',
    list: '列表',
    hideMaintainer: '隐藏同维护者叶子',
    namespaceFilter: '命名空间过滤',
    signature: 'NuGet 签名检查',
    version: '版本',
    loadVersions: '加载版本',
    analyzeSignature: '解析签名',
    signed: '已签名',
    unsigned: '未签名',
    packageHash: '包 SHA-256',
    certificate: '证书',
    fingerprint: '指纹',
    pem: 'PEM',
    valid: '有效',
    expired: '已过期',
    notYetActive: '尚未生效',
  },
  'en-US': {
    token: 'Access token',
    optional: 'optional',
    run: 'Run',
    search: 'Search',
    scan: 'Scan',
    cancel: 'Cancel',
    export: 'Export',
    import: 'Import',
    clear: 'Clear',
    refresh: 'Refresh',
    copy: 'Copy',
    status: 'Status',
    results: 'Results',
    loading: 'Working',
    error: 'Error',
    empty: 'No data yet',
    proxy: 'CORS proxy template',
    depth: 'Depth',
    limit: 'Node limit',
    repoExplorer: 'GitHub Repo Explorer',
    entity: 'User or organization',
    fetchRepos: 'Fetch repositories',
    fetchReleases: 'Check releases',
    language: 'Language',
    release: 'Release',
    description: 'Description',
    stars: 'Stars',
    updated: 'Updated',
    cached: 'Cache',
    orgResearch: 'GitHub Associated Organization Research',
    parentOrg: 'Parent organization',
    query: 'Search query',
    verifiedDomain: 'Verified domain',
    sharedMembers: 'Shared members',
    folderDownloader: 'GitHub / HuggingFace Folder Downloader',
    repoUrl: 'Repository folder URL',
    concurrency: 'Concurrency',
    selected: 'selected',
    downloadZip: 'Download ZIP',
    directSave: 'Save to folder',
    nugetDeps: 'NuGet Dependency Tree',
    pypiDeps: 'PyPI Dependency Tree',
    rustDeps: 'Rust Crate Dependency Tree',
    packageName: 'Package name',
    crateName: 'Crate name',
    extras: 'Extras',
    tree: 'Tree',
    list: 'List',
    hideMaintainer: 'Hide same-maintainer leaves',
    namespaceFilter: 'Namespace filter',
    signature: 'NuGet Signature Inspector',
    version: 'Version',
    loadVersions: 'Load versions',
    analyzeSignature: 'Analyze signature',
    signed: 'Signed',
    unsigned: 'Unsigned',
    packageHash: 'Package SHA-256',
    certificate: 'Certificate',
    fingerprint: 'Fingerprint',
    pem: 'PEM',
    valid: 'Valid',
    expired: 'Expired',
    notYetActive: 'Not yet active',
  },
} as const;

type RepoRow = {
  name: string;
  stargazers_count: number;
  language: string | null;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  description: string | null;
  html_url: string;
  has_releases?: boolean;
  has_exe?: boolean;
  release_error?: string;
};

type OrgResearchRow = {
  login: string;
  name?: string;
  url?: string;
  websiteUrl?: string;
  email?: string;
  isVerified?: boolean;
  publicDomains: string[];
  shared: 'parent' | 'associated' | 'none';
  members: string[];
};

const DB_NAME = 'devtoolbox-repo-research-db';
const DB_VERSION = 1;
const STORES = ['repoCache', 'orgHistory'] as const;

const openRepoDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onerror = () => reject(new Error('IndexedDB open failed'));
  request.onsuccess = () => resolve(request.result);
  request.onupgradeneeded = () => {
    const db = request.result;
    for (const store of STORES) {
      if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
    }
  };
});

const idbGet = async <T,>(storeName: string, key: string): Promise<T | null> => {
  const db = await openRepoDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(new Error('IndexedDB read failed'));
  });
};

const idbSet = async (storeName: string, key: string, value: unknown) => {
  const db = await openRepoDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const request = tx.objectStore(storeName).put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('IndexedDB write failed'));
  });
};

const idbClear = async (storeName: string) => {
  const db = await openRepoDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const request = tx.objectStore(storeName).clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('IndexedDB clear failed'));
  });
};

const useCopy = () => copyText[useI18n().locale];

const Panel: React.FC<{ title: string; description?: string; icon?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }> = ({ title, description, icon, actions, children }) => (
  <section className="min-w-0 space-y-4 rounded-lg border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">{icon}{title}</h3>
        {description && <p className="mt-1 max-w-3xl text-xs leading-6 text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
    {children}
  </section>
);

const TextInput: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  required?: boolean;
}> = ({ label, value, onChange, placeholder, type = 'text', disabled, required }) => (
  <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
    {label}
    <input
      type={type}
      value={value}
      disabled={disabled}
      required={required}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
      className="ui-input h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
    />
  </label>
);

const ActionButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  busy?: boolean;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'ghost';
}> = ({ children, onClick, disabled, busy, type = 'button', variant = 'primary' }) => (
  <Button
    type={type}
    onClick={onClick}
    disabled={disabled}
    isLoading={busy}
    variant={variant === 'ghost' ? 'secondary' : 'primary'}
    className="max-w-full"
  >
    {children}
  </Button>
);

const AdvancedControls: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useI18n();
  return <details className="rounded-md border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800">
    <summary className="cursor-pointer text-xs font-medium text-slate-600">{t('连接与高级设置')}</summary>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">{children}</div>
  </details>;
};

const EmptyResult: React.FC<{ title: string; description: string; icon?: React.ReactNode }> = ({ title, description, icon }) => (
  <div className="flex min-h-36 flex-col items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50/50 px-5 py-7 text-center dark:border-slate-800">
    <div className="mb-3 text-slate-400">{icon || <Search className="h-6 w-6" />}</div>
    <p className="text-sm font-medium text-slate-700">{title}</p>
    <p className="mt-2 max-w-lg text-xs leading-6 text-slate-500">{description}</p>
  </div>
);

const ResultStat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="min-w-0 rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-900">
    <div className="text-[11px] text-slate-500">{label}</div>
    <div className="mt-1 break-words text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</div>
  </div>
);

const ViewControls: React.FC<{ view: 'tree' | 'list'; onChange: (view: 'tree' | 'list') => void }> = ({ view, onChange }) => {
  const c = useCopy();
  return <div className="flex rounded-md border border-slate-200 p-1 dark:border-slate-800">
    {(['tree', 'list'] as const).map(value => <button key={value} type="button" aria-pressed={view === value} onClick={() => onChange(value)} className={`rounded px-3 py-1.5 text-xs ${view === value ? 'bg-primary-50 font-semibold text-primary-700' : 'text-slate-500 hover:bg-slate-50'}`}>{value === 'tree' ? c.tree : c.list}</button>)}
  </div>;
};

const StatusLine: React.FC<{ status: string; busy?: boolean; tone?: 'error' | 'success' | 'info' }> = ({ status, busy, tone = 'info' }) => {
  if (!status) return null;
  const color = tone === 'error' ? 'text-rose-700 dark:text-rose-300' : tone === 'success' ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-300';
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} aria-live={tone === 'error' ? 'assertive' : 'polite'} className={`flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-6 dark:bg-slate-900 ${color}`}>
      {busy ? <Loader2 className="mt-1 h-4 w-4 shrink-0 animate-spin" /> : tone === 'error' ? <AlertCircle className="mt-1 h-4 w-4 shrink-0" /> : tone === 'success' ? <CheckCircle2 className="mt-1 h-4 w-4 shrink-0" /> : <Info className="mt-1 h-4 w-4 shrink-0" />}
      <span className="min-w-0 break-words">{status}</span>
    </div>
  );
};

const fetchJson = async <T,>(url: string, options: RequestInit = {}) => {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<T>;
};

const authHeaders = (token: string, scheme: 'token' | 'bearer' = 'token') => (
  token.trim() ? { Authorization: `${scheme === 'bearer' ? 'Bearer' : 'token'} ${token.trim()}` } : {}
);

const parseLastPage = (link: string | null) => {
  if (!link) return 1;
  const match = link.match(/[?&]page=(\d+)[^>]*>;\s*rel="last"/);
  return match ? Number(match[1]) : 1;
};

const extractDomain = (value = '') => {
  try {
    if (!value.trim()) return '';
    const url = value.includes('@') && !value.startsWith('http') ? new URL(`mailto:${value}`) : new URL(value.startsWith('http') ? value : `https://${value}`);
    const host = url.protocol === 'mailto:' ? url.pathname.split('@').pop() || '' : url.hostname;
    return host.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
};

export const GitHubRepoExplorerTool: React.FC = () => {
  const c = useCopy();
  const { t } = useI18n();
  const [entity, setEntity] = useState('openai');
  const [resultEntity, setResultEntity] = useState('');
  const [token, setToken] = useState('');
  const [repos, setRepos] = useState<RepoRow[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [operation, setOperation] = useState<'repos' | 'releases' | ''>('');
  const [nameFilter, setNameFilter] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');
  const [descriptionFilter, setDescriptionFilter] = useState('');
  const [releaseFilter, setReleaseFilter] = useState('all');

  const filtered = useMemo(() => repos.filter(repo => {
    const language = repo.language || 'N/A';
    const nameOk = !nameFilter || repo.name.toLowerCase().includes(nameFilter.toLowerCase());
    const langOk = !languageFilter || language.toLowerCase().includes(languageFilter.toLowerCase());
    const descOk = !descriptionFilter || (repo.description || '').toLowerCase().includes(descriptionFilter.toLowerCase());
    const releaseOk = releaseFilter === 'all'
      || (releaseFilter === 'has' && repo.has_releases)
      || (releaseFilter === 'exe' && repo.has_exe)
      || (releaseFilter === 'none' && repo.has_releases === false);
    return nameOk && langOk && descOk && releaseOk;
  }).sort((a, b) => b.stargazers_count - a.stargazers_count), [descriptionFilter, languageFilter, nameFilter, releaseFilter, repos]);

  const fetchRepos = async () => {
    const requestedEntity = entity.trim();
    if (!requestedEntity) return;
    setBusy(true);
    setOperation('repos');
    setStatus(t('正在读取仓库列表…'));
    try {
      const user = await fetchJson<{ type: string }>(`https://api.github.com/users/${encodeURIComponent(requestedEntity)}`, {
        headers: authHeaders(token),
      });
      const route = user.type === 'Organization' ? 'orgs' : 'users';
      const firstUrl = `https://api.github.com/${route}/${encodeURIComponent(requestedEntity)}/repos?per_page=100&page=1&sort=full_name`;
      const firstResponse = await fetch(firstUrl, { headers: authHeaders(token) });
      if (!firstResponse.ok) throw new Error(`HTTP ${firstResponse.status}`);
      const firstPage = await firstResponse.json() as RepoRow[];
      const lastPage = parseLastPage(firstResponse.headers.get('link'));
      const restPages = await Promise.all(Array.from({ length: Math.max(0, lastPage - 1) }, async (_, index) => {
        const page = index + 2;
        return fetchJson<RepoRow[]>(`https://api.github.com/${route}/${encodeURIComponent(requestedEntity)}/repos?per_page=100&page=${page}&sort=full_name`, {
          headers: authHeaders(token),
        });
      }));
      const nextRepos = [...firstPage, ...restPages.flat()].map(repo => ({
        name: repo.name,
        stargazers_count: repo.stargazers_count,
        language: repo.language,
        created_at: repo.created_at,
        updated_at: repo.updated_at,
        pushed_at: repo.pushed_at,
        description: repo.description,
        html_url: repo.html_url,
      }));
      setRepos(nextRepos);
      setResultEntity(requestedEntity);
      await idbSet('repoCache', requestedEntity.toLowerCase(), { entity: requestedEntity, repos: nextRepos, fetchedAt: new Date().toISOString() });
      setStatus(`${nextRepos.length} ${c.results}`);
    } catch (error) {
      const cached = await idbGet<{ repos: RepoRow[] }>('repoCache', requestedEntity.toLowerCase()).catch(() => null);
      if (cached?.repos) {
        setRepos(cached.repos);
        setResultEntity(requestedEntity);
        setStatus(`${c.cached}: ${(error as Error).message}`);
      } else {
        setStatus(`${c.error}: ${(error as Error).message}`);
      }
    } finally {
      setBusy(false);
      setOperation('');
    }
  };

  const fetchReleases = async () => {
    setBusy(true);
    setOperation('releases');
    let failed = 0;
    setStatus(t('正在逐个检查最新 Release…'));
    try {
      const next: RepoRow[] = [];
      for (const repo of repos) {
        setStatus(`${t('正在检查 Release')} ${next.length + 1}/${repos.length} · ${repo.name}`);
        try {
          const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(resultEntity)}/${encodeURIComponent(repo.name)}/releases?per_page=1`, { headers: authHeaders(token) });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const releases = await response.json() as Array<{ assets?: Array<{ name: string }> }>;
          next.push({ ...repo, release_error: undefined, has_releases: releases.length > 0, has_exe: releases.some(release => release.assets?.some(asset => /\.exe$/i.test(asset.name))) });
        } catch (error) {
          failed += 1;
          next.push({ ...repo, has_releases: undefined, has_exe: undefined, release_error: (error as Error).message });
        }
      }
      setRepos(next);
      await idbSet('repoCache', resultEntity.toLowerCase(), { entity: resultEntity, repos: next, fetchedAt: new Date().toISOString() });
      setStatus(failed ? `${c.error}: ${failed} ${t('个仓库未能检查，其余结果已更新')}` : t('最新 Release 检查完成'));
    } catch (error) {
      setStatus(`${c.error}: ${(error as Error).message}`);
    } finally {
      setBusy(false);
      setOperation('');
    }
  };

  const exportCache = () => {
    downloadBlob(new Blob([JSON.stringify({ entity: resultEntity, repos }, null, 2)], { type: 'application/json' }), `${resultEntity}-repo-cache.json`);
  };

  return (
    <div className="space-y-4">
      <Panel title={c.repoExplorer} description={t('先读取用户或组织的仓库，再筛选语言、描述与最新发布资产。')} icon={<GitBranch className="h-5 w-5 text-primary-500" />}>
        <form onSubmit={event => { event.preventDefault(); void fetchRepos(); }} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <TextInput label={c.entity} value={entity} onChange={setEntity} placeholder="openai" required disabled={busy} />
          <ActionButton type="submit" disabled={busy || !entity.trim()} busy={operation === 'repos'}><Search className="h-4 w-4" />{c.fetchRepos}</ActionButton>
        </form>
        <AdvancedControls>
          <TextInput label={`${c.token} (${c.optional})`} value={token} onChange={setToken} type="password" disabled={busy} />
          <div className="flex flex-wrap items-end gap-2">
            <ActionButton onClick={() => { void idbClear('repoCache').then(() => setStatus(t('本地仓库缓存已清除'))).catch(error => setStatus(`${c.error}: ${(error as Error).message}`)); }} disabled={busy} variant="ghost">{t('清除本地缓存')}</ActionButton>
            <p className="text-xs leading-6 text-slate-500">{t('令牌仅用于本次页面请求；缓存保存仓库数据。')}</p>
          </div>
        </AdvancedControls>
        <StatusLine status={status} busy={busy} tone={status.startsWith(c.error) ? 'error' : 'info'} />
      </Panel>

      <Panel title={resultEntity ? `${resultEntity} · ${c.results}` : c.results} actions={repos.length > 0 && <>
        <ActionButton onClick={fetchReleases} disabled={busy} busy={operation === 'releases'} variant="ghost"><RefreshCw className="h-4 w-4" />{c.fetchReleases}</ActionButton>
        <ActionButton onClick={exportCache} disabled={busy} variant="ghost"><Download className="h-4 w-4" />{c.export}</ActionButton>
      </>}>
        {repos.length > 0 ? <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <ResultStat label={t('仓库总数')} value={repos.length} />
            <ResultStat label={t('当前匹配')} value={filtered.length} />
            <ResultStat label={t('已检查发布')} value={repos.filter(repo => repo.has_releases !== undefined).length} />
            <ResultStat label={t('包含 EXE 资产')} value={repos.filter(repo => repo.has_exe).length} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <TextInput label={t('仓库名称')} value={nameFilter} onChange={setNameFilter} placeholder={t('按名称筛选')} />
            <TextInput label={c.language} value={languageFilter} onChange={setLanguageFilter} placeholder="Python, TypeScript…" />
            <TextInput label={c.description} value={descriptionFilter} onChange={setDescriptionFilter} placeholder={t('按描述筛选')} />
            <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-slate-700">
              {c.release}
              <select aria-label={c.release} value={releaseFilter} onChange={event => setReleaseFilter(event.target.value)} className="ui-select h-10 w-full rounded-md border border-slate-200 bg-white px-3">
                <option value="all">{t('全部发布状态')}</option><option value="has">{t('有最新 Release')}</option><option value="exe">{t('最新 Release 含 EXE')}</option><option value="none">{t('已检查且无 Release')}</option>
              </select>
            </label>
          </div>
          <p className="text-xs text-slate-500">{t('发布状态以最新 Release 为准；未检查的仓库不会被视为没有发布。')}</p>
          {filtered.length ? <div className="max-h-[34rem] overflow-auto rounded-md border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs text-slate-500"><tr>
                <th className="px-3 py-3 text-left">{t('仓库名称')}</th><th className="px-3 py-3 text-right">{c.stars}</th><th className="px-3 py-3 text-left">{c.language}</th><th className="px-3 py-3 text-left">{c.release}</th><th className="px-3 py-3 text-left">{c.updated}</th><th className="px-3 py-3 text-left">{c.description}</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{filtered.map(repo => <tr key={repo.name} className="align-top hover:bg-slate-50/50">
                <td className="px-3 py-3"><a href={repo.html_url} target="_blank" rel="noreferrer" className="font-medium text-primary-700 dark:text-primary-300">{repo.name}</a></td>
                <td className="px-3 py-3 text-right font-mono text-xs">{repo.stargazers_count.toLocaleString()}</td><td className="px-3 py-3 text-xs">{repo.language || '—'}</td>
                <td data-i18n-skip title={repo.release_error} className={`px-3 py-3 text-xs ${repo.release_error ? 'text-rose-600 dark:text-rose-300' : ''}`}>{repo.release_error ? t('检查失败') : repo.has_releases === undefined ? t('未检查') : repo.has_exe ? 'EXE' : repo.has_releases ? t('有发布') : t('无发布')}</td>
                <td className="whitespace-nowrap px-3 py-3 text-xs">{new Date(repo.updated_at).toLocaleDateString()}</td><td className="min-w-48 max-w-sm px-3 py-3 text-xs leading-6 text-slate-500">{repo.description || '—'}</td>
              </tr>)}</tbody>
            </table>
          </div> : <EmptyResult title={t('没有匹配的仓库')} description={t('调整名称、语言、描述或发布筛选，或重新读取仓库。')} />}
        </> : <EmptyResult title={busy ? t('正在读取仓库列表…') : resultEntity ? t('该账号未返回仓库') : t('从一个用户或组织开始')} description={t('输入 GitHub 登录名并读取仓库。结果支持筛选、最新 Release 检查和 JSON 导出。')} icon={<GitBranch className="h-6 w-6" />} />}
      </Panel>
    </div>
  );
};

export const GitHubOrganizationResearchTool: React.FC = () => {
  const c = useCopy();
  const { t } = useI18n();
  const [parentOrg, setParentOrg] = useState('openai');
  const [query, setQuery] = useState('openai');
  const [token, setToken] = useState('');
  const [rows, setRows] = useState<OrgResearchRow[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [relationFilter, setRelationFilter] = useState('all');
  const [hasSearched, setHasSearched] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const runSearch = async () => {
    if (!token.trim()) {
      setStatus(`${c.error}: ${t('组织研究需要 GitHub 访问令牌。')}`);
      return;
    }
    if (!parentOrg.trim() || !query.trim()) return;
    const abort = new AbortController();
    abortRef.current = abort;
    setBusy(true);
    setRows([]);
    setStatus(c.loading);
    try {
      const graph = async <T,>(body: string, variables: Record<string, unknown>) => {
        const response = await fetchJson<T & { errors?: Array<{ message: string }> }>('https://api.github.com/graphql', {
        method: 'POST',
        signal: abort.signal,
        headers: { 'Content-Type': 'application/json', ...authHeaders(token, 'bearer') },
        body: JSON.stringify({ query: body, variables }),
        });
        if (response.errors?.length) throw new Error(response.errors.map(error => error.message).join('; '));
        return response;
      };
      const orgFields = `login name url websiteUrl email isVerified membersWithRole(first: 30) { totalCount nodes { login } }`;
      const parent = await graph<{ data: { organization: null | { membersWithRole: { nodes: Array<{ login: string }> }; websiteUrl?: string; email?: string } } }>(
        `query($login:String!){ organization(login:$login){ ${orgFields} } }`,
        { login: parentOrg },
      );
      if (!parent.data.organization) throw new Error(t('未找到父组织，请检查 GitHub 组织登录名。'));
      const parentMembers = new Set(parent.data.organization?.membersWithRole.nodes.map(member => member.login) || []);
      const parentDomains = new Set([
        extractDomain(parent.data.organization?.websiteUrl),
        extractDomain(parent.data.organization?.email),
      ].filter(Boolean));

      const searchResult = await graph<{ data: { search: { nodes: Array<Record<string, unknown>> } } }>(
        `query($q:String!){ search(query:$q,type:USER,first:50){ nodes { ... on Organization { ${orgFields} } } } }`,
        { q: `type:org ${query} in:name,login repos:>0` },
      );

      const preliminary = searchResult.data.search.nodes.map(org => {
        const publicDomains = [extractDomain(String(org.websiteUrl || '')), extractDomain(String(org.email || ''))].filter(Boolean);
        const members = ((org.membersWithRole as { nodes?: Array<{ login: string }> } | undefined)?.nodes || []).map(member => member.login);
        const verifiedDomain = Boolean(org.isVerified) && publicDomains.some(domain => parentDomains.has(domain));
        const sharedParent = members.some(member => parentMembers.has(member));
        return {
          login: String(org.login || ''),
          name: String(org.name || ''),
          url: String(org.url || ''),
          websiteUrl: String(org.websiteUrl || ''),
          email: String(org.email || ''),
          isVerified: Boolean(org.isVerified),
          publicDomains,
          members,
          shared: sharedParent ? 'parent' as const : verifiedDomain ? 'associated' as const : 'none' as const,
        };
      }).filter(row => row.login);

      const associatedMembers = new Set(preliminary.filter(row => row.shared === 'associated').flatMap(row => row.members));
      const nextRows = preliminary.map(row => ({
        ...row,
        shared: row.shared === 'none' && row.members.some(member => associatedMembers.has(member)) ? 'associated' as const : row.shared,
      }));
      setRows(nextRows);
      setHasSearched(true);
      await idbSet('orgHistory', `${parentOrg}:${query}`.toLowerCase(), { parentOrg, query, rows: nextRows, savedAt: new Date().toISOString() });
      setStatus(`${nextRows.length} ${c.results}`);
    } catch (error) {
      setStatus((error as Error).name === 'AbortError' ? t('研究已取消') : `${c.error}: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const visibleRows = rows.filter(row => relationFilter === 'all' || row.shared === relationFilter);
  const relationLabel = (value: OrgResearchRow['shared']) => value === 'parent' ? t('共享父组织成员') : value === 'associated' ? t('域名或关联成员线索') : t('未发现关联线索');

  return (
    <div className="space-y-4">
      <Panel title={c.orgResearch} description={t('用公开域名与可见成员寻找组织关联线索，结果不等同于所有权证明。')} icon={<Network className="h-5 w-5 text-primary-500" />}>
        <form onSubmit={event => { event.preventDefault(); void runSearch(); }} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label={c.parentOrg} value={parentOrg} onChange={setParentOrg} required disabled={busy} />
            <TextInput label={c.query} value={query} onChange={setQuery} required disabled={busy} />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <TextInput label={`${c.token} · ${t('必填')}`} value={token} onChange={setToken} type="password" required disabled={busy} />
            <ActionButton type="submit" disabled={busy || !parentOrg.trim() || !query.trim()} busy={busy}><Search className="h-4 w-4" />{t('查找组织关联')}</ActionButton>
            {busy && <ActionButton onClick={() => abortRef.current?.abort()} variant="ghost"><XCircle className="h-4 w-4" />{c.cancel}</ActionButton>}
          </div>
          <p className="text-xs leading-6 text-slate-500">{t('GraphQL 需要令牌；令牌仅保留在本页内存中。')}</p>
        </form>
        <StatusLine status={status} busy={busy} tone={status.startsWith(c.error) ? 'error' : 'info'} />
      </Panel>
      <Panel title={c.results}>
        {rows.length ? <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <ResultStat label={t('候选组织')} value={rows.length} /><ResultStat label={t('共享父组织成员')} value={rows.filter(row => row.shared === 'parent').length} /><ResultStat label={t('域名或关联成员线索')} value={rows.filter(row => row.shared === 'associated').length} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-600">{t('关联线索')}
              <select aria-label={t('关联线索')} value={relationFilter} onChange={event => setRelationFilter(event.target.value)} className="ui-select h-9 min-w-0 rounded-md border border-slate-200 bg-white px-2">
                <option value="all">{t('全部候选')}</option><option value="parent">{t('共享父组织成员')}</option><option value="associated">{t('域名或关联成员线索')}</option><option value="none">{t('未发现关联线索')}</option>
              </select>
            </label><span className="text-xs text-slate-500">{visibleRows.length} / {rows.length}</span>
          </div>
          <p className="text-xs leading-6 text-slate-500">{t('最多比较 50 个组织、每个组织前 30 个可见成员；未发现线索不代表不存在关联。')}</p>
          {visibleRows.length ? <div className="max-h-[34rem] overflow-auto rounded-md border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[600px] text-sm"><thead className="sticky top-0 z-10 bg-slate-50 text-xs text-slate-500"><tr>
              <th className="px-3 py-3 text-left">{t('组织')}</th><th className="px-3 py-3 text-left">{t('组织验证标记')}</th><th className="px-3 py-3 text-left">{t('关联线索')}</th><th className="px-3 py-3 text-left">{t('公开域名')}</th>
            </tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{visibleRows.map(row => <tr key={row.login} className="align-top hover:bg-slate-50/50">
              <td className="px-3 py-3"><a className="font-semibold text-primary-700 dark:text-primary-300" href={row.url} target="_blank" rel="noreferrer">{row.login}</a>{row.name && <p className="mt-1 text-xs text-slate-500">{row.name}</p>}</td>
              <td className="px-3 py-3 text-xs">{row.isVerified ? t('已验证') : t('未验证')}</td><td className="px-3 py-3 text-xs">{relationLabel(row.shared)}</td><td className="max-w-xs break-words px-3 py-3 text-xs leading-6 text-slate-500">{row.publicDomains.join(', ') || '—'}</td>
            </tr>)}</tbody></table>
          </div> : <EmptyResult title={t('没有匹配的组织')} description={t('切换关联筛选以查看其他候选组织。')} />}
        </> : <EmptyResult title={busy ? t('正在研究组织关联…') : hasSearched ? t('未找到候选组织') : t('开始一次组织研究')} description={t('填写父组织、搜索词和访问令牌。研究令牌可见的数据，结果作为后续核查线索。')} icon={<Network className="h-6 w-6" />} />}
      </Panel>
    </div>
  );
};

const renderTree = (
  node: FileTreeNode,
  onToggle: (path: string, selected: boolean) => void,
  depth = 0,
): React.ReactNode => {
  const row = <div className="flex min-w-0 items-center gap-2 py-2 text-xs">
    <input type="checkbox" aria-label={node.path} checked={node.selected} ref={input => { if (input) input.indeterminate = node.partial; }} onClick={event => event.stopPropagation()} onChange={event => onToggle(node.path, event.target.checked)} className="h-4 w-4 shrink-0 accent-primary-600" />
    {node.file ? <Square className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : <FolderTree className="h-4 w-4 shrink-0 text-primary-600" />}
    <span className="min-w-0 flex-1 break-all font-medium" title={node.path}>{node.name}</span>
    <span className="shrink-0 font-mono text-[11px] text-slate-500">{formatBytes(node.size)}</span>
    {node.file?.status === 'downloading' && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />}
    {node.file?.status === 'completed' && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}
    {node.file?.status === 'failed' && <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-600" />}
  </div>;
  if (!node.path) return <div className="divide-y divide-slate-100 dark:divide-slate-800">{node.children.map(child => renderTree(child, onToggle, depth + 1))}</div>;
  if (node.file) return <div key={node.path} className="px-2 hover:bg-slate-50">{row}{node.file.error && <p className="pb-2 pl-6 text-xs text-rose-600">{node.file.error}</p>}</div>;
  return <details key={node.path} open={depth < 2} className="min-w-0">
    <summary className="cursor-pointer list-none rounded px-2 hover:bg-slate-50"><div className="flex items-center gap-2"><ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" /><div className="min-w-0 flex-1">{row}</div></div></summary>
    <div className="ml-4 border-l border-slate-200 pl-2 dark:border-slate-800">{node.children.map(child => renderTree(child, onToggle, depth + 1))}</div>
  </details>;
};

export const RepositoryFolderDownloaderTool: React.FC = () => {
  const c = useCopy();
  const { t } = useI18n();
  const [url, setUrl] = useState('https://github.com/ThioJoe/Browser-Based-Tools/tree/main/Tools');
  const [githubToken, setGithubToken] = useState('');
  const [hfToken, setHfToken] = useState('');
  const [proxy, setProxy] = useState('');
  const [source, setSource] = useState<RepositorySource | null>(null);
  const [files, setFiles] = useState<DiscoveredRemoteFile[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [operation, setOperation] = useState<'scan' | 'zip' | 'save' | ''>('');
  const selectedFiles = files.filter(file => file.selected);
  const tree = useMemo(() => buildFileTree(files), [files]);
  const canSaveDirectory = 'showDirectoryPicker' in window;
  const updateFileStatus = (id: string, status: DiscoveredRemoteFile['status'], error?: string) => setFiles(previous => previous.map(file => file.id === id ? { ...file, status, error } : file));

  const scan = async () => {
    const parsed = parseRepositoryUrl(url);
    if (!parsed) {
      setStatus(`${c.error}: ${t('请输入 GitHub 或 HuggingFace 仓库文件夹链接。')}`);
      return;
    }
    setSource(parsed);
    setFiles([]);
    setBusy(true);
    setOperation('scan');
    setStatus(c.loading);
    const discovered: DiscoveredRemoteFile[] = [];
    try {
      const scanGithub = async (path: string) => {
        setStatus(`${t('正在扫描文件夹')} · ${path || parsed.repo}`);
        const cleanPath = path ? `/${path}` : '';
        const refParam = parsed.branch ? `?ref=${encodeURIComponent(parsed.branch)}` : '';
        const apiUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/contents${cleanPath}${refParam}`;
        const items = await fetchJson<Array<{ type: string; path: string; download_url: string; size: number }> | { type: string; path: string; download_url: string; size: number }>(
          applyCorsProxy(apiUrl, proxy),
          { headers: { Accept: 'application/vnd.github.v3+json', ...authHeaders(githubToken) } },
        );
        const list = Array.isArray(items) ? items : [items];
        for (const item of list) {
          if (item.type === 'file') {
            const relative = parsed.folderPath ? item.path.replace(`${parsed.folderPath}/`, '') : item.path;
            discovered.push(createRemoteFile(relative, item.path, item.download_url, item.size));
          } else if (item.type === 'dir') {
            await scanGithub(item.path);
          }
        }
      };

      const scanHf = async (path: string) => {
        setStatus(`${t('正在扫描文件夹')} · ${path || parsed.repo}`);
        const repoType = parsed.platform === 'huggingface-dataset' ? 'datasets' : 'models';
        const apiUrl = `https://huggingface.co/api/${repoType}/${parsed.owner}/${parsed.repo}/tree/${parsed.branch || 'main'}${path ? `/${path}` : ''}`;
        const items = await fetchJson<Array<{ type: string; path: string; size: number }>>(
          applyCorsProxy(apiUrl, proxy),
          { headers: authHeaders(hfToken, 'bearer') },
        );
        for (const item of items) {
          if (item.type === 'file') {
            const relative = parsed.folderPath ? item.path.replace(`${parsed.folderPath}/`, '') : item.path;
            const prefix = parsed.platform === 'huggingface-dataset' ? 'datasets/' : '';
            discovered.push(createRemoteFile(relative, item.path, `https://huggingface.co/${prefix}${parsed.owner}/${parsed.repo}/resolve/${parsed.branch || 'main'}/${item.path}?download=true`, item.size));
          } else if (item.type === 'directory') {
            await scanHf(item.path);
          }
        }
      };

      if (parsed.platform === 'github') await scanGithub(parsed.folderPath);
      else await scanHf(parsed.folderPath);
      setFiles(discovered);
      setStatus(`${t('扫描完成')} · ${discovered.length} ${t('个文件')}`);
    } catch (error) {
      setStatus(`${c.error}: ${(error as Error).message}`);
    } finally {
      setBusy(false);
      setOperation('');
    }
  };

  const fetchRemoteBlob = async (file: DiscoveredRemoteFile) => {
    const token = source?.platform === 'github' ? githubToken : hfToken;
    const headers = source?.platform === 'github' ? authHeaders(token) : authHeaders(token, 'bearer');
    const response = await fetch(applyCorsProxy(file.downloadUrl, proxy), { headers });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.blob();
  };

  const downloadZip = async () => {
    if (!selectedFiles.length) return;
    setBusy(true);
    setOperation('zip');
    let currentFile: DiscoveredRemoteFile | undefined;
    try {
      const zip = new JSZip();
      for (const [index, file] of selectedFiles.entries()) {
        currentFile = file;
        updateFileStatus(file.id, 'downloading');
        setStatus(`${t('正在读取文件')} ${index + 1}/${selectedFiles.length} · ${file.path}`);
        zip.file(file.path, await fetchRemoteBlob(file));
        updateFileStatus(file.id, 'completed');
      }
      currentFile = undefined;
      setStatus(t('文件读取完成，正在生成 ZIP…'));
      downloadBlob(await zip.generateAsync({ type: 'blob' }), `${source?.repo || 'repository'}-folder.zip`);
      setStatus(t('ZIP 已生成并交给浏览器下载。'));
    } catch (error) {
      if (currentFile) updateFileStatus(currentFile.id, 'failed', (error as Error).message);
      setStatus(`${c.error}: ${(error as Error).message}`);
    } finally {
      setBusy(false);
      setOperation('');
    }
  };

  const directSave = async () => {
    const picker = (window as unknown as { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker;
    if (!picker) {
      await downloadZip();
      return;
    }
    setBusy(true);
    setOperation('save');
    let currentFile: DiscoveredRemoteFile | undefined;
    try {
      const root = await picker();
      for (const [index, file] of selectedFiles.entries()) {
        currentFile = file;
        updateFileStatus(file.id, 'downloading');
        setStatus(`${t('正在保存文件')} ${index + 1}/${selectedFiles.length} · ${file.path}`);
        const parts = file.path.split('/');
        let dir = root;
        for (const part of parts.slice(0, -1)) {
          dir = await dir.getDirectoryHandle(part, { create: true });
        }
        const handle = await dir.getFileHandle(parts[parts.length - 1], { create: true });
        const writable = await handle.createWritable();
        await writable.write(await fetchRemoteBlob(file));
        await writable.close();
        updateFileStatus(file.id, 'completed');
      }
      setStatus(t('所选文件已保存到文件夹。'));
    } catch (error) {
      if (currentFile) updateFileStatus(currentFile.id, 'failed', (error as Error).message);
      setStatus((error as Error).name === 'AbortError' ? t('文件夹选择已取消') : `${c.error}: ${(error as Error).message}`);
    } finally {
      setBusy(false);
      setOperation('');
    }
  };

  return (
    <div className="space-y-4">
      <Panel title={c.folderDownloader} description={t('先扫描远程目录，勾选所需文件，再导出 ZIP 或保存到本地文件夹。')} icon={<Archive className="h-5 w-5 text-primary-500" />}>
        <form onSubmit={event => { event.preventDefault(); void scan(); }} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <TextInput label={c.repoUrl} value={url} onChange={setUrl} required disabled={busy} />
          <ActionButton type="submit" disabled={busy || !url.trim()} busy={operation === 'scan'}><Search className="h-4 w-4" />{t('扫描文件')}</ActionButton>
        </form>
        <AdvancedControls>
          <TextInput label={`GitHub ${c.token} (${c.optional})`} value={githubToken} onChange={setGithubToken} type="password" disabled={busy} />
          <TextInput label={`HuggingFace ${c.token} (${c.optional})`} value={hfToken} onChange={setHfToken} type="password" disabled={busy} />
          <TextInput label={c.proxy} value={proxy} onChange={setProxy} placeholder="https://proxy/?url={TheUrl}" disabled={busy} />
        </AdvancedControls>
        <StatusLine status={status} busy={busy} tone={status.startsWith(c.error) ? 'error' : 'info'} />
      </Panel>
      <Panel title={source ? `${source.owner}/${source.repo} · ${c.results}` : t('文件选择')} actions={files.length > 0 && <>
        <ActionButton onClick={downloadZip} disabled={busy || selectedFiles.length === 0} busy={operation === 'zip'}><FileArchive className="h-4 w-4" />{c.downloadZip}</ActionButton>
        {canSaveDirectory && <ActionButton onClick={directSave} disabled={busy || selectedFiles.length === 0} busy={operation === 'save'} variant="ghost"><Download className="h-4 w-4" />{c.directSave}</ActionButton>}
      </>}>
        {files.length ? <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><ResultStat label={t('发现文件')} value={files.length} /><ResultStat label={c.selected} value={selectedFiles.length} /><ResultStat label={t('预计下载大小')} value={formatBytes(selectedFiles.reduce((sum, file) => sum + file.size, 0))} /><ResultStat label={t('已读取文件')} value={files.filter(file => file.status === 'completed').length} /></div>
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton variant="ghost" disabled={busy} onClick={() => setFiles(previous => previous.map(file => ({ ...file, selected: true })))}>{t('全选文件')}</ActionButton>
            <ActionButton variant="ghost" disabled={busy} onClick={() => setFiles(previous => previous.map(file => ({ ...file, selected: false })))}>{t('清除选择')}</ActionButton>
            {source && <span className="min-w-0 break-all text-xs text-slate-500">{source.branch || t('默认分支')} / {source.folderPath || '/'}</span>}
          </div>
          <p className="text-xs leading-6 text-slate-500">{t('文件依次读取；ZIP 在浏览器内存中打包，大目录建议直接保存到文件夹。')}{!canSaveDirectory && ` ${t('当前浏览器不支持直接保存目录，请使用 ZIP。')}`}</p>
          <fieldset disabled={busy} className="max-h-[34rem] min-w-0 overflow-auto rounded-md border border-slate-200 p-3 disabled:opacity-70 dark:border-slate-800" aria-label={t('选择要下载的文件')}>
            {renderTree(tree, (path, selected) => setFiles(previous => setFileSelectionByPrefix(previous, path, selected)))}
          </fieldset>
        </> : <EmptyResult title={busy ? t('正在扫描目录…') : status.startsWith(c.error) ? t('扫描未完成') : source && status ? t('目录中没有可下载文件') : t('先扫描一个仓库文件夹')} description={t('支持 GitHub 仓库与 HuggingFace 模型、数据集目录。扫描后可按文件或整个子目录选择。')} icon={<FolderTree className="h-6 w-6" />} />}
      </Panel>
    </div>
  );
};

const TreeNodeView: React.FC<{ node: DependencyNode; depth?: number }> = ({ node, depth = 0 }) => {
  const { t } = useI18n();
  const content = <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 py-2 text-xs">
    {node.error ? <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" /> : node.verified ? <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" /> : <Boxes className="h-4 w-4 shrink-0 text-slate-400" />}
    <span className="break-all font-semibold text-slate-900 dark:text-slate-100">{node.name}</span>
    <span className="break-all font-mono text-primary-700 dark:text-primary-300">{node.version}</span>
    {node.children.length > 0 && <span className="text-slate-500">({node.children.length})</span>}
    {node.circular && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">{t('循环引用')}</span>}
    {node.duplicate && <span className="rounded bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500">{t('重复引用')}</span>}
    {node.error && <span className="break-all text-rose-600 dark:text-rose-300">{node.error === 'limit' ? t('达到遍历上限') : node.error}</span>}
  </div>;
  if (!node.children.length) return <div className="px-2 hover:bg-slate-50/50">{content}{node.rawRequirement && <p className="break-all pb-2 pl-6 font-mono text-[11px] text-slate-500">{node.rawRequirement}</p>}</div>;
  return <details open={depth < 2} className="min-w-0">
    <summary className="flex cursor-pointer list-none gap-2 rounded px-2 hover:bg-slate-50/50"><ChevronRight className="mt-2.5 h-3.5 w-3.5 shrink-0 text-slate-400" />{content}</summary>
    {node.rawRequirement && <p className="break-all pb-2 pl-8 font-mono text-[11px] text-slate-500">{node.rawRequirement}</p>}
    <div className="ml-4 border-l border-slate-200 pl-2 dark:border-slate-800">{node.children.map((child, index) => <TreeNodeView key={`${child.name}-${child.version}-${index}`} node={child} depth={depth + 1} />)}</div>
  </details>;
};

const DependencySummary: React.FC<{ root: DependencyNode }> = ({ root }) => {
  const { t } = useI18n();
  const nodes = flattenDependencyTree(root);
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
    <ResultStat label={t('根包')} value={`${root.name} · ${root.version}`} /><ResultStat label={t('唯一依赖节点')} value={nodes.length} /><ResultStat label={t('读取失败或达到上限')} value={nodes.filter(node => node.error).length} /><ResultStat label={t('顶层依赖')} value={root.children.length} />
  </div>;
};

const DependencyResult: React.FC<{
  root: DependencyNode | null;
  view: 'tree' | 'list';
  hiddenNamespaces?: Set<string>;
}> = ({ root, view, hiddenNamespaces }) => {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  if (!root) return <EmptyResult title={t('依赖结果将在这里显示')} description={t('输入包名并开始分析。树视图可折叠分支，列表视图便于搜索与查看失败节点。')} icon={<Boxes className="h-6 w-6" />} />;
  const filter = (node: DependencyNode): DependencyNode | null => {
    const namespace = node.namespace || node.name.split('.')[0];
    if (hiddenNamespaces?.has(namespace) && node.children.length === 0) return null;
    const children = node.children.map(filter).filter((child): child is DependencyNode => child !== null);
    const matches = `${node.name} ${node.version} ${node.rawRequirement || ''}`.toLowerCase().includes(query.trim().toLowerCase());
    if (query.trim() && !matches && !children.length) return null;
    return { ...node, children };
  };
  const visible = filter(root);
  return <div className="space-y-3">
    <TextInput label={t('搜索依赖结果')} value={query} onChange={setQuery} placeholder={t('包名、版本或原始依赖声明')} />
    {!visible ? <EmptyResult title={t('没有匹配的依赖')} description={t('调整搜索词或命名空间筛选。')} /> : view === 'list' ? <div className="max-h-[34rem] overflow-auto rounded-md border border-slate-200 dark:border-slate-800">
      <table className="w-full min-w-[480px] text-xs"><thead className="sticky top-0 bg-slate-50 text-slate-500"><tr><th className="px-3 py-3 text-left">{t('包名')}</th><th className="px-3 py-3 text-left">{t('版本')}</th><th className="px-3 py-3 text-left">{t('读取状态')}</th><th className="px-3 py-3 text-left">{t('原始声明')}</th></tr></thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{flattenDependencyTree(visible).map(node => <tr key={`${node.provider}-${node.name}-${node.version}`} className="align-top hover:bg-slate-50/50"><td className="break-all px-3 py-3 font-semibold">{node.name}</td><td className="px-3 py-3 font-mono">{node.version}</td><td className={`px-3 py-3 ${node.error ? 'text-rose-600' : 'text-slate-500'}`}>{node.error ? node.error === 'limit' ? t('达到遍历上限') : node.error : node.verified ? t('已验证前缀') : t('已读取元数据')}</td><td className="max-w-sm break-all px-3 py-3 font-mono text-slate-500">{node.rawRequirement || '—'}</td></tr>)}</tbody>
      </table>
    </div> : <div className="max-h-[34rem] min-w-0 overflow-auto rounded-md border border-slate-200 p-2 dark:border-slate-800"><TreeNodeView node={visible} /></div>}
  </div>;
};

export const NuGetDependencyVisualizerTool: React.FC = () => {
  const c = useCopy();
  const { t } = useI18n();
  const [name, setName] = useState('Newtonsoft.Json');
  const [proxy, setProxy] = useState('');
  const [root, setRoot] = useState<DependencyNode | null>(null);
  const [view, setView] = useState<'tree' | 'list'>('tree');
  const [hiddenNamespaces, setHiddenNamespaces] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const namespaces = useMemo(() => root ? collectNamespaces(root) : new Map(), [root]);

  const run = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setStatus(c.loading);
    const fetchCached = new Map<string, Promise<unknown>>();
    const budget = createDependencyBudget(DEFAULT_DEPENDENCY_LIMITS);
    try {
      const service = await fetchJson<{ resources: Array<{ '@id': string; '@type': string }> }>(applyCorsProxy('https://api.nuget.org/v3/index.json', proxy));
      const flat = service.resources.find(item => item['@type'].includes('PackageBaseAddress'))?.['@id'] || 'https://api.nuget.org/v3-flatcontainer/';
      const registration = service.resources.find(item => item['@type'].includes('RegistrationsBaseUrl'))?.['@id'] || 'https://api.nuget.org/v3/registration5-semver1/';
      const searchUrl = service.resources.find(item => item['@type'].includes('SearchQueryService'))?.['@id'] || 'https://azuresearch-usnc.nuget.org/query';
      const cachedJson = <T,>(url: string) => {
        if (!fetchCached.has(url)) fetchCached.set(url, fetchJson<T>(applyCorsProxy(url, proxy)));
        return fetchCached.get(url) as Promise<T>;
      };
      const resolveVersion = async (id: string, constraint?: string | null) => {
        const versions = (await cachedJson<{ versions: string[] }>(`${flat}${id.toLowerCase()}/index.json`)).versions;
        const normalized = normalizeNuGetVersionConstraint(constraint);
        if (normalized) return versions.find(version => version.toLowerCase() === normalized.toLowerCase()) || versions[versions.length - 1];
        return versions.filter(version => !version.includes('-')).pop() || versions[versions.length - 1] || 'latest';
      };
      const metadata = async (id: string, version: string) => {
        const data = await cachedJson<{ items: Array<{ items?: Array<{ catalogEntry: Record<string, unknown> }>; '@id'?: string }> }>(`${registration}${id.toLowerCase()}/index.json`);
        for (const page of data.items) {
          const items = page.items || (page['@id'] ? (await cachedJson<{ items: Array<{ catalogEntry: Record<string, unknown> }> }>(page['@id'])).items : []);
          const found = items.find(item => String(item.catalogEntry.version).toLowerCase() === version.toLowerCase());
          if (found) return found.catalogEntry;
        }
        return null;
      };
      const verified = async (id: string) => {
        const data = await cachedJson<{ data?: Array<{ id: string; verified?: boolean; owners?: string[] }> }>(`${searchUrl}?q=packageid:${encodeURIComponent(id)}&take=1`);
        return data.data?.[0];
      };
      const visit = async (id: string, constraint: string | null, depth: number, path = new Set<string>()): Promise<DependencyNode> => {
        const idLower = id.toLowerCase();
        if (!budget.canVisit(depth)) return createDependencyNode('nuget', id, 'limit', { error: 'limit' });
        if (path.has(idLower)) return createDependencyNode('nuget', id, 'circular', { circular: true });
        const version = await resolveVersion(id, constraint);
        const [meta, verify] = await Promise.all([metadata(id, version), verified(id)]);
        const node = createDependencyNode('nuget', id, version, {
          namespace: id.split('.')[0],
          verified: Boolean(verify?.verified),
          owners: verify?.owners || [],
          metadata: meta,
        });
        const groups = (meta?.dependencyGroups as Array<{ dependencies?: Array<{ id: string; range?: string }> }> | undefined) || [];
        const deps = new Map<string, string | null>();
        groups.forEach(group => group.dependencies?.forEach(dep => deps.set(dep.id, dep.range || null)));
        const nextPath = new Set(path).add(idLower);
        node.children = await Promise.all(Array.from(deps.entries()).map(([dep, range]) => visit(dep, range, depth + 1, nextPath)));
        return node;
      };
      const nextRoot = await visit(name, null, 0);
      setRoot(nextRoot);
      setHiddenNamespaces(new Set());
      setStatus(`${flattenDependencyTree(nextRoot).length} ${c.results}`);
    } catch (error) {
      setStatus(`${c.error}: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Panel title={c.nugetDeps} description={t('查看 NuGet 包的递归依赖，再按命名空间聚焦需要研究的分支。')} icon={<Boxes className="h-5 w-5 text-primary-500" />}>
        <form onSubmit={event => { event.preventDefault(); void run(); }} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <TextInput label={c.packageName} value={name} onChange={setName} required disabled={busy} />
          <ActionButton type="submit" disabled={busy || !name.trim()} busy={busy}><Search className="h-4 w-4" />{t('分析依赖')}</ActionButton>
        </form>
        <AdvancedControls><TextInput label={c.proxy} value={proxy} onChange={setProxy} disabled={busy} /><p className="text-xs leading-6 text-slate-500">{t('最多递归 4 层、250 个节点；使用包注册信息，不替代 lock 文件或完整版本解析。')}</p></AdvancedControls>
        <StatusLine status={status} busy={busy} tone={status.startsWith(c.error) ? 'error' : 'info'} />
      </Panel>
      <Panel title={c.results} actions={root && <ViewControls view={view} onChange={setView} />}>
        {root && <DependencySummary root={root} />}
        {namespaces.size > 0 && <details className="rounded-md border border-slate-200 p-3 dark:border-slate-800" open>
          <summary className="cursor-pointer text-xs font-medium text-slate-600">{c.namespaceFilter} · {namespaces.size}</summary>
          <div className="mt-3 flex flex-wrap gap-2">{Array.from(namespaces.entries()).map(([namespace, meta]) => <label key={namespace} className="inline-flex max-w-full items-center gap-2 rounded border border-slate-200 px-2.5 py-2 text-xs dark:border-slate-800">
            <input type="checkbox" checked={!hiddenNamespaces.has(namespace)} onChange={event => setHiddenNamespaces(previous => { const next = new Set(previous); if (event.target.checked) next.delete(namespace); else next.add(namespace); return next; })} className="accent-primary-600" />
            <span className="break-all">{namespace} ({meta.count})</span>{meta.verified && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-label={t('已验证前缀')} />}
          </label>)}</div>
        </details>}
        <DependencyResult root={root} view={view} hiddenNamespaces={hiddenNamespaces} />
      </Panel>
    </div>
  );
};

export const PyPiDependencyExplorerTool: React.FC = () => {
  const c = useCopy();
  const { t } = useI18n();
  const [name, setName] = useState('requests');
  const [extras, setExtras] = useState('');
  const [proxy, setProxy] = useState('');
  const [hideMaintainer, setHideMaintainer] = useState(false);
  const [root, setRoot] = useState<DependencyNode | null>(null);
  const [view, setView] = useState<'tree' | 'list'>('tree');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const displayedRoot = useMemo(() => {
    if (!root || !hideMaintainer) return root;
    const owners = root.owners || [];
    const filter = (node: DependencyNode, depth = 0): DependencyNode | null => {
      const children = node.children.map(child => filter(child, depth + 1)).filter((child): child is DependencyNode => child !== null);
      const sameOwner = depth > 0 && Boolean(node.owners?.some(owner => owners.includes(owner)));
      return sameOwner && children.length === 0 ? null : { ...node, children };
    };
    return filter(root);
  }, [hideMaintainer, root]);

  const run = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setStatus(c.loading);
    const processed = new Map<string, DependencyNode>();
    const requested = extras.toLowerCase() === 'all' ? ['all'] : extras.split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
    const budget = createDependencyBudget(DEFAULT_DEPENDENCY_LIMITS);
    try {
      const visit = async (pkg: string, depth: number, isRoot = false): Promise<DependencyNode> => {
        const key = pkg.toLowerCase();
        if (!budget.canVisit(depth)) return createDependencyNode('pypi', pkg, 'limit', { error: 'limit' });
        if (!isRoot && processed.has(key)) return { ...processed.get(key)!, children: [], duplicate: true };
        try {
          const data = await fetchJson<{ info: { version: string; requires_dist?: string[]; author?: string; maintainer?: string } }>(applyCorsProxy(`https://pypi.org/pypi/${encodeURIComponent(pkg)}/json`, proxy));
          const owners = [data.info.maintainer, data.info.author].filter(Boolean) as string[];
          const node = createDependencyNode('pypi', pkg, data.info.version, { owners });
          processed.set(key, node);
          const requirements = (data.info.requires_dist || []).filter(req => shouldIncludePyPiRequirement(req, requested, isRoot));
          node.children = await Promise.all(requirements.map(async req => {
            const parsed = parsePyPiRequirement(req);
            const child = parsed.name ? await visit(parsed.name, depth + 1, false) : createDependencyNode('pypi', req, 'unknown', { error: 'parse' });
            return { ...child, rawRequirement: req };
          }));
          return node;
        } catch (error) {
          return createDependencyNode('pypi', pkg, 'error', { error: (error as Error).message });
        }
      };
      const nextRoot = await visit(name, 0, true);
      setRoot(nextRoot);
      setStatus(nextRoot.error ? `${c.error}: ${nextRoot.error}` : `${flattenDependencyTree(nextRoot).length} ${c.results}`);
    } catch (error) {
      setStatus(`${c.error}: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Panel title={c.pypiDeps} description={t('读取 Python 包依赖与 Extras，再在结果中切换维护者过滤，无需重新请求。')} icon={<PackageCheck className="h-5 w-5 text-primary-500" />}>
        <form onSubmit={event => { event.preventDefault(); void run(); }} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <TextInput label={c.packageName} value={name} onChange={setName} required disabled={busy} />
          <TextInput label={c.extras} value={extras} onChange={setExtras} placeholder="all, security" disabled={busy} />
          <ActionButton type="submit" disabled={busy || !name.trim()} busy={busy}><Search className="h-4 w-4" />{t('分析依赖')}</ActionButton>
        </form>
        <p className="text-xs leading-6 text-slate-500">{t('Extras 留空读取基本依赖，逗号分隔指定扩展，all 读取根包的全部扩展。')}</p>
        <AdvancedControls><TextInput label={c.proxy} value={proxy} onChange={setProxy} disabled={busy} /><p className="text-xs leading-6 text-slate-500">{t('按最新版本读取元数据；Python 版本与平台环境条件未完整求值，不能替代 pip 解析。')}</p></AdvancedControls>
        <StatusLine status={status} busy={busy} tone={status.startsWith(c.error) ? 'error' : 'info'} />
      </Panel>
      <Panel title={c.results} actions={root && <ViewControls view={view} onChange={setView} />}>
        {root && <><DependencySummary root={root} /><label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={hideMaintainer} onChange={event => setHideMaintainer(event.target.checked)} className="h-4 w-4 accent-primary-600" />{c.hideMaintainer}<span className="text-slate-500">({t('即时筛选')})</span></label></>}
        <DependencyResult root={displayedRoot} view={view} />
      </Panel>
    </div>
  );
};

export const RustDependencyVisualizerTool: React.FC = () => {
  const c = useCopy();
  const { t } = useI18n();
  const [name, setName] = useState('serde');
  const [proxy, setProxy] = useState('https://corsproxy.io/?{TheUrl}');
  const [depth, setDepth] = useState(1);
  const [root, setRoot] = useState<DependencyNode | null>(null);
  const [view, setView] = useState<'tree' | 'list'>('tree');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setStatus(c.loading);
    const cache = new Map<string, Promise<unknown>>();
    const cachedJson = <T,>(url: string) => {
      const target = applyCorsProxy(url, proxy);
      if (!cache.has(target)) cache.set(target, fetchJson<T>(target));
      return cache.get(target) as Promise<T>;
    };
    try {
      const latest = async (crate: string) => (await cachedJson<{ crate: { max_version: string } }>(`https://crates.io/api/v1/crates/${crate}`)).crate.max_version;
      const visit = async (crate: string, version: string, currentDepth: number): Promise<DependencyNode> => {
        try {
          const node = createDependencyNode('crates', crate, version);
          if (currentDepth >= depth) return node;
          const data = await cachedJson<{ dependencies: Array<{ crate_id: string; kind: string; optional: boolean; req: string }> }>(`https://crates.io/api/v1/crates/${crate}/${version}/dependencies`);
          const normal = data.dependencies.filter(dep => dep.kind === 'normal');
          node.children = await Promise.all(normal.map(async dep => visit(dep.crate_id, await latest(dep.crate_id), currentDepth + 1)));
          return node;
        } catch (error) {
          return createDependencyNode('crates', crate, version, { error: (error as Error).message });
        }
      };
      const nextRoot = await visit(name, await latest(name), 0);
      setRoot(nextRoot);
      setStatus(nextRoot.error ? `${c.error}: ${nextRoot.error}` : `${flattenDependencyTree(nextRoot).length} ${c.results}`);
    } catch (error) {
      setStatus(`${c.error}: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Panel title={c.rustDeps} description={t('从一个 Crate 开始，选择探索深度，查看普通依赖的树与列表。')} icon={<Boxes className="h-5 w-5 text-primary-500" />}>
        <form onSubmit={event => { event.preventDefault(); void run(); }} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end">
          <TextInput label={c.crateName} value={name} onChange={setName} required disabled={busy} />
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">{c.depth}<select aria-label={c.depth} value={depth} onChange={event => setDepth(Number(event.target.value))} disabled={busy} className="ui-select h-10 rounded-md border border-slate-200 bg-white px-3">{[0, 1, 2, 3, 4].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <ActionButton type="submit" disabled={busy || !name.trim()} busy={busy}><Search className="h-4 w-4" />{t('分析依赖')}</ActionButton>
        </form>
        <p className="text-xs leading-6 text-slate-500">{t('深度 0 只读取根包；更深层级会增加网络请求。依赖按最新版本展示，不代表 Cargo 的最终解析结果。')}</p>
        <AdvancedControls><TextInput label={c.proxy} value={proxy} onChange={setProxy} disabled={busy} /><p className="text-xs leading-6 text-slate-500">{t('默认代理用于读取 crates.io；可调整代理模板。')}</p></AdvancedControls>
        <StatusLine status={status} busy={busy} tone={status.startsWith(c.error) ? 'error' : 'info'} />
      </Panel>
      <Panel title={c.results} actions={root && <ViewControls view={view} onChange={setView} />}>
        {root && <DependencySummary root={root} />}<DependencyResult root={root} view={view} />
      </Panel>
    </div>
  );
};

type CertificateDetail = {
  subject: string;
  issuer: string;
  serialNumber: string;
  notBefore: Date;
  notAfter: Date;
  sha1: string;
  sha256: string;
  pem: string;
  signer: boolean;
};

type SignatureResult = {
  id: string;
  version: string;
  size: number;
  hash: string;
  nuspec: NuspecMetadata;
  signed: boolean;
  certificates: CertificateDetail[];
};

const bytesToHex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes)).map(byte => byte.toString(16).padStart(2, '0')).join('');

const formatDn = (dn: Forge.pki.CertificateField[]) => dn.map(item => `${item.shortName || item.name || item.type}=${item.value}`).join(', ');

export const NuGetSignatureInspectorTool: React.FC = () => {
  const c = useCopy();
  const { t } = useI18n();
  const [name, setName] = useState('Newtonsoft.Json');
  const [versions, setVersions] = useState<string[]>([]);
  const [version, setVersion] = useState('');
  const [proxy, setProxy] = useState('');
  const [result, setResult] = useState<SignatureResult | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [operation, setOperation] = useState<'versions' | 'signature' | ''>('');

  const loadVersions = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setOperation('versions');
    setStatus(t('正在读取包版本…'));
    setResult(null);
    try {
      const data = await fetchJson<{ versions: string[] }>(applyCorsProxy(`https://api.nuget.org/v3-flatcontainer/${name.toLowerCase()}/index.json`, proxy));
      const next = data.versions.slice().reverse();
      setVersions(next);
      setVersion(next[0] || '');
      setStatus(`${next.length} ${t('个可选版本')}`);
    } catch (error) {
      setStatus(`${c.error}: ${(error as Error).message}`);
    } finally {
      setBusy(false);
      setOperation('');
    }
  };

  const analyze = async () => {
    const targetVersion = version || versions[0];
    if (!targetVersion) return;
    setBusy(true);
    setOperation('signature');
    setStatus(c.loading);
    try {
      const url = `https://api.nuget.org/v3-flatcontainer/${name.toLowerCase()}/${targetVersion.toLowerCase()}/${name.toLowerCase()}.${targetVersion.toLowerCase()}.nupkg`;
      const response = await fetch(applyCorsProxy(url, proxy));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = await response.arrayBuffer();
      const hash = bytesToHex(await crypto.subtle.digest('SHA-256', buffer));
      const zip = await JSZip.loadAsync(buffer);
      const nuspecFile = zip.file(/\.nuspec$/i)[0];
      const nuspec = nuspecFile ? parseNuspecMetadata(await nuspecFile.async('text')) : { description: 'N/A', authors: 'N/A', projectUrl: 'N/A', license: 'N/A' };
      const sig = zip.file('.signature.p7s');
      if (!sig) {
        setResult({ id: name, version: targetVersion, size: buffer.byteLength, hash, nuspec, signed: false, certificates: [] });
        setStatus(t('未发现签名文件'));
        return;
      }
      const signatureBytes = await sig.async('uint8array');
      const forge = await loadForge();
      let binary = '';
      signatureBytes.forEach(byte => { binary += String.fromCharCode(byte); });
      const p7 = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(binary)) as Forge.pkcs7.PkcsSignedData;
      const rawCapture = (p7 as unknown as { rawCapture?: { signerInfos?: Array<Array<{ value?: Array<{ value?: string }> }>> } }).rawCapture;
      const signerSerial = rawCapture?.signerInfos?.[0]?.[1]?.value?.[0]?.value;
      const certificates = (p7.certificates || []).map(cert => {
        const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
        const sha1 = forge.md.sha1.create().update(der).digest().toHex();
        const sha256 = forge.md.sha256.create().update(der).digest().toHex();
        return {
          subject: formatDn(cert.subject.attributes),
          issuer: formatDn(cert.issuer.attributes),
          serialNumber: cert.serialNumber,
          notBefore: cert.validity.notBefore,
          notAfter: cert.validity.notAfter,
          sha1: normalizeFingerprint(sha1),
          sha256: normalizeFingerprint(sha256),
          pem: forge.pki.certificateToPem(cert),
          signer: signerSerial ? cert.serialNumber.toLowerCase() === signerSerial.toLowerCase() : false,
        };
      });
      setResult({ id: name, version: targetVersion, size: buffer.byteLength, hash, nuspec, signed: true, certificates });
      setStatus(t('签名文件与证书已解析；尚未验证签名有效性。'));
    } catch (error) {
      setStatus(`${c.error}: ${(error as Error).message}`);
    } finally {
      setBusy(false);
      setOperation('');
    }
  };

  const certStatus = (cert: CertificateDetail) => {
    const statusName = getCertificateDateStatus(cert.notBefore, cert.notAfter);
    if (statusName === 'expired') return t('证书日期已过期');
    if (statusName === 'not-yet-active') return t('证书日期尚未生效');
    return t('日期在有效期内');
  };

  return (
    <div className="space-y-4">
      <Panel title={c.signature} description={t('选择包与版本，下载 nupkg 后在浏览器中查看签名文件、证书与摘要。')} icon={<ShieldCheck className="h-5 w-5 text-primary-500" />}>
        <form onSubmit={event => { event.preventDefault(); void loadVersions(); }} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <TextInput label={c.packageName} value={name} onChange={value => { setName(value); setVersions([]); setVersion(''); setResult(null); setStatus(''); }} required disabled={busy} />
          <ActionButton type="submit" disabled={busy || !name.trim()} busy={operation === 'versions'}><RefreshCw className="h-4 w-4" />{c.loadVersions}</ActionButton>
        </form>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium text-slate-700">{c.version}
            <select aria-label={c.version} value={version} onChange={event => { setVersion(event.target.value); setResult(null); setStatus(''); }} disabled={busy || !versions.length} className="ui-select h-10 w-full rounded-md border border-slate-200 bg-white px-3 disabled:opacity-60">
              {!versions.length && <option value="">{t('先加载包版本')}</option>}{versions.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <ActionButton onClick={analyze} disabled={busy || !version} busy={operation === 'signature'}><ShieldCheck className="h-4 w-4" />{c.analyzeSignature}</ActionButton>
        </div>
        <AdvancedControls><TextInput label={c.proxy} value={proxy} onChange={setProxy} disabled={busy} /></AdvancedControls>
        <StatusLine status={status} busy={busy} tone={status.startsWith(c.error) ? 'error' : 'info'} />
      </Panel>
      <Panel title={t('签名与证书详情')}>
        {result ? <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><ResultStat label={c.packageName} value={result.id} /><ResultStat label={c.version} value={result.version} /><ResultStat label={t('包大小')} value={formatBytes(result.size)} /><ResultStat label={t('签名文件')} value={result.signed ? t('已发现') : t('未发现')} /></div>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200"><Info className="mr-2 inline h-4 w-4" />{t('此工具解析签名容器和证书日期，不验证包签名、信任链、时间戳或吊销状态。发现签名文件不代表包可信。')}</div>
          <div className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-medium text-slate-600">{c.packageHash}</span><ActionButton variant="ghost" onClick={() => { void navigator.clipboard.writeText(result.hash).then(() => setStatus(t('包摘要已复制'))).catch(error => setStatus(`${c.error}: ${(error as Error).message}`)); }}>{t('复制摘要')}</ActionButton></div>
            <p className="break-all font-mono text-xs leading-6">{result.hash}</p>
          </div>
          <details className="rounded-md border border-slate-200 p-3 dark:border-slate-800"><summary className="cursor-pointer text-xs font-medium">{t('包元数据')}</summary><div className="mt-3 space-y-2 text-xs leading-6"><p><span className="text-slate-500">{t('作者')}：</span>{result.nuspec.authors}</p><p>{result.nuspec.description}</p><p className="break-all"><span className="text-slate-500">{t('许可证')}：</span>{result.nuspec.license}</p><p className="break-all"><span className="text-slate-500">{t('项目地址')}：</span>{result.nuspec.projectUrl}</p></div></details>
          {result.certificates.length ? <div className="space-y-3">{result.certificates.map((cert, index) => <details key={`${cert.serialNumber}-${index}`} open={index === 0} className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
            <summary className="cursor-pointer text-sm font-medium">{c.certificate} {index + 1} · {certStatus(cert)} {cert.signer ? `· ${t('签名者标记')}` : ''}</summary>
            <dl className="mt-4 grid gap-3 text-xs leading-6 sm:grid-cols-[6rem_minmax(0,1fr)]">
              <dt className="text-slate-500">{t('主体')}</dt><dd className="break-all">{cert.subject}</dd><dt className="text-slate-500">{t('颁发者')}</dt><dd className="break-all">{cert.issuer}</dd>
              <dt className="text-slate-500">{t('序列号')}</dt><dd className="break-all font-mono">{cert.serialNumber}</dd><dt className="text-slate-500">{t('日期范围')}</dt><dd>{cert.notBefore.toLocaleDateString()} – {cert.notAfter.toLocaleDateString()}</dd>
              <dt className="text-slate-500">SHA-256</dt><dd className="break-all font-mono">{cert.sha256}</dd><dt className="text-slate-500">SHA-1</dt><dd className="break-all font-mono">{cert.sha1}</dd>
            </dl>
            <details className="mt-4"><summary className="cursor-pointer text-xs font-medium text-slate-500">{t('查看 PEM 证书')}</summary><textarea aria-label={`${c.certificate} ${index + 1} PEM`} readOnly value={cert.pem} className="ui-textarea mt-2 min-h-40 w-full rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-5" /></details>
          </details>)}</div> : <EmptyResult title={result.signed ? t('签名容器未提供可解析证书') : t('此包没有签名文件')} description={t('包摘要和元数据仍可用于人工核对；未签名本身不能证明包恶意。')} icon={<ShieldCheck className="h-6 w-6" />} />}
        </> : <EmptyResult title={t('先选择 NuGet 包与版本')} description={t('第一步加载可选版本，第二步解析签名。结果会显示包摘要、证书日期和完整指纹。')} icon={<ShieldCheck className="h-6 w-6" />} />}
      </Panel>
    </div>
  );
};
