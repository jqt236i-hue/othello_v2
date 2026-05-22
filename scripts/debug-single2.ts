import * as fs from 'fs';

const registry = fs.readFileSync('public/module-registry.js', 'utf8');
const key = 'card-system';
const searchString = `_r("${key}"`;
const startIndex = registry.indexOf(searchString);
const endIndex = registry.indexOf('`));', startIndex + 10);
const entry = registry.substring(startIndex, Math.min(startIndex + 5000, endIndex + 4));
const lines = entry.split('\n');

for (let index = 0; index < 30 && index < lines.length; index += 1) {
  console.log(`${index}: ${lines[index].substring(0, 120)}`);
}
