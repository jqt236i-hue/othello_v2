import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '..');
const heroAssetPath = 'assets/images/hero/hero.png';

function expectExactFileCase(relativePath: string) {
  const fullPath = path.join(repoRoot, ...relativePath.split('/'));
  const dir = path.dirname(fullPath);
  const expectedName = path.basename(fullPath);
  const actualName = fs.readdirSync(dir).find((name) => name.toLowerCase() === expectedName.toLowerCase());

  expect(actualName).toBe(expectedName);
  expect(fs.existsSync(fullPath)).toBe(true);
}

test('hero image references match the deployed asset case', () => {
  const indexHtml = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
  const workerIndexHtml = fs.readFileSync(path.join(repoRoot, 'worker-public', 'index.html'), 'utf8');
  const statusDisplaySource = fs.readFileSync(path.join(repoRoot, 'ui', 'status-display.ts'), 'utf8');

  expect(indexHtml).toContain(`src="${heroAssetPath}"`);
  expect(workerIndexHtml).toContain(`src="${heroAssetPath}"`);
  expect(statusDisplaySource).toContain(`'${heroAssetPath}'`);
  expectExactFileCase(heroAssetPath);
  expectExactFileCase(`worker-public/${heroAssetPath}`);
});
