import { existsSync, mkdirSync, symlinkSync, realpathSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
const root = resolve(process.argv[2] || '');
if (!process.argv[2] || !existsSync(join(root, 'tools/dshx/src/client-build.js'))) throw new Error('Pass a prepared Harness checkout.');
const packages = new Map();
function walk(path, depth = 0) {
  if (depth > 4) return;
  if (existsSync(join(path, 'package.json'))) {
    const pkg = JSON.parse(readFileSync(join(path, 'package.json'), 'utf8'));
    packages.set(pkg.name, path); return;
  }
  for (const e of readdirSync(path, { withFileTypes: true })) if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') walk(join(path, e.name), depth + 1);
}
walk(join(root, 'packages')); walk(join(root, 'vendor'));
const local = resolve('node_modules');
function link(name, target) {
  const destination = join(local, name);
  mkdirSync(dirname(destination), { recursive: true });
  if (existsSync(destination)) {
    if (realpathSync(destination) !== realpathSync(target)) throw new Error(`Dependency mismatch: ${name}`);
  } else symlinkSync(target, destination);
}
const rootRequire = createRequire(join(root, 'package.json'));
const uiRequire = createRequire(join(root, 'packages/client/ui-conversation/package.json'));
const webRequire = createRequire(join(root, 'packages/client/web/package.json'));
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
for (const name of Object.keys({ ...pkg.peerDependencies, ...pkg.devDependencies })) {
  let target = packages.get(name);
  if (!target) for (const req of [rootRequire, uiRequire, webRequire]) {
    try { target = dirname(req.resolve(`${name}/package.json`)); break; } catch {}
  }
  if (!target) throw new Error(`Cannot resolve ${name} in selected Harness`);
  link(name, target);
}
mkdirSync(join(local, '.bin'), { recursive: true });
for (const name of ['typescript', 'tsdown']) {
  const bins = JSON.parse(readFileSync(join(local, name, 'package.json'), 'utf8')).bin;
  for (const [command, path] of Object.entries(bins)) if (!existsSync(join(local, '.bin', command))) symlinkSync(join(local, name, path), join(local, '.bin', command));
}
console.log('Development dependencies linked; Harness files unchanged.');
