import * as fs from 'fs';
import * as path from 'path';
import {
  DEFAULT_STATIC_ASSET_CACHE_CONTROL,
  loadStaticAssetHeaders,
  parseStaticAssetHeaders,
  resolveStaticAssetHeaders
} from '../scripts/static-asset-headers';

const ROOT = path.resolve(__dirname, '..');
const { computeScriptVersionToken } = require('../scripts/sync-browser-script-versions');
const { ROOT_FILES } = require('../scripts/prepare-worker-assets');

describe('static asset _headers', () => {
  test('parses path rules, a single splat, comments and repeated headers like the edge', () => {
    const rules = parseStaticAssetHeaders([
      '# comment',
      '/vite-dist/assets/*',
      '  Cache-Control: public, max-age=31536000, immutable',
      '/a.css',
      '  X-One: 1',
      '/*.css',
      '  X-One: 2'
    ].join('\n'));
    expect(resolveStaticAssetHeaders(rules, '/vite-dist/assets/index-abc123.js')).toEqual({
      'cache-control': 'public, max-age=31536000, immutable'
    });
    expect(resolveStaticAssetHeaders(rules, '/a.css')).toEqual({ 'x-one': '1, 2' });
    expect(resolveStaticAssetHeaders(rules, '/vite-dist/other.js')).toEqual({});
    expect(() => parseStaticAssetHeaders('/a/*/b/*\n  X: 1')).toThrow(/one splat/);
  });

  test('marks only content-addressed URLs immutable', () => {
    const rules = loadStaticAssetHeaders(ROOT);
    const immutable = rules.filter((rule) => /immutable/.test(rule.headers['cache-control'] || ''));
    expect(immutable.map((rule) => rule.pattern)).toContain('/vite-dist/assets/*');
    const classic = fs.readFileSync(path.join(ROOT, 'index.classic.html'), 'utf8');
    const htmlFiles = ['index.html', 'index.classic.html', 'index.vite.html']
      .map((file) => [file, fs.readFileSync(path.join(ROOT, file), 'utf8')] as const);
    for (const rule of immutable.filter((entry) => !entry.pattern.includes('*'))) {
      const relativePath = rule.pattern.slice(1);
      const file = path.join(ROOT, relativePath);
      expect(fs.existsSync(file)).toBe(true);
      const token = computeScriptVersionToken(file);
      // Referenced by the classic document, so every lane version-stamps it.
      expect(classic).toContain(`${relativePath}?v=${token}`);
      const escaped = relativePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      for (const [name, html] of htmlFiles) {
        for (const match of html.matchAll(new RegExp(`(?<!style-(?:after|before)=)["']${escaped}(\\?v=(\\d+))?["']`, 'g'))) {
          expect({ name, relativePath, version: match[2] || null }).toEqual({ name, relativePath, version: token });
        }
      }
    }
    for (const pathname of ['/index.html', '/', '/assets/asset-manifest.json', '/styles-feature-gacha.css',
      '/styles-leaderboard.css', '/ui/layout-stage.js', '/public/module-registry.optional.js']) {
      expect(resolveStaticAssetHeaders(rules, pathname)['cache-control'] || DEFAULT_STATIC_ASSET_CACHE_CONTROL)
        .toBe(DEFAULT_STATIC_ASSET_CACHE_CONTROL);
    }
  });

  test('is mirrored to the Worker assets root', () => {
    expect(ROOT_FILES).toContain('_headers');
  });
});
