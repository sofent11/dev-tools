import React, { useMemo, useState } from 'react';
import { Check, Copy, FileArchive, FileText, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { FieldLabel, Textarea, UploadPanel } from '../../ui/ToolUi';
import { formatBytes, getExtension, readFileAsDataUrl } from '../shared/fileUtils';
import { useCopyToClipboard } from '../shared/useCopyToClipboard';

const hashFile = async (file: File, algorithm: AlgorithmIdentifier) => {
  const buffer = await file.arrayBuffer();
  const hash = await crypto.subtle.digest(algorithm, buffer);
  return Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, '0')).join('');
};

export const FileInfoTool: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [hashes, setHashes] = useState<Record<string, string>>({});

  const loadHashes = async () => {
    const entries = await Promise.all(files.map(async file => [`${file.name}-${file.size}`, await hashFile(file, 'SHA-256')] as const));
    setHashes(Object.fromEntries(entries));
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader
        title="文件信息"
        description="本地读取文件元信息，可按需计算 SHA-256。"
        actions={<Button size="sm" variant="secondary" onClick={loadHashes} disabled={!files.length}>计算 SHA-256</Button>}
      />
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <UploadPanel>
          <label className="flex cursor-pointer flex-col items-center gap-2 p-6 text-center">
            <Upload className="h-8 w-8 text-primary-600" />
            <span className="text-sm font-medium text-slate-700">选择文件，不会上传到服务器</span>
            <input className="hidden" type="file" multiple onChange={event => setFiles(Array.from(event.target.files || []))} />
          </label>
        </UploadPanel>
        <div className="grid gap-3 overflow-auto">
          {files.map(file => {
            const key = `${file.name}-${file.size}`;
            return (
              <div key={key} className="tool-panel p-4">
                <div className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
                  <FileText className="h-4 w-4 text-primary-600" />
                  <span className="break-all">{file.name}</span>
                </div>
                <div className="grid gap-2 text-sm md:grid-cols-2">
                  <span>大小：{formatBytes(file.size)}</span>
                  <span>类型：{file.type || '未知'}</span>
                  <span>扩展名：{getExtension(file.name) || '无'}</span>
                  <span>修改时间：{new Date(file.lastModified).toLocaleString()}</span>
                </div>
                {hashes[key] && <div className="mt-3 break-all rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-700">SHA-256: {hashes[key]}</div>}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export const FileNameExtractorTool: React.FC = () => {
  const [input, setInput] = useState('/Users/demo/archive.tar.gz\nhttps://example.com/assets/app.min.js?ver=1\nC:\\\\temp\\\\report.pdf');
  const { copied, copy } = useCopyToClipboard();

  const output = useMemo(() => input.split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const withoutQuery = line.split(/[?#]/)[0];
      const name = withoutQuery.split(/[\\/]/).filter(Boolean).pop() || withoutQuery;
      const extension = getExtension(name);
      const stem = extension ? name.slice(0, -(extension.length + 1)) : name;
      return `${name}\t${stem}\t${extension || '-'}`;
    })
    .join('\n'), [input]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader title="文件名提取" description="从路径、URL 或批量文本中提取文件名、主名和扩展名。" />
      <CardContent className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-2">
        <div className="flex min-h-0 flex-col gap-2">
          <FieldLabel>路径 / URL 列表</FieldLabel>
          <Textarea className="min-h-0 flex-1 resize-none font-mono" value={input} onChange={event => setInput(event.target.value)} />
        </div>
        <div className="flex min-h-0 flex-col gap-2">
          <div className="flex items-center justify-between">
            <FieldLabel>文件名 / 主名 / 扩展名</FieldLabel>
            <Button size="sm" variant="secondary" onClick={() => copy(output)} disabled={!output}>
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <Textarea readOnly className="min-h-0 flex-1 resize-none bg-slate-50 font-mono" value={output} />
        </div>
      </CardContent>
    </Card>
  );
};

export const FileBase64Tool: React.FC = () => {
  const [fileName, setFileName] = useState('');
  const [dataUrl, setDataUrl] = useState('');
  const { copied, copy } = useCopyToClipboard();
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;

  const handleFile = async (file?: File) => {
    if (!file) return;
    setFileName(file.name);
    setDataUrl(await readFileAsDataUrl(file));
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader title="Base64/文件转换器" description="把任意文件转换为 Data URL 和纯 Base64，全部在浏览器内完成。" />
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <UploadPanel>
          <label className="flex cursor-pointer flex-col items-center gap-2 p-6 text-center">
            <FileArchive className="h-8 w-8 text-primary-600" />
            <span className="text-sm font-medium text-slate-700">{fileName || '选择一个文件'}</span>
            <input className="hidden" type="file" onChange={event => handleFile(event.target.files?.[0])} />
          </label>
        </UploadPanel>
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
          <div className="flex min-h-0 flex-col gap-2">
            <FieldLabel>Data URL</FieldLabel>
            <Textarea readOnly className="min-h-0 flex-1 resize-none bg-slate-50 font-mono text-xs" value={dataUrl} />
          </div>
          <div className="flex min-h-0 flex-col gap-2">
            <div className="flex items-center justify-between">
              <FieldLabel>Base64</FieldLabel>
              <Button size="sm" variant="secondary" onClick={() => copy(base64)} disabled={!base64}>
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Textarea readOnly className="min-h-0 flex-1 resize-none bg-slate-50 font-mono text-xs" value={base64} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
