// Strip only the bundler's machine-local CSS region annotation. Runtime code
// and source-map line positions are unchanged; official Harness stays read-only.
import { readFile, writeFile } from 'node:fs/promises';
const file = new URL('../lib/client.js', import.meta.url);
const before = await readFile(file, 'utf8');
const after = before.replace(/^(\s*\/\/#region \\0dshx-css-global:).*\/src\/(.*)$/gm, '$1src/$2');
if (after !== before) await writeFile(file, after);
