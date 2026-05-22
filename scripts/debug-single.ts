import * as fs from 'fs';

const registry = fs.readFileSync('public/module-registry.js', 'utf8');
const key = 'card-system';
const startIndex = registry.indexOf(`_r("${key}"`);
const endIndex = registry.indexOf('`));', startIndex);
const entry = registry.substring(startIndex, endIndex + 4);
const backtickStart = entry.indexOf('`');
const backtickEnd = entry.lastIndexOf('`');
const body = entry.substring(backtickStart + 1, backtickEnd);

console.log('First 200 chars of body:');
console.log(body.substring(0, 200));
console.log('---');

const lines = body.split('\n');
for (let index = 0; index < Math.min(30, lines.length); index += 1) {
  const line = lines[index];
  if (line.includes('const exports') || line.includes('const _require') || line.includes('const require') || line.includes('let require')) {
    console.log(`L${index + 1}: ${line.substring(0, 100)}`);
  }
}
