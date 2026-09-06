import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { collectDiagnostics, compare, counts } from './typecheck.mjs';

test('checks actual source rather than a references-only root config', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aurora-typecheck-'));
  try {
    fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({ files: [] }));
    assert.throws(() => collectDiagnostics(root, ['tsconfig.json']), /No source files|is empty/);
    fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({ files: [], references: [{ path: './app' }] }));
    assert.throws(() => collectDiagnostics(root, ['tsconfig.json']), /No source files|is empty/);
    fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({ files: ['broken.ts'], compilerOptions: { skipLibCheck: true } }));
    fs.writeFileSync(path.join(root, 'broken.ts'), 'const price: number = "wrong";');
    const result = collectDiagnostics(root, ['tsconfig.json']);
    assert.ok(result.checkedFiles > 0);
    assert.ok(result.entries.some(d => d.code === 2322 && d.file === 'broken.ts'));
    assert.ok(compare(counts(result.entries), {}).added.length > 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('fails closed on malformed/missing config', () => {
  assert.throws(() => collectDiagnostics(os.tmpdir(), ['does-not-exist-aurora.json']));
});

test('rejects new errors, duplicate increases, changed source and stale allowances', () => {
  const old = { file: 'a.ts', code: 2322, message: 'bad type', source: 'const a = bad' };
  const baseline = counts([old]);
  assert.deepEqual(compare(counts([old]), baseline), { added: [], stale: [] });
  assert.equal(compare(counts([old, old]), baseline).added.length, 1);
  assert.equal(compare(counts([{ ...old, source: 'const b = bad' }]), baseline).added.length, 1);
  assert.equal(compare({}, baseline).stale.length, 1);
  assert.equal(compare(counts([{ ...old, file: 'b.ts' }]), baseline).added.length, 1);
});
