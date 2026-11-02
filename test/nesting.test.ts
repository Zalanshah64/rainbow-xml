import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { scanNested } from '../src/nesting';

const depths = (lines: string[], stack: string[] = []) =>
  scanNested(lines, stack).tags.map((t) => `${t.kind === 'close' ? '/' : ''}${t.name}:${t.depth}`);

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
