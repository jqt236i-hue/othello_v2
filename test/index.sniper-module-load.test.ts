import * as fs from 'fs';
import * as path from 'path';

function assertSniperScriptOrder(html: string, targetLabel: string) {
  const moduleRegistryTag = '<script src="public/module-registry.js?v=202605100670"></script>';
  const entryBrowserTag = '<script src="entry-browser.js?v=202605100670"></script>';
  const moduleRegistryIndex = html.indexOf(moduleRegistryTag);
  const entryBrowserIndex = html.indexOf(entryBrowserTag);

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

describe('sniper module load order', () => {
  test('index.html loads sniper.js before cards.js', () => {
    const htmlPath = path.join(__dirname, '..', 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    assertSniperScriptOrder(html, 'index.html');
    const registryPath = path.join(__dirname, '..', 'public', 'module-registry.js');
    const registry = fs.readFileSync(registryPath, 'utf8');
    assertSniperModuleRegistry(registry, 'public/module-registry.js');
  });

  test('worker-public/index.html loads sniper.js before cards.js', () => {
    const htmlPath = path.join(__dirname, '..', 'worker-public', 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    assertSniperScriptOrder(html, 'worker-public/index.html');
    const registryPath = path.join(__dirname, '..', 'worker-public', 'public', 'module-registry.js');
    const registry = fs.readFileSync(registryPath, 'utf8');
    assertSniperModuleRegistry(registry, 'worker-public/public/module-registry.js');
  });
});
