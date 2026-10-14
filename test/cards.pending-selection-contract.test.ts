import * as fs from 'fs';
import * as path from 'path';

import * as PendingSelectionRegistry from '../game/logic/cards-internal/pending-selection-registry.js';
import * as PendingStateManager from '../game/logic/cards-internal/pending-state-manager.js';
import * as CardUsagePrechecks from '../game/logic/cards-internal/card-usage-prechecks.js';
import * as CardUsageValidationStage from '../game/cards/card-usage-validation-stage';
import * as PendingTargetSelector from '../game/turn-handlers/pending-target-selector.js';
import * as CpuTurnHandler from '../game/cpu-turn-handler.js';
import * as CardInteractionDetailActions from '../cards/card-interaction-detail-actions.js';

const repoRoot = path.resolve(__dirname, '..');

function readJson(relativePath: string): any {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

function readCardTypeUnion(): string[] {
  const source = fs.readFileSync(path.join(repoRoot, 'src/types/card.ts'), 'utf8');
  const match = source.match(/export type CardType\s*=\s*([\s\S]*?);/);
  if (!match) return [];
  return Array.from(match[1].matchAll(/'([^']+)'/g)).map((entry) => entry[1]);
}

describe('pending selection card contracts', () => {
  test('catalog card types are represented by src/types/card.ts CardType', () => {
    const catalog = readJson('cards/catalog.json');
    const catalogTypes = Array.from(new Set((catalog.cards || []).map((card: any) => card && card.type).filter(Boolean))).sort();
    const unionTypes = new Set(readCardTypeUnion());

    const missingInTypes = catalogTypes.filter((type) => !unionTypes.has(type));
    const extraInTypes = Array.from(unionTypes).filter((type) => !catalogTypes.includes(type)).sort();

    expect(missingInTypes).toEqual([]);
    expect(extraInTypes).toEqual([]);
  });

  test('pending selection registry is the state-manager contract source', () => {
    const registry = PendingSelectionRegistry.PENDING_SELECTION_REGISTRY;
    const stateContracts = PendingStateManager.PENDING_SELECTION_CONTRACT_DEFINITIONS;

    expect(Object.keys(stateContracts).sort()).toEqual(Object.keys(registry).sort());
    for (const [cardType, entry] of Object.entries(registry) as any[]) {
      const contract = PendingStateManager.resolvePendingSelectionContract(cardType);
      expect(contract).toEqual(expect.objectContaining({
        kind: entry.kind,
        turnOutcome: entry.turnOutcome,
        deferNetworkPublish: entry.deferNetworkPublish,
        waitForPlaybackIdle: entry.waitForPlaybackIdle,
        needsTargetSelection: entry.needsTargetSelection
      }));
      expect(PendingStateManager.requiresTargetSelection(cardType)).toBe(entry.needsTargetSelection);
      expect(PendingStateManager.resolvePendingSelectionDispatchKey(cardType)).toBe(entry.dispatchKey);
    }
  });

  test('movement selection cards continue to normal placement', () => {
    const movementSelectionCardTypes = [
      'STRONG_WIND_WILL',
      'BUOYANCY_WILL',
      'SUPER_BUOYANCY_WILL',
      'GRAVITY_WILL',
      'SUPER_GRAVITY_WILL',
      'SUPER_ATTRACTION_WILL'
    ];

    for (const cardType of movementSelectionCardTypes) {
      const entry = PendingSelectionRegistry.PENDING_SELECTION_REGISTRY[cardType];
      const contract = PendingStateManager.resolvePendingSelectionContract(cardType);

      expect(entry.kind).toBe(cardType === 'SUPER_ATTRACTION_WILL' ? 'multi_stage' : 'continue_turn');
      expect(entry.turnOutcome).toBe('continue_turn');
      expect(contract && contract.kind).toBe(entry.kind);
      expect(contract && contract.turnOutcome).toBe('continue_turn');
      expect(PendingStateManager.isSelectionOnlyEndTurnPendingType(cardType)).toBe(false);
    }
  });

  // End-turn target-selection cards enter NetworkTurnHandoff after local playback events.
  // If this set grows, add a CPU handoff regression case before updating the expected list.
  test('end-turn pending selections with playback wait are explicitly covered by CPU handoff tests', () => {
    const registry = PendingSelectionRegistry.PENDING_SELECTION_REGISTRY;
    const endTurnWaitTypes = Object.keys(registry)
      .filter((type) => {
        const entry = registry[type];
        return entry
          && entry.turnOutcome === 'end_turn'
          && entry.waitForPlaybackIdle === true
          && entry.needsTargetSelection === true;
      })
      .sort();

    expect(endTurnWaitTypes).toEqual([
      'SWAP_WITH_ENEMY',
      'TRAP_WILL'
    ]);
  });

  test('registry target methods are sufficient for card-use prechecks', () => {
    const registry = PendingSelectionRegistry.PENDING_SELECTION_REGISTRY;

    for (const [cardType, entry] of Object.entries(registry) as any[]) {
      if (!entry.target || !entry.target.method) continue;
      const minimumCount = Number.isFinite(Number(entry.target.minimumCount))
        ? Math.max(1, Math.trunc(Number(entry.target.minimumCount)))
        : 1;
      const enoughTargets = Array.from({ length: minimumCount }, (_, index) => ({ row: index, col: index + 1 }));
      const insufficientTargets = enoughTargets.slice(0, minimumCount - 1);

      const context: any = {
        cardType,
        cardState: {},
        gameState: {},
        playerKey: 'black'
      };
      context[entry.target.method] = () => enoughTargets;
      expect(CardUsagePrechecks.validateCardUsagePreconditions(context).ok).toBe(true);

      context[entry.target.method] = () => insufficientTargets;
      expect(CardUsagePrechecks.validateCardUsagePreconditions(context).ok).toBe(false);
    }
  });

  test('card usage validation calls every registry target resolver with its registry args and minimum', () => {
    const registry = PendingSelectionRegistry.PENDING_SELECTION_REGISTRY as any;
    const targetEntries = Object.entries(registry).filter(([, entry]: any) => entry && entry.target && entry.target.method);
    const cardState: any = { hands: { black: ['card-under-test'] }, charge: { black: 99 }, turnIndex: 30 };
    const gameState: any = { board: [], turnNumber: 30 };
    const pending = { type: 'pending-marker' };
    expect(new Set(targetEntries.map(([, entry]: any) => entry.target.method)).size).toBe(31);

    for (const [cardType, entry] of targetEntries as any[]) {
      const minimumCount = Number.isFinite(Number(entry.target.minimumCount))
        ? Math.max(1, Math.trunc(Number(entry.target.minimumCount)))
        : 1;
      const expectedArgs = entry.target.argsKey === 'board'
        ? [cardState, gameState]
        : entry.target.argsKey === 'player_pending'
          ? [cardState, gameState, 'black', null]
          : [cardState, gameState, 'black'];
      const enoughTargets = Array.from({ length: minimumCount }, (_, index) => ({ row: index, col: index + 1 }));
      const run = (targets: any[]) => {
        const resolver = jest.fn(() => targets);
        const result = CardUsageValidationStage.prepareCardUsageValidation({
          cardState,
          playerKey: 'black',
          cardId: 'card-under-test',
          deps: { gameState, [entry.target.method]: resolver },
          getCardCost: () => 0,
          getCardType: () => cardType,
          CardHandManagerModule: { canConsumeCardUseForTurn: () => true, resolveHandIndexForCard: () => 0 },
          CardMarkersModule: null,
          CardUsagePrechecksModule: CardUsagePrechecks,
          PendingSelectionRegistryModule: undefined,
          RIBO_WILL_UNLOCK_TURN_INDEX: 0,
          TIME_STOP_GOD_SELF_DESTROY_COUNT: 3
        } as any);
        return { resolver, result };
      };

      const accepted = run(enoughTargets);
      expect({ cardType, ok: accepted.result.ok }).toEqual({ cardType, ok: true });
      expect(accepted.resolver).toHaveBeenCalledTimes(1);
      expect(accepted.resolver).toHaveBeenCalledWith(...expectedArgs);

      const rejected = run(enoughTargets.slice(0, minimumCount - 1));
      expect({ cardType, ok: rejected.result.ok }).toEqual({ cardType, ok: false });
    }
    expect(pending.type).toBe('pending-marker');
  });

  test('usable-card analysis consults every registry target resolver from the selector module', () => {
    const registry = PendingSelectionRegistry.PENDING_SELECTION_REGISTRY as any;
    const targetEntries = Object.entries(registry).filter(([, entry]: any) => entry && entry.target && entry.target.method);
    const results: Array<{ cardType: string; withTargets: boolean; withoutTargets: boolean }> = [];
    for (const [cardType, entry] of targetEntries as any[]) {
      const minimumCount = Number.isFinite(Number(entry.target.minimumCount))
        ? Math.max(1, Math.trunc(Number(entry.target.minimumCount)))
        : 1;
      const enoughTargets = Array.from({ length: minimumCount }, (_, index) => ({ row: index, col: index + 1 }));
      const usableWith = (targets: any[]) => {
        jest.resetModules();
        const HandManager = require('../game/logic/cards-internal/hand-manager.js');
        const selectorsModule: any = { [entry.target.method]: jest.fn(() => targets) };
        const context = {
          constants: { MAX_HAND_SIZE: 5, RIBO_WILL_UNLOCK_TURN_INDEX: 0 },
          modules: {
            CardDefsModule: {
              getCardDef: (cardId: string) => (cardId === 'card-under-test' ? { id: cardId, type: cardType, cost: 0, name: cardId } : null),
              getCardType: (cardId: string) => (cardId === 'card-under-test' ? cardType : null)
            },
            CardCostsModule: { getCardCost: () => 0 },
            CardSelectorsModule: selectorsModule
          },
          // Position swap also requires two occupied cells; that gate is independent of the selector.
          helpers: { getOccupiedBoardShapeCellsForCard: () => [{ row: 0, col: 0 }, { row: 0, col: 1 }] }
        };
        const cardState = {
          hands: { black: ['card-under-test'], white: [] },
          charge: { black: 0, white: 0 },
          hasUsedCardThisTurnByPlayer: { black: false, white: false },
          turnIndex: 30
        };
        const usable = HandManager.getUsableCardIds(cardState, { board: [], turnNumber: 30 }, 'black', context);
        return { usable: usable.includes('card-under-test'), calls: selectorsModule[entry.target.method].mock.calls.length };
      };
      const accepted = usableWith(enoughTargets);
      const rejected = usableWith(enoughTargets.slice(0, minimumCount - 1));
      expect({ cardType, consulted: accepted.calls > 0 }).toEqual({ cardType, consulted: true });
      results.push({ cardType, withTargets: accepted.usable, withoutTargets: rejected.usable });
    }
    expect(results.filter((row) => !row.withTargets || row.withoutTargets)).toEqual([]);
  });

  test('registry action fields drive pending target action construction', () => {
    const registry = PendingSelectionRegistry.PENDING_SELECTION_REGISTRY;

    for (const [cardType, entry] of Object.entries(registry) as any[]) {
      if (!entry.action) continue;
      const selectors: any = {
        [entry.action.policyMethod]: () => ({ row: 4, col: 5 })
      };
      const action = PendingTargetSelector.buildPendingSelectionAction({
        pendingType: cardType,
        playerKey: 'black',
        selectors
      } as any);

      expect(action).toEqual({
        type: 'place',
        [entry.action.field]: { row: 4, col: 5 }
      });
    }
  });

  test('registry CPU handlers and UI dispatch keys are wired to runtime surfaces', () => {
    const registry = PendingSelectionRegistry.PENDING_SELECTION_REGISTRY;
    const cpuDecisionSource = fs.readFileSync(path.join(repoRoot, 'game/cpu-decision.ts'), 'utf8');
    const uiBootstrapSource = fs.readFileSync(path.join(repoRoot, 'ui/bootstrap.ts'), 'utf8');
    const turnManagerSource = fs.readFileSync(path.join(repoRoot, 'game/turn-manager.ts'), 'utf8');
    const byDispatchKey = PendingSelectionRegistry.getPendingSelectionCpuHandlerNamesByDispatchKey();

    for (const [cardType, entry] of Object.entries(registry) as any[]) {
      if (entry.cpuHandlerNames) {
        expect(byDispatchKey[entry.dispatchKey]).toEqual(entry.cpuHandlerNames);
        for (const handlerName of entry.cpuHandlerNames) {
          expect(cpuDecisionSource).toContain(handlerName);
        }
      }
      if (entry.needsTargetSelection && entry.kind !== 'hand_overlay') {
        expect(uiBootstrapSource).toContain(`${entry.dispatchKey}: '`);
      }
      expect(PendingSelectionRegistry.getPendingSelectionEntry(cardType)).toEqual(entry);
    }
    expect(turnManagerSource).toContain('dispatchPendingSelection');
  });

  test('CPU pending dispatch is derived from registry dispatch keys', () => {
    const registry = PendingSelectionRegistry.PENDING_SELECTION_REGISTRY;
    const handlers = CpuTurnHandler.getPendingTypeHandlers('white' as any);

    for (const [cardType, entry] of Object.entries(registry) as any[]) {
      if (!entry.cpuHandlerNames) continue;
      expect(typeof handlers[cardType]).toBe('function');
    }
  });

  test('pending selection UI metadata stays aligned with registry contracts', () => {
    const registry = PendingSelectionRegistry.PENDING_SELECTION_REGISTRY;

    for (const [cardType, entry] of Object.entries(registry) as any[]) {
      expect(CardInteractionDetailActions.isCancellablePendingSelectionFallback(cardType)).toBe(!!entry.cancellable);
      expect(CardInteractionDetailActions.isHandOverlayPendingSelectionFallback(cardType)).toBe(entry.kind === 'hand_overlay');

      if (entry.needsTargetSelection) {
        const prompt = CardInteractionDetailActions.getPendingSelectionPrompt(
          { type: cardType, stage: 'selectTarget' },
          { posToNotation: (row: any, col: any) => `${Number(row) + 1}-${Number(col) + 1}` }
        );
        expect(typeof prompt).toBe('string');
        expect(prompt.trim().length).toBeGreaterThan(0);
      }
    }
  });

  test('network target-selection handlers derive target payload fields from the registry bridge', () => {
    const cardEffectsDir = path.join(repoRoot, 'game/card-effects');
    const handlerFiles = fs.readdirSync(cardEffectsDir)
      .filter((name) => name.endsWith('.ts') && !name.startsWith('selection-flow'))
      .map((name) => `game/card-effects/${name}`);
    const registryTargetFields = Array.from(new Set(
      Object.values(PendingSelectionRegistry.PENDING_SELECTION_REGISTRY as any)
        .map((entry: any) => entry && entry.action && entry.action.field)
        .filter(Boolean)
    ));

    for (const relativePath of handlerFiles) {
      const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
      for (const field of registryTargetFields) {
        expect(source).not.toContain(`actionPayload: { ${field}:`);
      }
      if (source.includes('actionPayload:')) {
        expect(source).toContain('buildPendingSelectionTargetPayload');
      }
    }
  });
});
