import * as fs from 'fs';

const html = fs.readFileSync('index.html', 'utf8');
const scriptPattern = /<script\s[^>]*src=["']([^"']+)["'][^>]*><\/script>/g;
const htmlScripts = new Set<string>();

let match: RegExpExecArray | null;
while ((match = scriptPattern.exec(html)) !== null) {
  htmlScripts.add(match[1].replace(/^\.\//, '').replace(/\.js$/, ''));
}

const entry = fs.readFileSync('entry-browser.js', 'utf8');
const requirePattern = /require\(["'](\.\/dist\/[^"']+)["']\)/g;
const entryRequires = new Set<string>();

while ((match = requirePattern.exec(entry)) !== null) {
  entryRequires.add(match[1]);
}

console.log('=== FILES IN ENTRY-BROWSER BUT NOT IN INDEX.HTML ===');
let notFound = 0;
for (const requirement of entryRequires) {
  const normalized = requirement.replace(/^\.\/dist\//, '');
  let found = false;
  for (const htmlScript of htmlScripts) {
    if (
      htmlScript === normalized
      || htmlScript === normalized.replace(/\.js$/, '')
      || htmlScript.replace(/\.js$/, '') === normalized.replace(/\.js$/, '')
    ) {
      found = true;
      break;
    }
  }
  if (!found) {
    console.log(`  ${requirement}`);
    notFound += 1;
  }
}

console.log(`\nHTML scripts: ${htmlScripts.size}`);
console.log(`Entry requires: ${entryRequires.size}`);
console.log(`Not in HTML: ${notFound}`);
