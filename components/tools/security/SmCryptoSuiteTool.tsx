import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Info, Lock, RefreshCcw, Unlock } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { FieldLabel } from '../../ui/ToolUi';
import { loadScriptWithCache } from '../shared/cdnCacheManager';
import { RuntimeAssetStatusPanel } from '../shared/useRuntimeAsset';
import { notifyToast } from '../shared/notifyToast';
import type { RuntimeAssetLoaderState } from '../shared/runtimeAssetLoader';

type SecurityOperationStatus = 'idle' | 'validating' | 'running' | 'success' | 'error';

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

const SecurityStatusPanel: React.FC<{
  status: SecurityOperationStatus;
  message: string;
}> = ({ status, message }) => {
  if (!message || status === 'idle') return null;

  const styles = status === 'error'
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : status === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-blue-200 bg-blue-50 text-blue-700';

  return (
    <div className={`rounded-xl border p-3 text-xs leading-5 ${styles}`}>
      {message}
    </div>
  );
};

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
  smCrypto?: SmCryptoApi;
};

const cryptoWindow = () => window as CryptoWindow;

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
  const [operationStatus, setOperationStatus] = useState<SecurityOperationStatus>('idle');
  const [operationMessage, setOperationMessage] = useState('');

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
      setOperationStatus('success');
      setOperationMessage('SM2 密钥对已生成。请妥善保存私钥，浏览器不会上传任何密钥材料。');
    } catch (e) {
      const message = getErrorMessage(e);
      setOperationStatus('error');
      setOperationMessage(`SM2 密钥对生成失败: ${message}`);
      notifyToast({ title: 'SM2 密钥对生成失败', description: message, tone: 'error' });
    }
  };

  const handleSm2Encrypt = () => {
    const sm2 = cryptoWindow().smCrypto?.sm2;
    if (!loaded || !sm2) return;
    if (!sm2Pub) {
      setOperationStatus('error');
      setOperationMessage('请先生成或配置 SM2 公钥！');
      return;
    }
    try {
      // mode 1 represents C1C3C2 cipher standard
      const cipher = sm2.doEncrypt(sm2Plain, sm2Pub, 1);
      setSm2CipherHex(cipher);
      setOperationStatus('success');
      setOperationMessage('SM2 加密完成。');
    } catch (e) {
      const message = getErrorMessage(e);
      setOperationStatus('error');
      setOperationMessage(`SM2 加密失败，请核对公钥格式: ${message}`);
      notifyToast({ title: 'SM2 加密失败', description: message, tone: 'error' });
    }
  };

  const handleSm2Decrypt = () => {
    const sm2 = cryptoWindow().smCrypto?.sm2;
    if (!loaded || !sm2) return;
    if (!sm2Priv) {
      setOperationStatus('error');
      setOperationMessage('请配置 SM2 私钥！');
      return;
    }
    try {
      const decrypted = sm2.doDecrypt(sm2CipherHex, sm2Priv, 1);
      setSm2Decrypted(decrypted);
      setOperationStatus('success');
      setOperationMessage('SM2 解密完成。');
    } catch (e) {
      const message = getErrorMessage(e);
      setOperationStatus('error');
      setOperationMessage(`SM2 解密失败，请核对私钥或密文: ${message}`);
      notifyToast({ title: 'SM2 解密失败', description: message, tone: 'error' });
    }
  };

  const handleSm2Sign = () => {
    const sm2 = cryptoWindow().smCrypto?.sm2;
    if (!loaded || !sm2) return;
    if (!sm2Priv) {
      setOperationStatus('error');
      setOperationMessage('请配置 SM2 私钥进行签名！');
      return;
    }
    try {
      const sig = sm2.doSignature(sm2SignPlain, sm2Priv, { hash: true, der: true });
      setSm2SignatureHex(sig);
      setOperationStatus('success');
      setOperationMessage('SM2 签名已生成。');
    } catch (e) {
      const message = getErrorMessage(e);
      setOperationStatus('error');
      setOperationMessage(`SM2 签名计算失败: ${message}`);
      notifyToast({ title: 'SM2 签名失败', description: message, tone: 'error' });
    }
  };

  const handleSm2Verify = () => {
    const sm2 = cryptoWindow().smCrypto?.sm2;
    if (!loaded || !sm2) return;
    if (!sm2Pub || !sm2SignatureHex) {
      setOperationStatus('error');
      setOperationMessage('请配置公钥与待验签的十六进制签名串！');
      return;
    }
    try {
      const isValid = sm2.doVerifySignature(sm2SignPlain, sm2SignatureHex, sm2Pub, { hash: true, der: true });
      setSm2VerifyResult(isValid ? 'valid' : 'invalid');
      setOperationStatus(isValid ? 'success' : 'error');
      setOperationMessage(isValid ? 'SM2 签名核验通过。' : 'SM2 签名无效：公钥、消息或签名不匹配。');
    } catch {
      setSm2VerifyResult('invalid');
      setOperationStatus('error');
      setOperationMessage('SM2 签名验证失败，请检查公钥和签名格式。');
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
      setOperationStatus('error');
      setOperationMessage('SM4 密钥必须为 32 位 Hex 十六进制字符串 (128 bits / 16 字节)！');
      return;
    }
    if (sm4Mode === 'cbc' && sm4Iv.length !== 32) {
      setOperationStatus('error');
      setOperationMessage('CBC 模式下，SM4 向量 (IV) 必须为 32 位 Hex 十六进制字符串 (16 字节)！');
      return;
    }
    try {
      const options: SmCryptoOptions = { mode: sm4Mode, padding: 'pkcs7' };
      if (sm4Mode === 'cbc') {
        options.iv = sm4Iv;
      }
      const cipher = sm4.encrypt(sm4Plain, sm4Key, options);
      setSm4CipherHex(cipher);
      setOperationStatus('success');
      setOperationMessage('SM4 对称加密完成。');
    } catch (e) {
      const message = getErrorMessage(e);
      setOperationStatus('error');
      setOperationMessage(`SM4 对称加密失败: ${message}`);
      notifyToast({ title: 'SM4 加密失败', description: message, tone: 'error' });
    }
  };

  const handleSm4Decrypt = () => {
    const sm4 = cryptoWindow().smCrypto?.sm4;
    if (!loaded || !sm4) return;
    if (sm4Key.length !== 32) {
      setOperationStatus('error');
      setOperationMessage('SM4 密钥必须为 32 位 Hex！');
      return;
    }
    try {
      const options: SmCryptoOptions = { mode: sm4Mode, padding: 'pkcs7' };
      if (sm4Mode === 'cbc') {
        options.iv = sm4Iv;
      }
      const decrypted = sm4.decrypt(sm4CipherHex, sm4Key, options);
      setSm4Plain(decrypted);
      setOperationStatus('success');
      setOperationMessage('SM4 对称解密完成。');
    } catch (e) {
      const message = getErrorMessage(e);
      setOperationStatus('error');
      setOperationMessage(`SM4 对称解密失败，请校验密钥或密文: ${message}`);
      notifyToast({ title: 'SM4 解密失败', description: message, tone: 'error' });
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
        <SecurityStatusPanel status={operationStatus} message={operationMessage} />
        
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
                  onClick={async () => {
                    await navigator.clipboard.writeText(sm3Result);
                    notifyToast({ title: 'SM3 特征串复制成功', tone: 'success' });
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
