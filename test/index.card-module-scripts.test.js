const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PENDING_SELECTION_CONSUMER_SCRIPTS = [
  'game/card-effects/destroy.js',
  'game/card-effects/strong-wind.js',
  'game/card-effects/teleport.js',
  'game/card-effects/tempt.js',
  'game/card-effects/time-bomb.js',
  'game/card-effects/trap.js',
  'game/card-effects/guard.js',
  'game/card-effects/hyperactive-inherit.js',
  'game/card-effects/extend-life.js',
  'game/card-effects/swap.js',
  'game/card-effects/position-swap.js',
  'game/card-effects/board-expansion.js',
  'game/card-effects/blockade.js',
  'game/card-effects/meteor.js',
  'game/card-effects/freeze.js',
  'game/card-effects/clone.js'
];

function expectPendingSelectionConsumersLoadAfterSelectionFlow(html, rootPath) {
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

function expectPresentationHelperLoadsBeforePendingSelection(html, rootPath) {
  const presentationTag = '<script src="game/logic/presentation.js"></script>';
  const selectionFlowTag = '<script src="game/card-effects/selection-flow.js"></script>';

  expect(html.includes(presentationTag)).toBe(true);
  expect(html.includes(selectionFlowTag)).toBe(true);
  expect(html.indexOf(selectionFlowTag)).toBeGreaterThan(html.indexOf(presentationTag));
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'game/logic/presentation.js'))).toBe(true);
}

function expectPendingSelectionExportSurvivesConsumerScriptLoads(rootPath) {
  const context = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    Promise
  });
  context.globalThis = context;

  runClassicScriptInContext(path.resolve(__dirname, rootPath, 'game/card-effects/selection-flow.js'), context);
  expect(context.PendingSelectionFlow).toBeTruthy();
  expect(typeof context.PendingSelectionFlow.executePendingSelection).toBe('function');

  for (const relativeScriptPath of PENDING_SELECTION_CONSUMER_SCRIPTS) {
    runClassicScriptInContext(path.resolve(__dirname, rootPath, relativeScriptPath), context);
    expect(context.PendingSelectionFlow).toBeTruthy();
    expect(typeof context.PendingSelectionFlow.executePendingSelection).toBe('function');
  }
}

function expectPresentationHelperClassicExportSurvivesLaterScriptLoads(rootPath) {
  const context = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    Promise
  });
  context.globalThis = context;

  runClassicScriptInContext(path.resolve(__dirname, rootPath, 'game/logic/presentation.js'), context);
  expect(context.PresentationHelper).toBeTruthy();
  expect(typeof context.PresentationHelper.emitPresentationEvent).toBe('function');

  runClassicScriptInContext(path.resolve(__dirname, rootPath, 'game/card-effects/selection-flow.js'), context);
  runClassicScriptInContext(path.resolve(__dirname, rootPath, 'game/card-effects/trap.js'), context);

  expect(context.PresentationHelper).toBeTruthy();
  expect(typeof context.PresentationHelper.emitPresentationEvent).toBe('function');
}

function expectCardInternalModulesLoadedBeforeCards(html, rootPath) {
  const selectorsTag = '<script src="game/logic/cards/selectors.js"></script>';
  const prechecksTag = '<script src="game/logic/cards-internal/card-usage-prechecks.js"></script>';
  const orchestratorTag = '<script src="game/logic/cards-internal/selector-orchestrator.js"></script>';
  const handManagerTag = '<script src="game/logic/cards-internal/hand-manager.js"></script>';
  const effectTimingTag = '<script src="game/logic/cards-internal/effect-timing.js"></script>';
  const pendingStateManagerTag = '<script src="game/logic/cards-internal/pending-state-manager.js"></script>';
  const chargeLedgerTag = '<script src="game/logic/cards-internal/charge-ledger.js"></script>';
  const cardsTag = '<script src="game/logic/cards.js"></script>';

  expect(html.includes(selectorsTag)).toBe(true);
  expect(html.includes(prechecksTag)).toBe(true);
  expect(html.includes(orchestratorTag)).toBe(true);
  expect(html.includes(handManagerTag)).toBe(true);
  expect(html.includes(effectTimingTag)).toBe(true);
  expect(html.includes(pendingStateManagerTag)).toBe(true);
  expect(html.includes(chargeLedgerTag)).toBe(true);
  expect(html.indexOf(prechecksTag)).toBeGreaterThan(html.indexOf(selectorsTag));
  expect(html.indexOf(orchestratorTag)).toBeGreaterThan(html.indexOf(prechecksTag));
  expect(html.indexOf(handManagerTag)).toBeGreaterThan(html.indexOf(orchestratorTag));
  expect(html.indexOf(effectTimingTag)).toBeGreaterThan(html.indexOf(handManagerTag));
  expect(html.indexOf(pendingStateManagerTag)).toBeGreaterThan(html.indexOf(effectTimingTag));
  expect(html.indexOf(chargeLedgerTag)).toBeGreaterThan(html.indexOf(pendingStateManagerTag));
  expect(html.indexOf(cardsTag)).toBeGreaterThan(html.indexOf(chargeLedgerTag));
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'game/logic/cards-internal/card-usage-prechecks.js'))).toBe(true);
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'game/logic/cards-internal/selector-orchestrator.js'))).toBe(true);
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'game/logic/cards-internal/hand-manager.js'))).toBe(true);
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'game/logic/cards-internal/effect-timing.js'))).toBe(true);
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'game/logic/cards-internal/pending-state-manager.js'))).toBe(true);
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'game/logic/cards-internal/charge-ledger.js'))).toBe(true);
}

function expectCardLogicModulesLoadedBeforeCards(html, rootPath) {
  const movementTag = '<script src="game/logic/cards/movement.js"></script>';
  const teleportTag = '<script src="game/logic/cards/teleport.js"></script>';
  const cloneTag = '<script src="game/logic/cards/clone.js"></script>';
  const meteorTag = '<script src="game/logic/cards/meteor.js"></script>';
  const cardsTag = '<script src="game/logic/cards.js"></script>';

  expect(html.includes(movementTag)).toBe(true);
  expect(html.includes(teleportTag)).toBe(true);
  expect(html.includes(cloneTag)).toBe(true);
  expect(html.includes(meteorTag)).toBe(true);
  expect(html.indexOf(cardsTag)).toBeGreaterThan(html.indexOf(movementTag));
  expect(html.indexOf(cardsTag)).toBeGreaterThan(html.indexOf(teleportTag));
  expect(html.indexOf(cardsTag)).toBeGreaterThan(html.indexOf(cloneTag));
  expect(html.indexOf(cardsTag)).toBeGreaterThan(html.indexOf(meteorTag));
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'game/logic/cards/movement.js'))).toBe(true);
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'game/logic/cards/teleport.js'))).toBe(true);
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'game/logic/cards/clone.js'))).toBe(true);
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'game/logic/cards/meteor.js'))).toBe(true);
}

function expectNoLexicalPendingSelectionGlobals(rootPath) {
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

function runClassicScriptInContext(filePath, context) {
  const source = fs.readFileSync(filePath, 'utf8');
  vm.runInContext(source, context, { filename: filePath });
}

describe('card module script includes', () => {
  test('index.html loads network turn handoff before trap/cpu/move executor scripts', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
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
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    const moduleTag = '<script src="game/logic/cards/will_hunter_king.js"></script>';
    const cardsTag = '<script src="game/logic/cards.js"></script>';

    expect(html.includes(moduleTag)).toBe(true);
    expect(html.indexOf(moduleTag)).toBeGreaterThan(-1);
    expect(html.indexOf(cardsTag)).toBeGreaterThan(html.indexOf(moduleTag));
  });

  test('index.html loads card internal modules before cards.js', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    expectCardInternalModulesLoadedBeforeCards(html, '../');
  });

  test('index.html loads markers card module before cards.js', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    const moduleTag = '<script src="game/logic/cards/markers.js"></script>';
    const cardsTag = '<script src="game/logic/cards.js"></script>';

    expect(html.includes(moduleTag)).toBe(true);
    expect(html.indexOf(cardsTag)).toBeGreaterThan(html.indexOf(moduleTag));
    expect(fs.existsSync(path.resolve(__dirname, '../game/logic/cards/markers.js'))).toBe(true);
  });

  test('index.html loads movement/teleport/clone/meteor logic modules before cards.js', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    expectCardLogicModulesLoadedBeforeCards(html, '../');
  });

  test('index.html loads freeze card effect script', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    const moduleTag = '<script src="game/card-effects/freeze.js"></script>';

    expect(html.includes(moduleTag)).toBe(true);
    expect(fs.existsSync(path.resolve(__dirname, '../game/card-effects/freeze.js'))).toBe(true);
  });

  test('index.html classic pending selection scripts avoid lexical alias collisions', () => {
    expectNoLexicalPendingSelectionGlobals('../');
  });

  test('index.html loads pending selection consumer scripts after selection-flow', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    expectPendingSelectionConsumersLoadAfterSelectionFlow(html, '../');
  });

  test('index.html loads presentation helper before pending selection flow', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    expectPresentationHelperLoadsBeforePendingSelection(html, '../');
  });

  test('classic pending selection export survives later card effect script loads', () => {
    expectPendingSelectionExportSurvivesConsumerScriptLoads('../');
  });

  test('classic presentation helper export survives later game script loads', () => {
    expectPresentationHelperClassicExportSurvivesLaterScriptLoads('../');
  });

  test('worker-public/index.html loads will_hunter_king card module before cards.js', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../worker-public/index.html'), 'utf8');
    const moduleTag = '<script src="game/logic/cards/will_hunter_king.js"></script>';
    const cardsTag = '<script src="game/logic/cards.js"></script>';

    expect(html.includes(moduleTag)).toBe(true);
    expect(html.indexOf(moduleTag)).toBeGreaterThan(-1);
    expect(html.indexOf(cardsTag)).toBeGreaterThan(html.indexOf(moduleTag));
  });

  test('worker-public/index.html loads network turn handoff before trap/cpu/move executor scripts', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../worker-public/index.html'), 'utf8');
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
    const html = fs.readFileSync(path.resolve(__dirname, '../worker-public/index.html'), 'utf8');
    expectCardInternalModulesLoadedBeforeCards(html, '../worker-public');
  });

  test('worker-public/index.html loads markers card module before cards.js', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../worker-public/index.html'), 'utf8');
    const moduleTag = '<script src="game/logic/cards/markers.js"></script>';
    const cardsTag = '<script src="game/logic/cards.js"></script>';

    expect(html.includes(moduleTag)).toBe(true);
    expect(html.indexOf(cardsTag)).toBeGreaterThan(html.indexOf(moduleTag));
    expect(fs.existsSync(path.resolve(__dirname, '../worker-public/game/logic/cards/markers.js'))).toBe(true);
  });

  test('worker-public/index.html loads movement/teleport/clone/meteor logic modules before cards.js', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../worker-public/index.html'), 'utf8');
    expectCardLogicModulesLoadedBeforeCards(html, '../worker-public');
  });

  test('worker-public/index.html loads freeze card effect script', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../worker-public/index.html'), 'utf8');
    const moduleTag = '<script src="game/card-effects/freeze.js"></script>';

    expect(html.includes(moduleTag)).toBe(true);
    expect(fs.existsSync(path.resolve(__dirname, '../worker-public/game/card-effects/freeze.js'))).toBe(true);
  });

  test('worker-public classic pending selection scripts avoid lexical alias collisions', () => {
    expectNoLexicalPendingSelectionGlobals('../worker-public');
  });

  test('worker-public/index.html loads pending selection consumer scripts after selection-flow', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../worker-public/index.html'), 'utf8');
    expectPendingSelectionConsumersLoadAfterSelectionFlow(html, '../worker-public');
  });

  test('worker-public/index.html loads presentation helper before pending selection flow', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../worker-public/index.html'), 'utf8');
    expectPresentationHelperLoadsBeforePendingSelection(html, '../worker-public');
  });

  test('worker-public classic presentation helper export survives later game script loads', () => {
    expectPresentationHelperClassicExportSurvivesLaterScriptLoads('../worker-public');
  });

  test('worker-public classic pending selection export survives later card effect script loads', () => {
    expectPendingSelectionExportSurvivesConsumerScriptLoads('../worker-public');
  });

  test('index.html loads deck builder shared scripts before deck builder handler', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
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
    const html = fs.readFileSync(path.resolve(__dirname, '../worker-public/index.html'), 'utf8');
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
