import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Split, AlignLeft, RefreshCw, FileText } from 'lucide-react';
import { ScratchpadPicker, isScratchpadTextLike } from './shared/ScratchpadControls';

interface DiffChange {
  type: 'added' | 'removed' | 'unchanged';
  value: string;
  lineNum1?: number;
  lineNum2?: number;
}

interface WordToken {
  type: 'added' | 'removed' | 'unchanged';
  value: string;
}

interface AlignedDiffRow {
  type: 'unchanged' | 'modified' | 'added' | 'removed';
  left?: {
    lineNum: number;
    value: string;
    tokens?: WordToken[];
  };
  right?: {
    lineNum: number;
    value: string;
    tokens?: WordToken[];
  };
}

// 1. Line-level LCS Diff Engine
function computeDiff(oldLines: string[], newLines: string[]): DiffChange[] {
  const n = oldLines.length;
  const m = newLines.length;
  const dp: number[][] = Array(n + 1).fill(null).map(() => Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const diff: DiffChange[] = [];
  let i = n, j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      diff.push({
        type: 'unchanged',
        value: oldLines[i - 1],
        lineNum1: i,
        lineNum2: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.push({
        type: 'added',
        value: newLines[j - 1],
        lineNum2: j,
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i - 1][j] >= dp[i][j - 1])) {
      diff.push({
        type: 'removed',
        value: oldLines[i - 1],
        lineNum1: i,
      });
      i--;
    }
  }

  return diff.reverse();
}

// 2. Word/Token-level LCS Diff Engine for Modified Line Paired Highlighting
function computeWordDiff(oldLine: string, newLine: string): { oldTokens: WordToken[]; newTokens: WordToken[] } {
  // Tokenize using a regex that matches English words, whitespace blocks, or any other individual characters (Chinese, symbols)
  const oldTokens = oldLine.split(/([a-zA-Z0-9]+|\s+|.)/).filter(Boolean);
  const newTokens = newLine.split(/([a-zA-Z0-9]+|\s+|.)/).filter(Boolean);

  const n = oldTokens.length;
  const m = newTokens.length;
  const dp: number[][] = Array(n + 1).fill(null).map(() => Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (oldTokens[i - 1] === newTokens[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const oldResult: WordToken[] = [];
  const newResult: WordToken[] = [];
  let i = n, j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldTokens[i - 1] === newTokens[j - 1]) {
      oldResult.push({ type: 'unchanged', value: oldTokens[i - 1] });
      newResult.push({ type: 'unchanged', value: newTokens[j - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      newResult.push({ type: 'added', value: newTokens[j - 1] });
      j--;
    } else {
      oldResult.push({ type: 'removed', value: oldTokens[i - 1] });
      i--;
    }
  }

  return {
    oldTokens: oldResult.reverse(),
    newTokens: newResult.reverse(),
  };
}

// 3. Diff Aligner to create scroll-synchronized rows
function alignDiff(diffChanges: DiffChange[]): AlignedDiffRow[] {
  const rows: AlignedDiffRow[] = [];
  let leftBlock: DiffChange[] = [];
  let rightBlock: DiffChange[] = [];

  const flushBlocks = () => {
    const maxLen = Math.max(leftBlock.length, rightBlock.length);
    for (let k = 0; k < maxLen; k++) {
      const leftItem = leftBlock[k];
      const rightItem = rightBlock[k];

      if (leftItem && rightItem) {
        // Compute word diff forpaired modifications
        const { oldTokens, newTokens } = computeWordDiff(leftItem.value, rightItem.value);
        rows.push({
          type: 'modified',
          left: {
            lineNum: leftItem.lineNum1!,
            value: leftItem.value,
            tokens: oldTokens,
          },
          right: {
            lineNum: rightItem.lineNum2!,
            value: rightItem.value,
            tokens: newTokens,
          },
        });
      } else if (leftItem) {
        rows.push({
          type: 'removed',
          left: {
            lineNum: leftItem.lineNum1!,
            value: leftItem.value,
          },
        });
      } else if (rightItem) {
        rows.push({
          type: 'added',
          right: {
            lineNum: rightItem.lineNum2!,
            value: rightItem.value,
          },
        });
      }
    }
    leftBlock = [];
    rightBlock = [];
  };

  for (const change of diffChanges) {
    if (change.type === 'unchanged') {
      flushBlocks();
      rows.push({
        type: 'unchanged',
        left: {
          lineNum: change.lineNum1!,
          value: change.value,
        },
        right: {
          lineNum: change.lineNum2!,
          value: change.value,
        },
      });
    } else if (change.type === 'removed') {
      leftBlock.push(change);
    } else if (change.type === 'added') {
      rightBlock.push(change);
    }
  }
  flushBlocks();
  return rows;
}

const JS_EXAMPLE_OLD = `const calculateTotal = (price, tax) => {
  console.log("Calculating total...");
  // Multiply price by (1 + tax)
  return price * (1 + tax);
};`;

const JS_EXAMPLE_NEW = `const calculateTotal = (price, tax, discount = 0) => {
  console.log("Calculating net total...");
  // Deduct discount first, then apply tax
  return (price - discount) * (1 + tax);
};`;

const JSON_EXAMPLE_OLD = `{
  "name": "DevToolbox Pro",
  "version": "1.2.0",
  "status": "active",
  "features": ["Network", "Regex"]
}`;

const JSON_EXAMPLE_NEW = `{
  "name": "DevToolbox Pro Premium",
  "version": "2.0.0",
  "status": "active",
  "features": ["Network", "Schema Mock", "Diff Suite", "Masking"],
  "license": "Commercial"
}`;

export const DiffViewer: React.FC = () => {
  const [oldText, setOldText] = useState(JS_EXAMPLE_OLD);
  const [newText, setNewText] = useState(JS_EXAMPLE_NEW);
  const [layoutMode, setLayoutMode] = useState<'side-by-side' | 'unified'>('side-by-side');
  
  // Slice Render Limits for 60 FPS Scrolling Optimization
  const [renderLimit, setRenderLimit] = useState(150);

  const loadExample = (type: 'js' | 'json') => {
    if (type === 'js') {
      setOldText(JS_EXAMPLE_OLD);
      setNewText(JS_EXAMPLE_NEW);
    } else {
      setOldText(JSON_EXAMPLE_OLD);
      setNewText(JSON_EXAMPLE_NEW);
    }
    setRenderLimit(150);
  };

  const clearInputs = () => {
    setOldText('');
    setNewText('');
    setRenderLimit(150);
  };

  // Compute aligned diff rows
  const lines1 = oldText.split('\n');
  const lines2 = newText.split('\n');
  const diffChanges = computeDiff(lines1, lines2);
  const alignedRows = alignDiff(diffChanges);
  const totalRows = alignedRows.length;
  const visibleRows = alignedRows.slice(0, renderLimit);

  // Stats
  const additions = diffChanges.filter(c => c.type === 'added').length;
  const deletions = diffChanges.filter(c => c.type === 'removed').length;

  return (
    <Card className="h-full flex flex-col min-h-0 bg-slate-900 border-slate-800 text-slate-100">
      <CardHeader
        title="文本差异比对分析器"
        description="支持 Side-by-Side 分栏与 Unified 合并双布局切换，配备智能单词/字符级 (Word-level) 高对比度行内增删高亮，经长文本 Chunk 渲染优化。"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => loadExample('js')} icon={<FileText className="w-3.5 h-3.5" />}>
              React 代码示例
            </Button>
            <Button size="sm" variant="secondary" onClick={() => loadExample('json')} icon={<FileText className="w-3.5 h-3.5" />}>
              JSON 载荷示例
            </Button>
            <Button size="sm" variant="secondary" onClick={clearInputs} icon={<RefreshCw className="w-3.5 h-3.5" />}>
              清空
            </Button>
          </div>
        }
      />
      <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden min-h-0 p-6">
        
        {/* Input Textareas Pane */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-1/3 min-h-[160px] flex-none">
          <div className="flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-1 text-xs">
              <span className="font-bold text-slate-400 uppercase tracking-wider">原始文本 (Original)</span>
              <div className="flex items-center gap-2">
                <ScratchpadPicker
                  placeholder="暂存箱载入..."
                  filter={isScratchpadTextLike}
                  onLoad={content => {
                    if (typeof content === 'string') {
                      setOldText(content);
                      setRenderLimit(150);
                    }
                  }}
                />
                <span className="text-slate-500 font-mono">{lines1.length} 行 | {oldText.length} 字符</span>
              </div>
            </div>
            <textarea
              className="flex-1 w-full p-3 rounded-xl border border-slate-800 bg-slate-950 font-mono text-xs text-slate-300 focus:outline-none focus:border-primary-500 resize-none leading-relaxed transition-all overflow-auto"
              value={oldText}
              onChange={e => {
                setOldText(e.target.value);
                setRenderLimit(150);
              }}
              placeholder="请输入或粘贴原始文本..."
            />
          </div>
          <div className="flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-1 text-xs">
              <span className="font-bold text-slate-400 uppercase tracking-wider">修改后文本 (Modified)</span>
              <div className="flex items-center gap-2">
                <ScratchpadPicker
                  placeholder="暂存箱载入..."
                  filter={isScratchpadTextLike}
                  onLoad={content => {
                    if (typeof content === 'string') {
                      setNewText(content);
                      setRenderLimit(150);
                    }
                  }}
                />
                <span className="text-slate-500 font-mono">{lines2.length} 行 | {newText.length} 字符</span>
              </div>
            </div>
            <textarea
              className="flex-1 w-full p-3 rounded-xl border border-slate-800 bg-slate-950 font-mono text-xs text-slate-300 focus:outline-none focus:border-primary-500 resize-none leading-relaxed transition-all overflow-auto"
              value={newText}
              onChange={e => {
                setNewText(e.target.value);
                setRenderLimit(150);
              }}
              placeholder="请输入或粘贴修改后的文本..."
            />
          </div>
        </div>

        {/* Toolbar / Diff Summary Dashboard */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-slate-950 border border-slate-800 rounded-xl flex-none">
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setLayoutMode('side-by-side')}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg border text-xs font-semibold uppercase transition-all ${layoutMode === 'side-by-side' ? 'bg-primary-600 border-primary-600 text-white shadow-sm' : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'}`}
            >
              <Split className="w-4 h-4" />
              <span>双栏分栏 (Side-by-Side)</span>
            </button>
            <button
              onClick={() => setLayoutMode('unified')}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg border text-xs font-semibold uppercase transition-all ${layoutMode === 'unified' ? 'bg-primary-600 border-primary-600 text-white shadow-sm' : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'}`}
            >
              <AlignLeft className="w-4 h-4" />
              <span>单栏合并 (Unified)</span>
            </button>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span>新增 {additions} 行</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
              <span>删除 {deletions} 行</span>
            </span>
          </div>
        </div>

        {/* Interactive Diff Display Board */}
        <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl overflow-auto p-4 font-mono text-xs leading-5 select-text min-h-0 space-y-0.5 shadow-inner scrollbar-thin scrollbar-track-slate-950 scrollbar-thumb-slate-800">
          
          {layoutMode === 'side-by-side' ? (
            // Side-by-Side (双栏分栏) Layout
            <div className="divide-y divide-slate-900/50 min-w-[700px]">
              {visibleRows.map((row, idx) => {
                if (row.type === 'unchanged') {
                  return (
                    <div key={idx} className="flex hover:bg-slate-900/30 py-0.5 transition-colors group">
                      {/* Left: Original Line */}
                      <div className="w-1/2 flex border-r border-slate-900 pr-2">
                        <span className="w-10 text-right pr-3 text-slate-600 select-none text-[10px] leading-5">{row.left?.lineNum}</span>
                        <pre className="text-slate-400 flex-1 whitespace-pre break-all overflow-hidden pl-3">{row.left?.value || ' '}</pre>
                      </div>
                      {/* Right: Modified Line */}
                      <div className="w-1/2 flex pl-2">
                        <span className="w-10 text-right pr-3 text-slate-600 select-none text-[10px] leading-5">{row.right?.lineNum}</span>
                        <pre className="text-slate-400 flex-1 whitespace-pre break-all overflow-hidden pl-3">{row.right?.value || ' '}</pre>
                      </div>
                    </div>
                  );
                } else if (row.type === 'modified') {
                  return (
                    <div key={idx} className="flex bg-slate-900/10 py-0.5 group">
                      {/* Left: Modified Original (Removed word highlights) */}
                      <div className="w-1/2 flex bg-rose-950/20 hover:bg-rose-950/30 border-r border-slate-900 border-l-2 border-rose-500 pr-2 transition-colors">
                        <span className="w-10 text-right pr-3 text-rose-500/70 select-none text-[10px] leading-5">{row.left?.lineNum}</span>
                        <div className="text-rose-200/90 flex-1 whitespace-pre break-all overflow-hidden pl-3 leading-5">
                          {row.left?.tokens?.map((tok, tIdx) => (
                            <span
                              key={tIdx}
                              className={tok.type === 'removed' ? 'bg-rose-500/40 text-rose-100 font-semibold px-0.5 rounded shadow-sm' : ''}
                            >
                              {tok.value}
                            </span>
                          )) || row.left?.value}
                        </div>
                      </div>
                      {/* Right: Modified Target (Added word highlights) */}
                      <div className="w-1/2 flex bg-emerald-950/15 hover:bg-emerald-950/25 border-l-2 border-emerald-500 pl-2 transition-colors">
                        <span className="w-10 text-right pr-3 text-emerald-500/70 select-none text-[10px] leading-5">{row.right?.lineNum}</span>
                        <div className="text-emerald-200/90 flex-1 whitespace-pre break-all overflow-hidden pl-3 leading-5">
                          {row.right?.tokens?.map((tok, tIdx) => (
                            <span
                              key={tIdx}
                              className={tok.type === 'added' ? 'bg-emerald-500/40 text-emerald-100 font-semibold px-0.5 rounded shadow-sm' : ''}
                            >
                              {tok.value}
                            </span>
                          )) || row.right?.value}
                        </div>
                      </div>
                    </div>
                  );
                } else if (row.type === 'removed') {
                  return (
                    <div key={idx} className="flex bg-rose-950/15 hover:bg-rose-950/25 py-0.5 group">
                      {/* Left: Removed line */}
                      <div className="w-1/2 flex border-r border-slate-900 border-l-2 border-rose-500 pr-2 transition-colors">
                        <span className="w-10 text-right pr-3 text-rose-500/70 select-none text-[10px] leading-5">{row.left?.lineNum}</span>
                        <pre className="text-rose-300/80 flex-1 whitespace-pre break-all overflow-hidden pl-3 pl-3">{row.left?.value || ' '}</pre>
                      </div>
                      {/* Right: Gap */}
                      <div className="w-1/2 flex pl-2 bg-slate-900/10 select-none opacity-20">
                        <span className="w-10 text-right pr-3 text-slate-800 text-[10px] leading-5">-</span>
                        <div className="flex-1 pl-3 bg-stripes bg-[length:10px_10px]" />
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div key={idx} className="flex bg-emerald-950/10 hover:bg-emerald-950/20 py-0.5 group">
                      {/* Left: Gap */}
                      <div className="w-1/2 flex border-r border-slate-900 pr-2 bg-slate-900/10 select-none opacity-20">
                        <span className="w-10 text-right pr-3 text-slate-800 text-[10px] leading-5">-</span>
                        <div className="flex-1 pl-3 bg-stripes bg-[length:10px_10px]" />
                      </div>
                      {/* Right: Added line */}
                      <div className="w-1/2 flex border-l-2 border-emerald-500 pl-2 transition-colors">
                        <span className="w-10 text-right pr-3 text-emerald-500/70 select-none text-[10px] leading-5">{row.right?.lineNum}</span>
                        <pre className="text-emerald-300/80 flex-1 whitespace-pre break-all overflow-hidden pl-3">{row.right?.value || ' '}</pre>
                      </div>
                    </div>
                  );
                }
              })}
            </div>
          ) : (
            // Unified (单栏合并) Layout
            <div className="divide-y divide-slate-900/50">
              {visibleRows.map((row, idx) => {
                if (row.type === 'unchanged') {
                  return (
                    <div key={idx} className="flex hover:bg-slate-900/30 py-0.5 transition-colors group">
                      <span className="w-8 text-right pr-3 text-slate-600 select-none text-[10px] leading-5">{row.left?.lineNum}</span>
                      <span className="w-8 text-right pr-3 text-slate-600 select-none text-[10px] leading-5">{row.right?.lineNum}</span>
                      <span className="w-6 text-center text-slate-700 select-none leading-5"> </span>
                      <pre className="text-slate-400 pl-3 border-l border-slate-800/80 flex-1 whitespace-pre break-all overflow-hidden leading-5">{row.left?.value}</pre>
                    </div>
                  );
                } else if (row.type === 'modified') {
                  return (
                    <React.Fragment key={idx}>
                      {/* Red line */}
                      <div className="flex bg-rose-950/20 hover:bg-rose-950/30 border-l-2 border-rose-500 py-0.5 transition-colors">
                        <span className="w-8 text-right pr-3 text-rose-500/70 select-none text-[10px] leading-5">{row.left?.lineNum}</span>
                        <span className="w-8 text-right pr-3 text-transparent select-none text-[10px] leading-5">-</span>
                        <span className="w-6 text-center text-rose-500 font-bold select-none leading-5">-</span>
                        <div className="text-rose-200/90 pl-3 border-l border-rose-950/50 flex-1 whitespace-pre break-all overflow-hidden leading-5">
                          {row.left?.tokens?.map((tok, tIdx) => (
                            <span
                              key={tIdx}
                              className={tok.type === 'removed' ? 'bg-rose-500/40 text-rose-100 font-semibold px-0.5 rounded shadow-sm' : ''}
                            >
                              {tok.value}
                            </span>
                          )) || row.left?.value}
                        </div>
                      </div>
                      {/* Green line */}
                      <div className="flex bg-emerald-950/15 hover:bg-emerald-950/25 border-l-2 border-emerald-500 py-0.5 transition-colors">
                        <span className="w-8 text-right pr-3 text-transparent select-none text-[10px] leading-5">-</span>
                        <span className="w-8 text-right pr-3 text-emerald-500/70 select-none text-[10px] leading-5">{row.right?.lineNum}</span>
                        <span className="w-6 text-center text-emerald-500 font-bold select-none leading-5">+</span>
                        <div className="text-emerald-200/90 pl-3 border-l border-emerald-950/50 flex-1 whitespace-pre break-all overflow-hidden leading-5">
                          {row.right?.tokens?.map((tok, tIdx) => (
                            <span
                              key={tIdx}
                              className={tok.type === 'added' ? 'bg-emerald-500/40 text-emerald-100 font-semibold px-0.5 rounded shadow-sm' : ''}
                            >
                              {tok.value}
                            </span>
                          )) || row.right?.value}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                } else if (row.type === 'removed') {
                  return (
                    <div key={idx} className="flex bg-rose-950/15 hover:bg-rose-950/25 border-l-2 border-rose-500 py-0.5 transition-colors group">
                      <span className="w-8 text-right pr-3 text-rose-500/70 select-none text-[10px] leading-5">{row.left?.lineNum}</span>
                      <span className="w-8 text-right pr-3 text-transparent select-none text-[10px] leading-5">-</span>
                      <span className="w-6 text-center text-rose-500 font-bold select-none leading-5">-</span>
                      <pre className="text-rose-300/80 pl-3 border-l border-rose-950/50 flex-1 whitespace-pre break-all overflow-hidden leading-5">{row.left?.value}</pre>
                    </div>
                  );
                } else {
                  return (
                    <div key={idx} className="flex bg-emerald-950/10 hover:bg-emerald-950/20 border-l-2 border-emerald-500 py-0.5 transition-colors group">
                      <span className="w-8 text-right pr-3 text-transparent select-none text-[10px] leading-5">-</span>
                      <span className="w-8 text-right pr-3 text-emerald-500/70 select-none text-[10px] leading-5">{row.right?.lineNum}</span>
                      <span className="w-6 text-center text-emerald-500 font-bold select-none leading-5">+</span>
                      <pre className="text-emerald-300/80 pl-3 border-l border-emerald-950/50 flex-1 whitespace-pre break-all overflow-hidden leading-5">{row.right?.value}</pre>
                    </div>
                  );
                }
              })}
            </div>
          )}

          {totalRows === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <RefreshCw className="w-10 h-10 mb-3 animate-pulse" />
              <p>暂无任何差异，请输入不同文本进行比对分析</p>
            </div>
          )}

          {/* Chunk performance loader button */}
          {totalRows > renderLimit && (
            <div className="pt-4 pb-2 text-center">
              <button
                onClick={() => setRenderLimit(prev => prev + 300)}
                className="px-6 py-2 border border-slate-800 bg-slate-900 text-slate-300 text-xs font-semibold rounded-xl hover:bg-slate-800 active:scale-95 transition-all shadow-md"
              >
                展示更多差异行 (当前已加载 {renderLimit} / {totalRows} 行)
              </button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
