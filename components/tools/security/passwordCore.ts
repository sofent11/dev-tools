export type PasswordOptions = {
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
};

const CHAR_SETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+~`|}{[]:;?><,./-=',
};

export const buildPasswordCharset = (opts: PasswordOptions) => {
  let chars = '';
  if (opts.uppercase) chars += CHAR_SETS.uppercase;
  if (opts.lowercase) chars += CHAR_SETS.lowercase;
  if (opts.numbers) chars += CHAR_SETS.numbers;
  if (opts.symbols) chars += CHAR_SETS.symbols;
  return chars;
};

export const generateUnbiasedPassword = (len: number, opts: PasswordOptions) => {
  const charSet = buildPasswordCharset(opts);
  if (!charSet) return '';

  const values = new Uint32Array(1);
  const maxValid = Math.floor(0x100000000 / charSet.length) * charSet.length;

  let result = '';
  while (result.length < len) {
    crypto.getRandomValues(values);
    const value = values[0];
    if (value >= maxValid) continue;
    result += charSet[value % charSet.length];
  }
  return result;
};
