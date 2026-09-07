import { decodeCardUsageArguments } from '../game/logic/cards-internal/card-usage-arguments';

test('legacy usage keeps hand-owner and options positions', () => {
    const options = { noConsume: true };
    expect(decodeCardUsageArguments('black', 'card', ['white', options])).toEqual({
        gameState: null, playerKey: 'black', cardId: 'card', handOwnerKey: 'white', opts: options
    });
});

test('state-aware usage preserves state and option identity', () => {
    const gameState = { board: [] };
    const options = { noConsume: true };
    const decoded = decodeCardUsageArguments(gameState, 'black', ['card', 'white', options]);
    expect(decoded).toEqual({ gameState, playerKey: 'black', cardId: 'card', handOwnerKey: 'white', opts: options });
    expect(decoded.gameState).toBe(gameState);
    expect(decoded.opts).toBe(options);
});

test('null is not mistaken for the state-aware overload', () => {
    expect(decodeCardUsageArguments(null, 'card', [])).toEqual({
        gameState: null, playerKey: null, cardId: 'card', handOwnerKey: undefined, opts: undefined
    });
});
