// Fix duplicate "const _require" and "use strict" in dist files
const fs = require('fs');
const path = require('path');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.name.endsWith('.js')) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes('const _require =')) {
        const lines = content.split('\n');
        const newLines = [];
        let seenRequire = false;
        let seenStrict = false;
        for (const line of lines) {
          // Skip duplicate 'use strict'
          if (line.trim() === "'use strict';" || line.trim() === '"use strict";') {
            if (seenStrict) continue;
            seenStrict = true;
            newLines.push(line);
            continue;
          }
          // Skip duplicate const _require
          if (line.trim().startsWith('const _require =') || line.trim().startsWith('const _require=')) {
            if (seenRequire) continue;
            seenRequire = true;
            newLines.push(line);
            continue;
          }
          newLines.push(line);
        }
        if (newLines.length !== lines.length) {
          fs.writeFileSync(full, newLines.join('\n'));
          console.log('Fixed: ' + full);
        }
      }
    }
  }
}

walk('dist');
console.log('Done');
