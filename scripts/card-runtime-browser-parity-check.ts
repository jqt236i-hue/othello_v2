import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import * as crypto from 'crypto';
import type { AddressInfo } from 'net';
import { chromium, type Browser, type Page } from 'playwright';

const ROOT = path.resolve(process.cwd());
const PARITY_FIXTURE_PATH = path.join(ROOT, 'test', 'fixtures', 'card-runtime-parity-fixture.js');
const EXPECTED_PARITY = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'test', 'fixtures', 'card-runtime-parity-expected.v1.json'),
  'utf8'
));
const EXPECTED_OPTIONAL_PRESENTATION = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'test', 'fixtures', 'card-runtime-optional-presentation-expected.v1.json'),
  'utf8'
));

function sha256(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function assertFixedFixture(result: any, lane: string): void {
  const observed = {
    fixtureVersion: result.fixtureVersion,
    overallDigest: sha256(result),
    canonicalDigest: sha256(result.canonical),
    prngLedgerDigest: sha256(result.prng.ledger),
    resultDigest: sha256(result.results),
    pendingDigest: sha256(result.pendingBeforeCancel),
    scenarioDigest: sha256(result.scenarioCoverage),
    runtimeProjectionInventory: result.canonical.runtimeProjectionInventory,
    prng: result.prng.state,
    eventTypes: result.canonical.presentationEvents.map((event: any) => event.type),
    heavenOffers: result.results.heavenOffers,
    pending: result.pendingBeforeCancel
  };
  if (JSON.stringify(observed) !== JSON.stringify(EXPECTED_PARITY)) {
    throw new Error(`${lane} fixed fixture drift expected=${JSON.stringify(EXPECTED_PARITY)} observed=${JSON.stringify(observed)}`);
  }
}

function contentType(filePath: string): string {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.wasm')) return 'application/wasm';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

function createStaticServer() {
  return http.createServer((request, response) => {
    const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
    const relative = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '') || 'index.html';
    const filePath = path.resolve(ROOT, relative);
    if (filePath !== ROOT && !filePath.startsWith(`${ROOT}${path.sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    fs.readFile(filePath, (error, bytes) => {
      if (error) {
        response.writeHead(404).end('Not Found');
        return;
      }
      response.setHeader('content-type', contentType(filePath));
      response.end(bytes);
    });
  });
}

async function closeServer(server: http.Server): Promise<void> {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function readLane(page: Page, url: string, lane: string): Promise<any> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  try {
    await page.waitForFunction(() => {
      const root = globalThis as any;
      return !!root.CardLogic && Reflect.ownKeys(root.CardLogic).length === 289;
    }, null, { timeout: 30_000 });
  } catch (error) {
    const diagnostics = await page.evaluate(() => {
      const root = globalThis as any;
      return {
        bootState: document.documentElement.getAttribute('data-browser-boot-state'),
        uiInitialized: root.__uiInitialized,
        cardLogicKeys: root.CardLogic ? Reflect.ownKeys(root.CardLogic).length : null,
        bootError: document.getElementById('browserViteBootError')?.textContent || null,
        hasRequire: typeof root.require === 'function'
      };
    }).catch(() => null);
    throw new Error(`${lane} CardLogic readiness failed diagnostics=${JSON.stringify(diagnostics)} errors=${JSON.stringify(errors)} cause=${error instanceof Error ? error.message : String(error)}`);
  }
  await page.addScriptTag({ path: PARITY_FIXTURE_PATH });
  const result = await page.evaluate(() => {
    const root = globalThis as any;
    const cardLogic = root.CardLogic;
    const spawnAndFlipGlobalBeforeRequire = root.CardSpawnAndFlip;
    const requiredOnce = root.require('game/logic/cards');
    const requiredTwice = root.require('./dist/game/logic/cards');
    const spawnAndFlipRequired = root.require('game/logic/cards-internal/spawn-and-flip');
    const moduleExportUtils = root.require('shared/module-export-utils');
    const unwrapped = moduleExportUtils.unwrapModuleExport(requiredOnce);
    const pendingCoordinator = root.require('game/turn/pending-coordinator');
    const pendingBeforeStore = pendingCoordinator.readPendingSelectionAction('black');
    pendingCoordinator.storePendingSelectionAction(
      'black',
      { type: 'pending_selection', cardId: 'destroy_01', turnIndex: 77 },
      'DESTROY_ONE_STONE'
    );
    const pendingAfterStore = pendingCoordinator.readPendingSelectionAction('black');
    const schema = Reflect.ownKeys(cardLogic).map((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(cardLogic, key)!;
      return {
        key: typeof key === 'symbol' ? key.toString() : key,
        kind: typeof cardLogic[key],
        enumerable: descriptor.enumerable,
        configurable: descriptor.configurable,
        writable: 'writable' in descriptor ? descriptor.writable : null,
        hasGetter: typeof descriptor.get === 'function',
        hasSetter: typeof descriptor.set === 'function'
      };
    });
    return {
      lane: document.documentElement.getAttribute('data-browser-lane'),
      schema,
      identity: {
        globalEqualsFirstRequire: cardLogic === requiredOnce,
        globalEqualsNormalizedRequire: cardLogic === requiredTwice,
        repeatedRequireIdentity: requiredOnce === requiredTwice,
        unwrapIdentity: unwrapped === cardLogic,
        spawnAndFlipGlobalPresentBeforeRequire: !!spawnAndFlipGlobalBeforeRequire,
        spawnAndFlipGlobalEqualsWrapper: spawnAndFlipGlobalBeforeRequire === spawnAndFlipRequired,
        requireAliasesIdentity: root.require === root._require && root.require === root.__require
          && root.require === root.__non_webpack_require__
      },
      evaluation: {
        bootModulesPresent: !!root.__CARD_REVERSI_BOOT_MODULES__,
        registeredGroups: root.__CARD_REVERSI_VITE_MODULE_BRIDGE__
          ? root.__CARD_REVERSI_VITE_MODULE_BRIDGE__.registeredGroups()
          : ['classic-registry'],
        pendingBeforeStore,
        pendingAfterStore
      },
      fixedFixture: root.CardRuntimeParityFixture.run(cardLogic),
      optionalPresentationProbe: root.CardRuntimeParityFixture.runOptionalPresentationProbe(cardLogic)
    };
  });
  const blockingErrors = errors.filter((message) => !/Unknown CPU vendor|No available adapters|WebGPU/i.test(message));
  if (blockingErrors.length > 0) {
    throw new Error(`${lane} browser errors: ${blockingErrors.join(' | ')}`);
  }
  return result;
}

async function main(): Promise<void> {
  const server = createStaticServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = (server.address() as AddressInfo).port;
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ headless: true });
    const vitePage = await browser.newPage();
    const classicPage = await browser.newPage();
    const vite = await readLane(vitePage, `http://127.0.0.1:${port}/index.html?debug=1&noanim=1`, 'vite');
    const classic = await readLane(classicPage, `http://127.0.0.1:${port}/index.classic.html?debug=1&noanim=1`, 'classic');
    if (vite.lane !== 'vite' || classic.lane !== 'classic') {
      throw new Error(`browser lane markers mismatch vite=${vite.lane} classic=${classic.lane}`);
    }
    if (JSON.stringify(vite.schema) !== JSON.stringify(classic.schema)) {
      throw new Error('Vite/classic CardLogic descriptor schema mismatch');
    }
    for (const result of [vite, classic]) {
      if (!Object.values(result.identity).every(Boolean)) {
        throw new Error(`${result.lane} CardLogic identity mismatch: ${JSON.stringify(result.identity)}`);
      }
      if (result.evaluation.pendingBeforeStore !== null || !result.evaluation.pendingAfterStore) {
        throw new Error(`${result.lane} module-state initialization mismatch: ${JSON.stringify(result.evaluation)}`);
      }
      if (result.evaluation.bootModulesPresent !== true) {
        throw new Error(`${result.lane} boot-module metadata was not installed`);
      }
      const groups = result.evaluation.registeredGroups;
      if (!Array.isArray(groups) || groups.length === 0
        || new Set(groups).size !== groups.length
        || JSON.stringify(groups) !== JSON.stringify(groups.slice().sort())) {
        throw new Error(`${result.lane} registered module groups are missing, duplicated, or unordered: ${JSON.stringify(groups)}`);
      }
      if (result.lane === 'vite' && !groups.includes('startup')) {
        throw new Error(`vite startup module group was not registered: ${JSON.stringify(groups)}`);
      }
      if (result.lane === 'classic' && JSON.stringify(groups) !== JSON.stringify(['classic-registry'])) {
        throw new Error(`classic registry group drift: ${JSON.stringify(groups)}`);
      }
      assertFixedFixture(result.fixedFixture, result.lane);
      const optionalProbe = result.optionalPresentationProbe;
      if (JSON.stringify(optionalProbe.eventTypes) !== JSON.stringify(EXPECTED_OPTIONAL_PRESENTATION.browserEventTypes)
        || sha256(optionalProbe.board) !== EXPECTED_OPTIONAL_PRESENTATION.boardDigest
        || sha256(optionalProbe.marker) !== EXPECTED_OPTIONAL_PRESENTATION.markerDigest
        || JSON.stringify(optionalProbe.prng) !== JSON.stringify(EXPECTED_OPTIONAL_PRESENTATION.prng)) {
        throw new Error(`${result.lane} optional presentation branch drift: ${JSON.stringify(optionalProbe)}`);
      }
    }

    const viteReloaded = await readLane(vitePage, `http://127.0.0.1:${port}/index.html?debug=1&noanim=1&reload=1`, 'vite-reload');
    const classicReloaded = await readLane(classicPage, `http://127.0.0.1:${port}/index.classic.html?debug=1&noanim=1&reload=1`, 'classic-reload');
    for (const reloaded of [viteReloaded, classicReloaded]) {
      if (reloaded.evaluation.pendingBeforeStore !== null) {
        throw new Error(`${reloaded.lane} page reconstruction retained module state`);
      }
      if (reloaded.evaluation.bootModulesPresent !== true
        || !Array.isArray(reloaded.evaluation.registeredGroups)
        || reloaded.evaluation.registeredGroups.length === 0) {
        throw new Error(`${reloaded.lane} page reconstruction lost registration metadata`);
      }
      assertFixedFixture(reloaded.fixedFixture, reloaded.lane);
      if (JSON.stringify(reloaded.optionalPresentationProbe.eventTypes)
        !== JSON.stringify(EXPECTED_OPTIONAL_PRESENTATION.browserEventTypes)) {
        throw new Error(`${reloaded.lane} optional presentation reconstruction drift`);
      }
    }
    if (sha256(vite.fixedFixture) !== sha256(classic.fixedFixture)
      || sha256(vite.fixedFixture) !== sha256(viteReloaded.fixedFixture)
      || sha256(classic.fixedFixture) !== sha256(classicReloaded.fixedFixture)) {
      throw new Error('Vite/classic/reloaded fixed-fixture digest mismatch');
    }
    console.log(`[card-runtime-browser-parity] passed keys=${vite.schema.length} fixture=${sha256(vite.fixedFixture)} lanes=vite,classic,reload`);
  } finally {
    if (browser) await browser.close();
    await closeServer(server);
  }
}

main().catch((error) => {
  console.error(`[card-runtime-browser-parity] ${error instanceof Error ? error.stack || error.message : String(error)}`);
  process.exitCode = 1;
});
