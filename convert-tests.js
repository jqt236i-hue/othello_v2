const fs = require('fs');
const path = require('path');

const files = process.argv.slice(2);

files.forEach(file => {
  const jsPath = path.resolve(file);
  if (!fs.existsSync(jsPath)) {
    console.log(`SKIP: ${file} not found`);
    return;
  }

  const content = fs.readFileSync(jsPath, 'utf8');
  const filename = path.basename(file, '.js');
  const tsPath = jsPath.replace(/\.js$/, '.ts');

  // Determine wrapper path based on depth
  const parts = file.split(/[/\\]/);
  const depth = parts.length - 1;
  const prefix = '../'.repeat(depth);
  const wrapperPath = `${prefix}dist/test/${filename}.js`;

  // Convert require statements to imports
  const lines = content.split(/\r?\n/);
  const convertedLines = lines.map(line => {
    // const x = require('...');
    const simpleRequire = line.match(/^(\s*)const\s+(\w+)\s+=\s+require\(['"'](.+?)['"]\)\s*;?\s*$/);
    if (simpleRequire) {
      const [, indent, varName, modulePath] = simpleRequire;
      let mp = modulePath;
      if (mp.startsWith('.') && !/\.(js|json)$/.test(mp)) {
        mp += '.js';
      }
      return `${indent}import * as ${varName} from '${mp}';`;
    }

    // const { x, y } = require('...');
    const destructRequire = line.match(/^(\s*)const\s+\{([^}]+)\}\s+=\s+require\(['"'](.+?)['"]\)\s*;?\s*$/);
    if (destructRequire) {
      const [, indent, imports, modulePath] = destructRequire;
      let mp = modulePath;
      if (mp.startsWith('.') && !/\.(js|json)$/.test(mp)) {
        mp += '.js';
      }
      const cleanImports = imports.trim().replace(/\s+/g, ' ');
      return `${indent}import { ${cleanImports} } from '${mp}';`;
    }

    // module.exports = ...
    if (/^\s*module\.exports\s*=/.test(line)) {
      return `// ${line}`;
    }

    return line;
  });

  const tsContent = convertedLines.join('\n');

  // Write TypeScript file
  fs.writeFileSync(tsPath, tsContent);

  // Create wrapper JS file
  const wrapperContent = `"use strict";\n` +
    `/** @type {any} */\n` +
    `module.exports = require('${wrapperPath}');\n`;
  fs.writeFileSync(jsPath, wrapperContent);

  console.log(`CONVERTED: ${file}`);
});

console.log(`\nBatch complete: ${files.length} files processed`);
