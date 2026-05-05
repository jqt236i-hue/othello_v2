// Cross-reference entry-browser.js requires against original index.html script tags
const fs = require('fs');

// Extract all script src from original index.html
const html = fs.readFileSync('index.html', 'utf8');
const scriptRegex = /<script\s[^>]*src=["']([^"']+)["'][^>]*><\/script>/g;
let match;
const htmlScripts = new Set();
while ((match = scriptRegex.exec(html)) !== null) {
  // Normalize: remove leading ./ or trailing .js
  let path = match[1].replace(/^\.\//, '').replace(/\.js$/, '');
  htmlScripts.add(path);
}

// Extract all require paths from entry-browser.js
const entry = fs.readFileSync('entry-browser.js', 'utf8');
const requireRegex = /require\(["'](\.\/dist\/[^"']+)["']\)/g;
const entryRequires = new Set();
while ((match = requireRegex.exec(entry)) !== null) {
  entryRequires.add(match[1]); // e.g., ./dist/game/turn/pending-coordinator
}

// Find requires NOT in html scripts
console.log('=== FILES IN ENTRY-BROWSER BUT NOT IN INDEX.HTML ===');
let notFound = 0;
for (const req of entryRequires) {
  // Normalize: remove ./dist/ prefix
  let normalized = req.replace(/^\.\/dist\//, '');
  // Try to find in html scripts (with or without .js)
  let found = false;
  for (const hs of htmlScripts) {
    if (hs === normalized || hs === normalized.replace(/\.js$/, '') || hs.replace(/\.js$/, '') === normalized.replace(/\.js$/, '')) {
      found = true;
      break;
    }
  }
  if (!found) {
    console.log('  ' + req);
    notFound++;
  }
}

console.log('\nHTML scripts: ' + htmlScripts.size);
console.log('Entry requires: ' + entryRequires.size);
console.log('Not in HTML: ' + notFound);
