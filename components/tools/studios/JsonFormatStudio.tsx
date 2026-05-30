import React from 'react';
import { FileJson, FileCode, Database, FileSpreadsheet, Code, GitCompareArrows } from 'lucide-react';
import { TabbedToolbox, SubTool, lazyNamed } from '../shared/TabbedToolbox';

const JsonTool = lazyNamed(() => import('../FormatConverters'), 'JsonTool');
const JsonToTsTool = lazyNamed(() => import('../JsonToTsTool'), 'JsonToTsTool');
const XmlTool = lazyNamed(() => import('../FormatTools'), 'XmlTool');
const YamlTool = lazyNamed(() => import('../FormatTools'), 'YamlTool');
const CsvTool = lazyNamed(() => import('../FormatTools'), 'CsvTool');
const JsonDiffTool = lazyNamed(() => import('../DataTools'), 'JsonDiffTool');
const SqlFormatterTool = lazyNamed(() => import('../DataTools'), 'SqlFormatterTool');

const subTools: SubTool[] = [
  { id: 'json', name: 'JSON 格式化', description: '美化与压缩', icon: FileJson, component: JsonTool },
  { id: 'json2ts', name: 'JSON 转代码', description: '转 TS/Go/Java/Pydantic/SQL', icon: Code, component: JsonToTsTool },
  { id: 'xml', name: 'XML 工具', description: '格式化 / JSON 转换', icon: FileCode, component: XmlTool },
  { id: 'yaml', name: 'YAML ↔ JSON', description: 'YAML / JSON 互转', icon: Database, component: YamlTool },
  { id: 'csv', name: 'CSV ↔ JSON', description: 'CSV / JSON 互转', icon: FileSpreadsheet, component: CsvTool },
  { id: 'json-diff', name: 'JSON 结构化对比', description: '树状增删改对比', icon: GitCompareArrows, component: JsonDiffTool },
  { id: 'sql-format', name: 'SQL 格式化', description: '方言格式化 / 压缩', icon: Database, component: SqlFormatterTool },
];

export const JsonFormatStudio: React.FC = () => {
  return (
    <TabbedToolbox
      title="JSON & 数据格式化工作室"
      description="集成 JSON 格式化、转换、Diff 和常用数据库格式化的一站式数据处理中心"
      tools={subTools}
      defaultTab="json"
    />
  );
};
