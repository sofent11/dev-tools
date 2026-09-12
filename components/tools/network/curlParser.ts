export type RequestBodyMode = 'raw' | 'form-data';

const stripMatchingQuotes = (value: string) => {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
};

const shellTokenize = (input: string) => {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === '\\' && quote !== "'") {
      escaped = true;
      continue;
    }
    if ((char === '"' || char === "'") && (!quote || quote === char)) {
      quote = quote ? null : char;
      continue;
    }
    if (/\s/.test(char) && !quote) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);
  return tokens;
};

const appendUrlQuery = (targetUrl: string, entries: Array<readonly [string, string]>) => {
  if (!targetUrl || entries.length === 0) return targetUrl;
  try {
    const parsed = new URL(targetUrl);
    entries.forEach(([key, value]) => parsed.searchParams.append(key, value));
    return parsed.toString();
  } catch {
    const query = new URLSearchParams(entries.map(([key, value]) => [key, value])).toString();
    return `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}${query}`;
  }
};

export const parseFormBodyLines = (input: string) =>
  input
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const separatorIndex = line.indexOf('=');
      if (separatorIndex === -1) {
        return [line, ''] as const;
      }
      return [
        line.slice(0, separatorIndex).trim(),
        line.slice(separatorIndex + 1).trim(),
      ] as const;
    })
    .filter(([key]) => key);

export const parseCurlCommand = (curlCmd: string) => {
  const cleanCmd = curlCmd.trim().replace(/\\\s*\n/g, ' ');
  let method = 'GET';
  let url = '';
  const parsedHeaders: Record<string, string> = {};
  const bodyParts: string[] = [];
  const queryEntries: Array<readonly [string, string]> = [];
  const formBodyLines: string[] = [];
  let sendDataAsQuery = false;

  const tokens = shellTokenize(cleanCmd).filter(token => token !== 'curl');

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === '-X' || token === '--request' || token.startsWith('--request=')) {
      const nextMethod = token.startsWith('--request=') ? token.slice('--request='.length) : tokens[i + 1];
      method = nextMethod?.toUpperCase() || 'GET';
      if (!token.startsWith('--request=')) i++;
    } else if (token === '-G' || token === '--get') {
      sendDataAsQuery = true;
    } else if (token === '--url' || token.startsWith('--url=')) {
      url = stripMatchingQuotes(token.startsWith('--url=') ? token.slice('--url='.length) : (tokens[i + 1] || ''));
      if (!token.startsWith('--url=')) i++;
    } else if (token === '-u' || token === '--user' || token.startsWith('--user=')) {
      const userValue = stripMatchingQuotes(token.startsWith('--user=') ? token.slice('--user='.length) : (tokens[i + 1] || ''));
      parsedHeaders.Authorization = `Basic ${btoa(unescape(encodeURIComponent(userValue)))}`;
      if (!token.startsWith('--user=')) i++;
    } else if (token === '-H' || token === '--header' || token.startsWith('--header=')) {
      const headerStr = token.startsWith('--header=') ? token.slice('--header='.length) : (tokens[i + 1] || '');
      const normalizedHeaderStr = stripMatchingQuotes(headerStr);
      const colonIndex = normalizedHeaderStr.indexOf(':');
      if (colonIndex > 0) {
        const key = normalizedHeaderStr.slice(0, colonIndex).trim();
        const value = normalizedHeaderStr.slice(colonIndex + 1).trim();
        parsedHeaders[key] = value;
      }
      if (!token.startsWith('--header=')) i++;
    } else if (
      token === '-d' ||
      token === '--data' ||
      token === '--data-raw' ||
      token === '--data-binary' ||
      token === '--data-urlencode' ||
      token.startsWith('--data=') ||
      token.startsWith('--data-raw=') ||
      token.startsWith('--data-binary=') ||
      token.startsWith('--data-urlencode=')
    ) {
      const payload = token.includes('=') ? token.slice(token.indexOf('=') + 1) : (tokens[i + 1] || '');
      const normalizedPayload = stripMatchingQuotes(payload);
      if (sendDataAsQuery || token.includes('urlencode')) {
        const [key, value = ''] = normalizedPayload.split(/=(.*)/s);
        if (key) queryEntries.push([key, value]);
      } else {
        bodyParts.push(normalizedPayload);
        if (method === 'GET') method = 'POST';
      }
      if (!token.includes('=')) i++;
    } else if (
      token === '-F' ||
      token === '--form' ||
      token === '--form-string' ||
      token.startsWith('--form=') ||
      token.startsWith('--form-string=')
    ) {
      const formToken = token.includes('=') ? token.slice(token.indexOf('=') + 1) : (tokens[i + 1] || '');
      const normalizedFormToken = stripMatchingQuotes(formToken);
      const separatorIndex = normalizedFormToken.indexOf('=');
      if (separatorIndex > 0) {
        const key = normalizedFormToken.slice(0, separatorIndex).trim();
        const value = stripMatchingQuotes(normalizedFormToken.slice(separatorIndex + 1).trim());
        formBodyLines.push(`${key}=${value}`);
      }
      if (method === 'GET') method = 'POST';
      if (!token.includes('=')) i++;
    } else if (!token.startsWith('-') && (token.startsWith('http://') || token.startsWith('https://'))) {
      url = stripMatchingQuotes(token);
    }
  }

  if (!url) {
    const httpToken = tokens.find(t => t.startsWith('http://') || t.startsWith('https://'));
    if (httpToken) url = httpToken;
  }

  if (queryEntries.length > 0) {
    url = appendUrlQuery(url, queryEntries);
  }

  const bodyMode: RequestBodyMode = formBodyLines.length > 0 ? 'form-data' : 'raw';
  let body = bodyParts.join('&');
  if (bodyMode === 'form-data') {
    body = formBodyLines.join('\n');
  }

  return { method, url, headers: JSON.stringify(parsedHeaders, null, 2), body, bodyMode };
};
