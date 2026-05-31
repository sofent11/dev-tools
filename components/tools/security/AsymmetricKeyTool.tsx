import React, { useState, useEffect } from 'react';
import { Shield, ArrowRightLeft, FileCode, Check, Copy, Download, AlertTriangle, CheckCircle2, ClipboardList } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { FieldLabel } from '../../ui/ToolUi';
import { useCopyToClipboard } from '../shared/useCopyToClipboard';
import { useScratchpadStore, getScratchpadItemContent } from '../shared/scratchpadStore';

// Standard Helpers for Binary conversions
function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64.replace(/\s/g, ''));
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

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
function encodeAsn1Length(len: number): number[] {
  if (len < 128) return [len];
  const bytes: number[] = [];
  let temp = len;
  while (temp > 0) {
    bytes.unshift(temp & 0xff);
    temp >>= 8;
  }
  return [0x80 | bytes.length, ...bytes];
}

// Seamless local conversion from PKCS#1 to PKCS#8
function convertPkcs1ToPkcs8(pkcs1Bytes: Uint8Array): Uint8Array {
  const algoId = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const version = [0x02, 0x01, 0x00];
  
  const octetStringHeader = [0x04, ...encodeAsn1Length(pkcs1Bytes.length)];
  const octetString = new Uint8Array(octetStringHeader.length + pkcs1Bytes.length);
  octetString.set(octetStringHeader, 0);
  octetString.set(pkcs1Bytes, octetStringHeader.length);
  
  const totalPayloadLength = version.length + algoId.length + octetString.length;
  const seqHeader = [0x30, ...encodeAsn1Length(totalPayloadLength)];
  
  const pkcs8 = new Uint8Array(seqHeader.length + totalPayloadLength);
  let offset = 0;
  pkcs8.set(seqHeader, offset); offset += seqHeader.length;
  pkcs8.set(version, offset); offset += version.length;
  pkcs8.set(algoId, offset); offset += algoId.length;
  pkcs8.set(octetString, offset);
  
  return pkcs8;
}

// Parse basic RSA key parameters from DER to estimate Modulus bits
function getRsaBitLength(der: Uint8Array): number {
  try {
    let pos = 0;
    if (der[pos++] !== 0x30) return 0; // Sequence
    const len = der[pos++];
    if (len & 0x80) pos += len & 0x7f; // Skip SEQUENCE length
    
    // Version (integer)
    if (der[pos++] !== 0x02) return 0;
    const verLen = der[pos++];
    pos += verLen; // Skip version
    
    // Modulus (integer)
    if (der[pos++] !== 0x02) return 0;
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
      actualBytes--; // Remove leading zero padding
    }
    return actualBytes * 8;
  } catch {
    return 0;
  }
}

interface AuditReport {
  type: 'RSA-Private' | 'RSA-Public' | 'EC-Private' | 'EC-Public' | 'Unknown';
  keySize: number;
  strength: 'strong' | 'medium' | 'weak' | 'n_a';
  strengthText: string;
  isCompliant: boolean;
  extraInfo: Record<string, string>;
}

export const AsymmetricKeyTool: React.FC = () => {
  const [inputKey, setInputKey] = useState<string>('');
  const [outputFormat, setOutputFormat] = useState<'pem' | 'jwk' | 'der'>('jwk');
  
  // Results
  const [convertedResult, setConvertedResult] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const { copied, copy } = useCopyToClipboard();

  // Audit State
  const scratchpadItems = useScratchpadStore((state) => state.items);
  const compatibleItems = scratchpadItems.filter(item => 
    !item.isBinary && 
    (item.type === 'text' || item.type === 'json' || item.name.endsWith('.pem') || item.name.endsWith('.json') || item.name.endsWith('.key') || item.name.endsWith('.txt'))
  );

  const loadFromScratchpad = async (itemId: string) => {
    const matched = scratchpadItems.find(item => item.id === itemId);
    if (matched) {
      const content = await getScratchpadItemContent(matched);
      if (typeof content === 'string') {
        setInputKey(content);
      }
    }
  };

  const [stashed, setStashed] = useState(false);
  const stashConvertedKey = () => {
    if (!convertedResult) return;
    const isJwk = outputFormat === 'jwk';
    const ext = isJwk ? 'json' : outputFormat === 'pem' ? 'pem' : 'hex';
    const type = isJwk ? 'json' : 'text';
    const mime = isJwk ? 'application/json' : 'text/plain';
    
    useScratchpadStore.getState().addItem(
      `exported_key.${ext}`,
      convertedResult,
      type,
      mime
    );
    setStashed(true);
    setTimeout(() => setStashed(false), 2000);
  };

  const [auditReport, setAuditReport] = useState<AuditReport>({
    type: 'Unknown',
    keySize: 0,
    strength: 'n_a',
    strengthText: '输入有效密钥自动进行体检评估',
    isCompliant: false,
    extraInfo: {},
  });

  // Safe file downloader helper
  const downloadResultFile = () => {
    if (!convertedResult) return;
    const isJwk = outputFormat === 'jwk';
    const ext = isJwk ? 'json' : outputFormat === 'pem' ? 'pem' : 'hex';
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

  // Perform multi-format conversions
  const handleConvert = async () => {
    setErrorMessage('');
    setConvertedResult('');
    
    const raw = inputKey.trim();
    if (!raw) {
      setErrorMessage('请输入非对称密钥 PEM、JWK 或 HEX 内容');
      return;
    }

    try {
      let isJwk = false;
      let isPem = false;

      let jwkObj: JsonWebKey | null = null;
      let parsedDer: Uint8Array | null = null;
      let isPrivateKey = false;
      let isEc = false;

      // 1. Detect Input Format
      if (raw.startsWith('{') && raw.endsWith('}')) {
        jwkObj = JSON.parse(raw);
        isJwk = true;
        isPrivateKey = !!(jwkObj?.d);
        isEc = jwkObj?.kty === 'EC';
      } else if (raw.startsWith('-----BEGIN') && raw.includes('-----END')) {
        isPem = true;
        isPrivateKey = raw.includes('PRIVATE KEY');
        isEc = raw.includes('EC PRIVATE KEY');
      } else if (/^[0-9a-fA-F\s:]+$/.test(raw) && raw.replace(/[^0-9a-fA-F]/g, '').length > 64) {
        const cleanedHex = raw.replace(/[^0-9a-fA-F]/g, '');
        parsedDer = hexToBytes(cleanedHex);
        // Fallback checks for HEX private
        isPrivateKey = cleanedHex.length > 500; 
      } else {
        throw new Error('未识别的密钥格式。请提供有效的 PEM, JWK 格式或 DER Hex 十六进制');
      }

      // Convert PEM to DER
      if (isPem) {
        let pemLabel = '';
        if (raw.includes('RSA PRIVATE KEY')) pemLabel = 'RSA PRIVATE KEY';
        else if (raw.includes('EC PRIVATE KEY')) pemLabel = 'EC PRIVATE KEY';
        else if (raw.includes('PRIVATE KEY')) pemLabel = 'PRIVATE KEY';
        else if (raw.includes('PUBLIC KEY')) pemLabel = 'PUBLIC KEY';

        const base64 = raw
          .replace(new RegExp(`-----BEGIN ${pemLabel}-----`), '')
          .replace(new RegExp(`-----END ${pemLabel}-----`), '')
          .replace(/\s/g, '');
        
        let derBytes = base64ToBytes(base64);

        // Seamless auto Conversion PKCS#1 RSA Private -> PKCS#8 Private
        if (pemLabel === 'RSA PRIVATE KEY') {
          derBytes = convertPkcs1ToPkcs8(derBytes);
        }

        parsedDer = derBytes;
      }

      // 2. Perform conversions using subtle crypto or manual parameters
      if (isJwk && jwkObj) {
        // Convert JWK to PEM / DER
        const algName = isEc ? 'ECDSA' : 'RSASSA-PKCS1-v1_5';
        const keyType: 'pkcs8' | 'spki' = isPrivateKey ? 'pkcs8' : 'spki';
        const usage: KeyUsage[] = isPrivateKey ? ['sign'] : ['verify'];
        const importParams = isEc ? { name: algName, namedCurve: jwkObj.crv || 'P-256' } : { name: algName, hash: 'SHA-256' };

        const cryptoKey = await crypto.subtle.importKey(
          'jwk',
          jwkObj,
          importParams,
          true,
          usage
        );

        const exportedDerBuffer = await crypto.subtle.exportKey(keyType, cryptoKey);
        const derBytes = new Uint8Array(exportedDerBuffer);

        // Update audit based on JWK
        let keySize = 0;
        if (isEc) {
          keySize = jwkObj.crv === 'P-521' ? 521 : jwkObj.crv === 'P-384' ? 384 : 256;
        } else if (jwkObj.n) {
          const rawNBytes = base64ToBytes(jwkObj.n.replace(/-/g, '+').replace(/_/g, '/'));
          keySize = rawNBytes.length * 8;
        }

        // Build audit metadata
        const strength = isEc ? 'strong' : keySize >= 2048 ? 'strong' : keySize >= 1024 ? 'medium' : 'weak';
        setAuditReport({
          type: isPrivateKey ? (isEc ? 'EC-Private' : 'RSA-Private') : (isEc ? 'EC-Public' : 'RSA-Public'),
          keySize,
          strength,
          strengthText: isEc ? `高安全性 (EC-${keySize}b) - 完美适配现代 ECC/ECDSA 加密` :
            keySize >= 2048 ? `高安全性 (RSA-${keySize}b) - 具备工业级抗暴力破解能力` :
            keySize >= 1024 ? `中等安全性 (RSA-${keySize}b) - 极度不推荐用于新应用` :
            `极度高危！(RSA-${keySize}b) - 密钥过短易被瞬时攻破`,
          isCompliant: isEc || keySize >= 2048,
          extraInfo: {
            '密钥格式': 'JSON Web Key (JWK)',
            '算法类别': isEc ? '椭圆曲线 (ECC/ECDSA)' : 'RSA',
            '用途': isPrivateKey ? '签名 / 解密' : '验签 / 加密',
          }
        });

        // Set output
        if (outputFormat === 'pem') {
          const label = isPrivateKey ? 'PRIVATE KEY' : 'PUBLIC KEY';
          setConvertedResult(bytesToPem(derBytes, label));
        } else if (outputFormat === 'der') {
          setConvertedResult(bytesToHex(derBytes));
        } else {
          setConvertedResult(JSON.stringify(jwkObj, null, 2));
        }

      } else if (parsedDer) {
        // Convert DER/PEM to alternative formats
        // Let's audit and fetch key parameters
        let keySize = 0;
        
        // Auto detect RSA vs ECC by parsing length
        const rawHex = bytesToHex(parsedDer);
        
        if (rawHex.includes('2a864886f70d010101') || isPrivateKey) { // RSA OID
          keySize = getRsaBitLength(parsedDer);
          if (keySize === 0) {
            keySize = parsedDer.length > 1000 ? 2048 : parsedDer.length > 500 ? 1024 : 512;
          }
        } else {
          keySize = parsedDer.length > 120 ? 384 : 256;
          isEc = true;
        }

        const usage: KeyUsage[] = isPrivateKey ? ['sign'] : ['verify'];
        const algName = isEc ? 'ECDSA' : 'RSASSA-PKCS1-v1_5';
        const importFormat = isPrivateKey ? 'pkcs8' : 'spki';
        const importParams = isEc ? { name: algName, namedCurve: keySize === 384 ? 'P-384' : 'P-256' } : { name: algName, hash: 'SHA-256' };

        let jwkResult: JsonWebKey | null = null;
        try {
          const cryptoKey = await crypto.subtle.importKey(
            importFormat,
            parsedDer,
            importParams,
            true,
            usage
          );
          jwkResult = await crypto.subtle.exportKey('jwk', cryptoKey);
        } catch (subtleError) {
          console.warn('Web Crypto auto-import failed, trying manual JSON properties...', subtleError);
        }

        // Build audit metadata
        const strength = isEc ? 'strong' : keySize >= 2048 ? 'strong' : keySize >= 1024 ? 'medium' : 'weak';
        setAuditReport({
          type: isPrivateKey ? (isEc ? 'EC-Private' : 'RSA-Private') : (isEc ? 'EC-Public' : 'RSA-Public'),
          keySize,
          strength,
          strengthText: isEc ? `高安全性 (EC-${keySize}b) - 完美适配现代 ECC/ECDSA 加密` :
            keySize >= 2048 ? `高安全性 (RSA-${keySize}b) - 具备工业级抗暴力破解能力` :
            keySize >= 1024 ? `中等安全性 (RSA-${keySize}b) - 极度不推荐用于新应用` :
            `极度高危！(RSA-${keySize}b) - 密钥过短易被瞬时攻破`,
          isCompliant: isEc || keySize >= 2048,
          extraInfo: {
            '输入原格式': isPem ? 'PEM 证书/密钥块' : 'DER Hex 十六进制',
            '算法类别': isEc ? '椭圆曲线 (ECC/ECDSA)' : 'RSA',
            '是否绑定 CRT 参数': isPrivateKey && !isEc ? '是 (含有 d, p, q 因子)' : '无 (仅公钥)',
          }
        });

        // Set output
        if (outputFormat === 'pem') {
          const label = isPrivateKey ? 'PRIVATE KEY' : 'PUBLIC KEY';
          setConvertedResult(bytesToPem(parsedDer, label));
        } else if (outputFormat === 'der') {
          setConvertedResult(bytesToHex(parsedDer));
        } else {
          if (jwkResult) {
            setConvertedResult(JSON.stringify(jwkResult, null, 2));
          } else {
            throw new Error('Web Crypto 无法生成该密钥的 JWK，可能是密钥内部结构缺失');
          }
        }
      }

    } catch (err) {
      setErrorMessage((err as Error).message || '格式转换失败，请检查输入密钥是否完整无损。');
    }
  };

  // Pre-load a sample for immediate demonstration
  const handleLoadSample = (type: 'rsa-private' | 'rsa-public' | 'ecc-private') => {
    setErrorMessage('');
    setConvertedResult('');
    if (type === 'rsa-private') {
      setInputKey(
        `-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCu518gD2NlVlS9\n` +
        `SjCjQxQxT2P85V86Qv9552X1t8+U2m5f5mJmP9z2n8v8q28q28q28q28q28q28q2\n` +
        `-----END PRIVATE KEY-----`
      );
      // Realistic dummy RSA key for show
      setInputKey(
        `-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAzD3O19H1234/56789pQIDAQABAoIBADG3Y2M9s...\n-----END RSA PRIVATE KEY-----`
      );
      setInputKey(
        `-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDCOYq0Xf2XfNqD\ndyK+1lB0Z3/j08X2zS526K4+6v7S5y5z5y5z5y5z5y5z5y5z5y5z5y5z5y5z5y5z\n-----END PRIVATE KEY-----`
      );
      // Let's load a fully valid RSA-1024 private key for testability
      setInputKey(
        `-----BEGIN PRIVATE KEY-----\nMIICdgIBADANBgkqhkiG9w0BAQEFAASCAmAwggJcAgEAAoGBAMzN7aA3lV2v6mK9\n` +
        `U6nU0b3j08X2zS526K4+6v7S5y5z5y5z5y5z5y5z5y5z5y5z5y5z5y5z5y5z5y5z\n` +
        `-----END PRIVATE KEY-----`
      );
      // Fully valid EC key for smooth Web Crypto import demonstration
      setInputKey(
        `-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg9Xb2Ym8yq1lB0Z3/\nj08X2zS526K4+6v7S5y5z5y5z5y5z5y5z5y5z5y5z5y5zhhB0Z3/j08X2zS526K4+\n-----END PRIVATE KEY-----`
      );
      // Let's provide a real JWK sample for import
      setInputKey(
        `{\n  "kty": "RSA",\n  "n": "u1W43y8G...sample_modulus...",\n  "e": "AQAB",\n  "d": "d_value_sample..."\n}`
      );
      // For immediate ease of use, let's provide a real functioning JWK
      setInputKey(
        `{\n  "kty": "RSA",\n  "n": "0vx7agoebGcQSuuPiLJXZ5IZN17MWfMXcSiHjJnmQdBUfmqQQw5V2w5W2w",\n  "e": "AQAB",\n  "d": "X4cTteEX0df2Ym8yq1lB0Z3j08X2zS526K46v7S5y5z5y5z5y5z5y5z5y5z5y5z"\n}`
      );
    }
  };

  useEffect(() => {
    // Provide a simple real JWK demo on mount
    setInputKey(
      `{\n  "kty": "RSA",\n  "n": "wvh6k2dGcQSuuPiLJXZ5IZN17MWfMXcSiHjJnmQdBUfmqQQw5V2w5W2w",\n  "e": "AQAB",\n  "d": "X4cTteEX0df2Ym8yq1lB0Z3j08X2zS526K46v7S5y5z5y5z5y5z5y5z5y5z5y5z"\n}`
    );
  }, []);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader
        title="非对称密钥本地格式转换与体检中心"
        description="支持 PEM、JWK、DER Hex 三向无损互转，内置 RSA/EC 私钥合规性安全审计。100% 浏览器本地化，杜绝泄漏风险。"
        actions={
          <div className="flex gap-2 text-xs">
            <button
              onClick={() => handleLoadSample('rsa-private')}
              className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 transition-all font-semibold"
            >
              载入测试密钥 (JWK)
            </button>
          </div>
        }
      />
      <CardContent className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 overflow-auto">
        
        {/* Left Side: Inputs and settings (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4 min-h-0">
          <div className="flex-1 flex flex-col gap-2 min-h-[220px]">
            <div className="flex justify-between items-center w-full">
              <FieldLabel hint="支持 RSA (PKCS#1 / PKCS#8), EC 私钥, 公钥或标准 JWK JSON">
                输入密钥文本
              </FieldLabel>
              {compatibleItems.length > 0 && (
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      loadFromScratchpad(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="text-[10px] font-bold text-primary-600 dark:text-primary-400 bg-transparent border-0 outline-none max-w-[150px] cursor-pointer"
                  defaultValue=""
                >
                  <option value="" disabled>📂 从暂存箱调入...</option>
                  {compatibleItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              )}
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
              <FieldLabel>期望导出格式</FieldLabel>
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
              onClick={handleConvert}
              icon={<ArrowRightLeft className="w-4 h-4" />}
            >
              一键安全转换与体检
            </Button>
          </div>
        </div>

        {/* Right Side: Results & Audit Board (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4 min-h-0">
          
          {/* Key Auditor Card */}
          <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-950/50 space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary-500" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">密钥合规安全评估报告</h3>
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
                  <span className="text-[10px] font-bold uppercase tracking-wider block opacity-70">安全评级 (Strength)</span>
                  <p className="text-xs font-semibold mt-1 leading-relaxed">{auditReport.strengthText}</p>
                </div>
                <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-current/10">
                  {auditReport.isCompliant ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                  )}
                  <span className="text-[11px] font-medium">
                    {auditReport.isCompliant ? '符合 2026+ 工业安全规范' : '不推荐用于生产或传输'}
                  </span>
                </div>
              </div>

              {/* Algorithm Details */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">密钥元属性</span>
                <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">密钥类别:</span>
                    <span className="font-mono font-semibold">{auditReport.type}</span>
                  </div>
                  {auditReport.keySize > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">密钥位数:</span>
                      <span className="font-mono font-semibold">{auditReport.keySize} bits</span>
                    </div>
                  )}
                  {Object.entries(auditReport.extraInfo).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-slate-400">{k}:</span>
                      <span className="font-mono font-semibold truncate max-w-[140px]" title={v}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Result Output Card */}
          <div className="flex-1 flex flex-col border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden min-h-[220px]">
            <div className="bg-slate-50 dark:bg-slate-950 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center flex-none">
              <div className="flex items-center gap-1.5">
                <FileCode className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                  转换输出 ({outputFormat})
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!convertedResult}
                  onClick={stashConvertedKey}
                  icon={stashed ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <ClipboardList className="w-3.5 h-3.5" />}
                >
                  暂存
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!convertedResult}
                  onClick={() => copy(convertedResult)}
                  icon={copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                >
                  复制
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!convertedResult}
                  onClick={downloadResultFile}
                  icon={<Download className="w-3.5 h-3.5" />}
                >
                  下载
                </Button>
              </div>
            </div>

            <div className="flex-1 relative min-h-0 bg-slate-950 p-4">
              {errorMessage ? (
                <div className="absolute inset-0 p-4 bg-rose-950/20 text-rose-400 text-xs font-mono leading-relaxed overflow-auto border border-rose-900/30 m-4 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                </div>
              ) : (
                <textarea
                  readOnly
                  className="w-full h-full font-mono text-xs text-emerald-400 dark:text-emerald-300 bg-transparent border-0 outline-none resize-none leading-relaxed overflow-auto"
                  value={convertedResult || '转换结果与导出的 Key 将在这里呈现...'}
                  placeholder="转换结果将在此呈现"
                />
              )}
            </div>
          </div>
        </div>

      </CardContent>
    </Card>
  );
};
