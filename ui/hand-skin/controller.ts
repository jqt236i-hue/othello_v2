'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

function resolveCatalogModule(rootRef: any): any {
  const ctx = rootRef && typeof rootRef === 'object' ? rootRef : null;
  if (ctx && ctx.HandSkinCatalogModule) return ctx.HandSkinCatalogModule;
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).HandSkinCatalogModule) {
      return (globalThis as any).HandSkinCatalogModule;
    }
  } catch (e) { /* ignore */ }
  if (typeof _require === 'function') {
    try {
      return _require('./catalog.js');
    } catch (e) { /* ignore */ }
  }
  return null;
}

function resolveSelectionModule(rootRef: any): any {
  const ctx = rootRef && typeof rootRef === 'object' ? rootRef : null;
  if (ctx && ctx.HandSkinSelectionModule) return ctx.HandSkinSelectionModule;
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).HandSkinSelectionModule) {
      return (globalThis as any).HandSkinSelectionModule;
    }
  } catch (e) { /* ignore */ }
  if (typeof _require === 'function') {
    try {
      return _require('./selection.js');
    } catch (e) { /* ignore */ }
  }
  return null;
}

function resolveRuntimeModule(rootRef: any): any {
  const ctx = rootRef && typeof rootRef === 'object' ? rootRef : null;
  if (ctx && ctx.HandSkinRuntimeModule) return ctx.HandSkinRuntimeModule;
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).HandSkinRuntimeModule) {
      return (globalThis as any).HandSkinRuntimeModule;
    }
  } catch (e) { /* ignore */ }
  if (typeof _require === 'function') {
    try {
      return _require('./runtime.js');
    } catch (e) { /* ignore */ }
  }
  return null;
}

function resolveBackgroundControllerModule(rootRef: any): any {
  const ctx = rootRef && typeof rootRef === 'object' ? rootRef : null;
  if (ctx && ctx.BackgroundSkinControllerModule) return ctx.BackgroundSkinControllerModule;
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).BackgroundSkinControllerModule) {
      return (globalThis as any).BackgroundSkinControllerModule;
    }
  } catch (e) { /* ignore */ }
  if (typeof _require === 'function') {
    try {
      return _require('../background-skin/controller.js');
    } catch (e) { /* ignore */ }
  }
  return null;
}

function resolveFontControllerModule(rootRef: any): any {
  const ctx = rootRef && typeof rootRef === 'object' ? rootRef : null;
  if (ctx && ctx.FontSkinControllerModule) return ctx.FontSkinControllerModule;
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).FontSkinControllerModule) {
      return (globalThis as any).FontSkinControllerModule;
    }
  } catch (e) { /* ignore */ }
  if (typeof _require === 'function') {
    try {
      return _require('../font-skin/controller.js');
    } catch (e) { /* ignore */ }
  }
  return null;
}

function resolveBoardControllerModule(rootRef: any): any {
  const ctx = rootRef && typeof rootRef === 'object' ? rootRef : null;
  if (ctx && ctx.BoardSkinControllerModule) return ctx.BoardSkinControllerModule;
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).BoardSkinControllerModule) {
      return (globalThis as any).BoardSkinControllerModule;
    }
  } catch (e) { /* ignore */ }
  if (typeof _require === 'function') {
    try {
      return _require('../board-skin/controller.js');
    } catch (e) { /* ignore */ }
  }
  return null;
}

function resolveStoneControllerModule(rootRef: any): any {
  const ctx = rootRef && typeof rootRef === 'object' ? rootRef : null;
  if (ctx && ctx.StoneSkinControllerModule) return ctx.StoneSkinControllerModule;
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).StoneSkinControllerModule) {
      return (globalThis as any).StoneSkinControllerModule;
    }
  } catch (e) { /* ignore */ }
  if (typeof _require === 'function') {
    try {
      return _require('../stone-skin/controller.js');
    } catch (e) { /* ignore */ }
  }
  return null;
}

function resolveUIBootstrapModule(rootRef: any): any {
  const ctx = rootRef && typeof rootRef === 'object' ? rootRef : null;
  if (ctx && ctx.UIBootstrap) return ctx.UIBootstrap;
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).UIBootstrap) {
      return (globalThis as any).UIBootstrap;
    }
  } catch (e) { /* ignore */ }
  return null;
}

function resolveGachaEventsModule(rootRef: any): any {
  const ctx = rootRef && typeof rootRef === 'object' ? rootRef : null;
  if (ctx && ctx.GachaEventsModule) return ctx.GachaEventsModule;
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).GachaEventsModule) {
      return (globalThis as any).GachaEventsModule;
    }
  } catch (e) { /* ignore */ }
  if (typeof _require === 'function') {
    try {
      return _require('../gacha/gacha-events.js');
    } catch (e) { /* ignore */ }
  }
  return null;
}

function resolveHandAnimationPreferencesModule(): any {
  if (typeof _require === 'function') {
    try {
      return _require('../hand-animation-preferences.js');
    } catch (e) { /* ignore */ }
  }
  return null;
}

function resolveDocument(rootRef: any): Document | null {
  const runtimeModule = resolveRuntimeModule(rootRef);
  if (runtimeModule && typeof runtimeModule.resolveDocument === 'function') {
    return runtimeModule.resolveDocument(rootRef);
  }
  if (rootRef && rootRef.document) return rootRef.document;
  if (typeof document !== 'undefined') return document;
  return null;
}

function createOptionButton(docRef: Document, skin: any): HTMLButtonElement {
  const button = docRef.createElement('button');
  button.type = 'button';
  button.className = 'hand-skin-option';
  button.setAttribute('role', 'radio');
  button.setAttribute('aria-checked', 'false');
  button.setAttribute('data-hand-skin-id', skin.id);
  button.setAttribute('aria-label', `手の見た目 ${skin.label}`);

  const preview = docRef.createElement('img');
  preview.className = 'hand-skin-option-preview';
  preview.src = skin.imagePath;
  preview.alt = '';
  preview.loading = 'lazy';
  preview.decoding = 'async';
  preview.draggable = false;
  button.appendChild(preview);

  const copy = docRef.createElement('span');
  copy.className = 'hand-skin-option-copy';

  const label = docRef.createElement('span');
  label.className = 'hand-skin-option-label';
  label.textContent = skin.label;
  copy.appendChild(label);

  const note = docRef.createElement('span');
  note.className = 'hand-skin-option-note';
  note.textContent = skin.note;
  copy.appendChild(note);

  button.appendChild(copy);
  return button;
}

const HandAnimationPreferencesModule = resolveHandAnimationPreferencesModule();
const APPEARANCE_PRESET_STORAGE_KEY = 'reversi.appearancePresets';
const APPEARANCE_PRESET_CODE_PREFIX = 'appearance:v1:';
const APPEARANCE_PRESET_FIELDS = [
  'handSkinId',
  'backgroundSkinId',
  'boardSkinId',
  'boardFrameSkinId',
  'fontSkinId',
  'stoneSkinId'
];

function readHandAnimationPreference(rootRef: any, key: 'draw' | 'place'): boolean {
  if (HandAnimationPreferencesModule && typeof HandAnimationPreferencesModule.readHandAnimationPreference === 'function') {
    return HandAnimationPreferencesModule.readHandAnimationPreference(rootRef, key);
  }
  return true;
}

function writeHandAnimationPreference(rootRef: any, key: 'draw' | 'place', enabled: boolean): void {
  if (HandAnimationPreferencesModule && typeof HandAnimationPreferencesModule.writeHandAnimationPreference === 'function') {
    HandAnimationPreferencesModule.writeHandAnimationPreference(rootRef, key, enabled);
  }
}

function syncHandAnimationFlags(rootRef: any): { draw: boolean; place: boolean } {
  if (HandAnimationPreferencesModule && typeof HandAnimationPreferencesModule.syncHandAnimationFlags === 'function') {
    return HandAnimationPreferencesModule.syncHandAnimationFlags(rootRef);
  }
  return { draw: true, place: true };
}

function createHandAnimationToggle(
  docRef: Document,
  rootRef: any,
  key: 'draw' | 'place',
  labelText: string
): HTMLLabelElement {
  const label = docRef.createElement('label');
  label.className = 'hand-animation-toggle';

  const input = docRef.createElement('input');
  input.type = 'checkbox';
  input.id = key === 'draw' ? 'handAnimationDrawToggle' : 'handAnimationPlaceToggle';
  input.checked = readHandAnimationPreference(rootRef, key);
  input.addEventListener('change', function () {
    writeHandAnimationPreference(rootRef, key, input.checked);
  });
  label.appendChild(input);

  const text = docRef.createElement('span');
  text.textContent = labelText;
  label.appendChild(text);
  return label;
}

function ensureHandAnimationControls(docRef: Document, rootRef: any, handSection: any, optionsEl: any): void {
  if (!handSection || !optionsEl || docRef.getElementById('handAnimationDrawToggle')) {
    syncHandAnimationFlags(rootRef);
    return;
  }
  const group = docRef.createElement('div');
  group.className = 'hand-animation-controls';
  group.appendChild(createHandAnimationToggle(docRef, rootRef, 'draw', 'ドロー演出'));
  group.appendChild(createHandAnimationToggle(docRef, rootRef, 'place', '配置演出'));
  handSection.insertBefore(group, optionsEl);
  syncHandAnimationFlags(rootRef);
}

function canUseStorage(rootRef: any): boolean {
  try { return !!(rootRef && rootRef.localStorage); } catch (e) { return false; }
}

function readAppearancePresetState(rootRef: any): any {
  if (!canUseStorage(rootRef)) return { presets: [] };
  try {
    const parsed = JSON.parse(rootRef.localStorage.getItem(APPEARANCE_PRESET_STORAGE_KEY) || '{}');
    return {
      presets: Array.isArray(parsed && parsed.presets) ? parsed.presets.filter((preset: any) => preset && typeof preset === 'object') : []
    };
  } catch (e) {
    return { presets: [] };
  }
}

function writeAppearancePresetState(rootRef: any, state: any): boolean {
  if (!canUseStorage(rootRef)) return false;
  try {
    rootRef.localStorage.setItem(APPEARANCE_PRESET_STORAGE_KEY, JSON.stringify({
      version: 1,
      presets: Array.isArray(state && state.presets) ? state.presets : []
    }));
    return true;
  } catch (e) {
    return false;
  }
}

function createDefaultPresetName(presets: any[]): string {
  const usedNumbers = new Set<number>();
  (Array.isArray(presets) ? presets : []).forEach((preset: any) => {
    const match = String((preset && preset.name) || '').trim().match(/^プリセット(\d+)$/);
    if (match) usedNumbers.add(Number(match[1]));
  });
  let index = 1;
  while (usedNumbers.has(index)) index += 1;
  return `プリセット${index}`;
}

function encodeBase64Url(rootRef: any, text: string): string {
  let base64 = '';
  const ctx = rootRef && typeof rootRef === 'object' ? rootRef : null;
  if (ctx && typeof ctx.btoa === 'function') {
    const binary = encodeURIComponent(text).replace(/%([0-9A-F]{2})/g, function (_match, hex) {
      return String.fromCharCode(parseInt(hex, 16));
    });
    base64 = ctx.btoa(binary);
  } else if (typeof Buffer !== 'undefined') {
    base64 = Buffer.from(text, 'utf8').toString('base64');
  }
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(rootRef: any, text: string): string | null {
  const normalized = String(text || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const ctx = rootRef && typeof rootRef === 'object' ? rootRef : null;
  try {
    if (ctx && typeof ctx.atob === 'function') {
      const binary = ctx.atob(padded);
      let encoded = '';
      for (let i = 0; i < binary.length; i += 1) {
        encoded += `%${binary.charCodeAt(i).toString(16).padStart(2, '0')}`;
      }
      return decodeURIComponent(encoded);
    }
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(padded, 'base64').toString('utf8');
    }
  } catch (e) {
    return null;
  }
  return null;
}

function normalizeAppearancePresetCodePayload(value: any): any | null {
  const source = value && typeof value === 'object' ? value : {};
  const appearance: any = {};
  APPEARANCE_PRESET_FIELDS.forEach((field) => {
    const raw = source[field];
    const normalized = typeof raw === 'string' ? raw.trim() : '';
    if (normalized) appearance[field] = normalized;
  });
  return Object.keys(appearance).length ? appearance : null;
}

function encodeAppearancePresetCode(rootRef: any, appearance: any): string {
  const normalized = normalizeAppearancePresetCodePayload(appearance);
  const payload = JSON.stringify({
    version: 1,
    appearance: normalized || {}
  });
  return `${APPEARANCE_PRESET_CODE_PREFIX}${encodeBase64Url(rootRef, payload)}`;
}

function decodeAppearancePresetCode(rootRef: any, code: any): any | null {
  const rawCode = String(code || '').trim();
  if (!rawCode.startsWith(APPEARANCE_PRESET_CODE_PREFIX)) return null;
  const decoded = decodeBase64Url(rootRef, rawCode.slice(APPEARANCE_PRESET_CODE_PREFIX.length));
  if (!decoded) return null;
  try {
    const parsed = JSON.parse(decoded);
    return normalizeAppearancePresetCodePayload(parsed && parsed.appearance);
  } catch (e) {
    return null;
  }
}

function copyTextWithHiddenTextarea(docRef: Document, text: string): boolean {
  const container = docRef.body || docRef.documentElement;
  if (!container) return false;
  const textarea = docRef.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'readonly');
  textarea.setAttribute('aria-hidden', 'true');
  textarea.tabIndex = -1;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  textarea.style.opacity = '0';
  container.appendChild(textarea);
  let copied = false;
  try {
    textarea.focus();
    textarea.select();
    copied = typeof docRef.execCommand === 'function' && docRef.execCommand('copy') === true;
  } catch (e) {
    copied = false;
  } finally {
    if (textarea.parentNode) textarea.parentNode.removeChild(textarea);
  }
  return copied;
}

function setupHandSkinControls(options?: any): any {
  const opts = (options && typeof options === 'object') ? options : {};
  const rootRef = opts.root || (typeof window !== 'undefined' ? window : null);
  const docRef = opts.document || resolveDocument(rootRef);
  const uiBootstrap = resolveUIBootstrapModule(rootRef);
  const assetManifestUpdatedEventName = (
    uiBootstrap && typeof uiBootstrap.ASSET_MANIFEST_UPDATED_EVENT === 'string' && uiBootstrap.ASSET_MANIFEST_UPDATED_EVENT
  ) || 'asset-manifest:updated';
  const catalogModule = resolveCatalogModule(rootRef);
  const selectionModule = resolveSelectionModule(rootRef);
  const runtimeModule = resolveRuntimeModule(rootRef);
  const backgroundControllerModule = resolveBackgroundControllerModule(rootRef);
  const boardControllerModule = resolveBoardControllerModule(rootRef);
  const fontControllerModule = resolveFontControllerModule(rootRef);
  const stoneControllerModule = resolveStoneControllerModule(rootRef);
  if (!docRef || !catalogModule || !selectionModule || !runtimeModule) return null;

  const button = opts.button || docRef.getElementById('handSkinBtn');
  const panel = opts.panel || docRef.getElementById('handSkinPanel');
  const closeBtn = opts.closeBtn || docRef.getElementById('handSkinCloseBtn');
  const optionsEl = opts.optionsEl || docRef.getElementById('handSkinOptions');
  const handSection = opts.handSection || docRef.getElementById('handSkinSection');
  const backgroundSection = opts.backgroundSection || docRef.getElementById('backgroundSkinSection');
  const boardSection = opts.boardSection || docRef.getElementById('boardSkinSection');
  const boardFrameSection = opts.boardFrameSection || docRef.getElementById('boardFrameSkinSection');
  const fontSection = opts.fontSection || docRef.getElementById('fontSkinSection');
  const stoneSection = opts.stoneSection || docRef.getElementById('stoneSkinSection');
  const presetSection = opts.presetSection || docRef.getElementById('appearancePresetSection');
  const handTabBtn = opts.handTabBtn || docRef.getElementById('appearanceTabHand');
  const backgroundTabBtn = opts.backgroundTabBtn || docRef.getElementById('appearanceTabBackground');
  const boardTabBtn = opts.boardTabBtn || docRef.getElementById('appearanceTabBoard');
  const boardFrameTabBtn = opts.boardFrameTabBtn || docRef.getElementById('appearanceTabBoardFrame');
  const fontTabBtn = opts.fontTabBtn || docRef.getElementById('appearanceTabFont');
  const stoneTabBtn = opts.stoneTabBtn || docRef.getElementById('appearanceTabStone');
  const presetTabBtn = opts.presetTabBtn || docRef.getElementById('appearanceTabPreset');
  const presetNameInput = opts.presetNameInput || docRef.getElementById('appearancePresetNameInput');
  const presetSaveBtn = opts.presetSaveBtn || docRef.getElementById('appearancePresetSaveBtn');
  const presetCodeInput = opts.presetCodeInput || docRef.getElementById('appearancePresetCodeInput');
  const presetCodeLoadBtn = opts.presetCodeLoadBtn || docRef.getElementById('appearancePresetCodeLoadBtn');
  const presetCodeStatusEl = opts.presetCodeStatusEl || docRef.getElementById('appearancePresetCodeStatus');
  const presetListEl = opts.presetListEl || docRef.getElementById('appearancePresetList');
  const handImageEl = opts.handImage || docRef.getElementById('handImage');
  if (!button || !panel || !optionsEl || !handImageEl) return null;

  let isOpen = false;
  let selectedSkin: any = null;
  let activeTab = 'hand';
  const backgroundControllerApi = backgroundControllerModule && typeof backgroundControllerModule.setupBackgroundSkinControls === 'function'
    ? backgroundControllerModule.setupBackgroundSkinControls({
      root: rootRef,
      document: docRef
    })
    : null;
  const boardControllerApi = boardControllerModule && typeof boardControllerModule.setupBoardSkinControls === 'function'
    ? boardControllerModule.setupBoardSkinControls({
      root: rootRef,
      document: docRef
    })
    : null;
  const fontControllerApi = fontControllerModule && typeof fontControllerModule.setupFontSkinControls === 'function'
    ? fontControllerModule.setupFontSkinControls({
      root: rootRef,
      document: docRef
    })
    : null;
  const stoneControllerApi = stoneControllerModule && typeof stoneControllerModule.setupStoneSkinControls === 'function'
    ? stoneControllerModule.setupStoneSkinControls({
      root: rootRef,
      document: docRef
    })
    : null;
  ensureHandAnimationControls(docRef, rootRef, handSection, optionsEl);

  function collectCurrentAppearance(): any {
    return {
      handSkinId: selectedSkin ? selectedSkin.id : catalogModule.DEFAULT_HAND_SKIN_ID,
      backgroundSkinId: backgroundControllerApi && typeof backgroundControllerApi.getSelectedSkinId === 'function'
        ? backgroundControllerApi.getSelectedSkinId()
        : null,
      boardSkinId: boardControllerApi && typeof boardControllerApi.getSelectedSkinId === 'function'
        ? boardControllerApi.getSelectedSkinId()
        : null,
      boardFrameSkinId: boardControllerApi && typeof boardControllerApi.getSelectedFrameSkinId === 'function'
        ? boardControllerApi.getSelectedFrameSkinId()
        : null,
      fontSkinId: fontControllerApi && typeof fontControllerApi.getSelectedSkinId === 'function'
        ? fontControllerApi.getSelectedSkinId()
        : null,
      stoneSkinId: stoneControllerApi && typeof stoneControllerApi.getSelectedSkinId === 'function'
        ? stoneControllerApi.getSelectedSkinId()
        : null
    };
  }

  function applyAppearancePreset(preset: any): void {
    const appearance = preset && preset.appearance ? preset.appearance : {};
    if (appearance.handSkinId) applySelection(appearance.handSkinId, true);
    if (appearance.backgroundSkinId && backgroundControllerApi && typeof backgroundControllerApi.selectSkin === 'function') {
      backgroundControllerApi.selectSkin(appearance.backgroundSkinId);
    }
    if (appearance.boardSkinId && boardControllerApi && typeof boardControllerApi.selectSkin === 'function') {
      boardControllerApi.selectSkin(appearance.boardSkinId);
    }
    if (appearance.boardFrameSkinId && boardControllerApi && typeof boardControllerApi.selectFrameSkin === 'function') {
      boardControllerApi.selectFrameSkin(appearance.boardFrameSkinId);
    }
    if (appearance.fontSkinId && fontControllerApi && typeof fontControllerApi.selectSkin === 'function') {
      fontControllerApi.selectSkin(appearance.fontSkinId);
    }
    if (appearance.stoneSkinId && stoneControllerApi && typeof stoneControllerApi.selectSkin === 'function') {
      stoneControllerApi.selectSkin(appearance.stoneSkinId);
    }
  }

  function renderAppearancePresetList(): void {
    if (!presetListEl) return;
    const state = readAppearancePresetState(rootRef);
    presetListEl.innerHTML = '';
    if (!state.presets.length) {
      const emptyEl = docRef.createElement('div');
      emptyEl.className = 'appearance-preset-empty';
      emptyEl.textContent = '保存済みプリセットなし';
      presetListEl.appendChild(emptyEl);
      return;
    }
    state.presets.forEach((preset: any) => {
      const row = docRef.createElement('div');
      row.className = 'appearance-preset-row';

      const presetName = String(preset.name || '').trim() || 'プリセット';
      const nameEl = docRef.createElement('div');
      nameEl.className = 'appearance-preset-name';
      nameEl.textContent = presetName;
      row.appendChild(nameEl);

      const useBtn = docRef.createElement('button');
      useBtn.type = 'button';
      useBtn.className = 'appearance-preset-use';
      useBtn.textContent = '使用';
      useBtn.setAttribute('aria-label', `${presetName}を使用`);
      useBtn.addEventListener('click', function (event: any) {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        applyAppearancePreset(preset);
        renderAppearancePresetList();
      });
      row.appendChild(useBtn);

      const codeCopyBtn = docRef.createElement('button');
      codeCopyBtn.type = 'button';
      codeCopyBtn.className = 'appearance-preset-code-copy';
      codeCopyBtn.textContent = 'コードコピー';
      codeCopyBtn.setAttribute('aria-label', `${presetName}のコードをコピー`);
      codeCopyBtn.addEventListener('click', function (event: any) {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
        copyAppearanceCode(preset && preset.appearance, `${presetName}のコードをコピーしました`);
      });
      row.appendChild(codeCopyBtn);

      const deleteBtn = docRef.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'appearance-preset-delete';
      deleteBtn.textContent = '削除';
      deleteBtn.setAttribute('aria-label', `${presetName}を削除`);
      deleteBtn.addEventListener('click', function (event: any) {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
        const nextState = readAppearancePresetState(rootRef);
        nextState.presets = nextState.presets.filter((entry: any) => String(entry.id || '') !== String(preset.id || ''));
        writeAppearancePresetState(rootRef, nextState);
        renderAppearancePresetList();
      });
      row.appendChild(deleteBtn);
      presetListEl.appendChild(row);
    });
  }

  function saveCurrentAppearancePreset(): void {
    const state = readAppearancePresetState(rootRef);
    const rawName = presetNameInput ? String(presetNameInput.value || '').trim() : '';
    const name = rawName || createDefaultPresetName(state.presets);
    const now = new Date().toISOString();
    state.presets.push({
      id: `appearance_preset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      appearance: collectCurrentAppearance(),
      createdAt: now,
      updatedAt: now
    });
    writeAppearancePresetState(rootRef, state);
    if (presetNameInput) presetNameInput.value = '';
    renderAppearancePresetList();
  }

  function setAppearancePresetCodeStatus(message: string, tone?: string): void {
    if (!presetCodeStatusEl) return;
    presetCodeStatusEl.textContent = message;
    presetCodeStatusEl.classList.toggle('is-error', tone === 'error');
  }

  function copyAppearanceCode(appearance: any, successMessage?: string): string {
    const code = encodeAppearancePresetCode(rootRef, appearance);
    if (presetCodeInput) presetCodeInput.value = code;
    const fallbackCopied = copyTextWithHiddenTextarea(docRef, code);
    let statusSettled = false;
    function setCopySuccess(): void {
      if (statusSettled) return;
      statusSettled = true;
      setAppearancePresetCodeStatus(successMessage || 'コードをコピーしました');
    }
    function setCopyFailure(): void {
      if (fallbackCopied) {
        setCopySuccess();
        return;
      }
      if (statusSettled) return;
      statusSettled = true;
      setAppearancePresetCodeStatus('コードをコピーできませんでした', 'error');
    }
    if (fallbackCopied) setCopySuccess();
    const clipboard = rootRef && rootRef.navigator && rootRef.navigator.clipboard;
    if (clipboard && typeof clipboard.writeText === 'function') {
      try {
        const result = clipboard.writeText(code);
        if (result && typeof result.then === 'function') {
          result.then(function () {
            setCopySuccess();
          }).catch(function () {
            setCopyFailure();
          });
        } else {
          setCopySuccess();
        }
      } catch (e) {
        setCopyFailure();
      }
    } else {
      setCopyFailure();
    }
    return code;
  }

  function copyCurrentAppearanceCode(): string {
    return copyAppearanceCode(collectCurrentAppearance(), '今の状態のコードをコピーしました');
  }

  async function readAppearancePresetCodeText(): Promise<string> {
    if (presetCodeInput && String(presetCodeInput.value || '').trim()) {
      return String(presetCodeInput.value || '').trim();
    }
    const clipboard = rootRef && rootRef.navigator && rootRef.navigator.clipboard;
    if (clipboard && typeof clipboard.readText === 'function') {
      return String(await clipboard.readText() || '').trim();
    }
    if (rootRef && typeof rootRef.prompt === 'function') {
      return String(rootRef.prompt('プリセットコードを入力') || '').trim();
    }
    return '';
  }

  async function loadAppearancePresetCode(): Promise<boolean> {
    const appearance = decodeAppearancePresetCode(rootRef, await readAppearancePresetCodeText());
    if (!appearance) {
      setAppearancePresetCodeStatus('コードを読み込めませんでした', 'error');
      return false;
    }
    applyAppearancePreset({ appearance });
    renderAppearancePresetList();
    setAppearancePresetCodeStatus('コードから見た目を読み込みました');
    return true;
  }

  function syncButtonLabel(): void {
    const label = selectedSkin
      ? selectedSkin.label
      : catalogModule.getHandSkinDefinition(catalogModule.DEFAULT_HAND_SKIN_ID, rootRef).label;
    button.title = `見た目: 手 ${label}`;
    button.setAttribute('aria-label', `見た目設定（現在の手: ${label}）`);
  }

  function syncOptionState(): void {
    const optionButtons = Array.from(optionsEl.querySelectorAll('.hand-skin-option'));
    optionButtons.forEach((optionButton: any) => {
      const active = !!(selectedSkin && optionButton.getAttribute('data-hand-skin-id') === selectedSkin.id);
      optionButton.classList.toggle('is-selected', active);
      optionButton.setAttribute('aria-checked', active ? 'true' : 'false');
    });
  }

  function applySelection(skinId: any, persist: boolean): any {
    const definition = catalogModule.getHandSkinDefinition(skinId, rootRef);
    if (!definition) return null;
    selectedSkin = definition;
    runtimeModule.syncDisplayedHandSkin(rootRef, definition.id, handImageEl);
    syncOptionState();
    syncButtonLabel();
    if (persist === true) {
      selectionModule.writeStoredHandSkinId(rootRef, definition.id);
      const networkClient = runtimeModule.resolveNetworkMatchClient(rootRef);
      if (
        runtimeModule.isNetworkMode(rootRef)
        && networkClient
        && typeof networkClient.updateHandSkin === 'function'
      ) {
        try {
          const result = networkClient.updateHandSkin(definition.id);
          if (result && typeof result.then === 'function') {
            result.catch(function (error: any) {
              if (typeof console !== 'undefined' && console.warn) {
                console.warn('[hand-skin] failed to sync network hand skin', error);
              }
            });
          }
        } catch (error: any) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('[hand-skin] failed to sync network hand skin', error);
          }
        }
      }
    }
    return definition;
  }

  function renderOptions(): void {
    optionsEl.innerHTML = '';
    catalogModule.getOwnedHandSkins(rootRef).forEach((skin: any) => {
      const optionButton = createOptionButton(docRef, skin);
      optionButton.addEventListener('click', function (event: any) {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        applySelection(skin.id, true);
      });
      optionsEl.appendChild(optionButton);
    });
  }

  function refreshOptions(preferredSkinId?: any): void {
    renderOptions();
    const nextSkinId = catalogModule.normalizeHandSkinId(
      preferredSkinId || (selectedSkin && selectedSkin.id) || selectionModule.readStoredHandSkinId(rootRef),
      rootRef
    );
    applySelection(nextSkinId, false);
  }

  function syncTabButtonState(tabButton: any, tabKey: string, enabled: boolean): void {
    if (!tabButton) return;
    const selected = enabled && activeTab === tabKey;
    tabButton.hidden = !enabled;
    tabButton.classList.toggle('is-active', selected);
    tabButton.setAttribute('aria-selected', selected ? 'true' : 'false');
  }

  function setActiveTab(nextTab: string): void {
    const hasBackgroundTab = !!(backgroundControllerApi && backgroundSection && backgroundTabBtn);
    const hasBoardTab = !!(boardControllerApi && boardSection && boardTabBtn);
    const hasBoardFrameTab = !!(boardControllerApi && boardFrameSection && boardFrameTabBtn);
    const hasFontTab = !!(fontControllerApi && fontSection && fontTabBtn);
    const hasStoneTab = !!(stoneControllerApi && stoneSection && stoneTabBtn);
    const hasPresetTab = !!(presetSection && presetTabBtn && presetListEl && presetSaveBtn);
    if (nextTab === 'background' && hasBackgroundTab) {
      activeTab = 'background';
    } else if (nextTab === 'board' && hasBoardTab) {
      activeTab = 'board';
    } else if (nextTab === 'board-frame' && hasBoardFrameTab) {
      activeTab = 'board-frame';
    } else if (nextTab === 'font' && hasFontTab) {
      activeTab = 'font';
    } else if (nextTab === 'stone' && hasStoneTab) {
      activeTab = 'stone';
    } else if (nextTab === 'preset' && hasPresetTab) {
      activeTab = 'preset';
    } else {
      activeTab = 'hand';
    }
    if (handSection) handSection.hidden = activeTab !== 'hand';
    if (backgroundSection) backgroundSection.hidden = activeTab !== 'background';
    if (boardSection) boardSection.hidden = activeTab !== 'board';
    if (boardFrameSection) boardFrameSection.hidden = activeTab !== 'board-frame';
    if (fontSection) fontSection.hidden = activeTab !== 'font';
    if (stoneSection) stoneSection.hidden = activeTab !== 'stone';
    if (presetSection) presetSection.hidden = activeTab !== 'preset';
    syncTabButtonState(handTabBtn, 'hand', true);
    syncTabButtonState(backgroundTabBtn, 'background', hasBackgroundTab);
    syncTabButtonState(boardTabBtn, 'board', hasBoardTab);
    syncTabButtonState(boardFrameTabBtn, 'board-frame', hasBoardFrameTab);
    syncTabButtonState(fontTabBtn, 'font', hasFontTab);
    syncTabButtonState(stoneTabBtn, 'stone', hasStoneTab);
    syncTabButtonState(presetTabBtn, 'preset', hasPresetTab);
    if (activeTab === 'preset') renderAppearancePresetList();
  }

  function openPanel(): void {
    refreshOptions(selectedSkin && selectedSkin.id);
    if (backgroundControllerApi && typeof backgroundControllerApi.refreshOptions === 'function') {
      backgroundControllerApi.refreshOptions();
    }
    if (boardControllerApi && typeof boardControllerApi.refreshOptions === 'function') {
      boardControllerApi.refreshOptions();
    }
    if (boardControllerApi && typeof boardControllerApi.refreshFrameOptions === 'function') {
      boardControllerApi.refreshFrameOptions();
    }
    if (fontControllerApi && typeof fontControllerApi.refreshOptions === 'function') {
      fontControllerApi.refreshOptions();
    }
    if (stoneControllerApi && typeof stoneControllerApi.refreshOptions === 'function') {
      stoneControllerApi.refreshOptions();
    }
    renderAppearancePresetList();
    setActiveTab(activeTab);
    isOpen = true;
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    button.setAttribute('aria-expanded', 'true');
  }

  function closePanel(): void {
    isOpen = false;
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    button.setAttribute('aria-expanded', 'false');
  }

  button.addEventListener('click', function (event: any) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    if (isOpen) {
      closePanel();
    } else {
      openPanel();
    }
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', function (event: any) {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      closePanel();
    });
  }

  if (handTabBtn) {
    handTabBtn.addEventListener('click', function (event: any) {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      setActiveTab('hand');
    });
  }

  if (backgroundTabBtn) {
    backgroundTabBtn.addEventListener('click', function (event: any) {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      setActiveTab('background');
    });
  }

  if (boardTabBtn) {
    boardTabBtn.addEventListener('click', function (event: any) {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      setActiveTab('board');
    });
  }

  if (boardFrameTabBtn) {
    boardFrameTabBtn.addEventListener('click', function (event: any) {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      setActiveTab('board-frame');
    });
  }

  if (fontTabBtn) {
    fontTabBtn.addEventListener('click', function (event: any) {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      setActiveTab('font');
    });
  }

  if (stoneTabBtn) {
    stoneTabBtn.addEventListener('click', function (event: any) {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      setActiveTab('stone');
    });
  }

  if (presetTabBtn) {
    presetTabBtn.addEventListener('click', function (event: any) {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      setActiveTab('preset');
    });
  }

  if (presetSaveBtn) {
    presetSaveBtn.addEventListener('click', function (event: any) {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      saveCurrentAppearancePreset();
    });
  }

  if (presetCodeLoadBtn) {
    presetCodeLoadBtn.addEventListener('click', function (event: any) {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      loadAppearancePresetCode().catch(function () {
        setAppearancePresetCodeStatus('コードを読み込めませんでした', 'error');
      });
    });
  }

  docRef.addEventListener('pointerdown', function (event: any) {
    if (!isOpen) return;
    const target = event ? event.target : null;
    if (!target) return;
    if (panel.contains(target) || button.contains(target)) return;
    closePanel();
  }, true);

  docRef.addEventListener('keydown', function (event: any) {
    if (!isOpen || !event || event.key !== 'Escape') return;
    closePanel();
  });

  const gachaEventsModule = resolveGachaEventsModule(rootRef);
  if (gachaEventsModule && typeof gachaEventsModule.addGachaInventoryUpdatedListener === 'function') {
    gachaEventsModule.addGachaInventoryUpdatedListener(rootRef, function () {
      refreshOptions(selectedSkin && selectedSkin.id);
    });
  } else if (rootRef && typeof rootRef.addEventListener === 'function') {
    rootRef.addEventListener('gacha:inventory-updated', function () {
      refreshOptions(selectedSkin && selectedSkin.id);
    });
  }

  if (rootRef && typeof rootRef.addEventListener === 'function') {
    rootRef.addEventListener(assetManifestUpdatedEventName, function () {
      refreshOptions(selectionModule.readStoredHandSkinId(rootRef));
    });
  }

  refreshOptions(selectionModule.readStoredHandSkinId(rootRef));
  setActiveTab('hand');
  closePanel();

  return {
    closePanel,
    openPanel,
    refreshOptions,
    getSelectedSkinId: function (): string {
      return selectedSkin ? selectedSkin.id : catalogModule.DEFAULT_HAND_SKIN_ID;
    },
    syncDisplayedSkin: function (): any {
      return runtimeModule.syncDisplayedHandSkin(
        rootRef,
        selectedSkin ? selectedSkin.id : catalogModule.DEFAULT_HAND_SKIN_ID,
        handImageEl
      );
    },
    selectSkin: function (skinId: any): any {
      return applySelection(skinId, true);
    },
    selectAppearanceTab: function (tabKey: string): string {
      setActiveTab(tabKey);
      return activeTab;
    },
    copyCurrentAppearanceCode,
    loadAppearancePresetCode,
    getHandAnimationPreferences: function (): { draw: boolean; place: boolean } {
      return syncHandAnimationFlags(rootRef);
    }
  };
}

const HandSkinControllerModule = {
  setupHandSkinControls
};

export = HandSkinControllerModule;
