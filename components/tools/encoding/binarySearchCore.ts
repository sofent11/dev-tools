/** Search UTF-8 text or hexadecimal bytes with bounded, overlapping highlights. text: disambiguates hex-like text. */
export const findByteHighlights = (bytes: Uint8Array, query: string, limit = 5000): Set<number> => {
  const highlights = new Set<number>();
  const text = query.trim();
  if (!text || text.length > 1024) return highlights;
  const forceText = text.startsWith('text:');
  const hex = text.replace(/^0x/i, '').replace(/\s/g, '');
  const pattern = !forceText && /^[0-9a-f]+$/i.test(hex) && hex.length % 2 === 0
    ? Uint8Array.from(hex.match(/.{2}/g)!, pair => parseInt(pair, 16))
    : new TextEncoder().encode(forceText ? text.slice(5) : text);
  if (!pattern.length) return highlights;
  const prefix = new Uint32Array(pattern.length);
  for (let i = 1, j = 0; i < pattern.length; i++) {
    while (j && pattern[i] !== pattern[j]) j = prefix[j - 1];
    if (pattern[i] === pattern[j]) j++;
    prefix[i] = j;
  }
  for (let i = 0, j = 0; i < bytes.length && highlights.size < limit; i++) {
    while (j && bytes[i] !== pattern[j]) j = prefix[j - 1];
    if (bytes[i] === pattern[j]) j++;
    if (j === pattern.length) {
      for (let offset = i - j + 1; offset <= i && highlights.size < limit; offset++) highlights.add(offset);
      j = prefix[j - 1];
    }
  }
  return highlights;
};
