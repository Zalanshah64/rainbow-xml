import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { scan, scanLines } from '../src/scanner';

const names = (lines: string[]) => scanLines(lines).map((t) => t.name);

test('finds opening, closing, and self-closing tags', () => {
  assert.deepEqual(names(['<order id="1"><customer/></order>']), ['order', 'customer', 'order']);
});

test('reports whether each tag opens, closes, or self-closes', () => {
  assert.deepEqual(
    scanLines(['<a><b/><c x="/" /></a><d']).map((t) => t.kind),
    ['open', 'selfClosing', 'selfClosing', 'close', 'open'],
  );
});

test('reports safe lines outside comments and multi-line tags', () => {
  const lines = ['<a>', '<!--', 'x', '-->', '<b', 'id="1">', '</b>', '</a>'];
  const { safeLines } = scan(lines, { safeLineEvery: 1 });
  assert.deepEqual(safeLines, [
    { line: 1, tagsBefore: 1 },
    { line: 4, tagsBefore: 1 },
    { line: 6, tagsBefore: 2 },
    { line: 7, tagsBefore: 3 },
  ]);
});

test('reports at most one safe line per interval', () => {
  const lines = Array.from({ length: 10 }, () => '<x/>');
  assert.deepEqual(
    scan(lines, { safeLineEvery: 4 }).safeLines.map((s) => s.line),
    [4, 8],
  );
});

test('reports attribute names but not words inside values', () => {
  const [tag] = scanLines([`<order id="1" xmlns:ns='a b' note="x=y"`, '  status = "ok"/>']);
  assert.deepEqual(tag.attributeSpans, [
    { line: 0, start: 7, end: 9 },
    { line: 0, start: 14, end: 22 },
    { line: 0, start: 29, end: 33 },
    { line: 1, start: 2, end: 8 },
  ]);
  assert.deepEqual(scanLines(['<a></a>'])[0].attributeSpans, []);
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

test('html mode treats void elements as self-closing', () => {
  const kinds = (html: boolean) => scan(['<p><br><IMG src="a.png"><hr/></p>'], { html }).tags.map((t) => t.kind);
  assert.deepEqual(kinds(true), ['open', 'selfClosing', 'selfClosing', 'selfClosing', 'close']);
  assert.deepEqual(kinds(false), ['open', 'open', 'open', 'selfClosing', 'close']);
});

test('html mode skips script and style contents', () => {
  const lines = ['<script type="x">', 'if (a<b && c>d) { x = "<div>"; }', '</SCRIPT><style>a<b{}</style><p/>'];
  assert.deepEqual(
    scan(lines, { html: true }).tags.map((t) => t.name),
    ['script', 'SCRIPT', 'style', 'style', 'p'],
  );
  assert.ok(scan(lines).tags.some((t) => t.name === 'b')); // XML rules don't skip it
});

test('html mode never reports a safe line inside a script', () => {
  const lines = ['<script>', 'a<b', 'c<d', '</script>', '<p/>'];
  assert.deepEqual(scan(lines, { html: true, safeLineEvery: 1 }).safeLines.map((s) => s.line), [3, 4]);
});
