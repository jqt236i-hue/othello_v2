import * as fs from 'fs';
import * as path from 'path';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface CardCatalog {
  version: number;
  cards: any[];
  [key: string]: any;
}

function generate(): CardCatalog {
  const jsonPath = path.resolve(process.cwd(), 'cards', 'catalog.json');
  const json: CardCatalog = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  // Ensure version exists
  if (typeof json.version === 'undefined') json.version = 1;
  return json;
}

function toBrowserCatalog(source: CardCatalog): CardCatalog {
  return {
    ...source,
    cards: Array.isArray(source.cards)
      ? source.cards.map((card: any) => ({
          ...card,
          name: card.name_ja || card.name || '',
          desc: card.desc_ja || card.desc || ''
        }))
      : []
  };
}

function generateFile(outPath: string) {
  const obj = generate();
  const content = '// Auto-generated from cards/catalog.json - do not edit directly.\n' +
    '// Use: node scripts/generate-catalog.js to regenerate.\n' +
    'window.CardCatalog = ' + JSON.stringify(obj, null, 2) + ';\n';
  fs.writeFileSync(outPath, content, 'utf8');
}

function generateBrowserFile(outPath: string) {
  const obj = toBrowserCatalog(generate());
  const content = '// Auto-generated from cards/catalog.json - do not edit directly.\n' +
    '// Use: node scripts/generate-catalog.js to regenerate.\n' +
    'window.CardCatalog = ' + JSON.stringify(obj, null, 2) + ';\n';
  fs.writeFileSync(outPath, content, 'utf8');
}

function generateTsFile(outPath: string) {
  const obj = toBrowserCatalog(generate());
  const content = '// Auto-generated from cards/catalog.json - do not edit directly.\n' +
    '// Use: node scripts/generate-catalog.js to regenerate.\n' +
    'const CardCatalog = ' + JSON.stringify(obj, null, 2) + ';\n\n' +
    'export = CardCatalog;\n';
  fs.writeFileSync(outPath, content, 'utf8');
}

if (require.main === module) {
  const generatedPath = path.resolve(process.cwd(), 'cards', 'catalog.generated.js');
  const browserPath = path.resolve(process.cwd(), 'cards', 'catalog.js');
  const tsPath = path.resolve(process.cwd(), 'cards', 'catalog.ts');
  generateFile(generatedPath);
  generateBrowserFile(browserPath);
  generateTsFile(tsPath);
  console.log('Generated', generatedPath);
  console.log('Generated', browserPath);
  console.log('Generated', tsPath);
}

export = {  generate, generateFile, toBrowserCatalog, generateBrowserFile, generateTsFile  } as any;
