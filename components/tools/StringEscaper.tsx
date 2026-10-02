import { translateUi as tr, useLocaleRender } from '../../src/i18n/render';
import { useDraftState } from './shared/useDraftState';
import React, { useEffect, useState, useRef } from 'react';
import { ShieldAlert, FileUp, Binary } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { ScratchpadPicker, isScratchpadTextLike } from './shared/ScratchpadControls';
import { useScratchpadStore } from './shared/scratchpadStore';
import { notifyToast } from './shared/notifyToast';
import { Button } from '../ui/Button';
import { ContentEditor, ContentToolbar } from './shared/ContentWorkflow';

type DecodeMode = 'base64' | 'url' | 'html' | 'unicode' | 'hex';

// Safe UTF-8 Base64 Encoder
const safeBtoa = (str: string): string => {
  try {
    return window.btoa(unescape(encodeURIComponent(str)));
  } catch {
    return '';
  }
};

const safeUrlEncode = (value: string) => { try { return encodeURIComponent(value); } catch { return ''; } };
const decodeHtmlEntities = (value: string) => value.replace(/&(?:#[0-9]+|#x[0-9a-f]+|[a-z][a-z0-9]+);/gi, entity => {
  const element = document.createElement('textarea');
  element.innerHTML = entity;
  return element.value;
});
const decodeCharacterEscapes = (value: string, mode: 'unicode' | 'hex') => {
  if (mode === 'hex') {
    if (/\\x(?![0-9a-f]{2})/i.test(value)) throw new Error('Invalid Hex escape');
    return value.replace(/\\x([0-9a-f]{2})/gi, (_, group) => String.fromCharCode(parseInt(group, 16)));
  }
  if (/\\u(?![0-9a-f]{4}|\{[0-9a-f]{1,6}\})/i.test(value)) throw new Error('Invalid Unicode escape');
  return value.replace(/\\u(?:\{([0-9a-f]{1,6})\}|([0-9a-f]{4}))/gi, (_, point, unit) => {
    const code = parseInt(point || unit, 16);
    if (code > 0x10ffff) throw new Error('Unicode code point out of range');
    return point ? String.fromCodePoint(code) : String.fromCharCode(code);
  });
};

// HTML Entities Encoder
const escapeHtml = (str: string): string => {
  return str.replace(/[&<>"']/g, (m) => {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#039;';
      default: return m;
    }
  });
};

// Unicode Escaper
const escapeUnicode = (str: string): string => {
  return str.split('').map(char => {
    const code = char.charCodeAt(0);
    return '\\u' + code.toString(16).padStart(4, '0');
  }).join('');
};

// Hex Escaper
const escapeHex = (str: string): string => {
  if (Array.from(str).some(char => char.charCodeAt(0) > 255)) return '';
  return str.split('').map(char => {
    const code = char.charCodeAt(0);
    return '\\x' + code.toString(16).padStart(2, '0');
  }).join('');
};

// Chinese high-frequency sensitive data offline mask-masking engine
const maskSensitiveData = (text: string): string => {
  let result = text;

  // 1. Phone number
  result = result.replace(/\b(1[3-9]\d)(\d{4})(\d{4})\b/g, '$1****$3');

  // 2. ID Card
  result = result.replace(/\b(\d{6})\d{8,11}(\d{4}|\d{3}[Xx])\b/g, '$1********$2');

  // 3. Bank Card
  result = result.replace(/\b(\d{6})\d{6,9}(\d{4})\b/g, (match, p1, p2) => {
    const maskLen = match.length - 10;
    return p1 + '*'.repeat(maskLen) + p2;
  });

  // 4. Email
  result = result.replace(/\b([a-zA-Z0-9._%+-])([a-zA-Z0-9._%+-]*)([a-zA-Z0-9._%+-])@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g, (match, first, middle, last, domain) => {
    return first + '*'.repeat(Math.max(3, middle.length)) + last + '@' + domain;
  });

  // 5. Chinese Name
  const surnames = '赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳酆鲍史唐费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮卞齐康伍余元卜顾孟平黄和穆萧尹姚邵湛汪祁毛禹狄米贝明臧计伏成戴谈宋茅庞熊纪舒屈项祝董梁杜阮蓝闵席季麻强贾路娄危江童颜郭梅盛林刁钟徐邱骆高夏蔡田樊胡凌霍虞万支柯昝管卢莫经房裘缪干解应宗丁宣贲邓郁单杭洪包诸左石崔吉钮龚程嵇邢滑裴陆荣翁';
  const doubleSurnames = '欧阳|司马|上官|闾丘|令狐|夏侯|诸葛|尉迟|皇甫|公孙';
  
  const nameRegex = new RegExp(`(${doubleSurnames}|[${surnames}])([\u4e00-\u9fa5]{1,2})`, 'g');
  result = result.replace(nameRegex, (match) => {
    if (match.length === 2) {
      return match[0] + '*';
    } else if (match.length === 3) {
      return match[0] + '*' + match[2];
    } else if (match.length === 4) {
      return match[0] + '**' + match[3];
    }
    return match;
  });

  return result;
};

// Magic Number Detector for Hex Viewer
const detectMagicMime = (bytes: Uint8Array): { mime: string; label: string } => {
  if (bytes.length < 4) return { mime: 'application/octet-stream', label: '未知二进制文件' };
  
  const hex = Array.from(bytes.slice(0, 8))
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
  
  if (hex.startsWith('89 50 4E 47 0D 0A 1A 0A')) return { mime: 'image/png', label: 'PNG 图像文件' };
  if (hex.startsWith('FF D8 FF')) return { mime: 'image/jpeg', label: 'JPEG 图像文件' };
  if (hex.startsWith('47 49 46 38')) return { mime: 'image/gif', label: 'GIF 动画图像' };
  if (hex.startsWith('25 50 44 46')) return { mime: 'application/pdf', label: 'PDF 文档' };
  if (hex.startsWith('50 4B 03 04')) return { mime: 'application/zip', label: 'ZIP 压缩归档 (或 Office OpenXML Word/Excel)' };
  if (hex.startsWith('7B')) return { mime: 'application/json', label: 'JSON 数据文本' };
  if (hex.startsWith('3C 21 44 4F') || hex.startsWith('3C 68 74 6D')) return { mime: 'text/html', label: 'HTML 网页文本' };
  if (hex.startsWith('4D 5A')) return { mime: 'application/x-msdownload', label: 'Windows 可执行文件 (EXE/DLL)' };
  if (hex.startsWith('1F 8B')) return { mime: 'application/gzip', label: 'GZIP 压缩归档' };
  if (hex.startsWith('52 61 72 21')) return { mime: 'application/x-rar-compressed', label: 'RAR 压缩归档' };
  if (hex.startsWith('7F 45 4C 46')) return { mime: 'application/x-elf', label: 'ELF 可执行文件' };
  if (hex.startsWith('CA FE BA BE')) return { mime: 'application/java-class', label: 'Java 字节码 Class 文件' };
  if (hex.startsWith('23 21')) return { mime: 'text/x-shellscript', label: 'Shell 脚本文件' };
  
  return { mime: 'application/octet-stream', label: '未知二进制文件' };
};

const DEFAULT_INPUT = '测试客户姓名: 张三丰, 电话: 13812345678, 邮箱: example123@gmail.com, 身份证: 110101199003072345';

export const StringEscaper: React.FC = () => {
  useLocaleRender();
  const [activeTab, setActiveTab] = useState<'cascade' | 'decoder' | 'hexViewer'>('cascade');
  const [input, setInput] = useDraftState('components/tools/StringEscaper.tsx:StringEscaper:input', '');
  const [selectedEncoding, setSelectedEncoding] = useState<'b64' | 'url' | 'html' | 'unicode' | 'hex'>('html');
  const [maskPreview, setMaskPreview] = useState<string | null>(null);
  
  // Local values initialized dynamically to match default input
  const [b64Val, setB64Val] = useState(() => safeBtoa(input));
  const [urlVal, setUrlVal] = useState(() => safeUrlEncode(input));
  const [htmlVal, setHtmlVal] = useState(() => escapeHtml(input));
  const [unicodeVal, setUnicodeVal] = useState(() => escapeUnicode(input));
  const [hexVal, setHexVal] = useState(() => escapeHex(input));

  const [errors, setErrors] = useState<Record<string, boolean>>({});

  // Centralized synchronization helper
  const updateInputAndSync = (val: string) => {
    setInput(val);
    setMaskPreview(null);
    setB64Val(safeBtoa(val));
    setUrlVal(safeUrlEncode(val));
    setHtmlVal(escapeHtml(val));
    setUnicodeVal(escapeUnicode(val));
    setHexVal(escapeHex(val));
    setErrors({ b64: Boolean(val && !safeBtoa(val)), url: Boolean(val && !safeUrlEncode(val)), hex: Boolean(val && !escapeHex(val)) });
  };

  // Bidirectional Cascading Change Handler
  const handleFieldEdit = (field: 'b64' | 'url' | 'html' | 'unicode' | 'hex', val: string) => {
    if (field === 'b64') setB64Val(val);
    else if (field === 'url') setUrlVal(val);
    else if (field === 'html') setHtmlVal(val);
    else if (field === 'unicode') setUnicodeVal(val);
    else if (field === 'hex') setHexVal(val);

    if (val === '') {
      setInput('');
      setErrors(prev => ({ ...prev, [field]: false }));
      if (field !== 'b64') setB64Val('');
      if (field !== 'url') setUrlVal('');
      if (field !== 'html') setHtmlVal('');
      if (field !== 'unicode') setUnicodeVal('');
      if (field !== 'hex') setHexVal('');
      return;
    }

    try {
      let decoded = '';
      if (field === 'b64') {
        decoded = decodeURIComponent(escape(window.atob(val)));
      } else if (field === 'url') {
        decoded = decodeURIComponent(val);
      } else if (field === 'html') decoded = decodeHtmlEntities(val);
      else decoded = decodeCharacterEscapes(val, field);
      updateInputAndSync(decoded);
      if (field === 'b64') setB64Val(val);
      else if (field === 'url') setUrlVal(val);
      else if (field === 'html') setHtmlVal(val);
      else if (field === 'unicode') setUnicodeVal(val);
      else setHexVal(val);
    } catch {
      setErrors(prev => ({ ...prev, [field]: true }));
    }
  };

  // Manual Decoder States
  const [decodeInput, setDecodeInput] = useDraftState('components/tools/StringEscaper.tsx:StringEscaper:decodeInput', '');
  const [decodeMode, setDecodeMode] = useDraftState<DecodeMode>('components/tools/StringEscaper.tsx:StringEscaper:decodeMode', 'base64');
  const [decodeOutput, setDecodeOutput] = useState('');
  const [decodeError, setDecodeError] = useState('');

  const handleDecode = () => {
    setDecodeError('');
    try {
      if (decodeMode === 'base64') {
        setDecodeOutput(decodeURIComponent(escape(window.atob(decodeInput))));
      } else if (decodeMode === 'url') {
        setDecodeOutput(decodeURIComponent(decodeInput));
      } else if (decodeMode === 'html') setDecodeOutput(decodeHtmlEntities(decodeInput));
      else setDecodeOutput(decodeCharacterEscapes(decodeInput, decodeMode));
    } catch {
      setDecodeOutput('');
      setDecodeError('解码失败，请检查输入格式是否正确。');
    }
  };

  const handleMask = () => {
    setMaskPreview(maskSensitiveData(input));
  };

  // --- Hex Viewer States & Handlers ---
  const [hexFile, setHexFile] = useState<File | null>(null);
  const [hexBytes, setHexBytes] = useState<Uint8Array | null>(null);
  const [detectedMeta, setDetectedMeta] = useState<{ mime: string; label: string }>({ mime: '', label: '' });
  const [hexPage, setHexPage] = useState(0);
  const [hoveredByteIndex, setHoveredByteIndex] = useState<number | null>(null);
  const bytesPerPage = 256;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hexReader = useRef<FileReader | null>(null);
  useEffect(() => () => hexReader.current?.abort(), []);
  const loadFileBytes = (file: File) => {
    if (file.size > 10 * 1024 * 1024) { notifyToast({ title: '文件过大', description: '最大支持 10 MB 文件。', tone: 'error' }); return; }
    hexReader.current?.abort();
    const reader = new FileReader();
    hexReader.current = reader;
    reader.onload = () => {
      if (hexReader.current !== reader || !(reader.result instanceof ArrayBuffer)) return;
      const bytes = new Uint8Array(reader.result);
      setHexFile(file); setHexPage(0); setHoveredByteIndex(null);
      setHexBytes(bytes); setDetectedMeta(detectMagicMime(bytes));
    };
    reader.onerror = () => { if (hexReader.current === reader) notifyToast({ title: '文件读取失败', description: reader.error?.message, tone: 'error' }); };
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      loadFileBytes(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      loadFileBytes(e.dataTransfer.files[0]);
    }
  };

  const clearHexFile = () => {
    hexReader.current?.abort(); hexReader.current = null;
    setHexFile(null);
    setHexBytes(null);
    setDetectedMeta({ mime: '', label: '' });
    setHexPage(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Send Hex raw/dump to Scratchpad Cabinet (Stage 4 setup)
  const sendHexToScratchpad = async () => {
    if (!hexBytes || !hexFile) return;
    try {
      // Build standard Hex string representation
      const maxDumpLength = 20000;
      let hexDump = '';
      const dumpLen = Math.min(hexBytes.length, maxDumpLength);
      for (let i = 0; i < dumpLen; i++) {
        hexDump += hexBytes[i].toString(16).padStart(2, '0').toUpperCase() + ' ';
        if ((i + 1) % 16 === 0) hexDump += '\n';
      }
      if (hexBytes.length > maxDumpLength) {
        hexDump += `\n... [数据过大，已截断前 ${maxDumpLength} 字节]`;
      }
      
      await useScratchpadStore.getState().addItemAsync({
        name: `hex-${hexFile.name}.txt`,
        content: hexDump.trim(),
        type: 'text',
        mimeType: 'text/plain',
        sourceTool: '字符串转义 / Hex 倾倒',
        originAction: 'hex-dump',
      });
      notifyToast({ title: 'Hex 倾倒文本已送入暂存箱', tone: 'success' });
    } catch (err) {
      notifyToast({
        title: '送入暂存箱失败',
        description: err instanceof Error ? err.message : '浏览器本地存储不可用，请清理空间后重试。',
        tone: 'error',
      });
    }
  };

  // Process rows for current page of hex bytes
  const renderHexRows = () => {
    if (!hexBytes) return null;
    const startIdx = hexPage * bytesPerPage;
    const endIdx = Math.min(startIdx + bytesPerPage, hexBytes.length);
    const rows = [];

    for (let i = startIdx; i < endIdx; i += 16) {
      const rowBytes = Array.from(hexBytes.slice(i, i + 16));
      rows.push({
        offset: i,
        bytes: rowBytes
      });
    }

    return rows.map((row) => {
      return (
        <div key={row.offset} className="flex items-center hover:bg-slate-900/40 py-0.5 border-b border-slate-950 font-mono text-xs">
          {/* Offset Column */}
          <div className="w-20 text-slate-500 font-bold select-none text-[11px] tracking-wide shrink-0">
            {row.offset.toString(16).padStart(8, '0').toUpperCase()}
          </div>

          {/* Hex Bytes Column */}
          <div className="flex gap-1.5 px-3 border-r border-slate-800 shrink-0">
            {Array.from({ length: 16 }).map((_, colIdx) => {
              const byte = row.bytes[colIdx];
              const absIdx = row.offset + colIdx;
              const hasByte = byte !== undefined;
              const isHovered = hoveredByteIndex === absIdx;

              return (
                <span
                  key={colIdx}
                  onMouseEnter={() => hasByte && setHoveredByteIndex(absIdx)}
                  onMouseLeave={() => setHoveredByteIndex(null)}
                  className={`w-6 h-6 flex items-center justify-center rounded text-[11px] select-none transition-all cursor-default ${
                    !hasByte ? 'opacity-0' :
                    isHovered ? 'bg-primary-500 text-white font-bold scale-110 shadow' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {hasByte ? byte.toString(16).padStart(2, '0').toUpperCase() : '  '}
                </span>
              );
            })}
          </div>

          {/* ASCII Characters Column */}
          <div className="flex gap-1 px-3 grow overflow-hidden select-none">
            {Array.from({ length: 16 }).map((_, colIdx) => {
              const byte = row.bytes[colIdx];
              const absIdx = row.offset + colIdx;
              const hasByte = byte !== undefined;
              const isHovered = hoveredByteIndex === absIdx;
              let char = '.';
              if (hasByte && byte >= 32 && byte <= 126) {
                char = String.fromCharCode(byte);
              }

              return (
                <span
                  key={colIdx}
                  onMouseEnter={() => hasByte && setHoveredByteIndex(absIdx)}
                  onMouseLeave={() => setHoveredByteIndex(null)}
                  className={`w-3.5 h-6 flex items-center justify-center rounded text-[11px] transition-all cursor-default ${
                    !hasByte ? 'opacity-0' :
                    isHovered ? 'bg-primary-500 text-white font-bold scale-110 shadow' : 'text-emerald-500 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {hasByte ? char : ' '}
                </span>
              );
            })}
          </div>
        </div>
      );
    });
  };

  const totalPages = hexBytes ? Math.max(1, Math.ceil(hexBytes.length / bytesPerPage)) : 0;

  const encodings = [
    { label: 'Base64', value: b64Val, id: 'b64' as const },
    { label: tr('URL 编码'), value: urlVal, id: 'url' as const },
    { label: tr('HTML 实体'), value: htmlVal, id: 'html' as const },
    { label: 'Unicode \\u', value: unicodeVal, id: 'unicode' as const },
    { label: 'Hex \\x', value: hexVal, id: 'hex' as const },
  ];
  const encoding = encodings.find(item => item.id === selectedEncoding)!;
  const clearDecoder = () => { setDecodeInput(''); setDecodeOutput(''); setDecodeError(''); };
  return <Card className="flex h-full min-h-0 flex-col"><CardContent className="min-h-0 flex-1 space-y-4 overflow-auto">
    <div className="flex flex-wrap gap-2 border-b pb-3">{[{ id: 'cascade' as const, label: tr('编码与转义') }, { id: 'decoder' as const, label: tr('解码与还原') }, { id: 'hexViewer' as const, label: tr('文件字节') }].map(tab => <Button key={tab.id} size="sm" variant={activeTab === tab.id ? 'primary' : 'ghost'} onClick={() => setActiveTab(tab.id)}>{tab.label}</Button>)}</div>
    {activeTab === 'cascade' ? <div className="space-y-4">
      <ContentToolbar onSample={() => updateInputAndSync(DEFAULT_INPUT)} onClear={() => updateInputAndSync('')} status="双向实时同步"><label className="flex items-center gap-2 text-sm">{tr("输出编码")}<select aria-label={tr("输出编码")} className="rounded-lg border p-2" value={selectedEncoding} onChange={event => setSelectedEncoding(event.target.value as typeof selectedEncoding)}>{encodings.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><Button size="sm" variant="secondary" onClick={handleMask} disabled={!input} icon={<ShieldAlert className="h-4 w-4" />}>{tr("预览脱敏")}</Button></ContentToolbar>
      <div className="grid gap-4 lg:grid-cols-2"><ContentEditor label={tr("原始字符串")} value={input} onChange={updateInputAndSync} placeholder={tr("输入原始文本，或编辑右侧编码进行还原。")} /><ContentEditor label={`${encoding.label} 输出 · 可编辑`} value={encoding.value} onChange={value => handleFieldEdit(encoding.id, value)} output error={errors[encoding.id] ? '格式错误或解码失败，请检查当前编码。' : ''} placeholder={tr("编辑编码结果，会还原并同步原始文本。")} /></div>
      {selectedEncoding === 'hex' && Array.from(input).some(character => character.charCodeAt(0) > 255) && <p className="text-xs text-amber-700">{tr("Hex 转义仅适用于 U+0000–U+00FF；中文请选择 Unicode 转义。")}</p>}
      {maskPreview !== null && <div className="tool-panel space-y-3 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">{tr("脱敏预览")}</span><div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => setMaskPreview(null)}>{tr("取消")}</Button><Button size="sm" onClick={() => updateInputAndSync(maskPreview)}>{tr("应用脱敏结果")}</Button></div></div><pre className="whitespace-pre-wrap break-all font-mono text-xs">{maskPreview}</pre><p className="text-xs text-slate-500">{tr("规则可能误判人名；检查预览后再应用。")}</p></div>}
      <details className="tool-panel p-3"><summary className="cursor-pointer text-sm font-medium">{tr("比较全部编码 · 每个结果都可编辑")}</summary><div className="mt-3 grid gap-4 lg:grid-cols-2">{encodings.map(item => <ContentEditor key={item.id} label={item.label} value={item.value} onChange={value => handleFieldEdit(item.id, value)} output error={errors[item.id] ? '格式错误或解码失败。' : ''} />)}</div></details>
      <details><summary className="cursor-pointer text-xs text-slate-500">{tr("从暂存箱载入")}</summary><div className="mt-2"><ScratchpadPicker label={tr("原始文本")} placeholder={tr("从暂存箱载入...")} filter={isScratchpadTextLike} onLoad={async content => updateInputAndSync(typeof content === 'string' ? content : await new Blob([content]).text())} /></div></details>
    </div> : activeTab === 'decoder' ? <div className="space-y-4">
      <ContentToolbar onSample={() => { setDecodeMode('base64'); setDecodeInput('SGVsbG8sIOS4lueVjCE='); setDecodeOutput(''); setDecodeError(''); }} onClear={clearDecoder}><label className="flex items-center gap-2 text-sm">{tr("输入编码")}<select aria-label={tr("输入编码")} className="rounded-lg border p-2" value={decodeMode} onChange={event => { setDecodeMode(event.target.value as DecodeMode); setDecodeOutput(''); setDecodeError(''); }}><option value="base64">Base64</option><option value="url">URL</option><option value="html">{tr("HTML 实体")}</option><option value="unicode">Unicode</option><option value="hex">Hex</option></select></label><Button onClick={handleDecode} disabled={!decodeInput}>{tr("解码")}</Button></ContentToolbar>
      <div className="grid gap-4 lg:grid-cols-2"><ContentEditor label={tr("待解码字符串")} value={decodeInput} onChange={value => { setDecodeInput(value); setDecodeOutput(''); setDecodeError(''); }} error={decodeError} placeholder={tr("粘贴编码内容并选择对应的输入编码。")} /><ContentEditor label={tr("还原文本")} value={decodeOutput} output placeholder={tr("解码成功后显示原始文本。")} onUseResult={() => { updateInputAndSync(decodeOutput); setActiveTab('cascade'); }} /></div>
    </div> : <div className="space-y-4">
      {!hexBytes ? <div onDragOver={handleDragOver} onDrop={handleDrop} className="flex min-h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center"><FileUp className="mb-3 h-8 w-8 text-primary-500" /><h3 className="text-sm font-semibold">{tr("拖放文件查看字节")}</h3><p className="mt-2 text-xs text-slate-500">{tr("文件在浏览器本地解析。")}</p><Button className="mt-4" onClick={() => fileInputRef.current?.click()}>{tr("选择文件")}</Button><input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} /></div> : <>
        <ContentToolbar onClear={clearHexFile} status={`${hexBytes.length.toLocaleString()} 字节 · ${detectedMeta.label}`}><Binary className="h-4 w-4 text-primary-600" /><span className="min-w-0 break-all text-sm font-medium">{hexFile?.name}</span><Button size="sm" variant="secondary" onClick={sendHexToScratchpad}>{tr("暂存 Hex")}</Button></ContentToolbar>
        <div className="min-h-64 overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4"><div className="min-w-[760px]"><div className="mb-3 flex gap-6 border-b border-slate-700 pb-2 font-mono text-xs text-slate-400"><span className="w-20">{tr("偏移量")}</span><span className="w-[28rem]">{tr("十六进制字节")}</span><span>ASCII</span></div>{renderHexRows()}</div></div>
        {totalPages > 1 && <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-xs text-slate-500">{hexPage + 1} / {totalPages}</span><div className="flex gap-2"><Button size="sm" variant="secondary" disabled={hexPage === 0} onClick={() => setHexPage(page => Math.max(0, page - 1))}>{tr("上一页")}</Button><Button size="sm" variant="secondary" disabled={hexPage >= totalPages - 1} onClick={() => setHexPage(page => Math.min(totalPages - 1, page + 1))}>{tr("下一页")}</Button></div></div>}
      </>}
    </div>}
  </CardContent></Card>;
};
