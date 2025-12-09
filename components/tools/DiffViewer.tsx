import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';

export const DiffViewer: React.FC = () => {
    const [oldText, setOldText] = useState('Line 1\nLine 2\nLine 3');
    const [newText, setNewText] = useState('Line 1\nLine 2 Modified\nLine 4');

    return (
        <Card className="h-full flex flex-col">
            <CardHeader title="简易文本对比" description="按行对比两个文本的差异 (简单的逐行比较)。" />
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

                 <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg overflow-auto p-4 font-mono text-sm">
                    {(() => {
                        const lines1 = oldText.split('\n');
                        const lines2 = newText.split('\n');
                        const max = Math.max(lines1.length, lines2.length);
                        const output = [];

                        for (let i = 0; i < max; i++) {
                            const l1 = lines1[i];
                            const l2 = lines2[i];

                            if (l1 === l2) {
                                output.push(
                                    <div key={i} className="flex hover:bg-slate-100">
                                        <span className="w-8 text-right pr-2 text-slate-300 select-none">{i+1}</span>
                                        <span className="text-slate-600 pl-2 border-l border-slate-200 flex-1">{l1}</span>
                                    </div>
                                );
                            } else {
                                if (l1 !== undefined) {
                                    output.push(
                                        <div key={`del-${i}`} className="flex bg-red-50 hover:bg-red-100">
                                            <span className="w-8 text-right pr-2 text-red-300 select-none">-</span>
                                            <span className="text-red-700 pl-2 border-l border-red-200 flex-1">{l1}</span>
                                        </div>
                                    );
                                }
                                if (l2 !== undefined) {
                                    output.push(
                                        <div key={`add-${i}`} className="flex bg-green-50 hover:bg-green-100">
                                            <span className="w-8 text-right pr-2 text-green-300 select-none">+</span>
                                            <span className="text-green-700 pl-2 border-l border-green-200 flex-1">{l2}</span>
                                        </div>
                                    );
                                }
                            }
                        }
                        return output;
                    })()}
                 </div>
            </CardContent>
        </Card>
    )
}
