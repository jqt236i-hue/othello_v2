const path = require('path');

const catalogGenerator = require('../dist/scripts/generate-catalog');

if (require.main === module) {
  const generatedPath = path.resolve(process.cwd(), 'cards', 'catalog.generated.js');
  const browserPath = path.resolve(process.cwd(), 'cards', 'catalog.js');
  const tsPath = path.resolve(process.cwd(), 'cards', 'catalog.ts');
  catalogGenerator.generateFile(generatedPath);
  catalogGenerator.generateBrowserFile(browserPath);
  catalogGenerator.generateTsFile(tsPath);
  console.log('Generated', generatedPath);
  console.log('Generated', browserPath);
  console.log('Generated', tsPath);
}

module.exports = catalogGenerator;
