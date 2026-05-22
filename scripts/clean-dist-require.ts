import * as fs from 'fs';
import * as path from 'path';

function walk(dir: string): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.name.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');

      content = content.replace(
        /const _require = \(typeof __non_webpack_require__ !== 'undefined'\)\r?\n\s+\? __non_webpack_require__\r?\n\s+: require;\r?\n/g,
        ''
      );

      content = content.replace(
        /('use strict';|"use strict";)\r?\nconst _require = \(typeof __non_webpack_require__ !== 'undefined' \? __non_webpack_require__ : require\);\r?\n/g,
        '$1\n'
      );

      content = content.replace(
        /const _require = \(typeof __non_webpack_require__ !== 'undefined' \? __non_webpack_require__ : require\);\r?\n/g,
        ''
      );

      content = content.replace(
        /\s+\? __non_webpack_require__\r?\n\s+: require;\r?\n/g,
        '\n'
      );

      content = content.replace(
        /["']use strict["'];?\r?\n["']use strict["'];?\r?\n/g,
        ''
      );

      if (!content.startsWith('"use strict"') && !content.startsWith("'use strict'")) {
        content = `"use strict";\n${content.replace(/^["']use strict["'];?\r?\n/g, '')}`;
      }

      fs.writeFileSync(fullPath, content);
    }
  }
}

walk('dist');
console.log('Done cleaning dist files');
