import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

const root = path.resolve(__dirname, '..');
const matPath = 'assets/images/ui/card-area-espresso-leather-v1';

describe('espresso leather hand mat', () => {
  test('uses the same decorative image for both hands without intercepting input', () => {
    const css = fs.readFileSync(path.join(root, 'styles-layout.css'), 'utf8');
    for (const owner of ['black', 'white']) {
      const rule = css.match(new RegExp(`#hand-${owner}::before\\s*\\{[\\s\\S]*?\\n\\}`))?.[0];
      expect(rule).toContain(`background-image: url("${matPath}.webp")`);
    }
    expect(css.match(/\.hand-container::before\s*\{[\s\S]*?\n\}/)?.[0])
      .toContain('pointer-events: none');
  });

  test('ships an optimized mat with identical dimensions and transparent corners', async () => {
    const source = sharp(path.join(root, `${matPath}.png`));
    const output = sharp(path.join(root, `${matPath}.webp`));
    const [sourceMeta, outputMeta] = await Promise.all([source.metadata(), output.metadata()]);
    expect(sourceMeta.width).toBeGreaterThan(sourceMeta.height! * 3);
    expect(outputMeta.width).toBe(sourceMeta.width);
    expect(outputMeta.height).toBe(sourceMeta.height);
    expect(outputMeta.hasAlpha).toBe(true);
    const [png, webp] = await Promise.all([
      source.ensureAlpha().raw().toBuffer(), output.ensureAlpha().raw().toBuffer()
    ]);
    for (let i = 3; i < png.length; i += 4) {
      if (png[i] !== webp[i]) throw new Error(`alpha mismatch at pixel ${(i - 3) / 4}`);
    }
    expect(webp[3]).toBe(0);
    const center = (Math.floor(outputMeta.height! / 2) * outputMeta.width! + Math.floor(outputMeta.width! / 2)) * 4;
    expect(webp[center + 3]).toBe(255);
  });
});
