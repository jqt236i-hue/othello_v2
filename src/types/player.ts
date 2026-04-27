/**
 * Player-related type definitions
 */

export type PlayerKey = 'black' | 'white';
export type PlayerValue = 1 | -1;

export interface Player {
  key: PlayerKey;
  value: PlayerValue;
}

export function playerKeyToValue(key: PlayerKey): PlayerValue {
  return key === 'black' ? 1 : -1;
}

export function playerValueToKey(value: PlayerValue): PlayerKey {
  return value === 1 ? 'black' : 'white';
}

export function opponentOf(key: PlayerKey): PlayerKey {
  return key === 'black' ? 'white' : 'black';
}