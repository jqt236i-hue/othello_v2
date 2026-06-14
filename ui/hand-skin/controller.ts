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
  if (typeof _require === 'function') {
    try {
      return _require('../bootstrap.js');
    } catch (e) { /* ignore */ }
  }
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
  const fontControllerModule = resolveFontControllerModule(rootRef);
  const stoneControllerModule = resolveStoneControllerModule(rootRef);
  if (!docRef || !catalogModule || !selectionModule || !runtimeModule) return null;

  const button = opts.button || docRef.getElementById('handSkinBtn');
  const panel = opts.panel || docRef.getElementById('handSkinPanel');
  const closeBtn = opts.closeBtn || docRef.getElementById('handSkinCloseBtn');
  const optionsEl = opts.optionsEl || docRef.getElementById('handSkinOptions');
  const handSection = opts.handSection || docRef.getElementById('handSkinSection');
  const backgroundSection = opts.backgroundSection || docRef.getElementById('backgroundSkinSection');
  const fontSection = opts.fontSection || docRef.getElementById('fontSkinSection');
  const stoneSection = opts.stoneSection || docRef.getElementById('stoneSkinSection');
  const handTabBtn = opts.handTabBtn || docRef.getElementById('appearanceTabHand');
  const backgroundTabBtn = opts.backgroundTabBtn || docRef.getElementById('appearanceTabBackground');
  const fontTabBtn = opts.fontTabBtn || docRef.getElementById('appearanceTabFont');
  const stoneTabBtn = opts.stoneTabBtn || docRef.getElementById('appearanceTabStone');
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
    const hasFontTab = !!(fontControllerApi && fontSection && fontTabBtn);
    const hasStoneTab = !!(stoneControllerApi && stoneSection && stoneTabBtn);
    if (nextTab === 'background' && hasBackgroundTab) {
      activeTab = 'background';
    } else if (nextTab === 'font' && hasFontTab) {
      activeTab = 'font';
    } else if (nextTab === 'stone' && hasStoneTab) {
      activeTab = 'stone';
    } else {
      activeTab = 'hand';
    }
    if (handSection) handSection.hidden = activeTab !== 'hand';
    if (backgroundSection) backgroundSection.hidden = activeTab !== 'background';
    if (fontSection) fontSection.hidden = activeTab !== 'font';
    if (stoneSection) stoneSection.hidden = activeTab !== 'stone';
    syncTabButtonState(handTabBtn, 'hand', true);
    syncTabButtonState(backgroundTabBtn, 'background', hasBackgroundTab);
    syncTabButtonState(fontTabBtn, 'font', hasFontTab);
    syncTabButtonState(stoneTabBtn, 'stone', hasStoneTab);
  }

  function openPanel(): void {
    refreshOptions(selectedSkin && selectedSkin.id);
    if (backgroundControllerApi && typeof backgroundControllerApi.refreshOptions === 'function') {
      backgroundControllerApi.refreshOptions();
    }
    if (fontControllerApi && typeof fontControllerApi.refreshOptions === 'function') {
      fontControllerApi.refreshOptions();
    }
    if (stoneControllerApi && typeof stoneControllerApi.refreshOptions === 'function') {
      stoneControllerApi.refreshOptions();
    }
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
    getHandAnimationPreferences: function (): { draw: boolean; place: boolean } {
      return syncHandAnimationFlags(rootRef);
    }
  };
}

const HandSkinControllerModule = {
  setupHandSkinControls
};

export = HandSkinControllerModule;
