const fs = require('fs');
const path = require('path');
const vm = require('vm');

function walk(dir) {
  const res = [];
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

let errors = [];
for (const f of jsFiles) {
  try {
    const code = fs.readFileSync(f, 'utf8');
    // Try to parse using vm.Script
    new vm.Script(code, { filename: f });
  } catch (e) {
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
