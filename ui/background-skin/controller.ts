'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface SkinDefinition {
  id: string;
  label: string;
  note?: string;
  imagePath?: string;
  cssBackground?: string;
  [key: string]: any;
}

function resolveModule(rootRef: any, key: string, requirePath: string): any {
  const ctx = rootRef && typeof rootRef === 'object' ? rootRef : null;
  if (ctx && ctx[key]) return ctx[key];
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any)[key]) return (globalThis as any)[key];
  } catch (e) { /* ignore */ }
  try {
    return _require(requirePath);
  } catch (e) { /* ignore */ }
  return null;
}

function resolveDocument(rootRef: any): Document | null {
  if (rootRef && rootRef.document) return rootRef.document;
  if (typeof document !== 'undefined') return document;
  return null;
}

function createOptionButton(docRef: Document, skin: SkinDefinition): HTMLButtonElement {
  const button = docRef.createElement('button');
  button.type = 'button';
  button.className = 'background-skin-option';
  button.setAttribute('role', 'radio');
  button.setAttribute('aria-checked', 'false');
  button.setAttribute('data-background-skin-id', skin.id);
  button.setAttribute('aria-label', '背景 ' + skin.label);

  const preview = docRef.createElement(skin.imagePath ? 'img' : 'span') as HTMLElement;
  preview.className = 'background-skin-option-preview';
  if (skin.imagePath) {
    (preview as HTMLImageElement).src = skin.imagePath;
    (preview as HTMLImageElement).alt = '';
    (preview as HTMLImageElement).loading = 'lazy';
    (preview as HTMLImageElement).decoding = 'async';
    (preview as HTMLImageElement).draggable = false;
  } else if (skin.cssBackground) {
    preview.style.backgroundImage = skin.cssBackground;
  }
  button.appendChild(preview);

  const copy = docRef.createElement('span');
  copy.className = 'background-skin-option-copy';
  const label = docRef.createElement('span');
  label.className = 'background-skin-option-label';
  label.textContent = skin.label;
  copy.appendChild(label);
  const note = docRef.createElement('span');
  note.className = 'background-skin-option-note';
  note.textContent = skin.note || '';
  copy.appendChild(note);
  button.appendChild(copy);
  return button;
}

interface ControllerApi {
  refreshOptions: (preferredSkinId?: string) => void;
  getSelectedSkinId: () => string;
  useSkin: (skinId: string) => SkinDefinition | null;
  saveSkin: (skinId: string) => SkinDefinition | null;
  selectSkin: (skinId: string) => SkinDefinition | null;
}

function setupBackgroundSkinControls(options?: any): ControllerApi | null {
  const opts = (options && typeof options === 'object') ? options : {};
  const rootRef = opts.root || (typeof window !== 'undefined' ? window : null);
  const docRef = opts.document || resolveDocument(rootRef);
  const catalogModule = resolveModule(rootRef, 'BackgroundSkinCatalogModule', './catalog');
  const selectionModule = resolveModule(rootRef, 'BackgroundSkinSelectionModule', './selection');
  const runtimeModule = resolveModule(rootRef, 'BackgroundSkinRuntimeModule', './runtime');
  const customSkinStorageModule = resolveModule(rootRef, 'CustomSkinStorageModule', '../custom-skin/storage');
  const customSkinControllerModule = resolveModule(rootRef, 'CustomSkinControllerModule', '../custom-skin/controller');
  if (!docRef || !catalogModule || !selectionModule || !runtimeModule) return null;

  const optionsEl = opts.optionsEl || docRef.getElementById('backgroundSkinOptions');
  if (!optionsEl) return null;
  let selectedSkin: SkinDefinition | null = null;
  let customSkinUploader: any = null;

  function syncOptionState() {
    Array.from(optionsEl.querySelectorAll('.background-skin-option')).forEach((optionButton: any) => {
      const active = !!(selectedSkin && optionButton.getAttribute('data-background-skin-id') === selectedSkin.id);
      optionButton.classList.toggle('is-selected', active);
      optionButton.setAttribute('aria-checked', active ? 'true' : 'false');
    });
  }

  function applySelection(skinId: string, persist: boolean): SkinDefinition | null {
    const definition = catalogModule.getBackgroundSkinDefinition(skinId, rootRef);
    if (!definition) return null;
    selectedSkin = definition;
    runtimeModule.syncDisplayedBackgroundSkin(rootRef, definition.id);
    syncOptionState();
    if (customSkinUploader && typeof customSkinUploader.refreshSelectedState === 'function') {
      customSkinUploader.refreshSelectedState();
    }
    if (persist === true) selectionModule.writeStoredBackgroundSkinId(rootRef, definition.id);
    return definition;
  }

  function renderOptions() {
    optionsEl.innerHTML = '';
    catalogModule.getOwnedBackgroundSkins(rootRef).forEach((skin: SkinDefinition) => {
      const optionButton = createOptionButton(docRef, skin);
      optionButton.addEventListener('click', function (event: Event) {
        if (event && typeof (event as any).preventDefault === 'function') (event as any).preventDefault();
        applySelection(skin.id, true);
      });
      optionsEl.appendChild(optionButton);
    });
  }

  function refreshOptions(preferredSkinId?: string) {
    renderOptions();
    const nextSkinId = catalogModule.normalizeBackgroundSkinId(
      preferredSkinId || (selectedSkin && selectedSkin.id) || selectionModule.readStoredBackgroundSkinId(rootRef),
      rootRef
    );
    applySelection(nextSkinId, false);
  }

  if (customSkinControllerModule && typeof customSkinControllerModule.setupCustomSkinUploader === 'function') {
    customSkinUploader = customSkinControllerModule.setupCustomSkinUploader({
      root: rootRef,
      document: docRef,
      host: optionsEl,
      kind: 'background',
      getSelectedSkinId: () => selectedSkin ? selectedSkin.id : catalogModule.DEFAULT_BACKGROUND_SKIN_ID,
      onSaved: (definition: SkinDefinition) => {
        refreshOptions(definition.id);
        selectionModule.writeStoredBackgroundSkinId(rootRef, definition.id);
      },
      onDeleted: () => {
        refreshOptions();
        selectionModule.writeStoredBackgroundSkinId(rootRef, selectedSkin ? selectedSkin.id : catalogModule.DEFAULT_BACKGROUND_SKIN_ID);
      }
    });
  }

  if (customSkinStorageModule && typeof customSkinStorageModule.subscribeCustomSkins === 'function') {
    customSkinStorageModule.subscribeCustomSkins(rootRef, () => {
      refreshOptions(selectedSkin ? selectedSkin.id : undefined);
    });
  }

  refreshOptions(selectionModule.readStoredBackgroundSkinId(rootRef));
  if (customSkinStorageModule && typeof customSkinStorageModule.loadCustomSkins === 'function') {
    customSkinStorageModule.loadCustomSkins(rootRef).then(() => {
      refreshOptions(selectionModule.readStoredBackgroundSkinId(rootRef));
    }).catch((error: any) => {
      if (customSkinUploader && typeof customSkinUploader.setStatus === 'function') {
        customSkinUploader.setStatus(String(error && error.message || '個人保存を読み込めませんでした'), true);
      }
    });
  }

  return {
    refreshOptions,
    getSelectedSkinId: function () {
      return selectedSkin ? selectedSkin.id : catalogModule.DEFAULT_BACKGROUND_SKIN_ID;
    },
    useSkin: function (skinId: string) {
      return applySelection(skinId, false);
    },
    saveSkin: function (skinId: string) {
      return applySelection(skinId, true);
    },
    selectSkin: function (skinId: string) {
      return applySelection(skinId, true);
    }
  };
}

const BackgroundSkinController = {
  setupBackgroundSkinControls
};

export = BackgroundSkinController;
