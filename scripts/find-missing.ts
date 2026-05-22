import * as fs from 'fs';

const entryBrowser = fs.readFileSync('entry-browser.js', 'utf8');
const requirePattern = /require\(['"]\.\/dist\/([^'"]+)['"]\)/g;
const requirements: string[] = [];

let match: RegExpExecArray | null;
while ((match = requirePattern.exec(entryBrowser)) !== null) {
  requirements.push(match[1]);
}

const registry = fs.readFileSync('public/module-registry.js', 'utf8');
const missing: string[] = [];

for (const requirement of requirements) {
  const key = requirement.replace(/\.js$/, '');
  if (!registry.includes(`_r("${key}"`)) {
    missing.push(key);
  }
}

console.log('Total requires in entry-browser:', requirements.length);
console.log('Missing from registry:', missing.length);
console.log(`Missing modules:\n  ${missing.join('\n  ')}`);
