import * as fs from 'fs';
import * as path from 'path';

function walk(dir: string): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'worker-public') continue;
      walk(fullPath);
    } else if (entry.name.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if ((content.match(/const _require = window\._require;?/g) || []).length > 1) {
        let first = true;
        content = content.replace(/const _require = window\._require;?\r?\n/g, (match) => {
          if (first) {
            first = false;
            return match;
          }
          return '';
        });
        fs.writeFileSync(fullPath, content);
        console.log(`Deduped: ${fullPath}`);
      }
    }
  }
}

walk('dist');
console.log('Done deduping');
