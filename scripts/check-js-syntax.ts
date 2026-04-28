import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

function walk(dir: string): string[] {
  const res: string[] = [];
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      res.push(...walk(p));
    } else if (st.isFile() && p.endsWith('.js')) {
      res.push(p);
    }
  }
  return res;
}

const root = process.cwd();
const jsFiles = walk(root);
const smallFiles = jsFiles.filter(f => fs.statSync(f).size === 0);
if (smallFiles.length) {
  console.log('EMPTY FILES:');
  smallFiles.forEach(f => console.log('  ' + path.relative(root, f)));
}

let errors: { file: string; message: string }[] = [];
for (const f of jsFiles) {
  try {
    const code = fs.readFileSync(f, 'utf8');
    // Try to parse using vm.Script
    new vm.Script(code, { filename: f });
  } catch (e: any) {
    errors.push({ file: path.relative(root, f), message: e.message });
  }
}

if (errors.length) {
  console.log('\nSYNTAX ERRORS:');
  errors.forEach(e => console.log('  ' + e.file + ' -> ' + e.message));
  process.exit(2);
} else {
  console.log('\nAll JS files parsed OK (no syntax errors detected)');
}
