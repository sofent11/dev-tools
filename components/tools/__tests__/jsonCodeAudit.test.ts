import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { generateJsonCode } from '../data/jsonCode';

const checkTs = (source: string) => {
  const file = '/audited-generated.ts';
  const options: ts.CompilerOptions = { noEmit: true, strict: true, types: [], lib: ['lib.es2022.d.ts'] };
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (name, version, onError, createNew) => name === file ? ts.createSourceFile(name, source, version, true) : getSourceFile(name, version, onError, createNew);
  const program = ts.createProgram([file], options, host);
  return ts.getPreEmitDiagnostics(program).map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
};
describe('JSON code targets', () => {
  it.each([
    { name: null, 'odd/key': true }, [{ a: 1 }, { b: 'different' }],
    [1, 'two', null], { 'a-b': { name: 'first' }, a_b: { active: true } },
  ])('generated TypeScript accepts the exact representative data: %j', value => {
    const output = generateJsonCode(value, 'typescript');
    expect(checkTs(`${output}\nconst data: Root = ${JSON.stringify(value)};`)).toEqual([]);
  });
  it('keeps a present null field required', () => {
    expect(generateJsonCode({ nullable: null }, 'typescript')).toContain('nullable: null;');
  });
  it.each(['go', 'rust', 'python'])('generates a named root alias for %s primitive and array roots', target => {
    expect(generateJsonCode([1, 2], target)).toContain('Root');
    expect(generateJsonCode('value', target)).toContain('Root');
  });
  it('uses safe generic arrays when native samples have incompatible types', () => {
    expect(generateJsonCode({ items: [1, 1.5] }, 'go')).toContain('[]interface{}');
    expect(generateJsonCode({ items: [{ a: 1 }, { b: 2 }] }, 'rust')).toContain('Vec<serde_json::Value>');
    expect(generateJsonCode({ items: [true, 'value'] }, 'python')).toContain('List[Any]');
  });
  it('quotes SQL names and emits an explicit MySQL DDL with no fabricated root fields', () => {
    const output = generateJsonCode({ 'odd`key': 1, value: 1.2 }, 'sql');
    expect(output).toContain('`odd``key` INT'); expect(output).toContain('`value` DOUBLE');
    expect(() => generateJsonCode([], 'sql')).toThrow('JSON object');
    expect(() => generateJsonCode({}, 'sql')).toThrow('at least one');
  });
  it('reports unsupported Java roots and removed reference-only targets', () => {
    expect(() => generateJsonCode([], 'java')).toThrow('JSON object');
    expect(() => generateJsonCode({}, 'swift')).toThrow('Unsupported target');
  });
  it('does not claim native field mappings that the target runtime cannot preserve', () => {
    expect(() => generateJsonCode({ 'bad,key': 1 }, 'go')).toThrow('struct tag');
    expect(() => generateJsonCode({ 'bad"key': 1 }, 'go')).toThrow('struct tag');
    expect(generateJsonCode({ '\n': 1 }, 'rust')).toContain('rename = "\\n"');
    expect(generateJsonCode({ '\x01': 1 }, 'rust')).toContain('\\u{0001}');
    expect(() => generateJsonCode({ '\ud800': 1 }, 'rust')).toThrow('Unicode');
    expect(generateJsonCode({ '\x01': 1 }, 'java')).not.toContain('\\u0001');
    expect(generateJsonCode({ id: null }, 'sql')).not.toContain('PRIMARY KEY');
  });
});
