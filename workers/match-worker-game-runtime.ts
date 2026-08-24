import type { MatchWorkerRoomState } from './match-worker-types';
import type { MatchAuthoritySeatKey } from '../utils/match-authority-types';

export interface MatchWorkerGameRuntime {
  readonly applyCommandPublishToSnapshot: (
    room: MatchWorkerRoomState | null | undefined,
    body: Record<string, unknown>,
    playerKey: MatchAuthoritySeatKey
  ) => Promise<Record<string, unknown>>;
}

export function createMatchWorkerGameRuntime(input: MatchWorkerGameRuntime): MatchWorkerGameRuntime {
  if (!input || typeof input !== 'object'
    || typeof input.applyCommandPublishToSnapshot !== 'function') {
    throw new TypeError('match Worker game runtime requires applyCommandPublishToSnapshot');
  }
  return Object.freeze({
    applyCommandPublishToSnapshot: input.applyCommandPublishToSnapshot
  });
}
