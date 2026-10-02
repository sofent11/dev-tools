import { readKeyMaterial, importKeyMaterial, decodePem } from './keyMaterial';
import { notifyToast } from '../shared/notifyToast';
import { translateUi as tr, useLocaleRender } from '../../../src/i18n/render';
import React, { useState } from 'react';
import { Shield, ArrowRightLeft, FileCode, Check, Copy, Download, AlertTriangle, CheckCircle2, ClipboardList } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { FieldLabel } from '../../ui/ToolUi';
import { useCopyToClipboard } from '../shared/useCopyToClipboard';
import { useScratchpadStore } from '../shared/scratchpadStore';
import { ScratchpadPicker, isScratchpadKeyLike } from '../shared/ScratchpadControls';

// Standard Helpers for Binary conversions
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const cleaned = hex.replace(/[^0-9a-fA-F]/g, '');
  const len = cleaned.length;
  const bytes = new Uint8Array(len / 2);
  for (let i = 0; i < len; i += 2) {
    bytes[i / 2] = parseInt(cleaned.slice(i, i + 2), 16);
  }
  return bytes;
}

// Convert ArrayBuffer / Uint8Array to formatted PEM
function bytesToPem(bytes: Uint8Array, label: string): string {
  const base64 = bytesToBase64(bytes);
  const lines = [];
  for (let i = 0; i < base64.length; i += 64) {
    lines.push(base64.slice(i, i + 64));
  }
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`;
}

// ASN.1 Length encoder helper for PKCS#1 to PKCS#8 Conversion
interface AuditReport {
  type: 'RSA-Private' | 'RSA-Public' | 'EC-Private' | 'EC-Public' | 'Unknown';
  keySize: number;
  strength: 'strong' | 'medium' | 'weak' | 'n_a';
  strengthText: string;
  isCompliant: boolean;
  extraInfo: Record<string, string>;
}

export const AsymmetricKeyTool: React.FC = () => {
  useLocaleRender();
  const [inputKey, setInputKey] = useState<string>('');
  const [outputFormat, setOutputFormat] = useState<'pem' | 'jwk' | 'der'>('jwk');
  const [convertedFormat, setConvertedFormat] = useState(outputFormat);
  const [loading, setLoading] = useState(false);

  // Results
  const [convertedResult, setConvertedResult] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const { copied, copy } = useCopyToClipboard();

  // Audit State
  const [stashed, setStashed] = useState(false);
  const stashConvertedKey = async () => {
    if (!convertedResult) return;
    const isJwk = convertedFormat === 'jwk';
    const ext = isJwk ? 'json' : convertedFormat === 'pem' ? 'pem' : 'hex';
    const type = isJwk ? 'json' : 'text';
    const mime = isJwk ? 'application/json' : 'text/plain';

    try {
    await useScratchpadStore.getState().addItemAsync({
      name: `exported_key.${ext}`,
      content: convertedResult,
      type,
      mimeType: mime,
      sourceTool: '非对称密钥转换',
      sensitive: true,
      originAction: 'convert-key',
    });
    setStashed(true);
    setTimeout(() => setStashed(false), 2000);
    } catch (error) { notifyToast({ title: '暂存箱保存失败', description: (error as Error).message, tone: 'error' }); }
  };

  const [auditReport, setAuditReport] = useState<AuditReport>({
    type: 'Unknown',
    keySize: 0,
    strength: 'n_a',
    strengthText: '转换后显示算法、长度与容器结构',
    isCompliant: false,
    extraInfo: {},
  });

  // Safe file downloader helper
  const downloadResultFile = () => {
    if (!convertedResult) return;
    const isJwk = convertedFormat === 'jwk';
    const ext = isJwk ? 'json' : convertedFormat === 'pem' ? 'pem' : 'hex';
    const blob = new Blob([convertedResult], { type: isJwk ? 'application/json' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exported_key.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleConvert = async () => {
    if (loading) return;
    setErrorMessage('');
    setConvertedResult('');
    setAuditReport({ type: 'Unknown', keySize: 0, strength: 'n_a', strengthText: '等待有效密钥', isCompliant: false, extraInfo: {} });
    const raw = inputKey.trim();
    if (!raw) { setErrorMessage('请输入非对称密钥 PEM、JWK 或 HEX 内容'); return; }
    setLoading(true);
    try {
      let key: CryptoKey;
      if (raw.startsWith('{')) {
        const jwk = JSON.parse(raw) as JsonWebKey;
        if (jwk.kty !== 'RSA' && jwk.kty !== 'EC') throw new Error('仅支持 RSA 和 EC 密钥');
        const algorithm = jwk.kty === 'EC' ? { name: 'ECDSA', namedCurve: jwk.crv || 'P-256' } : { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
        key = await crypto.subtle.importKey('jwk', jwk, algorithm, true, jwk.d ? ['sign'] : ['verify']);
      } else {
        if (!raw.startsWith('-----BEGIN') && (!/^[0-9a-fA-F\s:]+$/.test(raw) || raw.replace(/[\s:]/g, '').length % 2)) throw new Error('请输入完整 PEM、JWK 或偶数位 DER Hex');
        const bytes = raw.startsWith('-----BEGIN') ? decodePem(raw) : hexToBytes(raw);
        key = await importKeyMaterial(readKeyMaterial(bytes));
      }
      const privateKey = key.type === 'private';
      const bytes = new Uint8Array(await crypto.subtle.exportKey(privateKey ? 'pkcs8' : 'spki', key));
      const material = readKeyMaterial(bytes);
      const strong = material.kind === 'EC' || material.bits >= 2048;
      setAuditReport({
        type: `${material.kind}-${privateKey ? 'Private' : 'Public'}`,
        keySize: material.bits,
        strength: strong ? 'strong' : material.bits >= 1024 ? 'medium' : 'weak',
        strengthText: `Web Crypto 导入成功 · ${material.kind}-${material.bits} · 仅评估算法与长度`,
        isCompliant: strong,
        extraInfo: { '容器格式': privateKey ? 'PKCS#8' : 'SPKI', '曲线': material.curve || '—', '完整性': '本地运行时已验证密钥结构' },
      });
      const result = outputFormat === 'pem' ? bytesToPem(bytes, privateKey ? 'PRIVATE KEY' : 'PUBLIC KEY') : outputFormat === 'der' ? bytesToHex(bytes) : JSON.stringify(await crypto.subtle.exportKey('jwk', key), null, 2);
      setConvertedResult(result);
      setConvertedFormat(outputFormat);
    } catch (error) {
      setErrorMessage((error as Error).message || '密钥转换失败');
    } finally { setLoading(false); }
  };

  const handleLoadSample = async () => {
    if (loading) return;
    setLoading(true); setErrorMessage(''); setConvertedResult('');
    try {
      const keys = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
      setInputKey(JSON.stringify(await crypto.subtle.exportKey('jwk', keys.privateKey), null, 2));
    } catch (error) { setErrorMessage((error as Error).message); }
    finally { setLoading(false); }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader
        title={tr("非对称密钥格式转换")}
        description={tr("在浏览器内转换 RSA/EC 的 PEM、JWK、DER Hex，并检查密钥结构、算法与长度。")}
        actions={
          <div className="flex gap-2 text-xs">
            <button
              onClick={handleLoadSample} disabled={loading}
              className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 transition-all font-semibold"
            >
              {tr("生成本地测试密钥 (JWK)")}</button>
          </div>
        }
      />
      <CardContent className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 overflow-auto">

        {/* Left Side: Inputs and settings (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4 min-h-0">
          <div className="flex-1 flex flex-col gap-2 min-h-[220px]">
            <div className="flex justify-between items-center w-full">
              <FieldLabel hint={tr("支持 RSA (PKCS#1 / PKCS#8), EC 私钥, 公钥或标准 JWK JSON")}>
                {tr("输入密钥文本")}</FieldLabel>
              <ScratchpadPicker
                placeholder={tr("📂 从暂存箱调入...")}
                filter={isScratchpadKeyLike}
                onLoad={content => {
                  if (typeof content === 'string') setInputKey(content);
                }}
              />
            </div>
            <textarea
              className="flex-1 w-full p-3 font-mono text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-200 resize-none leading-relaxed"
              placeholder="-----BEGIN PRIVATE KEY-----&#10;MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQD...&#10;-----END PRIVATE KEY-----"
              value={inputKey}
              onChange={e => setInputKey(e.target.value)}
            />
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
            <div>
              <FieldLabel>{tr("期望导出格式")}</FieldLabel>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {(['jwk', 'pem', 'der'] as const).map(fmt => (
                  <button
                    key={fmt}
                    onClick={() => setOutputFormat(fmt)}
                    className={`py-1.5 rounded-lg border text-xs font-semibold uppercase transition-all ${outputFormat === fmt ? 'bg-primary-600 border-primary-600 text-white shadow-sm' : 'bg-white border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800'}`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            <Button
              className="w-full flex items-center justify-center gap-2"
              onClick={handleConvert} isLoading={loading}
              icon={<ArrowRightLeft className="w-4 h-4" />}
            >
              {tr("转换并检查结构")}</Button>
          </div>
        </div>

        {/* Right Side: Results & Audit Board (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4 min-h-0">

          {/* Result Output Card */}
          <div className="flex-1 flex flex-col border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden min-h-[220px]">
            <div className="bg-slate-50 dark:bg-slate-950 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap gap-2 justify-between items-center flex-none">
              <div className="flex items-center gap-1.5">
                <FileCode className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">{tr("转换输出 (")}{convertedFormat})
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!convertedResult}
                  onClick={stashConvertedKey}
                  icon={stashed ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <ClipboardList className="w-3.5 h-3.5" />}
                >{tr("暂存")}</Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!convertedResult}
                  onClick={() => copy(convertedResult)}
                  icon={copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                >{tr("复制")}</Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!convertedResult}
                  onClick={downloadResultFile}
                  icon={<Download className="w-3.5 h-3.5" />}
                >{tr("下载")}</Button>
              </div>
            </div>

            <div className="flex-1 relative min-h-72 bg-slate-950 p-4">
              {errorMessage ? (
                <div role="alert" className="absolute inset-0 p-4 bg-rose-950/20 text-rose-400 text-xs font-mono leading-relaxed overflow-auto border border-rose-900/30 m-4 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                </div>
              ) : (
                <textarea
                  readOnly
                  className="w-full h-full font-mono text-xs text-emerald-400 dark:text-emerald-300 bg-transparent border-0 outline-none resize-none leading-relaxed overflow-auto"
                  value={convertedResult}
                  placeholder={tr("转换结果将在此呈现")}
                />
              )}
            </div>
          </div>
          {/* Key Auditor Card */}
          <details className="tool-panel p-4"><summary className="cursor-pointer text-sm font-semibold text-slate-600">{tr("密钥结构与算法长度")}</summary><div className="mt-4 p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-950/50 space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary-500" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{tr("算法与结构检查结果")}</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Main Strength Indicator */}
              <div className={`p-4 rounded-xl border flex flex-col justify-between ${
                auditReport.strength === 'strong' ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/10 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-400' :
                auditReport.strength === 'medium' ? 'bg-amber-50/50 border-amber-200 dark:bg-amber-950/10 dark:border-amber-900/30 text-amber-800 dark:text-amber-400' :
                auditReport.strength === 'weak' ? 'bg-rose-50/50 border-rose-200 dark:bg-rose-950/10 dark:border-rose-900/30 text-rose-800 dark:text-rose-400' :
                'bg-slate-100/50 border-slate-200 dark:bg-slate-800/10 dark:border-slate-800 text-slate-500'
              }`}>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider block opacity-70">{tr("算法与长度检查")}</span>
                  <p className="text-xs font-semibold mt-1 leading-relaxed">{tr(auditReport.strengthText)}</p>
                </div>
                <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-current/10">
                  {auditReport.isCompliant ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                  )}
                  <span className="text-[11px] font-medium">
                    {auditReport.strength === 'n_a' ? tr('尚未检查') : auditReport.isCompliant ? tr('算法与长度检查通过') : tr('低于推荐长度')}
                  </span>
                </div>
              </div>

              {/* Algorithm Details */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{tr("密钥元属性")}</span>
                <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">{tr("密钥类别:")}</span>
                    <span className="font-mono font-semibold">{auditReport.type}</span>
                  </div>
                  {auditReport.keySize > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">{tr("密钥位数:")}</span>
                      <span className="font-mono font-semibold">{auditReport.keySize} bits</span>
                    </div>
                  )}
                  {Object.entries(auditReport.extraInfo).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-slate-400">{k}:</span>
                      <span className="font-mono font-semibold truncate max-w-[140px]" title={tr(v)}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div></details>
        </div>

      </CardContent>
    </Card>
  );
};
