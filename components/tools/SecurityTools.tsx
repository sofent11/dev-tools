import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { RefreshCcw, Copy, Check, Lock, Unlock, Info } from 'lucide-react';
import md5 from 'blueimp-md5';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { FieldLabel, Input, Select } from '../ui/ToolUi';
import { loadScriptWithCache } from './shared/cdnCacheManager';
import { RuntimeAssetStatusPanel } from './shared/useRuntimeAsset';
import type { RuntimeAssetLoaderState } from './shared/runtimeAssetLoader';

// --- Shared Helper: Copy to Clipboard ---
const useCopyToClipboard = () => {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return { copied, copy };
};

interface ZxcvbnResult {
  score: 0 | 1 | 2 | 3 | 4;
  guesses_log10?: number;
  crack_times_display?: {
    online_no_throttling_10_guesses_per_second?: string;
    offline_fast_hashing_1e10_per_second?: string;
  };
  feedback?: {
    warning?: string;
    suggestions: string[];
  };
}

type ZxcvbnFn = (password: string) => ZxcvbnResult;

type OpenPgpKeyTypeOptions =
  | { type: 'ecc'; curve: string; userIDs: Array<{ name: string; email: string }>; passphrase: string }
  | { type: 'rsa'; rsaBits: number; userIDs: Array<{ name: string; email: string }>; passphrase: string };

interface OpenPgpApi {
  generateKey(options: OpenPgpKeyTypeOptions): Promise<{ privateKey: string; publicKey: string }>;
  createMessage(options: { text: string }): Promise<unknown>;
  readKey(options: { armoredKey: string }): Promise<unknown>;
  readPrivateKey(options: { armoredKey: string }): Promise<unknown>;
  readMessage(options: { armoredMessage: string }): Promise<unknown>;
  readSignature(options: { armoredSignature: string }): Promise<unknown>;
  decryptKey(options: { privateKey: unknown; passphrase: string }): Promise<unknown>;
  encrypt(options: { message: unknown; encryptionKeys: unknown }): Promise<string>;
  decrypt(options: { message: unknown; decryptionKeys: unknown }): Promise<{ data: string }>;
  sign(options: { message: unknown; signingKeys: unknown; detached: true }): Promise<string>;
  verify(options: { message: unknown; signature: unknown; verificationKeys: unknown }): Promise<{
    signatures: Array<{ verified: Promise<boolean> }>;
  }>;
}

interface Sm2KeyPair {
  privateKey: string;
  publicKey: string;
}

interface SmCryptoOptions {
  mode: 'ecb' | 'cbc';
  padding: 'pkcs7';
  iv?: string;
}

interface SmCryptoApi {
  sm2?: {
    generateKeyPairHex(): Sm2KeyPair;
    doEncrypt(plainText: string, publicKey: string, mode: 1): string;
    doDecrypt(cipherText: string, privateKey: string, mode: 1): string;
    doSignature(plainText: string, privateKey: string, options: { hash: boolean; der: boolean }): string;
    doVerifySignature(plainText: string, signature: string, publicKey: string, options: { hash: boolean; der: boolean }): boolean;
  };
  sm3?: (input: string) => string;
  sm4?: {
    encrypt(plainText: string, key: string, options: SmCryptoOptions): string;
    decrypt(cipherText: string, key: string, options: SmCryptoOptions): string;
  };
}

type CryptoWindow = Window & {
  zxcvbn?: ZxcvbnFn;
  openpgp?: OpenPgpApi;
  smCrypto?: SmCryptoApi;
};

const cryptoWindow = () => window as CryptoWindow;

type PasswordOptions = {
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
};

export const buildPasswordCharset = (opts: PasswordOptions) => {
  const chars = {
    uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lowercase: 'abcdefghijklmnopqrstuvwxyz',
    numbers: '0123456789',
    symbols: '!@#$%^&*()_+~`|}{[]:;?><,./-=',
  };

  let charSet = '';
  if (opts.uppercase) charSet += chars.uppercase;
  if (opts.lowercase) charSet += chars.lowercase;
  if (opts.numbers) charSet += chars.numbers;
  if (opts.symbols) charSet += chars.symbols;
  return charSet;
};

export const generateUnbiasedPassword = (len: number, opts: PasswordOptions) => {
  const charSet = buildPasswordCharset(opts);
  if (!charSet) return '';

  const maxUint32 = 0x100000000;
  const maxUnbiased = Math.floor(maxUint32 / charSet.length) * charSet.length;
  let result = '';

  while (result.length < len) {
    const randomValue = crypto.getRandomValues(new Uint32Array(1))[0];
    if (randomValue >= maxUnbiased) continue;
    result += charSet[randomValue % charSet.length];
  }

  return result;
};

// --- JWT Tool ---
// --- JWT Tool ---
const base64UrlEncode = (str: string): string => {
  const base64 = window.btoa(unescape(encodeURIComponent(str)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

export const JwtTool: React.FC = () => {
  const [token, setToken] = useState('');
  const [secretKey, setSecretKey] = useState('secret');
  const [verificationResult, setVerificationResult] = useState<'unchecked' | 'valid' | 'invalid' | 'error'>('unchecked');
  const [crackedKey, setCrackedKey] = useState<string | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditProgress, setAuditProgress] = useState(0);
  const [auditMessage, setAuditMessage] = useState('');
  const [customDictionary, setCustomDictionary] = useState('');
  const auditWorkerRef = useRef<Worker | null>(null);

  const [headerInput, setHeaderInput] = useState('{\n  "alg": "HS256",\n  "typ": "JWT"\n}');
  const [payloadInput, setPayloadInput] = useState('{\n  "sub": "1234567890",\n  "name": "John Doe",\n  "iat": 1516239022\n}');

  // Derived state during render
  let claims: { label: string; value: string }[] = [];
  let headerObj: Record<string, unknown> | null = null;
  let payloadObj: Record<string, unknown> | null = null;
  let parseError: string | null = null;

  try {
    headerObj = JSON.parse(headerInput);
    payloadObj = JSON.parse(payloadInput);
    
    const toDate = (value: unknown) => typeof value === 'number' ? new Date(value * 1000).toLocaleString() : '';
    if (payloadObj) {
      claims = [
        payloadObj.iss ? { label: 'Issuer (iss)', value: String(payloadObj.iss) } : null,
        payloadObj.sub ? { label: 'Subject (sub)', value: String(payloadObj.sub) } : null,
        payloadObj.aud ? { label: 'Audience (aud)', value: Array.isArray(payloadObj.aud) ? payloadObj.aud.map(String).join(', ') : String(payloadObj.aud) } : null,
        payloadObj.iat ? { label: 'Issued At (iat)', value: toDate(payloadObj.iat) } : null,
        payloadObj.nbf ? { label: 'Not Before (nbf)', value: toDate(payloadObj.nbf) } : null,
        typeof payloadObj.exp === 'number' ? { label: 'Expires At (exp)', value: `${toDate(payloadObj.exp)}${Date.now() > payloadObj.exp * 1000 ? '（已过期 ⚠️）' : '（未过期 🟢）'}` } : null,
      ].filter(Boolean) as { label: string; value: string }[];
    }
  } catch {
    parseError = "JSON 格式解析失败，请检查语法";
  }

  // Update editors when a token is pasted
  useEffect(() => {
    if (!token) return;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return;

      const decode = (str: string) => {
        const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
        const json = decodeURIComponent(atob(base64).split('').map(c => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.stringify(JSON.parse(json), null, 2);
      };

      setHeaderInput(decode(parts[0]));
      setPayloadInput(decode(parts[1]));
    } catch {
      // ignore invalid tokens pasted in Encoded field
    }
  }, [token]);

  // Handle local signature verification
  const handleVerify = async () => {
    if (!token || !secretKey) return;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        setVerificationResult('invalid');
        return;
      }
      const enc = new TextEncoder();
      const keyData = enc.encode(secretKey);
      const cryptoKey = await window.crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      );

      const messageData = enc.encode(`${parts[0]}.${parts[1]}`);
      const signatureBase64Url = parts[2];
      const signatureBase64 = signatureBase64Url.replace(/-/g, '+').replace(/_/g, '/');
      
      const paddedBase64 = signatureBase64.padEnd(signatureBase64.length + (4 - signatureBase64.length % 4) % 4, '=');
      const signatureBinary = atob(paddedBase64);
      const signatureBytes = new Uint8Array(signatureBinary.length);
      for (let i = 0; i < signatureBinary.length; i++) {
        signatureBytes[i] = signatureBinary.charCodeAt(i);
      }

      const isValid = await window.crypto.subtle.verify(
        "HMAC",
        cryptoKey,
        signatureBytes,
        messageData
      );

      setVerificationResult(isValid ? 'valid' : 'invalid');
    } catch (e) {
      console.error(e);
      setVerificationResult('error');
    }
  };

  // Re-sign edited Header and Payload to forge/generate JWT
  const handleSignToken = async () => {
    try {
      if (parseError) {
        alert(parseError);
        return;
      }
      const headerB64 = base64UrlEncode(JSON.stringify(headerObj));
      const payloadB64 = base64UrlEncode(JSON.stringify(payloadObj));
      
      const enc = new TextEncoder();
      const messageData = enc.encode(`${headerB64}.${payloadB64}`);
      const keyData = enc.encode(secretKey || 'secret');
      
      const cryptoKey = await window.crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      
      const signature = await window.crypto.subtle.sign("HMAC", cryptoKey, messageData);
      const signatureBytes = new Uint8Array(signature);
      
      let signatureBinary = '';
      for (let i = 0; i < signatureBytes.byteLength; i++) {
        signatureBinary += String.fromCharCode(signatureBytes[i]);
      }
      const signatureB64Url = window.btoa(signatureBinary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      
      const newToken = `${headerB64}.${payloadB64}.${signatureB64Url}`;
      setToken(newToken);
      setVerificationResult('valid');
    } catch (err) {
      alert('签名签署失败: ' + (err as Error).message);
    }
  };

  useEffect(() => () => {
    auditWorkerRef.current?.terminate();
  }, []);

  // Weak Secret Brute-forcer
  const handleBruteForce = async () => {
    if (!token) return;
    setIsAuditing(true);
    setCrackedKey(null);
    setAuditProgress(0);
    setAuditMessage('正在启动本地 Worker...');
    
    const dictionary = Array.from(new Set([
      'secret', '123456', 'admin', 'development', 'jwt', 
      '12345678', 'password', 'key', 'test', 'demo', 
      'config', 'root', 'security', 'welcome', 'auth', 
      'secretkey', 'mysecret', '1234567890',
      ...customDictionary.split(/\r?\n/).map(item => item.trim()).filter(Boolean),
    ]));

    try {
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error("无效的 JWT 格式");
      auditWorkerRef.current?.terminate();
      const workerUrl = URL.createObjectURL(new Blob([`
        const toBytes = (base64Url) => {
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
          const binary = atob(padded);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          return bytes;
        };
        self.onmessage = async (event) => {
          const { token, dictionary } = event.data;
          const parts = token.split('.');
          const enc = new TextEncoder();
          const messageData = enc.encode(parts[0] + '.' + parts[1]);
          const signatureBytes = toBytes(parts[2]);
          for (let i = 0; i < dictionary.length; i++) {
            const secret = dictionary[i];
            const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
            const ok = await crypto.subtle.verify('HMAC', key, signatureBytes, messageData);
            if (ok) {
              self.postMessage({ type: 'found', secret, checked: i + 1, total: dictionary.length });
              return;
            }
            if (i % 5 === 0 || i === dictionary.length - 1) {
              self.postMessage({ type: 'progress', checked: i + 1, total: dictionary.length });
            }
          }
          self.postMessage({ type: 'done', checked: dictionary.length, total: dictionary.length });
        };
      `], { type: 'text/javascript' }));
      const worker = new Worker(workerUrl);
      URL.revokeObjectURL(workerUrl);
      auditWorkerRef.current = worker;
      worker.onmessage = (event: MessageEvent<{ type: 'progress' | 'found' | 'done'; secret?: string; checked: number; total: number }>) => {
        const percent = Math.round((event.data.checked / event.data.total) * 100);
        setAuditProgress(percent);
        setAuditMessage(`已检查 ${event.data.checked}/${event.data.total} 个候选密钥`);
        if (event.data.type === 'found') {
          setCrackedKey(event.data.secret || null);
          setSecretKey(event.data.secret || '');
          setVerificationResult('valid');
          setIsAuditing(false);
          worker.terminate();
          auditWorkerRef.current = null;
        }
        if (event.data.type === 'done') {
          setIsAuditing(false);
          setAuditMessage(`未在 ${event.data.total} 个候选密钥中发现弱密钥。`);
          worker.terminate();
          auditWorkerRef.current = null;
        }
      };
      worker.onerror = event => {
        setIsAuditing(false);
        setAuditMessage(event.message || 'Worker 执行失败');
        worker.terminate();
        auditWorkerRef.current = null;
      };
      worker.postMessage({ token, dictionary });
    } catch (e) {
      alert('审计失败: ' + (e as Error).message);
      setIsAuditing(false);
    }
  };

  const cancelBruteForce = () => {
    auditWorkerRef.current?.terminate();
    auditWorkerRef.current = null;
    setIsAuditing(false);
    setAuditMessage('已取消本地字典审计。');
  };

  useEffect(() => {
    setVerificationResult('unchecked');
    setCrackedKey(null);
  }, [token]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader title="JWT 主动安全调试与签名沙箱" description="不仅是一个 JWT 头/载荷解析面板，更是支持实时编辑 Header/Payload 本地密钥一键重签伪造测试的 JWT 攻防沙箱。" />
      <CardContent className="flex-1 overflow-auto space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-350 mb-1">Encoded Token (输入或由下方 re-sign 实时生成)</label>
          <textarea
            className="w-full h-24 p-3 font-mono text-sm bg-slate-50 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 dark:bg-slate-900 dark:text-slate-100 border-slate-200 focus:ring-primary-200"
            placeholder="eyJh..."
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          {parseError && <p className="text-red-500 text-xs mt-1">{parseError}</p>}
        </div>

        {/* Dynamic Security Alarms */}
        {token && (
          <div className="space-y-2.5">
            {headerObj?.alg === 'none' && (
              <div className="status-error p-3 text-xs leading-5">
                🔴 <b>高危安全警告：</b>此 Token 显式设置了 <code>alg: &apos;none&apos;</code> 签名算法！这意味着任意恶意客户端均可在不提供签名的情况下随意篡改并绕过验证。
              </div>
            )}
            
            {crackedKey && (
              <div className="status-error p-3 text-xs leading-5">
                🔴 <b>高危安全警告：</b>此 Token 使用了被字典破解出的极弱公共密钥：<span className="font-mono bg-red-100 dark:bg-red-950 font-bold px-2 py-0.5 rounded text-red-700 dark:text-red-400">{crackedKey}</span>！
              </div>
            )}

            {payloadObj && !payloadObj.exp && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                🟡 <b>安全防范建议：</b>该 Token 的 Payload 缺失了 <code>exp</code> (Expiration Time 过期时间) 声明，缺少 exp 使得凭据永久有效。
              </div>
            )}

            {secretKey && secretKey.length < 32 && (
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs leading-5 text-indigo-850">
                🔵 <b>密钥强度审计：</b>当前验证密钥长度为 {secretKey.length} 位。根据 RFC-7518 标准，HMAC-SHA256 密钥应至少为 <b>32 字符 (256 bits)</b>。
              </div>
            )}
          </div>
        )}
        
        {/* Editable Headers & Payload */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-350 mb-1">Header (可在此处直接修改 JSON 并重签)</label>
            <textarea
              className="w-full h-48 p-3 font-mono text-xs bg-slate-900 text-green-400 rounded-lg overflow-auto border border-slate-700 focus:outline-none focus:border-green-500 resize-none leading-relaxed"
              value={headerInput}
              onChange={e => setHeaderInput(e.target.value)}
            />
          </div>
          <div>
             <label className="block text-sm font-medium text-slate-700 dark:text-slate-350 mb-1">Payload (可在此处直接修改 JSON 并重签)</label>
             <textarea
              className="w-full h-48 p-3 font-mono text-xs bg-slate-900 text-blue-400 rounded-lg overflow-auto border border-slate-700 focus:outline-none focus:border-blue-500 resize-none leading-relaxed"
              value={payloadInput}
              onChange={e => setPayloadInput(e.target.value)}
            />
          </div>
        </div>

        {/* Verification Board Card */}
        <div className="tool-panel p-4 space-y-4">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider">
            🛡️ JWT 签名调试、验证与安全爆破沙箱
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <FieldLabel>签名与验证密钥 (HMAC Secret Key)</FieldLabel>
              <Input
                className="font-mono text-sm"
                type="text"
                placeholder="Secret key..."
                value={secretKey}
                onChange={e => setSecretKey(e.target.value)}
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleSignToken}>
                一键重签 & 生成 Token
              </Button>
              <Button variant="secondary" onClick={handleVerify} disabled={!secretKey || !token}>
                验证签名
              </Button>
              <Button variant="secondary" onClick={handleBruteForce} disabled={!token} isLoading={isAuditing}>
                弱密钥审计碰撞
              </Button>
              {isAuditing && (
                <Button variant="ghost" onClick={cancelBruteForce}>
                  取消审计
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_16rem]">
            <div>
              <FieldLabel>自定义弱密钥字典（每行一个，仅在本地 Worker 中运行）</FieldLabel>
              <textarea
                className="mt-1 h-20 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-2 font-mono text-xs outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-800 dark:bg-slate-900"
                placeholder="company-secret&#10;staging-key"
                value={customDictionary}
                onChange={event => setCustomDictionary(event.target.value)}
              />
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="font-bold text-slate-700 dark:text-slate-200">审计进度</div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div className="h-full bg-primary-600 transition-all" style={{ width: `${auditProgress}%` }} />
              </div>
              <div className="mt-2 text-slate-500">{auditMessage || '尚未开始。'}</div>
            </div>
          </div>

          {verificationResult === 'valid' && (
            <div className="p-3 text-xs leading-5 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200 font-bold flex items-center gap-2">
              🟢 签名验证成功！在本地算力下基于当前密钥对 Token 的完整性校验通过。
            </div>
          )}

          {verificationResult === 'invalid' && (
            <div className="p-3 text-xs leading-5 bg-red-50 text-red-800 rounded-lg border border-red-200 font-bold flex items-center gap-2">
              🔴 签名校验失败！签名不匹配，Token 曾被非法篡改或您输入的密钥不正确。
            </div>
          )}

          {verificationResult === 'error' && (
            <div className="p-3 text-xs leading-5 bg-amber-50 text-amber-800 rounded-lg border border-amber-200 flex items-center gap-2">
              ⚠️ 本地校验过程中遇到错误，可能是算法不属于 HMAC-SHA256 导致。
            </div>
          )}
        </div>

        {claims.length > 0 && (
          <div className="tool-panel grid gap-3 p-4 md:grid-cols-2">
            {claims.map(claim => (
              <div key={claim.label}>
                <div className="text-xs font-semibold uppercase text-slate-500">{claim.label}</div>
                <div className="break-all text-sm text-slate-900 dark:text-slate-100 font-mono mt-0.5">{claim.value}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// --- UUID Tool ---
export const UuidTool: React.FC = () => {
  // Lazy init to avoid useEffect
  const [count, setCount] = useState(5);
  const [uppercase, setUppercase] = useState(false);
  const [hyphenated, setHyphenated] = useState(true);
  const [uuids, setUuids] = useState<string[]>(() => Array.from({ length: 5 }, () => crypto.randomUUID()));
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const formatUuid = useCallback((uuid: string) => {
    const next = hyphenated ? uuid : uuid.replace(/-/g, '');
    return uppercase ? next.toUpperCase() : next.toLowerCase();
  }, [hyphenated, uppercase]);

  const generate = () => {
    const safeCount = Math.min(100, Math.max(1, Number.isFinite(count) ? count : 1));
    setCount(safeCount);
    const newUuids = Array.from({ length: safeCount }, () => crypto.randomUUID());
    setUuids(newUuids);
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader 
        title="UUID 生成器" 
        description="批量生成随机 Version 4 UUIDs。"
        actions={
           <Button onClick={generate} icon={<RefreshCcw className="w-4 h-4" />}>重新生成</Button>
        }
      />
      <CardContent className="flex-1 overflow-auto space-y-4">
        <div className="tool-panel flex flex-wrap items-center gap-4 p-4">
            <label className="text-sm font-medium text-slate-700">数量:</label>
            <input 
              type="number" 
              min="1" 
              max="100" 
              value={count} 
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-20 p-2 text-sm border border-slate-200 rounded-md"
            />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={hyphenated} onChange={event => setHyphenated(event.target.checked)} />
              带连字符
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={uppercase} onChange={event => setUppercase(event.target.checked)} />
              大写
            </label>
        </div>
        <div className="space-y-2">
          {uuids.map((uuid, idx) => (
            <div key={idx} className="tool-panel group flex items-center gap-2 p-3 transition-colors hover:border-primary-200">
              <code className="flex-1 break-all font-mono text-slate-700">{formatUuid(uuid)}</code>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => copyToClipboard(formatUuid(uuid), idx)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {copiedIndex === idx ? <Check className="w-4 h-4 text-green-600"/> : <Copy className="w-4 h-4"/>}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// --- Hash Tool ---
export const HashTool: React.FC = () => {
  const [input, setInput] = useState('');
  const [hashes, setHashes] = useState({ md5: '', sha1: '', sha256: '', sha512: '' });

  useEffect(() => {
    const generateHashes = async () => {
      if (!input) {
        setHashes({ md5: '', sha1: '', sha256: '', sha512: '' });
        return;
      }
      const msgBuffer = new TextEncoder().encode(input);
      
      const hashBufferSHA1 = await crypto.subtle.digest('SHA-1', msgBuffer);
      const hashArraySHA1 = Array.from(new Uint8Array(hashBufferSHA1));
      const hashHexSHA1 = hashArraySHA1.map(b => b.toString(16).padStart(2, '0')).join('');

      const hashBufferSHA256 = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArraySHA256 = Array.from(new Uint8Array(hashBufferSHA256));
      const hashHexSHA256 = hashArraySHA256.map(b => b.toString(16).padStart(2, '0')).join('');

      const hashBufferSHA512 = await crypto.subtle.digest('SHA-512', msgBuffer);
      const hashArraySHA512 = Array.from(new Uint8Array(hashBufferSHA512));
      const hashHexSHA512 = hashArraySHA512.map(b => b.toString(16).padStart(2, '0')).join('');

      setHashes({ md5: md5(input), sha1: hashHexSHA1, sha256: hashHexSHA256, sha512: hashHexSHA512 });
    };

    generateHashes();
  }, [input]);

  const CopyRow = ({ label, val }: { label: string, val: string }) => {
     const [c, setC] = useState(false);
     const doCopy = () => {
        navigator.clipboard.writeText(val);
        setC(true);
        setTimeout(() => setC(false), 2000);
     }
     return (
        <div className="space-y-1">
            <div className="flex justify-between items-end">
                <label className="text-xs font-semibold text-slate-500 uppercase">{label}</label>
                <button onClick={doCopy} className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1">
                    {c ? <><Check className="w-3 h-3"/> 已复制</> : <><Copy className="w-3 h-3"/> 复制</>}
                </button>
            </div>
            <div className="tool-panel break-all p-3 font-mono text-sm text-slate-800">
                {val || '...'}
            </div>
        </div>
     )
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader title="Hash 生成器" description="生成文本的 MD5、SHA1、SHA256、SHA512 哈希值。" />
      <CardContent className="flex-1 overflow-auto space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">输入文本</label>
          <textarea
            className="w-full h-24 p-3 font-mono text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-200 resize-none"
            placeholder="在此输入..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          MD5 仅适合兼容校验场景，不应用于密码存储或安全签名。
        </div>
        <div className="space-y-4">
            <CopyRow label="MD5" val={hashes.md5} />
            <CopyRow label="SHA-1" val={hashes.sha1} />
            <CopyRow label="SHA-256" val={hashes.sha256} />
            <CopyRow label="SHA-512" val={hashes.sha512} />
        </div>
      </CardContent>
    </Card>
  );
};

// --- HMAC Tool ---
export const HmacTool: React.FC = () => {
  const [input, setInput] = useState('');
  const [secret, setSecret] = useState('');
  const [hmac, setHmac] = useState('');
  const { copied, copy } = useCopyToClipboard();

  useEffect(() => {
    const generateHmac = async () => {
        if (!input || !secret) {
            setHmac('');
            return;
        }
        try {
            const encoder = new TextEncoder();
            const keyData = encoder.encode(secret);
            const key = await crypto.subtle.importKey(
                "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
            );
            const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(input));
            const hashArray = Array.from(new Uint8Array(signature));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            setHmac(hashHex);
        } catch (e) {
            console.error(e);
            setHmac('Error calculating HMAC');
        }
    };
    generateHmac();
  }, [input, secret]);

  return (
     <Card className="h-full flex flex-col">
         <CardHeader title="HMAC Calculator" description="Calculate HMAC-SHA256" />
         <CardContent className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Secret Key</label>
                <input
                    className="w-full p-2 border rounded"
                    value={secret}
                    onChange={e => setSecret(e.target.value)}
                    placeholder="Secret key..."
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
                <textarea
                    className="w-full h-24 p-2 border rounded resize-none"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Message to sign..."
                />
            </div>
            <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">HMAC-SHA256</label>
                 <div className="relative">
                     <textarea
                        readOnly
                        className="w-full h-24 p-2 bg-slate-100 border rounded resize-none text-slate-700 font-mono"
                        value={hmac}
                     />
                     <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-2 right-2"
                        onClick={() => copy(hmac)}
                        disabled={!hmac}
                    >
                        {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </Button>
                 </div>
            </div>
         </CardContent>
     </Card>
  );
}

// --- Password Generator Tool & Real-Time Entropy Estimator ---
export const PasswordGenTool: React.FC = () => {
    const [length, setLength] = useState(16);
    const [options, setOptions] = useState({
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: true,
    });
    const [password, setPassword] = useState('');
    const [copied, setCopied] = useState(false);
    const [zxcvbnLoaded, setZxcvbnLoaded] = useState(false);
    const [optionWarning, setOptionWarning] = useState('');
    const [zxcvbnRuntimeState, setZxcvbnRuntimeState] = useState<RuntimeAssetLoaderState>({
        status: 'idle',
        label: 'zxcvbn',
        version: '4.4.2',
        source: 'https://cdnjs.cloudflare.com/ajax/libs/zxcvbn/4.4.2/zxcvbn.js',
    });

    const loadZxcvbn = useCallback(() => {
        if (cryptoWindow().zxcvbn) {
            Promise.resolve().then(() => setZxcvbnLoaded(true));
            return;
        }
        loadScriptWithCache('https://cdnjs.cloudflare.com/ajax/libs/zxcvbn/4.4.2/zxcvbn.js', {
            label: 'zxcvbn',
            version: '4.4.2',
            onStatus: event => setZxcvbnRuntimeState({
                status: event.status,
                label: event.label,
                version: event.version,
                source: event.src,
                attempt: event.attempt,
                progress: event.progress,
                error: event.message,
            }),
        })
            .then(() => setZxcvbnLoaded(true))
            .catch((err) => console.error('Failed to load zxcvbn script', err));
    }, []);

    // Dynamic injection of zxcvbn.js
    useEffect(() => {
        loadZxcvbn();
    }, [loadZxcvbn]);

    const generatePassword = useCallback((len: number, opts: typeof options) => {
        return generateUnbiasedPassword(len, opts);
    }, []);

    // Initial password generation on mount or load
    useEffect(() => {
        const initialPass = generatePassword(16, {
            uppercase: true,
            lowercase: true,
            numbers: true,
            symbols: true,
        });
        Promise.resolve().then(() => setPassword(initialPass));
    }, [generatePassword]);

    // Live derived entropy updates using useMemo instead of useEffect setState
    const entropyResult = useMemo(() => {
        const zxcvbn = cryptoWindow().zxcvbn;
        if (zxcvbnLoaded && zxcvbn && password) {
            return zxcvbn(password);
        }
        return null;
    }, [password, zxcvbnLoaded]);

    const generate = useCallback(() => {
        setPassword(generatePassword(length, options));
    }, [length, options, generatePassword]);

    const handleLengthChange = (v: number) => {
        setLength(v);
        setPassword(generatePassword(v, options));
    };

    const handleOptionChange = (key: keyof typeof options) => {
        const newOpts = {...options, [key]: !options[key]};
        if (!buildPasswordCharset(newOpts)) {
            setOptionWarning('至少需要保留一种字符类型。');
            return;
        }
        setOptionWarning('');
        setOptions(newOpts);
        setPassword(generatePassword(length, newOpts));
    };

    const copyPass = () => {
        navigator.clipboard.writeText(password);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const scoreInfo = useMemo(() => {
        if (!entropyResult) return { width: '0%', color: 'bg-slate-200', text: '计算中...' };
        const score = entropyResult.score;
        switch (score) {
            case 0: return { width: '15%', color: 'bg-rose-500', text: '危！极易破解 ⚠️' };
            case 1: return { width: '35%', color: 'bg-orange-500', text: '弱！低安全 ⚠️' };
            case 2: return { width: '60%', color: 'bg-amber-500', text: '中！中等安全 🟡' };
            case 3: return { width: '80%', color: 'bg-emerald-400', text: '强！高安全 🟢' };
            case 4: return { width: '100%', color: 'bg-emerald-600', text: '极强！军事级安全 🛡️' };
            default: return { width: '0%', color: 'bg-slate-200', text: '未知' };
        }
    }, [entropyResult]);

    return (
        <Card className="h-full flex flex-col">
            <CardHeader 
                title="密码生成与 Zxcvbn 破解时延估算器" 
                description="生成高强度随机密码，基于 Zxcvbn 熵值算法离线计算破解成本，多维度可视化黑客暴力破解的时延。" 
                actions={<Button size="sm" onClick={generate} icon={<RefreshCcw className="w-4 h-4"/>}>刷新</Button>}
            />
            <CardContent className="flex-1 overflow-auto space-y-6">
                <RuntimeAssetStatusPanel state={zxcvbnRuntimeState} onRetry={loadZxcvbn} compact />
                <div className="relative">
                    <input 
                        type="text"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="tool-panel flex min-h-[4.5rem] w-full items-center justify-center break-all p-4 text-center font-mono text-xl md:text-2xl tracking-normal text-slate-950 focus:outline-none focus:ring-2 focus:ring-primary-200 bg-white"
                    />
                    <Button 
                        size="sm" 
                        variant="ghost"
                        className="absolute top-2 right-2 bg-white/70 backdrop-blur"
                        onClick={copyPass}
                    >
                        {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Controls */}
                    <div className="space-y-4">
                        <div>
                             <label className="flex justify-between text-sm font-semibold text-slate-700 mb-2">
                                 <span>密码长度: {length}</span>
                             </label>
                             <input 
                                type="range" 
                                min="6" 
                                max="64" 
                                value={length} 
                                onChange={e => handleLengthChange(Number(e.target.value))}
                                className="w-full accent-primary-600"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {Object.keys(options).map(key => (
                                <label key={key} className="tool-panel flex cursor-pointer items-center gap-2.5 p-2.5 transition-colors hover:bg-white text-xs font-semibold">
                                    <input 
                                        type="checkbox" 
                                        checked={options[key as keyof typeof options]}
                                        onChange={() => handleOptionChange(key as keyof typeof options)}
                                        className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                                    />
                                    <span className="capitalize text-slate-700">{key}</span>
                                </label>
                            ))}
                        </div>
                        {optionWarning && <div className="status-warning p-2 text-xs">{optionWarning}</div>}
                    </div>

                    {/* Live Entropy Estimations */}
                    <div className="tool-panel p-4 space-y-4">
                        <div>
                            <div className="flex justify-between text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                                <span>安全评级与强度</span>
                                <span>{scoreInfo.text}</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                                <div className={`h-full transition-all duration-350 ${scoreInfo.color}`} style={{ width: scoreInfo.width }} />
                            </div>
                        </div>

                        {entropyResult ? (
                            <div className="space-y-2 text-xs">
                                <div className="border-b pb-2 dark:border-slate-800">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">估算密码信息熵</div>
                                    <strong className="font-mono text-sm text-slate-800 dark:text-slate-200">
                                        {entropyResult.guesses_log10 ? entropyResult.guesses_log10.toFixed(2) : '0.00'} log10 bits
                                    </strong>
                                </div>
                                <div className="grid grid-cols-2 gap-2 border-b pb-2 dark:border-slate-800">
                                    <div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase">在线攻击时延</div>
                                        <span className="font-semibold text-slate-700 dark:text-slate-350">
                                            {entropyResult.crack_times_display?.online_no_throttling_10_guesses_per_second || '极速'}
                                        </span>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase">高速离线哈希攻击</div>
                                        <span className="font-semibold text-rose-600 dark:text-rose-400">
                                            {entropyResult.crack_times_display?.offline_fast_hashing_1e10_per_second || '即刻'}
                                        </span>
                                    </div>
                                </div>
                                {entropyResult.feedback && (entropyResult.feedback.warning || entropyResult.feedback.suggestions.length > 0) && (
                                    <div className="bg-amber-50 dark:bg-amber-950/20 p-2.5 rounded-lg border border-amber-200 dark:border-amber-900/30 text-amber-800 dark:text-amber-400 text-[10px]">
                                        {entropyResult.feedback.warning && (
                                            <p className="font-bold mb-1">⚠️ {entropyResult.feedback.warning}</p>
                                        )}
                                        {entropyResult.feedback.suggestions.map((sug, idx) => (
                                            <p key={idx}>• {sug}</p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-xs text-slate-400 italic">
                                {zxcvbnRuntimeState.status === 'error'
                                    ? '密码生成器仍可离线使用；强度审计库加载失败，可点击上方重试。'
                                    : zxcvbnLoaded ? '输入或生成密码以运行安全审计...' : '正在加载密码强度审计计算库...'}
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

// ================= GPG/PGP Offline Keymaster Tool =================
const OPENPGP_VERSION = '5.11.3';
const OPENPGP_SCRIPT_URL = `https://cdn.jsdelivr.net/npm/openpgp@${OPENPGP_VERSION}/dist/openpgp.min.js`;

export const PgpKeymasterTool: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'generate' | 'crypto' | 'sign-verify'>('generate');
  const [openpgpLoaded, setOpenpgpLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [openpgpRuntimeState, setOpenpgpRuntimeState] = useState<RuntimeAssetLoaderState>({
    status: 'idle',
    label: 'OpenPGP',
    version: OPENPGP_VERSION,
    source: OPENPGP_SCRIPT_URL,
  });
  
  // Generation state
  const [genName, setGenName] = useState('Alice Vance');
  const [genEmail, setGenEmail] = useState('alice@dev.com');
  const [genPassphrase, setGenPassphrase] = useState('supersecret');
  const [genKeyType, setGenKeyType] = useState('ecc'); // 'ecc' or '2048' or '4096'
  const [genPublicKey, setGenPublicKey] = useState('');
  const [genPrivateKey, setGenPrivateKey] = useState('');
  
  // Encryption/Decryption state
  const [cryptoText, setCryptoText] = useState('Hello World! This is an offline PGP secure message.');
  const [cryptoPubKey, setCryptoPubKey] = useState('');
  const [cryptoPrivKey, setCryptoPrivKey] = useState('');
  const [cryptoPassphrase, setCryptoPassphrase] = useState('');
  const [cryptoResult, setCryptoResult] = useState('');
  
  // Sign/Verify state
  const [signText, setSignText] = useState('This message is signed by Alice to confirm identity.');
  const [signPrivKey, setSignPrivKey] = useState('');
  const [signPassphrase, setSignPassphrase] = useState('');
  const [signResultSignature, setSignResultSignature] = useState('');
  const [verifyPubKey, setVerifyPubKey] = useState('');
  const [verifySignature, setVerifySignature] = useState('');
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');

  const { copied: genPubCopied, copy: copyGenPub } = useCopyToClipboard();
  const { copied: genPrivCopied, copy: copyGenPriv } = useCopyToClipboard();
  const { copied: cryptoResultCopied, copy: copyCryptoResult } = useCopyToClipboard();
  const { copied: signatureCopied, copy: copySignature } = useCopyToClipboard();

  const loadOpenPgp = useCallback(() => {
    if (cryptoWindow().openpgp) {
      Promise.resolve().then(() => setOpenpgpLoaded(true));
      return;
    }
    loadScriptWithCache(OPENPGP_SCRIPT_URL, {
      label: 'OpenPGP',
      version: OPENPGP_VERSION,
      onStatus: event => setOpenpgpRuntimeState({
        status: event.status,
        label: event.label,
        version: event.version,
        source: event.src,
        attempt: event.attempt,
        progress: event.progress,
        error: event.message,
      }),
    })
      .then(() => setOpenpgpLoaded(true))
      .catch(() => setError('加载 OpenPGP 库失败，请检查网络连接。'));
  }, []);

  useEffect(() => {
    loadOpenPgp();
  }, [loadOpenPgp]);

  const handleGenerateKeys = async () => {
    if (!openpgpLoaded) return;
    try {
      setIsLoading(true);
      setError('');
      const openpgp = cryptoWindow().openpgp;
      if (!openpgp) throw new Error('OpenPGP library is not loaded');
      
      const options = genKeyType === 'ecc'
        ? { type: 'ecc' as const, curve: 'curve25519', userIDs: [{ name: genName, email: genEmail }], passphrase: genPassphrase }
        : { type: 'rsa' as const, rsaBits: Number(genKeyType), userIDs: [{ name: genName, email: genEmail }], passphrase: genPassphrase };
        
      const { privateKey, publicKey } = await openpgp.generateKey(options);
      setGenPublicKey(publicKey);
      setGenPrivateKey(privateKey);
      
      // Auto-fill into other tabs for extremely smooth developer UX!
      setCryptoPubKey(publicKey);
      setCryptoPrivKey(privateKey);
      setSignPrivKey(privateKey);
      setVerifyPubKey(publicKey);
      
      setIsLoading(false);
    } catch (err) {
      setError('生成密钥对失败: ' + (err as Error).message);
      setIsLoading(false);
    }
  };

  const handleEncrypt = async () => {
    if (!openpgpLoaded || !cryptoPubKey) {
      alert('请先输入收件人公钥！');
      return;
    }
    try {
      setIsLoading(true);
      const openpgp = cryptoWindow().openpgp;
      if (!openpgp) throw new Error('OpenPGP library is not loaded');
      const message = await openpgp.createMessage({ text: cryptoText });
      const publicKeyObj = await openpgp.readKey({ armoredKey: cryptoPubKey });
      
      const encrypted = await openpgp.encrypt({
        message,
        encryptionKeys: publicKeyObj
      });
      setCryptoResult(encrypted);
      setIsLoading(false);
    } catch (err) {
      alert('加密失败: ' + (err as Error).message);
      setIsLoading(false);
    }
  };

  const handleDecrypt = async () => {
    if (!openpgpLoaded || !cryptoPrivKey) {
      alert('请先输入您的私钥！');
      return;
    }
    try {
      setIsLoading(true);
      const openpgp = cryptoWindow().openpgp;
      if (!openpgp) throw new Error('OpenPGP library is not loaded');
      const message = await openpgp.readMessage({ armoredMessage: cryptoText });
      let privateKeyObj = await openpgp.readPrivateKey({ armoredKey: cryptoPrivKey });
      
      if (cryptoPassphrase) {
        privateKeyObj = await openpgp.decryptKey({
          privateKey: privateKeyObj,
          passphrase: cryptoPassphrase
        });
      }
      
      const { data: decrypted } = await openpgp.decrypt({
        message,
        decryptionKeys: privateKeyObj
      });
      setCryptoResult(decrypted);
      setIsLoading(false);
    } catch (err) {
      alert('解密失败（请检查私钥或密码是否正确）: ' + (err as Error).message);
      setIsLoading(false);
    }
  };

  const handleSign = async () => {
    if (!openpgpLoaded || !signPrivKey) {
      alert('请先输入签署私钥！');
      return;
    }
    try {
      setIsLoading(true);
      const openpgp = cryptoWindow().openpgp;
      if (!openpgp) throw new Error('OpenPGP library is not loaded');
      const message = await openpgp.createMessage({ text: signText });
      let privateKeyObj = await openpgp.readPrivateKey({ armoredKey: signPrivKey });
      
      if (signPassphrase) {
        privateKeyObj = await openpgp.decryptKey({
          privateKey: privateKeyObj,
          passphrase: signPassphrase
        });
      }
      
      const signature = await openpgp.sign({
        message,
        signingKeys: privateKeyObj,
        detached: true
      });
      setSignResultSignature(signature);
      setVerifySignature(signature);
      setIsLoading(false);
    } catch (err) {
      alert('签署失败: ' + (err as Error).message);
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!openpgpLoaded || !verifyPubKey || !verifySignature) {
      alert('请确保已填入验证公钥与待校验签名！');
      return;
    }
    try {
      setIsLoading(true);
      const openpgp = cryptoWindow().openpgp;
      if (!openpgp) throw new Error('OpenPGP library is not loaded');
      const message = await openpgp.createMessage({ text: signText });
      const signatureObj = await openpgp.readSignature({ armoredSignature: verifySignature });
      const publicKeyObj = await openpgp.readKey({ armoredKey: verifyPubKey });
      
      const verificationResult = await openpgp.verify({
        message,
        signature: signatureObj,
        verificationKeys: publicKeyObj
      });
      const { signatures } = verificationResult;
      const isValid = await signatures[0].verified;
      setVerifyStatus(isValid ? 'valid' : 'invalid');
      setIsLoading(false);
    } catch (err) {
      alert('签名验证失败: ' + (err as Error).message);
      setVerifyStatus('invalid');
      setIsLoading(false);
    }
  };

  const downloadKey = (armorText: string, filename: string) => {
    const blob = new Blob([armorText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="GPG / PGP 离线安全密钥加解密中心"
        description="100% 浏览器本地离线运行的 OpenPGP 军事级密码库，支持 ECC/RSA 密钥生成、消息签名、数字签名核验及文本加解密。"
      />
      <div className="px-4 pt-4">
        <RuntimeAssetStatusPanel state={openpgpRuntimeState} onRetry={loadOpenPgp} compact />
      </div>
      <div className="flex border-b border-slate-200 dark:border-slate-800 px-4">
        {([
          ['generate', '生成密钥对'],
          ['crypto', '文本加密 / 解密'],
          ['sign-verify', '消息数字签名 / 核验'],
        ] as const).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-3 px-5 text-xs font-bold border-b-2 transition-all ${
              activeTab === tab
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <CardContent className="flex-1 overflow-auto min-h-0">
        {!openpgpLoaded && (
          <div className="p-3 bg-blue-50 text-blue-700 rounded-xl text-xs mb-4 flex items-center gap-2 animate-pulse">
            <Info className="w-4 h-4" />
            <span>正在载入 OpenPGP WebAssembly 密码学安全计算核心，请稍后...</span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs mb-4">
            {error}
          </div>
        )}

        {activeTab === 'generate' && (
          <div className="grid grid-cols-1 lg:grid-cols-[20rem_minmax(0,1fr)] gap-6 h-full min-h-0">
            {/* Gen Left Form */}
            <div className="space-y-4">
              <div>
                <FieldLabel>用户名 / UID</FieldLabel>
                <Input value={genName} onChange={e => setGenName(e.target.value)} placeholder="Alice Vance" />
              </div>
              <div>
                <FieldLabel>邮箱 (Email)</FieldLabel>
                <Input value={genEmail} onChange={e => setGenEmail(e.target.value)} placeholder="alice@dev.com" />
              </div>
              <div>
                <FieldLabel>私钥保护密码 (Passphrase)</FieldLabel>
                <Input type="password" value={genPassphrase} onChange={e => setGenPassphrase(e.target.value)} placeholder="守护您的私钥..." />
              </div>
              <div>
                <FieldLabel>算法类型 (Key Type)</FieldLabel>
                <Select value={genKeyType} onChange={e => setGenKeyType(e.target.value)}>
                  <option value="ecc">ECC (Curve25519) - 极速/轻量</option>
                  <option value="2048">RSA-2048 - 传统兼容</option>
                  <option value="4096">RSA-4096 - 超高安全强度</option>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={handleGenerateKeys}
                disabled={isLoading || !openpgpLoaded}
                isLoading={isLoading}
              >
                生成 GPG/PGP 密钥对
              </Button>
            </div>

            {/* Gen Right Outputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col min-h-0 gap-2">
                <div className="flex justify-between items-center text-xs">
                  <FieldLabel>公钥 (Public Key)</FieldLabel>
                  <div className="flex gap-1.5">
                    <Button size="xs" variant="secondary" onClick={() => copyGenPub(genPublicKey)} disabled={!genPublicKey}>
                      {genPubCopied ? '已复制' : '复制'}
                    </Button>
                    <Button size="xs" variant="secondary" onClick={() => downloadKey(genPublicKey, 'gpg_public.key')} disabled={!genPublicKey}>
                      下载
                    </Button>
                  </div>
                </div>
                <textarea
                  readOnly
                  className="flex-1 p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[10px] resize-none overflow-auto border border-slate-700"
                  value={genPublicKey || '点击左侧生成密钥对...'}
                />
              </div>

              <div className="flex flex-col min-h-0 gap-2">
                <div className="flex justify-between items-center text-xs">
                  <FieldLabel>加密私钥 (Protected Private Key)</FieldLabel>
                  <div className="flex gap-1.5">
                    <Button size="xs" variant="secondary" onClick={() => copyGenPriv(genPrivateKey)} disabled={!genPrivateKey}>
                      {genPrivCopied ? '已复制' : '复制'}
                    </Button>
                    <Button size="xs" variant="secondary" onClick={() => downloadKey(genPrivateKey, 'gpg_private.key')} disabled={!genPrivateKey}>
                      下载
                    </Button>
                  </div>
                </div>
                <textarea
                  readOnly
                  className="flex-1 p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[10px] resize-none overflow-auto border border-slate-700"
                  value={genPrivateKey || '点击左侧生成密钥对...'}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'crypto' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 h-full min-h-0">
            {/* Input message and keys */}
            <div className="flex flex-col gap-4 min-h-0">
              <div className="flex flex-col min-h-0 flex-1 gap-1.5">
                <FieldLabel>输入文本消息 (待加密明文 / 待解密密文)</FieldLabel>
                <textarea
                  className="flex-1 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white font-mono text-xs focus:outline-none resize-none overflow-auto leading-relaxed"
                  value={cryptoText}
                  onChange={e => setCryptoText(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col min-h-[8rem]">
                  <FieldLabel>收件人公钥 (用于加密)</FieldLabel>
                  <textarea
                    className="flex-1 p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 font-mono text-[9px] focus:outline-none resize-none overflow-auto"
                    value={cryptoPubKey}
                    onChange={e => setCryptoPubKey(e.target.value)}
                    placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----..."
                  />
                </div>
                <div className="flex flex-col min-h-[8rem] gap-2">
                  <div className="flex-1 flex flex-col min-h-0">
                    <FieldLabel>签署私钥 (用于解密)</FieldLabel>
                    <textarea
                      className="flex-1 p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 font-mono text-[9px] focus:outline-none resize-none overflow-auto"
                      value={cryptoPrivKey}
                      onChange={e => setCryptoPrivKey(e.target.value)}
                      placeholder="-----BEGIN PGP PRIVATE KEY BLOCK-----..."
                    />
                  </div>
                  <div>
                    <Input
                      type="password"
                      className="text-xs p-2 h-8"
                      value={cryptoPassphrase}
                      onChange={e => setCryptoPassphrase(e.target.value)}
                      placeholder="私钥保护密码"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button className="flex-1" onClick={handleEncrypt} disabled={isLoading || !openpgpLoaded}>
                  <Lock className="w-4 h-4 mr-1.5" /> 加密消息 (Encrypt)
                </Button>
                <Button className="flex-1" variant="secondary" onClick={handleDecrypt} disabled={isLoading || !openpgpLoaded}>
                  <Unlock className="w-4 h-4 mr-1.5" /> 解密消息 (Decrypt)
                </Button>
              </div>
            </div>

            {/* Results pane */}
            <div className="flex flex-col gap-2 min-h-0">
              <div className="flex justify-between items-center text-xs">
                <FieldLabel>加解密计算结果</FieldLabel>
                <Button size="xs" variant="secondary" onClick={() => copyCryptoResult(cryptoResult)} disabled={!cryptoResult}>
                  {cryptoResultCopied ? '已复制' : '复制结果'}
                </Button>
              </div>
              <textarea
                readOnly
                className="flex-1 p-4 bg-slate-950 text-emerald-400 rounded-xl font-mono text-[11px] leading-relaxed resize-none overflow-auto border border-slate-850"
                value={cryptoResult || '// 运行结果将在这里实时显示'}
              />
            </div>
          </div>
        )}

        {activeTab === 'sign-verify' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 h-full min-h-0">
            {/* Sign & Verify forms */}
            <div className="flex flex-col gap-4 min-h-0">
              <div className="flex flex-col min-h-0 flex-1 gap-1.5">
                <FieldLabel>待处理的文本消息 (Message)</FieldLabel>
                <textarea
                  className="flex-1 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white font-mono text-xs focus:outline-none resize-none overflow-auto leading-relaxed"
                  value={signText}
                  onChange={e => setSignText(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Sign inputs */}
                <div className="space-y-2.5">
                  <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-primary-500" />
                    <span>制作数字签名</span>
                  </h5>
                  <textarea
                    className="w-full h-24 p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 font-mono text-[9px] focus:outline-none resize-none overflow-auto"
                    value={signPrivKey}
                    onChange={e => setSignPrivKey(e.target.value)}
                    placeholder="签署者的私钥 -----BEGIN PGP PRIVATE KEY BLOCK-----"
                  />
                  <Input
                    type="password"
                    className="text-xs p-2 h-8"
                    value={signPassphrase}
                    onChange={e => setSignPassphrase(e.target.value)}
                    placeholder="私钥保护密码 (Passphrase)"
                  />
                  <Button className="w-full size-sm" onClick={handleSign} disabled={isLoading || !openpgpLoaded}>
                    生成签名 (Sign)
                  </Button>
                </div>

                {/* Verify inputs */}
                <div className="space-y-2.5">
                  <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Unlock className="w-3.5 h-3.5 text-emerald-500" />
                    <span>核验数字签名</span>
                  </h5>
                  <textarea
                    className="w-full h-24 p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 font-mono text-[9px] focus:outline-none resize-none overflow-auto"
                    value={verifyPubKey}
                    onChange={e => setVerifyPubKey(e.target.value)}
                    placeholder="签署者的公钥 -----BEGIN PGP PUBLIC KEY BLOCK-----"
                  />
                  <textarea
                    className="w-full h-20 p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 font-mono text-[9px] focus:outline-none resize-none overflow-auto"
                    value={verifySignature}
                    onChange={e => setVerifySignature(e.target.value)}
                    placeholder="脱水签名 block -----BEGIN PGP SIGNATURE-----"
                  />
                  <Button className="w-full size-sm" variant="secondary" onClick={handleVerify} disabled={isLoading || !openpgpLoaded}>
                    验证签名有效性 (Verify)
                  </Button>
                </div>
              </div>
            </div>

            {/* Results pane */}
            <div className="flex flex-col gap-4 min-h-0">
              <div className="flex-1 flex flex-col gap-2 min-h-0">
                <div className="flex justify-between items-center text-xs">
                  <FieldLabel>脱水数字签名 (Armored Detached Signature)</FieldLabel>
                  <Button size="xs" variant="secondary" onClick={() => copySignature(signResultSignature)} disabled={!signResultSignature}>
                    {signatureCopied ? '已复制' : '复制签名'}
                  </Button>
                </div>
                <textarea
                  readOnly
                  className="flex-1 p-3 bg-slate-950 text-indigo-400 rounded-xl font-mono text-[10px] leading-normal resize-none overflow-auto border border-slate-850"
                  value={signResultSignature || '// 生成的签名 Block 将在此渲染'}
                />
              </div>

              {/* Status report */}
              {verifyStatus === 'valid' && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                  <span>🟢 <b>签名有效！</b>该消息确由公钥持有者签署，内容未经任何非法篡改。</span>
                </div>
              )}

              {verifyStatus === 'invalid' && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl text-rose-800 dark:text-rose-400 text-xs font-semibold flex items-center gap-2.5">
                  <span>🔴 <b>警告：签名无效！</b>核验公钥不匹配，或消息内容已被串改或损坏。</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// --- Chinese National Cryptography GB/T 32918 standard (SM2/SM3/SM4 Suite) ---

export const SmCryptoSuiteTool: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sm2' | 'sm3' | 'sm4'>('sm2');
  const [loaded, setLoaded] = useState(false);
  const [smRuntimeState, setSmRuntimeState] = useState<RuntimeAssetLoaderState>({
    status: 'idle',
    label: 'sm-crypto',
    version: '0.3.12',
    source: 'https://cdn.jsdelivr.net/npm/sm-crypto@0.3.12/dist/sm-crypto.js',
  });

  // SM2 states
  const [sm2Pub, setSm2Pub] = useState('');
  const [sm2Priv, setSm2Priv] = useState('');
  const [sm2Plain, setSm2Plain] = useState('Hello SM2 国密!');
  const [sm2CipherHex, setSm2CipherHex] = useState('');
  const [sm2Decrypted, setSm2Decrypted] = useState('');
  const [sm2SignPlain, setSm2SignPlain] = useState('需要签名的国密数据');
  const [sm2SignatureHex, setSm2SignatureHex] = useState('');
  const [sm2VerifyResult, setSm2VerifyResult] = useState<'none' | 'valid' | 'invalid'>('none');

  // SM3 states
  const [sm3Input, setSm3Input] = useState('DevToolbox Pro SM3 Hashing');

  // SM4 states
  const [sm4Plain, setSm4Plain] = useState('对称分组加密明文');
  const [sm4CipherHex, setSm4CipherHex] = useState('');
  const [sm4Key, setSm4Key] = useState('0123456789abcdeffedcba9876543210'); // 16 bytes hex key
  const [sm4Iv, setSm4Iv] = useState('0123456789abcdeffedcba9876543210'); // 16 bytes hex iv
  const [sm4Mode, setSm4Mode] = useState<'ecb' | 'cbc'>('cbc');

  // Load sm-crypto dynamically to keep Vite bundle extremely light
  const loadSmCrypto = useCallback(() => {
    if (cryptoWindow().smCrypto) {
      Promise.resolve().then(() => setLoaded(true));
      return;
    }
    loadScriptWithCache('https://cdn.jsdelivr.net/npm/sm-crypto@0.3.12/dist/sm-crypto.js', {
      label: 'sm-crypto',
      version: '0.3.12',
      onStatus: event => setSmRuntimeState({
        status: event.status,
        label: event.label,
        version: event.version,
        source: event.src,
        attempt: event.attempt,
        progress: event.progress,
        error: event.message,
      }),
    })
      .then(() => setLoaded(true))
      .catch((err) => console.error('Failed to dynamically load sm-crypto CDN library.', err));
  }, []);

  useEffect(() => {
    loadSmCrypto();
  }, [loadSmCrypto]);

  // SM2 Generators
  const handleSm2Generate = () => {
    const sm2 = cryptoWindow().smCrypto?.sm2;
    if (!loaded || !sm2) return;
    try {
      const keypair = sm2.generateKeyPairHex();
      setSm2Pub(keypair.publicKey);
      setSm2Priv(keypair.privateKey);
    } catch (e) {
      alert(`SM2 密钥对生成失败: ${(e as Error).message}`);
    }
  };

  const handleSm2Encrypt = () => {
    const sm2 = cryptoWindow().smCrypto?.sm2;
    if (!loaded || !sm2) return;
    if (!sm2Pub) {
      alert('请先生成或配置 SM2 公钥！');
      return;
    }
    try {
      // mode 1 represents C1C3C2 cipher standard
      const cipher = sm2.doEncrypt(sm2Plain, sm2Pub, 1);
      setSm2CipherHex(cipher);
    } catch (e) {
      alert(`SM2 加密失败，请核对公钥格式: ${(e as Error).message}`);
    }
  };

  const handleSm2Decrypt = () => {
    const sm2 = cryptoWindow().smCrypto?.sm2;
    if (!loaded || !sm2) return;
    if (!sm2Priv) {
      alert('请配置 SM2 私钥！');
      return;
    }
    try {
      const decrypted = sm2.doDecrypt(sm2CipherHex, sm2Priv, 1);
      setSm2Decrypted(decrypted);
    } catch (e) {
      alert(`SM2 解密失败，请核对私钥或密文: ${(e as Error).message}`);
    }
  };

  const handleSm2Sign = () => {
    const sm2 = cryptoWindow().smCrypto?.sm2;
    if (!loaded || !sm2) return;
    if (!sm2Priv) {
      alert('请配置 SM2 私钥进行签名！');
      return;
    }
    try {
      const sig = sm2.doSignature(sm2SignPlain, sm2Priv, { hash: true, der: true });
      setSm2SignatureHex(sig);
    } catch (e) {
      alert(`SM2 签名计算失败: ${(e as Error).message}`);
    }
  };

  const handleSm2Verify = () => {
    const sm2 = cryptoWindow().smCrypto?.sm2;
    if (!loaded || !sm2) return;
    if (!sm2Pub || !sm2SignatureHex) {
      alert('请配置公钥与待验签的十六进制签名串！');
      return;
    }
    try {
      const isValid = sm2.doVerifySignature(sm2SignPlain, sm2SignatureHex, sm2Pub, { hash: true, der: true });
      setSm2VerifyResult(isValid ? 'valid' : 'invalid');
    } catch {
      setSm2VerifyResult('invalid');
    }
  };

  // SM3 Calculations
  const sm3Result = useMemo(() => {
    const sm3 = cryptoWindow().smCrypto?.sm3;
    if (!loaded || !sm3) return '';
    try {
      return sm3(sm3Input).toUpperCase();
    } catch {
      return '';
    }
  }, [sm3Input, loaded]);

  // SM4 Ciphers
  const handleSm4Encrypt = () => {
    const sm4 = cryptoWindow().smCrypto?.sm4;
    if (!loaded || !sm4) return;
    if (sm4Key.length !== 32) {
      alert('SM4 密钥必须为 32 位 Hex 十六进制字符串 (128 bits / 16 字节)！');
      return;
    }
    if (sm4Mode === 'cbc' && sm4Iv.length !== 32) {
      alert('CBC 模式下，SM4 向量 (IV) 必须为 32 位 Hex 十六进制字符串 (16 字节)！');
      return;
    }
    try {
      const options: SmCryptoOptions = { mode: sm4Mode, padding: 'pkcs7' };
      if (sm4Mode === 'cbc') {
        options.iv = sm4Iv;
      }
      const cipher = sm4.encrypt(sm4Plain, sm4Key, options);
      setSm4CipherHex(cipher);
    } catch (e) {
      alert(`SM4 对称加密失败: ${(e as Error).message}`);
    }
  };

  const handleSm4Decrypt = () => {
    const sm4 = cryptoWindow().smCrypto?.sm4;
    if (!loaded || !sm4) return;
    if (sm4Key.length !== 32) {
      alert('SM4 密钥必须为 32 位 Hex！');
      return;
    }
    try {
      const options: SmCryptoOptions = { mode: sm4Mode, padding: 'pkcs7' };
      if (sm4Mode === 'cbc') {
        options.iv = sm4Iv;
      }
      const decrypted = sm4.decrypt(sm4CipherHex, sm4Key, options);
      setSm4Plain(decrypted);
    } catch (e) {
      alert(`SM4 对称解密失败，请校验密钥或密文: ${(e as Error).message}`);
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader 
        title="国密算法安全测试中心 (Chinese Cryptography GB/T Standard)" 
        description="支持中国国家商用密码套件：SM2 椭圆曲线非对称密钥对与签名体检验、SM3 杂凑算法特征码比对及 SM4 分组对称加密（ECB/CBC 模式）的 100% 本地离线处理。" 
      />
      <CardContent className="flex-1 flex flex-col gap-4 overflow-auto min-h-0 text-slate-700 dark:text-slate-200">
        <RuntimeAssetStatusPanel state={smRuntimeState} onRetry={loadSmCrypto} compact />
        
        {!loaded && (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl text-amber-800 dark:text-amber-400 text-xs flex items-center gap-2 animate-pulse">
            <Info className="w-4 h-4 shrink-0" />
            <span>正在从安全 CDN 离线载入国密 SM 算法动力包，请稍候...</span>
          </div>
        )}

        {/* Tab Buttons */}
        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 flex-none">
          {(['sm2', 'sm3', 'sm4'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === tab 
                  ? 'bg-primary-600 text-white shadow-sm' 
                  : 'bg-slate-50 dark:bg-slate-900 text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              {tab.toUpperCase()} {tab === 'sm2' ? '非对称与签名' : tab === 'sm3' ? '杂凑计算' : '对称分组加密'}
            </button>
          ))}
        </div>

        {loaded && activeTab === 'sm2' && (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-5 overflow-auto min-h-0 animate-in fade-in duration-200">
            {/* Column 1: Keygen & Encrypt/Decrypt */}
            <div className="space-y-4">
              <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-900/40 space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold uppercase text-slate-500">SM2 椭圆曲线公私钥发生器</h3>
                  <Button size="sm" onClick={handleSm2Generate} icon={<RefreshCcw className="w-3.5 h-3.5" />}>
                    生成 SM2 密钥对
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px]">
                  <div className="space-y-1">
                    <span className="text-slate-500 block font-semibold">SM2 公钥 (Public Key Hex)</span>
                    <input 
                      className="w-full p-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl font-mono text-[9px] focus:outline-none"
                      value={sm2Pub}
                      onChange={e => setSm2Pub(e.target.value)}
                      placeholder="未生成公钥"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-500 block font-semibold">SM2 私钥 (Private Key Hex)</span>
                    <input 
                      className="w-full p-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl font-mono text-[9px] focus:outline-none"
                      value={sm2Priv}
                      onChange={e => setSm2Priv(e.target.value)}
                      placeholder="未生成私钥"
                    />
                  </div>
                </div>
              </div>

              {/* Encrypt Decrypt Cards */}
              <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950 space-y-3">
                <h3 className="text-xs font-bold uppercase text-slate-500">SM2 文本非对称加解密 (C1C3C2 模式)</h3>
                <div className="space-y-2">
                  <FieldLabel>待加密明文 (Plaintext)</FieldLabel>
                  <input 
                    className="w-full p-2.5 border rounded-xl text-xs border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus:outline-none"
                    value={sm2Plain}
                    onChange={e => setSm2Plain(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleSm2Encrypt} icon={<Lock className="w-3.5 h-3.5" />}>加密</Button>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-900">
                  <FieldLabel>加密后密文 (Ciphertext Hex)</FieldLabel>
                  <textarea 
                    className="w-full h-16 p-2.5 border rounded-xl font-mono text-xs leading-relaxed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus:outline-none resize-none"
                    value={sm2CipherHex}
                    onChange={e => setSm2CipherHex(e.target.value)}
                    placeholder="加密后的十六进制数据块将在此显示"
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleSm2Decrypt} icon={<Unlock className="w-3.5 h-3.5" />}>解密</Button>
                  </div>
                </div>

                {sm2Decrypted && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-400 font-mono">
                    🔓 解密还原明文: {sm2Decrypted}
                  </div>
                )}
              </div>
            </div>

            {/* Column 2: SM2 Digital Signature */}
            <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950 space-y-4">
              <h3 className="text-xs font-bold uppercase text-slate-500">SM2 离线数字签名与完整性核验</h3>
              <div className="space-y-2">
                <FieldLabel>待签署数据 (Message to Sign)</FieldLabel>
                <input 
                  className="w-full p-2.5 border rounded-xl text-xs border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus:outline-none"
                  value={sm2SignPlain}
                  onChange={e => setSm2SignPlain(e.target.value)}
                />
                <Button onClick={handleSm2Sign}>签名 (Sign)</Button>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-900">
                <FieldLabel>生成的签名 (Signature Hex)</FieldLabel>
                <textarea 
                  className="w-full h-20 p-2.5 border rounded-xl font-mono text-xs leading-relaxed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus:outline-none resize-none"
                  value={sm2SignatureHex}
                  onChange={e => setSm2SignatureHex(e.target.value)}
                  placeholder="生成的十六进制国密签名串"
                />
                <div className="flex gap-2">
                  <Button onClick={handleSm2Verify}>核验签名 (Verify)</Button>
                  <Button 
                    variant="secondary" 
                    onClick={() => {
                      setSm2SignatureHex('');
                      setSm2VerifyResult('none');
                    }}
                  >
                    重置
                  </Button>
                </div>
              </div>

              {sm2VerifyResult === 'valid' && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl text-emerald-800 dark:text-emerald-350 text-xs font-bold">
                  🟢 国密签名核验有效！消息完整且确由公钥持有者签署。
                </div>
              )}
              {sm2VerifyResult === 'invalid' && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl text-rose-800 dark:text-rose-450 text-xs font-bold animate-bounce">
                  🔴 警告：国密签名无效！数据已被非法篡改或密钥对不正确。
                </div>
              )}
            </div>
          </div>
        )}

        {loaded && activeTab === 'sm3' && (
          <div className="flex-1 flex flex-col gap-4 overflow-auto min-h-0 animate-in fade-in duration-200">
            <div className="flex flex-col gap-1.5 flex-1 min-h-[160px]">
              <FieldLabel>输入需要计算的明文</FieldLabel>
              <textarea
                className="w-full flex-1 p-3 border rounded-2xl font-mono text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:outline-none resize-none leading-relaxed"
                value={sm3Input}
                onChange={e => setSm3Input(e.target.value)}
              />
            </div>

            <div className="p-4 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 rounded-2xl space-y-2 flex-none">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">SM3 杂凑哈希特征串 (256 bits Hex)</span>
              <div className="flex gap-2">
                <pre className="flex-1 p-3 rounded-xl border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-950 font-mono text-xs font-bold text-slate-800 dark:text-slate-200 break-all select-all leading-normal">
                  {sm3Result || '等待计算...'}
                </pre>
                <Button 
                  onClick={() => {
                    navigator.clipboard.writeText(sm3Result);
                    alert('SM3 特征串复制成功！');
                  }}
                  icon={<Copy className="w-3.5 h-3.5" />}
                >
                  复制
                </Button>
              </div>
            </div>
          </div>
        )}

        {loaded && activeTab === 'sm4' && (
          <div className="flex-1 flex flex-col gap-4 overflow-auto min-h-0 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start flex-none">
              <div className="space-y-1.5">
                <FieldLabel>对称密钥 (Key Hex - 32位)</FieldLabel>
                <input 
                  className="w-full p-2.5 border rounded-xl font-mono text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none"
                  value={sm4Key}
                  onChange={e => setSm4Key(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>工作模式 (Cipher Mode)</FieldLabel>
                <select 
                  className="w-full p-2.5 border rounded-xl text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none"
                  value={sm4Mode}
                  onChange={e => setSm4Mode(e.target.value as 'ecb' | 'cbc')}
                >
                  <option value="cbc">CBC (链加密模式 - 推荐)</option>
                  <option value="ecb">ECB (电子密码本模式)</option>
                </select>
              </div>
              {sm4Mode === 'cbc' && (
                <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-200">
                  <FieldLabel>初始向量 (IV Hex - 32位)</FieldLabel>
                  <input 
                    className="w-full p-2.5 border rounded-xl font-mono text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none"
                    value={sm4Iv}
                    onChange={e => setSm4Iv(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
              <div className="flex flex-col gap-1.5 min-h-[140px]">
                <FieldLabel>对称明文 (Symmetric Plaintext)</FieldLabel>
                <textarea
                  className="flex-1 w-full p-2.5 border rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:outline-none resize-none leading-relaxed"
                  value={sm4Plain}
                  onChange={e => setSm4Plain(e.target.value)}
                />
                <div className="flex justify-end">
                  <Button onClick={handleSm4Encrypt} icon={<Lock className="w-3.5 h-3.5" />}>对称加密</Button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 min-h-[140px]">
                <FieldLabel>对称密文 (Ciphertext Hex)</FieldLabel>
                <textarea
                  className="flex-1 w-full p-2.5 border rounded-xl font-mono text-xs leading-relaxed bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:outline-none resize-none"
                  value={sm4CipherHex}
                  onChange={e => setSm4CipherHex(e.target.value)}
                  placeholder="加密后的分组对称密文将在此以十六进制呈现"
                />
                <div className="flex justify-end">
                  <Button onClick={handleSm4Decrypt} icon={<Unlock className="w-3.5 h-3.5" />}>对称解密</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
