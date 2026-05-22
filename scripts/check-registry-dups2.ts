import * as fs from 'fs';

const registry = fs.readFileSync('public/module-registry.js', 'utf8');
const entryPattern = /_r\("([^"]+)",\s*new Function\(/g;

let match: RegExpExecArray | null;
let last = '';
let duplicates = 0;

while ((match = entryPattern.exec(registry)) !== null) {
  if (match[1] === last) {
    console.log('DUP:', match[1]);
    duplicates += 1;
  }
  last = match[1];
}

console.log('duplicates:', duplicates);

const lines = registry.split('\n');
console.log('Line 16590:', (lines[16589] || '').substring(0, 80));
console.log('Line 81002:', (lines[81001] || '').substring(0, 80));
