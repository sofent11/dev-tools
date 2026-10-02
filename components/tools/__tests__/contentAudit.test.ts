import { describe, expect, it } from 'vitest';
import { assertJsonBudget, collapseSqlWhitespace, convertIdentifierCase, toRmbUppercase } from '../text/contentCore';
import { formatHtml, minifyHtml } from '../text/htmlCore';
import { setValueAtPath } from '../data/jsonDiffCore';
import { findByteHighlights } from '../encoding/binarySearchCore';
import { transformXml } from '../text/xmlCore';

describe('audited content transformations', () => {
  it('normalizes acronym and multi-line identifiers without merging lines', () => {
    expect(convertIdentifierCase('HTTPResponse\r\nuser_profile\nhello-world', 'camelCase')).toBe('httpResponse\nuserProfile\nhelloWorld');
    expect(convertIdentifierCase('user_profile', 'PascalCase')).toBe('UserProfile');
    expect(convertIdentifierCase('HTTPResponse', 'snake_case')).toBe('http_response');
  });
  it('preserves SQL literals, quoted identifiers, dollar strings and line-comment termination', () => {
    const sql = `SELECT  'a  b', "odd  key", $$hello  world$$  -- comment\n FROM  users;`;
    expect(collapseSqlWhitespace(sql)).toBe(`SELECT 'a  b', "odd  key", $$hello  world$$ -- comment\nFROM users;`);
    expect(() => collapseSqlWhitespace("select 'oops")).toThrow('Unterminated');
    expect(collapseSqlWhitespace('SELECT  1 # keep\n FROM  t;', true)).toBe('SELECT 1 # keep\nFROM t;');
    expect(collapseSqlWhitespace('SELECT  1 -- keep\r FROM  t;')).toBe('SELECT 1 -- keep\rFROM t;');
  });
  it.each([
    ['0', '零元整'], ['0.05', '零元零伍分'], ['1.005', '壹元零壹分'],
    ['10001', '壹万零壹元整'], ['100000001', '壹亿零壹元整'],
    ['999999999999998.01', '玖佰玖拾玖兆玖仟玖佰玖拾玖亿玖仟玖佰玖拾玖万玖仟玖佰玖拾捌元零壹分'],
  ])('formats exact decimal currency %s', (input, expected) => expect(toRmbUppercase(input)).toBe(expected));
  it('bounds structural JSON work and preserves the literal __proto__ field in a merge', () => {
    expect(() => assertJsonBudget([1, 2, 3], 2)).toThrow('JSON limit');
    const merged = setValueAtPath({}, ['__proto__'], { safe: true });
    expect(JSON.stringify(merged)).toBe('{"__proto__":{"safe":true}}');
    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
    expect({}).not.toHaveProperty('safe');
  });
  it('searches UTF-8, hexadecimal bytes and explicitly forced text', () => {
    const bytes = new TextEncoder().encode('中AB中');
    expect([...findByteHighlights(bytes, '中')]).toEqual([0, 1, 2, 5, 6, 7]);
    expect([...findByteHighlights(bytes, '0xE4 B8 AD')]).toEqual([0, 1, 2, 5, 6, 7]);
    expect([...findByteHighlights(bytes, 'text:AB')]).toEqual([3, 4]);
    expect([...findByteHighlights(bytes, '4142')]).toEqual([3, 4]);
  });
  it('bounds overlapping byte highlights and rejects oversized search terms', () => {
    expect([...findByteHighlights(new Uint8Array(10000).fill(65), 'text:AAA', 7)]).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(findByteHighlights(new Uint8Array([65]), 'A'.repeat(1025)).size).toBe(0);
    expect(findByteHighlights(new Uint8Array([65]), '').size).toBe(0);
  });
  it.each([formatHtml, minifyHtml])('preserves inline spacing, raw element content, entities, comments and void tags', transform => {
    const input = '<article title="&gt;"><p><span>Hello</span> <span>World &amp; friends</span></p><pre>a  b\n c</pre><script>const s = " a  b ";</script><!--keep--><img src="a.png"></article>';
    const output = transform(input);
    const template = document.createElement('template'); template.innerHTML = output;
    expect(template.content.querySelector('article')?.getAttribute('title')).toBe('>');
    expect(template.content.querySelector('p')?.textContent).toBe('Hello World & friends');
    expect(template.content.querySelector('pre')?.textContent).toBe('a  b\n c');
    expect(template.content.querySelector('script')?.textContent).toBe('const s = " a  b ";');
    expect(output).toContain('<!--keep-->'); expect(output).not.toContain('</img>');
  });
  it.each([true, false])('formats or compresses XML without changing mixed content, CDATA or preserved whitespace', pretty => {
    const input = '<?xml version="1.0"?><r xmlns:x="urn:x">\n <p>Hello <b>world</b> !</p>\n <v id="001">001</v>\n <x:t xml:space="preserve"> <a/>  <b/> </x:t>\n <c><![CDATA[a  b]]></c>\n</r>';
    const output = transformXml(input, pretty);
    const doc = new DOMParser().parseFromString(output, 'application/xml');
    expect(doc.querySelector('p')?.textContent).toBe('Hello world !');
    expect(doc.querySelector('v')?.getAttribute('id')).toBe('001');
    expect(doc.getElementsByTagName('x:t')[0].textContent).toBe('    ');
    expect(doc.querySelector('c')?.textContent).toBe('a  b');
    expect(output).toContain('<?xml version="1.0"?>');
    if (!pretty) expect(output).not.toContain('\n');
  });
});
