// Fix webpack compat _require declarations in dist files
// Replace const _require = ... with const _require = window._require;
// This preserves variable declarations and references, just redirects to our global.
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
      let changed = false;
      
      // Pattern 1: Single-line const _require = ... ? ... : ...;
      // Replace entire const _require = ... statement with const _require = window._require;
      if (content.includes('const _require =')) {
        // Multi-line version (with line continuation)
        content = content.replace(
          /const _require = \(typeof __non_webpack_require__ !== 'undefined'\)\r?\n\s+\? __non_webpack_require__\r?\n\s+: require;/g,
          'const _require = window._require;'
        );
        
        // Multi-line alternative quote style
        content = content.replace(
          /const _require = \(typeof __non_webpack_require__ !== "undefined"\)\r?\n\s+\? __non_webpack_require__\r?\n\s+: require;/g,
          'const _require = window._require;'
        );
        
        // Single-line version
        content = content.replace(
          /const _require = \(typeof __non_webpack_require__ !== 'undefined' \? __non_webpack_require__ : require\);/g,
          'const _require = window._require;'
        );
        
        content = content.replace(
          /const _require = \(typeof __non_webpack_require__ !== "undefined" \? __non_webpack_require__ : require\);/g,
          'const _require = window._require;'
        );
        
        // Handle consecutive duplicate 'use strict' lines
        content = content.replace(
          /(["']use strict["'];)\r?\n\1\r?\n/g,
          '$1\n'
        );
        
        if (content !== fs.readFileSync(full, 'utf8')) {
          changed = true;
        }
      }
      
      if (changed) {
        fs.writeFileSync(full, content);
        console.log('Fixed: ' + full);
      }
    }
  }
}

walk('dist');
console.log('Done');
