import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

function extractCatalog(filePath: string): any {
  const text = fs.readFileSync(filePath, 'utf8');
  const match = text.match(/const catalog = ([\s\S]*?);\s*const frozenItems =/);
  if (!match) throw new Error(`catalog payload not found: ${filePath}`);
  return JSON.parse(match[1]);
}

describe('generate observation gacha catalog', () => {
  test('every registered hand can be rolled at its rarity and has a local image', () => {
    const { generateObservationGachaCatalogs } = require('../scripts/generate-observation-gacha-catalog.js');
    const helpers = require('../shared/gacha-helpers.js');
    const root = path.resolve(__dirname, '..');
    const { observationCatalog, handCatalog } = generateObservationGachaCatalogs({ root, write: false });
    expect(handCatalog.items.map((item: any) => item.id)).toEqual(observationCatalog.items.map((item: any) => item.id));
    let lowerBound = 0;
    for (const rarity of ['EXR', 'UR', 'SSR', 'SR', 'R', 'N']) {
      const items = observationCatalog.items.filter((item: any) => item.rarity === rarity);
      const weight = helpers.RARITY_WEIGHTS[rarity];
      items.forEach((item: any, index: number) => {
        const randomValues = [(lowerBound + weight / 2) / 10000, (index + 0.5) / items.length];
        const result = helpers.rollObservationGacha(observationCatalog.items, { randomFn: () => randomValues.shift() });
        expect(result.item.id).toBe(item.id);
        expect(fs.existsSync(path.join(root, item.imagePath))).toBe(true);
      });
      lowerBound += weight;
    }
    expect(lowerBound).toBe(10000);
  });

  test('preserves generatedAt and avoids rewriting when catalog items are unchanged', () => {
    const { generateObservationGachaCatalogs } = require('../scripts/generate-observation-gacha-catalog.js');
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gacha-catalog-stable-'));
    const observationOutPath = path.join(tmpRoot, 'shared', 'observation-gacha-catalog.generated.js');
    const handAdapterOutPath = path.join(tmpRoot, 'shared', 'gacha-hand-catalog.generated.js');
    try {
      fs.mkdirSync(path.join(tmpRoot, 'assets', 'images', 'Gacha', 'N'), { recursive: true });
      fs.mkdirSync(path.join(tmpRoot, 'shared'), { recursive: true });
      fs.writeFileSync(path.join(tmpRoot, 'assets', 'images', 'Gacha', 'N', 'sample.png'), 'sample');

      const first = generateObservationGachaCatalogs({ root: tmpRoot, observationOutPath, handAdapterOutPath });
      expect(first.wroteFiles).toBe(true);
      const stableObservationGeneratedAt = extractCatalog(observationOutPath).generatedAt;
      const stableHandGeneratedAt = extractCatalog(handAdapterOutPath).generatedAt;

      const second = generateObservationGachaCatalogs({ root: tmpRoot, observationOutPath, handAdapterOutPath });

      expect(second.wroteFiles).toBe(false);
      expect(second.observationCatalog.generatedAt).toBe(stableObservationGeneratedAt);
      expect(second.handCatalog.generatedAt).toBe(stableHandGeneratedAt);
      expect(extractCatalog(observationOutPath).generatedAt).toBe(stableObservationGeneratedAt);
      expect(extractCatalog(handAdapterOutPath).generatedAt).toBe(stableHandGeneratedAt);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  test('derives rarity and display name from assets/images/Gacha', () => {
    const { generateObservationGachaCatalogs } = require('../scripts/generate-observation-gacha-catalog.js');
    const result = generateObservationGachaCatalogs({
      root: path.resolve(__dirname, '..'),
      write: false
    });

    expect(result.handCatalog.sourceDir).toBe('assets/images/Gacha');
    expect(result.handCatalog.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'gacha__n__人の手',
        label: '人の手',
        rarity: 'N',
        imagePath: 'assets/images/Gacha/N/人の手.png'
      }),
      expect.objectContaining({
        id: 'gacha__n__陽気な手',
        label: '陽気な手',
        rarity: 'N',
        imagePath: 'assets/images/Gacha/N/陽気な手.png'
      }),
      expect.objectContaining({
        id: 'gacha__n__小鬼の手',
        label: '小鬼の手',
        rarity: 'N',
        imagePath: 'assets/images/Gacha/N/小鬼の手.png'
      }),
      expect.objectContaining({
        id: 'gacha__sr__虹の手',
        label: '虹の手',
        rarity: 'SR',
        imagePath: 'assets/images/Gacha/SR/虹の手.png'
      })
    ]));

    for (const rarity of ['N', 'R', 'SR', 'SSR', 'UR', 'EXR']) {
      expect(result.observationCatalog.items.filter((item: any) => item.rarity === rarity).length).toBeGreaterThanOrEqual(8);
    }
    expect(result.observationCatalog.items.every((item: any) => item.kind === 'hand_skin')).toBe(true);
    expect(result.handCatalog.items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'gacha__n__background_skin__観測できなかった夜'
      }),
      expect.objectContaining({
        id: 'gacha__sr__background_skin__宇宙の観測'
      })
    ]));
  });
});
