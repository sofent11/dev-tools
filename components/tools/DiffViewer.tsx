import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';

interface DiffChange {
    type: 'added' | 'removed' | 'unchanged';
    value: string;
    lineNum1?: number;
    lineNum2?: number;
}

function computeDiff(oldLines: string[], newLines: string[]): DiffChange[] {
    const n = oldLines.length;
    const m = newLines.length;
    
    // DP table for LCS
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
    
    // Backtrack to build the diff
    const diff: DiffChange[] = [];
    let i = n, j = m;
    
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
            diff.push({
                type: 'unchanged',
                value: oldLines[i - 1],
                lineNum1: i,
                lineNum2: j
            });
            i--;
            j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            diff.push({
                type: 'added',
                value: newLines[j - 1],
                lineNum2: j
            });
            j--;
        } else if (i > 0 && (j === 0 || dp[i - 1][j] >= dp[i][j - 1])) {
            diff.push({
                type: 'removed',
                value: oldLines[i - 1],
                lineNum1: i
            });
            i--;
        }
    }
    
    return diff.reverse();
}

export const DiffViewer: React.FC = () => {
    const [oldText, setOldText] = useState('Line 1\nLine 2\nLine 3');
    const [newText, setNewText] = useState('Line 1\nLine 2 Modified\nLine 4');

    return (
        <Card className="h-full flex flex-col">
            <CardHeader title="文本差异比对" description="智能对比两个文本的行级差异，支持准确的插入、删除与修改标记。" />
            <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
                 <div className="grid grid-cols-2 gap-4 h-1/2">
                    <div className="flex flex-col">
                         <label className="text-sm font-bold text-slate-600 mb-1">Original</label>
                         <textarea
                            className="flex-1 p-2 border border-slate-200 rounded text-sm font-mono resize-none focus:ring-2 focus:ring-primary-200 focus:outline-none"
                            value={oldText}
                            onChange={e => setOldText(e.target.value)}
                         />
                    </div>
                    <div className="flex flex-col">
                         <label className="text-sm font-bold text-slate-600 mb-1">Modified</label>
                         <textarea
                            className="flex-1 p-2 border border-slate-200 rounded text-sm font-mono resize-none focus:ring-2 focus:ring-primary-200 focus:outline-none"
                            value={newText}
                            onChange={e => setNewText(e.target.value)}
                         />
                    </div>
                 </div>

                 <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg overflow-auto p-4 font-mono text-sm space-y-0.5">
                    {(() => {
                        const lines1 = oldText.split('\n');
                        const lines2 = newText.split('\n');
                        const diff = computeDiff(lines1, lines2);

                        return diff.map((change, idx) => {
                            if (change.type === 'unchanged') {
                                return (
                                    <div key={idx} className="flex hover:bg-slate-100/80 transition-colors py-0.5">
                                        <span className="w-8 text-right pr-3 text-slate-300 select-none text-xs leading-5">{change.lineNum1}</span>
                                        <span className="w-8 text-right pr-3 text-slate-300 select-none text-xs leading-5">{change.lineNum2}</span>
                                        <span className="text-slate-600 pl-3 border-l border-slate-200 flex-1 leading-5 whitespace-pre-wrap break-all">{change.value}</span>
                                    </div>
                                );
                            } else if (change.type === 'removed') {
                                return (
                                    <div key={idx} className="flex bg-red-50/70 hover:bg-red-100/70 transition-colors py-0.5 border-l-2 border-red-500">
                                        <span className="w-8 text-right pr-3 text-red-300 select-none text-xs leading-5">{change.lineNum1}</span>
                                        <span className="w-8 text-right pr-3 text-transparent select-none text-xs leading-5">-</span>
                                        <span className="text-red-700 pl-3 border-l border-red-100 flex-1 leading-5 whitespace-pre-wrap break-all">{change.value}</span>
                                    </div>
                                );
                            } else {
                                return (
                                    <div key={idx} className="flex bg-green-50/70 hover:bg-green-100/70 transition-colors py-0.5 border-l-2 border-green-500">
                                        <span className="w-8 text-right pr-3 text-transparent select-none text-xs leading-5">-</span>
                                        <span className="w-8 text-right pr-3 text-green-300 select-none text-xs leading-5">{change.lineNum2}</span>
                                        <span className="text-green-700 pl-3 border-l border-green-100 flex-1 leading-5 whitespace-pre-wrap break-all">{change.value}</span>
                                    </div>
                                );
                            }
                        });
                    })()}
                 </div>
            </CardContent>
        </Card>
    );
};
