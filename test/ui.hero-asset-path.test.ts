import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '..');
const heroAssetPath = 'assets/images/hero/HERO.png';

test('hero image references match the deployed asset case', () => {
  const indexHtml = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
  const statusDisplaySource = fs.readFileSync(path.join(repoRoot, 'ui', 'status-display.ts'), 'utf8');

  expect(indexHtml).toContain(`src="${heroAssetPath}"`);
  expect(statusDisplaySource).toContain(`'${heroAssetPath}'`);
});
