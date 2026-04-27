import React, { useState } from 'react';
import { Sparkles, Send, Bot } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';

export const AiAssistant: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsLoading(true);
    setError(null);
    setResponse('');

    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) {
        throw new Error("API Key not found in environment variables.");
      }

      const ai = new GoogleGenAI({ apiKey });
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
        title="AI Code Assistant" 
        description="Ask Gemini to explain code, write regex, or convert formats." 
        actions={<Sparkles className="w-5 h-5 text-primary-600" />}
      />
      <CardContent className="flex-1 flex flex-col gap-4 min-h-0">
        
        {/* Output Area */}
        <div className="tool-panel flex-1 overflow-y-auto p-4">
          {error && (
            <div className="status-error mb-4 p-4">
              {error}
            </div>
          )}
          
          {!response && !isLoading && !error && (
             <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <Bot className="w-12 h-12 mb-2 opacity-20" />
                <p>Ask me anything about code...</p>
             </div>
          )}

          {isLoading && (
              <div className="flex items-center gap-2 text-primary-600 animate-pulse">
                  <Sparkles className="w-4 h-4" /> Thinking...
              </div>
          )}
          
          {response && (
            <div className="prose prose-sm max-w-none text-slate-800">
               <pre className="whitespace-pre-wrap font-mono text-sm">{response}</pre>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="flex flex-col gap-2 md:flex-row">
          <input
            type="text"
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm"
            placeholder="E.g., 'Write a regex for email validation' or 'Convert this JSON to TypeScript interface'..."
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
            Send
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
