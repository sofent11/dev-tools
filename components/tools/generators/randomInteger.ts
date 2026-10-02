const UINT32_RANGE = 2 ** 32;
/** Rejection sampling avoids giving low residues extra probability. */
export const randomInteger = (min: number, max: number, nextWord = () => crypto.getRandomValues(new Uint32Array(1))[0]): number => {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min || max - min >= UINT32_RANGE) throw new Error('随机整数范围无效');
  const range = max - min + 1;
  const limit = Math.floor(UINT32_RANGE / range) * range;
  let word: number;
  do { word = nextWord(); } while (word >= limit);
  return min + word % range;
};
