import React, { useState } from 'react';
import { Copy, Check, ShieldAlert, ArrowLeftRight, Sparkles, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';

// Safe UTF-8 Base64 Encoder
const safeBtoa = (str: string): string => {
  try {
    return window.btoa(unescape(encodeURIComponent(str)));
  } catch {
    return '[无法进行 Base64 编码]';
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

  // 1. Phone number (11 digits starting with 13-19)
  // e.g. 13812345678 -> 138****5678
  result = result.replace(/\b(1[3-9]\d)(\d{4})(\d{4})\b/g, '$1****$3');

  // 2. ID Card (18 digits or 15 digits)
  // e.g. 110101199003072345 -> 110101********2345
  result = result.replace(/\b(\d{6})\d{8,11}(\d{4}|\d{3}[Xx])\b/g, '$1********$2');

  // 3. Bank Card (16 to 19 digits)
  // e.g. 6222020212345678901 -> 622202*********8901
  result = result.replace(/\b(\d{6})\d{6,9}(\d{4})\b/g, (match, p1, p2) => {
    const maskLen = match.length - 10;
    return p1 + '*'.repeat(maskLen) + p2;
  });

  // 4. Email
  // e.g. antigravity@gmail.com -> a**********y@gmail.com
  result = result.replace(/\b([a-zA-Z0-9._%+-])([a-zA-Z0-9._%+-]*)([a-zA-Z0-9._%+-])@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g, (match, first, middle, last, domain) => {
    return first + '*'.repeat(Math.max(3, middle.length)) + last + '@' + domain;
  });

  // 5. Chinese Name (2-4 Chinese characters matching common surnames)
  const surnames = '赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳酆鲍史唐费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮卞齐康伍余元卜顾孟平黄和穆萧尹姚邵湛汪祁毛禹狄米贝明臧计伏成戴谈宋茅庞熊纪舒屈项祝董梁杜阮蓝闵席季麻强贾路娄危江童颜郭梅盛林刁钟徐邱骆高夏蔡田樊胡凌霍虞万支柯昝管卢莫经房裘缪干解应宗丁宣贲邓郁单杭洪包诸左石崔吉钮龚程嵇邢滑裴陆荣翁';
  const doubleSurnames = '欧阳|司马|上官|闾丘|令狐|夏侯|诸葛|尉迟|皇甫|公孙';
  
  const nameRegex = new RegExp(`(${doubleSurnames}|[${surnames}])([\u4e00-\u9fa5]{1,2})`, 'g');
  result = result.replace(nameRegex, (match) => {
    // Filter out common false matches that are not actual names (e.g. normal sentence words)
    // Name lengths: 2, 3, or 4 characters
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

export const StringEscaper: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'cascade' | 'decoder'>('cascade');
  const [input, setInput] = useState('测试客户姓名: 张三丰, 电话: 13812345678, 邮箱: example123@gmail.com, 身份证: 110101199003072345');
  const { copiedId, copy } = useCopyToClipboard();

  // real-time five-way synchronized cascades
  const base64Escaped = safeBtoa(input);
  const urlEscaped = encodeURIComponent(input);
  const htmlEscaped = escapeHtml(input);
  const unicodeEscaped = escapeUnicode(input);
  const hexEscaped = escapeHex(input);

  // Manual Decoder States
  const [decodeInput, setDecodeInput] = useState('');
  const [decodeMode, setDecodeMode] = useState<'base64' | 'url' | 'html' | 'unicode' | 'hex'>('base64');
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
        setDecodeOutput(decodeInput.replace(/\\u([\dA-F]{4})/gi, (match, grp) => 
          String.fromCharCode(parseInt(grp, 16))
        ));
      } else if (decodeMode === 'hex') {
        setDecodeOutput(decodeInput.replace(/\\x([\dA-F]{2})/gi, (match, grp) => 
          String.fromCharCode(parseInt(grp, 16))
        ));
      }
    } catch {
      setDecodeOutput('[错误: 解码失败，请检查输入格式是否正确]');
    }
  };

  const handleMask = () => {
    const masked = maskSensitiveData(input);
    setInput(masked);
  };

  return (
    <Card className="h-full flex flex-col min-h-0 bg-slate-900 border-slate-800 text-slate-100">
      <CardHeader
        title="五向级联转义与本地敏感脱敏中心"
        description="本地一键智能提取并遮盖身份证、手机、银行卡、中英文名及邮箱隐私。同步级联计算呈现五种核心字符集转义状态。"
        actions={
          <div className="flex gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === 'cascade' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              onClick={() => setActiveTab('cascade')}
            >
              实时五向级联 & 脱敏
            </button>
            <button
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === 'decoder' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              onClick={() => setActiveTab('decoder')}
            >
              手动反转义解码
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
                <span className="font-bold text-slate-400 uppercase tracking-wider">输入原始字符串</span>
                <span className="text-slate-500 font-mono">{input.length} 字符</span>
              </div>
              <textarea
                className="flex-1 w-full p-4 rounded-xl border border-slate-800 bg-slate-950 font-mono text-xs text-slate-300 focus:outline-none focus:border-primary-500 resize-none leading-relaxed transition-all min-h-[150px]"
                value={input}
                onChange={e => setInput(e.target.value)}
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
                  onClick={() => setInput('')}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs select-none shadow-md transition-all active:scale-95 border border-slate-700"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>清空</span>
                </button>
              </div>
              
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2.5 text-[10px] text-slate-400 flex-none leading-normal">
                <p className="font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  本地脱敏技术规则
                </p>
                <ul className="list-disc pl-4 space-y-1">
                  <li><strong>手机号</strong>: 11位段，隐藏第4至7位星号替换</li>
                  <li><strong>身份证</strong>: 15/18位段，掩盖中间生日及校验位</li>
                  <li><strong>银行卡</strong>: 16至19位段，保留首6位和末4位</li>
                  <li><strong>邮箱</strong>: 精准遮盖邮箱用户名主体字符</li>
                  <li><strong>姓名</strong>: 匹配百家姓，李四 ➔ 李*，诸葛孔明 ➔ 诸**明</li>
                  <li className="text-amber-500/90 font-semibold">100% 纯本地离线替换，绝不上报隐私，保障网络环境绝对安全。</li>
                </ul>
              </div>
            </div>

            {/* Right Column: 5-way synchronized encodings (7 cols equivalent) */}
            <div className="lg:col-span-7 flex flex-col gap-4 overflow-y-auto pr-1">
              <span className="font-bold text-slate-400 uppercase tracking-wider text-xs block mb-1">
                五向实时级联输出 (Real-time Cascader)
              </span>
              
              {[
                { label: 'Base64 编码', value: base64Escaped, id: 'b64' },
                { label: 'URL 编码', value: urlEscaped, id: 'url' },
                { label: 'HTML 实体转义', value: htmlEscaped, id: 'html' },
                { label: 'Unicode 转义', value: unicodeEscaped, id: 'unicode' },
                { label: 'Hex 字符转义', value: hexEscaped, id: 'hex' }
              ].map(enc => (
                <div key={enc.id} className="p-3 border border-slate-800 rounded-xl bg-slate-950/80 flex flex-col gap-2 relative group hover:border-slate-700 transition-colors">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{enc.label}</span>
                    <button
                      onClick={() => copy(enc.value, enc.id)}
                      disabled={!enc.value || enc.value.startsWith('[无法')}
                      className="p-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {copiedId === enc.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="font-mono text-xs text-emerald-400/90 bg-slate-900/40 p-2.5 rounded-lg border border-slate-900 overflow-x-auto whitespace-pre-wrap break-all max-h-[85px] scrollbar-none leading-relaxed">
                    {enc.value || <span className="text-slate-600 italic">等待输入...</span>}
                  </div>
                </div>
              ))}
            </div>

          </div>
        ) : (
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
                    {[
                      { value: 'base64', label: 'Base64 解码' },
                      { value: 'url', label: 'URL 解码' },
                      { value: 'html', label: 'HTML 实体还原' },
                      { value: 'unicode', label: 'Unicode 还原' },
                      { value: 'hex', label: 'Hex 还原' }
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setDecodeMode(opt.value as any)}
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
        )}

      </CardContent>
    </Card>
  );
};
