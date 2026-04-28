import React, { useMemo, useState } from 'react';
import { Check, Copy, KeyRound } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { FieldLabel, Input, Textarea } from '../../ui/ToolUi';
import { useCopyToClipboard } from '../shared/useCopyToClipboard';

export const BasicAuthTool: React.FC = () => {
  const [username, setUsername] = useState('user');
  const [password, setPassword] = useState('password');
  const { copied, copy } = useCopyToClipboard();
  const token = useMemo(() => btoa(unescape(encodeURIComponent(`${username}:${password}`))), [username, password]);
  const header = `Authorization: Basic ${token}`;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader title="Basic Auth 生成器" description="生成 HTTP Basic Authentication Header，纯本地文本处理。" />
      <CardContent className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <FieldLabel>用户名</FieldLabel>
            <Input value={username} onChange={event => setUsername(event.target.value)} />
          </div>
          <div>
            <FieldLabel>密码</FieldLabel>
            <Input type="password" value={password} onChange={event => setPassword(event.target.value)} />
          </div>
        </div>
        <div>
          <FieldLabel>Header</FieldLabel>
          <div className="tool-panel break-all p-4 font-mono text-sm text-slate-900">{header}</div>
        </div>
        <Button className="self-start" icon={copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />} onClick={() => copy(header)}>
          {copied ? '已复制' : '复制 Header'}
        </Button>
      </CardContent>
    </Card>
  );
};

export const CertificateParserTool: React.FC = () => {
  const [pem, setPem] = useState('-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----');

  const info = useMemo(() => {
    const normalized = pem.trim();
    const blocks = normalized.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) || [];
    const body = blocks[0]?.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s/g, '') || '';
    const bytes = body ? Math.floor((body.length * 3) / 4) : 0;
    return {
      blocks: blocks.length,
      base64Length: body.length,
      estimatedBytes: bytes,
      format: blocks.length ? 'PEM certificate chain' : '未识别到 PEM 证书块',
    };
  }, [pem]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader title="证书文本解析器" description="受限版 SSL 工具：只解析粘贴的 PEM 文本，不做远程证书探测。" />
      <CardContent className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[1fr_22rem]">
        <div className="flex min-h-0 flex-col gap-2">
          <FieldLabel>PEM 证书</FieldLabel>
          <Textarea className="min-h-0 flex-1 resize-none font-mono text-xs" value={pem} onChange={event => setPem(event.target.value)} />
        </div>
        <div className="space-y-3">
          {Object.entries(info).map(([key, value]) => (
            <div key={key} className="tool-panel p-4">
              <div className="mb-1 text-xs font-semibold uppercase text-slate-500">{key}</div>
              <div className="break-all font-mono text-sm text-slate-900">{value}</div>
            </div>
          ))}
          <div className="status-warning p-3 text-sm">
            浏览器无法直接连接任意域名读取 TLS 证书链，因此这里不实现远程 SSL 管理。
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const SecurityNoteTool: React.FC = () => (
  <Card className="h-full flex flex-col">
    <CardHeader title="安全工具边界" description="纯 Web 模式下的安全功能说明。" />
    <CardContent className="flex flex-1 items-center justify-center">
      <div className="tool-panel max-w-xl p-5 text-sm leading-6 text-slate-600">
        <KeyRound className="mb-3 h-6 w-6 text-primary-600" />
        Hash、HMAC、JWT 解码和 Basic Auth 均在浏览器内完成。TLS 证书远程探测、bcrypt/argon2 等重型慢哈希默认不引入，避免破坏轻量纯前端结构。
      </div>
    </CardContent>
  </Card>
);
