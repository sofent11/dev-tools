import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCcw, Copy, Check } from 'lucide-react';
import md5 from 'blueimp-md5';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';

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
  // Derived state during render
  let header = '';
  let payload = '';
  let claims: { label: string; value: string }[] = [];
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
      const payloadObject = JSON.parse(payload);
      const toDate = (value: unknown) => typeof value === 'number' ? new Date(value * 1000).toLocaleString() : '';
      claims = [
        payloadObject.iss ? { label: 'Issuer', value: String(payloadObject.iss) } : null,
        payloadObject.sub ? { label: 'Subject', value: String(payloadObject.sub) } : null,
        payloadObject.aud ? { label: 'Audience', value: Array.isArray(payloadObject.aud) ? payloadObject.aud.join(', ') : String(payloadObject.aud) } : null,
        payloadObject.iat ? { label: 'Issued At', value: toDate(payloadObject.iat) } : null,
        payloadObject.nbf ? { label: 'Not Before', value: toDate(payloadObject.nbf) } : null,
        payloadObject.exp ? { label: 'Expires At', value: `${toDate(payloadObject.exp)}${Date.now() > payloadObject.exp * 1000 ? '（已过期）' : '（未过期）'}` } : null,
      ].filter(Boolean) as { label: string; value: string }[];
    } catch {
      error = "Invalid JWT Token";
    }
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader title="JWT 解析" description="解码 JSON Web Tokens 以查看 Header 和 Payload。" />
      <CardContent className="flex-1 overflow-auto space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Encoded Token</label>
          <textarea
            className={`w-full h-24 p-3 font-mono text-sm bg-slate-50 border rounded-lg resize-none focus:outline-none focus:ring-2 ${error ? 'border-red-300 focus:ring-red-200' : 'border-slate-200 focus:ring-primary-200'}`}
            placeholder="eyJh..."
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Header</label>
            <pre className="w-full h-64 p-3 font-mono text-xs bg-slate-900 text-green-400 rounded-lg overflow-auto border border-slate-700">
              {header || '// Header'}
            </pre>
          </div>
          <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">Payload</label>
             <pre className="w-full h-64 p-3 font-mono text-xs bg-slate-900 text-blue-400 rounded-lg overflow-auto border border-slate-700">
              {payload || '// Payload'}
            </pre>
          </div>
        </div>
        {claims.length > 0 && (
          <div className="tool-panel grid gap-3 p-4 md:grid-cols-2">
            {claims.map(claim => (
              <div key={claim.label}>
                <div className="text-xs font-semibold uppercase text-slate-500">{claim.label}</div>
                <div className="break-all text-sm text-slate-900">{claim.value}</div>
              </div>
            ))}
            <div className="md:col-span-2 text-xs text-slate-500">签名未在浏览器本地校验；此工具只解码 Header 和 Payload。</div>
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
