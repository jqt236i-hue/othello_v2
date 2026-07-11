import * as fs from 'fs';
import * as path from 'path';
import * as CardUsageSacrificeStage from '../game/cards/card-usage-sacrifice-stage';

describe('card usage sacrifice stage', () => {
  test('preserves nullification mutation and event ordering inputs', () => {
    const cardState: any = {
      presentationEvents: [{ type: 'BEFORE' }],
      _presentationEventsPersist: [{ type: 'BEFORE_PERSIST' }],
      pendingEffectByPlayer: { white: { type: 'DESTROY_ONE_STONE' } }
    };
    const sacrifice = { row: 2, col: 3, owner: 'black' };
    const applySacrificeNullification = jest.fn(() => ({ applied: true }));
    const writeCardPendingEffect = jest.fn();
    const emitCardUsedAtEventIndexes = jest.fn();
    const emitPresentationEvent = jest.fn();
    const result = CardUsageSacrificeStage.applySacrificeCardUsageNullification({
      cardState,
      gameState: { board: [] },
      chargeOwnerKey: 'white',
      cardId: 'destroy_01',
      cardType: 'DESTROY_ONE_STONE',
      CardSacrificeWillModule: {
        shouldSacrificeNullifyCard: jest.fn(() => true),
        findTriggeringSacrificeMarker: jest.fn(() => sacrifice),
        applySacrificeNullification,
        SACRIFICE_SEAL_BURN_EFFECT: 'sacrifice_seal_burn',
        SACRIFICE_TRIGGER_TEXT: 'その一手は、ここで断つ。'
      },
      SpecialCardRegistry: { isSpecial: jest.fn() },
      BoardOpsModule: {},
      MARKER_KINDS: { SPECIAL_STONE: 'specialStone' },
      getCellValueForCard: jest.fn(),
      getSpecialMarkers: jest.fn(),
      EMPTY: 0,
      writeCardPendingEffect,
      emitPresentationEvent,
      emitCardUsedAtEventIndexes
    });

    expect(result).toMatchObject({ nullified: true, sacrifice, result: { applied: true } });
    expect(applySacrificeNullification).toHaveBeenCalledWith(
      cardState,
      { board: [] },
      { cardId: 'destroy_01', cardType: 'DESTROY_ONE_STONE', cardUserKey: 'white', sacrifice },
      expect.objectContaining({ EMPTY: 0 })
    );
    expect(writeCardPendingEffect).toHaveBeenCalledWith(cardState, 'white', null, { clearSelectionAction: true });
    expect(emitCardUsedAtEventIndexes).toHaveBeenCalledWith(expect.objectContaining({
      nullifiedBySacrificeWill: true,
      sacrificeWill: { row: 2, col: 3, owner: 'black', special: 'SACRIFICE' }
    }), 1, 1);
    expect(emitPresentationEvent).toHaveBeenCalledWith(cardState, expect.objectContaining({
      type: 'SPECIAL_STONE_BUBBLE',
      scenario: 'card_nullified',
      row: 2,
      col: 3,
      cause: 'SACRIFICE_WILL'
    }));
  });

  test('does not modify state when sacrifice nullification is not applicable', () => {
    const cardState: any = { pendingEffectByPlayer: { white: { type: 'DESTROY_ONE_STONE' } } };
    const result = CardUsageSacrificeStage.applySacrificeCardUsageNullification({
      cardState,
      gameState: {},
      chargeOwnerKey: 'white',
      cardId: 'observer_will_01',
      cardType: 'OBSERVER_WILL',
      CardSacrificeWillModule: { shouldSacrificeNullifyCard: () => false },
      SpecialCardRegistry: {},
      BoardOpsModule: {},
      MARKER_KINDS: {},
      getCellValueForCard: null,
      getSpecialMarkers: null,
      EMPTY: 0,
      writeCardPendingEffect: jest.fn(),
      emitPresentationEvent: jest.fn(),
      emitCardUsedAtEventIndexes: jest.fn()
    });
    expect(result).toEqual({ nullified: false });
    expect(cardState.pendingEffectByPlayer.white).toEqual({ type: 'DESTROY_ONE_STONE' });
  });

  test('keeps sacrifice resolution out of the effect resolver', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '..', 'game', 'cards', 'effect-resolver.ts'), 'utf8');
    expect(source).toContain('CardUsageSacrificeStage.applySacrificeCardUsageNullification({');
    expect(source).not.toContain('CardSacrificeWillModule.findTriggeringSacrificeMarker(');
  });
});
