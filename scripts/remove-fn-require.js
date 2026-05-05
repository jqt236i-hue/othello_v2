// Remove local function _require(id) definitions from dist files
// (different from const _require = ... which was already fixed)
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
      if (content.includes('function _require(id)')) {
        // Remove the entire function _require(id) { ... } block
        content = content.replace(
          /function _require\(id\)\s*\{[\s\S]*?\n\}/g,
          '// _require removed (using global)'
        );
        fs.writeFileSync(full, content);
        console.log('Removed fn: ' + full);
      }
    }
  }
}

walk('dist');
console.log('Done');
