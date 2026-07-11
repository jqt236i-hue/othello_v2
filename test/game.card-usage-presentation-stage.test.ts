import * as fs from 'fs';
import * as path from 'path';
import * as CardUsagePresentationStage from '../game/cards/card-usage-presentation-stage';

describe('card usage presentation stage', () => {
  test('emits CARD_USED exactly once with the existing metadata shape', () => {
    const cardState: any = { presentationEvents: [] };
    const emitPresentationEvent = jest.fn();
    const emit = CardUsagePresentationStage.createCardUsedPresentationEmitter({
      cardState,
      handKey: 'black',
      chargeOwnerKey: 'black',
      cardId: 'destroy_01',
      cost: 8,
      usedCardDef: { name: '破壊の意志', type: 'DESTROY_ONE_STONE' },
      emitPresentationEvent
    });

    emit({ nullifiedBySacrificeWill: true });
    emit({ ignored: true });

    expect(emitPresentationEvent).toHaveBeenCalledTimes(1);
    expect(emitPresentationEvent).toHaveBeenCalledWith(cardState, {
      type: 'CARD_USED',
      player: 'black',
      cardId: 'destroy_01',
      meta: {
        owner: 'black',
        cost: 8,
        name: '破壊の意志',
        cardType: 'DESTROY_ONE_STONE',
        nullifiedBySacrificeWill: true
      }
    });
  });

  test('keeps BOARD_EXECUTOR card use before its hole events and appends generated cards afterward', () => {
    const cardState: any = {
      presentationEvents: [{ type: 'DESTROY', cause: 'BOARD_EXECUTOR' }],
      _presentationEventsPersist: [{ type: 'STATUS_APPLIED', meta: { removalKind: 'board_executor_hole' } }]
    };
    const emit = jest.fn(() => {
      cardState.presentationEvents.push({ type: 'CARD_USED' });
      cardState._presentationEventsPersist.push({ type: 'CARD_USED' });
    });
    const addGeneratedThrowChainCard = jest.fn();
    const addGeneratedChainWillCard = jest.fn();

    CardUsagePresentationStage.finalizeCardUsagePresentation({
      cardState,
      handKey: 'black',
      cardId: 'board_executor_01',
      cardType: 'BOARD_EXECUTOR',
      emitCardUsedPresentationOnce: emit,
      addGeneratedThrowChainCard,
      addGeneratedChainWillCard
    });

    expect(cardState.presentationEvents.map((event: any) => event.type)).toEqual(['CARD_USED', 'DESTROY']);
    expect(cardState._presentationEventsPersist.map((event: any) => event.type)).toEqual(['CARD_USED', 'STATUS_APPLIED']);
    expect(addGeneratedThrowChainCard).toHaveBeenCalledWith(cardState, 'black', 'board_executor_01', 'BOARD_EXECUTOR');
    expect(addGeneratedChainWillCard).toHaveBeenCalledWith(cardState, 'black', 'board_executor_01', 'BOARD_EXECUTOR');
  });

  test('keeps presentation helpers out of the effect resolver', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '..', 'game', 'cards', 'effect-resolver.ts'), 'utf8');
    expect(source).toContain('CardUsagePresentationStage.finalizeCardUsagePresentation({');
    expect(source).not.toContain('function moveLastCardUsedBeforeBoardExecutorHoleEvents');
  });
});
