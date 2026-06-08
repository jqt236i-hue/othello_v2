'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const STONE_PLACE_PREVIEW_KEY = 'stone_place';
const DEFAULT_PLACEMENT_SOUND_ID = 'default';

function resolveSoundEngine(): any {
  if (typeof (globalThis as any).SoundEngine !== 'undefined' && (globalThis as any).SoundEngine) return (globalThis as any).SoundEngine;
  if (typeof globalThis !== 'undefined' && (globalThis as any).SoundEngine) return (globalThis as any).SoundEngine;
  return null;
}

function resolvePlacementSoundSelectionModule(rootRef: any): any {
  const ctx = rootRef || (typeof globalThis !== 'undefined' ? globalThis : null);
  if (ctx && ctx.PlacementSoundSelectionModule) return ctx.PlacementSoundSelectionModule;
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).PlacementSoundSelectionModule) {
      return (globalThis as any).PlacementSoundSelectionModule;
    }
  } catch (e) { /* ignore */ }
  try {
    return _require('../placement-sound-selection');
  } catch (e) { /* ignore */ }
  return null;
}

function resolveRootRef(seTypeSelect?: any): any {
  const docRef = seTypeSelect && seTypeSelect.ownerDocument ? seTypeSelect.ownerDocument : null;
  if (docRef && docRef.defaultView) return docRef.defaultView;
  if (typeof window !== 'undefined') return window;
  if (typeof globalThis !== 'undefined') return globalThis;
  return null;
}

function resolveGachaEventsModule(rootRef: any): any {
  try {
    return _require('../gacha/gacha-events');
  } catch (e) { /* ignore */ }
  const ctx = rootRef || (typeof globalThis !== 'undefined' ? globalThis : null);
  if (ctx && ctx.GachaEventsModule) return ctx.GachaEventsModule;
  return null;
}

function getSelectablePlacementSounds(rootRef: any, engine: any): any[] {
  const selectionModule = resolvePlacementSoundSelectionModule(rootRef);
  if (selectionModule && typeof selectionModule.listSelectablePlacementSounds === 'function') {
    const definitions = selectionModule.listSelectablePlacementSounds({ root: rootRef });
    if (Array.isArray(definitions) && definitions.length) {
      return definitions;
    }
  }
  if (engine && typeof engine.listSelectablePlacementSounds === 'function') {
    const definitions = engine.listSelectablePlacementSounds({ root: rootRef });
    if (Array.isArray(definitions) && definitions.length) {
      return definitions;
    }
  }
  return [{
    id: DEFAULT_PLACEMENT_SOUND_ID,
    label: '既定配置音'
  }];
}

function getSelectedPlacementSoundId(rootRef: any, engine: any): string {
  const selectionModule = resolvePlacementSoundSelectionModule(rootRef);
  if (selectionModule && typeof selectionModule.getSelectedPlacementSoundId === 'function') {
    return selectionModule.getSelectedPlacementSoundId({ root: rootRef });
  }
  if (engine && typeof engine.getSelectedPlacementSoundId === 'function') {
    return engine.getSelectedPlacementSoundId({ root: rootRef });
  }
  return DEFAULT_PLACEMENT_SOUND_ID;
}

function setSelectedPlacementSoundId(rootRef: any, soundId: string, engine: any): string {
  const selectionModule = resolvePlacementSoundSelectionModule(rootRef);
  if (selectionModule && typeof selectionModule.setSelectedPlacementSoundId === 'function') {
    return selectionModule.setSelectedPlacementSoundId(soundId, { root: rootRef });
  }
  if (engine && typeof engine.setSelectedPlacementSoundId === 'function') {
    return engine.setSelectedPlacementSoundId(soundId, { root: rootRef });
  }
  return DEFAULT_PLACEMENT_SOUND_ID;
}

function previewStonePlacementSound(rootRef: any, seTypeSelect: HTMLSelectElement | null, soundId: string): boolean {
  const engine = resolveSoundEngine();
  if (!engine) return false;
  if (soundId) {
    setSelectedPlacementSoundId(rootRef, soundId, engine);
  }
  engine.init();
  const played = engine.playEffectByKey(STONE_PLACE_PREVIEW_KEY, { root: rootRef });
  if (seTypeSelect) {
    try {
      seTypeSelect.value = getSelectedPlacementSoundId(rootRef, engine);
    } catch (e) { /* ignore */ }
  }
  return played;
}

function syncStonePreviewOptions(rootRef: any, seTypeSelect: HTMLSelectElement | null): void {
  if (!seTypeSelect) return;
  const doc = seTypeSelect.ownerDocument || (typeof document !== 'undefined' ? document : null);
  if (!doc) return;
  const engine = resolveSoundEngine();
  const selectedId = getSelectedPlacementSoundId(rootRef, engine);
  const soundDefinitions = getSelectablePlacementSounds(rootRef, engine);
  seTypeSelect.textContent = '';
  soundDefinitions.forEach((definition: any) => {
    const el = doc.createElement('option');
    el.value = String(definition && definition.id || DEFAULT_PLACEMENT_SOUND_ID);
    el.textContent = String(definition && definition.label || '配置音');
    seTypeSelect.appendChild(el);
  });
  try {
    seTypeSelect.value = selectedId;
  } catch (e) {
    seTypeSelect.value = DEFAULT_PLACEMENT_SOUND_ID;
  }
}

function bindPlacementSoundInventoryRefresh(rootRef: any, seTypeSelect: HTMLSelectElement | null): void {
  if (!rootRef || !seTypeSelect || seTypeSelect.dataset.soundInventoryBound === '1') return;
  const eventsModule = resolveGachaEventsModule(rootRef);
  if (eventsModule && typeof eventsModule.addGachaInventoryUpdatedListener === 'function') {
    eventsModule.addGachaInventoryUpdatedListener(rootRef, () => {
      syncStonePreviewOptions(rootRef, seTypeSelect);
    });
    seTypeSelect.dataset.soundInventoryBound = '1';
    return;
  }
  if (typeof rootRef.addEventListener === 'function') {
    rootRef.addEventListener('gacha:inventory-updated', () => {
      syncStonePreviewOptions(rootRef, seTypeSelect);
    });
    seTypeSelect.dataset.soundInventoryBound = '1';
  }
}

function setupSoundControls(muteBtn: HTMLElement | null, seTypeSelect: HTMLSelectElement | null, seVolSlider: HTMLInputElement | null): void {
  const engine = resolveSoundEngine();
  if (!engine) return;
  const rootRef = resolveRootRef(seTypeSelect);

  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      const muted = engine.toggleMute();
      muteBtn.textContent = muted ? '🔇 OFF' : '🔊 ON';
      (muteBtn as HTMLElement).style.opacity = muted ? '0.7' : '1';
    });
  }

  if (seTypeSelect) {
    syncStonePreviewOptions(rootRef, seTypeSelect);
    bindPlacementSoundInventoryRefresh(rootRef, seTypeSelect);
    if (seTypeSelect.dataset.soundPreviewBound !== '1') {
      seTypeSelect.addEventListener('change', () => {
        const selectedId = String(seTypeSelect.value || '').trim();
        if (!selectedId) return;
        previewStonePlacementSound(rootRef, seTypeSelect, selectedId);
      });
      seTypeSelect.dataset.soundPreviewBound = '1';
    }
  }

  if (seVolSlider) {
    const initialMasterVolume = Number.isFinite(Number(engine.masterVolume)) ? Number(engine.masterVolume) : 0.5;
    seVolSlider.value = String(initialMasterVolume);
    seVolSlider.addEventListener('input', (e: Event) => {
      const nextValue = (e.target as HTMLInputElement).value;
      if (typeof engine.setMasterVolume === 'function') {
        engine.setMasterVolume(nextValue);
      } else {
        engine.setVolume(nextValue);
      }
      engine.init();
    });
  }
}

function setupBgmControls(bgmPlayBtn: HTMLElement | null, bgmPauseBtn: HTMLElement | null, bgmTrackSelect: HTMLSelectElement | null, bgmVolSlider: HTMLInputElement | null): void {
  const engine = resolveSoundEngine();
  if (!engine) return;

  if (bgmTrackSelect) {
    const doc = bgmTrackSelect.ownerDocument || (typeof document !== 'undefined' ? document : null);
    engine.playlist.forEach((track: any, idx: number) => {
      const el = doc.createElement('option');
      el.value = String(idx);
      el.textContent = track.name;
      bgmTrackSelect.appendChild(el);
    });

    try { bgmTrackSelect.value = String(engine.currentTrackIndex); } catch (e) { /* ignore */ }

    bgmTrackSelect.addEventListener('change', (e: Event) => {
      engine.setBgmTrack((e.target as HTMLSelectElement).value);
    });
  }

  if (bgmPlayBtn) {
    bgmPlayBtn.addEventListener('click', () => {
      engine.init();
      engine.playBgm();
    });
  }

  if (bgmPauseBtn) {
    bgmPauseBtn.addEventListener('click', () => {
      engine.pauseBgm();
    });
  }

  if (bgmVolSlider) {
    bgmVolSlider.value = engine.bgmVolume;
    bgmVolSlider.addEventListener('input', (e: Event) => {
      engine.setBgmVolume((e.target as HTMLInputElement).value);
    });
  }
}

const SoundHandler = {
  STONE_PLACE_PREVIEW_KEY,
  DEFAULT_PLACEMENT_SOUND_ID,
  previewStonePlacementSound,
  setupSoundControls,
  setupBgmControls,
  syncStonePreviewOptions
};

export = SoundHandler;
