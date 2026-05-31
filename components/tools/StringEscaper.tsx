import React, { useState, useRef } from 'react';
import { Copy, Check, ShieldAlert, ArrowLeftRight, Sparkles, RefreshCw, FileUp, Binary, ChevronLeft, ChevronRight, FileCode } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { ScratchpadPicker, isScratchpadTextLike } from './shared/ScratchpadControls';

type DecodeMode = 'base64' | 'url' | 'html' | 'unicode' | 'hex';

// Safe UTF-8 Base64 Encoder
const safeBtoa = (str: string): string => {
  try {
    return window.btoa(unescape(encodeURIComponent(str)));
  } catch {
    return '';
  }
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

// Clipboard Hook Helper
const useCopyToClipboard = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 1500);
  };
  return { copiedId, copy };
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
  const [activeTab, setActiveTab] = useState<'cascade' | 'decoder' | 'hexViewer'>('cascade');
  const [input, setInput] = useState(DEFAULT_INPUT);
  const { copiedId, copy } = useCopyToClipboard();
  
  // Local values initialized dynamically to match default input
  const [b64Val, setB64Val] = useState(() => safeBtoa(DEFAULT_INPUT));
  const [urlVal, setUrlVal] = useState(() => encodeURIComponent(DEFAULT_INPUT));
  const [htmlVal, setHtmlVal] = useState(() => escapeHtml(DEFAULT_INPUT));
  const [unicodeVal, setUnicodeVal] = useState(() => escapeUnicode(DEFAULT_INPUT));
  const [hexVal, setHexVal] = useState(() => escapeHex(DEFAULT_INPUT));

  const [errors, setErrors] = useState<Record<string, boolean>>({});

  // Centralized synchronization helper
  const updateInputAndSync = (val: string) => {
    setInput(val);
    setB64Val(safeBtoa(val));
    setUrlVal(encodeURIComponent(val));
    setHtmlVal(escapeHtml(val));
    setUnicodeVal(escapeUnicode(val));
    setHexVal(escapeHex(val));
    setErrors({});
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
      } else if (field === 'html') {
        const doc = new DOMParser().parseFromString(val, 'text/html');
        decoded = doc.documentElement.textContent || '';
      } else if (field === 'unicode') {
        decoded = val.replace(/\\u([\dA-F]{4})/gi, (_, grp) => 
          String.fromCharCode(parseInt(grp, 16))
        );
      } else if (field === 'hex') {
        decoded = val.replace(/\\x([\dA-F]{2})/gi, (_, grp) => 
          String.fromCharCode(parseInt(grp, 16))
        );
      }

      setInput(decoded);
      setErrors(prev => ({ ...prev, [field]: false }));

      // Sync other fields that are NOT currently being typed in
      if (field !== 'b64') setB64Val(safeBtoa(decoded));
      if (field !== 'url') setUrlVal(encodeURIComponent(decoded));
      if (field !== 'html') setHtmlVal(escapeHtml(decoded));
      if (field !== 'unicode') setUnicodeVal(escapeUnicode(decoded));
      if (field !== 'hex') setHexVal(escapeHex(decoded));
    } catch {
      setErrors(prev => ({ ...prev, [field]: true }));
    }
  };

  // Manual Decoder States
  const [decodeInput, setDecodeInput] = useState('');
  const [decodeMode, setDecodeMode] = useState<DecodeMode>('base64');
  const [decodeOutput, setDecodeOutput] = useState('');

  const handleDecode = () => {
    try {
      if (decodeMode === 'base64') {
        setDecodeOutput(decodeURIComponent(escape(window.atob(decodeInput))));
      } else if (decodeMode === 'url') {
        setDecodeOutput(decodeURIComponent(decodeInput));
      } else if (decodeMode === 'html') {
        const doc = new DOMParser().parseFromString(decodeInput, 'text/html');
        setDecodeOutput(doc.documentElement.textContent || '');
      } else if (decodeMode === 'unicode') {
        setDecodeOutput(decodeInput.replace(/\\u([\dA-F]{4})/gi, (_, grp) => 
          String.fromCharCode(parseInt(grp, 16))
        ));
      } else if (decodeMode === 'hex') {
        setDecodeOutput(decodeInput.replace(/\\x([\dA-F]{2})/gi, (_, grp) => 
          String.fromCharCode(parseInt(grp, 16))
        ));
      }
    } catch {
      setDecodeOutput('[错误: 解码失败，请检查输入格式是否正确]');
    }
  };

  const handleMask = () => {
    const masked = maskSensitiveData(input);
    updateInputAndSync(masked);
  };

  // --- Hex Viewer States & Handlers ---
  const [hexFile, setHexFile] = useState<File | null>(null);
  const [hexBytes, setHexBytes] = useState<Uint8Array | null>(null);
  const [detectedMeta, setDetectedMeta] = useState<{ mime: string; label: string }>({ mime: '', label: '' });
  const [hexPage, setHexPage] = useState(0);
  const [hoveredByteIndex, setHoveredByteIndex] = useState<number | null>(null);
  const bytesPerPage = 256;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFileBytes = (file: File) => {
    setHexFile(file);
    setHexPage(0);
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result instanceof ArrayBuffer) {
        const bytes = new Uint8Array(e.target.result);
        setHexBytes(bytes);
        setDetectedMeta(detectMagicMime(bytes));
      }
    };
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
    setHexFile(null);
    setHexBytes(null);
    setDetectedMeta({ mime: '', label: '' });
    setHexPage(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Send Hex raw/dump to Scratchpad Cabinet (Stage 4 setup)
  const sendHexToScratchpad = () => {
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
      
      const scratchEvent = new CustomEvent('add-scratchpad-item', {
        detail: {
          name: `hex-${hexFile.name}.txt`,
          content: hexDump.trim(),
          type: 'text'
        }
      });
      window.dispatchEvent(scratchEvent);
      alert('已成功将文件 Hex 倾倒文本送入全局暂存箱！');
    } catch {
      alert('送入暂存箱失败');
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

  const totalPages = hexBytes ? Math.ceil(hexBytes.length / bytesPerPage) : 0;

  return (
    <Card className="h-full flex flex-col min-h-0 bg-slate-900 border-slate-800 text-slate-100">
      <CardHeader
        title="五向级联转义与二进制极客中心"
        description="支持 5 编码双向级联转解、本地敏感数据一键离线脱敏掩码，以及高级本地二进制 Hex 查看器。"
        actions={
          <div className="flex gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 ${activeTab === 'cascade' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              onClick={() => setActiveTab('cascade')}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>实时双向级联</span>
            </button>
            <button
              className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 ${activeTab === 'decoder' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              onClick={() => setActiveTab('decoder')}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>单向反转义解码</span>
            </button>
            <button
              className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 ${activeTab === 'hexViewer' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              onClick={() => setActiveTab('hexViewer')}
            >
              <Binary className="w-3.5 h-3.5" />
              <span>极客 Hex 查看器</span>
            </button>
          </div>
        }
      />
      <CardContent className="flex-1 flex flex-col gap-5 overflow-auto p-6 min-h-0">
        
        {activeTab === 'cascade' ? (
          // Tab 1: Real-time Cascader and Sensitive Masking
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-0">
            
            {/* Left Column: Input and Data Masking Controls (5 cols equivalent) */}
            <div className="lg:col-span-5 flex flex-col gap-4 pr-0 lg:pr-3 lg:border-r lg:border-slate-800 min-h-[220px]">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-400 uppercase tracking-wider">输入原始字符串 (同步编辑)</span>
                <div className="flex items-center gap-2">
                  <ScratchpadPicker
                    placeholder="从暂存箱载入..."
                    filter={isScratchpadTextLike}
                    onLoad={content => {
                      if (typeof content === 'string') updateInputAndSync(content);
                    }}
                  />
                  <span className="text-slate-500 font-mono">{input.length} 字符</span>
                </div>
              </div>
              <textarea
                className="flex-1 w-full p-4 rounded-xl border border-slate-800 bg-slate-950 font-mono text-xs text-slate-300 focus:outline-none focus:border-primary-500 resize-none leading-relaxed transition-all min-h-[150px]"
                value={input}
                onChange={e => updateInputAndSync(e.target.value)}
                placeholder="输入文本，例如包含姓名、手机、银行卡、身份证等信息..."
              />
              <div className="grid grid-cols-2 gap-2.5 flex-none">
                <button
                  onClick={handleMask}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs select-none shadow-md transition-all active:scale-95 border border-rose-500"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>隐私脱敏掩码</span>
                </button>
                <button
                  onClick={() => updateInputAndSync('')}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs select-none shadow-md transition-all active:scale-95 border border-slate-700"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>清空</span>
                </button>
              </div>
              
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2.5 text-[10px] text-slate-400 flex-none leading-normal">
                <p className="font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  双向实时级联功能
                </p>
                <ul className="list-disc pl-4 space-y-1">
                  <li><strong>右侧任意卡片可直接修改</strong>，反解成功的字符串将实时回流至其它所有卡片。</li>
                  <li><strong>脱敏规则</strong>: 支持手机号、身份证、银行卡、电子邮箱及百家姓人名的本地精准脱敏。</li>
                  <li className="text-amber-500/90 font-semibold">100% 纯本地离线处理，保障数据与网络绝对安全隐私。</li>
                </ul>
              </div>
            </div>

            {/* Right Column: 5-way synchronized encodings (7 cols equivalent) */}
            <div className="lg:col-span-7 flex flex-col gap-4 overflow-y-auto pr-1">
              <span className="font-bold text-slate-400 uppercase tracking-wider text-xs block mb-1">
                五向实时可编辑转义卡片 (编辑卡片自动双向同步)
              </span>
              
              {[
                { label: 'Base64 编码 (Base64)', value: b64Val, id: 'b64' as const },
                { label: 'URL 编码 (Percent-Encoding)', value: urlVal, id: 'url' as const },
                { label: 'HTML 实体转义 (HTML Entities)', value: htmlVal, id: 'html' as const },
                { label: 'Unicode 转义 (Unicode \\u)', value: unicodeVal, id: 'unicode' as const },
                { label: 'Hex 字符转义 (Hex \\x)', value: hexVal, id: 'hex' as const }
              ].map(enc => {
                const isError = !!errors[enc.id];
                return (
                  <div 
                    key={enc.id} 
                    className={`p-3 border rounded-xl bg-slate-950/80 flex flex-col gap-2 relative group transition-colors ${
                      isError ? 'border-rose-500 hover:border-rose-400' : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{enc.label}</span>
                        {isError && (
                          <span className="text-[9px] bg-rose-950 border border-rose-800 text-rose-400 px-1.5 py-0.5 rounded font-bold">
                            格式错误/解码失败
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => copy(enc.value, enc.id)}
                        disabled={!enc.value}
                        className="p-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        {copiedId === enc.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      className="w-full font-mono text-xs text-emerald-400 bg-slate-900/40 p-2.5 rounded-lg border border-slate-900 focus:outline-none focus:border-primary-500 resize-none leading-relaxed"
                      value={enc.value}
                      onChange={e => handleFieldEdit(enc.id, e.target.value)}
                      placeholder="等待主输入框输入，或直接在此编辑修改..."
                    />
                  </div>
                );
              })}
            </div>

          </div>
        ) : activeTab === 'decoder' ? (
          // Tab 2: Manual Decoder Studio
          <div className="flex-1 flex flex-col gap-4 min-h-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-1/2 min-h-[160px]">
              <div className="flex flex-col min-h-0">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-xs mb-1">待解码的字符串</span>
                <textarea
                  className="flex-1 w-full p-4 rounded-xl border border-slate-800 bg-slate-950 font-mono text-xs text-slate-300 focus:outline-none focus:border-primary-500 resize-none leading-relaxed transition-all overflow-auto"
                  value={decodeInput}
                  onChange={e => setDecodeInput(e.target.value)}
                  placeholder="请输入需要解码反转义的文本段落..."
                />
              </div>
              <div className="flex flex-col min-h-0">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-xs mb-1">选择解码解析算法</span>
                <div className="p-4 border border-slate-800 rounded-xl bg-slate-950 flex flex-col justify-between flex-1">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {([
                      { value: 'base64', label: 'Base64 解码' },
                      { value: 'url', label: 'URL 解码' },
                      { value: 'html', label: 'HTML 实体还原' },
                      { value: 'unicode', label: 'Unicode 还原' },
                      { value: 'hex', label: 'Hex 还原' }
                    ] satisfies { value: DecodeMode; label: string }[]).map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setDecodeMode(opt.value)}
                        className={`py-2 px-3 rounded-lg border text-xs font-semibold text-center transition-all ${decodeMode === opt.value ? 'bg-primary-600 border-primary-600 text-white shadow-md' : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <button
                      onClick={handleDecode}
                      disabled={!decodeInput}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs select-none shadow-md transition-all active:scale-95 border border-primary-500 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ArrowLeftRight className="w-4 h-4" />
                      <span>执行反转义解码</span>
                    </button>
                    <button
                      onClick={() => {
                        setDecodeInput('');
                        setDecodeOutput('');
                      }}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs select-none shadow-md transition-all active:scale-95 border border-slate-700"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>清空输入</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-[140px] relative">
              <span className="font-bold text-slate-400 uppercase tracking-wider text-xs mb-1">反转义解码结果 (Decoded Output)</span>
              <div className="flex-1 w-full bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-emerald-400/90 overflow-auto whitespace-pre-wrap break-all leading-relaxed shadow-inner">
                {decodeOutput || <span className="text-slate-600 italic">等待执行解码结果...</span>}
              </div>
              {decodeOutput && (
                <button
                  onClick={() => copy(decodeOutput, 'decode-out')}
                  className="absolute top-8 right-3 p-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200 transition-all shadow-md"
                >
                  {copiedId === 'decode-out' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>
        ) : (
          // Tab 3: Hex Viewer
          <div className="flex-1 flex flex-col gap-4 min-h-0">
            {!hexBytes ? (
              // Drag and drop box
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 hover:border-primary-500 rounded-2xl bg-slate-950/40 p-10 text-center transition-all cursor-pointer group min-h-[250px]"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                <FileUp className="w-12 h-12 text-slate-500 group-hover:text-primary-400 group-hover:scale-110 transition-all mb-4" />
                <h3 className="text-sm font-bold text-slate-300 group-hover:text-white">拖放任意文件至此，或点击本地上传</h3>
                <p className="text-xs text-slate-500 mt-2 max-w-sm">
                  支持图片、文档、压缩包、可执行文件等。100% 纯浏览器本地离线解析，无任何网络上传，安全快捷。
                </p>
              </div>
            ) : (
              // Main Hex Viewer UI
              <div className="flex-1 flex flex-col gap-4 min-h-0">
                {/* Meta details panel */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary-950/60 p-2 rounded-lg border border-primary-900/60 text-primary-400 shrink-0">
                      <Binary className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-200 truncate max-w-xs md:max-w-md">{hexFile?.name}</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        大小: <span className="font-mono text-slate-400 font-bold">{(hexFile?.size || 0).toLocaleString()} 字节</span> • 
                        魔数检测类型: <span className="text-emerald-400 font-bold">{detectedMeta.label} ({detectedMeta.mime})</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={sendHexToScratchpad}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] shadow transition-all active:scale-95"
                    >
                      送入暂存箱
                    </button>
                    <button
                      onClick={clearHexFile}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] transition-all border border-slate-700"
                    >
                      重新上传
                    </button>
                  </div>
                </div>

                {/* Hex Byte Table Area */}
                <div className="flex-1 bg-slate-950/90 border border-slate-800 rounded-xl overflow-auto p-4 min-h-0 flex flex-col">
                  {/* Grid Header */}
                  <div className="flex items-center pb-2 border-b border-slate-800 font-mono text-[10px] font-bold text-slate-500 tracking-wider uppercase shrink-0">
                    <div className="w-20 shrink-0">偏移量</div>
                    <div className="flex gap-1.5 px-3 border-r border-slate-800 shrink-0">
                      {Array.from({ length: 16 }).map((_, i) => (
                        <span key={i} className="w-6 text-center select-none">{i.toString(16).toUpperCase().padStart(2, '0')}</span>
                      ))}
                    </div>
                    <div className="px-3 grow select-none">ASCII 明文解码</div>
                  </div>

                  {/* Hex Matrix Lines */}
                  <div className="flex-1 overflow-y-auto mt-2 space-y-0.5 pr-2 scrollbar-thin">
                    {renderHexRows()}
                  </div>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs flex-none">
                    <span className="text-slate-400 font-medium">
                      第 <span className="font-mono text-white font-bold">{hexPage + 1}</span> / <span className="font-mono text-slate-400">{totalPages}</span> 页 
                      <span className="text-slate-600 ml-2 hidden sm:inline">
                        (范围: 0x{(hexPage * bytesPerPage).toString(16).toUpperCase()} - 0x{Math.min((hexPage + 1) * bytesPerPage - 1, (hexBytes?.length || 0) - 1).toString(16).toUpperCase()})
                      </span>
                    </span>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <button
                          disabled={hexPage === 0}
                          onClick={() => setHexPage(p => Math.max(0, p - 1))}
                          className="p-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900 text-slate-400 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          disabled={hexPage >= totalPages - 1}
                          onClick={() => setHexPage(p => Math.min(totalPages - 1, p + 1))}
                          className="p-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900 text-slate-400 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 text-[10px]">跳转:</span>
                        <input
                          type="range"
                          min="0"
                          max={totalPages - 1}
                          value={hexPage}
                          onChange={e => setHexPage(Number(e.target.value))}
                          className="w-24 sm:w-32 accent-primary-500 bg-slate-800 rounded-lg cursor-pointer h-1.5"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </CardContent>
    </Card>
  );
};
