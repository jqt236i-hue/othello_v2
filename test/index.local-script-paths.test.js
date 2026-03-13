const fs = require('fs');
const path = require('path');

function collectLocalScriptPaths(html) {
  const out = [];
  const pattern = /<script\b[^>]*\bsrc="([^"]+)"/g;
  let match = null;
  while ((match = pattern.exec(html)) !== null) {
    const src = String(match[1] || '').trim();
    if (!src) continue;
    if (/^(?:https?:)?\/\//.test(src)) continue;
    out.push(src);
  }
  return out;
}

describe('index local script paths', () => {
  test.each([
    {
      label: 'index.html',
      htmlPath: path.resolve(__dirname, '../index.html'),
      baseDir: path.resolve(__dirname, '..')
    },
    {
      label: 'worker-public/index.html',
      htmlPath: path.resolve(__dirname, '../worker-public/index.html'),
      baseDir: path.resolve(__dirname, '../worker-public')
    }
  ])('%s only references existing local scripts', ({ htmlPath, baseDir }) => {
    const html = fs.readFileSync(htmlPath, 'utf8');
    const missing = collectLocalScriptPaths(html)
      .filter((scriptPath) => !fs.existsSync(path.resolve(baseDir, scriptPath)));

    expect(missing).toEqual([]);
  });
});