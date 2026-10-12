import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '..');
const heroAssetPath = 'assets/images/hero/hero.png';
const whiteHeroAssetPath = 'assets/images/hero/hero-white.png';

function expectExactFileCase(relativePath: string) {
  const fullPath = path.join(repoRoot, ...relativePath.split('/'));
  const dir = path.dirname(fullPath);
  const expectedName = path.basename(fullPath);
  const actualName = fs.readdirSync(dir).find((name) => name.toLowerCase() === expectedName.toLowerCase());

  expect(actualName).toBe(expectedName);
  expect(fs.existsSync(fullPath)).toBe(true);
}

test('white opponent hero asset ships unchanged with exact file casing', () => {
  const statusDisplaySource = fs.readFileSync(path.join(repoRoot, 'ui', 'status-display.ts'), 'utf8');
  expect(statusDisplaySource).toContain(`'${whiteHeroAssetPath}'`);
  expectExactFileCase(whiteHeroAssetPath);
  expectExactFileCase(`worker-public/${whiteHeroAssetPath}`);
  const source = fs.readFileSync(path.join(repoRoot, whiteHeroAssetPath));
  const mirror = fs.readFileSync(path.join(repoRoot, 'worker-public', whiteHeroAssetPath));
  expect(source.equals(mirror)).toBe(true);
});

test('hero image references match the deployed asset case', () => {
  const indexHtml = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
  const workerIndexHtml = fs.readFileSync(path.join(repoRoot, 'worker-public', 'index.html'), 'utf8');
  const classicIndexHtml = fs.readFileSync(path.join(repoRoot, 'index.classic.html'), 'utf8');
  const workerClassicIndexHtml = fs.readFileSync(path.join(repoRoot, 'worker-public', 'index.classic.html'), 'utf8');
  const statusDisplaySource = fs.readFileSync(path.join(repoRoot, 'ui', 'status-display.ts'), 'utf8');

  expect(classicIndexHtml).toContain(`src="${heroAssetPath}"`);
  expect(classicIndexHtml).toContain(
    `data-card-reversi-logical-src="${heroAssetPath}" src="${heroAssetPath}"`
  );
  expect(workerClassicIndexHtml).toContain(`src="${heroAssetPath}"`);
  expect(statusDisplaySource).toContain(`'${heroAssetPath}'`);
  expectExactFileCase(heroAssetPath);
  expectExactFileCase(`worker-public/${heroAssetPath}`);

  const viteHeroSrc = indexHtml.match(
    /id="hero-character-img"[^>]*\ssrc="\.\/(vite-dist\/assets\/hero-[^"]+\.png)"/
  )?.[1];
  expect(indexHtml).toContain(`data-card-reversi-logical-src="${heroAssetPath}"`);
  expect(viteHeroSrc).toBeTruthy();
  expect(workerIndexHtml).toContain(`src="./${viteHeroSrc}"`);
  expectExactFileCase(viteHeroSrc as string);
  expectExactFileCase(`worker-public/${viteHeroSrc}`);
});
