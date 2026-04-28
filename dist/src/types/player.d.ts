/**
 * Player-related type definitions
 */
export type PlayerKey = 'black' | 'white';
export type PlayerValue = 1 | -1;
export interface Player {
    key: PlayerKey;
    value: PlayerValue;
}
export declare function playerKeyToValue(key: PlayerKey): PlayerValue;
export declare function playerValueToKey(value: PlayerValue): PlayerKey;
export declare function opponentOf(key: PlayerKey): PlayerKey;
//# sourceMappingURL=player.d.ts.map