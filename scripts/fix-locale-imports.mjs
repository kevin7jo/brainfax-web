import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const appDir = path.join(root, 'app');

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx|ts|jsx|js)$/.test(name)) out.push(full);
  }
}

const files = [];
walk(path.join(appDir, '[locale]'), files);

for (const file of files) {
  const dir = path.dirname(file);
  const rel = path.relative(appDir, dir);
  const segments = rel.split(path.sep).filter(Boolean);
  const upLevels = segments.length + 1;
  const prefix = '../'.repeat(upLevels);
  let s = fs.readFileSync(file, 'utf8');
  const next = s.replace(/from (["'])(\.\.\/)+(lib\/|components\/)/g, (_m, q, _dots, rest) => `from ${q}${prefix}${rest}`);
  if (next !== s) {
    fs.writeFileSync(file, next);
    console.log('fixed', path.relative(root, file));
  }
}
