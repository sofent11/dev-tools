export const splitIdentifierWords = (value: string): string[] => value
  .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .trim().split(/[\s_-]+/).filter(Boolean);

export const convertIdentifierCase = (value: string, style: string): string => {
  if (style === 'UPPERCASE') return value.toUpperCase();
  if (style === 'lowercase') return value.toLowerCase();
  return value.split(/\r\n|\r|\n/).map(line => {
    const words = splitIdentifierWords(line).map(word => word.toLowerCase());
    const capitalized = words.map(word => word.charAt(0).toUpperCase() + word.slice(1));
    if (style === 'snake_case') return words.join('_');
    if (style === 'kebab-case') return words.join('-');
    if (style === 'PascalCase') return capitalized.join('');
    return (words[0] || '') + capitalized.slice(1).join('');
  }).join('\n');
};

/** Collapse whitespace only outside quoted SQL and comments. Line comment terminators remain significant. */
export const collapseSqlWhitespace = (input: string, mysqlComments = false): string => {
  let output = '';
  let i = 0;
  while (i < input.length) {
    const char = input[i];
    if (/\s/.test(char)) {
      while (i < input.length && /\s/.test(input[i])) i++;
      if (output && !/\s$/.test(output)) output += ' ';
    } else if (input.startsWith('--', i) || (mysqlComments && char === '#')) {
      const nextLine = input.slice(i).search(/[\r\n]/);
      const end = nextLine < 0 ? -1 : i + nextLine;
      if (end < 0) { output += input.slice(i); break; }
      output += input.slice(i, end + 1); i = end + 1;
    } else if (input.startsWith('/*', i)) {
      const end = input.indexOf('*/', i + 2);
      if (end < 0) throw new Error('Unterminated SQL comment');
      output += input.slice(i, end + 2); i = end + 2;
    } else {
      const dollar = char === '$' ? input.slice(i).match(/^\$(?:[a-zA-Z_][a-zA-Z0-9_]*)?\$/)?.[0] : undefined;
      if (dollar) {
        const end = input.indexOf(dollar, i + dollar.length);
        if (end < 0) throw new Error('Unterminated SQL dollar quote');
        output += input.slice(i, end + dollar.length); i = end + dollar.length;
      } else if (char === "'" || char === '"' || char === '`' || char === '[') {
        const endChar = char === '[' ? ']' : char;
        const start = i++;
        let closed = false;
        while (i < input.length) {
          if (input[i] === '\\') { i += 2; continue; }
          if (input[i++] === endChar) {
            if (input[i] === endChar) { i++; continue; }
            closed = true; break;
          }
        }
        if (!closed) throw new Error('Unterminated SQL quote');
        output += input.slice(start, i);
      } else { output += char; i++; }
    }
  }
  return output.trim();
};

const RMB_DIGITS = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
const RMB_UNITS = ['', '拾', '佰', '仟'];
const RMB_SECTIONS = ['', '万', '亿', '兆'];
const sectionToChinese = (section: number): string => {
  let result = '';
  let zero = false;
  for (let unit = 3; unit >= 0; unit--) {
    const digit = Math.floor(section / 10 ** unit) % 10;
    if (digit) {
      if (zero && result) result += '零';
      result += RMB_DIGITS[digit] + RMB_UNITS[unit]; zero = false;
    } else if (result) zero = true;
  }
  return result;
};
export const toRmbUppercase = (value: string): string => {
  const match = value.trim().match(/^(\d+)(?:\.(\d*))?$/);
  const invalid = '请输入 0 到 999999999999999 之间的金额';
  if (!match) return invalid;
  const integer = BigInt(match[1]);
  const decimal = match[2] || '';
  const cents = integer * 100n + BigInt((decimal + '00').slice(0, 2)) + (Number(decimal[2] || '0') >= 5 ? 1n : 0n);
  if (cents > 99999999999999900n) return invalid;
  const sections: number[] = [];
  let remainder = cents / 100n;
  while (remainder) { sections.push(Number(remainder % 10000n)); remainder /= 10000n; }
  let result = '';
  let zero = false;
  for (let i = sections.length - 1; i >= 0; i--) {
    const section = sections[i];
    if (!section) { if (result) zero = true; continue; }
    if (result && (zero || section < 1000)) result += '零';
    result += sectionToChinese(section) + RMB_SECTIONS[i]; zero = false;
  }
  const jiao = Number(cents % 100n / 10n);
  const fen = Number(cents % 10n);
  const tail = !jiao && !fen ? '整' : `${jiao ? RMB_DIGITS[jiao] + '角' : fen ? '零' : ''}${fen ? RMB_DIGITS[fen] + '分' : ''}`;
  return (result || '零') + '元' + tail;
};

export const assertJsonBudget = (value: unknown, maxNodes = 10000): void => {
  const pending = [{ value, depth: 0 }];
  let count = 0;
  while (pending.length) {
    const item = pending.pop()!;
    if (++count > maxNodes || item.depth > 100) throw new Error('JSON limit: 10,000 values and 100 nesting levels');
    if (item.value && typeof item.value === 'object') {
      for (const child of Object.values(item.value)) pending.push({ value: child, depth: item.depth + 1 });
    }
  }
};
