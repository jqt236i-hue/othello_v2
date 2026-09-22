import CardCatalog = require('../cards/catalog');
import { getLastUsedPanelCopy } from '../cards/card-last-used-panel-copy';

test('every runtime card has copy so a canonical card ID cannot produce an empty last-used panel', () => {
    const missing = CardCatalog.cards.filter(card => !getLastUsedPanelCopy(card.id).trim()).map(card => card.id);
    expect(missing).toEqual([]);
});
