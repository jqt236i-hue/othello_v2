import * as fs from 'fs';
import * as path from 'path';
import { OPTIMIZED_UI_IMAGES } from '../ui/assets/optimized-ui-images.generated';
import { visibleRgbaPixelsEqual } from '../scripts/assets/lossless-webp-pipeline';

const root = path.resolve(__dirname, '..');

describe('optimized UI image policy and lossless pipeline', () => {
  test('allows invisible RGB differences but requires alpha and visible RGB equality', () => {
    const source = Buffer.from([
      10, 20, 30, 0,
      40, 50, 60, 255
    ]);
    expect(visibleRgbaPixelsEqual(
      source,
      Buffer.from([
        99, 88, 77, 0,
        40, 50, 60, 255
      ])
    )).toBe(true);
    expect(visibleRgbaPixelsEqual(
      source,
      Buffer.from([
        10, 20, 30, 1,
        40, 50, 60, 255
      ])
    )).toBe(false);
    expect(visibleRgbaPixelsEqual(
      source,
      Buffer.from([
        10, 20, 30, 0,
        41, 50, 60, 255
      ])
    )).toBe(false);
  });

  test('records every candidate and maps each admitted lossless or lossy output', () => {
    const manifest = JSON.parse(fs.readFileSync(
      path.join(root, 'assets', 'images', 'optimized-ui-images.json'),
      'utf8'
    ));
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.codec).toBe('webp-lossless');
    expect(manifest.codecs).toEqual(['webp-lossless', 'webp-lossy']);
    expect(manifest.minimumSavingsRatio).toBe(0.1);
    expect(manifest.images).toHaveLength(15);
    manifest.images.forEach((image: any) => {
      expect(['webp-lossless', 'webp-lossy']).toContain(image.codec);
      if (image.codec === 'webp-lossless') {
        expect(image.visiblePixelsEqual).toBe(true);
        expect(image.quality).toBeNull();
      } else {
        expect(image.visiblePixelsEqual).toBe(false);
        expect(image.quality).toBe(90);
      }
      expect(image.savingsRatio).toBeGreaterThanOrEqual(0.1);
      expect(image.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(image.outputSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(image.width).toBeGreaterThan(0);
      expect(image.height).toBeGreaterThan(0);
      expect(image.admission.status).toBe('admitted');
      expect(image.output).toBe(image.candidateOutput);
      expect(fs.existsSync(path.join(root, image.output))).toBe(true);
    });

    const frame = manifest.images.find((image: any) => (
      image.source === 'assets/images/board/board-frame-marsh-forged-iron-v1.png'
    ));
    expect(frame).toMatchObject({
      criticalPath: true,
      codec: 'webp-lossless',
      output: 'assets/images/board/board-frame-marsh-forged-iron-v1.webp',
      admission: { status: 'admitted' },
      measurement: {
        hardwareDecode: {
          sampleCountPerFormat: 12,
          order: 'alternating',
          pngMedianMs: 12,
          webpMedianMs: 10.75,
          deltaMs: -1.25,
          allowedDeltaMs: 2,
          verdict: 'admitted'
        }
      }
    });

    // Start-up textures ship as lossy WebP: transfer size dominates first load.
    const felt = manifest.images.find((image: any) => (
      image.source === 'assets/images/board/board-surface-bluegreen-felt-v1.png'
    ));
    expect(felt).toMatchObject({ criticalPath: true, codec: 'webp-lossy', quality: 90 });
    expect(felt.savingsRatio).toBeGreaterThan(0.5);
    const lossyTotals = manifest.images
      .filter((image: any) => image.codec === 'webp-lossy')
      .reduce(
        (totals: { source: number; output: number }, image: any) => ({
          source: totals.source + image.sourceBytes,
          output: totals.output + image.outputBytes
        }),
        { source: 0, output: 0 }
      );
    expect(lossyTotals.output).toBeLessThan(lossyTotals.source * 0.25);

    const expectedMapping = Object.fromEntries(
      manifest.images.map((image: any) => [image.source, image.output])
    );
    expect(manifest.admittedMapping).toEqual(expectedMapping);
    expect(OPTIMIZED_UI_IMAGES).toEqual(manifest.admittedMapping);
  });
});
