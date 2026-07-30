import { describe, expect, it } from 'vitest';
import { assertHeader, parseCsv, parseCsvRecords } from './csv';

describe('parseCsv', () => {
  it('handles a quoted field containing a comma', () => {
    expect(parseCsv('a,"b,c",d\n')).toEqual([['a', 'b,c', 'd']]);
  });

  it('unescapes "" into a literal quote', () => {
    expect(parseCsv('"he said ""hi""",b\n')).toEqual([['he said "hi"', 'b']]);
  });

  // Regression guard: a future "simplification" back to split(',') would
  // corrupt names like Ja'Marr Chase, both bare and quoted. Keep this red-able.
  it("parses Ja'Marr Chase bare", () => {
    expect(parseCsv("name,pos\nJa'Marr Chase,WR\n")).toEqual([
      ['name', 'pos'],
      ["Ja'Marr Chase", 'WR'],
    ]);
  });

  it("parses Ja'Marr Chase quoted", () => {
    expect(parseCsv('name,pos\n"Ja\'Marr Chase",WR\n')).toEqual([
      ['name', 'pos'],
      ["Ja'Marr Chase", 'WR'],
    ]);
  });

  it('handles CRLF line endings', () => {
    expect(parseCsv('a,b\r\nc,d\r\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('strips a leading BOM', () => {
    expect(parseCsv('﻿a,b\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('does not produce a spurious empty row from a trailing newline', () => {
    expect(parseCsv('a,b\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('yields an empty string for a blank field', () => {
    expect(parseCsv('a,b\n,2\n')).toEqual([
      ['a', 'b'],
      ['', '2'],
    ]);
  });
});

describe('parseCsvRecords', () => {
  it('maps rows to records keyed by the header', () => {
    expect(parseCsvRecords('name,age\nAlice,30\n')).toEqual([{ name: 'Alice', age: '30' }]);
  });

  it('throws on a ragged row, naming the row number and both counts', () => {
    expect(() => parseCsvRecords('a,b,c\n1,2\n')).toThrow(/line 2/);
    expect(() => parseCsvRecords('a,b,c\n1,2\n')).toThrow(/expected 3/);
    expect(() => parseCsvRecords('a,b,c\n1,2\n')).toThrow(/got 2/);
  });
});

describe('assertHeader', () => {
  it('passes silently when all expected columns are present', () => {
    expect(() => assertHeader(['a', 'b', 'c'], ['a', 'c'])).not.toThrow();
  });

  it('throws naming the missing column on a mismatch', () => {
    expect(() => assertHeader(['a', 'b'], ['a', 'c'])).toThrow(/c/);
  });
});
