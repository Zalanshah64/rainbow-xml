import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  colorIndex,
  DEFAULT_PALETTE,
  hashName,
  isHexColor,
  resolveOverrides,
  resolvePalette,
  THEME_COLOR_IDS,
} from '../src/palette';

test('hash is deterministic', () => {
  assert.equal(hashName('order'), hashName('order'));
  assert.notEqual(hashName('order'), hashName('customer'));
});

test('color index stays inside the palette', () => {
  for (const name of ['a', 'order', 'soap:Body', 'café', '']) {
    const i = colorIndex(name, 10);
    assert.ok(i >= 0 && i < 10, `${name} -> ${i}`);
  }
});

test('similar names spread across the palette', () => {
  const used = new Set<number>();
  for (let i = 0; i < 50; i++) {
    used.add(colorIndex(`item${i}`, 10));
  }
  assert.equal(used.size, 10);
});

test('default palette has 10 colors with valid light and dark variants', () => {
  assert.equal(DEFAULT_PALETTE.length, 10);
  for (const c of DEFAULT_PALETTE) {
    assert.ok(isHexColor(c.light) && isHexColor(c.dark));
  }
});

test('package.json theme colors match the default palette', () => {
  const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'));
  const colors = new Map<string, Record<string, string>>(
    pkg.contributes.colors.map((c: { id: string; defaults: Record<string, string> }) => [c.id, c.defaults]),
  );
  THEME_COLOR_IDS.forEach((id, i) => {
    const { light, dark } = DEFAULT_PALETTE[i];
    assert.deepEqual(colors.get(id), { dark, light, highContrast: dark, highContrastLight: light }, id);
  });
});

test('custom palette drops invalid entries; empty means use theme colors', () => {
  assert.deepEqual(resolvePalette(['#fff', 'red', 42, '#00ff00']), ['#fff', '#00ff00']);
  assert.equal(resolvePalette([]), undefined);
  assert.equal(resolvePalette(['nope']), undefined);
  assert.equal(resolvePalette(undefined), undefined);
});

test('overrides keep only valid colors', () => {
  const o = resolveOverrides({ order: '#FF0000', bad: 'blue', n: 5 });
  assert.deepEqual([...o], [['order', '#ff0000']]);
  assert.equal(resolveOverrides(['x']).size, 0);
});
