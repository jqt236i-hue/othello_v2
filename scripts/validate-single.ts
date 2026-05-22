import * as fs from 'fs';

const registry = fs.readFileSync('public/module-registry.js', 'utf8');
const key = 'card-system';
const startIndex = registry.indexOf(`_r("${key}"`);
const endIndex = registry.indexOf('`));', startIndex);
const entry = registry.substring(startIndex, endIndex + 4);
const backtickStart = entry.indexOf('`');
const backtickEnd = entry.lastIndexOf('`');
const body = entry.substring(backtickStart + 1, backtickEnd);
const unescaped = body.replace(/\\`/g, '`').replace(/\\\$\{/g, '${').replace(/\\\\/g, '\\');

try {
  new Function('module', 'exports', 'require', '__dirname', '__filename', unescaped);
  console.log(`${key}: OK`);
} catch (error) {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error);
  console.log(`${key}: ${message.substring(0, 200)}`);
  const positionMatch = message.match(/position\s+(\d+)/);
  if (positionMatch) {
    const position = Number.parseInt(positionMatch[1], 10);
    console.log(`Near error pos ${position}:`, unescaped.substring(Math.max(0, position - 50), position + 50));
  }
}
