import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { DEFAULT_PALETTE, isHexColor, resolveOverrides, resolvePalette } from '../src/palette';

test('default palette has 10 colors with valid light and dark variants', () => {
  assert.equal(DEFAULT_PALETTE.length, 10);
  for (const c of DEFAULT_PALETTE) {
    assert.ok(isHexColor(c.light) && isHexColor(c.dark));
  }
});

test('custom palette drops invalid entries and falls back when empty', () => {
  assert.deepEqual(resolvePalette(['#fff', 'red', 42, '#00ff00']), [
    { light: '#fff', dark: '#fff' },
    { light: '#00ff00', dark: '#00ff00' },
  ]);
  assert.equal(resolvePalette([]), DEFAULT_PALETTE);
  assert.equal(resolvePalette(['nope']), DEFAULT_PALETTE);
  assert.equal(resolvePalette(undefined), DEFAULT_PALETTE);
});

test('overrides keep only valid colors', () => {
  const o = resolveOverrides({ order: '#FF0000', bad: 'blue', n: 5 });
  assert.deepEqual([...o], [['order', '#ff0000']]);
  assert.equal(resolveOverrides(['x']).size, 0);
});
