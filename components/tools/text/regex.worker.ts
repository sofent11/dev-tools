export interface RegexMatch { value: string; index: number; groups: Array<string | undefined> }
self.onmessage = (event: MessageEvent<{ pattern: string; flags: string; text: string }>) => {
  try {
    const { pattern, flags, text } = event.data;
    if (text.length > 1_000_000 || pattern.length > 10_000) throw new Error('Input limit: 1 MB text and 10 KB pattern');
    const regex = new RegExp(pattern, flags);
    const result: RegexMatch[] = [];
    const collect = (match: RegExpExecArray) => result.push({ value: match[0], index: match.index, groups: match.slice(1) });
    if (!regex.global) {
      const match = regex.exec(text);
      if (match) collect(match);
    } else {
      for (const match of text.matchAll(regex)) {
        if (result.length >= 1000) throw new Error('More than 1,000 matches; narrow the expression.');
        collect(match);
      }
    }
    self.postMessage({ result });
  } catch (error) { self.postMessage({ error: (error as Error).message }); }
};
