'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface FontSkinDefinition {
  id: string;
  label: string;
  note?: string;
  fontFamily: string;
  previewText?: string;
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

function createOptionButton(docRef: Document, skin: FontSkinDefinition): HTMLButtonElement {
  const button = docRef.createElement('button');
  button.type = 'button';
  button.className = 'font-skin-option';
  button.setAttribute('role', 'radio');
  button.setAttribute('aria-checked', 'false');
  button.setAttribute('data-font-skin-id', skin.id);
  button.setAttribute('aria-label', 'フォント ' + skin.label);

  const preview = docRef.createElement('span');
  preview.className = 'font-skin-option-preview';
  preview.textContent = skin.previewText || 'Aa\nあア\n123';
  preview.style.fontFamily = skin.fontFamily;
  button.appendChild(preview);

  const copy = docRef.createElement('span');
  copy.className = 'font-skin-option-copy';
  const label = docRef.createElement('span');
  label.className = 'font-skin-option-label';
  label.textContent = skin.label;
  copy.appendChild(label);
  const note = docRef.createElement('span');
  note.className = 'font-skin-option-note';
  note.textContent = skin.note || '';
  copy.appendChild(note);
  button.appendChild(copy);
  return button;
}

interface ControllerApi {
  refreshOptions: (preferredSkinId?: string) => void;
  getSelectedSkinId: () => string;
  selectSkin: (skinId: string) => FontSkinDefinition | null;
}

function setupFontSkinControls(options?: any): ControllerApi | null {
  const opts = (options && typeof options === 'object') ? options : {};
  const rootRef = opts.root || (typeof window !== 'undefined' ? window : null);
  const docRef = opts.document || resolveDocument(rootRef);
  const catalogModule = resolveModule(rootRef, 'FontSkinCatalogModule', './catalog');
  const selectionModule = resolveModule(rootRef, 'FontSkinSelectionModule', './selection');
  const runtimeModule = resolveModule(rootRef, 'FontSkinRuntimeModule', './runtime');
  if (!docRef || !catalogModule || !selectionModule || !runtimeModule) return null;

  const optionsEl = opts.optionsEl || docRef.getElementById('fontSkinOptions');
  if (!optionsEl) return null;
  let selectedSkin: FontSkinDefinition | null = null;

  function syncOptionState() {
    Array.from(optionsEl.querySelectorAll('.font-skin-option')).forEach((optionButton: any) => {
      const active = !!(selectedSkin && optionButton.getAttribute('data-font-skin-id') === selectedSkin.id);
      optionButton.classList.toggle('is-selected', active);
      optionButton.setAttribute('aria-checked', active ? 'true' : 'false');
    });
  }

  function applySelection(skinId: string, persist: boolean): FontSkinDefinition | null {
    const definition = catalogModule.getFontSkinDefinition(skinId, rootRef);
    if (!definition) return null;
    selectedSkin = definition;
    runtimeModule.syncDisplayedFontSkin(rootRef, definition.id);
    syncOptionState();
    if (persist === true) selectionModule.writeStoredFontSkinId(rootRef, definition.id);
    return definition;
  }

  function renderOptions() {
    optionsEl.innerHTML = '';
    catalogModule.getOwnedFontSkins(rootRef).forEach((skin: FontSkinDefinition) => {
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
    const nextSkinId = catalogModule.normalizeFontSkinId(
      preferredSkinId || (selectedSkin && selectedSkin.id) || selectionModule.readStoredFontSkinId(rootRef),
      rootRef
    );
    applySelection(nextSkinId, false);
  }

  refreshOptions(selectionModule.readStoredFontSkinId(rootRef));

  return {
    refreshOptions,
    getSelectedSkinId: function () {
      return selectedSkin ? selectedSkin.id : catalogModule.DEFAULT_FONT_SKIN_ID;
    },
    selectSkin: function (skinId: string) {
      return applySelection(skinId, true);
    }
  };
}

const FontSkinController = {
  setupFontSkinControls
};

export = FontSkinController;
