import { translateUi as tr, useLocaleRender } from '../../../src/i18n/render';
import { certificateMatchesPrivateKey, certificatePublicKey, csrPublicKey, decodePem, readKeyMaterial } from './keyMaterial';
import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { FieldLabel, Input, Textarea } from '../../ui/ToolUi';
import { useCopyToClipboard } from '../shared/useCopyToClipboard';

export const BasicAuthTool: React.FC = () => {
  useLocaleRender();
  const [username, setUsername] = useState('user');
  const [password, setPassword] = useState('password');
  const { copied, copy } = useCopyToClipboard();
  const token = useMemo(() => btoa(unescape(encodeURIComponent(`${username}:${password}`))), [username, password]);
  const header = `Authorization: Basic ${token}`;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader title={tr("Basic Auth 生成器")} description={tr("生成 HTTP Basic Authentication Header，纯本地文本处理。")} />
      <CardContent className="grid gap-5 overflow-auto lg:grid-cols-2 content-start">
        <div className="tool-panel p-5 space-y-4">
          <div>
            <FieldLabel>{tr("用户名")}</FieldLabel>
            <Input value={username} onChange={event => setUsername(event.target.value)} />
          </div>
          <div>
            <FieldLabel>{tr("密码")}</FieldLabel>
            <Input type="password" value={password} onChange={event => setPassword(event.target.value)} />
          </div>
        </div>
        <div className="tool-panel p-5 space-y-4">
          <FieldLabel hint={tr("可直接用于 HTTP 请求")}>Authorization Header</FieldLabel>
          <div className="tool-panel break-all p-4 font-mono text-sm text-slate-900">{header}</div>
        <Button className="self-start" icon={copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />} onClick={() => copy(header)}>
          {copied ? tr('已复制') : tr('复制 Header')}
        </Button></div>
      </CardContent>
    </Card>
  );
};

interface PemParseResult {
  type: string;
  algorithm: string;
  keySize: number;
  strength: 'strong' | 'medium' | 'weak' | 'n_a';
  strengthText: string;
  blocksCount: number;
  estimatedBytes: number;
  extraInfo: Record<string, string>;
}

const parsePem = (pem: string): PemParseResult => {
  const blocks = Array.from(pem.matchAll(/-----BEGIN ([A-Z0-9 ]+)-----[\s\S]+?-----END \1-----/g));
  const empty: PemParseResult = { type: '未识别或无效 PEM 结构', algorithm: 'N/A', keySize: 0, strength: 'n_a', strengthText: '无法评估', blocksCount: blocks.length, estimatedBytes: 0, extraInfo: {} };
  if (!blocks.length) return empty;
  try {
    const block = blocks[0]; const label = block[1]; const bytes = decodePem(block[0]);
    const keyBytes = label === 'CERTIFICATE' ? certificatePublicKey(bytes) : /CERTIFICATE REQUEST/.test(label) ? csrPublicKey(bytes) : bytes;
    const key = readKeyMaterial(keyBytes);
    const strength = key.kind === 'EC' || key.bits >= 2048 ? 'strong' : key.bits >= 1024 ? 'medium' : 'weak';
    return { ...empty, type: label, algorithm: key.kind + (key.curve ? ` (${key.curve})` : ''), keySize: key.bits, strength, strengthText: `${key.kind}-${key.bits} · 仅检查算法与长度，不包含证书信任链或有效期校验`, estimatedBytes: bytes.length, extraInfo: { '容器结构': key.privateKey ? '私钥' : '公钥', '解析范围': '首个 PEM 块' } };
  } catch (error) { return { ...empty, type: 'PEM 解析失败', extraInfo: { '解析错误': (error as Error).message } }; }
};

export const CertificateParserTool: React.FC = () => {
  useLocaleRender();
  const [pem, setPem] = useState('');
  const [privateKeyPem, setPrivateKeyPem] = useState('');
  const result = useMemo(() => parsePem(pem), [pem]);

  const [matchResult, setMatchResult] = useState<{ pem: string; privateKey: string; status: 'matched' | 'mismatched' | 'error'; message: string } | null>(null);
  const matchStatus = !pem.trim() || !privateKeyPem.trim() ? 'none' : matchResult?.pem === pem && matchResult.privateKey === privateKeyPem ? matchResult.status : 'checking';
  useEffect(() => {
    if (!pem.trim() || !privateKeyPem.trim()) return;
    let active = true;
    const check = async () => {
      const certificate = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/)?.[0];
      if (!certificate) throw new Error('请提供 X.509 证书 PEM');
      return certificateMatchesPrivateKey(decodePem(certificate), decodePem(privateKeyPem));
    };
    check().then(matched => {
      if (active) setMatchResult({ pem, privateKey: privateKeyPem, status: matched ? 'matched' : 'mismatched', message: matched ? '公钥参数与私钥一致。证书信任链、有效期及用途需另外校验。' : '证书公钥与私钥参数不一致。' });
    }).catch(error => {
      if (active) setMatchResult({ pem, privateKey: privateKeyPem, status: 'error', message: (error as Error).message });
    });
    return () => { active = false; };
  }, [pem, privateKeyPem]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader title={tr("证书/密钥文本解析与一致性校验")} description={tr("解析 PEM 格式证书、RSA/EC 私钥结构，并支持 SSL 数字证书公私钥对一致性离线断言配对校验。")} />
      <CardContent className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-auto lg:grid-cols-[1.3fr_1fr]">
        <div className="flex min-h-0 flex-col gap-4">
          <div className="flex-1 flex min-h-0 flex-col gap-2">
            <FieldLabel hint={tr("支持 CERTIFICATE, CERTIFICATE REQUEST 等 PEM 文本")}>{tr("X.509 公钥证书 (Certificate PEM)")}</FieldLabel>
            <Textarea className="min-h-64 flex-1 resize-y font-mono text-xs leading-5" value={pem} onChange={event => setPem(event.target.value)} />
          </div>
          <details className="tool-panel p-4" open={!!privateKeyPem || undefined}><summary className="cursor-pointer text-sm font-semibold text-slate-600">{tr("可选：校验证书与私钥配对")}</summary><div className="flex min-h-0 flex-col gap-2 mt-4">
            <FieldLabel hint={tr("支持 RSA / PKCS#8 格式私钥对配对一致性校验")}>{tr("配套私钥 (Private Key PEM - 用于配对验证)")}</FieldLabel>
            <Textarea
              className="min-h-40 resize-y font-mono text-xs leading-5"
              value={privateKeyPem}
              onChange={event => setPrivateKeyPem(event.target.value)}
              placeholder={tr("-----BEGIN RSA PRIVATE KEY-----&#10;...粘贴配套私钥块以验证与证书公钥是否匹配...&#10;-----END RSA PRIVATE KEY-----")}
            />
          </div></details>
        </div>
        <div className="app-scrollbar overflow-auto space-y-3 pr-1">
          {matchStatus !== 'none' && (
            <div className={`p-4 rounded-xl border ${
              matchStatus === 'matched'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-400'
                : 'border-rose-200 bg-rose-50 text-rose-800 dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-rose-400'
            }`}>
              <div className="font-bold text-xs mb-1.5 uppercase">{tr("证书配对诊断")}</div>
              <div className="text-[11px] leading-relaxed font-semibold font-mono">
                {tr(matchStatus === 'checking' ? '正在本地验证公私钥参数...' : matchResult?.message || '')}
              </div>
            </div>
          )}

          <div className="tool-panel p-4">
            <div className="mb-1 text-xs font-semibold uppercase text-slate-500">{tr("检测类型")}</div>
            <div className="break-all font-mono text-base font-bold text-slate-900">{tr(result.type)}</div>
          </div>

          <div className="tool-panel p-4">
            <div className="mb-1 text-xs font-semibold uppercase text-slate-500">{tr("加密算法")}</div>
            <div className="break-all font-mono text-sm font-semibold text-slate-900">{tr(result.algorithm)}</div>
          </div>

          {result.keySize > 0 && (
            <div className="tool-panel p-4">
              <div className="mb-1 text-xs font-semibold uppercase text-slate-500">{tr("密钥长度")}</div>
              <div className="break-all font-mono text-sm font-semibold text-slate-900">{result.keySize} bits</div>
            </div>
          )}

          {result.strength !== 'n_a' && (
            <div className={`p-3 text-sm rounded-lg border ${
              result.strength === 'strong' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' :
              result.strength === 'medium' ? 'border-amber-200 bg-amber-50 text-amber-800' :
              'border-rose-200 bg-rose-50 text-rose-800'
            }`}>
              <div className="font-semibold uppercase text-xs mb-1">{tr("算法与长度检查")}</div>
              <div className="font-mono text-xs leading-5">{tr(result.strengthText)}</div>
            </div>
          )}

          <div className="tool-panel p-4">
            <div className="mb-1 text-xs font-semibold uppercase text-slate-500">{tr("包含块数量")}</div>
            <div className="break-all font-mono text-sm text-slate-800">{result.blocksCount} {tr("个 PEM 块")}</div>
          </div>

          <div className="tool-panel p-4">
            <div className="mb-1 text-xs font-semibold uppercase text-slate-500">{tr("估计原始大小")}</div>
            <div className="break-all font-mono text-sm text-slate-800">{result.estimatedBytes} {tr("字节")}</div>
          </div>

          {Object.entries(result.extraInfo).map(([key, value]) => (
            <div key={tr(key)} className="tool-panel p-4">
              <div className="mb-1 text-xs font-semibold uppercase text-slate-500">{tr(key)}</div>
              <div className="break-all font-mono text-xs leading-5 text-slate-800">{tr(value)}</div>
            </div>
          ))}

          <div className="status-warning p-3 text-xs leading-5">
            {tr("提示：本工具仅解析 PEM 的包体和基本 ASN.1 拓扑，由于浏览器安全性限制，不执行任何远程的域名证书嗅探或连接测试。")}</div>
        </div>
      </CardContent>
    </Card>
  );
};
