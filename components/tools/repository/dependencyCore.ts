import type { DependencyLimits, DependencyNode, DependencyProvider } from './types';

export const DEFAULT_DEPENDENCY_LIMITS: DependencyLimits = {
  maxDepth: 4,
  maxNodes: 250,
};

export const createDependencyNode = (
  provider: DependencyProvider,
  name: string,
  version = 'latest',
  extra: Partial<DependencyNode> = {},
): DependencyNode => ({
  provider,
  name,
  version,
  children: [],
  ...extra,
});

export const normalizeNuGetVersionConstraint = (constraint?: string | null) => {
  if (!constraint || constraint === '*') return null;
  const clean = constraint
    .replaceAll('[', ' ')
    .replaceAll(']', ' ')
    .replace(/[(),]/g, ' ')
    .trim()
    .split(/\s+/)[0];
  return clean || null;
};

export interface ParsedPyPiRequirement {
  name: string | null;
  extra: string | null;
}

export const parsePyPiRequirement = (requirement: string): ParsedPyPiRequirement => {
  const [spec, marker] = requirement.split(';');
  const name = spec.trim().match(/^([A-Za-z0-9_.-]+)/)?.[1] || null;
  const extra = marker?.match(/extra\s*==\s*['"]([^'"]+)['"]/i)?.[1]?.toLowerCase() || null;
  return { name, extra };
};

export const shouldIncludePyPiRequirement = (
  requirement: string,
  requestedExtras: string[],
  isRoot: boolean,
) => {
  const parsed = parsePyPiRequirement(requirement);
  if (!parsed.name) return false;
  if (!parsed.extra) return true;
  return isRoot && (requestedExtras.includes('all') || requestedExtras.includes(parsed.extra));
};

export const flattenDependencyTree = (node: DependencyNode) => {
  const seen = new Map<string, DependencyNode>();
  const visit = (current: DependencyNode) => {
    const key = `${current.provider}:${current.name.toLowerCase()}:${current.version}`;
    if (!seen.has(key)) seen.set(key, current);
    current.children.forEach(visit);
  };
  visit(node);
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
};

export const createDependencyBudget = (limits: DependencyLimits = DEFAULT_DEPENDENCY_LIMITS) => {
  let nodes = 0;
  return {
    canVisit(depth: number) {
      if (depth > limits.maxDepth) return false;
      if (nodes >= limits.maxNodes) return false;
      nodes += 1;
      return true;
    },
    get count() {
      return nodes;
    },
  };
};

export const collectNamespaces = (node: DependencyNode) => {
  const namespaces = new Map<string, { count: number; verified: boolean }>();
  const visit = (current: DependencyNode) => {
    const namespace = current.namespace || current.name.split('.')[0] || current.name;
    const previous = namespaces.get(namespace) || { count: 0, verified: false };
    namespaces.set(namespace, {
      count: previous.count + 1,
      verified: previous.verified || Boolean(current.verified),
    });
    current.children.forEach(visit);
  };
  visit(node);
  return namespaces;
};
