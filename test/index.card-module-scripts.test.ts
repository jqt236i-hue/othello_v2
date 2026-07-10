import * as fs from 'fs';
const path = require('path');
const PENDING_SELECTION_CONSUMER_SCRIPTS = [
  'game/card-effects/destroy.js',
  'game/card-effects/strong-wind.js',
  'game/card-effects/teleport.js',
  'game/card-effects/tempt.js',
  'game/card-effects/time-bomb.js',
  'game/card-effects/trap.js',
  'game/card-effects/guard.js',
  'game/card-effects/living-will.js',
  'game/card-effects/hyperactive-inherit.js',
  'game/card-effects/extend-life.js',
  'game/card-effects/swap.js',
  'game/card-effects/position-swap.js',
  'game/card-effects/board-expansion.js',
  'game/card-effects/board-shrink.js',
  'game/card-effects/blockade.js',
  'game/card-effects/meteor.js',
  'game/card-effects/freeze.js',
  'game/card-effects/clone.js',
  'game/card-effects/reverse-will.js'
];

function expectPendingSelectionConsumersLoadAfterSelectionFlow(html: string, rootPath: string) {
  const selectionFlowTag = '<script src="game/card-effects/selection-flow.js"></script>';
  expect(html.includes(selectionFlowTag)).toBe(true);

  const selectionFlowIndex = html.indexOf(selectionFlowTag);
  expect(selectionFlowIndex).toBeGreaterThan(-1);

  for (const relativeScriptPath of PENDING_SELECTION_CONSUMER_SCRIPTS) {
    const scriptTag = `<script src="${relativeScriptPath}"></script>`;
    expect(html.includes(scriptTag)).toBe(true);
    expect(html.indexOf(scriptTag)).toBeGreaterThan(selectionFlowIndex);
    expect(fs.existsSync(path.resolve(__dirname, rootPath, relativeScriptPath))).toBe(true);
  }
}

function expectPresentationHelperLoadsBeforePendingSelection(html: string, rootPath: string) {
  const presentationTag = '<script src="game/logic/presentation.js"></script>';
  const selectionFlowTag = '<script src="game/card-effects/selection-flow.js"></script>';

  expect(html.includes(presentationTag)).toBe(true);
  expect(html.includes(selectionFlowTag)).toBe(true);
  expect(html.indexOf(selectionFlowTag)).toBeGreaterThan(html.indexOf(presentationTag));
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'game/logic/presentation.js'))).toBe(true);
}

function expectPendingSelectionExportSurvivesConsumerScriptLoads(rootPath: string) {
  const runtimeOrder = readRuntimeScriptOrder(rootPath);
  expectPendingSelectionConsumersLoadAfterSelectionFlow(runtimeOrder, rootPath);
}

function expectPresentationHelperClassicExportSurvivesLaterScriptLoads(rootPath: string) {
  const runtimeOrder = readRuntimeScriptOrder(rootPath);
  expectPresentationHelperLoadsBeforePendingSelection(runtimeOrder, rootPath);
}

function expectCardInternalModulesLoadedBeforeCards(html: string, rootPath: string) {
  const sharedBoardUtilsTag = '<script src="shared/shared-board-utils.js"></script>';
  const randomSourceTag = '<script src="game/logic/cards-internal/random-source.js"></script>';
  const stateFactoryTag = '<script src="game/logic/cards-internal/state-factory.js"></script>';
  const moduleResolverTag = '<script src="game/logic/cards-internal/module-resolver.js"></script>';
  const presentationHelpersTag = '<script src="game/logic/cards-internal/presentation-helpers.js"></script>';
  const boardConfigurationTag = '<script src="game/logic/cards-internal/board-configuration.js"></script>';
  const generatedSpawnFlipResolverTag = '<script src="game/logic/cards-internal/generated-spawn-flip-resolver.js"></script>';
  const selectorsTag = '<script src="game/logic/cards/selectors.js"></script>';
  const prechecksTag = '<script src="game/logic/cards-internal/card-usage-prechecks.js"></script>';
  const orchestratorTag = '<script src="game/logic/cards-internal/selector-orchestrator.js"></script>';
  const handManagerTag = '<script src="game/logic/cards-internal/hand-manager.js"></script>';
  const effectTimingTag = '<script src="game/logic/cards-internal/effect-timing.js"></script>';
  const pendingStateManagerTag = '<script src="game/logic/cards-internal/pending-state-manager.js"></script>';
  const chargeLedgerTag = '<script src="game/logic/cards-internal/charge-ledger.js"></script>';
  const cardsTag = '<script src="game/logic/cards.js"></script>';

  expect(html.includes(sharedBoardUtilsTag)).toBe(true);
  expect(html.includes(randomSourceTag)).toBe(true);
  expect(html.includes(stateFactoryTag)).toBe(true);
  expect(html.includes(moduleResolverTag)).toBe(true);
  expect(html.includes(presentationHelpersTag)).toBe(true);
  expect(html.includes(boardConfigurationTag)).toBe(true);
  expect(html.includes(generatedSpawnFlipResolverTag)).toBe(true);
  expect(html.includes(selectorsTag)).toBe(true);
  expect(html.includes(prechecksTag)).toBe(true);
  expect(html.includes(orchestratorTag)).toBe(true);
  expect(html.includes(handManagerTag)).toBe(true);
  expect(html.includes(effectTimingTag)).toBe(true);
  expect(html.includes(pendingStateManagerTag)).toBe(true);
  expect(html.includes(chargeLedgerTag)).toBe(true);
  expect(html.indexOf(randomSourceTag)).toBeGreaterThan(html.indexOf(sharedBoardUtilsTag));
  expect(html.indexOf(stateFactoryTag)).toBeGreaterThan(html.indexOf(randomSourceTag));
  expect(html.indexOf(moduleResolverTag)).toBeGreaterThan(html.indexOf(stateFactoryTag));
  expect(html.indexOf(presentationHelpersTag)).toBeGreaterThan(html.indexOf(moduleResolverTag));
  expect(html.indexOf(boardConfigurationTag)).toBeGreaterThan(html.indexOf(presentationHelpersTag));
  expect(html.indexOf(generatedSpawnFlipResolverTag)).toBeGreaterThan(html.indexOf(boardConfigurationTag));
  expect(html.indexOf(selectorsTag)).toBeGreaterThan(html.indexOf(presentationHelpersTag));
  expect(html.indexOf(prechecksTag)).toBeGreaterThan(html.indexOf(selectorsTag));
  expect(html.indexOf(orchestratorTag)).toBeGreaterThan(html.indexOf(prechecksTag));
  expect(html.indexOf(handManagerTag)).toBeGreaterThan(html.indexOf(orchestratorTag));
  expect(html.indexOf(effectTimingTag)).toBeGreaterThan(html.indexOf(handManagerTag));
  expect(html.indexOf(pendingStateManagerTag)).toBeGreaterThan(html.indexOf(effectTimingTag));
  expect(html.indexOf(chargeLedgerTag)).toBeGreaterThan(html.indexOf(pendingStateManagerTag));
  expect(html.indexOf(cardsTag)).toBeGreaterThan(html.indexOf(chargeLedgerTag));
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'shared/shared-board-utils.js'))).toBe(true);
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'game/logic/cards-internal/random-source.js'))).toBe(true);
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'game/logic/cards-internal/state-factory.js'))).toBe(true);
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'game/logic/cards-internal/module-resolver.js'))).toBe(true);
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'game/logic/cards-internal/presentation-helpers.js'))).toBe(true);
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'game/logic/cards-internal/board-configuration.js'))).toBe(true);
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'game/logic/cards-internal/generated-spawn-flip-resolver.js'))).toBe(true);
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'game/logic/cards-internal/card-usage-prechecks.js'))).toBe(true);
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'game/logic/cards-internal/selector-orchestrator.js'))).toBe(true);
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'game/logic/cards-internal/hand-manager.js'))).toBe(true);
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'game/logic/cards-internal/effect-timing.js'))).toBe(true);
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'game/logic/cards-internal/pending-state-manager.js'))).toBe(true);
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'game/logic/cards-internal/charge-ledger.js'))).toBe(true);
}

function expectCardLogicModulesLoadedBeforeCards(html: string, rootPath: string) {
  const randomSourceTag = '<script src="game/logic/cards-internal/random-source.js"></script>';
  const movementTag = '<script src="game/logic/cards/movement.js"></script>';
  const livingWillTag = '<script src="game/logic/cards/living_will.js"></script>';
  const teleportTag = '<script src="game/logic/cards/teleport.js"></script>';
  const cloneTag = '<script src="game/logic/cards/clone.js"></script>';
  const meteorTag = '<script src="game/logic/cards/meteor.js"></script>';
  const shrinkTag = '<script src="game/logic/cards/shrink.js"></script>';
  const cardsTag = '<script src="game/logic/cards.js"></script>';

  expect(html.includes(randomSourceTag)).toBe(true);
  expect(html.includes(movementTag)).toBe(true);
  expect(html.includes(livingWillTag)).toBe(true);
  expect(html.includes(teleportTag)).toBe(true);
  expect(html.includes(cloneTag)).toBe(true);
  expect(html.includes(meteorTag)).toBe(true);
  expect(html.includes(shrinkTag)).toBe(true);
  expect(html.indexOf(movementTag)).toBeGreaterThan(html.indexOf(randomSourceTag));
  expect(html.indexOf(livingWillTag)).toBeGreaterThan(html.indexOf(randomSourceTag));
  expect(html.indexOf(teleportTag)).toBeGreaterThan(html.indexOf(randomSourceTag));
  expect(html.indexOf(cloneTag)).toBeGreaterThan(html.indexOf(randomSourceTag));
  expect(html.indexOf(cardsTag)).toBeGreaterThan(html.indexOf(movementTag));
  expect(html.indexOf(cardsTag)).toBeGreaterThan(html.indexOf(livingWillTag));
  expect(html.indexOf(cardsTag)).toBeGreaterThan(html.indexOf(teleportTag));
  expect(html.indexOf(cardsTag)).toBeGreaterThan(html.indexOf(cloneTag));
  expect(html.indexOf(cardsTag)).toBeGreaterThan(html.indexOf(meteorTag));
  expect(html.indexOf(cardsTag)).toBeGreaterThan(html.indexOf(shrinkTag));
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'game/logic/cards-internal/random-source.js'))).toBe(true);
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'game/logic/cards/movement.js'))).toBe(true);
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'game/logic/cards/living_will.js'))).toBe(true);
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'game/logic/cards/teleport.js'))).toBe(true);
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'game/logic/cards/clone.js'))).toBe(true);
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'game/logic/cards/meteor.js'))).toBe(true);
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'game/logic/cards/shrink.js'))).toBe(true);
}

function expectNoLexicalPendingSelectionGlobals(rootPath: string) {
  const rootDir = path.resolve(__dirname, rootPath);
  const cardEffectsDir = path.resolve(rootDir, 'game/card-effects');
  const files = [
    path.resolve(rootDir, 'game/cpu-decision.js'),
    ...fs.readdirSync(cardEffectsDir)
      .filter((name) => name.endsWith('.js') && name !== 'selection-flow.js')
      .map((name) => path.resolve(cardEffectsDir, name))
  ];

  const offenders = files
    .filter((filePath) => {
      const source = fs.readFileSync(filePath, 'utf8');
      return /^(let|const)\s+PendingSelectionFlow\b/m.test(source);
    })
    .map((filePath) => path.relative(rootDir, filePath).replace(/\\/g, '/'))
    .sort();

  expect(offenders).toEqual([]);
}

function readRuntimeScriptOrder(rootPath: string) {
  const entryPath = path.resolve(__dirname, rootPath, 'entry-browser.js');
  const source = fs.readFileSync(entryPath, 'utf8');
  const moduleKeys = Array.from(source.matchAll(
    /\{\s*moduleKey:\s*["']\.\/dist\/([^"']+)["']/g
  )).map((match) => match[1]);
  if (moduleKeys.length > 0) {
    return moduleKeys
      .map((moduleKey) => `<script src="${moduleKey}.js"></script>`)
      .join('\n');
  }

  return source
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/^\s*\/\/ dist\/(.+)$/);
      return match ? `<script src="${match[1]}.js"></script>` : '';
    })
    .filter(Boolean)
    .join('\n');
}

describe('card module script includes', () => {
  test('index.html loads cosmetic catalog shared before hand/background catalog modules', () => {
    const html = readRuntimeScriptOrder('../');
    const sharedTag = '<script src="ui/cosmetics/catalog-shared.js"></script>';
    const backgroundCatalogTag = '<script src="ui/background-skin/catalog.js"></script>';
    const handCatalogTag = '<script src="ui/hand-skin/catalog.js"></script>';

    expect(html.includes(sharedTag)).toBe(true);
    expect(html.includes(backgroundCatalogTag)).toBe(true);
    expect(html.includes(handCatalogTag)).toBe(true);
    expect(html.indexOf(backgroundCatalogTag)).toBeGreaterThan(html.indexOf(sharedTag));
    expect(html.indexOf(handCatalogTag)).toBeGreaterThan(html.indexOf(sharedTag));
    expect(fs.existsSync(path.resolve(__dirname, '../ui/cosmetics/catalog-shared.js'))).toBe(true);
  });

  test('index.html loads network command payload before network-client.js', () => {
    const html = readRuntimeScriptOrder('../');
    const actionSchemaTag = '<script src="shared/network-action-schema.js"></script>';
    const commandPayloadTag = '<script src="ui/network/command-payload.js"></script>';
    const publishRequestTag = '<script src="ui/network/publish-request.js"></script>';
    const reconnectControllerTag = '<script src="ui/network/reconnect-controller.js"></script>';
    const publishTrackerTag = '<script src="ui/network/publish-tracker.js"></script>';
    const snapshotRuntimeTag = '<script src="ui/network/snapshot-runtime.js"></script>';
    const snapshotCanonicalTag = '<script src="ui/network/snapshot-canonical.js"></script>';
    const snapshotPresentationTag = '<script src="ui/network/snapshot-presentation.js"></script>';
    const snapshotTag = '<script src="ui/network/snapshot.js"></script>';
    const sessionSeatTag = '<script src="ui/network/session-seat.js"></script>';
    const sessionLifecycleTag = '<script src="ui/network/session-lifecycle.js"></script>';
    const networkClientTag = '<script src="ui/network-client.js"></script>';

    expect(html.includes(actionSchemaTag)).toBe(true);
    expect(html.includes(commandPayloadTag)).toBe(true);
    expect(html.includes(publishRequestTag)).toBe(true);
    expect(html.includes(reconnectControllerTag)).toBe(true);
    expect(html.includes(publishTrackerTag)).toBe(true);
    expect(html.includes(snapshotRuntimeTag)).toBe(true);
    expect(html.includes(snapshotCanonicalTag)).toBe(true);
    expect(html.includes(snapshotPresentationTag)).toBe(true);
    expect(html.includes(snapshotTag)).toBe(true);
    expect(html.includes(sessionSeatTag)).toBe(true);
    expect(html.includes(sessionLifecycleTag)).toBe(true);
    expect(html.includes(networkClientTag)).toBe(true);
    expect(html.indexOf(commandPayloadTag)).toBeGreaterThan(html.indexOf(actionSchemaTag));
    expect(html.indexOf(publishRequestTag)).toBeGreaterThan(html.indexOf(commandPayloadTag));
    expect(html.indexOf(reconnectControllerTag)).toBeGreaterThan(html.indexOf(publishRequestTag));
    expect(html.indexOf(publishTrackerTag)).toBeGreaterThan(html.indexOf(reconnectControllerTag));
    expect(html.indexOf(snapshotRuntimeTag)).toBeGreaterThan(html.indexOf(publishTrackerTag));
    expect(html.indexOf(snapshotCanonicalTag)).toBeGreaterThan(html.indexOf(snapshotRuntimeTag));
    expect(html.indexOf(snapshotPresentationTag)).toBeGreaterThan(html.indexOf(snapshotCanonicalTag));
    expect(html.indexOf(snapshotTag)).toBeGreaterThan(html.indexOf(snapshotPresentationTag));
    expect(html.indexOf(sessionSeatTag)).toBeGreaterThan(html.indexOf(snapshotTag));
    expect(html.indexOf(sessionLifecycleTag)).toBeGreaterThan(html.indexOf(sessionSeatTag));
    expect(html.indexOf(networkClientTag)).toBeGreaterThan(html.indexOf(sessionLifecycleTag));
    expect(fs.existsSync(path.resolve(__dirname, '../shared/network-action-schema.js'))).toBe(true);
    expect(fs.existsSync(path.resolve(__dirname, '../ui/network/command-payload.js'))).toBe(true);
    expect(fs.existsSync(path.resolve(__dirname, '../ui/network/publish-request.js'))).toBe(true);
    expect(fs.existsSync(path.resolve(__dirname, '../ui/network/reconnect-controller.js'))).toBe(true);
    expect(fs.existsSync(path.resolve(__dirname, '../ui/network/publish-tracker.js'))).toBe(true);
    expect(fs.existsSync(path.resolve(__dirname, '../ui/network/snapshot-runtime.js'))).toBe(true);
    expect(fs.existsSync(path.resolve(__dirname, '../ui/network/snapshot-canonical.js'))).toBe(true);
    expect(fs.existsSync(path.resolve(__dirname, '../ui/network/snapshot-presentation.js'))).toBe(true);
    expect(fs.existsSync(path.resolve(__dirname, '../ui/network/snapshot.js'))).toBe(true);
    expect(fs.existsSync(path.resolve(__dirname, '../ui/network/session-lifecycle.js'))).toBe(true);
  });

  test('index.html loads network turn handoff before trap/cpu/move executor scripts', () => {
    const html = readRuntimeScriptOrder('../');
    const handoffTag = '<script src="game/network-turn-handoff.js"></script>';
    const trapTag = '<script src="game/card-effects/trap.js"></script>';
    const cpuTag = '<script src="game/cpu-decision.js"></script>';
    const moveExecutorTag = '<script src="game/move-executor.js"></script>';

    expect(html.includes(handoffTag)).toBe(true);
    expect(html.indexOf(trapTag)).toBeGreaterThan(html.indexOf(handoffTag));
    expect(html.indexOf(cpuTag)).toBeGreaterThan(html.indexOf(handoffTag));
    expect(html.indexOf(moveExecutorTag)).toBeGreaterThan(html.indexOf(handoffTag));
    expect(fs.existsSync(path.resolve(__dirname, '../game/network-turn-handoff.js'))).toBe(true);
  });

  test('index.html loads will_hunter_king card module before cards.js', () => {
    const html = readRuntimeScriptOrder('../');
    const moduleTag = '<script src="game/logic/cards/will_hunter_king.js"></script>';
    const cardsTag = '<script src="game/logic/cards.js"></script>';

    expect(html.includes(moduleTag)).toBe(true);
    expect(html.indexOf(moduleTag)).toBeGreaterThan(-1);
    expect(html.indexOf(cardsTag)).toBeGreaterThan(html.indexOf(moduleTag));
  });

  test('index.html loads card internal modules before cards.js', () => {
    const html = readRuntimeScriptOrder('../');
    expectCardInternalModulesLoadedBeforeCards(html, '../');
  });

  test('index.html loads markers card module before cards.js', () => {
    const html = readRuntimeScriptOrder('../');
    const moduleTag = '<script src="game/logic/cards/markers.js"></script>';
    const cardsTag = '<script src="game/logic/cards.js"></script>';

    expect(html.includes(moduleTag)).toBe(true);
    expect(html.indexOf(cardsTag)).toBeGreaterThan(html.indexOf(moduleTag));
    expect(fs.existsSync(path.resolve(__dirname, '../game/logic/cards/markers.js'))).toBe(true);
  });

  test('index.html loads movement/teleport/clone/meteor/shrink logic modules before cards.js', () => {
    const html = readRuntimeScriptOrder('../');
    expectCardLogicModulesLoadedBeforeCards(html, '../');
  });

  test('index.html loads freeze card effect script', () => {
    const html = readRuntimeScriptOrder('../');
    const moduleTag = '<script src="game/card-effects/freeze.js"></script>';

    expect(html.includes(moduleTag)).toBe(true);
    expect(fs.existsSync(path.resolve(__dirname, '../game/card-effects/freeze.js'))).toBe(true);
  });

  test('index.html classic pending selection scripts avoid lexical alias collisions', () => {
    expectNoLexicalPendingSelectionGlobals('../');
  });

  test('index.html loads pending selection consumer scripts after selection-flow', () => {
    const html = readRuntimeScriptOrder('../');
    expectPendingSelectionConsumersLoadAfterSelectionFlow(html, '../');
  });

  test('index.html loads presentation helper before pending selection flow', () => {
    const html = readRuntimeScriptOrder('../');
    expectPresentationHelperLoadsBeforePendingSelection(html, '../');
  });

  test('classic pending selection export survives later card effect script loads', () => {
    expectPendingSelectionExportSurvivesConsumerScriptLoads('../');
  });

  test('classic presentation helper export survives later game script loads', () => {
    expectPresentationHelperClassicExportSurvivesLaterScriptLoads('../');
  });

  test('worker-public/index.html loads will_hunter_king card module before cards.js', () => {
    const html = readRuntimeScriptOrder('../worker-public');
    const moduleTag = '<script src="game/logic/cards/will_hunter_king.js"></script>';
    const cardsTag = '<script src="game/logic/cards.js"></script>';

    expect(html.includes(moduleTag)).toBe(true);
    expect(html.indexOf(moduleTag)).toBeGreaterThan(-1);
    expect(html.indexOf(cardsTag)).toBeGreaterThan(html.indexOf(moduleTag));
  });

  test('worker-public/index.html loads network turn handoff before trap/cpu/move executor scripts', () => {
    const html = readRuntimeScriptOrder('../worker-public');
    const handoffTag = '<script src="game/network-turn-handoff.js"></script>';
    const trapTag = '<script src="game/card-effects/trap.js"></script>';
    const cpuTag = '<script src="game/cpu-decision.js"></script>';
    const moveExecutorTag = '<script src="game/move-executor.js"></script>';

    expect(html.includes(handoffTag)).toBe(true);
    expect(html.indexOf(trapTag)).toBeGreaterThan(html.indexOf(handoffTag));
    expect(html.indexOf(cpuTag)).toBeGreaterThan(html.indexOf(handoffTag));
    expect(html.indexOf(moveExecutorTag)).toBeGreaterThan(html.indexOf(handoffTag));
    expect(fs.existsSync(path.resolve(__dirname, '../worker-public/game/network-turn-handoff.js'))).toBe(true);
  });

  test('worker-public/index.html loads card internal modules before cards.js', () => {
    const html = readRuntimeScriptOrder('../worker-public');
    expectCardInternalModulesLoadedBeforeCards(html, '../worker-public');
  });

  test('worker-public/index.html loads markers card module before cards.js', () => {
    const html = readRuntimeScriptOrder('../worker-public');
    const moduleTag = '<script src="game/logic/cards/markers.js"></script>';
    const cardsTag = '<script src="game/logic/cards.js"></script>';

    expect(html.includes(moduleTag)).toBe(true);
    expect(html.indexOf(cardsTag)).toBeGreaterThan(html.indexOf(moduleTag));
    expect(fs.existsSync(path.resolve(__dirname, '../worker-public/game/logic/cards/markers.js'))).toBe(true);
  });

  test('worker-public/index.html loads movement/teleport/clone/meteor/shrink logic modules before cards.js', () => {
    const html = readRuntimeScriptOrder('../worker-public');
    expectCardLogicModulesLoadedBeforeCards(html, '../worker-public');
  });

  test('worker-public/index.html loads freeze card effect script', () => {
    const html = readRuntimeScriptOrder('../worker-public');
    const moduleTag = '<script src="game/card-effects/freeze.js"></script>';

    expect(html.includes(moduleTag)).toBe(true);
    expect(fs.existsSync(path.resolve(__dirname, '../worker-public/game/card-effects/freeze.js'))).toBe(true);
  });

  test('worker-public classic pending selection scripts avoid lexical alias collisions', () => {
    expectNoLexicalPendingSelectionGlobals('../worker-public');
  });

  test('worker-public/index.html loads pending selection consumer scripts after selection-flow', () => {
    const html = readRuntimeScriptOrder('../worker-public');
    expectPendingSelectionConsumersLoadAfterSelectionFlow(html, '../worker-public');
  });

  test('worker-public/index.html loads presentation helper before pending selection flow', () => {
    const html = readRuntimeScriptOrder('../worker-public');
    expectPresentationHelperLoadsBeforePendingSelection(html, '../worker-public');
  });

  test('worker-public classic presentation helper export survives later game script loads', () => {
    expectPresentationHelperClassicExportSurvivesLaterScriptLoads('../worker-public');
  });

  test('worker-public classic pending selection export survives later card effect script loads', () => {
    expectPendingSelectionExportSurvivesConsumerScriptLoads('../worker-public');
  });

  test('index.html loads deck builder shared scripts before deck builder handler', () => {
    const html = readRuntimeScriptOrder('../');
    const deckSpecTag = '<script src="shared/deck-spec.js"></script>';
    const deckCodecTag = '<script src="shared/deck-codec.js"></script>';
    const controllerTag = '<script src="ui/deck-builder-controller.js"></script>';
    const handlerTag = '<script src="ui/handlers/deck-builder.js"></script>';

    expect(html.includes(deckSpecTag)).toBe(true);
    expect(html.includes(deckCodecTag)).toBe(true);
    expect(html.includes(controllerTag)).toBe(true);
    expect(html.includes(handlerTag)).toBe(true);
    expect(html.indexOf(deckSpecTag)).toBeGreaterThan(-1);
    expect(html.indexOf(deckCodecTag)).toBeGreaterThan(html.indexOf(deckSpecTag));
    expect(html.indexOf(controllerTag)).toBeGreaterThan(html.indexOf(deckCodecTag));
    expect(html.indexOf(handlerTag)).toBeGreaterThan(html.indexOf(controllerTag));
  });

  test('worker-public/index.html loads deck builder shared scripts before deck builder handler', () => {
    const html = readRuntimeScriptOrder('../worker-public');
    const deckSpecTag = '<script src="shared/deck-spec.js"></script>';
    const deckCodecTag = '<script src="shared/deck-codec.js"></script>';
    const controllerTag = '<script src="ui/deck-builder-controller.js"></script>';
    const handlerTag = '<script src="ui/handlers/deck-builder.js"></script>';

    expect(html.includes(deckSpecTag)).toBe(true);
    expect(html.includes(deckCodecTag)).toBe(true);
    expect(html.includes(controllerTag)).toBe(true);
    expect(html.includes(handlerTag)).toBe(true);
    expect(html.indexOf(deckSpecTag)).toBeGreaterThan(-1);
    expect(html.indexOf(deckCodecTag)).toBeGreaterThan(html.indexOf(deckSpecTag));
    expect(html.indexOf(controllerTag)).toBeGreaterThan(html.indexOf(deckCodecTag));
    expect(html.indexOf(handlerTag)).toBeGreaterThan(html.indexOf(controllerTag));
  });
});
