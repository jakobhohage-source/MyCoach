// Syntax-Check für alle Inline-<script>-Blöcke in index.html (und optional weiteren HTML-Dateien).
// Aufruf: node scripts/check-js.mjs [datei.html ...]   (Standard: index.html)
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const files = process.argv.slice(2);
if (files.length === 0) files.push('index.html');

let failed = false;
const dir = mkdtempSync(join(tmpdir(), 'mycoach-check-'));

try {
  for (const file of files) {
    const html = readFileSync(file, 'utf8');
    const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
    let match;
    let n = 0;
    while ((match = re.exec(html)) !== null) {
      const attrs = match[1];
      const code = match[2];
      if (/\bsrc\s*=/.test(attrs) || code.trim() === '') continue;
      if (/type\s*=\s*["'](?!text\/javascript|module)/i.test(attrs)) continue;
      n++;
      const line = html.slice(0, match.index).split('\n').length;
      const tmp = join(dir, `block-${n}.js`);
      writeFileSync(tmp, code);
      const res = spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
      if (res.status !== 0) {
        failed = true;
        console.error(`FEHLER in ${file}, Script-Block ab Zeile ${line}:\n${res.stderr}`);
      } else {
        console.log(`OK  ${file}, Script-Block ab Zeile ${line}`);
      }
    }
    if (n === 0) console.log(`Hinweis: keine Inline-Skripte in ${file} gefunden.`);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

process.exit(failed ? 1 : 0);
