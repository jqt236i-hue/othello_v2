/**
 * @file sound-engine-access.ts
 * @description Safe accessor for SoundEngine
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface SoundEngine {
  allowBgmPlay?: boolean;
  bgm?: {
    paused?: boolean;
  };
  _manifestBgm?: {
    paused?: boolean;
  } | null;
  playResultBgm?: (outcomeKey: string) => boolean;
  stopResultBgm?: (options?: { resumeBgm?: boolean }) => boolean;
}

interface RootRef {
  SoundEngine?: SoundEngine;
}

function resolveSoundEngine(rootRef: RootRef | null | undefined): SoundEngine | null {
  return (rootRef && rootRef.SoundEngine)
    || (typeof globalThis !== 'undefined' ? (globalThis as unknown as RootRef).SoundEngine : null)
    || null;
}

function isBgmPlaying(engine: SoundEngine | null | undefined): boolean {
  if (!engine || engine.allowBgmPlay !== true) return false;
  if (engine.bgm && engine.bgm.paused !== true) return true;
  return !!(engine._manifestBgm && engine._manifestBgm.paused !== true);
}

export = {
  resolveSoundEngine,
  isBgmPlaying
};
