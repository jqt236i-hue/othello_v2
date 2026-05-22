import * as fs from 'fs';
import * as path from 'path';

let content = fs.readFileSync('entry-browser.js', 'utf8');
content = `window._modules = {};\n${content}`;

const lines = content.split('\n');
const result: string[] = [];
let lastModPath: string | null = null;

for (const line of lines) {
  const requireMatch = line.match(/var _mod\d+ = require\("(.+?)"\)/);
  const assignMatch = line.match(/if \(_mod\d+\) Object\.assign\(window, _mod\d+\)/);

  if (requireMatch) {
    lastModPath = requireMatch[1];
    result.push(line);
  } else if (assignMatch && lastModPath) {
    const absolutePath = path.resolve('dist', lastModPath).replace(/\\/g, '/');
    const varName = assignMatch[0].match(/Object\.assign\(window, (_mod\d+)\)/)?.[1];
    result.push(line);
    if (varName) {
      result.push(`window._modules["${absolutePath}"] = ${varName};`);
    }
    lastModPath = null;
  } else {
    result.push(line);
  }
}

fs.writeFileSync('entry-browser.js', result.join('\n'));
console.log('Added _modules tracking to entry-browser.js');
