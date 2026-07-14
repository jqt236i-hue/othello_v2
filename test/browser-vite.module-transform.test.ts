import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { transformLegacyBrowserModule } = require('../scripts/browser-vite-module-transform');

function record(root: string, moduleKey: string, content: string): any {
  const sourcePath = path.join(root, `${moduleKey}.js`);
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, content, 'utf8');
  return { moduleKey, aliases: [`${moduleKey}.js`], sourcePath, content };
}

describe('Vite legacy browser module transform', () => {
  let root = '';

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'vite-module-transform-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('turns included literal dependencies into bundler-owned static requires', () => {
    const dependency = record(root, 'game/dependency', 'module.exports = { ok: true };');
    const owner = record(root, 'game/owner', 'module.exports = require("./dependency");');
    const stagedDependency = path.join(root, 'stage', 'game', 'dependency.js');
    const output = transformLegacyBrowserModule({
      record: owner,
      records: [owner, dependency],
      includedModuleKeys: new Set(['game/owner', 'game/dependency']),
      stagedPathByModuleKey: new Map([
        ['game/owner', path.join(root, 'stage', 'game', 'owner.js')],
        ['game/dependency', stagedDependency]
      ])
    });

    expect(output).toContain(`require(${JSON.stringify(stagedDependency.replace(/\\/g, '/'))})`);
    expect(output).not.toContain('window.require("./dependency"');
  });

  test('routes deferred require values and dynamic ids through the accessor bridge', () => {
    const owner = record(root, 'game/owner', [
      'const deferred = typeof require === "function" ? require : null;',
      'module.exports = (id) => deferred(id);'
    ].join('\n'));
    const output = transformLegacyBrowserModule({
      record: owner,
      records: [owner],
      includedModuleKeys: new Set(['game/owner']),
      stagedPathByModuleKey: new Map([['game/owner', path.join(root, 'stage', 'game', 'owner.js')]])
    });

    expect(output.match(/window\.require\(id, "game"\)/g)?.length).toBeGreaterThanOrEqual(2);
  });

  test('fails when a local JavaScript dependency is outside the browser inventory', () => {
    record(root, 'game/missing', 'module.exports = {};');
    const owner = record(root, 'game/owner', 'module.exports = require("./missing");');

    expect(() => transformLegacyBrowserModule({
      record: owner,
      records: [owner],
      includedModuleKeys: new Set(['game/owner']),
      stagedPathByModuleKey: new Map([['game/owner', path.join(root, 'stage', 'game', 'owner.js')]])
    })).toThrow(/local JavaScript dependency is outside browser records/);
  });
});
