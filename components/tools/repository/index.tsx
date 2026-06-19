import React, { useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import type * as Forge from 'node-forge';
import {
  AlertCircle,
  Archive,
  Boxes,
  CheckCircle2,
  Download,
  FileArchive,
  FolderTree,
  GitBranch,
  Loader2,
  Network,
  RefreshCw,
  Search,
  ShieldCheck,
  Square,
  XCircle,
} from 'lucide-react';
import { useI18n } from '../../../src/i18n';
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

const Panel: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <section className="tool-panel space-y-4">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      {icon}
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
}> = ({ label, value, onChange, placeholder, type = 'text' }) => (
  <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
    {label}
    <input
      type={type}
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
    />
  </label>
);

const ActionButton: React.FC<{
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost';
}> = ({ children, onClick, disabled, variant = 'primary' }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={variant === 'primary'
      ? 'inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary-600 px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50'
      : 'inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900'}
  >
    {children}
  </button>
);

const StatusLine: React.FC<{ status: string; busy?: boolean; tone?: 'error' | 'success' | 'info' }> = ({ status, busy, tone = 'info' }) => {
  if (!status) return null;
  const color = tone === 'error' ? 'text-rose-700 dark:text-rose-300' : tone === 'success' ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-300';
  return (
    <div className={`flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-900 ${color}`}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : tone === 'error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
      <span>{status}</span>
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
  const [entity, setEntity] = useState('openai');
  const [token, setToken] = useState('');
  const [repos, setRepos] = useState<RepoRow[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
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
    setBusy(true);
    setStatus('');
    try {
      const user = await fetchJson<{ type: string }>(`https://api.github.com/users/${encodeURIComponent(entity)}`, {
        headers: authHeaders(token),
      });
      const route = user.type === 'Organization' ? 'orgs' : 'users';
      const firstUrl = `https://api.github.com/${route}/${encodeURIComponent(entity)}/repos?per_page=100&page=1&sort=full_name`;
      const firstResponse = await fetch(firstUrl, { headers: authHeaders(token) });
      if (!firstResponse.ok) throw new Error(`HTTP ${firstResponse.status}`);
      const firstPage = await firstResponse.json() as RepoRow[];
      const lastPage = parseLastPage(firstResponse.headers.get('link'));
      const restPages = await Promise.all(Array.from({ length: Math.max(0, lastPage - 1) }, async (_, index) => {
        const page = index + 2;
        return fetchJson<RepoRow[]>(`https://api.github.com/${route}/${encodeURIComponent(entity)}/repos?per_page=100&page=${page}&sort=full_name`, {
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
      await idbSet('repoCache', entity.toLowerCase(), { entity, repos: nextRepos, fetchedAt: new Date().toISOString() });
      setStatus(`${nextRepos.length} ${c.results}`);
    } catch (error) {
      const cached = await idbGet<{ repos: RepoRow[] }>('repoCache', entity.toLowerCase());
      if (cached?.repos) {
        setRepos(cached.repos);
        setStatus(`${c.cached}: ${(error as Error).message}`);
      } else {
        setStatus(`${c.error}: ${(error as Error).message}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const fetchReleases = async () => {
    setBusy(true);
    try {
      const next: RepoRow[] = [];
      for (const repo of repos) {
        const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(entity)}/${encodeURIComponent(repo.name)}/releases?per_page=1`, {
          headers: authHeaders(token),
        });
        if (!response.ok) {
          next.push(repo);
          continue;
        }
        const releases = await response.json() as Array<{ assets?: Array<{ name: string }> }>;
        next.push({
          ...repo,
          has_releases: releases.length > 0,
          has_exe: releases.some(release => release.assets?.some(asset => /\.exe$/i.test(asset.name))),
        });
      }
      setRepos(next);
      await idbSet('repoCache', entity.toLowerCase(), { entity, repos: next, fetchedAt: new Date().toISOString() });
      setStatus(`${c.release}: OK`);
    } catch (error) {
      setStatus(`${c.error}: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const exportCache = () => {
    downloadBlob(new Blob([JSON.stringify({ entity, repos }, null, 2)], { type: 'application/json' }), `${entity}-repo-cache.json`);
  };

  return (
    <div className="space-y-4">
      <Panel title={c.repoExplorer} icon={<GitBranch className="h-5 w-5 text-primary-500" />}>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto_auto]">
          <TextInput label={c.entity} value={entity} onChange={setEntity} />
          <TextInput label={`${c.token} (${c.optional})`} value={token} onChange={setToken} type="password" />
          <ActionButton onClick={fetchRepos} disabled={busy}><Search className="h-4 w-4" />{c.fetchRepos}</ActionButton>
          <ActionButton onClick={fetchReleases} disabled={busy || repos.length === 0} variant="ghost"><RefreshCw className="h-4 w-4" />{c.fetchReleases}</ActionButton>
          <ActionButton onClick={exportCache} disabled={repos.length === 0} variant="ghost"><Download className="h-4 w-4" />{c.export}</ActionButton>
          <ActionButton onClick={() => idbClear('repoCache').then(() => setStatus(`${c.cached}: ${c.clear}`))} variant="ghost">{c.clear}</ActionButton>
        </div>
        <StatusLine status={status} busy={busy} tone={status.startsWith(c.error) ? 'error' : 'info'} />
      </Panel>

      <Panel title={c.results}>
        <div className="grid gap-3 md:grid-cols-4">
          <TextInput label="Name" value={nameFilter} onChange={setNameFilter} />
          <TextInput label={c.language} value={languageFilter} onChange={setLanguageFilter} />
          <TextInput label={c.description} value={descriptionFilter} onChange={setDescriptionFilter} />
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            {c.release}
            <select value={releaseFilter} onChange={event => setReleaseFilter(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
              <option value="all">All</option>
              <option value="has">Has releases</option>
              <option value="exe">Has .exe</option>
              <option value="none">No releases</option>
            </select>
          </label>
        </div>
        <div className="max-h-[34rem] overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-right">{c.stars}</th>
                <th className="px-3 py-2 text-left">{c.language}</th>
                <th className="px-3 py-2 text-left">{c.release}</th>
                <th className="px-3 py-2 text-left">{c.updated}</th>
                <th className="px-3 py-2 text-left">{c.description}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map(repo => (
                <tr key={repo.name}>
                  <td className="px-3 py-2"><a href={repo.html_url} target="_blank" rel="noreferrer" className="font-medium text-primary-700 dark:text-primary-300">{repo.name}</a></td>
                  <td className="px-3 py-2 text-right font-mono">{repo.stargazers_count.toLocaleString()}</td>
                  <td className="px-3 py-2">{repo.language || 'N/A'}</td>
                  <td className="px-3 py-2">{repo.has_releases === undefined ? '-' : repo.has_exe ? '.exe' : repo.has_releases ? 'Yes' : 'No'}</td>
                  <td className="px-3 py-2">{new Date(repo.updated_at).toLocaleDateString()}</td>
                  <td className="max-w-xl truncate px-3 py-2">{repo.description || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
};

export const GitHubOrganizationResearchTool: React.FC = () => {
  const c = useCopy();
  const [parentOrg, setParentOrg] = useState('openai');
  const [query, setQuery] = useState('openai');
  const [token, setToken] = useState('');
  const [rows, setRows] = useState<OrgResearchRow[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const runSearch = async () => {
    if (!token.trim()) {
      setStatus(`${c.token}: ${c.error}`);
      return;
    }
    const abort = new AbortController();
    abortRef.current = abort;
    setBusy(true);
    setStatus(c.loading);
    try {
      const graph = async <T,>(body: string, variables: Record<string, unknown>) => fetchJson<T>('https://api.github.com/graphql', {
        method: 'POST',
        signal: abort.signal,
        headers: { 'Content-Type': 'application/json', ...authHeaders(token, 'bearer') },
        body: JSON.stringify({ query: body, variables }),
      });
      const orgFields = `login name url websiteUrl email isVerified membersWithRole(first: 30) { totalCount nodes { login } }`;
      const parent = await graph<{ data: { organization: null | { membersWithRole: { nodes: Array<{ login: string }> }; websiteUrl?: string; email?: string } } }>(
        `query($login:String!){ organization(login:$login){ ${orgFields} } }`,
        { login: parentOrg },
      );
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
      await idbSet('orgHistory', `${parentOrg}:${query}`.toLowerCase(), { parentOrg, query, rows: nextRows, savedAt: new Date().toISOString() });
      setStatus(`${nextRows.length} ${c.results}`);
    } catch (error) {
      setStatus(`${c.error}: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Panel title={c.orgResearch} icon={<Network className="h-5 w-5 text-primary-500" />}>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto_auto]">
          <TextInput label={c.parentOrg} value={parentOrg} onChange={setParentOrg} />
          <TextInput label={c.query} value={query} onChange={setQuery} />
          <TextInput label={c.token} value={token} onChange={setToken} type="password" />
          <ActionButton onClick={runSearch} disabled={busy}><Search className="h-4 w-4" />{c.search}</ActionButton>
          <ActionButton onClick={() => abortRef.current?.abort()} disabled={!busy} variant="ghost"><XCircle className="h-4 w-4" />{c.cancel}</ActionButton>
        </div>
        <StatusLine status={status} busy={busy} tone={status.startsWith(c.error) ? 'error' : 'info'} />
      </Panel>
      <Panel title={c.results}>
        <div className="max-h-[34rem] overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
              <tr>
                <th className="px-3 py-2 text-left">Org</th>
                <th className="px-3 py-2 text-left">{c.verifiedDomain}</th>
                <th className="px-3 py-2 text-left">{c.sharedMembers}</th>
                <th className="px-3 py-2 text-left">Domains</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map(row => (
                <tr key={row.login}>
                  <td className="px-3 py-2"><a className="font-medium text-primary-700 dark:text-primary-300" href={row.url} target="_blank" rel="noreferrer">{row.login}</a></td>
                  <td className="px-3 py-2">{row.isVerified ? 'true' : '-'}</td>
                  <td className="px-3 py-2">{row.shared}</td>
                  <td className="px-3 py-2">{row.publicDomains.join(', ') || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
};

const renderTree = (
  node: FileTreeNode,
  onToggle: (path: string, selected: boolean) => void,
  depth = 0,
) => (
  <div key={node.path || 'root'} className="space-y-1">
    {node.path && (
      <label className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-slate-50 dark:hover:bg-slate-900" style={{ marginLeft: depth * 14 }}>
        <input
          type="checkbox"
          checked={node.selected}
          ref={input => { if (input) input.indeterminate = node.partial; }}
          onChange={event => onToggle(node.path, event.target.checked)}
        />
        {node.file ? <Square className="h-3 w-3" /> : <FolderTree className="h-3 w-3" />}
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        <span className="font-mono text-xs text-slate-500">{formatBytes(node.size)}</span>
      </label>
    )}
    {node.children.map(child => renderTree(child, onToggle, depth + (node.path ? 1 : 0)))}
  </div>
);

export const RepositoryFolderDownloaderTool: React.FC = () => {
  const c = useCopy();
  const [url, setUrl] = useState('https://github.com/ThioJoe/Browser-Based-Tools/tree/main/Tools');
  const [githubToken, setGithubToken] = useState('');
  const [hfToken, setHfToken] = useState('');
  const [proxy, setProxy] = useState('');
  const [concurrency, setConcurrency] = useState(3);
  const [source, setSource] = useState<RepositorySource | null>(null);
  const [files, setFiles] = useState<DiscoveredRemoteFile[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const selectedFiles = files.filter(file => file.selected);
  const tree = useMemo(() => buildFileTree(files), [files]);

  const scan = async () => {
    const parsed = parseRepositoryUrl(url);
    if (!parsed) {
      setStatus(`${c.error}: URL`);
      return;
    }
    setSource(parsed);
    setFiles([]);
    setBusy(true);
    setStatus(c.loading);
    const discovered: DiscoveredRemoteFile[] = [];
    try {
      const scanGithub = async (path: string) => {
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
      setStatus(`${discovered.length} files`);
    } catch (error) {
      setStatus(`${c.error}: ${(error as Error).message}`);
    } finally {
      setBusy(false);
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
    setBusy(true);
    try {
      const zip = new JSZip();
      for (const file of selectedFiles) {
        zip.file(file.path, await fetchRemoteBlob(file));
      }
      downloadBlob(await zip.generateAsync({ type: 'blob' }), `${source?.repo || 'repository'}-folder.zip`);
      setStatus('ZIP OK');
    } catch (error) {
      setStatus(`${c.error}: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const directSave = async () => {
    const picker = (window as unknown as { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker;
    if (!picker) {
      await downloadZip();
      return;
    }
    setBusy(true);
    try {
      const root = await picker();
      for (const file of selectedFiles) {
        const parts = file.path.split('/');
        let dir = root;
        for (const part of parts.slice(0, -1)) {
          dir = await dir.getDirectoryHandle(part, { create: true });
        }
        const handle = await dir.getFileHandle(parts[parts.length - 1], { create: true });
        const writable = await handle.createWritable();
        await writable.write(await fetchRemoteBlob(file));
        await writable.close();
      }
      setStatus('OK');
    } catch (error) {
      setStatus(`${c.error}: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Panel title={c.folderDownloader} icon={<Archive className="h-5 w-5 text-primary-500" />}>
        <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr]">
          <TextInput label={c.repoUrl} value={url} onChange={setUrl} />
          <TextInput label={`GitHub ${c.token}`} value={githubToken} onChange={setGithubToken} type="password" />
          <TextInput label={`HF ${c.token}`} value={hfToken} onChange={setHfToken} type="password" />
          <TextInput label={c.proxy} value={proxy} onChange={setProxy} placeholder="https://proxy/?url={TheUrl}" />
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            {c.concurrency}: {concurrency}
            <input type="range" min={1} max={10} value={concurrency} onChange={event => setConcurrency(Number(event.target.value))} />
          </label>
          <div className="flex items-end gap-2">
            <ActionButton onClick={scan} disabled={busy}><Search className="h-4 w-4" />{c.scan}</ActionButton>
            <ActionButton onClick={downloadZip} disabled={busy || selectedFiles.length === 0} variant="ghost"><FileArchive className="h-4 w-4" />{c.downloadZip}</ActionButton>
            <ActionButton onClick={directSave} disabled={busy || selectedFiles.length === 0} variant="ghost"><Download className="h-4 w-4" />{c.directSave}</ActionButton>
          </div>
        </div>
        <StatusLine status={`${status} · ${selectedFiles.length} ${c.selected} · ${formatBytes(selectedFiles.reduce((sum, file) => sum + file.size, 0))}`} busy={busy} tone={status.startsWith(c.error) ? 'error' : 'info'} />
      </Panel>
      <Panel title={c.results}>
        {files.length ? renderTree(tree, (path, selected) => setFiles(previous => setFileSelectionByPrefix(previous, path, selected))) : <p className="text-sm text-slate-500">{c.empty}</p>}
      </Panel>
    </div>
  );
};

const TreeNodeView: React.FC<{ node: DependencyNode; hiddenNamespaces?: Set<string>; depth?: number }> = ({ node, hiddenNamespaces = new Set(), depth = 0 }) => {
  const namespace = node.namespace || node.name.split('.')[0];
  const hidden = hiddenNamespaces.has(namespace);
  if (hidden && node.children.length === 0) return null;
  return (
    <div className={hidden ? 'opacity-45' : ''}>
      <div className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-slate-50 dark:hover:bg-slate-900" style={{ marginLeft: depth * 16 }}>
        {node.error ? <AlertCircle className="h-4 w-4 text-rose-500" /> : node.verified ? <ShieldCheck className="h-4 w-4 text-emerald-500" /> : <Boxes className="h-4 w-4 text-slate-400" />}
        <span className="font-medium text-slate-900 dark:text-slate-100">{node.name}</span>
        <span className="font-mono text-xs text-primary-700 dark:text-primary-300">{node.version}</span>
        {node.circular && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">circular</span>}
        {node.duplicate && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">duplicate</span>}
        {node.error && <span className="text-xs text-rose-600">{node.error}</span>}
      </div>
      {node.children.map(child => <TreeNodeView key={`${node.name}-${child.name}-${child.version}`} node={child} hiddenNamespaces={hiddenNamespaces} depth={depth + 1} />)}
    </div>
  );
};

const DependencyResult: React.FC<{
  root: DependencyNode | null;
  view: 'tree' | 'list';
  hiddenNamespaces?: Set<string>;
}> = ({ root, view, hiddenNamespaces }) => {
  if (!root) return null;
  if (view === 'list') {
    return (
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {flattenDependencyTree(root).map(node => (
          <div key={`${node.provider}-${node.name}-${node.version}`} className="rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-800">
            <div className="font-medium">{node.name}</div>
            <div className="font-mono text-xs text-slate-500">{node.version}</div>
          </div>
        ))}
      </div>
    );
  }
  return <TreeNodeView node={root} hiddenNamespaces={hiddenNamespaces} />;
};

export const NuGetDependencyVisualizerTool: React.FC = () => {
  const c = useCopy();
  const [name, setName] = useState('Newtonsoft.Json');
  const [proxy, setProxy] = useState('');
  const [root, setRoot] = useState<DependencyNode | null>(null);
  const [view, setView] = useState<'tree' | 'list'>('tree');
  const [hiddenNamespaces, setHiddenNamespaces] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const namespaces = useMemo(() => root ? collectNamespaces(root) : new Map(), [root]);

  const run = async () => {
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
      setStatus(`${flattenDependencyTree(nextRoot).length} ${c.results}`);
    } catch (error) {
      setStatus(`${c.error}: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Panel title={c.nugetDeps}>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
          <TextInput label={c.packageName} value={name} onChange={setName} />
          <TextInput label={c.proxy} value={proxy} onChange={setProxy} />
          <ActionButton onClick={run} disabled={busy}><Search className="h-4 w-4" />{c.run}</ActionButton>
          <ActionButton onClick={() => setView(view === 'tree' ? 'list' : 'tree')} variant="ghost">{view === 'tree' ? c.list : c.tree}</ActionButton>
        </div>
        <StatusLine status={status} busy={busy} tone={status.startsWith(c.error) ? 'error' : 'info'} />
      </Panel>
      {namespaces.size > 0 && (
        <Panel title={c.namespaceFilter}>
          <div className="flex flex-wrap gap-2">
            {Array.from(namespaces.entries()).map(([namespace, meta]) => (
              <label key={namespace} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1 text-sm dark:border-slate-800">
                <input
                  type="checkbox"
                  checked={!hiddenNamespaces.has(namespace)}
                  onChange={event => setHiddenNamespaces(previous => {
                    const next = new Set(previous);
                    if (event.target.checked) next.delete(namespace);
                    else next.add(namespace);
                    return next;
                  })}
                />
                {namespace} ({meta.count}) {meta.verified ? '✓' : ''}
              </label>
            ))}
          </div>
        </Panel>
      )}
      <Panel title={c.results}><DependencyResult root={root} view={view} hiddenNamespaces={hiddenNamespaces} /></Panel>
    </div>
  );
};

export const PyPiDependencyExplorerTool: React.FC = () => {
  const c = useCopy();
  const [name, setName] = useState('requests');
  const [extras, setExtras] = useState('');
  const [proxy, setProxy] = useState('');
  const [hideMaintainer, setHideMaintainer] = useState(false);
  const [root, setRoot] = useState<DependencyNode | null>(null);
  const [view, setView] = useState<'tree' | 'list'>('tree');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    setStatus(c.loading);
    const processed = new Map<string, DependencyNode>();
    const rootOwners: string[] = [];
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
          if (isRoot) rootOwners.splice(0, rootOwners.length, ...owners);
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
      const filterMaintainer = (node: DependencyNode, depth = 0): DependencyNode | null => {
        const sameOwner = depth > 0 && Boolean(node.owners?.some(owner => rootOwners.includes(owner)));
        const children = node.children.map(child => filterMaintainer(child, depth + 1)).filter(Boolean) as DependencyNode[];
        if (hideMaintainer && sameOwner && children.length === 0) return null;
        return { ...node, children };
      };
      setRoot(filterMaintainer(nextRoot));
      setStatus(`${flattenDependencyTree(nextRoot).length} ${c.results}`);
    } catch (error) {
      setStatus(`${c.error}: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Panel title={c.pypiDeps}>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto_auto]">
          <TextInput label={c.packageName} value={name} onChange={setName} />
          <TextInput label={c.extras} value={extras} onChange={setExtras} placeholder="all, security" />
          <TextInput label={c.proxy} value={proxy} onChange={setProxy} />
          <ActionButton onClick={run} disabled={busy}><Search className="h-4 w-4" />{c.run}</ActionButton>
          <ActionButton onClick={() => setView(view === 'tree' ? 'list' : 'tree')} variant="ghost">{view === 'tree' ? c.list : c.tree}</ActionButton>
        </div>
        <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={hideMaintainer} onChange={event => setHideMaintainer(event.target.checked)} />{c.hideMaintainer}</label>
        <StatusLine status={status} busy={busy} tone={status.startsWith(c.error) ? 'error' : 'info'} />
      </Panel>
      <Panel title={c.results}><DependencyResult root={root} view={view} /></Panel>
    </div>
  );
};

export const RustDependencyVisualizerTool: React.FC = () => {
  const c = useCopy();
  const [name, setName] = useState('serde');
  const [proxy, setProxy] = useState('https://corsproxy.io/?{TheUrl}');
  const [depth, setDepth] = useState(1);
  const [root, setRoot] = useState<DependencyNode | null>(null);
  const [view, setView] = useState<'tree' | 'list'>('tree');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
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
      setStatus(`${flattenDependencyTree(nextRoot).length} ${c.results}`);
    } catch (error) {
      setStatus(`${c.error}: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Panel title={c.rustDeps}>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_10rem_auto_auto]">
          <TextInput label={c.crateName} value={name} onChange={setName} />
          <TextInput label={c.proxy} value={proxy} onChange={setProxy} />
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            {c.depth}
            <input className="h-10 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950" type="number" min={0} max={4} value={depth} onChange={event => setDepth(Number(event.target.value))} />
          </label>
          <ActionButton onClick={run} disabled={busy}><Search className="h-4 w-4" />{c.run}</ActionButton>
          <ActionButton onClick={() => setView(view === 'tree' ? 'list' : 'tree')} variant="ghost">{view === 'tree' ? c.list : c.tree}</ActionButton>
        </div>
        <StatusLine status={status} busy={busy} tone={status.startsWith(c.error) ? 'error' : 'info'} />
      </Panel>
      <Panel title={c.results}><DependencyResult root={root} view={view} /></Panel>
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
  const [name, setName] = useState('Newtonsoft.Json');
  const [versions, setVersions] = useState<string[]>([]);
  const [version, setVersion] = useState('');
  const [proxy, setProxy] = useState('');
  const [result, setResult] = useState<SignatureResult | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const loadVersions = async () => {
    setBusy(true);
    try {
      const data = await fetchJson<{ versions: string[] }>(applyCorsProxy(`https://api.nuget.org/v3-flatcontainer/${name.toLowerCase()}/index.json`, proxy));
      const next = data.versions.slice().reverse();
      setVersions(next);
      setVersion(next[0] || '');
      setStatus(`${next.length} versions`);
    } catch (error) {
      setStatus(`${c.error}: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const analyze = async () => {
    const targetVersion = version || versions[0];
    if (!targetVersion) return;
    setBusy(true);
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
        setStatus(c.unsigned);
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
      setStatus(c.signed);
    } catch (error) {
      setStatus(`${c.error}: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const certStatus = (cert: CertificateDetail) => {
    const statusName = getCertificateDateStatus(cert.notBefore, cert.notAfter);
    if (statusName === 'expired') return c.expired;
    if (statusName === 'not-yet-active') return c.notYetActive;
    return c.valid;
  };

  return (
    <div className="space-y-4">
      <Panel title={c.signature} icon={<ShieldCheck className="h-5 w-5 text-primary-500" />}>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto_auto]">
          <TextInput label={c.packageName} value={name} onChange={setName} />
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            {c.version}
            <select value={version} onChange={event => setVersion(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
              {versions.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <TextInput label={c.proxy} value={proxy} onChange={setProxy} />
          <ActionButton onClick={loadVersions} disabled={busy}><RefreshCw className="h-4 w-4" />{c.loadVersions}</ActionButton>
          <ActionButton onClick={analyze} disabled={busy || !version}><ShieldCheck className="h-4 w-4" />{c.analyzeSignature}</ActionButton>
        </div>
        <StatusLine status={status} busy={busy} tone={status.startsWith(c.error) ? 'error' : result?.signed ? 'success' : 'info'} />
      </Panel>
      {result && (
        <Panel title={c.results}>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900"><div className="text-xs text-slate-500">ID</div><div className="font-medium">{result.id}</div></div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900"><div className="text-xs text-slate-500">{c.version}</div><div className="font-mono">{result.version}</div></div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900"><div className="text-xs text-slate-500">Size</div><div className="font-mono">{formatBytes(result.size)}</div></div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900"><div className="text-xs text-slate-500">{c.status}</div><div className="font-medium">{result.signed ? c.signed : c.unsigned}</div></div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <div className="text-xs text-slate-500">{c.packageHash}</div>
            <div className="break-all font-mono text-xs">{result.hash}</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
            <div className="font-semibold">{result.nuspec.authors}</div>
            <div className="mt-1 text-slate-600 dark:text-slate-300">{result.nuspec.description}</div>
          </div>
          <div className="space-y-3">
            {result.certificates.map((cert, index) => (
              <details key={`${cert.serialNumber}-${index}`} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <summary className="cursor-pointer font-medium">{c.certificate} {index + 1} · {certStatus(cert)} {cert.signer ? '· signer' : ''}</summary>
                <div className="mt-3 grid gap-3 text-sm">
                  <div><span className="text-slate-500">Subject:</span> {cert.subject}</div>
                  <div><span className="text-slate-500">Issuer:</span> {cert.issuer}</div>
                  <div><span className="text-slate-500">Serial:</span> <span className="font-mono">{cert.serialNumber}</span></div>
                  <div><span className="text-slate-500">SHA-256:</span> <span className="break-all font-mono text-xs">{cert.sha256}</span></div>
                  <div><span className="text-slate-500">SHA-1:</span> <span className="break-all font-mono text-xs">{cert.sha1}</span></div>
                  <textarea readOnly value={cert.pem} className="min-h-36 rounded-lg border border-slate-200 bg-slate-50 p-2 font-mono text-xs dark:border-slate-800 dark:bg-slate-950" />
                </div>
              </details>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
};
