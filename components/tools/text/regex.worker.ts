self.onmessage = (event: MessageEvent<{ pattern: string; flags: string; text: string }>) => {
  try {
    const { pattern, flags, text } = event.data;
    if (text.length > 1_000_000 || pattern.length > 10_000) throw new Error('Input limit: 1 MB text and 10 KB pattern');
    const regex = new RegExp(pattern, flags);
    const result: string[] = [];
    if (!regex.global) result.push(...(regex.exec(text) || []));
    else {
      for (const match of text.matchAll(regex)) {
        if (result.length >= 1000) throw new Error('More than 1,000 matches; narrow the expression.');
        result.push(match[0]);
      }
    }
    self.postMessage({ result });
  } catch (error) { self.postMessage({ error: (error as Error).message }); }
};
export {};
