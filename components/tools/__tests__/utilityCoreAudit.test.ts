import { describe, expect, it } from 'vitest';
import { randomInteger } from '../generators/randomInteger';
import { buildEventQr, buildWifiQr, escapeCardValue } from '../shared/qrPayload';
import { componentIdentifier, serializeJsxNode } from '../frontend/jsxSerializer';
import { dayProgress, localDatetimeInput, parseDateInput } from '../time/timeCore';
import ts from 'typescript';
import { buildCommand } from '../VideoDownloader';

describe('bounded unbiased random integer', () => {
  it('rejects the surplus word before mapping a six-outcome range', () => {
    const words = [4294967295, 5];
    expect(randomInteger(10, 15, () => words.shift()!)).toBe(15);
    expect(words).toEqual([]);
  });
  it('handles full uint32 range and rejects fractional, unsafe, or reversed bounds', () => {
    expect(randomInteger(0, 4294967295, () => 4294967295)).toBe(4294967295);
    for (const [min, max] of [[0.5, 2], [4, 2], [0, 4294967296], [0, Infinity]]) expect(() => randomInteger(min, max)).toThrow();
  });
});
describe('QR payload escaping and valid event periods', () => {
  it('escapes protocol delimiters and does not include a password in an open network', () => {
    expect(buildWifiQr({ ssid: 'A;B:C\\D', password: 'P;Q', encryption: 'WPA' })).toContain('S:A\\;B\\:C\\\\D;P:P\\;Q;');
    expect(buildWifiQr({ ssid: 'Open', password: 'ignored', encryption: 'nopass' })).not.toContain('ignored');
    expect(escapeCardValue('A;B,C\nEND:VCARD')).toBe('A\\;B\\,C\\nEND:VCARD');
  });
  it('accepts leap day and rejects invalid dates, reversed periods, and mixed timezones', () => {
    expect(buildEventQr({ title: 'A\nEND:VEVENT', start: '20240229T090000Z', end: '20240229T100000Z' })).toContain('SUMMARY:A\\nEND:VEVENT');
    for (const [start, end] of [['20250229T090000','20250301T090000'], ['20240428T090000','20240428T080000'], ['20240428T090000','20240428T100000Z'], ['20241328T090000','20250101T100000']]) expect(() => buildEventQr({title:'Test',start,end})).toThrow();
  });
});
describe('React serialization', () => {
  const syntax = (jsx: string) => (ts.createSourceFile('test.tsx', `const View = () => (${jsx});`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX) as ts.SourceFile & { parseDiagnostics: unknown[] }).parseDiagnostics;
  it('preserves special text, style URLs, custom properties, and attribute values as valid JSX', () => {
    const doc = new DOMParser().parseFromString('<div class="card" style="background-image: url(\'data:image/svg+xml;a:b\'); --accent: red" data-text="&quot;{x}&quot;">&lt;hello&gt; &amp; {name}<label for="x">Name</label><input readonly></div>', 'text/html');
    const output = serializeJsxNode(doc.body.firstChild!);
    expect(syntax(output)).toEqual([]);
    expect(output).toContain('className='); expect(output).toContain('htmlFor='); expect(output).toContain('readOnly');
    expect(output).toContain('data:image/svg+xml;a:b'); expect(output).toContain('"--accent"'); expect(output).toContain('"<hello> & {name}"');
  });
  it('preserves SVG tag names, ARIA attributes, gradients, and turns solid paint into currentColor', () => {
    const doc = new DOMParser().parseFromString('<svg viewBox="0 0 24 24" aria-label="A"><defs><linearGradient id="g"><stop offset="0" stop-color="red"/></linearGradient><clipPath id="c"/></defs><path fill="url(#g)" stroke="red"/><text>{a}&amp;</text></svg>', 'image/svg+xml');
    const output = serializeJsxNode(doc.documentElement, { currentColor:true });
    expect(syntax(output)).toEqual([]);
    expect(output).toContain('linearGradient'); expect(output).toContain('clipPath'); expect(output).toContain('aria-label='); expect(output).toContain('fill={"url(#g)"}'); expect(output).toContain('stroke={"currentColor"}');
    expect(componentIdentifier('123 my icon')).toBe('Svg123myicon');
  });
  it('marks string event handlers for manual migration and escapes comment terminators', () => {
    const doc = new DOMParser().parseFromString('<div onclick="danger()"><!-- */ bad -->x</div>', 'text/html');
    const output = serializeJsxNode(doc.body.firstChild!);
    expect(syntax(output)).toEqual([]); expect(output).not.toContain('onClick='); expect(output).toContain('require React callbacks');
  });
});
describe('local date semantics', () => {
  it('formats local controls without applying a UTC offset and normalizes date string spaces', () => {
    const date = new Date(2026, 9, 3, 16, 45);
    expect(localDatetimeInput(date)).toBe('2026-10-03T16:45');
    expect(parseDateInput('2026-10-03 16:45:00').getTime()).toBe(date.getTime());
    expect(dayProgress(new Date(2026,9,3,0,0))).toEqual({percent:0,remainingSeconds:86400});
  });
});
describe('download commands', () => {
  it('quotes user URLs and referers without allowing shell interpolation or header injection', () => {
    const command = buildCommand({id:'test', quality:'source', format:'mp4', source:'test',url:"https://example.com/a'b.mp4?q=$(printf injected)",referer:'https://example.com/\r\nX-Injected: yes'});
    expect(command).toContain("'https://example.com/a'\\''b.mp4?q=$(printf injected)'");
    expect(command).not.toContain('\r'); expect(command).not.toContain('\n');
    expect(buildCommand({id:'test',quality:'source',format:'m3u8',source:'test',url:'https://example.com/playlist.m3u8'})).toBe("ffmpeg -i 'https://example.com/playlist.m3u8' -c copy 'video.mp4'");
  });
});
