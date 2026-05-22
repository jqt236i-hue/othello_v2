import * as fs from 'fs';

const registryContent = fs.readFileSync('public/module-registry.js', 'utf8');
const match = registryContent.match(/_r\("([^"]+)",\s*("(?:[^"\\]|\\.)*")\s*\);/);

if (match) {
  const key = match[1];
  const jsonString = match[2];
  console.log('Key:', key);
  console.log('JSON string first 100 chars:', jsonString.substring(0, 100));
  console.log('JSON string last 20 chars:', jsonString.substring(jsonString.length - 20));
  try {
    const body = JSON.parse(jsonString) as string;
    console.log('JSON.parse: SUCCESS');
    if (body.startsWith('var _require')) {
      console.log('Body starts with var _require: OK');
    } else {
      console.log('Body starts with:', body.substring(0, 50));
    }
  } catch (error) {
    const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error);
    console.log('JSON.parse FAILED:', message);
    for (let index = 0; index < jsonString.length; index += 1) {
      try {
        JSON.parse(jsonString.substring(0, index + 1));
      } catch (innerError) {
        console.log('First failure at position', index, 'char:', jsonString[index], 'code:', jsonString.charCodeAt(index));
        break;
      }
    }
  }
} else {
  console.log('No match for first entry');
}

try {
  new Function(registryContent);
  console.log('\nEntire registry file: VALID JS');
} catch (error) {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error);
  console.log('\nEntire registry file: INVALID JS -', message);
}
