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

/**
 * After the first pointer gesture on the page, create the AudioContext outside the gesture
 * handler (a zero-delay timer) so its construction cost does not land in the first stone
 * placement playback. Sound playback, resume and BGM start remain where they were.
 */
function bindAudioContextPreparation(doc: Document | null): void {
  if (!doc || typeof doc.addEventListener !== 'function') return;
  const marker = (doc.documentElement && (doc.documentElement as HTMLElement).dataset) || null;
  if (marker && marker.audioContextPrepareBound === '1') return;
  if (marker) marker.audioContextPrepareBound = '1';
  const prepare = () => {
    const engine = resolveSoundEngine();
    if (!engine || typeof engine.prepareAudioContext !== 'function') return;
    setTimeout(() => {
      try { engine.prepareAudioContext(); } catch (e) { /* audio preparation is best effort */ }
    }, 0);
  };
  doc.addEventListener('pointerdown', prepare, { capture: true, once: true, passive: true } as AddEventListenerOptions);
}

function setupSoundControls(muteBtn: HTMLElement | null, seTypeSelect: HTMLSelectElement | null, seVolSlider: HTMLInputElement | null): void {
  bindAudioContextPreparation(typeof document !== 'undefined' ? document : null);
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
    const initialMasterVolume = Number.isFinite(Number(engine.masterVolume)) ? Number(engine.masterVolume) : 1;
    seVolSlider.value = String(initialMasterVolume);
    seVolSlider.addEventListener('input', (e: Event) => {
      const nextValue = (e.target as HTMLInputElement).value;
      if (typeof engine.setMasterVolume === 'function') {
        engine.setMasterVolume(nextValue);
      } else {
        engine.setVolume(nextValue);
      }
      if (rootRef && typeof rootRef.dispatchEvent === 'function' && typeof rootRef.CustomEvent === 'function') {
        rootRef.dispatchEvent(new rootRef.CustomEvent('sound:master-volume-changed', {
          detail: { masterVolume: Number(nextValue) }
        }));
      }
      engine.init();
    });
  }
}

function setupBgmControls(
  bgmPlayBtn: HTMLElement | null,
  bgmPauseBtn: HTMLElement | null,
  bgmTrackSelect: HTMLSelectElement | null,
  bgmVolSlider: HTMLInputElement | null,
  quickBgmTrackPicker: HTMLElement | null = null,
  quickBgmToggleBtn: HTMLElement | null = null
): void {
  const engine = resolveSoundEngine();
  if (!engine) return;

  const bgmTrackSelects = [bgmTrackSelect].filter(Boolean) as HTMLSelectElement[];
  const isBgmEnabled = () => engine.allowBgmPlay !== false;
  const syncQuickBgmToggle = () => {
    if (!quickBgmToggleBtn) return;
    const enabled = isBgmEnabled();
    quickBgmToggleBtn.textContent = enabled ? 'BGM: ON' : 'BGM: OFF';
    quickBgmToggleBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    quickBgmToggleBtn.classList.toggle('btn-active', enabled);
    quickBgmToggleBtn.setAttribute('title', enabled ? 'BGMをオフ' : 'BGMをオン');
  };
  const syncQuickBgmPicker = () => {
    if (!quickBgmTrackPicker) return;
    const button = quickBgmTrackPicker.querySelector('#quickBgmTrackButton') as HTMLButtonElement | null;
    const menu = quickBgmTrackPicker.querySelector('#quickBgmTrackMenu') as HTMLElement | null;
    const currentIndex = String(engine.currentTrackIndex);
    const currentTrack = engine.playlist && engine.playlist[Number(engine.currentTrackIndex)];
    if (button) {
      const label = String(currentTrack && currentTrack.name ? currentTrack.name : 'BGM');
      button.textContent = label;
      button.title = label;
    }
    if (menu) {
      const options = Array.from(menu.querySelectorAll<HTMLElement>('.quick-bgm-track-option'));
      for (const option of options) {
        const selected = option.dataset.trackIndex === currentIndex;
        option.classList.toggle('is-selected', selected);
        option.setAttribute('aria-selected', selected ? 'true' : 'false');
      }
    }
  };
  const syncBgmTrackSelects = () => {
    for (const select of bgmTrackSelects) {
      try { select.value = String(engine.currentTrackIndex); } catch (e) { /* ignore */ }
    }
    syncQuickBgmPicker();
  };

  for (const select of bgmTrackSelects) {
    const doc = select.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (!doc || select.dataset.bgmTrackBound === '1') continue;
    select.textContent = '';
    engine.playlist.forEach((track: any, idx: number) => {
      const el = doc.createElement('option');
      el.value = String(idx);
      el.textContent = track.name;
      select.appendChild(el);
    });

    try { select.value = String(engine.currentTrackIndex); } catch (e) { /* ignore */ }

    select.addEventListener('change', (e: Event) => {
      engine.setBgmTrack((e.target as HTMLSelectElement).value);
      syncBgmTrackSelects();
    });
    select.dataset.bgmTrackBound = '1';
  }
  syncBgmTrackSelects();
  syncQuickBgmToggle();

  if (quickBgmTrackPicker && quickBgmTrackPicker.dataset.bgmTrackBound !== '1') {
    const doc = quickBgmTrackPicker.ownerDocument || (typeof document !== 'undefined' ? document : null);
    const button = quickBgmTrackPicker.querySelector('#quickBgmTrackButton') as HTMLButtonElement | null;
    const menu = quickBgmTrackPicker.querySelector('#quickBgmTrackMenu') as HTMLElement | null;
    if (doc && button && menu) {
      menu.textContent = '';
      engine.playlist.forEach((track: any, idx: number) => {
        const option = doc.createElement('button');
        option.type = 'button';
        option.className = 'quick-bgm-track-option';
        option.setAttribute('role', 'option');
        option.dataset.trackIndex = String(idx);
        option.textContent = String(track && track.name ? track.name : `BGM ${idx + 1}`);
        option.addEventListener('click', () => {
          engine.setBgmTrack(String(idx));
          quickBgmTrackPicker.classList.remove('is-open');
          button.setAttribute('aria-expanded', 'false');
          syncBgmTrackSelects();
          button.focus();
        });
        menu.appendChild(option);
      });

      button.addEventListener('click', () => {
        const open = !quickBgmTrackPicker.classList.contains('is-open');
        quickBgmTrackPicker.classList.toggle('is-open', open);
        button.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      button.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key !== 'ArrowDown') return;
        e.preventDefault();
        quickBgmTrackPicker.classList.add('is-open');
        button.setAttribute('aria-expanded', 'true');
        const selected = menu.querySelector<HTMLElement>('.quick-bgm-track-option.is-selected');
        const first = menu.querySelector<HTMLElement>('.quick-bgm-track-option');
        (selected || first)?.focus();
      });
      menu.addEventListener('keydown', (e: KeyboardEvent) => {
        const options = Array.from(menu.querySelectorAll<HTMLElement>('.quick-bgm-track-option'));
        const current = doc.activeElement as HTMLElement | null;
        const index = Math.max(0, options.indexOf(current as HTMLElement));
        if (e.key === 'Escape') {
          e.preventDefault();
          quickBgmTrackPicker.classList.remove('is-open');
          button.setAttribute('aria-expanded', 'false');
          button.focus();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          options[Math.min(options.length - 1, index + 1)]?.focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          options[Math.max(0, index - 1)]?.focus();
        }
      });
      doc.addEventListener('pointerdown', (e: Event) => {
        const target = e.target as Node | null;
        if (target && quickBgmTrackPicker.contains(target)) return;
        quickBgmTrackPicker.classList.remove('is-open');
        button.setAttribute('aria-expanded', 'false');
      });
      quickBgmTrackPicker.dataset.bgmTrackBound = '1';
      syncQuickBgmPicker();
    }
  }

  if (bgmPlayBtn) {
    bgmPlayBtn.addEventListener('click', () => {
      engine.init();
      engine.playBgm();
      syncQuickBgmToggle();
    });
  }

  if (bgmPauseBtn) {
    bgmPauseBtn.addEventListener('click', () => {
      engine.pauseBgm();
      syncQuickBgmToggle();
    });
  }

  if (quickBgmToggleBtn && quickBgmToggleBtn.dataset.bgmToggleBound !== '1') {
    quickBgmToggleBtn.addEventListener('click', () => {
      if (isBgmEnabled()) {
        engine.pauseBgm();
      } else {
        engine.init();
        engine.playBgm();
      }
      syncQuickBgmToggle();
    });
    quickBgmToggleBtn.dataset.bgmToggleBound = '1';
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
