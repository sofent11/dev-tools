import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';

interface PermissionGroupProps {
    label: string;
    role: 'owner' | 'group' | 'public';
    permissions: {
        owner: { read: boolean; write: boolean; execute: boolean; };
        group: { read: boolean; write: boolean; execute: boolean; };
        public: { read: boolean; write: boolean; execute: boolean; };
    };
    toggle: (role: 'owner' | 'group' | 'public', perm: 'read' | 'write' | 'execute') => void;
}

const PermissionGroup: React.FC<PermissionGroupProps> = ({ label, role, permissions, toggle }) => (
    <div className="flex flex-col gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <span className="font-semibold text-slate-700">{label}</span>
        <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={permissions[role].read} onChange={() => toggle(role, 'read')} className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500" />
                <span className="text-sm">Read (4)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={permissions[role].write} onChange={() => toggle(role, 'write')} className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500" />
                <span className="text-sm">Write (2)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={permissions[role].execute} onChange={() => toggle(role, 'execute')} className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500" />
                <span className="text-sm">Execute (1)</span>
            </label>
        </div>
    </div>
);

export const ChmodTool: React.FC = () => {
  const [permissions, setPermissions] = useState({
    owner: { read: true, write: true, execute: false }, // 6
    group: { read: true, write: false, execute: false }, // 4
    public: { read: true, write: false, execute: false }, // 4
  });

  const [octal, setOctal] = useState('644');
  const [symbolic, setSymbolic] = useState('-rw-r--r--');

  const calculate = () => {
    const calcDigit = (p: typeof permissions.owner) => (p.read ? 4 : 0) + (p.write ? 2 : 0) + (p.execute ? 1 : 0);
    const o = calcDigit(permissions.owner);
    const g = calcDigit(permissions.group);
    const p = calcDigit(permissions.public);
    
    setOctal(`${o}${g}${p}`);

    const sym = (p: typeof permissions.owner) => 
        (p.read ? 'r' : '-') + (p.write ? 'w' : '-') + (p.execute ? 'x' : '-');
    
    setSymbolic(`-${sym(permissions.owner)}${sym(permissions.group)}${sym(permissions.public)}`);
  };

  useEffect(() => {
    calculate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissions]);

  const toggle = (role: 'owner' | 'group' | 'public', perm: 'read' | 'write' | 'execute') => {
      setPermissions(prev => ({
          ...prev,
          [role]: { ...prev[role], [perm]: !prev[role][perm] }
      }));
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader title="Chmod 计算器" description="Linux 文件权限计算 (Octal & Symbolic)。" />
      <CardContent className="flex-1 flex flex-col gap-6">
        <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 bg-slate-900 text-white p-6 rounded-xl flex flex-col items-center justify-center">
                 <div className="text-sm text-slate-400 mb-2 uppercase tracking-widest font-bold">Octal Value</div>
                 <div className="text-5xl font-mono font-bold text-green-400">{octal}</div>
                 <div className="mt-4 text-sm text-slate-500">chmod {octal} filename</div>
            </div>
            <div className="flex-1 bg-slate-800 text-white p-6 rounded-xl flex flex-col items-center justify-center">
                 <div className="text-sm text-slate-400 mb-2 uppercase tracking-widest font-bold">Symbolic Value</div>
                 <div className="text-3xl font-mono font-bold text-yellow-400 tracking-wider">{symbolic}</div>
            </div>
        </div>

        <div className="space-y-4">
            <PermissionGroup label="Owner" role="owner" permissions={permissions} toggle={toggle} />
            <PermissionGroup label="Group" role="group" permissions={permissions} toggle={toggle} />
            <PermissionGroup label="Public" role="public" permissions={permissions} toggle={toggle} />
        </div>
      </CardContent>
    </Card>
  );
};
