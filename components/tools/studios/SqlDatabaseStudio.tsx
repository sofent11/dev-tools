import React from 'react';
import { Database, Server } from 'lucide-react';
import { TabbedToolbox, SubTool, lazyNamed } from '../shared/TabbedToolbox';

const SqlFormatterTool = lazyNamed(() => import('../DataTools'), 'SqlFormatterTool');
const SqliteSandboxTool = lazyNamed(() => import('../DataTools'), 'SqliteSandboxTool');

const subTools: SubTool[] = [
  { id: 'sql-format', name: 'SQL 格式化', description: '方言格式化 / 压缩', icon: Database, component: SqlFormatterTool },
  { id: 'sqlite-sandbox', name: 'SQLite WASM 沙箱', description: '离线 SQLite 数据库', icon: Server, component: SqliteSandboxTool },
];

export const SqlDatabaseStudio: React.FC = () => (
  <TabbedToolbox
    title="SQL 与本地数据库工作室"
    description="将 SQL 文本处理与浏览器本地 SQLite 沙箱集中放置，便于快速验证查询、结构与数据样例"
    tools={subTools}
    defaultTab="sql-format"
  />
);
