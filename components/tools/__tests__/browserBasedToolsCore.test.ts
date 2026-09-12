import { describe, expect, it } from 'vitest';
import { decodeHexText, hexToBytes } from '../encoding/hexTextCore';
import {
  analyzeUnicodeText,
  lookupByCodePoint,
  parseUnicodeDataText,
  searchUnicodeNames,
} from '../encoding/unicodeInspectorCore';
import {
  calculateVisualCentroid,
  parseHexColor,
  removeBackgroundByColor,
  sampleImageDataColor,
} from '../images/visualCentroidCore';
import {
  buildFileTree,
  createRemoteFile,
  parseRepositoryUrl,
  setFileSelectionByPrefix,
} from '../repository/repositoryCore';
import {
  createDependencyBudget,
  createDependencyNode,
  flattenDependencyTree,
  normalizeNuGetVersionConstraint,
  parsePyPiRequirement,
  shouldIncludePyPiRequirement,
} from '../repository/dependencyCore';
import { normalizeFingerprint, parseNuspecMetadata } from '../repository/nugetSignatureCore';

class TestImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;

  constructor(data: Uint8ClampedArray, width: number, height: number) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
}

globalThis.ImageData = TestImageData as unknown as typeof ImageData;

const makeImageData = (width: number, height: number, pixels: number[]) =>
  new ImageData(new Uint8ClampedArray(pixels), width, height);

describe('hex text decoding', () => {
  it('cleans common hex separators and decodes UTF-8', () => {
    const result = decodeHexText('0x48 65-6c:6c,6f \\x20 e4 b8 96 e7 95 8c', 'utf-8');
    expect(result.text).toBe('Hello 世界');
    expect(Array.from(hexToBytes('48 65'))).toEqual([0x48, 0x65]);
  });

  it('rejects odd or illegal hex', () => {
    expect(() => decodeHexText('abc')).toThrow('HEX_ODD_LENGTH');
    expect(() => decodeHexText('zz')).toThrow('HEX_ILLEGAL_CHARACTER');
  });
});

describe('unicode inspector core', () => {
  it('looks up code points and loaded UnicodeData names', () => {
    const names = parseUnicodeDataText('0041;LATIN CAPITAL LETTER A;Lu;0;L;;;;;N;;;;0061;');
    expect(lookupByCodePoint('U+0041', names).name).toBe('LATIN CAPITAL LETTER A');
    expect(searchUnicodeNames('capital letter a', names)[0].char).toBe('A');
  });

  it('summarizes blocks and emoji sequences', () => {
    const result = analyzeUnicodeText('A中👋👋', { sequential: false });
    expect(result.characters.map(char => char.char)).toEqual(['A', '中', '👋']);
    expect(result.blocks.some(block => block.block === 'CJK Unified Ideographs')).toBe(true);
    expect(result.emojiSequences[0].name).toContain('waving');
  });
});

describe('visual centroid core', () => {
  it('calculates centroid and bounding box from alpha threshold', () => {
    const image = makeImageData(3, 3, [
      0, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 255,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255,
    ]);

    const result = calculateVisualCentroid(image, 127);
    expect(result.visiblePixels).toBe(3);
    expect(result.centroid?.x).toBeCloseTo(4 / 3);
    expect(result.centroid?.y).toBeCloseTo(2 / 3);
    expect(result.boundingBox?.center).toEqual({ x: 1, y: 1 });
  });

  it('removes sampled background colors by tolerance', () => {
    const image = makeImageData(1, 2, [
      255, 255, 255, 255,
      10, 20, 30, 255,
    ]);
    const color = sampleImageDataColor(image, 0, 0);
    expect(parseHexColor('#ffffff')).toEqual(color);
    const output = removeBackgroundByColor(image, color, 1);
    expect(output.data[3]).toBe(0);
    expect(output.data[7]).toBe(255);
  });
});

describe('repository folder core', () => {
  it('parses GitHub and HuggingFace folder URLs', () => {
    expect(parseRepositoryUrl('https://github.com/a/b/tree/main/src')).toMatchObject({
      platform: 'github',
      owner: 'a',
      repo: 'b',
      branch: 'main',
      folderPath: 'src',
    });
    expect(parseRepositoryUrl('https://huggingface.co/datasets/org/data/tree/dev/files')).toMatchObject({
      platform: 'huggingface-dataset',
      owner: 'org',
      repo: 'data',
      branch: 'dev',
      folderPath: 'files',
    });
  });

  it('builds file tree selection state', () => {
    const files = [
      createRemoteFile('a/one.txt', 'a/one.txt', 'https://example.com/1', 10),
      createRemoteFile('a/two.txt', 'a/two.txt', 'https://example.com/2', 20),
    ];
    const next = setFileSelectionByPrefix(files, 'a/one.txt', false);
    const tree = buildFileTree(next);
    expect(tree.children[0].partial).toBe(true);
    expect(tree.children[0].size).toBe(30);
  });
});

describe('dependency and NuGet metadata core', () => {
  it('parses package requirements and constraints', () => {
    expect(normalizeNuGetVersionConstraint('[13.0.1, )')).toBe('13.0.1');
    expect(parsePyPiRequirement('urllib3>=1.21.1; extra == "security"')).toEqual({ name: 'urllib3', extra: 'security' });
    expect(shouldIncludePyPiRequirement('urllib3; extra == "security"', ['security'], true)).toBe(true);
    expect(shouldIncludePyPiRequirement('urllib3; extra == "security"', [], true)).toBe(false);
  });

  it('flattens dependency trees and enforces budgets', () => {
    const child = createDependencyNode('pypi', 'urllib3', '2.0');
    const root = createDependencyNode('pypi', 'requests', '1.0', { children: [child] });
    expect(flattenDependencyTree(root).map(node => node.name)).toEqual(['requests', 'urllib3']);

    const budget = createDependencyBudget({ maxDepth: 1, maxNodes: 1 });
    expect(budget.canVisit(0)).toBe(true);
    expect(budget.canVisit(0)).toBe(false);
  });

  it('parses nuspec metadata and formats fingerprints', () => {
    const xml = '<package><metadata><description>desc</description><authors>a</authors><projectUrl>https://x.test</projectUrl><license>MIT</license></metadata></package>';
    expect(parseNuspecMetadata(xml)).toEqual({
      description: 'desc',
      authors: 'a',
      projectUrl: 'https://x.test',
      license: 'MIT',
    });
    expect(normalizeFingerprint('aabb cc')).toBe('AA:BB:CC');
  });
});
