import * as fs from 'fs';

const registry = fs.readFileSync('public/module-registry.js', 'utf8');
const lines = registry.split('\n');
const errorTypes: Record<string, number> = {};

let checked = 0;
let failCount = 0;

for (let index = 0; index < lines.length; index += 1) {
  const line = lines[index].trim();
  if (!line.startsWith('_r(')) continue;

  const firstQuote = line.indexOf('"');
  if (firstQuote < 0) continue;
  const secondQuote = line.indexOf('"', firstQuote + 1);
  if (secondQuote < 0) continue;
  const jsonStart = line.indexOf('"', secondQuote + 1);
  if (jsonStart < 0) continue;

  let jsonEnd = jsonStart + 1;
  while (jsonEnd < line.length) {
    if (line[jsonEnd] === '\\') {
      jsonEnd += 2;
      continue;
    }
    if (line[jsonEnd] === '"') break;
    jsonEnd += 1;
  }

  const jsonString = line.substring(jsonStart, jsonEnd + 1);
  let body: string;
  try {
    body = JSON.parse(jsonString) as string;
  } catch (error) {
    failCount += 1;
    if (failCount <= 20) {
      const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error);
      console.log(`[${line.substring(4, 40)}...]: JSON parse error: ${message.substring(0, 80)}`);
    }
    continue;
  }

  try {
    new Function('module', 'exports', '__dirname', '__filename', body);
  } catch (error) {
    failCount += 1;
    const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error);
    const errorType = message.split('\n')[0].substring(0, 80);
    errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
    if (failCount <= 20) {
      console.log(`[${line.substring(4, 40)}...]: ${message.substring(0, 150)}`);
    }
  }
  checked += 1;
}

console.log('\nChecked:', checked, 'Fails:', failCount);
console.log('Error type counts:', JSON.stringify(errorTypes));
