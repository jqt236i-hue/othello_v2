import * as fs from 'fs';
import * as path from 'path';

import * as PendingSelectionRegistry from '../game/logic/cards-internal/pending-selection-registry.js';
import * as PendingStateManager from '../game/logic/cards-internal/pending-state-manager.js';
import * as CardUsagePrechecks from '../game/logic/cards-internal/card-usage-prechecks.js';
import * as PendingTargetSelector from '../game/turn-handlers/pending-target-selector.js';
import * as CpuTurnHandler from '../game/cpu-turn-handler.js';
import * as PendingSelectionUiMetadata from '../cards/pending-selection-ui-metadata.js';

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
      expect(PendingSelectionUiMetadata.isCancellablePendingSelectionFallback(cardType)).toBe(!!entry.cancellable);
      expect(PendingSelectionUiMetadata.isHandOverlayPendingSelectionFallback(cardType)).toBe(entry.kind === 'hand_overlay');

      if (entry.needsTargetSelection) {
        const prompt = PendingSelectionUiMetadata.getPendingSelectionPrompt(
          { type: cardType, stage: 'selectTarget' },
          { posToNotation: (row: any, col: any) => `${Number(row) + 1}-${Number(col) + 1}` }
        );
        expect(typeof prompt).toBe('string');
        expect(prompt.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
