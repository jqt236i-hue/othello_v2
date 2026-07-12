jest.mock('../game/card-effects/selection-flow', () => ({ executePendingSelection: jest.fn() }));
jest.mock('../game/turn/pending-coordinator', () => ({ buildPendingSelectionTargetPayload: jest.fn(() => ({ poisonTarget: { row: 2, col: 3 } })) }));

import { handlePoisonSelection } from '../game/card-effects/poison';
import * as SelectionFlow from '../game/card-effects/selection-flow';

test('POISON_WILL selection uses the shared pending-selection flow', async () => {
  await handlePoisonSelection(2, 3, 'black');
  expect(SelectionFlow.executePendingSelection).toHaveBeenCalledWith(expect.objectContaining({
    pendingType: 'POISON_WILL',
    actionPayload: { poisonTarget: { row: 2, col: 3 } },
    invalidMessage: '毒マスにするマスを選んでください'
  }));
});

