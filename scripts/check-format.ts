import * as fs from 'fs';

const registry = fs.readFileSync('public/module-registry.js', 'utf8');
const entryPattern = /_r\("([^"]+)",/g;

let match: RegExpExecArray | null;
let count = 0;

while ((match = entryPattern.exec(registry)) !== null && count < 5) {
  const key = match[1];
  const start = match.index;
  const end = registry.indexOf(');', start);
  const snippet = registry.substring(start, Math.min(start + 150, end + 2));
  console.log(`Entry ${count + 1}: ${snippet}`);
  count += 1;
}

console.log('\nFile size:', registry.length, 'bytes');
console.log('File starts with:', registry.substring(0, 80));
