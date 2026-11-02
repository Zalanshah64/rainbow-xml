import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { scanLines } from '../src/scanner';

const names = (lines: string[]) => scanLines(lines).map((t) => t.name);

test('finds opening, closing, and self-closing tags', () => {
  assert.deepEqual(names(['<order id="1"><customer/></order>']), ['order', 'customer', 'order']);
});

test('reports name, open, and close spans', () => {
  const [open, selfClosing, close] = scanLines(['<order><item/></order >']);
  assert.deepEqual(open.openSpan, { line: 0, start: 0, end: 1 });
  assert.deepEqual(open.nameSpan, { line: 0, start: 1, end: 6 });
  assert.deepEqual(open.closeSpan, { line: 0, start: 6, end: 7 });
  assert.deepEqual(selfClosing.closeSpan, { line: 0, start: 12, end: 14 });
  assert.deepEqual(close.openSpan, { line: 0, start: 14, end: 16 });
  assert.deepEqual(close.nameSpan, { line: 0, start: 16, end: 21 });
  assert.deepEqual(close.closeSpan, { line: 0, start: 22, end: 23 });
});

test('keeps namespace prefixes in the name', () => {
  assert.deepEqual(names(['<soap:Body></soap:Body>']), ['soap:Body', 'soap:Body']);
});

test('skips comments, CDATA, and declarations', () => {
  const lines = [
    '<?xml version="1.0"?>',
    '<!DOCTYPE note>',
    '<!-- <hidden> -->',
    '<a><![CDATA[ <alsoHidden> ]]></a>',
  ];
  assert.deepEqual(names(lines), ['a', 'a']);
});

test('skips multi-line comments', () => {
  assert.deepEqual(names(['<!--', '<hidden/>', '-->', '<shown/>']), ['shown']);
});

test('finds the end of a tag that spans lines', () => {
  const [tag] = scanLines(['<order', '  id="1"', '>']);
  assert.equal(tag.name, 'order');
  assert.deepEqual(tag.closeSpan, { line: 2, start: 0, end: 1 });
});

test('ignores > and / inside quoted attribute values', () => {
  const [tag] = scanLines([`<a href="x>y/z" title='/>'>`]);
  assert.deepEqual(tag.closeSpan, { line: 0, start: 26, end: 27 });
});

test('handles unicode tag names', () => {
  assert.deepEqual(names(['<café/>']), ['café']);
});

test('skips lines over the length limit', () => {
  const long = '<big>' + 'x'.repeat(50);
  const tags = scanLines(['<a/>', long, '<b/>'], 20);
  assert.deepEqual(
    tags.map((t) => [t.name, t.nameSpan.line]),
    [
      ['a', 0],
      ['b', 2],
    ],
  );
});

test('ignores text that only looks like a tag', () => {
  assert.deepEqual(names(['a < b', '<1bad>', '< spaced>']), []);
});
