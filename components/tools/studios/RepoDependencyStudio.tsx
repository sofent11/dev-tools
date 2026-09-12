import React from 'react';
import { Archive, Boxes, GitBranch, Network, PackageCheck, ShieldCheck } from 'lucide-react';
import { TabbedToolbox, SubTool, lazyNamed } from '../shared/TabbedToolbox';

const GitHubRepoExplorerTool = lazyNamed(() => import('../repository'), 'GitHubRepoExplorerTool');
const GitHubOrganizationResearchTool = lazyNamed(() => import('../repository'), 'GitHubOrganizationResearchTool');
const RepositoryFolderDownloaderTool = lazyNamed(() => import('../repository'), 'RepositoryFolderDownloaderTool');
const NuGetDependencyVisualizerTool = lazyNamed(() => import('../repository'), 'NuGetDependencyVisualizerTool');
const PyPiDependencyExplorerTool = lazyNamed(() => import('../repository'), 'PyPiDependencyExplorerTool');
const RustDependencyVisualizerTool = lazyNamed(() => import('../repository'), 'RustDependencyVisualizerTool');
const NuGetSignatureInspectorTool = lazyNamed(() => import('../repository'), 'NuGetSignatureInspectorTool');

const subTools: SubTool[] = [
  { id: 'github-repos', name: 'GitHub 仓库浏览器', description: '用户/组织仓库缓存、筛选与 Release 资产检查', icon: GitBranch, component: GitHubRepoExplorerTool },
  { id: 'github-org-research', name: 'GitHub 组织关联研究', description: '基于验证域名和共享成员分析组织关联', icon: Network, component: GitHubOrganizationResearchTool },
  { id: 'repo-folder-download', name: '仓库文件夹下载', description: 'GitHub 与 HuggingFace 文件夹递归选择下载', icon: Archive, component: RepositoryFolderDownloaderTool },
  { id: 'nuget-deps', name: 'NuGet 依赖树', description: '递归依赖、命名空间过滤和 verified prefix 标记', icon: Boxes, component: NuGetDependencyVisualizerTool },
  { id: 'pypi-deps', name: 'PyPI 依赖树', description: 'Python 包依赖、extras 和维护者过滤', icon: PackageCheck, component: PyPiDependencyExplorerTool },
  { id: 'rust-deps', name: 'Rust Crate 依赖树', description: 'crates.io 递归依赖和深度控制', icon: Boxes, component: RustDependencyVisualizerTool },
  { id: 'nuget-signature', name: 'NuGet 签名检查', description: '本地解析 nupkg 签名、证书链和指纹', icon: ShieldCheck, component: NuGetSignatureInspectorTool },
];

export const RepoDependencyStudio: React.FC = () => {
  return (
    <TabbedToolbox
      title="仓库与依赖研究工作室"
      description="面向开源仓库盘点、远程文件夹下载、依赖树追踪和 NuGet 签名证书检查的浏览器端研究工具"
      tools={subTools}
      defaultTab="github-repos"
    />
  );
};

