export type DiffKind = 'same' | 'added' | 'removed' | 'changed';
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type MutableJsonContainer = JsonValue[] | { [key: string]: JsonValue };

export interface DiffNode {
  key: string;
  path: Array<string | number>;
  displayPath: string;
  kind: DiffKind;
  left?: JsonValue;
  right?: JsonValue;
  children?: DiffNode[];
}

export interface JsonPatchOp {
  op: 'add' | 'remove' | 'replace';
  path: string;
  value?: JsonValue;
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const getDiffContainerValue = (
  container: Record<string, JsonValue> | JsonValue[],
  key: string,
): JsonValue => (Array.isArray(container) ? container[Number(key)] : container[key]);

const stableStringify = (value: JsonValue | undefined): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key] as JsonValue)}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

export const previewValue = (value: JsonValue | undefined) => {
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return String(value);
  return JSON.stringify(value);
};

const formatJsonPath = (segments: Array<string | number>): string =>
  segments.reduce<string>((path, segment) => {
    if (typeof segment === 'number') return `${path}[${segment}]`;
    if (/^[A-Za-z_$][\w$]*$/.test(segment)) return `${path}.${segment}`;
    return `${path}[${JSON.stringify(segment)}]`;
  }, 'root');

export const toJsonPointer = (segments: Array<string | number>) =>
  segments.length === 0
    ? ''
    : `/${segments.map(segment => String(segment).replace(/~/g, '~0').replace(/\//g, '~1')).join('/')}`;

const compareJsonPathForPatch = (a: Array<string | number>, b: Array<string | number>) => {
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    const aSegment = a[i];
    const bSegment = b[i];
    if (aSegment === undefined) return -1;
    if (bSegment === undefined) return 1;
    if (typeof aSegment === 'number' && typeof bSegment === 'number' && aSegment !== bSegment) {
      return bSegment - aSegment;
    }
    const diff = String(aSegment).localeCompare(String(bSegment));
    if (diff !== 0) return diff;
  }
  return 0;
};

export const buildDiff = (left: JsonValue, right: JsonValue, key = 'root', path: Array<string | number> = []): DiffNode => {
  const displayPath = formatJsonPath(path);
  if (stableStringify(left) === stableStringify(right)) {
    return { key, path, displayPath, kind: 'same', left, right };
  }

  const bothArrays = Array.isArray(left) && Array.isArray(right);
  const bothObjects = isRecord(left) && isRecord(right);

  if (bothArrays || bothObjects) {
    const leftContainer = left as Record<string, JsonValue> | JsonValue[];
    const rightContainer = right as Record<string, JsonValue> | JsonValue[];
    const keys = Array.from(
      new Set([...Object.keys(leftContainer), ...Object.keys(rightContainer)]),
    ).sort((a, b) => {
      const aNum = Number(a);
      const bNum = Number(b);
      if (Number.isInteger(aNum) && Number.isInteger(bNum)) return aNum - bNum;
      return a.localeCompare(b);
    });

    const children: DiffNode[] = keys.map(childKey => {
      const hasLeft = Object.prototype.hasOwnProperty.call(leftContainer, childKey);
      const hasRight = Object.prototype.hasOwnProperty.call(rightContainer, childKey);
      const childSegment = bothArrays ? Number(childKey) : childKey;
      const childPath = [...path, childSegment];
      if (!hasLeft) return { key: childKey, path: childPath, displayPath: formatJsonPath(childPath), kind: 'added' as const, right: getDiffContainerValue(rightContainer, childKey) };
      if (!hasRight) return { key: childKey, path: childPath, displayPath: formatJsonPath(childPath), kind: 'removed' as const, left: getDiffContainerValue(leftContainer, childKey) };
      return buildDiff(
        getDiffContainerValue(leftContainer, childKey),
        getDiffContainerValue(rightContainer, childKey),
        childKey,
        childPath,
      );
    });

    return {
      key,
      path,
      displayPath,
      kind: children.some(child => child.kind !== 'same') ? 'changed' : 'same',
      left,
      right,
      children,
    };
  }

  return { key, path, displayPath, kind: 'changed', left, right };
};

export const countDiffs = (node: DiffNode): Record<DiffKind, number> => {
  const counts: Record<DiffKind, number> = { same: 0, added: 0, removed: 0, changed: 0 };
  const visit = (item: DiffNode) => {
    counts[item.kind] += 1;
    item.children?.forEach(visit);
  };
  visit(node);
  return counts;
};

const cloneJsonContainer = (value: JsonValue): MutableJsonContainer =>
  Array.isArray(value) ? [...value] : isRecord(value) ? { ...value } as { [key: string]: JsonValue } : {};

const getJsonChild = (container: MutableJsonContainer, segment: string | number): JsonValue | undefined =>
  Array.isArray(container) ? container[Number(segment)] : container[String(segment)];

const setJsonChild = (container: MutableJsonContainer, segment: string | number, value: JsonValue) => {
  if (Array.isArray(container)) {
    container[Number(segment)] = value;
  } else {
    container[String(segment)] = value;
  }
};

export const setValueAtPath = (obj: JsonValue, path: (string | number)[], value: JsonValue | undefined): JsonValue => {
  if (value === undefined) return obj;
  if (path.length === 0) return value;
  const newObj = cloneJsonContainer(obj);
  let curr = newObj;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = path[i];
    const nextSeg = path[i + 1];
    const isNextArray = typeof nextSeg === 'number';
    const currentChild = getJsonChild(curr, seg);
    if (currentChild === undefined || currentChild === null) {
      setJsonChild(curr, seg, isNextArray ? [] : {});
    } else {
      setJsonChild(curr, seg, cloneJsonContainer(currentChild));
    }
    curr = getJsonChild(curr, seg) as MutableJsonContainer;
  }
  const lastSeg = path[path.length - 1];
  setJsonChild(curr, lastSeg, value);
  return newObj;
};

export const deleteValueAtPath = (obj: JsonValue, path: (string | number)[]): JsonValue => {
  if (path.length === 0) return obj;
  const newObj = cloneJsonContainer(obj);
  let curr = newObj;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = path[i];
    const currentChild = getJsonChild(curr, seg);
    if (currentChild === undefined || currentChild === null) return obj;
    setJsonChild(curr, seg, cloneJsonContainer(currentChild));
    curr = getJsonChild(curr, seg) as MutableJsonContainer;
  }
  const lastSeg = path[path.length - 1];
  if (Array.isArray(curr)) {
    curr.splice(Number(lastSeg), 1);
  } else {
    delete curr[lastSeg];
  }
  return newObj;
};

export const generateJsonPatch = (node: DiffNode): JsonPatchOp[] => {
  const ops: JsonPatchOp[] = [];
  const visit = (n: DiffNode) => {
    if (n.kind === 'added') {
      ops.push({
        op: 'add',
        path: toJsonPointer(n.path),
        value: n.right,
      });
    } else if (n.kind === 'removed') {
      ops.push({
        op: 'remove',
        path: toJsonPointer(n.path),
      });
    } else if (n.kind === 'changed' && !n.children) {
      ops.push({
        op: 'replace',
        path: toJsonPointer(n.path),
        value: n.right,
      });
    }
    n.children?.forEach(visit);
  };
  visit(node);
  return ops.sort((a, b) => {
    if (a.op === 'remove' && b.op === 'remove') {
      return compareJsonPathForPatch(
        b.path.split('/').slice(1).map(segment => (/^\d+$/.test(segment) ? Number(segment) : segment)),
        a.path.split('/').slice(1).map(segment => (/^\d+$/.test(segment) ? Number(segment) : segment)),
      );
    }
    if (a.op === 'remove') return -1;
    if (b.op === 'remove') return 1;
    return 0;
  });
};
