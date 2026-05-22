import * as fs from 'fs';

const registry = fs.readFileSync('public/module-registry.js', 'utf8');
const entryPattern = /_r\("([^"]+)",\s*("(?:[^"\\]|\\.)*")\s*\);/g;

let match: RegExpExecArray | null;
let checked = 0;
let fails = 0;

while ((match = entryPattern.exec(registry)) !== null) {
  const key = match[1];
  const jsonString = match[2];
  let body: string;
  try {
    body = JSON.parse(jsonString) as string;
  } catch (error) {
    fails += 1;
    if (fails <= 10) {
      const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error);
      console.log(`JSON[${key}]: ${message.substring(0, 80)}`);
    }
    continue;
  }
  try {
    new Function('module', 'exports', '__dirname', '__filename', body);
  } catch (error) {
    fails += 1;
    if (fails <= 20) {
      const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error);
      console.log(`FN[${key}]: ${message.substring(0, 100)}`);
    }
  }
  checked += 1;
}

console.log(`\nChecked: ${checked}  Fails: ${fails}`);
if (fails > 20) console.log(`... and ${fails - 20} more failures`);
