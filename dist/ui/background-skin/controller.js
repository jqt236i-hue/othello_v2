'use strict';
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
function resolveModule(rootRef, key, requirePath) {
    const ctx = rootRef && typeof rootRef === 'object' ? rootRef : null;
    if (ctx && ctx[key])
        return ctx[key];
    try {
        if (typeof globalThis !== 'undefined' && globalThis[key])
            return globalThis[key];
    }
    catch (e) { /* ignore */ }
    try {
        return _require(requirePath);
    }
    catch (e) { /* ignore */ }
    return null;
}
function resolveDocument(rootRef) {
    if (rootRef && rootRef.document)
        return rootRef.document;
    if (typeof document !== 'undefined')
        return document;
    return null;
}
function createOptionButton(docRef, skin) {
    const button = docRef.createElement('button');
    button.type = 'button';
    button.className = 'background-skin-option';
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', 'false');
    button.setAttribute('data-background-skin-id', skin.id);
    button.setAttribute('aria-label', '背景 ' + skin.label);
    const preview = docRef.createElement(skin.imagePath ? 'img' : 'span');
    preview.className = 'background-skin-option-preview';
    if (skin.imagePath) {
        preview.src = skin.imagePath;
        preview.alt = '';
        preview.loading = 'lazy';
        preview.decoding = 'async';
        preview.draggable = false;
    }
    else if (skin.cssBackground) {
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
function setupBackgroundSkinControls(options) {
    const opts = (options && typeof options === 'object') ? options : {};
    const rootRef = opts.root || (typeof window !== 'undefined' ? window : null);
    const docRef = opts.document || resolveDocument(rootRef);
    const catalogModule = resolveModule(rootRef, 'BackgroundSkinCatalogModule', './catalog.js');
    const selectionModule = resolveModule(rootRef, 'BackgroundSkinSelectionModule', './selection.js');
    const runtimeModule = resolveModule(rootRef, 'BackgroundSkinRuntimeModule', './runtime.js');
    if (!docRef || !catalogModule || !selectionModule || !runtimeModule)
        return null;
    const optionsEl = opts.optionsEl || docRef.getElementById('backgroundSkinOptions');
    if (!optionsEl)
        return null;
    let selectedSkin = null;
    function syncOptionState() {
        Array.from(optionsEl.querySelectorAll('.background-skin-option')).forEach((optionButton) => {
            const active = !!(selectedSkin && optionButton.getAttribute('data-background-skin-id') === selectedSkin.id);
            optionButton.classList.toggle('is-selected', active);
            optionButton.setAttribute('aria-checked', active ? 'true' : 'false');
        });
    }
    function applySelection(skinId, persist) {
        const definition = catalogModule.getBackgroundSkinDefinition(skinId, rootRef);
        if (!definition)
            return null;
        selectedSkin = definition;
        runtimeModule.syncDisplayedBackgroundSkin(rootRef, definition.id);
        syncOptionState();
        if (persist === true)
            selectionModule.writeStoredBackgroundSkinId(rootRef, definition.id);
        return definition;
    }
    function renderOptions() {
        optionsEl.innerHTML = '';
        catalogModule.getOwnedBackgroundSkins(rootRef).forEach((skin) => {
            const optionButton = createOptionButton(docRef, skin);
            optionButton.addEventListener('click', function (event) {
                if (event && typeof event.preventDefault === 'function')
                    event.preventDefault();
                applySelection(skin.id, true);
            });
            optionsEl.appendChild(optionButton);
        });
    }
    function refreshOptions(preferredSkinId) {
        renderOptions();
        const nextSkinId = catalogModule.normalizeBackgroundSkinId(preferredSkinId || (selectedSkin && selectedSkin.id) || selectionModule.readStoredBackgroundSkinId(rootRef), rootRef);
        applySelection(nextSkinId, false);
    }
    refreshOptions(selectionModule.readStoredBackgroundSkinId(rootRef));
    return {
        refreshOptions,
        getSelectedSkinId: function () {
            return selectedSkin ? selectedSkin.id : catalogModule.DEFAULT_BACKGROUND_SKIN_ID;
        },
        selectSkin: function (skinId) {
            return applySelection(skinId, true);
        }
    };
}
const BackgroundSkinController = {
    setupBackgroundSkinControls
};
module.exports = BackgroundSkinController;
//# sourceMappingURL=controller.js.map