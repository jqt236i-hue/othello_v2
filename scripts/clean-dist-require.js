// Remove webpack compat _require blocks from dist files
const fs = require('fs');
const path = require('path');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.name.endsWith('.js')) {
      let content = fs.readFileSync(full, 'utf8');
      
      // Pattern 1: "use strict";\nconst _require = (...)\n    ? ...\n    : require; (multi-line)
      // Pattern 2: 'use strict';\nconst _require = ... ? ... : ...; (single-line)
      // Remove BOTH occurrences of const _require blocks (may appear 2x)
      
      // Remove all "const _require = ..." declarations (both multi and single line)
      // Strategy: replace known patterns
      
      // Multi-line version
      content = content.replace(
        /const _require = \(typeof __non_webpack_require__ !== 'undefined'\)\r?\n\s+\? __non_webpack_require__\r?\n\s+: require;\r?\n/g,
        ''
      );
      
      // Single-line version (with optional preceding 'use strict')
      content = content.replace(
        /('use strict';|"use strict";)\r?\nconst _require = \(typeof __non_webpack_require__ !== 'undefined' \? __non_webpack_require__ : require\);\r?\n/g,
        "$1\n"
      );
      
      // Any remaining const _require lines (catch-all)
      content = content.replace(
        /const _require = \(typeof __non_webpack_require__ !== 'undefined' \? __non_webpack_require__ : require\);\r?\n/g,
        ''
      );
      
      // Clean up orphaned continuation lines (indented ? __non... or : require; without parent const)
      content = content.replace(
        /\s+\? __non_webpack_require__\r?\n\s+: require;\r?\n/g,
        '\n'
      );
      
      // Remove consecutive 'use strict' duplicates (any quote style)
      content = content.replace(
        /[\"']use strict[\"'];?\r?\n[\"']use strict[\"'];?\r?\n/g,
        ''
      );
      // Ensure file starts with "use strict"; if it doesn't already
      if (!content.startsWith('"use strict"') && !content.startsWith("'use strict'")) {
        content = '"use strict";\n' + content.replace(/^[\"']use strict[\"'];?\r?\n/g, '');
      }
      
      fs.writeFileSync(full, content);
    }
  }
}

walk('dist');
console.log('Done cleaning dist files');
