'use strict';
const fs = require('fs');
const path = require('path');

function generate() {
  const jsonPath = path.resolve(__dirname, '..', 'cards', 'catalog.json');
  const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  // Ensure version exists
  if (typeof json.version === 'undefined') json.version = 1;
  return json;
}

function generateFile(outPath) {
  const obj = generate();
  const content = '// Auto-generated from cards/catalog.json - do not edit directly.\n' +
    '// Use: node scripts/generate-catalog.js to regenerate.\n' +
    'window.CardCatalog = ' + JSON.stringify(obj, null, 2) + ';\n';
  fs.writeFileSync(outPath, content, 'utf8');
}

if (require.main === module) {
  const outPath = path.resolve(__dirname, '..', 'cards', 'catalog.generated.js');
  generateFile(outPath);
  console.log('Generated', outPath);
}

module.exports = { generate, generateFile };