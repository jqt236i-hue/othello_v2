const path = require('path');

const cardArtMapGenerator = require(path.join(process.cwd(), 'dist', 'scripts', 'generate-card-art-map.js'));

if (require.main === module) {
  const result = cardArtMapGenerator.generateCardArtMap();
  console.log('Generated', result.outPath);
}

module.exports = cardArtMapGenerator;
