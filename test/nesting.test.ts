import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { OpenElement, scanNested } from '../src/nesting';

/** Open elements with made-up positions, for resuming a scan. */
const opened = (...keys: string[]): OpenElement[] => keys.map((key, i) => ({ key, at: { line: -1, start: i, end: i } }));

const depths = (lines: string[], stack: string[] = []) =>
  scanNested(lines, opened(...stack)).tags.map((t) => `${t.kind === 'close' ? '/' : ''}${t.name}:${t.depth}`);

const unmatched = (lines: string[], atEnd = true) =>
  scanNested(lines, [], { atEnd }).unmatched.map((u) => `${u.kind} ${u.name} ${u.at.line}:${u.at.start}`);

test('children are one level deeper than their parent', () => {
  assert.deepEqual(depths(['<a><b><c/></b><b></b></a>']), ['a:0', 'b:1', 'c:2', '/b:1', 'b:1', '/b:1', '/a:0']);
});

test('opening and closing tags share a depth across lines', () => {
  const lines = ['<root>', '  <order>', '    <item/>', '  </order>', '</root>'];
  assert.deepEqual(depths(lines), ['root:0', 'order:1', 'item:2', '/order:1', '/root:0']);
});

test('a closing tag closes any unclosed children inside it', () => {
  assert.deepEqual(depths(['<a><b><c></a><d/>']), ['a:0', 'b:1', 'c:2', '/a:0', 'd:0']);
});

test('a stray closing tag does not change the nesting', () => {
  assert.deepEqual(depths(['<a></x><b/></a>']), ['a:0', '/x:0', 'b:1', '/a:0']);
  assert.deepEqual(depths(['</x><a/>']), ['/x:0', 'a:0']);
});

test('tags in comments and CDATA do not affect depth', () => {
  assert.deepEqual(depths(['<a><!-- <b> --><![CDATA[<c>]]><d/></a>']), ['a:0', 'd:1', '/a:0']);
});

test('scanning can resume from a known set of open elements', () => {
  assert.deepEqual(depths(['<c/>', '</b>', '</a>'], ['a', 'b']), ['c:2', '/b:1', '/a:0']);
});

test('resuming from a checkpoint gives the same depths as scanning from the top', () => {
  const lines = ['<a>'];
  for (let i = 0; i < 30; i++) {
    lines.push('<b>', '<!--', '<fake>', '-->', '<c x="1"', 'y="2"/>', '</b>');
  }
  lines.push('</a>');

  const full = scanNested(lines, [], { safeLineEvery: 5 });
  assert.ok(full.checkpoints.length > 10);
  for (const cp of full.checkpoints) {
    const resumed = scanNested(lines.slice(cp.line), cp.stack).tags;
    const expected = full.tags.filter((t) => t.nameSpan.line >= cp.line);
    assert.deepEqual(
      resumed.map((t) => [t.name, t.depth, t.nameSpan.line + cp.line]),
      expected.map((t) => [t.name, t.depth, t.nameSpan.line]),
      `checkpoint at line ${cp.line}`,
    );
  }
});

test('a closing tag points back at its opening tag', () => {
  const tags = scanNested(['<a>', '  <b></b>', '</a>'], [], { firstLine: 10 }).tags;
  assert.deepEqual(tags.map((t) => t.openedAt), [
    undefined,
    undefined,
    { line: 11, start: 3, end: 4 },
    { line: 10, start: 1, end: 2 },
  ]);
});

test('finds unclosed and stray tags', () => {
  assert.deepEqual(unmatched(['<a><b><c></a>', '</x>']), ['unclosed b 0:4', 'unclosed c 0:7', 'stray x 1:2']);
  assert.deepEqual(unmatched(['<a><b/></a>']), []);
});

test('elements still open at the end are unclosed only when the scan reaches the end', () => {
  assert.deepEqual(unmatched(['<a>', '<b>'], true), ['unclosed a 0:1', 'unclosed b 1:1']);
  assert.deepEqual(unmatched(['<a>', '<b>'], false), []);
});

test('html mode matches names without case and knows void elements', () => {
  const lines = ['<DIV><br><img src="x"><p>Hi</P></div>'];
  assert.deepEqual(
    scanNested(lines, [], { html: true, atEnd: true }).tags.map((t) => `${t.key}:${t.depth}`),
    ['div:0', 'br:1', 'img:1', 'p:1', 'p:1', 'div:0'],
  );
  assert.deepEqual(scanNested(lines, [], { html: true, atEnd: true }).unmatched, []);
  assert.equal(scanNested(lines, [], { atEnd: true }).unmatched.length, 6); // XML rules: 2 stray, 4 unclosed
});

test('checkpoints record the shallowest nesting until the next checkpoint', () => {
  const lines = ['<a>', '<b>', '</b>', '<c>', '<d>', '</d>', '</c>', '</a>'];
  const { checkpoints } = scanNested(lines, [], { safeLineEvery: 2 });
  assert.deepEqual(
    checkpoints.map((c) => [c.line, c.stack.length, c.min]),
    [[0, 0, 0], [2, 2, 1], [4, 2, 2], [6, 2, 0]],
  );
});
