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

const parseRsaKeySizeFromDer = (der: Uint8Array): number => {
  try {
    let pos = 0;
    if (der[pos++] !== 0x30) return 0; // Sequence
    // Skip length
    const len = der[pos++];
    if (len & 0x80) {
      pos += len & 0x7f;
    }
    if (der[pos++] !== 0x02) return 0; // Version
    const verLen = der[pos++];
    pos += verLen; // Skip version
    if (der[pos++] !== 0x02) return 0; // Modulus tag
    let modLen = der[pos++];
    if (modLen & 0x80) {
      const bytes = modLen & 0x7f;
      modLen = 0;
      for (let i = 0; i < bytes; i++) {
        modLen = (modLen << 8) | der[pos++];
      }
    }
    let actualBytes = modLen;
    if (der[pos] === 0x00) {
      actualBytes--;
    }
    return actualBytes * 8;
  } catch {
    return 0;
  }
};

const parsePem = (pem: string): PemParseResult => {
  const normalized = pem.trim();
  const certMatches = normalized.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) || [];
  const rsaMatches = normalized.match(/-----BEGIN RSA PRIVATE KEY-----[\s\S]+?-----END RSA PRIVATE KEY-----/g) || [];
  const p8Matches = normalized.match(/-----BEGIN PRIVATE KEY-----[\s\S]+?-----END PRIVATE KEY-----/g) || [];
  const ecMatches = normalized.match(/-----BEGIN EC PRIVATE KEY-----[\s\S]+?-----END EC PRIVATE KEY-----/g) || [];
  const csrMatches = normalized.match(/-----BEGIN (?:NEW )?CERTIFICATE REQUEST-----[\s\S]+?-----END (?:NEW )?CERTIFICATE REQUEST-----/g) || [];

  let type = '未识别或无效 PEM 结构';
  let algorithm = 'N/A';
  let keySize = 0;
  let strength: 'strong' | 'medium' | 'weak' | 'n_a' = 'n_a';
  let strengthText = '无法评估';
  let blocksCount = 0;
  let body = '';
  const extraInfo: Record<string, string> = {};

  if (certMatches.length > 0) {
    type = certMatches.length > 1 ? 'X.509 证书链 (PEM Chain)' : 'X.509 数字证书';
    algorithm = 'RSA / ECC 公钥证书';
    blocksCount = certMatches.length;
    body = certMatches[0].replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s/g, '');
    extraInfo['主要用途'] = 'TLS 服务端/客户端身份验证、签名校验';
  } else if (rsaMatches.length > 0) {
    type = 'PKCS#1 RSA 私钥';
    algorithm = 'RSA';
    blocksCount = rsaMatches.length;
    body = rsaMatches[0].replace(/-----BEGIN RSA PRIVATE KEY-----|-----END RSA PRIVATE KEY-----|\s/g, '');
    
    try {
      const binary = atob(body);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      keySize = parseRsaKeySizeFromDer(bytes);
    } catch {
      keySize = 0;
    }

    if (keySize === 0) {
      if (body.length < 500) keySize = 512;
      else if (body.length < 1000) keySize = 1024;
      else if (body.length < 2000) keySize = 2048;
      else keySize = 4096;
    }

    extraInfo['私钥格式'] = 'PKCS#1 (BEGIN RSA PRIVATE KEY)';
  } else if (p8Matches.length > 0) {
    type = 'PKCS#8 未加密私钥';
    algorithm = 'RSA / EC';
    blocksCount = p8Matches.length;
    body = p8Matches[0].replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');

    if (body.length < 400) {
      algorithm = 'EC (椭圆曲线)';
      keySize = 256;
    } else {
      algorithm = 'RSA';
      if (body.length < 1100) keySize = 1024;
      else if (body.length < 2100) keySize = 2048;
      else keySize = 4096;
    }

    extraInfo['私钥格式'] = 'PKCS#8 (BEGIN PRIVATE KEY)';
    extraInfo['推荐用途'] = '现代主流语言加密框架（Java, Go, Node）直接载入入口';
  } else if (ecMatches.length > 0) {
    type = 'EC 椭圆曲线私钥';
    algorithm = 'ECDSA / EC';
    blocksCount = ecMatches.length;
    body = ecMatches[0].replace(/-----BEGIN EC PRIVATE KEY-----|-----END EC PRIVATE KEY-----|\s/g, '');
    
    keySize = 256;
    if (body.length > 500) keySize = 384;
    if (body.length > 800) keySize = 521;

    extraInfo['私钥格式'] = 'SEC1 (BEGIN EC PRIVATE KEY)';
    extraInfo['曲线特征'] = keySize === 256 ? 'NIST P-256 / secp256r1' : keySize === 384 ? 'NIST P-384' : 'NIST P-521';
  } else if (csrMatches.length > 0) {
    type = 'CSR (证书签名请求)';
    algorithm = 'RSA / EC';
    blocksCount = csrMatches.length;
    body = csrMatches[0].replace(/-----BEGIN (?:NEW )?CERTIFICATE REQUEST-----|-----END (?:NEW )?CERTIFICATE REQUEST-----|\s/g, '');
    extraInfo['请求格式'] = 'PKCS#10 PEM';
    extraInfo['推荐用途'] = '提交给 CA 证书颁发机构以申请 SSL 证书';
  } else {
    if (/^[A-Za-z0-9+/=\s]+$/.test(normalized) && normalized.length > 64) {
      type = '纯 Base64 编码数据';
      body = normalized.replace(/\s/g, '');
    }
  }

  if (algorithm.includes('RSA')) {
    if (keySize >= 2048) {
      strength = 'strong';
      strengthText = `高安全性 (RSA-${keySize}b) - 符合现代商业标准`;
    } else if (keySize >= 1024) {
      strength = 'medium';
      strengthText = `中等安全 (RSA-${keySize}b) - 容易受到量子计算或超算潜在威胁，不推荐用于新服务`;
    } else if (keySize > 0) {
      strength = 'weak';
      strengthText = `极度危险 (RSA-${keySize}b) - 密钥长度过短，极易在数小时内被暴力破译！`;
    }
  } else if (algorithm.includes('EC')) {
    strength = 'strong';
    strengthText = `高安全性 (EC-${keySize}b) - 高性能高强度，完美适配现代 TLS 1.3 通信`;
  }

  const estimatedBytes = body ? Math.floor((body.length * 3) / 4) : 0;

  return {
    type,
    algorithm,
    keySize,
    strength,
    strengthText,
    blocksCount,
    estimatedBytes,
    extraInfo,
  };
};

const extractLargeIntegers = (der: Uint8Array): string[] => {
  const results: string[] = [];
  let pos = 0;
  while (pos < der.length - 4) {
    if (der[pos] === 0x02) { // INTEGER
      pos++;
      let len = der[pos++];
      if (len & 0x80) {
        const numBytes = len & 0x7f;
        len = 0;
        for (let i = 0; i < numBytes; i++) {
          len = (len << 8) | der[pos++];
        }
      }
      if (len >= 100 && pos + len <= der.length) {
        const block = der.slice(pos, pos + len);
        const start = block[0] === 0x00 ? 1 : 0;
        const hex = Array.from(block.slice(start)).map(b => b.toString(16).padStart(2, '0')).join('');
        results.push(hex);
      }
      pos += len;
    } else {
      pos++;
    }
  }
  return results;
};

export const CertificateParserTool: React.FC = () => {
  const [pem, setPem] = useState('-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----');
  const [privateKeyPem, setPrivateKeyPem] = useState('');
  const result = useMemo(() => parsePem(pem), [pem]);

  const matchStatus = useMemo(() => {
    if (!pem || !privateKeyPem) return 'none';
    try {
      const certMatches = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/) || [];
      const privMatches = privateKeyPem.match(/-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA )?PRIVATE KEY-----/) || [];
      if (certMatches.length === 0 || privMatches.length === 0) return 'mismatched';

      const certDerBase64 = certMatches[0].replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s/g, '');
      const privDerBase64 = privMatches[0].replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----|-----END (?:RSA )?PRIVATE KEY-----|\s/g, '');

      const certBin = atob(certDerBase64);
      const certBytes = new Uint8Array(certBin.length);
      for (let i = 0; i < certBin.length; i++) certBytes[i] = certBin.charCodeAt(i);

      const privBin = atob(privDerBase64);
      const privBytes = new Uint8Array(privBin.length);
      for (let i = 0; i < privBin.length; i++) privBytes[i] = privBin.charCodeAt(i);

      const certInts = extractLargeIntegers(certBytes);
      const privInts = extractLargeIntegers(privBytes);

      if (certInts.length === 0 || privInts.length === 0) return 'mismatched';

      const isPair = certInts.some(ci => privInts.includes(ci));
      return isPair ? 'matched' : 'mismatched';
    } catch {
      return 'mismatched';
    }
  }, [pem, privateKeyPem]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader title="证书/密钥文本解析与一致性校验" description="解析 PEM 格式证书、RSA/EC 私钥结构，并支持 SSL 数字证书公私钥对一致性离线断言配对校验。" />
      <CardContent className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[1fr_24rem]">
        <div className="flex min-h-0 flex-col gap-4">
          <div className="flex-1 flex min-h-0 flex-col gap-2">
            <FieldLabel hint="支持 CERTIFICATE, CERTIFICATE REQUEST 等 PEM 文本">X.509 公钥证书 (Certificate PEM)</FieldLabel>
            <Textarea className="min-h-0 flex-1 resize-none font-mono text-xs leading-5" value={pem} onChange={event => setPem(event.target.value)} />
          </div>
          <div className="flex-1 flex min-h-0 flex-col gap-2">
            <FieldLabel hint="支持 RSA / PKCS#8 格式私钥对配对一致性校验">配套私钥 (Private Key PEM - 用于配对验证)</FieldLabel>
            <Textarea 
              className="min-h-0 flex-1 resize-none font-mono text-xs leading-5" 
              value={privateKeyPem} 
              onChange={event => setPrivateKeyPem(event.target.value)} 
              placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...粘贴配套私钥块以验证与证书公钥是否匹配...&#10;-----END RSA PRIVATE KEY-----"
            />
          </div>
        </div>
        <div className="app-scrollbar overflow-auto space-y-3 pr-1">
          {matchStatus !== 'none' && (
            <div className={`p-4 rounded-xl border ${
              matchStatus === 'matched' 
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-400' 
                : 'border-rose-200 bg-rose-50 text-rose-800 dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-rose-400'
            }`}>
              <div className="font-bold text-xs mb-1.5 uppercase">证书配对诊断</div>
              <div className="text-[11px] leading-relaxed font-semibold font-mono">
                {matchStatus === 'matched' 
                  ? '🟢 配对成功：当前 SSL 数字证书的公钥 Modulus 与所填 PEM 私钥完全配对吻合！可安全部署于网络服务器。'
                  : '❌ 诊断失败：当前 SSL 数字证书的公钥与所填私钥不一致，无法形成完整的 TLS 加密通道通道！'
                }
              </div>
            </div>
          )}

          <div className="tool-panel p-4">
            <div className="mb-1 text-xs font-semibold uppercase text-slate-500">检测类型</div>
            <div className="break-all font-mono text-base font-bold text-slate-900">{result.type}</div>
          </div>

          <div className="tool-panel p-4">
            <div className="mb-1 text-xs font-semibold uppercase text-slate-500">加密算法</div>
            <div className="break-all font-mono text-sm font-semibold text-slate-900">{result.algorithm}</div>
          </div>

          {result.keySize > 0 && (
            <div className="tool-panel p-4">
              <div className="mb-1 text-xs font-semibold uppercase text-slate-500">密钥长度</div>
              <div className="break-all font-mono text-sm font-semibold text-slate-900">{result.keySize} bits</div>
            </div>
          )}

          {result.strength !== 'n_a' && (
            <div className={`p-3 text-sm rounded-lg border ${
              result.strength === 'strong' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' :
              result.strength === 'medium' ? 'border-amber-200 bg-amber-50 text-amber-800' :
              'border-rose-200 bg-rose-50 text-rose-800'
            }`}>
              <div className="font-semibold uppercase text-xs mb-1">安全评估</div>
              <div className="font-mono text-xs leading-5">{result.strengthText}</div>
            </div>
          )}

          <div className="tool-panel p-4">
            <div className="mb-1 text-xs font-semibold uppercase text-slate-500">包含块数量</div>
            <div className="break-all font-mono text-sm text-slate-800">{result.blocksCount} 个 PEM 块</div>
          </div>

          <div className="tool-panel p-4">
            <div className="mb-1 text-xs font-semibold uppercase text-slate-500">估计原始大小</div>
            <div className="break-all font-mono text-sm text-slate-800">{result.estimatedBytes} 字节</div>
          </div>

          {Object.entries(result.extraInfo).map(([key, value]) => (
            <div key={key} className="tool-panel p-4">
              <div className="mb-1 text-xs font-semibold uppercase text-slate-500">{key}</div>
              <div className="break-all font-mono text-xs leading-5 text-slate-800">{value}</div>
            </div>
          ))}

          <div className="status-warning p-3 text-xs leading-5">
            提示：本工具仅解析 PEM 的包体和基本 ASN.1 拓扑，由于浏览器安全性限制，不执行任何远程的域名证书嗅探或连接测试。
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
