const fs = require('fs');
const path = require('path');
const { generateManifest } = require('./generate-asset-manifest');

function check() {
  const root = path.resolve(__dirname, '..');
  const expectedPath = path.join(root, 'assets', 'asset-manifest.json');
  if (!fs.existsSync(expectedPath)) {
    console.error('[check-manifest] committed manifest not found:', expectedPath);
    process.exit(2);
  }
  const existing = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
  const res = generateManifest({ root });
  const generated = res.manifest;
  // Simple string compare ignoring generatedAt
  existing.generatedAt = generated.generatedAt;
  generated.generatedAt = existing.generatedAt;
  const a = JSON.stringify(existing, null, 2);
  const b = JSON.stringify(generated, null, 2);
  if (a !== b) {
    console.error('[check-manifest] manifest mismatch');
    process.exit(1);
  }
  console.log('[check-manifest] manifest up-to-date');
  process.exit(0);
}

if (require.main === module) check();
module.exports = { check };
