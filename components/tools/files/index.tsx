import React, { useMemo, useState } from 'react';
import { Check, Copy, FileText, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { FieldLabel, Textarea, Select } from '../../ui/ToolUi';
import { formatBytes, getExtension, readFileAsDataUrl } from '../shared/fileUtils';
import { useCopyToClipboard } from '../shared/useCopyToClipboard';
import { FileDropzone, WorkflowEmpty, WorkflowNotice } from '../shared/WorkflowUi';

const hashFile = async (file: File) => {
  const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, '0')).join('');
};
const fileKey = (file: File) => `${file.name}-${file.size}-${file.lastModified}`;

export const FileInfoTool: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [hashes, setHashes] = useState<Map<File, string>>(new Map());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { copied, copy } = useCopyToClipboard();
  const loadHashes = async () => {
    setBusy(true); setError('');
    try {
      const entries: [File, string][] = [];
      for (const file of files) entries.push([file, await hashFile(file)]);
      setHashes(new Map(entries));
    } catch (err) { setError(err instanceof Error ? err.message : '无法读取文件'); }
    finally { setBusy(false); }
  };
  return (
    <Card className="h-full flex flex-col">
      <CardHeader title="文件信息" description="先查看文件属性，再按需计算或复制 SHA-256。文件留在本地。" actions={
        <Button size="sm" onClick={loadHashes} isLoading={busy} disabled={!files.length}>计算 SHA-256</Button>
      } />
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
        <FileDropzone multiple disabled={busy} compact={files.length > 0} onFiles={selected => { setFiles(selected); setHashes(new Map()); setError(''); }} />
        {error && <WorkflowNotice tone="error">{error}</WorkflowNotice>}
        {files.length ? <>
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <span>{files.length} 个文件 · {formatBytes(files.reduce((total, file) => total + file.size, 0))}</span>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setFiles([]); setHashes(new Map()); }}>清空列表</Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="workflow-table"><thead><tr><th>文件</th><th>大小 / 类型</th><th>修改时间</th><th><span className="sr-only">删除</span></th></tr></thead>
              <tbody>{files.map((file, index) => <React.Fragment key={`${fileKey(file)}-${index}`}><tr>
                <td><span className="inline-flex items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-primary-600" /><span data-i18n-skip className="break-all">{file.name}</span></span><small>{getExtension(file.name) || '无扩展名'}</small></td>
                <td className="whitespace-nowrap">{formatBytes(file.size)}<small>{file.type || '未知类型'}</small></td>
                <td className="whitespace-nowrap text-xs">{new Date(file.lastModified).toLocaleString()}</td>
                <td><Button size="xs" variant="ghost" aria-label={`删除 ${file.name}`} disabled={busy} onClick={() => setFiles(current => current.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button></td>
              </tr>{hashes.get(file) && <tr><td colSpan={4}><div className="flex items-center justify-between gap-3 rounded bg-slate-50 px-3 py-2"><code className="break-all text-xs"><span className="mr-2 text-slate-500">SHA-256</span>{hashes.get(file)}</code><Button variant="secondary" size="xs" aria-label="复制 SHA-256" onClick={() => copy(hashes.get(file) || '')}>{copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}</Button></div></td></tr>}</React.Fragment>)}</tbody>
            </table>
          </div>
        </> : <WorkflowEmpty title="把文件放在这里，先看清它是什么" description="支持同时检查多个文件。SHA-256 只在点击计算后生成。" icon={<FileText className="h-6 w-6" />} />}
      </CardContent>
    </Card>
  );
};

const PATH_SAMPLE = '/Users/demo/archive.tar.gz\nhttps://example.com/assets/app.min.js?ver=1\nC:\\temp\\report.pdf';
type NameMode = 'all' | 'name' | 'stem' | 'extension';
export const FileNameExtractorTool: React.FC = () => {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<NameMode>('all');
  const { copied, copy } = useCopyToClipboard();
  const rows = useMemo(() => input.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
    const withoutQuery = /^[a-z][a-z\d+.-]*:\/\//i.test(line) ? line.split(/[?#]/)[0] : line;
    const name = withoutQuery.split(/[\\/]/).filter(Boolean).pop() || withoutQuery;
    const dot = name.lastIndexOf('.');
    const extension = dot > 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : '';
    return { name, extension, stem: extension ? name.slice(0, -(extension.length + 1)) : name };
  }), [input]);
  const output = rows.map(row => mode === 'all' ? `${row.name}\t${row.stem}\t${row.extension || '-'}` : row[mode]).join('\n');
  return (
    <Card className="h-full flex flex-col">
      <CardHeader title="文件名提取" description="每行粘贴一个路径或 URL，结果实时更新。选择需要复制的字段。" />
      <CardContent className="grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-auto lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
        <section className="flex min-h-64 flex-col gap-3">
          <div className="flex items-center justify-between gap-3"><FieldLabel>路径 / URL 列表</FieldLabel><div className="flex gap-1"><Button variant="ghost" size="xs" onClick={() => setInput(PATH_SAMPLE)}>示例</Button><Button variant="ghost" size="xs" onClick={() => setInput('')} disabled={!input}>清空</Button></div></div>
          <Textarea aria-label="路径 / URL 列表" className="min-h-64 flex-1 resize-y font-mono" placeholder="/folder/report.pdf" value={input} onChange={event => setInput(event.target.value)} />
          <p className="text-xs text-slate-500">URL 查询参数与片段会被忽略。</p>
        </section>
        <section className="flex min-h-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2"><Select aria-label="复制字段" className="w-auto flex-1" value={mode} onChange={event => setMode(event.target.value as NameMode)}><option value="all">全部字段（TSV）</option><option value="name">只复制文件名</option><option value="stem">只复制主名</option><option value="extension">只复制扩展名</option></Select><Button size="sm" onClick={() => copy(output)} disabled={!rows.length} icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>复制结果</Button></div>
          {rows.length ? <div className="overflow-auto rounded-lg border border-slate-200"><table className="workflow-table"><thead><tr><th>文件名</th><th>主名</th><th>扩展名</th></tr></thead><tbody>{rows.map((row, i) => <tr key={i}><td data-i18n-skip className="break-all">{row.name}</td><td data-i18n-skip className="break-all">{row.stem}</td><td data-i18n-skip>{row.extension || '-'}</td></tr>)}</tbody></table></div> : <WorkflowEmpty title="提取结果" description="输入路径后，这里会逐行展示文件名、主名和扩展名。" />}
        </section>
      </CardContent>
    </Card>
  );
};

export const FileBase64Tool: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [dataUrl, setDataUrl] = useState('');
  const [mode, setMode] = useState<'url' | 'base64'>('url');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { copied, copy } = useCopyToClipboard();
  const output = mode === 'url' ? dataUrl : dataUrl.slice(dataUrl.indexOf(',') + 1);
  const handleFile = async (selected: File[]) => {
    if (!selected[0]) return;
    setBusy(true); setError(''); setDataUrl(''); setFile(selected[0]);
    try { setDataUrl(await readFileAsDataUrl(selected[0])); }
    catch (err) { setError(err instanceof Error ? err.message : '无法读取文件'); }
    finally { setBusy(false); }
  };
  return (
    <Card className="h-full flex flex-col">
      <CardHeader title="Base64/文件转换器" description="选择文件，按使用场景复制 Data URL 或纯 Base64。" />
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
        <FileDropzone disabled={busy} fileName={file?.name} onFiles={handleFile} />
        {error && <WorkflowNotice tone="error">{error}</WorkflowNotice>}
        {file && <p className="text-xs text-slate-500">{formatBytes(file.size)} · {file.type || 'application/octet-stream'} · {busy ? '正在读取...' : `${output.length.toLocaleString()} 字符`}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="workflow-segmented"><button aria-pressed={mode === 'url'} onClick={() => setMode('url')}>Data URL</button><button aria-pressed={mode === 'base64'} onClick={() => setMode('base64')}>Base64</button></div><Button size="sm" onClick={() => copy(output)} disabled={!output} icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>复制结果</Button></div>
        <p className="text-xs text-slate-500">{mode === 'url' ? '包含 MIME 前缀，可直接作为资源地址。' : '不包含前缀，适合 API 请求中的 Base64 字段。'}</p>
        <Textarea readOnly aria-label="编码结果" className="min-h-64 flex-1 resize-y bg-slate-50 font-mono text-xs" value={output} placeholder="选择文件后生成编码结果" />
      </CardContent>
    </Card>
  );
};
