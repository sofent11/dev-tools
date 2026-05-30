import React, { useState, useEffect } from 'react';
import { Sparkles, Send, Bot } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { marked } from 'marked';

const sanitizeHtml = (htmlStr: string): string => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlStr, 'text/html');
    
    // Remove dangerous tags
    const dangerousTags = ['script', 'iframe', 'object', 'embed', 'link', 'style', 'meta', 'base'];
    dangerousTags.forEach(tag => {
      doc.querySelectorAll(tag).forEach(el => el.remove());
    });
    
    // Clean up all elements attributes
    const allElements = doc.querySelectorAll('*');
    allElements.forEach(el => {
      const attrs = Array.from(el.attributes);
      attrs.forEach(attr => {
        if (attr.name.startsWith('on')) {
          el.removeAttribute(attr.name);
        }
        if (attr.value.trim().toLowerCase().startsWith('javascript:')) {
          el.setAttribute(attr.name, '#');
        }
      });
    });
    
    return doc.body.innerHTML;
  } catch (e) {
    console.error('HTML Sanitization failed:', e);
    return '';
  }
};

export const AiAssistant: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [htmlResponse, setHtmlResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load API Key from localStorage or fallback
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [showConfig, setShowConfig] = useState(!localStorage.getItem('gemini_api_key'));

  useEffect(() => {
    if (!response) {
      setHtmlResponse('');
      return;
    }
    const parseMarkdown = async () => {
      try {
        const parsed = await marked.parse(response);
        setHtmlResponse(sanitizeHtml(parsed));
      } catch (err) {
        console.error('Failed to parse Markdown:', err);
        setHtmlResponse(response);
      }
    };
    parseMarkdown();
  }, [response]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsLoading(true);
    setError(null);
    setResponse('');

    try {
      const activeKey = apiKey || import.meta.env.VITE_GEMINI_API_KEY;
      if (!activeKey) {
        throw new Error("API Key 未配置。请在上方输入您的 Gemini API Key 或在项目环境配置文件中设置 VITE_GEMINI_API_KEY。");
      }

      const ai = new GoogleGenAI({ apiKey: activeKey });
      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            systemInstruction: "You are an expert developer assistant inside a dev toolbox app. Keep answers concise, code-focused, and formatted in Markdown. If asked to convert code, just provide the code. If asked to explain, be brief."
        }
      });

      setResponse(result.text || "No response generated.");

    } catch (err) {
      setError((err as Error).message || "An error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader 
        title="AI 智能代码助手" 
        description="基于 Gemini 2.5-Flash，本地化安全运行，极速问答、生成正则、格式转换等。" 
        actions={<Sparkles className="w-5 h-5 text-purple-500 animate-pulse" />}
      />
      <CardContent className="flex-1 flex flex-col gap-4 min-h-0">
        
        {/* API Key Configuration Panel */}
        {showConfig ? (
          <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-semibold text-purple-900">Gemini API Key 配置</h4>
              <button 
                onClick={() => setShowConfig(false)}
                className="text-xs text-purple-600 hover:text-purple-800 font-medium"
              >
                收起
              </button>
            </div>
            <p className="text-xs text-purple-700/80">
              本工具 100% 运行在您的浏览器本地。请输入您的 Gemini API Key。您的 Key 将被保存在本地浏览器的 `localStorage` 中，绝不会上传至任何第三方服务器。
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                className="flex-1 px-3 py-1.5 text-sm border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
                placeholder="AIzaSy..."
                value={apiKey}
                onChange={(e) => {
                  const key = e.target.value.trim();
                  setApiKey(key);
                  localStorage.setItem('gemini_api_key', key);
                }}
              />
              <Button size="sm" onClick={() => setShowConfig(false)}>保存</Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-center px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            <span className="text-slate-500 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              API 密钥状态: {apiKey ? `已配置 (••••${apiKey.slice(-4)})` : <span className="text-amber-500 font-medium">未配置 (将使用系统预设)</span>}
            </span>
            <button 
              onClick={() => setShowConfig(true)}
              className="text-purple-600 hover:text-purple-800 font-semibold"
            >
              配置密钥
            </button>
          </div>
        )}

        {/* Output Area */}
        <div className="flex-1 bg-slate-50 rounded-xl border border-slate-200 p-6 overflow-y-auto min-h-0">
          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-100 mb-4 text-sm font-medium">
              {error}
            </div>
          )}
          
          {!response && !isLoading && !error && (
             <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <Bot className="w-12 h-12 mb-2 opacity-20" />
                <p className="text-sm">问我任何关于代码、正则或数据转换的问题...</p>
             </div>
          )}

          {isLoading && (
              <div className="flex items-center gap-2 text-primary-600 animate-pulse text-sm">
                  <Sparkles className="w-4 h-4" /> Gemini 正在思考中...
              </div>
          )}
          
          {htmlResponse && (
            <div 
              className="prose prose-slate max-w-none text-sm text-slate-800 dark:prose-invert 
                         prose-headings:font-bold prose-headings:text-slate-900 prose-headings:mt-4 prose-headings:mb-2
                         prose-p:leading-relaxed prose-p:mb-4
                         prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto prose-pre:mb-4
                         prose-code:text-purple-600 prose-code:bg-purple-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-xs
                         prose-pre:prose-code:bg-transparent prose-pre:prose-code:text-slate-100 prose-pre:prose-code:p-0 prose-pre:prose-code:rounded-none
                         prose-ul:list-disc prose-ul:pl-5 prose-ul:mb-4
                         prose-ol:list-decimal prose-ol:pl-5 prose-ol:mb-4"
              dangerouslySetInnerHTML={{ __html: htmlResponse }} 
            />
          )}
        </div>

        {/* Input Area */}
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm"
            placeholder="例如：'写一个邮箱验证的正则表达式' 或 '将此 JSON 转换为 TS 接口'..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
          />
          <Button 
            onClick={handleGenerate} 
            isLoading={isLoading} 
            disabled={!prompt.trim()}
            icon={<Send className="w-4 h-4"/>}
          >
            发送
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
