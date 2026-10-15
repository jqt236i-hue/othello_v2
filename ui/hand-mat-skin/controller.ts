'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;
const _require: NodeRequire = typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__ : require;
type CatalogModule = typeof import('./catalog');
type HandMatSkinDefinition = ReturnType<CatalogModule['getHandMatSkinDefinition']>;

function resolveModule(rootRef: any, key: string, requirePath: string): any {
  if (rootRef && rootRef[key]) return rootRef[key];
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any)[key]) return (globalThis as any)[key];
  } catch (e) { /* ignore */ }
  try { return _require(requirePath); } catch (e) { return null; }
}

function createOptionButton(docRef: Document, skin: HandMatSkinDefinition): HTMLButtonElement {
  const button = docRef.createElement('button');
  button.type = 'button';
  button.className = 'hand-mat-skin-option';
  button.setAttribute('role', 'radio');
  button.setAttribute('aria-checked', 'false');
  button.setAttribute('data-hand-mat-skin-id', skin.id);
  button.setAttribute('aria-label', '手札置き ' + skin.label);

  const preview = docRef.createElement('img');
  preview.className = 'hand-mat-skin-option-preview';
  preview.src = skin.imagePath;
  preview.alt = '';
  preview.loading = 'lazy';
  preview.decoding = 'async';
  preview.draggable = false;
  button.appendChild(preview);
  const label = docRef.createElement('span');
  label.className = 'hand-mat-skin-option-label';
  label.textContent = skin.label;
  button.appendChild(label);
  return button;
}

interface ControllerApi {
  refreshOptions: (preferredSkinId?: unknown) => void;
  getSelectedSkinId: () => string;
  selectSkin: (skinId: unknown) => HandMatSkinDefinition | null;
}

function setupHandMatSkinControls(options?: any): ControllerApi | null {
  const opts = options && typeof options === 'object' ? options : {};
  const rootRef = opts.root || (typeof window !== 'undefined' ? window : null);
  const docRef: Document | null = opts.document || (rootRef && rootRef.document) || (typeof document !== 'undefined' ? document : null);
  const catalog: CatalogModule | null = resolveModule(rootRef, 'HandMatSkinCatalogModule', './catalog');
  const selection: typeof import('./selection') | null = resolveModule(rootRef, 'HandMatSkinSelectionModule', './selection');
  const runtime: typeof import('./runtime') | null = resolveModule(rootRef, 'HandMatSkinRuntimeModule', './runtime');
  if (!docRef || !catalog || !selection || !runtime) return null;
  const optionsEl: HTMLElement | null = opts.optionsEl || docRef.getElementById('handMatSkinOptions');
  if (!optionsEl) return null;
  let selectedSkin: HandMatSkinDefinition | null = null;

  function applySelection(skinId: unknown, persist: boolean): HandMatSkinDefinition | null {
    const definition = catalog!.getHandMatSkinDefinition(skinId, rootRef);
    if (!definition) return null;
    selectedSkin = definition;
    runtime!.syncDisplayedHandMatSkin(rootRef, definition.id);
    optionsEl!.querySelectorAll('.hand-mat-skin-option').forEach((button) => {
      const active = button.getAttribute('data-hand-mat-skin-id') === definition.id;
      button.classList.toggle('is-selected', active);
      button.setAttribute('aria-checked', active ? 'true' : 'false');
    });
    if (persist) selection!.writeStoredHandMatSkinId(rootRef, definition.id);
    return definition;
  }

  function refreshOptions(preferredSkinId?: unknown) {
    optionsEl!.innerHTML = '';
    catalog!.getAllHandMatSkins(rootRef).forEach((skin) => {
      const button = createOptionButton(docRef!, skin);
      button.addEventListener('click', (event) => {
        event.preventDefault();
        applySelection(skin.id, true);
      });
      optionsEl!.appendChild(button);
    });
    const nextSkinId = preferredSkinId !== undefined ? preferredSkinId
      : selectedSkin ? selectedSkin.id : selection!.readStoredHandMatSkinId(rootRef);
    applySelection(nextSkinId, false);
  }

  refreshOptions(selection.readStoredHandMatSkinId(rootRef));
  return {
    refreshOptions,
    getSelectedSkinId: () => selectedSkin ? selectedSkin.id : catalog.DEFAULT_HAND_MAT_SKIN_ID,
    selectSkin: (skinId) => applySelection(skinId, true)
  };
}

export = { setupHandMatSkinControls };
