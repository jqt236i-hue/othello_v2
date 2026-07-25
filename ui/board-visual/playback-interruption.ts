export const PIXI_PLAYBACK_RESTORE_INTERRUPTION_CODE =
  'pixi_playback_interrupted_for_restore';
export const PIXI_PLAYBACK_TEXTURE_PREPARE_SUPERSEDED_CODE =
  'pixi_playback_texture_prepare_superseded';

const CONTROLLED_PLAYBACK_INTERRUPTION_CODES = new Set([
  PIXI_PLAYBACK_RESTORE_INTERRUPTION_CODE,
  PIXI_PLAYBACK_TEXTURE_PREPARE_SUPERSEDED_CODE
]);

export function isPixiPlaybackControlledInterruption(error: unknown): boolean {
  return !!error
    && typeof error === 'object'
    && CONTROLLED_PLAYBACK_INTERRUPTION_CODES.has(
      String((error as { code?: unknown }).code || '')
    );
}
