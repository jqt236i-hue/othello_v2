'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface SkinDefinition {
  id: string;
  label: string;
  note?: string;
  imagePath: string;
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
  button.className = 'board-skin-option';
  button.setAttribute('role', 'radio');
  button.setAttribute('aria-checked', 'false');
  button.setAttribute('data-board-skin-id', skin.id);
  button.setAttribute('aria-label', '盤面デザイン ' + skin.label);

  const preview = docRef.createElement('img');
  preview.className = 'board-skin-option-preview';
  preview.src = skin.imagePath;
  preview.alt = '';
  preview.loading = 'lazy';
  preview.decoding = 'async';
  preview.draggable = false;
  button.appendChild(preview);

  const copy = docRef.createElement('span');
  copy.className = 'board-skin-option-copy';
  const label = docRef.createElement('span');
  label.className = 'board-skin-option-label';
  label.textContent = skin.label;
  copy.appendChild(label);
  const note = docRef.createElement('span');
  note.className = 'board-skin-option-note';
  note.textContent = skin.note || '';
  copy.appendChild(note);
  button.appendChild(copy);
  return button;
}

function createFrameOptionButton(docRef: Document, skin: SkinDefinition): HTMLButtonElement {
  const button = docRef.createElement('button');
  button.type = 'button';
  button.className = 'board-frame-skin-option';
  button.setAttribute('role', 'radio');
  button.setAttribute('aria-checked', 'false');
  button.setAttribute('data-board-frame-skin-id', skin.id);
  button.setAttribute('aria-label', '盤面フレーム ' + skin.label);

  const preview = docRef.createElement('img');
  preview.className = 'board-frame-skin-option-preview';
  preview.src = skin.imagePath;
  preview.alt = '';
  preview.loading = 'lazy';
  preview.decoding = 'async';
  preview.draggable = false;
  button.appendChild(preview);

  const copy = docRef.createElement('span');
  copy.className = 'board-frame-skin-option-copy';
  const label = docRef.createElement('span');
  label.className = 'board-frame-skin-option-label';
  label.textContent = skin.label;
  copy.appendChild(label);
  const note = docRef.createElement('span');
  note.className = 'board-frame-skin-option-note';
  note.textContent = skin.note || '';
  copy.appendChild(note);
  button.appendChild(copy);
  return button;
}

interface ControllerApi {
  refreshOptions: (preferredSkinId?: string) => void;
  refreshFrameOptions: (preferredSkinId?: string) => void;
  getSelectedSkinId: () => string;
  getSelectedFrameSkinId: () => string;
  useSkin: (skinId: string) => SkinDefinition | null;
  saveSkin: (skinId: string) => SkinDefinition | null;
  selectSkin: (skinId: string) => SkinDefinition | null;
  selectFrameSkin: (skinId: string) => SkinDefinition | null;
}

function setupBoardSkinControls(options?: any): ControllerApi | null {
  const opts = (options && typeof options === 'object') ? options : {};
  const rootRef = opts.root || (typeof window !== 'undefined' ? window : null);
  const docRef = opts.document || resolveDocument(rootRef);
  const catalogModule = resolveModule(rootRef, 'BoardSkinCatalogModule', './catalog');
  const selectionModule = resolveModule(rootRef, 'BoardSkinSelectionModule', './selection');
  const runtimeModule = resolveModule(rootRef, 'BoardSkinRuntimeModule', './runtime');
  const customSkinStorageModule = resolveModule(rootRef, 'CustomSkinStorageModule', '../custom-skin/storage');
  const customSkinControllerModule = resolveModule(rootRef, 'CustomSkinControllerModule', '../custom-skin/controller');
  if (!docRef || !catalogModule || !selectionModule || !runtimeModule) return null;

  const optionsEl = opts.optionsEl || docRef.getElementById('boardSkinOptions');
  const frameOptionsEl = opts.frameOptionsEl || docRef.getElementById('boardFrameSkinOptions');
  if (!optionsEl) return null;
  let selectedSkin: SkinDefinition | null = null;
  let selectedFrameSkin: SkinDefinition | null = null;
  let customSkinUploader: any = null;

  function syncOptionState() {
    Array.from(optionsEl.querySelectorAll('.board-skin-option')).forEach((optionButton: any) => {
      const active = !!(selectedSkin && optionButton.getAttribute('data-board-skin-id') === selectedSkin.id);
      optionButton.classList.toggle('is-selected', active);
      optionButton.setAttribute('aria-checked', active ? 'true' : 'false');
    });
  }

  function syncFrameOptionState() {
    if (!frameOptionsEl) return;
    Array.from(frameOptionsEl.querySelectorAll('.board-frame-skin-option')).forEach((optionButton: any) => {
      const active = !!(selectedFrameSkin && optionButton.getAttribute('data-board-frame-skin-id') === selectedFrameSkin.id);
      optionButton.classList.toggle('is-selected', active);
      optionButton.setAttribute('aria-checked', active ? 'true' : 'false');
    });
  }

  function applySelection(skinId: string, persist: boolean): SkinDefinition | null {
    const definition = catalogModule.getBoardSkinDefinition(skinId, rootRef);
    if (!definition) return null;
    selectedSkin = definition;
    runtimeModule.syncDisplayedBoardSkin(rootRef, definition.id);
    syncOptionState();
    if (customSkinUploader && typeof customSkinUploader.refreshSelectedState === 'function') {
      customSkinUploader.refreshSelectedState();
    }
    if (persist === true) selectionModule.writeStoredBoardSkinId(rootRef, definition.id);
    return definition;
  }

  function applyFrameSelection(skinId: string, persist: boolean): SkinDefinition | null {
    if (typeof catalogModule.getBoardFrameSkinDefinition !== 'function') return null;
    const definition = catalogModule.getBoardFrameSkinDefinition(skinId, rootRef);
    if (!definition) return null;
    selectedFrameSkin = definition;
    if (typeof runtimeModule.syncDisplayedBoardFrameSkin === 'function') {
      runtimeModule.syncDisplayedBoardFrameSkin(rootRef, definition.id);
    }
    syncFrameOptionState();
    if (persist === true && typeof selectionModule.writeStoredBoardFrameSkinId === 'function') {
      selectionModule.writeStoredBoardFrameSkinId(rootRef, definition.id);
    }
    return definition;
  }

  function renderOptions() {
    optionsEl.innerHTML = '';
    catalogModule.getOwnedBoardSkins(rootRef).forEach((skin: SkinDefinition) => {
      const optionButton = createOptionButton(docRef, skin);
      optionButton.addEventListener('click', function (event: Event) {
        if (event && typeof (event as any).preventDefault === 'function') (event as any).preventDefault();
        applySelection(skin.id, true);
      });
      optionsEl.appendChild(optionButton);
    });
  }

  function renderFrameOptions() {
    if (!frameOptionsEl || typeof catalogModule.getOwnedBoardFrameSkins !== 'function') return;
    frameOptionsEl.innerHTML = '';
    catalogModule.getOwnedBoardFrameSkins(rootRef).forEach((skin: SkinDefinition) => {
      const optionButton = createFrameOptionButton(docRef, skin);
      optionButton.addEventListener('click', function (event: Event) {
        if (event && typeof (event as any).preventDefault === 'function') (event as any).preventDefault();
        applyFrameSelection(skin.id, true);
      });
      frameOptionsEl.appendChild(optionButton);
    });
  }

  function refreshOptions(preferredSkinId?: string) {
    renderOptions();
    const nextSkinId = catalogModule.normalizeBoardSkinId(
      preferredSkinId || (selectedSkin && selectedSkin.id) || selectionModule.readStoredBoardSkinId(rootRef),
      rootRef
    );
    applySelection(nextSkinId, false);
  }

  function refreshFrameOptions(preferredSkinId?: string) {
    if (typeof catalogModule.normalizeBoardFrameSkinId !== 'function' || typeof selectionModule.readStoredBoardFrameSkinId !== 'function') return;
    renderFrameOptions();
    const nextSkinId = catalogModule.normalizeBoardFrameSkinId(
      preferredSkinId || (selectedFrameSkin && selectedFrameSkin.id) || selectionModule.readStoredBoardFrameSkinId(rootRef),
      rootRef
    );
    applyFrameSelection(nextSkinId, false);
  }

  if (customSkinControllerModule && typeof customSkinControllerModule.setupCustomSkinUploader === 'function') {
    customSkinUploader = customSkinControllerModule.setupCustomSkinUploader({
      root: rootRef,
      document: docRef,
      host: optionsEl,
      kind: 'board',
      getSelectedSkinId: () => selectedSkin ? selectedSkin.id : catalogModule.DEFAULT_BOARD_SKIN_ID,
      useSkin: (skinId: string) => applySelection(skinId, false),
      onSaved: (definition: SkinDefinition) => {
        refreshOptions(definition.id);
        selectionModule.writeStoredBoardSkinId(rootRef, definition.id);
      },
      onDeleted: () => {
        refreshOptions();
        selectionModule.writeStoredBoardSkinId(rootRef, selectedSkin ? selectedSkin.id : catalogModule.DEFAULT_BOARD_SKIN_ID);
      }
    });
  }

  if (customSkinStorageModule && typeof customSkinStorageModule.subscribeCustomSkins === 'function') {
    customSkinStorageModule.subscribeCustomSkins(rootRef, () => {
      refreshOptions(selectedSkin ? selectedSkin.id : undefined);
    });
  }

  refreshOptions(selectionModule.readStoredBoardSkinId(rootRef));
  refreshFrameOptions(
    typeof selectionModule.readStoredBoardFrameSkinId === 'function'
      ? selectionModule.readStoredBoardFrameSkinId(rootRef)
      : undefined
  );
  if (customSkinStorageModule && typeof customSkinStorageModule.loadCustomSkins === 'function') {
    customSkinStorageModule.loadCustomSkins(rootRef).then(() => {
      refreshOptions(selectionModule.readStoredBoardSkinId(rootRef));
    }).catch((error: any) => {
      if (customSkinUploader && typeof customSkinUploader.setStatus === 'function') {
        customSkinUploader.setStatus(String(error && error.message || '個人保存を読み込めませんでした'), true);
      }
    });
  }

  return {
    refreshOptions,
    refreshFrameOptions,
    getSelectedSkinId: function () {
      return selectedSkin ? selectedSkin.id : catalogModule.DEFAULT_BOARD_SKIN_ID;
    },
    getSelectedFrameSkinId: function () {
      return selectedFrameSkin ? selectedFrameSkin.id : catalogModule.DEFAULT_BOARD_FRAME_SKIN_ID;
    },
    useSkin: function (skinId: string) {
      return applySelection(skinId, false);
    },
    saveSkin: function (skinId: string) {
      return applySelection(skinId, true);
    },
    selectSkin: function (skinId: string) {
      return applySelection(skinId, true);
    },
    selectFrameSkin: function (skinId: string) {
      return applyFrameSelection(skinId, true);
    }
  };
}

const BoardSkinController = {
  setupBoardSkinControls
};

export = BoardSkinController;
