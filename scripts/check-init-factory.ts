import * as fs from 'fs';

const registry = fs.readFileSync('public/module-registry.js', 'utf8');
const key = 'ui/handlers/init';
const pattern = new RegExp(`_r\\("${key.replace(/\//g, '\\/')}",\\s*("(?:[^"\\\\]|\\\\.)*")`);
const match = registry.match(pattern);

if (!match) {
  console.log('NOT FOUND');
  process.exit(1);
}

const body = JSON.parse(match[1]) as string;

console.log('=== Factory body first 2000 chars ===');
console.log(body.substring(0, 2000));
