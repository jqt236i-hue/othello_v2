import * as fs from 'fs';
import * as path from 'path';

function walk(dir: string): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      walk(fullPath);
    } else if (entry.name.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('function _require(id)')) {
        content = content.replace(
          /\/\*\*?\s*\*?\s*@file[\s\S]*?\*\/\s*function _require\(id\)\s*\{[\s\S]*?\n\}/g,
          ''
        );
        content = content.replace(
          /function _require\(id\)\s*\{[\s\S]*?\n\}/g,
          '// _require removed - using global\n'
        );
        fs.writeFileSync(fullPath, content);
      }
    }
  }
}

walk('dist');
console.log('Done removing local _require functions');
