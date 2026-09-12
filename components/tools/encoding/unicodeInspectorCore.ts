export interface UnicodeCharacterDetail {
  char: string;
  codePoint: number;
  codePointLabel: string;
  name: string;
  block: string;
  utf8Hex: string;
  utf16Hex: string;
  utf16LeHex: string;
}

export interface UnicodeBlockSummary {
  block: string;
  count: number;
}

export interface EmojiSequenceDetail {
  sequence: string;
  codePoints: string;
  name: string;
}

export interface UnicodeAnalysisResult {
  characters: UnicodeCharacterDetail[];
  blocks: UnicodeBlockSummary[];
  emojiSequences: EmojiSequenceDetail[];
}

export type UnicodeNameMap = Map<number, string>;

const COMMON_BLOCKS: Array<{ start: number; end: number; name: string }> = [
  { start: 0x0000, end: 0x007f, name: 'Basic Latin' },
  { start: 0x0080, end: 0x00ff, name: 'Latin-1 Supplement' },
  { start: 0x0100, end: 0x017f, name: 'Latin Extended-A' },
  { start: 0x0180, end: 0x024f, name: 'Latin Extended-B' },
  { start: 0x0250, end: 0x02af, name: 'IPA Extensions' },
  { start: 0x0300, end: 0x036f, name: 'Combining Diacritical Marks' },
  { start: 0x0370, end: 0x03ff, name: 'Greek and Coptic' },
  { start: 0x0400, end: 0x04ff, name: 'Cyrillic' },
  { start: 0x0590, end: 0x05ff, name: 'Hebrew' },
  { start: 0x0600, end: 0x06ff, name: 'Arabic' },
  { start: 0x0900, end: 0x097f, name: 'Devanagari' },
  { start: 0x2000, end: 0x206f, name: 'General Punctuation' },
  { start: 0x20a0, end: 0x20cf, name: 'Currency Symbols' },
  { start: 0x2100, end: 0x214f, name: 'Letterlike Symbols' },
  { start: 0x2190, end: 0x21ff, name: 'Arrows' },
  { start: 0x2200, end: 0x22ff, name: 'Mathematical Operators' },
  { start: 0x2460, end: 0x24ff, name: 'Enclosed Alphanumerics' },
  { start: 0x2500, end: 0x257f, name: 'Box Drawing' },
  { start: 0x2580, end: 0x259f, name: 'Block Elements' },
  { start: 0x25a0, end: 0x25ff, name: 'Geometric Shapes' },
  { start: 0x2600, end: 0x26ff, name: 'Miscellaneous Symbols' },
  { start: 0x2700, end: 0x27bf, name: 'Dingbats' },
  { start: 0x2e80, end: 0x2eff, name: 'CJK Radicals Supplement' },
  { start: 0x2f00, end: 0x2fdf, name: 'Kangxi Radicals' },
  { start: 0x3000, end: 0x303f, name: 'CJK Symbols and Punctuation' },
  { start: 0x3040, end: 0x309f, name: 'Hiragana' },
  { start: 0x30a0, end: 0x30ff, name: 'Katakana' },
  { start: 0x3100, end: 0x312f, name: 'Bopomofo' },
  { start: 0x3130, end: 0x318f, name: 'Hangul Compatibility Jamo' },
  { start: 0x31c0, end: 0x31ef, name: 'CJK Strokes' },
  { start: 0x3400, end: 0x4dbf, name: 'CJK Unified Ideographs Extension A' },
  { start: 0x4e00, end: 0x9fff, name: 'CJK Unified Ideographs' },
  { start: 0xac00, end: 0xd7af, name: 'Hangul Syllables' },
  { start: 0xe000, end: 0xf8ff, name: 'Private Use Area' },
  { start: 0xfe00, end: 0xfe0f, name: 'Variation Selectors' },
  { start: 0xff00, end: 0xffef, name: 'Halfwidth and Fullwidth Forms' },
  { start: 0x1f000, end: 0x1f02f, name: 'Mahjong Tiles' },
  { start: 0x1f0a0, end: 0x1f0ff, name: 'Playing Cards' },
  { start: 0x1f300, end: 0x1f5ff, name: 'Miscellaneous Symbols and Pictographs' },
  { start: 0x1f600, end: 0x1f64f, name: 'Emoticons' },
  { start: 0x1f680, end: 0x1f6ff, name: 'Transport and Map Symbols' },
  { start: 0x1f700, end: 0x1f77f, name: 'Alchemical Symbols' },
  { start: 0x1f900, end: 0x1f9ff, name: 'Supplemental Symbols and Pictographs' },
  { start: 0x20000, end: 0x2a6df, name: 'CJK Unified Ideographs Extension B' },
];

const CONTROL_NAMES = new Map<number, string>([
  [0x0000, 'NULL'],
  [0x0009, 'CHARACTER TABULATION'],
  [0x000a, 'LINE FEED'],
  [0x000d, 'CARRIAGE RETURN'],
  [0x0020, 'SPACE'],
]);

export const BUILT_IN_EMOJI_SEQUENCES = new Map<string, string>([
  ['👨‍👩‍👧‍👦', 'family: man, woman, girl, boy'],
  ['👩‍💻', 'woman technologist'],
  ['👨‍💻', 'man technologist'],
  ['🧑‍💻', 'technologist'],
  ['🏳️‍🌈', 'rainbow flag'],
  ['🏴‍☠️', 'pirate flag'],
  ['❤️', 'red heart'],
  ['👍', 'thumbs up'],
  ['👋', 'waving hand'],
]);

export const formatCodePoint = (codePoint: number) =>
  `U+${codePoint.toString(16).toUpperCase().padStart(codePoint > 0xffff ? 6 : 4, '0')}`;

export const findUnicodeBlock = (codePoint: number) =>
  COMMON_BLOCKS.find(block => codePoint >= block.start && codePoint <= block.end)?.name || 'Unassigned / Unknown';

const bytesToHex = (bytes: Uint8Array | number[]) =>
  Array.from(bytes).map(value => value.toString(16).toUpperCase().padStart(2, '0')).join(' ');

export const getUtf8HexBytes = (char: string) => bytesToHex(new TextEncoder().encode(char));

export const getUtf16HexCodeUnits = (char: string) => {
  const units: number[] = [];
  for (let i = 0; i < char.length; i += 1) {
    const unit = char.charCodeAt(i);
    units.push((unit >> 8) & 0xff, unit & 0xff);
  }
  return bytesToHex(units);
};

export const getUtf16LeHexCodeUnits = (char: string) => {
  const units: number[] = [];
  for (let i = 0; i < char.length; i += 1) {
    const unit = char.charCodeAt(i);
    units.push(unit & 0xff, (unit >> 8) & 0xff);
  }
  return bytesToHex(units);
};

export const parseUnicodeDataText = (text: string): UnicodeNameMap => {
  const map: UnicodeNameMap = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [hex, name] = line.split(';');
    const codePoint = Number.parseInt(hex, 16);
    if (Number.isFinite(codePoint) && name) map.set(codePoint, name);
  }
  return map;
};

const fallbackName = (codePoint: number, char: string) => {
  const control = CONTROL_NAMES.get(codePoint);
  if (control) return control;
  if (codePoint >= 0x41 && codePoint <= 0x5a) return `LATIN CAPITAL LETTER ${char}`;
  if (codePoint >= 0x61 && codePoint <= 0x7a) return `LATIN SMALL LETTER ${char.toUpperCase()}`;
  if (codePoint >= 0x30 && codePoint <= 0x39) return `DIGIT ${char}`;
  return `${formatCodePoint(codePoint)} (${findUnicodeBlock(codePoint)})`;
};

export const describeUnicodeCharacter = (
  char: string,
  nameMap: UnicodeNameMap = new Map(),
): UnicodeCharacterDetail => {
  const codePoint = char.codePointAt(0) || 0;
  return {
    char,
    codePoint,
    codePointLabel: formatCodePoint(codePoint),
    name: nameMap.get(codePoint) || BUILT_IN_EMOJI_SEQUENCES.get(char) || fallbackName(codePoint, char),
    block: findUnicodeBlock(codePoint),
    utf8Hex: getUtf8HexBytes(char),
    utf16Hex: getUtf16HexCodeUnits(char),
    utf16LeHex: getUtf16LeHexCodeUnits(char),
  };
};

export const lookupByCodePoint = (input: string, nameMap: UnicodeNameMap = new Map()) => {
  const clean = input.trim().replace(/^U\+/i, '').replace(/^0x/i, '');
  const codePoint = Number.parseInt(clean, 16);
  if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
    throw new Error('UNICODE_INVALID_CODEPOINT');
  }
  return describeUnicodeCharacter(String.fromCodePoint(codePoint), nameMap);
};

export const searchUnicodeNames = (
  query: string,
  nameMap: UnicodeNameMap = new Map(),
  limit = 50,
) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  const matches: UnicodeCharacterDetail[] = [];

  for (const [codePoint, name] of nameMap.entries()) {
    if (name.toLowerCase().includes(normalized)) {
      matches.push(describeUnicodeCharacter(String.fromCodePoint(codePoint), nameMap));
      if (matches.length >= limit) return matches;
    }
  }

  for (const [sequence, name] of BUILT_IN_EMOJI_SEQUENCES.entries()) {
    if (name.toLowerCase().includes(normalized)) {
      matches.push(describeUnicodeCharacter(sequence, nameMap));
      if (matches.length >= limit) break;
    }
  }

  return matches;
};

export const analyzeUnicodeText = (
  text: string,
  options: { sequential?: boolean; nameMap?: UnicodeNameMap } = {},
): UnicodeAnalysisResult => {
  const { sequential = false, nameMap = new Map() } = options;
  const seen = new Set<string>();
  const chars = Array.from(text);
  const characters = chars
    .filter(char => {
      if (sequential) return true;
      if (seen.has(char)) return false;
      seen.add(char);
      return true;
    })
    .map(char => describeUnicodeCharacter(char, nameMap));

  const blockCounts = new Map<string, number>();
  for (const detail of characters) {
    blockCounts.set(detail.block, (blockCounts.get(detail.block) || 0) + 1);
  }

  const emojiSequences: EmojiSequenceDetail[] = [];
  const sequenceSeen = new Set<string>();
  for (const [sequence, name] of BUILT_IN_EMOJI_SEQUENCES.entries()) {
    let index = text.indexOf(sequence);
    while (index !== -1) {
      if (sequential || !sequenceSeen.has(sequence)) {
        emojiSequences.push({
          sequence,
          name,
          codePoints: Array.from(sequence).map(char => formatCodePoint(char.codePointAt(0) || 0)).join(' '),
        });
        sequenceSeen.add(sequence);
      }
      if (!sequential) break;
      index = text.indexOf(sequence, index + sequence.length);
    }
  }

  return {
    characters,
    blocks: Array.from(blockCounts.entries())
      .map(([block, count]) => ({ block, count }))
      .sort((a, b) => b.count - a.count || a.block.localeCompare(b.block)),
    emojiSequences,
  };
};

