import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCcw, Copy, Check } from 'lucide-react';
import md5 from 'blueimp-md5';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { FieldLabel, Input } from '../ui/ToolUi';

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

// --- JWT Tool ---
export const JwtTool: React.FC = () => {
  const [token, setToken] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [verificationResult, setVerificationResult] = useState<'unchecked' | 'valid' | 'invalid' | 'error'>('unchecked');
  const [crackedKey, setCrackedKey] = useState<string | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);

  // Derived state during render
  let header = '';
  let payload = '';
  let claims: { label: string; value: string }[] = [];
  let headerObj: Record<string, any> | null = null;
  let payloadObj: Record<string, any> | null = null;
  let error: string | null = null;

  if (token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error("Invalid JWT format");

      const decode = (str: string) => {
        const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
        const json = decodeURIComponent(atob(base64).split('').map(c => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.stringify(JSON.parse(json), null, 2);
      };

      header = decode(parts[0]);
      payload = decode(parts[1]);
      headerObj = JSON.parse(header);
      payloadObj = JSON.parse(payload);
      
      const toDate = (value: unknown) => typeof value === 'number' ? new Date(value * 1000).toLocaleString() : '';
      claims = [
        payloadObj.iss ? { label: 'Issuer', value: String(payloadObj.iss) } : null,
        payloadObj.sub ? { label: 'Subject', value: String(payloadObj.sub) } : null,
        payloadObj.aud ? { label: 'Audience', value: Array.isArray(payloadObj.aud) ? payloadObj.aud.join(', ') : String(payloadObj.aud) } : null,
        payloadObj.iat ? { label: 'Issued At', value: toDate(payloadObj.iat) } : null,
        payloadObj.nbf ? { label: 'Not Before', value: toDate(payloadObj.nbf) } : null,
        payloadObj.exp ? { label: 'Expires At', value: `${toDate(payloadObj.exp)}${Date.now() > payloadObj.exp * 1000 ? '（已过期 ⚠️）' : '（未过期 🟢）'}` } : null,
      ].filter(Boolean) as { label: string; value: string }[];
    } catch {
      error = "Invalid JWT Token";
    }
  }

  // Handle local signature verification
  const handleVerify = async () => {
    if (!token || !secretKey || error) return;
    try {
      const parts = token.split('.');
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
      
      // Handle base64 padding
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

  // Weak Secret Brute-forcer
  const handleBruteForce = async () => {
    if (!token || error) return;
    setIsAuditing(true);
    setCrackedKey(null);
    
    // Dictionary of common weak secret keys
    const dictionary = [
      'secret', '123456', 'admin', 'development', 'jwt', 
      '12345678', 'password', 'key', 'test', 'demo', 
      'config', 'root', 'security', 'welcome', 'auth', 
      'secretkey', 'mysecret', '1234567890'
    ];

    try {
      const parts = token.split('.');
      const enc = new TextEncoder();
      const messageData = enc.encode(`${parts[0]}.${parts[1]}`);
      const signatureBase64Url = parts[2];
      const signatureBase64 = signatureBase64Url.replace(/-/g, '+').replace(/_/g, '/');
      const paddedBase64 = signatureBase64.padEnd(signatureBase64.length + (4 - signatureBase64.length % 4) % 4, '=');
      const signatureBinary = atob(paddedBase64);
      const signatureBytes = new Uint8Array(signatureBinary.length);
      for (let i = 0; i < signatureBinary.length; i++) {
        signatureBytes[i] = signatureBinary.charCodeAt(i);
      }

      // Test each secret in the dictionary
      let found: string | null = null;
      for (const secret of dictionary) {
        const keyData = enc.encode(secret);
        const cryptoKey = await window.crypto.subtle.importKey(
          "raw",
          keyData,
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["verify"]
        );
        const isValid = await window.crypto.subtle.verify(
          "HMAC",
          cryptoKey,
          signatureBytes,
          messageData
        );
        if (isValid) {
          found = secret;
          break;
        }
      }

      setCrackedKey(found);
      if (found) {
        setSecretKey(found);
        setVerificationResult('valid');
      } else {
        alert('安全审计完成：未在内置弱密码字典（' + dictionary.length + ' 个常用键）中碰撞出密钥，签名暂被判定为具备基础强度！');
      }
    } catch (e) {
      alert('审计失败: ' + (e as Error).message);
    } finally {
      setIsAuditing(false);
    }
  };

  // Reset verification state when token changes
  useEffect(() => {
    setVerificationResult('unchecked');
    setCrackedKey(null);
  }, [token]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader title="JWT 主动安全工坊" description="除标准的 JWT Header/Payload 解析外，特引入 Web Crypto API 级本地验证与弱密钥防伪造审计碰撞探针。" />
      <CardContent className="flex-1 overflow-auto space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-350 mb-1">Encoded Token</label>
          <textarea
            className={`w-full h-24 p-3 font-mono text-sm bg-slate-50 border rounded-lg resize-none focus:outline-none focus:ring-2 dark:bg-slate-900 dark:text-slate-100 ${error ? 'border-red-300 focus:ring-red-200' : 'border-slate-200 focus:ring-primary-200'}`}
            placeholder="eyJh..."
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </div>

        {/* Dynamic Security Alarms & Audit recommendations */}
        {token && !error && (
          <div className="space-y-2.5">
            {headerObj?.alg === 'none' && (
              <div className="status-error p-3 text-xs leading-5">
                🔴 <b>高危安全警告：</b>此 Token 显式设置了 <code>alg: &apos;none&apos;</code> 签名算法！这意味着任意恶意客户端均可在不提供签名的情况下随意篡改 Header 或 Payload 并通过后端逻辑，代表极重度签名绕过风险！
              </div>
            )}
            
            {crackedKey && (
              <div className="status-error p-3 text-xs leading-5">
                🔴 <b>高危安全警告：</b>经过字典爆破，此 Token 使用了极度脆弱的公共弱签名密钥：<span className="font-mono bg-red-100 dark:bg-red-950 font-bold px-2 py-0.5 rounded text-red-700 dark:text-red-400">{crackedKey}</span>！这使得任何人皆可在本地生成新签名并篡改越权。请在生产中立即升级！
              </div>
            )}

            {payloadObj && !payloadObj.exp && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                🟡 <b>安全防范建议：</b>该 Token 的 Payload 缺失了 <code>exp</code> (Expiration Time 过期时间) 声明。缺少 exp 将使该凭据永久有效，无法防范令牌重放攻击或生命周期劫持。
              </div>
            )}

            {secretKey && secretKey.length < 32 && (
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs leading-5 text-indigo-850">
                🔵 <b>密钥强度审计：</b>当前验证密钥长度为 {secretKey.length} 位。根据 RFC-7518 安全标准，HMAC-SHA256 签名算法的密匙长度推荐使用至少 <b>32 字符 (256 bits)</b>，以防范现代 GPU 级并行暴力碰撞破解。
              </div>
            )}
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-350 mb-1">Header</label>
            <pre className="w-full h-48 p-3 font-mono text-xs bg-slate-900 text-green-400 rounded-lg overflow-auto border border-slate-700">
              {header || '// Header'}
            </pre>
          </div>
          <div>
             <label className="block text-sm font-medium text-slate-700 dark:text-slate-350 mb-1">Payload</label>
             <pre className="w-full h-48 p-3 font-mono text-xs bg-slate-900 text-blue-400 rounded-lg overflow-auto border border-slate-700">
              {payload || '// Payload'}
            </pre>
          </div>
        </div>

        {/* Verification Board Card */}
        {token && !error && (
          <div className="tool-panel p-4 space-y-4">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider">
              🛡️ 本地签名验证与字典安全爆破
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div>
                <FieldLabel>输入验证签名密钥 (HMAC Secret Key)</FieldLabel>
                <Input
                  className="font-mono text-sm"
                  type="password"
                  placeholder="Secret key..."
                  value={secretKey}
                  onChange={e => setSecretKey(e.target.value)}
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button onClick={handleVerify} disabled={!secretKey}>
                  验证签名
                </Button>
                <Button variant="secondary" onClick={handleBruteForce} isLoading={isAuditing}>
                  弱密钥审计碰撞
                </Button>
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
        )}

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

// --- Password Generator Tool ---
export const PasswordGenTool: React.FC = () => {
    const [length, setLength] = useState(16);
    const [options, setOptions] = useState({
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: true,
    });

    // Pure function for generation
    const generatePassword = useCallback((len: number, opts: typeof options) => {
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

        if (charSet === '') return '';

        let res = '';
        const array = new Uint32Array(len);
        crypto.getRandomValues(array);
        for (let i = 0; i < len; i++) {
            res += charSet[array[i] % charSet.length];
        }
        return res;
    }, []);

    const [password, setPassword] = useState(() => {
        // Init logic duplicated or we can define function outside component
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=';
        let res = '';
        const array = new Uint32Array(16);
        crypto.getRandomValues(array);
        for (let i = 0; i < 16; i++) {
            res += chars[array[i] % chars.length];
        }
        return res;
    });
    const [copied, setCopied] = useState(false);

    const generate = useCallback(() => {
        setPassword(generatePassword(length, options));
    }, [length, options, generatePassword]);

    const handleLengthChange = (v: number) => {
        setLength(v);
        setPassword(generatePassword(v, options));
    }

    const handleOptionChange = (key: keyof typeof options) => {
        const newOpts = {...options, [key]: !options[key]};
        setOptions(newOpts);
        setPassword(generatePassword(length, newOpts));
    }

    const copyPass = () => {
        navigator.clipboard.writeText(password);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    return (
        <Card className="h-full flex flex-col">
            <CardHeader 
                title="密码生成器" 
                description="生成高强度随机密码。" 
                actions={<Button size="sm" onClick={generate} icon={<RefreshCcw className="w-4 h-4"/>}>刷新</Button>}
            />
            <CardContent className="flex-1 space-y-8">
                <div className="relative">
                    <div className="tool-panel flex min-h-[4rem] w-full items-center justify-center break-all p-4 text-center font-mono text-2xl tracking-normal text-slate-950">
                        {password}
                    </div>
                     <Button 
                        size="sm" 
                        variant="ghost"
                        className="absolute top-2 right-2 bg-white/50 backdrop-blur"
                        onClick={copyPass}
                    >
                        {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </Button>
                </div>

                <div className="space-y-6">
                    <div>
                         <label className="flex justify-between text-sm font-medium text-slate-700 mb-2">
                             <span>长度: {length}</span>
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

                    <div className="grid grid-cols-2 gap-4">
                        {Object.keys(options).map(key => (
                            <label key={key} className="tool-panel flex cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-white">
                                <input 
                                    type="checkbox" 
                                    checked={options[key as keyof typeof options]}
                                    onChange={() => handleOptionChange(key as keyof typeof options)}
                                    className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                                />
                                <span className="capitalize text-slate-700">{key}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
