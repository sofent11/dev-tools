export type RepositoryPlatform = 'github' | 'huggingface-model' | 'huggingface-dataset';

export interface RepositorySource {
  platform: RepositoryPlatform;
  owner: string;
  repo: string;
  branch: string;
  folderPath: string;
  originalUrl: string;
}

export type RemoteFileStatus = 'pending' | 'downloading' | 'completed' | 'failed';

export interface DiscoveredRemoteFile {
  id: string;
  path: string;
  fullPath: string;
  downloadUrl: string;
  size: number;
  selected: boolean;
  status: RemoteFileStatus;
  loadedBytes?: number;
  speedBytesPerSecond?: number;
  error?: string;
}

export interface FileTreeNode {
  name: string;
  path: string;
  size: number;
  selected: boolean;
  partial: boolean;
  children: FileTreeNode[];
  file?: DiscoveredRemoteFile;
}

export interface DependencyNode {
  name: string;
  version: string;
  provider: DependencyProvider;
  children: DependencyNode[];
  rawRequirement?: string;
  namespace?: string;
  owners?: string[];
  verified?: boolean;
  optional?: boolean;
  duplicate?: boolean;
  circular?: boolean;
  error?: string;
  metadata?: Record<string, unknown> | null;
}

export type DependencyProvider = 'nuget' | 'pypi' | 'crates';

export interface DependencyLimits {
  maxDepth: number;
  maxNodes: number;
}

