import * as fs from 'fs';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '..');
const launcherId = 'reversiDestinyOpenLink';
const productionUrl = 'https://reversi-destiny.pages.dev/';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function collectSourceReferences(relativeDirectory: string): string[] {
  const directory = path.join(repoRoot, relativeDirectory);
  const references: string[] = [];
  const visit = (currentDirectory: string) => {
    for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
      const absolutePath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }
      if (!/\.(?:js|json|mjs|ts)$/u.test(entry.name)) continue;
      const source = fs.readFileSync(absolutePath, 'utf8');
      if (source.includes(launcherId) || source.includes(productionUrl)) {
        references.push(path.relative(repoRoot, absolutePath).replace(/\\/gu, '/'));
      }
    }
  };
  visit(directory);
  return references;
}

describe('Reversi Destiny on-demand launcher contract', () => {
  test('classic source exposes one secure native link and no eager external request hint', () => {
    const html = read('index.classic.html');
    const link = html.match(new RegExp(`<a\\s+id="${launcherId}"[\\s\\S]*?<\\/a>`, 'u'))?.[0];

    expect(link).toBeDefined();
    expect(link).toContain(`href="${productionUrl}"`);
    expect(link).toContain('target="_blank"');
    expect(link).toContain('rel="noopener noreferrer external"');
    expect(link).toContain('referrerpolicy="no-referrer"');
    expect(link).toContain('aria-describedby="parallelWorldsLinkNotice"');
    expect(link).toContain('Reversi Destiny');
    expect(html).toMatch(/id="parallelWorldsLinkNotice"[^>]*>選んだゲームは別タブで開き、カードリバーシの対局はこのタブで続きます。/u);
    expect(link).toContain('title="別タブで開く（カードリバーシは継続します）"');
    expect(link).not.toMatch(/\son\w+=/u);
    expect(html.match(new RegExp(productionUrl.replace(/[./]/gu, '\\$&'), 'gu'))).toHaveLength(1);
    expect(html).not.toMatch(/<link[^>]+rel="(?:preload|prefetch|preconnect)"[^>]*reversi-destiny/iu);
    expect(html).not.toMatch(/<(?:iframe|script)[^>]+reversi-destiny/iu);
  });

  test('generated browser documents preserve the same launcher contract', () => {
    for (const relativePath of ['index.html', 'index.vite.html']) {
      const html = read(relativePath);
      expect(html).toContain(`id="${launcherId}"`);
      expect(html).toContain(`href="${productionUrl}"`);
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener noreferrer external"');
      expect(html).toContain('referrerpolicy="no-referrer"');
      expect(html.match(new RegExp(productionUrl.replace(/[./]/gu, '\\$&'), 'gu'))).toHaveLength(1);
    }
  });

  test('gameplay and authority sources do not depend on the companion launcher', () => {
    expect([
      ...collectSourceReferences('game'),
      ...collectSourceReferences('shared'),
      ...collectSourceReferences('workers'),
    ]).toEqual([]);
  });
});
