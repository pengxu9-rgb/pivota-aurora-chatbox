import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export function collectDiagnostics(root, projects = ['tsconfig.app.json', 'tsconfig.node.json']) {
  const entries = [];
  let checkedFiles = 0;
  const normalize = (text) => text.replaceAll('\\', '/').replaceAll(root.replaceAll('\\', '/') + '/', '').replaceAll('\r\n', '\n');
  for (const project of projects) {
    const configPath = path.resolve(root, project);
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));
    if (parsed.errors.length) throw new Error(parsed.errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n'));
    if (!parsed.fileNames.length) throw new Error(`No source files in ${project}; refusing an empty typecheck.`);
    const program = ts.createProgram(parsed.fileNames, { ...parsed.options, noEmit: true });
    checkedFiles += program.getSourceFiles().filter(f => !f.isDeclarationFile).length;
    for (const d of ts.getPreEmitDiagnostics(program)) {
      const source = d.file && d.start != null
        ? d.file.text.split(/\r?\n/)[d.file.getLineAndCharacterOfPosition(d.start).line].trim()
        : '';
      entries.push({
        project,
        file: d.file ? normalize(path.resolve(d.file.fileName)) : '<configuration>',
        code: d.code,
        message: normalize(ts.flattenDiagnosticMessageText(d.messageText, '\n')),
        source,
      });
    }
  }
  return { checkedFiles, entries };
}

export function counts(entries) {
  const result = {};
  for (const entry of entries) {
    const key = JSON.stringify(entry);
    result[key] = (result[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
}

export function compare(current, baseline) {
  const added = Object.keys(current).filter(key => current[key] > (baseline[key] || 0));
  const stale = Object.keys(baseline).filter(key => baseline[key] > (current[key] || 0));
  return { added, stale };
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { checkedFiles, entries } = collectDiagnostics(root);
  const current = counts(entries);
  if (process.argv.includes('--print-baseline')) {
    console.log(JSON.stringify({ version: 1, typescript: ts.version, diagnostics: current }, null, 2));
    return;
  }
  if (process.argv.includes('--strict')) {
    for (const entry of entries) console.error(`${entry.file} TS${entry.code}: ${entry.message}`);
    console.log(`Checked ${checkedFiles} source files; ${entries.length} diagnostics (no exemptions).`);
    process.exitCode = entries.length ? 1 : 0;
    return;
  }
  const baseline = JSON.parse(fs.readFileSync(path.join(root, 'typecheck-baseline.json'), 'utf8'));
  if (baseline.version !== 1 || baseline.typescript !== ts.version || !baseline.diagnostics ||
      Object.values(baseline.diagnostics).some(n => !Number.isInteger(n) || n < 1)) {
    throw new Error('Invalid or compiler-version-mismatched typecheck baseline; explicit review required.');
  }
  const { added, stale } = compare(current, baseline.diagnostics);
  for (const key of added) {
    const d = JSON.parse(key);
    console.error(`NEW ${d.file} TS${d.code}: ${d.message}\n  ${d.source}`);
  }
  if (stale.length) console.error(`${stale.length} resolved/changed baseline entries must be removed; do not retain unused allowances.`);
  console.log(`Checked ${checkedFiles} source files; ${entries.length} total diagnostics; ${added.length} new fingerprints; ${stale.length} stale fingerprints.`);
  process.exitCode = added.length || stale.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
