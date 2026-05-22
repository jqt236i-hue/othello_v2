import * as fs from 'fs';

const registry = fs.readFileSync('public/module-registry.js', 'utf8');
const matches: Array<{ key: string; pos: number }> = [];

let pos = 0;
while ((pos = registry.indexOf('const exports =', pos)) !== -1) {
  const previousRegister = registry.lastIndexOf('_r("', pos);
  const keyMatch = registry.substring(previousRegister, previousRegister + 80).match(/_r\("([^"]+)"/);
  matches.push({ key: keyMatch ? keyMatch[1] : 'unknown', pos });
  pos += 15;
}

console.log('Remaining const exports = :', matches.length);
for (const match of matches.slice(0, 10)) {
  console.log(`  ${match.key} at pos ${match.pos}`);
}

let requirePos = 0;
let requireMatches = 0;
while ((requirePos = registry.indexOf('const require', requirePos)) !== -1) {
  requireMatches += 1;
  requirePos += 14;
}
console.log('Remaining const require:', requireMatches);

const bareRequirePattern = /(?<!\w)require\("/g;
let bareRequire = 0;
while (bareRequirePattern.exec(registry) !== null) {
  bareRequire += 1;
}
console.log('Bare require( calls:', bareRequire);
