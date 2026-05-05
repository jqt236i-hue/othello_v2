// Remove all local function _require(id) definitions from dist files
// The global window._require (returns window) will handle these instead
const fs = require('fs');
const path = require('path');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      walk(full);
    } else if (entry.name.endsWith('.js')) {
      let content = fs.readFileSync(full, 'utf8');
      if (content.includes('function _require(id)')) {
        // Remove the entire _require function definition block
        // Pattern: function _require(id) { ... } with optional preceding comment
        content = content.replace(
          /\/\*\*?\s*\*?\s*@file[\s\S]*?\*\/\s*function _require\(id\)\s*\{[\s\S]*?\n\}/g,
          ''
        );
        content = content.replace(
          /function _require\(id\)\s*\{[\s\S]*?\n\}/g,
          '// _require removed - using global\n'
        );
        fs.writeFileSync(full, content);
      }
    }
  }
}

walk('dist');
console.log('Done removing local _require functions');
