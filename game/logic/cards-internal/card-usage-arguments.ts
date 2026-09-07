/** Decode the historical signatures once, before entering the canonical usage stage. */
export function decodeCardUsageArguments(
    playerOrGameState: unknown,
    cardOrPlayer: unknown,
    trailing: readonly unknown[]
) {
    const withGameState = typeof playerOrGameState === 'object' && playerOrGameState !== null
        && typeof cardOrPlayer === 'string';
    return {
        gameState: withGameState ? playerOrGameState : null,
        playerKey: withGameState ? cardOrPlayer : playerOrGameState,
        cardId: withGameState ? trailing[0] : cardOrPlayer,
        handOwnerKey: trailing[withGameState ? 1 : 0],
        opts: trailing[withGameState ? 2 : 1]
    };
}
