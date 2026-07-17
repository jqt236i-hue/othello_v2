import * as fs from 'fs';
import * as path from 'path';

function assertSniperScriptOrder(html: string, targetLabel: string) {
  const moduleRegistryMatch = html.match(/<script\s+src="public\/module-registry\.js\?v=\d+"><\/script>/);
  const entryBrowserMatch = html.match(/<script\s+src="entry-browser\.js\?v=\d+"><\/script>/);
  const moduleRegistryIndex = moduleRegistryMatch ? moduleRegistryMatch.index : -1;
  const entryBrowserIndex = entryBrowserMatch ? entryBrowserMatch.index : -1;

  expect(moduleRegistryIndex).toBeGreaterThanOrEqual(0);
  expect(entryBrowserIndex).toBeGreaterThanOrEqual(0);
  expect(moduleRegistryIndex).toBeLessThan(entryBrowserIndex);

  if (moduleRegistryIndex < 0 || entryBrowserIndex < 0 || moduleRegistryIndex >= entryBrowserIndex) {
    throw new Error(`${targetLabel}: module registry must load before entry-browser`);
  }
}

function assertSniperModuleRegistry(registry: string, targetLabel: string) {
  const requiredModules = [
    'game/logic/cards-internal/random-source',
    'game/logic/cards/sniper',
    'game/logic/cards/lightning',
    'game/logic/cards/destroy_dragon',
    'game/logic/cards'
  ];

  for (const moduleId of requiredModules) {
    expect(registry).toContain(`_r("${moduleId}"`);
  }

  if (!requiredModules.every((moduleId) => registry.includes(`_r("${moduleId}"`))) {
    throw new Error(`${targetLabel}: sniper dependency modules are missing from registry`);
  }
}

function assertOthelloAiRuntimeRegistry(registry: string, targetLabel: string) {
  const requiredModules = [
    'othello-ai/core/board',
    'othello-ai/eval/value-table',
    'othello-ai/runtime/browser-cpu',
    'othello-ai/runtime/engine',
    'othello-ai/search/teacher'
  ];

  for (const moduleId of requiredModules) {
    expect(registry).toContain(`_r("${moduleId}"`);
  }

  if (!requiredModules.every((moduleId) => registry.includes(`_r("${moduleId}"`))) {
    throw new Error(`${targetLabel}: othello AI runtime dependency modules are missing from registry`);
  }

  expect(registry).not.toContain('const zlib = __importStar(require("zlib"))');
  if (registry.includes('const zlib = __importStar(require("zlib"))')) {
    throw new Error(`${targetLabel}: browser policy-table runtime must not require Node zlib at module load`);
  }
}

function assertBrowserRuntimeCompanions(registry: string, targetLabel: string) {
  const requiredModules = [
    'game/visual-effects-map.runtime',
    'game/network-turn-handoff.runtime'
  ];

  for (const moduleId of requiredModules) {
    expect(registry).toContain(`_r("${moduleId}"`);
  }

  if (!requiredModules.every((moduleId) => registry.includes(`_r("${moduleId}"`))) {
    throw new Error(`${targetLabel}: runtime companion modules are missing from registry`);
  }
}

describe('sniper module load order', () => {
  test('index.classic.html loads the module registry before entry-browser.js', () => {
    const htmlPath = path.join(__dirname, '..', 'index.classic.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    assertSniperScriptOrder(html, 'index.classic.html');
    const registryPath = path.join(__dirname, '..', 'public', 'module-registry.js');
    const registry = fs.readFileSync(registryPath, 'utf8');
    const optionalRegistryPath = path.join(__dirname, '..', 'public', 'module-registry.optional.js');
    const optionalRegistry = fs.readFileSync(optionalRegistryPath, 'utf8');
    assertSniperModuleRegistry(registry, 'public/module-registry.js');
    assertOthelloAiRuntimeRegistry(optionalRegistry, 'public/module-registry.optional.js');
    assertBrowserRuntimeCompanions(registry, 'public/module-registry.js');
  });

  test('worker-public/index.classic.html loads the module registry before entry-browser.js', () => {
    const htmlPath = path.join(__dirname, '..', 'worker-public', 'index.classic.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    assertSniperScriptOrder(html, 'worker-public/index.classic.html');
    const registryPath = path.join(__dirname, '..', 'worker-public', 'public', 'module-registry.js');
    const registry = fs.readFileSync(registryPath, 'utf8');
    const optionalRegistryPath = path.join(__dirname, '..', 'worker-public', 'public', 'module-registry.optional.js');
    const optionalRegistry = fs.readFileSync(optionalRegistryPath, 'utf8');
    assertSniperModuleRegistry(registry, 'worker-public/public/module-registry.js');
    assertOthelloAiRuntimeRegistry(optionalRegistry, 'worker-public/public/module-registry.optional.js');
    assertBrowserRuntimeCompanions(registry, 'worker-public/public/module-registry.js');
  });
});
