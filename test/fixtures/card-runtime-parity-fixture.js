(function installCardRuntimeParityFixture(root, factory) {
  var api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root && typeof root === 'object') root.CardRuntimeParityFixture = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createCardRuntimeParityFixtureApi() {
  'use strict';

  var FIXTURE_VERSION = 'card-runtime-parity-v1';
  var FIXTURE_SEED = 123456789;

  function createInstrumentedPrng(seed) {
    var state = Number(seed) >>> 0;
    var ledger = [];
    var api = {
      random: function random() {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        var value = state / 4294967296;
        ledger.push({ op: 'random', state: state, value: Number(value.toFixed(12)) });
        return value;
      },
      shuffle: function shuffle(array) {
        ledger.push({ op: 'shuffle:start', length: array.length });
        for (var index = array.length - 1; index > 0; index -= 1) {
          var selected = Math.floor(api.random() * (index + 1));
          var current = array[index];
          array[index] = array[selected];
          array[selected] = current;
        }
        ledger.push({ op: 'shuffle:end', length: array.length });
        return array;
      },
      getState: function getState() {
        return { state: state, calls: ledger.filter(function (entry) { return entry.op === 'random'; }).length };
      },
      getLedger: function getLedger() {
        return ledger.map(function (entry) { return Object.assign({}, entry); });
      }
    };
    return api;
  }

  function createOpeningGameState(size) {
    var resolvedSize = Number.isInteger(size) ? size : 8;
    var board = Array.from({ length: resolvedSize }, function () { return Array(resolvedSize).fill(0); });
    var upper = Math.floor(resolvedSize / 2) - 1;
    var lower = upper + 1;
    board[upper][upper] = -1;
    board[upper][lower] = 1;
    board[lower][upper] = 1;
    board[lower][lower] = -1;
    return { board: board, currentPlayer: 1, consecutivePasses: 0, moveCount: 0 };
  }

  function projectRuntimeValue(value, rootPath) {
    var seen = [];
    var inventory = [];
    function walk(current, currentPath) {
      if (typeof current === 'undefined') {
        inventory.push({ path: currentPath, kind: 'undefined', projection: 'explicit-token' });
        return { $runtime: 'undefined' };
      }
      if (typeof current === 'function') {
        inventory.push({ path: currentPath, kind: 'function', projection: 'name-only' });
        return { $runtime: 'function', name: current.name || null };
      }
      if (typeof current === 'number' && !Number.isFinite(current)) {
        inventory.push({ path: currentPath, kind: 'non-finite-number', projection: String(current) });
        return { $runtime: 'number', value: String(current) };
      }
      if (!current || typeof current !== 'object') return current;
      var seenIndex = seen.indexOf(current);
      if (seenIndex >= 0) {
        inventory.push({ path: currentPath, kind: 'shared-or-circular-reference', projection: seenIndex });
        return { $runtime: 'reference', index: seenIndex };
      }
      seen.push(current);
      if (Array.isArray(current)) {
        return current.map(function (entry, index) { return walk(entry, currentPath + '[' + index + ']'); });
      }
      var projected = {};
      Object.keys(current).sort().forEach(function (key) {
        projected[key] = walk(current[key], currentPath + '.' + key);
      });
      Object.getOwnPropertySymbols(current).forEach(function (key) {
        inventory.push({ path: currentPath, kind: 'symbol-key', projection: String(key) });
      });
      return projected;
    }
    return { value: walk(value, rootPath || '$'), inventory: inventory };
  }

  function normalizeMarker(marker) {
    return projectRuntimeValue(marker, '$marker').value;
  }

  function normalizeEvent(event) {
    return projectRuntimeValue(event, '$event').value;
  }

  function diffProjectedState(before, after, rootPath) {
    var changes = [];
    function walk(left, right, currentPath) {
      if (JSON.stringify(left) === JSON.stringify(right)) return;
      var leftObject = !!left && typeof left === 'object';
      var rightObject = !!right && typeof right === 'object';
      if (!leftObject || !rightObject || Array.isArray(left) !== Array.isArray(right)) {
        changes.push({ path: currentPath, before: left, after: right });
        return;
      }
      var keys = {};
      Object.keys(left).forEach(function (key) { keys[key] = true; });
      Object.keys(right).forEach(function (key) { keys[key] = true; });
      Object.keys(keys).sort().forEach(function (key) {
        var childPath = Array.isArray(left) && /^\d+$/.test(key)
          ? currentPath + '[' + key + ']'
          : currentPath + '.' + key;
        walk(
          Object.prototype.hasOwnProperty.call(left, key) ? left[key] : { $runtime: 'missing' },
          Object.prototype.hasOwnProperty.call(right, key) ? right[key] : { $runtime: 'missing' },
          childPath
        );
      });
    }
    walk(before, after, rootPath || '$');
    return changes;
  }

  function runScenarioCoverage(cardLogic) {
    var turnPrng = createInstrumentedPrng(FIXTURE_SEED + 1);
    var turnInitialized = cardLogic.initGame(turnPrng, {
      initialDeckCardIdsByPlayer: { black: ['destroy_01'], white: ['destroy_01'] },
      initialChargeByPlayer: { black: 20, white: 20 }
    });
    var turnGameState = createOpeningGameState();
    var turnStartResult = cardLogic.onTurnStart(turnInitialized.cardState, 'black', turnGameState, turnPrng);

    turnGameState.board[2][2] = 1;
    turnInitialized.cardState.markers.push({
      id: 'fixture-guard', markerId: 'fixture-guard', kind: 'specialStone',
      row: 2, col: 2, owner: 'black', createdSeq: 1,
      data: { type: 'GUARD', remainingOwnerTurns: 3 }
    });
    var protectionContext = cardLogic.getCardContext(turnInitialized.cardState);

    var expandedPrng = createInstrumentedPrng(FIXTURE_SEED + 2);
    var expandedInitialized = cardLogic.initGame(expandedPrng, {
      boardConfig: { rows: 10, cols: 10 },
      initialDeckCardIdsByPlayer: { black: ['destroy_01'], white: ['destroy_01'] },
      initialChargeByPlayer: { black: 20, white: 20 }
    });
    var expandedGameState = createOpeningGameState(10);
    expandedGameState.board[0][9] = -1;
    var expandedDestroyTargets = cardLogic.getDestroyTargets(
      expandedInitialized.cardState, expandedGameState, 'black'
    );
    return projectRuntimeValue({
      turnStart: {
        result: turnStartResult,
        turnIndex: turnInitialized.cardState.turnIndex,
        hand: turnInitialized.cardState.hands.black,
        eventJournal: turnInitialized.cardState.presentationEvents,
        prng: turnPrng.getState()
      },
      protection: {
        context: {
          protectedStones: protectionContext.protectedStones || [],
          permaProtectedStones: protectionContext.permaProtectedStones || [],
          inviolableStones: protectionContext.inviolableStones || [],
          bombs: protectionContext.bombs || [],
          blockedCells: protectionContext.blockedCells || []
        },
        marker: turnInitialized.cardState.markers[turnInitialized.cardState.markers.length - 1]
      },
      expandedTopology: {
        boardConfig: expandedInitialized.cardState.boardConfig,
        targetAtTopRight: expandedDestroyTargets.some(function (target) {
          return target && target.row === 0 && target.col === 9;
        }),
        targetCount: expandedDestroyTargets.length,
        prng: expandedPrng.getState()
      }
    }, '$scenarioCoverage');
  }

  function run(cardLogic) {
    if (!cardLogic || typeof cardLogic.initGame !== 'function') {
      throw new Error('CardRuntimeParityFixture requires CardLogic.initGame');
    }
    var prng = createInstrumentedPrng(FIXTURE_SEED);
    var options = {
      initialDeckCardIdsByPlayer: {
        black: ['destroy_01', 'chaos_summon_01', 'theory_incarnation_01'],
        white: ['destroy_01', 'chaos_summon_01', 'theory_incarnation_01']
      },
      initialChargeByPlayer: { black: 30, white: 30 }
    };
    var initialized = cardLogic.initGame(prng, options);
    var cardState = initialized.cardState;
    var gameState = createOpeningGameState();

    cardState.hands.black = ['destroy_01'];
    cardState.charge.black = 30;
    var pendingApplied = cardLogic.applyCardUsage(cardState, gameState, 'black', 'destroy_01');
    var pendingBeforeCancel = JSON.parse(JSON.stringify(cardState.pendingEffectByPlayer.black));
    var canceled = cardLogic.cancelPendingSelection(cardState, 'black');

    var heavenOffers = cardLogic.buildHeavenBlessingOffers('destroy_01', prng, 'parity-fixture');
    var completeCardState = projectRuntimeValue(cardState, '$cardState');
    var completeGameState = projectRuntimeValue(gameState, '$gameState');
    var scenarioCoverage = runScenarioCoverage(cardLogic);

    return {
      fixtureVersion: FIXTURE_VERSION,
      seed: FIXTURE_SEED,
      results: {
        pendingApplied: pendingApplied,
        canceled: canceled,
        heavenOffers: heavenOffers
      },
      pendingBeforeCancel: pendingBeforeCancel,
      canonical: {
        boardConfig: cardState.boardConfig,
        decks: cardState.decks,
        hands: cardState.hands,
        discard: cardState.discard,
        charge: cardState.charge,
        cardUseCountByPlayer: cardState.cardUseCountByPlayer,
        hasUsedCardThisTurnByPlayer: cardState.hasUsedCardThisTurnByPlayer,
        pendingEffectByPlayer: cardState.pendingEffectByPlayer,
        markers: (cardState.markers || []).map(normalizeMarker),
        presentationEvents: (cardState.presentationEvents || []).map(normalizeEvent),
        board: gameState.board,
        completeState: {
          cardState: completeCardState.value,
          gameState: completeGameState.value
        },
        runtimeProjectionInventory: completeCardState.inventory.concat(completeGameState.inventory)
      },
      scenarioCoverage: {
        value: scenarioCoverage.value,
        runtimeProjectionInventory: scenarioCoverage.inventory
      },
      prng: {
        state: prng.getState(),
        ledger: prng.getLedger()
      }
    };
  }

  function runOptionalPresentationProbe(cardLogic) {
    var prng = createInstrumentedPrng(FIXTURE_SEED);
    var initialized = cardLogic.initGame(prng, {
      initialDeckCardIdsByPlayer: {
        black: ['chaos_summon_01'],
        white: ['chaos_summon_01']
      },
      initialChargeByPlayer: { black: 30, white: 30 }
    });
    var cardState = initialized.cardState;
    var gameState = createOpeningGameState();
    cardState.hands.black = ['chaos_summon_01'];
    cardState.charge.black = 30;
    var applied = cardLogic.applyCardUsage(
      cardState,
      gameState,
      'black',
      'chaos_summon_01',
      undefined,
      { prng: prng }
    );
    return {
      applied: applied,
      eventTypes: (cardState.presentationEvents || []).map(function (event) { return event && event.type; }),
      marker: normalizeMarker((cardState.markers || [])[0]),
      board: gameState.board,
      prng: prng.getState()
    };
  }

  function runSmallSelfplayProbe(selfplayRunner) {
    if (!selfplayRunner || typeof selfplayRunner.runSingleGame !== 'function') {
      throw new Error('CardRuntimeParityFixture requires selfplayRunner.runSingleGame');
    }
    var result = selfplayRunner.runSingleGame(0, 31, {
      maxPlies: 2,
      allowCardUsage: false,
      enableTacticalLookahead: false
    });
    return projectRuntimeValue(result, '$smallSelfplay').value;
  }

  function runCpuDecisionProbe(cpuDecision, cardLogic) {
    if (!cpuDecision || typeof cpuDecision.selectCardToUse !== 'function'
      || typeof cpuDecision.setCpuDecisionRuntime !== 'function') {
      throw new Error('CardRuntimeParityFixture requires the production CPU decision API');
    }
    var runtimeRoot = typeof globalThis !== 'undefined' ? globalThis : {};
    var keys = ['cardState', 'gameState', 'CardLogic', 'AISystem', 'BLACK', 'WHITE'];
    var previous = {};
    keys.forEach(function (key) {
      previous[key] = Object.prototype.hasOwnProperty.call(runtimeRoot, key)
        ? { present: true, value: runtimeRoot[key] }
        : { present: false };
    });
    var setupPrng = createInstrumentedPrng(FIXTURE_SEED + 3);
    var decisionPrng = createInstrumentedPrng(FIXTURE_SEED + 4);
    var cardState = cardLogic.createCardState(setupPrng, {
      initialDeckCardIdsByPlayer: { black: ['destroy_01'], white: ['destroy_01'] },
      initialChargeByPlayer: { black: 30, white: 30 }
    });
    cardState.hands.black = ['destroy_01'];
    var gameState = createOpeningGameState();
    var before = projectRuntimeValue({ cardState: cardState, gameState: gameState }, '$cpuState').value;
    var setupPrngBefore = setupPrng.getState();
    try {
      runtimeRoot.cardState = cardState;
      runtimeRoot.gameState = gameState;
      runtimeRoot.CardLogic = cardLogic;
      runtimeRoot.AISystem = null;
      runtimeRoot.BLACK = 1;
      runtimeRoot.WHITE = -1;
      cpuDecision.setCpuDecisionRuntime({
        readModule: function readModule(name) { return runtimeRoot[name]; }
      });
      cpuDecision.setCpuRng(decisionPrng);
      var selected = cpuDecision.selectCardToUse('black');
      var after = projectRuntimeValue({ cardState: cardState, gameState: gameState }, '$cpuState').value;
      return projectRuntimeValue({
        selected: selected,
        preState: before,
        postState: after,
        stateDelta: diffProjectedState(before, after, '$cpuState'),
        prng: {
          setupBefore: setupPrngBefore,
          setupAfter: setupPrng.getState(),
          decision: decisionPrng.getState(),
          decisionLedger: decisionPrng.getLedger()
        }
      }, '$cpuDecision').value;
    } finally {
      cpuDecision.setCpuDecisionRuntime(null);
      keys.forEach(function (key) {
        if (previous[key].present) runtimeRoot[key] = previous[key].value;
        else delete runtimeRoot[key];
      });
    }
  }

  return Object.freeze({
    FIXTURE_VERSION: FIXTURE_VERSION,
    FIXTURE_SEED: FIXTURE_SEED,
    createInstrumentedPrng: createInstrumentedPrng,
    projectRuntimeValue: projectRuntimeValue,
    run: run,
    runScenarioCoverage: runScenarioCoverage,
    runOptionalPresentationProbe: runOptionalPresentationProbe,
    runSmallSelfplayProbe: runSmallSelfplayProbe,
    runCpuDecisionProbe: runCpuDecisionProbe
  });
});
