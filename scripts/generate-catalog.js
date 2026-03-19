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

function toBrowserCatalog(source) {
  return {
    ...source,
    cards: Array.isArray(source.cards)
      ? source.cards.map((card) => ({
          ...card,
          name: card.name_ja || card.name || '',
          desc: card.desc_ja || card.desc || ''
        }))
      : []
  };
}

function generateFile(outPath) {
  const obj = generate();
  const content = '// Auto-generated from cards/catalog.json - do not edit directly.\n' +
    '// Use: node scripts/generate-catalog.js to regenerate.\n' +
    'window.CardCatalog = ' + JSON.stringify(obj, null, 2) + ';\n';
  fs.writeFileSync(outPath, content, 'utf8');
}

function generateBrowserFile(outPath) {
  const obj = toBrowserCatalog(generate());
  const content = '// Auto-generated from cards/catalog.json - do not edit directly.\n' +
    '// Use: node scripts/generate-catalog.js to regenerate.\n' +
    'window.CardCatalog = ' + JSON.stringify(obj, null, 2) + ';\n';
  fs.writeFileSync(outPath, content, 'utf8');
}

if (require.main === module) {
  const generatedPath = path.resolve(__dirname, '..', 'cards', 'catalog.generated.js');
  const browserPath = path.resolve(__dirname, '..', 'cards', 'catalog.js');
  generateFile(generatedPath);
  generateBrowserFile(browserPath);
  console.log('Generated', generatedPath);
  console.log('Generated', browserPath);
}

module.exports = { generate, generateFile, toBrowserCatalog, generateBrowserFile };
