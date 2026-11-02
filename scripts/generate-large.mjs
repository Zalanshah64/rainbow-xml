// Writes samples/large.xml with about 64,000 lines for performance testing.
// Usage: npm run sample:large [-- <lineCount>]
import { createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';

const target = Number(process.argv[2] ?? 64_000);
const outPath = fileURLToPath(new URL('../samples/large.xml', import.meta.url));
const out = createWriteStream(outPath);

const extras = ['note', 'tag', 'discount', 'warehouse', 'carrier', 'ns:meta', 'ext:flag', 'trackingNumber'];

let lines = 0;
const write = (s) => {
  out.write(s + '\n');
  lines++;
};

write('<?xml version="1.0" encoding="UTF-8"?>');
write('<catalog xmlns:ns="urn:ns" xmlns:ext="urn:ext">');
for (let id = 1; lines < target - 1; id++) {
  write(`  <order id="${id}" status="${id % 3 ? 'shipped' : 'pending'}">`);
  write('    <customer>');
  write(`      <name>Customer ${id}</name>`);
  write(`      <email>customer${id}@example.com</email>`);
  write('    </customer>');
  write('    <items>');
  for (let i = 0; i < 3; i++) {
    write(`      <item sku="SKU-${id}-${i}" qty="${i + 1}">`);
    write(`        <price currency="USD">${(id * 1.37 + i).toFixed(2)}</price>`);
    write(`        <${extras[(id + i) % extras.length]}>value</${extras[(id + i) % extras.length]}>`);
    write('      </item>');
  }
  write('    </items>');
  write('  </order>');
}
write('</catalog>');
out.end(() => console.log(`Wrote ${lines} lines to ${outPath}`));
