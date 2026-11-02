import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { TagIndex } from '../src/tagIndex';

const source = (lines: string[]) => ({
  get lineCount() {
    return lines.length;
  },
  lineAt: (i: number) => lines[i],
});

/** `line:start` of the partner of the tag at (line, character), or undefined. */
const partner = (index: TagIndex, line: number, character: number) => {
  const pair = index.matchAt(line, character);
  return pair && `${pair.partner.line}:${pair.partner.start}`;
};

test('finds the closing tag for an opening tag and back', () => {
  const index = new TagIndex(source(['<a>', '  <b x="1"></b>', '</a>']));
  assert.equal(partner(index, 0, 1), '2:2');
  assert.equal(partner(index, 2, 3), '0:1');
  assert.equal(partner(index, 1, 2), '1:13'); // on the "<"
  assert.equal(partner(index, 1, 4), '1:13'); // just after the name
  assert.equal(partner(index, 1, 6), undefined); // on an attribute
  assert.equal(partner(index, 1, 13), '1:3');
});

test('self-closing, unclosed, and stray tags have no partner', () => {
  const index = new TagIndex(source(['<a><c/>', '<b>', '</a></x>']));
  assert.equal(partner(index, 0, 4), undefined); // <c/>
  assert.equal(partner(index, 1, 1), undefined); // <b> is closed by </a>
  assert.equal(partner(index, 2, 2), '0:1'); // </a> still pairs with <a>
  assert.equal(partner(index, 2, 6), undefined); // </x>
});

test('matches across many checkpoints, same as a scan with none', () => {
  const lines = ['<root>'];
  for (let i = 0; i < 40; i++) {
    lines.push('  <group>', '    <!-- <group> -->', '    <item', '      id="1"/>', '    <group><leaf/></group>', '  </group>');
  }
  lines.push('</root>');
  const src = source(lines);
  const small = new TagIndex(src, false, 3);
  const none = new TagIndex(src, false, Infinity);
  for (let line = 0; line < lines.length; line++) {
    for (let ch = 0; ch < lines[line].length; ch++) {
      assert.deepEqual(small.matchAt(line, ch), none.matchAt(line, ch), `${line}:${ch}`);
    }
  }
  assert.equal(partner(small, 0, 1), `${lines.length - 1}:2`);
});

test('lists unmatched tags', () => {
  const index = new TagIndex(source(['<a>', '<b>', '</a>', '</x>', '<c>']));
  assert.deepEqual(
    index.unmatched().map((u) => `${u.kind} ${u.name} ${u.at.line}`),
    ['unclosed b 1', 'stray x 3', 'unclosed c 4'],
  );
});

test('after edits, results match a fresh index', () => {
  const lines: string[] = [];
  for (let i = 0; i < 60; i++) {
    lines.push(`<e${i % 4}>`, '<!--', `</e${i % 3}>`, '-->', i % 5 ? `</e${i % 4}>` : '<x/>');
  }
  const src = source(lines);
  const index = new TagIndex(src, false, 4);
  const edits: [number, number, string[]][] = [
    [100, 1, ['</e1>', '<y>']], // replace one line with two
    [12, 0, ['<!--']], // open a comment that swallows the tags below it
    [250, 3, []], // delete lines
    [0, 0, ['<root>']],
    [30, 1, ['-->']],
  ];
  for (const [at, remove, insert] of edits) {
    index.unmatched(); // make sure there's saved state to invalidate
    lines.splice(at, remove, ...insert);
    index.invalidateFrom(at);

    const fresh = new TagIndex(src, false, 4);
    assert.deepEqual(index.unmatched(), fresh.unmatched(), `unmatched after edit at ${at}`);
    assert.deepEqual(index.tagsIn(0, lines.length - 1), fresh.tagsIn(0, lines.length - 1), `tags after edit at ${at}`);
    for (let line = 0; line < lines.length; line += 7) {
      assert.deepEqual(index.matchAt(line, 1), fresh.matchAt(line, 1), `match at ${line} after edit at ${at}`);
    }
  }
});

test('tagsIn starts mid-file with the right depths and document line numbers', () => {
  const lines = ['<a>', '<b>', '<c>', '</c>', '</b>', '</a>'];
  const index = new TagIndex(source(lines), false, 2);
  assert.deepEqual(
    index.tagsIn(3, 4).map((t) => `${t.name}:${t.depth}@${t.nameSpan.line}`),
    ['c:2@3', 'b:1@4'],
  );
});

test('html mode pairs tags without case and skips void elements', () => {
  const index = new TagIndex(source(['<DIV>', '<br>', '<script>if (a<b) {}</script>', '</div>']), true);
  assert.equal(partner(index, 0, 1), '3:2');
  assert.deepEqual(index.unmatched(), []);
});
