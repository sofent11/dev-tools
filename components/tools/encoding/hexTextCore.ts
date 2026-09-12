export type HexTextEncoding =
  | 'utf-8'
  | 'utf-16le'
  | 'utf-16be'
  | 'windows-1252'
  | 'iso-8859-1'
  | 'latin1';

export interface HexDecodeResult {
  bytes: Uint8Array;
  text: string;
  byteLength: number;
  encoding: HexTextEncoding;
}

export const HEX_TEXT_ENCODINGS: Array<{ value: HexTextEncoding; label: string }> = [
  { value: 'utf-8', label: 'UTF-8' },
  { value: 'utf-16le', label: 'UTF-16 LE' },
  { value: 'utf-16be', label: 'UTF-16 BE' },
  { value: 'windows-1252', label: 'Windows-1252' },
  { value: 'iso-8859-1', label: 'ISO-8859-1' },
  { value: 'latin1', label: 'Latin-1' },
];

export const cleanHexInput = (input: string) => {
  const normalized = input
    .replace(/\\x/gi, '')
    .replace(/0x/gi, '')
    .replace(/[-\s,_:;]/g, '');

  if (!normalized) return '';
  if (/[^0-9a-f]/i.test(normalized)) {
    throw new Error('HEX_ILLEGAL_CHARACTER');
  }
  if (normalized.length % 2 !== 0) {
    throw new Error('HEX_ODD_LENGTH');
  }
  return normalized.toUpperCase();
};

export const hexToBytes = (input: string) => {
  const clean = cleanHexInput(input);
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = Number.parseInt(clean.slice(i, i + 2), 16);
  }
  return bytes;
};

const textDecoderLabel = (encoding: HexTextEncoding) => (
  encoding === 'latin1' ? 'iso-8859-1' : encoding
);

export const decodeHexText = (
  input: string,
  encoding: HexTextEncoding = 'utf-8',
): HexDecodeResult => {
  const bytes = hexToBytes(input);
  try {
    const decoder = new TextDecoder(textDecoderLabel(encoding), { fatal: true });
    return {
      bytes,
      text: decoder.decode(bytes),
      byteLength: bytes.byteLength,
      encoding,
    };
  } catch {
    throw new Error('HEX_DECODE_FAILED');
  }
};
