import * as PendingSelectionRegistry from '../game/logic/cards-internal/pending-selection-registry.js';
import * as PrePlacementSelection from '../game/turn/action-phase/pre-placement-selection.js';

const HAND_OVERLAY_ACTION_FIELD_BY_TYPE: Record<string, string> = {
  HEAVEN_BLESSING: 'heavenBlessingCardId',
  CONDEMN_WILL: 'condemnTargetIndex',
  OBSERVER_WILL: 'observerWillTargetIndex'
};

const ACTION_VALUE_BY_FIELD: Record<string, any> = {
  blockadeTarget: { row: 1, col: 1 },
  bombTarget: { row: 1, col: 1 },
  buoyancyTarget: { row: 1, col: 1 },
  captureTarget: { row: 1, col: 1 },
  causalReplayTarget: { row: 1, col: 1 },
  cloneTarget: { row: 1, col: 1 },
  condemnTargetIndex: 0,
  corrosionTarget: { row: 1, col: 1 },
  destroyTarget: { row: 1, col: 1 },
  expansionTarget: { row: 1, col: 1 },
  extendTarget: { row: 1, col: 1 },
  freezeTarget: { row: 1, col: 1 },
  gravityTarget: { row: 1, col: 1 },
  guardTarget: { row: 1, col: 1 },
  heavenBlessingCardId: 'gold_stone',
  livingWillTarget: { row: 1, col: 1 },
  meteorTarget: { row: 1, col: 1 },
  observerWillTargetIndex: 0,
  poisonTarget: { row: 1, col: 1 },
  positionSwapTarget: { row: 1, col: 1 },
  reverseWillTarget: { row: 1, col: 1 },
  seedTarget: { row: 1, col: 1 },
  shrinkTarget: { row: 1, col: 1 },
  strongWindTarget: { row: 1, col: 1 },
  superAttractionTarget: { row: 1, col: 1 },
  superBuoyancyTarget: { row: 1, col: 1 },
  superGravityTarget: { row: 1, col: 1 },
  swapTarget: { row: 1, col: 1 },
  teleportTarget: { row: 1, col: 1 },
  temptTarget: { row: 1, col: 1 },
  trapTarget: { row: 1, col: 1 }
};

function applied(extra: Record<string, any> = {}) {
  return { applied: true, ...extra };
}

function createCardLogicStub() {
  const fixed: Record<string, any> = {
    applyDestroyEffectDetailed: () => ({ destroyed: true, kind: 'destroyed' }),
    applyDestroyEffect: () => true,
    applySwapEffectDetailed: () => ({
      swapped: true,
      flipped: [],
      postFlipRevives: { regenRes: null, livingWillRes: null }
    }),
    applySwapEffect: () => true,
    applyTrapWill: () => applied(),
    applyHeavenBlessingChoice: () => applied(),
    applyCondemnWill: () => applied({ destroyedCardId: 'condemned_01' }),
    applyObserverWillChoice: () => applied({
      stolenCardId: 'stolen_01',
      stolenCardCopyId: 1,
      repaymentAmount: 0
    }),
    applyCloneWill: () => applied({ spawned: [], flipped: [] }),
    applyBoardExpansionWill: () => applied({ completed: true, added: [] }),
    applyBoardExpansionGod: () => applied({ completed: true, added: [] }),
    applyBoardShrinkWill: () => applied({ completed: true }),
    applyBoardShrinkGod: () => applied({ completed: true }),
    applyExtendLifeWill: () => applied({ multiplier: 2 }),
    applyExtendLifeGod: () => applied({ multiplier: 4 })
  };

  return new Proxy(fixed, {
    get(target, prop) {
      if (prop in target) return target[prop as string];
      if (String(prop).startsWith('apply')) return () => applied();
      return undefined;
    }
  });
}

function createActionForPendingType(cardType: string, entry: any) {
  const actionField = entry && entry.action && entry.action.field
    ? entry.action.field
    : HAND_OVERLAY_ACTION_FIELD_BY_TYPE[cardType];
  if (!actionField) {
    throw new Error(`missing test action field for ${cardType}`);
  }
  if (!(actionField in ACTION_VALUE_BY_FIELD)) {
    throw new Error(`missing test action value for ${cardType}.${actionField}`);
  }
  return {
    type: 'place',
    [actionField]: ACTION_VALUE_BY_FIELD[actionField]
  };
}

describe('pending selection turn outcome contract', () => {
  test('pre-placement selection handoff matches registry turnOutcome for every pending selection type', () => {
    const registry = PendingSelectionRegistry.PENDING_SELECTION_REGISTRY as Record<string, any>;
    const failures: any[] = [];
    const coveredTypes: string[] = [];

    for (const [cardType, entry] of Object.entries(registry)) {
      let handoffCalls = 0;
      const events: any[] = [];
      const action = createActionForPendingType(cardType, entry);

      const result = PrePlacementSelection.resolvePrePlacementSelectionAction({
        CardLogic: createCardLogicStub(),
        cardState: {},
        gameState: {},
        playerKey: 'black',
        action,
        events,
        prng: { random: () => 0 },
        pending: {
          type: cardType,
          stage: 'selectTarget',
          cardId: `${cardType.toLowerCase()}_test`
        },
        createDestroyOutcome: (value: any) => value,
        isDestroyOutcomeResolved: (value: any) => !!(
          value &&
          (value.applied === true || value.destroyed === true || value.kind)
        ),
        applyTrapEffectsAfterSelection: () => undefined,
        handOffTurnAfterSelection: () => {
          handoffCalls += 1;
        },
        emitDurationSelectionStatusTick: () => undefined,
        emitHandRemovePresentation: () => undefined,
        emitHandAddPresentation: () => undefined
      });

      coveredTypes.push(cardType);
      const shouldHandoff = entry.turnOutcome === 'end_turn';
      const didHandoff = handoffCalls > 0;

      if (didHandoff !== shouldHandoff) {
        failures.push({
          cardType,
          turnOutcome: entry.turnOutcome,
          handoffCalls,
          result
        });
      }
    }

    expect(coveredTypes.sort()).toEqual(Object.keys(registry).sort());
    expect(failures).toEqual([]);
  });
});
