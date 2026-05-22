import * as fs from 'fs';

const lines = fs.readFileSync('public/module-registry.js', 'utf8').split('\n');
let bad = 0;

for (let index = 0; index < lines.length; index += 1) {
  const line = lines[index];
  if (line.includes('const exports =') && line.includes('_r(')) {
    bad += 1;
    console.log(`L${index + 1}: ${line.substring(0, 120)}`);
  }
  if (line.includes('const _require =') && line.includes('_r(')) {
    bad += 1;
    console.log(`L${index + 1}: ${line.substring(0, 120)}`);
  }
}

console.log('total issues:', bad);
