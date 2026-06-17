import * as fs from 'fs';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '..');
const generatorSourcePath = path.join(repoRoot, 'scripts', 'generate-card-art-map.ts');
const generatorPath = path.join(repoRoot, 'scripts', 'generate-card-art-map.js');
const generatedMapPath = path.join(repoRoot, 'cards', 'card-art-map.generated.ts');

describe('card art map generator', () => {
  test('generated map is current and every catalog card resolves to an existing card image', () => {
    expect(fs.existsSync(generatorSourcePath)).toBe(true);
    expect(fs.existsSync(generatorPath)).toBe(true);
    expect(fs.existsSync(generatedMapPath)).toBe(true);

    const generator = require(generatorSourcePath);
    const generated = generator.generateCardArtMap({ root: repoRoot, write: false });
    const generatedSource = fs.readFileSync(generatedMapPath, 'utf8');
    const generatedModule = require(generatedMapPath);
    const map = generatedModule.CARD_FACE_ART_FILENAME_BY_ID || generatedModule.default || generatedModule;
    const catalog = require(path.join(repoRoot, 'cards', 'catalog.json'));

    expect(generated.source).toBe(generatedSource);
    for (const card of catalog.cards) {
      const filename = map[card.id];
      expect(filename).toBeTruthy();
      expect(fs.existsSync(path.join(repoRoot, 'assets', 'images', 'card', filename))).toBe(true);
    }
  });
});
