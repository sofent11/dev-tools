import React from 'react';
import { Braces, Code, Database, FileCode, FileJson, FileSpreadsheet, GitCompareArrows } from 'lucide-react';
import { TabbedToolbox, SubTool, lazyNamed } from '../shared/TabbedToolbox';

const JsonTool = lazyNamed(() => import('../FormatConverters'), 'JsonTool');
const JsonToTsTool = lazyNamed(() => import('../JsonToTsTool'), 'JsonToTsTool');
const XmlTool = lazyNamed(() => import('../FormatTools'), 'XmlTool');
const YamlTool = lazyNamed(() => import('../FormatTools'), 'YamlTool');
const CsvTool = lazyNamed(() => import('../FormatTools'), 'CsvTool');
const JsonDiffTool = lazyNamed(() => import('../DataTools'), 'JsonDiffTool');
const JsonSchemaTool = lazyNamed(() => import('../DataTools'), 'JsonSchemaTool');

const subTools: SubTool[] = [
  { id: 'json', name: 'JSON 格式化', description: '美化与压缩', icon: FileJson, component: JsonTool },
  { id: 'json2ts', name: 'JSON 转代码', description: '转 TS/Go/Java/Pydantic/SQL', icon: Code, component: JsonToTsTool },
  { id: 'json-schema', name: 'JSON Schema', description: '生成与校验 JSON Schema 规范', icon: FileCode, component: JsonSchemaTool },
  { id: 'xml', name: 'XML 工具', description: '格式化 / JSON 转换', icon: Braces, component: XmlTool },
  { id: 'yaml', name: 'YAML ↔ JSON', description: 'YAML / JSON 互转', icon: Database, component: YamlTool },
  { id: 'csv', name: 'CSV ↔ JSON', description: 'CSV / JSON 互转', icon: FileSpreadsheet, component: CsvTool },
  { id: 'json-diff', name: 'JSON 结构化对比', description: '树状增删改对比', icon: GitCompareArrows, component: JsonDiffTool },
];

export const DataFormatStudio: React.FC = () => (
  <TabbedToolbox
    title="数据格式与结构工作室"
    description="围绕结构化数据的格式化、转换、Schema 生成与差异对比组织，适合 API、配置与数据建模场景"
    tools={subTools}
    defaultTab="json"
  />
);
