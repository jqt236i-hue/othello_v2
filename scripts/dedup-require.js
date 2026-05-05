// Remove duplicate const _require = window._require; declarations
const fs = require('fs');
const path = require('path');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'worker-public') continue;
      walk(full);
    } else if (entry.name.endsWith('.js')) {
      let content = fs.readFileSync(full, 'utf8');
      if ((content.match(/const _require = window\._require;?/g) || []).length > 1) {
        // Keep only the first occurrence
        let first = true;
        content = content.replace(/const _require = window\._require;?\r?\n/g, (match) => {
          if (first) { first = false; return match; }
          return '';
        });
        fs.writeFileSync(full, content);
        console.log('Deduped: ' + full);
      }
    }
  }
}

walk('dist');
console.log('Done deduping');
