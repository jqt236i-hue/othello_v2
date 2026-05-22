import * as fs from 'fs';

const source = fs.readFileSync('public/module-registry.js', 'utf8');
const matches = source.match(/_r\("[^"]+"\)/g);

if (matches) {
  for (const match of matches.slice(0, 40)) {
    console.log(match);
  }
  console.log('Total keys:', matches.length);
}
