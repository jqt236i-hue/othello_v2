'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const GACHA_PULL_AUDIO_PATH = 'assets/audio/other/gacha.mp3';
const MASTER_VOLUME_CHANGED_EVENT = 'sound:master-volume-changed';

function resolveSoundEngineAccessModule(rootRef: any): any {
  try {
    return _require('../sound-engine-access');
  } catch (e) { /* ignore */ }
  try {
    if (rootRef && rootRef.SoundEngineAccessModule) return rootRef.SoundEngineAccessModule;
  } catch (e) { /* ignore */ }
  try {
    if (typeof (globalThis as any).SoundEngineAccessModule !== 'undefined' && (globalThis as any).SoundEngineAccessModule) return (globalThis as any).SoundEngineAccessModule;
  } catch (e) { /* ignore */ }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).SoundEngineAccessModule) return (globalThis as any).SoundEngineAccessModule;
  } catch (e) { /* ignore */ }
  return null;
}

function resolveSoundEngine(rootRef: any): any {
  const accessModule = resolveSoundEngineAccessModule(rootRef);
  if (accessModule && typeof accessModule.resolveSoundEngine === 'function') {
    return accessModule.resolveSoundEngine(rootRef);
  }
  if (rootRef && rootRef.SoundEngine) return rootRef.SoundEngine;
  try {
    if (typeof (globalThis as any).SoundEngine !== 'undefined' && (globalThis as any).SoundEngine) return (globalThis as any).SoundEngine;
  } catch (e) { /* ignore */ }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).SoundEngine) return (globalThis as any).SoundEngine;
  } catch (e) { /* ignore */ }
  return null;
}

function isBgmPlaying(engine: any, rootRef: any): boolean {
  const accessModule = resolveSoundEngineAccessModule(rootRef);
  if (accessModule && typeof accessModule.isBgmPlaying === 'function') {
    return accessModule.isBgmPlaying(engine);
  }
  return !!(engine && engine.allowBgmPlay === true && engine.bgm && engine.bgm.paused !== true);
}

function clampVolume(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function resolvePullAudioVolume(engine: any): number {
  const baseVolume = Number.isFinite(Number(engine && engine.volume)) ? Number(engine.volume) : 1;
  const masterVolume = Number.isFinite(Number(engine && engine.masterVolume)) ? Number(engine.masterVolume) : 1;
  const muteScale = engine && engine.isMuted === true ? 0 : 1;
  return clampVolume(Math.max(0, baseVolume) * Math.max(0, masterVolume) * muteScale);
}

function createPullAudioInstance(rootRef: any, options?: any): HTMLAudioElement | null {
  const opts = (options && typeof options === 'object') ? options : {};
  if (typeof opts.createAudio === 'function') {
    try {
      return opts.createAudio(GACHA_PULL_AUDIO_PATH) || null;
    } catch (e) {
      return null;
    }
  }

  const AudioCtor = (rootRef && rootRef.Audio) || (typeof Audio !== 'undefined' ? Audio : null);
  if (typeof AudioCtor !== 'function') return null;
  try {
    return new AudioCtor(GACHA_PULL_AUDIO_PATH);
  } catch (e) {
    return null;
  }
}

function createGachaRevealAudioSession(options?: any): any {
  const opts = (options && typeof options === 'object') ? options : {};
  const rootRef = opts.root || (typeof window !== 'undefined' ? window : null);
  let activePullAudio: HTMLAudioElement | null = null;
  let activePullAudioCleanup: ((audioRef?: any) => void) | null = null;
  let shouldResumeBgmAfterAudio = false;

  function updateActivePullAudioVolume(): void {
    if (!activePullAudio) return;
    const engine = resolveSoundEngine(rootRef);
    try { activePullAudio.volume = resolvePullAudioVolume(engine); } catch (e) { /* ignore */ }
  }

  function clearPullAudioBindings(audioRef?: any): void {
    if (!audioRef || typeof activePullAudioCleanup !== 'function') {
      activePullAudioCleanup = null;
      return;
    }
    try { activePullAudioCleanup(audioRef); } catch (e) { /* ignore */ }
    activePullAudioCleanup = null;
  }

  function resumeBgmIfNeeded(): boolean {
    const engine = resolveSoundEngine(rootRef);
    if (!shouldResumeBgmAfterAudio || !engine || typeof engine.playBgm !== 'function') {
      shouldResumeBgmAfterAudio = false;
      return false;
    }
    shouldResumeBgmAfterAudio = false;
    try {
      engine.playBgm();
      return true;
    } catch (e) {
      return false;
    }
  }

  function releaseActivePullAudio(audioRef?: any): void {
    const target = audioRef || activePullAudio;
    clearPullAudioBindings(target);
    if (activePullAudio === target) {
      activePullAudio = null;
    }
  }

  function pauseBgmForPullAudio(): boolean {
    const engine = resolveSoundEngine(rootRef);
    if (!engine || typeof engine.pauseBgm !== 'function' || typeof engine.playBgm !== 'function') {
      shouldResumeBgmAfterAudio = false;
      return false;
    }
    if (shouldResumeBgmAfterAudio) {
      return true;
    }
    const bgmIsPlaying = isBgmPlaying(engine, rootRef);
    if (!bgmIsPlaying) {
      shouldResumeBgmAfterAudio = false;
      return false;
    }
    shouldResumeBgmAfterAudio = true;
    try {
      engine.pauseBgm();
      return true;
    } catch (e) {
      shouldResumeBgmAfterAudio = false;
      return false;
    }
  }

  function bindPullAudioLifecycle(audio: HTMLAudioElement): void {
    if (!audio) return;
    const handleAudioFinished = function () {
      releaseActivePullAudio(audio);
    };
    if (typeof audio.addEventListener === 'function') {
      try { audio.addEventListener('ended', handleAudioFinished); } catch (e) { /* ignore */ }
      try { audio.addEventListener('error', handleAudioFinished); } catch (e) { /* ignore */ }
      if (rootRef && typeof rootRef.addEventListener === 'function') {
        try { rootRef.addEventListener(MASTER_VOLUME_CHANGED_EVENT, updateActivePullAudioVolume); } catch (e) { /* ignore */ }
      }
      activePullAudioCleanup = function (audioRef?: any) {
        if (audioRef && typeof audioRef.removeEventListener === 'function') {
          try { audioRef.removeEventListener('ended', handleAudioFinished); } catch (e) { /* ignore */ }
          try { audioRef.removeEventListener('error', handleAudioFinished); } catch (e) { /* ignore */ }
        }
        if (rootRef && typeof rootRef.removeEventListener === 'function') {
          try { rootRef.removeEventListener(MASTER_VOLUME_CHANGED_EVENT, updateActivePullAudioVolume); } catch (e) { /* ignore */ }
        }
      };
      return;
    }
    activePullAudioCleanup = null;
  }

  function play(): boolean {
    const engine = resolveSoundEngine(rootRef);
    const audio = createPullAudioInstance(rootRef, { createAudio: opts.createAudio });
    if (!audio || typeof audio.play !== 'function') return false;

    if (activePullAudio && activePullAudio !== audio) {
      try {
        if (typeof activePullAudio.pause === 'function') activePullAudio.pause();
      } catch (e) { /* ignore */ }
      releaseActivePullAudio(activePullAudio);
    }

    pauseBgmForPullAudio();
    activePullAudio = audio;
    bindPullAudioLifecycle(audio);

    try { audio.volume = resolvePullAudioVolume(engine); } catch (e) { /* ignore */ }

    try {
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(function () {
          releaseActivePullAudio(audio);
          resumeBgmIfNeeded();
        });
      }
      return true;
    } catch (e) {
      releaseActivePullAudio(audio);
      resumeBgmIfNeeded();
      return false;
    }
  }

  function destroy(): void {
    const audioRef = activePullAudio;
    if (audioRef && typeof audioRef.pause === 'function') {
      try { audioRef.pause(); } catch (e) { /* ignore */ }
    }
    releaseActivePullAudio(audioRef);
    resumeBgmIfNeeded();
  }

  return {
    play,
    destroy,
    hasActiveAudio: function () {
      return !!activePullAudio;
    }
  };
}

const GachaRevealAudio = {
  GACHA_PULL_AUDIO_PATH,
  MASTER_VOLUME_CHANGED_EVENT,
  createPullAudioInstance,
  createGachaRevealAudioSession
};

export = GachaRevealAudio;
