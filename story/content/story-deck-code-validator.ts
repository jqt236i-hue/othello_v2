import type { StoryValidatorDeckCodeResult } from '../core/story-validator';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const DeckCodecModule = _require('../../shared/deck-codec.js');

export function validateStoryDeckCode(deckCode: string): StoryValidatorDeckCodeResult {
  if (DeckCodecModule && typeof DeckCodecModule.safeDecodeDeckCode === 'function') {
    const result = DeckCodecModule.safeDecodeDeckCode(deckCode);
    if (result && result.ok) return { ok: true };
    return {
      ok: false,
      message: result?.error?.message ? String(result.error.message) : 'deckCode decode failed.'
    };
  }

  try {
    DeckCodecModule.decodeDeckCode(deckCode);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}
