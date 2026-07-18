import type { BoardPlaybackContext } from '../board-visual/types';
import {
  PresentationPlaybackError,
  isDomCompatibilityFinalStateEvent,
  isBoardPlaybackEvent,
  isHybridPresentationEvent,
  normalizePresentationEventType,
  type PresentationPlaybackEvent
} from '../board-visual/playback-types';

export interface DomBoardPlaybackHandlers {
  beginPhase?(events: readonly PresentationPlaybackEvent[], context: BoardPlaybackContext): void;
  endPhase?(context: BoardPlaybackContext): void;
  playPlace(event: PresentationPlaybackEvent, context: BoardPlaybackContext): Promise<void> | void;
  playFlipBatch(events: readonly PresentationPlaybackEvent[], context: BoardPlaybackContext): Promise<void> | void;
  playDestroy(event: PresentationPlaybackEvent, context: BoardPlaybackContext): Promise<void> | void;
  playSpawn(event: PresentationPlaybackEvent, context: BoardPlaybackContext): Promise<void> | void;
  playMove(event: PresentationPlaybackEvent, context: BoardPlaybackContext): Promise<void> | void;
  playStatusChange(event: PresentationPlaybackEvent, context: BoardPlaybackContext): Promise<void> | void;
  playCrossfadeStone(event: PresentationPlaybackEvent, context: BoardPlaybackContext): Promise<void> | void;
  playProtectionExpire(event: PresentationPlaybackEvent, context: BoardPlaybackContext): Promise<void> | void;
  playLegacyFadeOut(event: PresentationPlaybackEvent, context: BoardPlaybackContext): Promise<void> | void;
  playLegacyStrongWillApply(event: PresentationPlaybackEvent, context: BoardPlaybackContext): Promise<void> | void;
  playLegacyHyperactiveMove(event: PresentationPlaybackEvent, context: BoardPlaybackContext): Promise<void> | void;
  playLegacySacrificeAbsorbPulse(event: PresentationPlaybackEvent, context: BoardPlaybackContext): Promise<void> | void;
  playObserverBubble(event: PresentationPlaybackEvent, context: BoardPlaybackContext): Promise<void> | void;
  playTheoryIncarnationRoulette(event: PresentationPlaybackEvent, context: BoardPlaybackContext): Promise<void> | void;
  playManifestEndingBoard(event: PresentationPlaybackEvent, context: BoardPlaybackContext): Promise<void> | void;
  playCompatibilityFinalState(event: PresentationPlaybackEvent, context: BoardPlaybackContext): Promise<void> | void;
}

export interface DomBoardPlaybackExecutor {
  readonly kind: 'dom-board-playback';
  playPhase(events: readonly unknown[], context: BoardPlaybackContext): Promise<void>;
}

function requireHandler(
  handlers: DomBoardPlaybackHandlers,
  event: PresentationPlaybackEvent,
  context: BoardPlaybackContext
): (event: PresentationPlaybackEvent, context: BoardPlaybackContext) => Promise<void> | void {
  switch (normalizePresentationEventType(event)) {
    case 'place': return handlers.playPlace;
    case 'destroy': return handlers.playDestroy;
    case 'spawn': return handlers.playSpawn;
    case 'move': return handlers.playMove;
    case 'status_applied':
    case 'status_removed': return handlers.playStatusChange;
    case 'crossfade_stone': return handlers.playCrossfadeStone;
    case 'protection_expire': return handlers.playProtectionExpire;
    case 'legacy_fade_out': return handlers.playLegacyFadeOut;
    case 'legacy_strong_will_apply': return handlers.playLegacyStrongWillApply;
    case 'legacy_hyperactive_move': return handlers.playLegacyHyperactiveMove;
    case 'legacy_sacrifice_absorb_pulse': return handlers.playLegacySacrificeAbsorbPulse;
    case 'observer_bubble': return handlers.playObserverBubble;
    case 'theory_incarnation_spawn_roulette': return handlers.playTheoryIncarnationRoulette;
    case 'manifest_ending': return handlers.playManifestEndingBoard;
    case '__dom_compatibility_final_state': return handlers.playCompatibilityFinalState;
    default:
      throw new PresentationPlaybackError('board_event_unimplemented', event, {
        strictNetworkPlayback: context?.strictNetworkPlayback === true
      });
  }
}

export function createDomBoardPlaybackExecutor(
  handlers: DomBoardPlaybackHandlers
): DomBoardPlaybackExecutor {
  if (!handlers || typeof handlers !== 'object') {
    throw new Error('createDomBoardPlaybackExecutor requires handlers');
  }

  return Object.freeze({
    kind: 'dom-board-playback' as const,
    async playPhase(events: readonly unknown[], context: BoardPlaybackContext): Promise<void> {
      const phaseEvents = Array.isArray(events) ? events.slice() : [];
      if (!phaseEvents.length) return;

      const invalid = phaseEvents.find((event) => (
        !isBoardPlaybackEvent(event)
        && !isHybridPresentationEvent(event)
        && !isDomCompatibilityFinalStateEvent(event)
      ));
      if (invalid) {
        throw new PresentationPlaybackError('non_board_event_routed_to_board_backend', invalid, {
          strictNetworkPlayback: context?.strictNetworkPlayback === true
        });
      }

      try {
        if (typeof handlers.beginPhase === 'function') handlers.beginPhase(phaseEvents, context);
        const flipEvents = phaseEvents.filter((event) => normalizePresentationEventType(event) === 'flip') as PresentationPlaybackEvent[];
        const nonFlipEvents = phaseEvents.filter((event) => normalizePresentationEventType(event) !== 'flip') as PresentationPlaybackEvent[];
        const launches: Promise<void>[] = [];

        // This launch order is player-visible for overlapping effects: the
        // consolidated flip batch starts before every non-flip in input order.
        if (flipEvents.length) {
          launches.push(Promise.resolve(handlers.playFlipBatch(flipEvents, context)));
        }
        for (const event of nonFlipEvents) {
          const handler = requireHandler(handlers, event, context);
          launches.push(Promise.resolve(handler.call(handlers, event, context)));
        }
        await Promise.all(launches);
      } catch (error) {
        if (error instanceof PresentationPlaybackError) throw error;
        if (context?.strictNetworkPlayback === true) {
          throw new PresentationPlaybackError('board_renderer_failed', phaseEvents[0], {
            strictNetworkPlayback: true,
            cause: error
          });
        }
        throw error;
      } finally {
        if (typeof handlers.endPhase === 'function') handlers.endPhase(context);
      }
    }
  });
}
