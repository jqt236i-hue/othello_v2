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

  test('records every candidate while materializing only hardware-pending or admitted output', () => {
    const manifest = JSON.parse(fs.readFileSync(
      path.join(root, 'assets', 'images', 'optimized-ui-images.json'),
      'utf8'
    ));
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.codec).toBe('webp-lossless');
    expect(manifest.minimumSavingsRatio).toBe(0.1);
    expect(manifest.images).toHaveLength(3);
    manifest.images.forEach((image: any) => {
      expect(image.visiblePixelsEqual).toBe(true);
      expect(image.savingsRatio).toBeGreaterThanOrEqual(0.1);
      expect(image.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(image.outputSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(image.width).toBeGreaterThan(0);
      expect(image.height).toBeGreaterThan(0);
    });

    const frame = manifest.images.find((image: any) => (
      image.source === 'assets/images/board/board-frame-marsh-forged-iron-v1.png'
    ));
    expect(frame).toMatchObject({
      criticalPath: true,
      output: 'assets/images/board/board-frame-marsh-forged-iron-v1.webp',
      admission: { status: 'pending-hardware' }
    });
    expect(fs.existsSync(path.join(root, frame.output))).toBe(true);

    const rejected = manifest.images.filter((image: any) => (
      image.admission.status === 'rejected'
    ));
    expect(rejected).toHaveLength(2);
    rejected.forEach((image: any) => {
      expect(image.output).toBeNull();
      expect(fs.existsSync(path.join(root, image.candidateOutput))).toBe(false);
    });
    expect(manifest.admittedMapping).toEqual({});
    expect(OPTIMIZED_UI_IMAGES).toEqual({});
  });
});
