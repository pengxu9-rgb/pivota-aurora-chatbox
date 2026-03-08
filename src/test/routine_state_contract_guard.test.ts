import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function walkFiles(root: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'test') continue;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, out);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('routine-state contract guards', () => {
  it('active frontend code does not reference previousRoutine backend contract', () => {
    const srcRoot = path.resolve(process.cwd(), 'src');
    const files = walkFiles(srcRoot);
    const offenders = files.filter((file) => fs.readFileSync(file, 'utf8').includes('previousRoutine'));
    expect(offenders).toEqual([]);
  });
});
