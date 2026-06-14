'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface StoneSkinDefinition {
  id: string;
  label: string;
  note?: string;
  blackImagePath: string;
  whiteImagePath: string;
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

function createStonePreviewImage(docRef: Document, className: string, imagePath: string): HTMLImageElement {
  const image = docRef.createElement('img');
  image.className = className;
  image.src = imagePath;
  image.alt = '';
  image.loading = 'lazy';
  image.decoding = 'async';
  image.draggable = false;
  return image;
}

function createOptionButton(docRef: Document, skin: StoneSkinDefinition): HTMLButtonElement {
  const button = docRef.createElement('button');
  button.type = 'button';
  button.className = 'stone-skin-option';
  button.setAttribute('role', 'radio');
  button.setAttribute('aria-checked', 'false');
  button.setAttribute('data-stone-skin-id', skin.id);
  button.setAttribute('aria-label', '石 ' + skin.label);

  const preview = docRef.createElement('span');
  preview.className = 'stone-skin-option-preview';
  preview.appendChild(createStonePreviewImage(docRef, 'stone-skin-option-stone stone-skin-option-stone--black', skin.blackImagePath));
  preview.appendChild(createStonePreviewImage(docRef, 'stone-skin-option-stone stone-skin-option-stone--white', skin.whiteImagePath));
  button.appendChild(preview);

  const copy = docRef.createElement('span');
  copy.className = 'stone-skin-option-copy';
  const label = docRef.createElement('span');
  label.className = 'stone-skin-option-label';
  label.textContent = skin.label;
  copy.appendChild(label);
  const note = docRef.createElement('span');
  note.className = 'stone-skin-option-note';
  note.textContent = skin.note || '';
  copy.appendChild(note);
  button.appendChild(copy);
  return button;
}

interface ControllerApi {
  refreshOptions: (preferredSkinId?: string) => void;
  getSelectedSkinId: () => string;
  selectSkin: (skinId: string) => StoneSkinDefinition | null;
}

function setupStoneSkinControls(options?: any): ControllerApi | null {
  const opts = (options && typeof options === 'object') ? options : {};
  const rootRef = opts.root || (typeof window !== 'undefined' ? window : null);
  const docRef = opts.document || resolveDocument(rootRef);
  const catalogModule = resolveModule(rootRef, 'StoneSkinCatalogModule', './catalog');
  const selectionModule = resolveModule(rootRef, 'StoneSkinSelectionModule', './selection');
  const runtimeModule = resolveModule(rootRef, 'StoneSkinRuntimeModule', './runtime');
  if (!docRef || !catalogModule || !selectionModule || !runtimeModule) return null;

  const optionsEl = opts.optionsEl || docRef.getElementById('stoneSkinOptions');
  if (!optionsEl) return null;
  let selectedSkin: StoneSkinDefinition | null = null;

  function syncOptionState() {
    Array.from(optionsEl.querySelectorAll('.stone-skin-option')).forEach((optionButton: any) => {
      const active = !!(selectedSkin && optionButton.getAttribute('data-stone-skin-id') === selectedSkin.id);
      optionButton.classList.toggle('is-selected', active);
      optionButton.setAttribute('aria-checked', active ? 'true' : 'false');
    });
  }

  function applySelection(skinId: string, persist: boolean): StoneSkinDefinition | null {
    const definition = catalogModule.getStoneSkinDefinition(skinId, rootRef);
    if (!definition) return null;
    selectedSkin = definition;
    runtimeModule.syncDisplayedStoneSkin(rootRef, definition.id);
    syncOptionState();
    if (persist === true) selectionModule.writeStoredStoneSkinId(rootRef, definition.id);
    return definition;
  }

  function renderOptions() {
    optionsEl.innerHTML = '';
    catalogModule.getOwnedStoneSkins(rootRef).forEach((skin: StoneSkinDefinition) => {
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
    const nextSkinId = catalogModule.normalizeStoneSkinId(
      preferredSkinId || (selectedSkin && selectedSkin.id) || selectionModule.readStoredStoneSkinId(rootRef),
      rootRef
    );
    applySelection(nextSkinId, false);
  }

  refreshOptions(selectionModule.readStoredStoneSkinId(rootRef));

  return {
    refreshOptions,
    getSelectedSkinId: function () {
      return selectedSkin ? selectedSkin.id : catalogModule.DEFAULT_STONE_SKIN_ID;
    },
    selectSkin: function (skinId: string) {
      return applySelection(skinId, true);
    }
  };
}

const StoneSkinController = {
  setupStoneSkinControls
};

export = StoneSkinController;
