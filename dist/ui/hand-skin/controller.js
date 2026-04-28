'use strict';
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
function resolveCatalogModule(rootRef) {
    const ctx = rootRef && typeof rootRef === 'object' ? rootRef : null;
    if (ctx && ctx.HandSkinCatalogModule)
        return ctx.HandSkinCatalogModule;
    try {
        if (typeof globalThis !== 'undefined' && globalThis.HandSkinCatalogModule) {
            return globalThis.HandSkinCatalogModule;
        }
    }
    catch (e) { /* ignore */ }
    if (typeof _require === 'function') {
        try {
            return _require('./catalog.js');
        }
        catch (e) { /* ignore */ }
    }
    return null;
}
function resolveSelectionModule(rootRef) {
    const ctx = rootRef && typeof rootRef === 'object' ? rootRef : null;
    if (ctx && ctx.HandSkinSelectionModule)
        return ctx.HandSkinSelectionModule;
    try {
        if (typeof globalThis !== 'undefined' && globalThis.HandSkinSelectionModule) {
            return globalThis.HandSkinSelectionModule;
        }
    }
    catch (e) { /* ignore */ }
    if (typeof _require === 'function') {
        try {
            return _require('./selection.js');
        }
        catch (e) { /* ignore */ }
    }
    return null;
}
function resolveRuntimeModule(rootRef) {
    const ctx = rootRef && typeof rootRef === 'object' ? rootRef : null;
    if (ctx && ctx.HandSkinRuntimeModule)
        return ctx.HandSkinRuntimeModule;
    try {
        if (typeof globalThis !== 'undefined' && globalThis.HandSkinRuntimeModule) {
            return globalThis.HandSkinRuntimeModule;
        }
    }
    catch (e) { /* ignore */ }
    if (typeof _require === 'function') {
        try {
            return _require('./runtime.js');
        }
        catch (e) { /* ignore */ }
    }
    return null;
}
function resolveBackgroundControllerModule(rootRef) {
    const ctx = rootRef && typeof rootRef === 'object' ? rootRef : null;
    if (ctx && ctx.BackgroundSkinControllerModule)
        return ctx.BackgroundSkinControllerModule;
    try {
        if (typeof globalThis !== 'undefined' && globalThis.BackgroundSkinControllerModule) {
            return globalThis.BackgroundSkinControllerModule;
        }
    }
    catch (e) { /* ignore */ }
    if (typeof _require === 'function') {
        try {
            return _require('../background-skin/controller.js');
        }
        catch (e) { /* ignore */ }
    }
    return null;
}
function resolveUIBootstrapModule(rootRef) {
    const ctx = rootRef && typeof rootRef === 'object' ? rootRef : null;
    if (ctx && ctx.UIBootstrap)
        return ctx.UIBootstrap;
    try {
        if (typeof globalThis !== 'undefined' && globalThis.UIBootstrap) {
            return globalThis.UIBootstrap;
        }
    }
    catch (e) { /* ignore */ }
    if (typeof _require === 'function') {
        try {
            return _require('../bootstrap.js');
        }
        catch (e) { /* ignore */ }
    }
    return null;
}
function resolveGachaEventsModule(rootRef) {
    const ctx = rootRef && typeof rootRef === 'object' ? rootRef : null;
    if (ctx && ctx.GachaEventsModule)
        return ctx.GachaEventsModule;
    try {
        if (typeof globalThis !== 'undefined' && globalThis.GachaEventsModule) {
            return globalThis.GachaEventsModule;
        }
    }
    catch (e) { /* ignore */ }
    if (typeof _require === 'function') {
        try {
            return _require('../gacha/gacha-events.js');
        }
        catch (e) { /* ignore */ }
    }
    return null;
}
function resolveDocument(rootRef) {
    const runtimeModule = resolveRuntimeModule(rootRef);
    if (runtimeModule && typeof runtimeModule.resolveDocument === 'function') {
        return runtimeModule.resolveDocument(rootRef);
    }
    if (rootRef && rootRef.document)
        return rootRef.document;
    if (typeof document !== 'undefined')
        return document;
    return null;
}
function createOptionButton(docRef, skin) {
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
function setupHandSkinControls(options) {
    const opts = (options && typeof options === 'object') ? options : {};
    const rootRef = opts.root || (typeof window !== 'undefined' ? window : null);
    const docRef = opts.document || resolveDocument(rootRef);
    const uiBootstrap = resolveUIBootstrapModule(rootRef);
    const assetManifestUpdatedEventName = (uiBootstrap && typeof uiBootstrap.ASSET_MANIFEST_UPDATED_EVENT === 'string' && uiBootstrap.ASSET_MANIFEST_UPDATED_EVENT) || 'asset-manifest:updated';
    const catalogModule = resolveCatalogModule(rootRef);
    const selectionModule = resolveSelectionModule(rootRef);
    const runtimeModule = resolveRuntimeModule(rootRef);
    const backgroundControllerModule = resolveBackgroundControllerModule(rootRef);
    if (!docRef || !catalogModule || !selectionModule || !runtimeModule)
        return null;
    const button = opts.button || docRef.getElementById('handSkinBtn');
    const panel = opts.panel || docRef.getElementById('handSkinPanel');
    const closeBtn = opts.closeBtn || docRef.getElementById('handSkinCloseBtn');
    const optionsEl = opts.optionsEl || docRef.getElementById('handSkinOptions');
    const handSection = opts.handSection || docRef.getElementById('handSkinSection');
    const backgroundSection = opts.backgroundSection || docRef.getElementById('backgroundSkinSection');
    const handTabBtn = opts.handTabBtn || docRef.getElementById('appearanceTabHand');
    const backgroundTabBtn = opts.backgroundTabBtn || docRef.getElementById('appearanceTabBackground');
    const handImageEl = opts.handImage || docRef.getElementById('handImage');
    if (!button || !panel || !optionsEl || !handImageEl)
        return null;
    let isOpen = false;
    let selectedSkin = null;
    let activeTab = 'hand';
    const backgroundControllerApi = backgroundControllerModule && typeof backgroundControllerModule.setupBackgroundSkinControls === 'function'
        ? backgroundControllerModule.setupBackgroundSkinControls({
            root: rootRef,
            document: docRef
        })
        : null;
    function syncButtonLabel() {
        const label = selectedSkin
            ? selectedSkin.label
            : catalogModule.getHandSkinDefinition(catalogModule.DEFAULT_HAND_SKIN_ID, rootRef).label;
        button.title = `見た目: 手 ${label}`;
        button.setAttribute('aria-label', `見た目設定（現在の手: ${label}）`);
    }
    function syncOptionState() {
        const optionButtons = Array.from(optionsEl.querySelectorAll('.hand-skin-option'));
        optionButtons.forEach((optionButton) => {
            const active = !!(selectedSkin && optionButton.getAttribute('data-hand-skin-id') === selectedSkin.id);
            optionButton.classList.toggle('is-selected', active);
            optionButton.setAttribute('aria-checked', active ? 'true' : 'false');
        });
    }
    function applySelection(skinId, persist) {
        const definition = catalogModule.getHandSkinDefinition(skinId, rootRef);
        if (!definition)
            return null;
        selectedSkin = definition;
        runtimeModule.syncDisplayedHandSkin(rootRef, definition.id, handImageEl);
        syncOptionState();
        syncButtonLabel();
        if (persist === true) {
            selectionModule.writeStoredHandSkinId(rootRef, definition.id);
            const networkClient = runtimeModule.resolveNetworkMatchClient(rootRef);
            if (runtimeModule.isNetworkMode(rootRef)
                && networkClient
                && typeof networkClient.updateHandSkin === 'function') {
                try {
                    const result = networkClient.updateHandSkin(definition.id);
                    if (result && typeof result.then === 'function') {
                        result.catch(function (error) {
                            if (typeof console !== 'undefined' && console.warn) {
                                console.warn('[hand-skin] failed to sync network hand skin', error);
                            }
                        });
                    }
                }
                catch (error) {
                    if (typeof console !== 'undefined' && console.warn) {
                        console.warn('[hand-skin] failed to sync network hand skin', error);
                    }
                }
            }
        }
        return definition;
    }
    function renderOptions() {
        optionsEl.innerHTML = '';
        catalogModule.getOwnedHandSkins(rootRef).forEach((skin) => {
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
        const nextSkinId = catalogModule.normalizeHandSkinId(preferredSkinId || (selectedSkin && selectedSkin.id) || selectionModule.readStoredHandSkinId(rootRef), rootRef);
        applySelection(nextSkinId, false);
    }
    function setActiveTab(nextTab) {
        const hasBackgroundTab = !!(backgroundControllerApi && backgroundSection && backgroundTabBtn);
        activeTab = hasBackgroundTab && nextTab === 'background' ? 'background' : 'hand';
        if (handSection)
            handSection.hidden = activeTab !== 'hand';
        if (backgroundSection)
            backgroundSection.hidden = activeTab !== 'background';
        if (handTabBtn) {
            const selected = activeTab === 'hand';
            handTabBtn.classList.toggle('is-active', selected);
            handTabBtn.setAttribute('aria-selected', selected ? 'true' : 'false');
        }
        if (backgroundTabBtn) {
            const selected = activeTab === 'background';
            backgroundTabBtn.hidden = !hasBackgroundTab;
            backgroundTabBtn.classList.toggle('is-active', selected);
            backgroundTabBtn.setAttribute('aria-selected', selected ? 'true' : 'false');
        }
    }
    function openPanel() {
        refreshOptions(selectedSkin && selectedSkin.id);
        if (backgroundControllerApi && typeof backgroundControllerApi.refreshOptions === 'function') {
            backgroundControllerApi.refreshOptions();
        }
        setActiveTab(activeTab);
        isOpen = true;
        panel.classList.add('is-open');
        panel.setAttribute('aria-hidden', 'false');
        button.setAttribute('aria-expanded', 'true');
    }
    function closePanel() {
        isOpen = false;
        panel.classList.remove('is-open');
        panel.setAttribute('aria-hidden', 'true');
        button.setAttribute('aria-expanded', 'false');
    }
    button.addEventListener('click', function (event) {
        if (event && typeof event.preventDefault === 'function')
            event.preventDefault();
        if (isOpen) {
            closePanel();
        }
        else {
            openPanel();
        }
    });
    if (closeBtn) {
        closeBtn.addEventListener('click', function (event) {
            if (event && typeof event.preventDefault === 'function')
                event.preventDefault();
            closePanel();
        });
    }
    if (handTabBtn) {
        handTabBtn.addEventListener('click', function (event) {
            if (event && typeof event.preventDefault === 'function')
                event.preventDefault();
            setActiveTab('hand');
        });
    }
    if (backgroundTabBtn) {
        backgroundTabBtn.addEventListener('click', function (event) {
            if (event && typeof event.preventDefault === 'function')
                event.preventDefault();
            setActiveTab('background');
        });
    }
    docRef.addEventListener('pointerdown', function (event) {
        if (!isOpen)
            return;
        const target = event ? event.target : null;
        if (!target)
            return;
        if (panel.contains(target) || button.contains(target))
            return;
        closePanel();
    }, true);
    docRef.addEventListener('keydown', function (event) {
        if (!isOpen || !event || event.key !== 'Escape')
            return;
        closePanel();
    });
    const gachaEventsModule = resolveGachaEventsModule(rootRef);
    if (gachaEventsModule && typeof gachaEventsModule.addGachaInventoryUpdatedListener === 'function') {
        gachaEventsModule.addGachaInventoryUpdatedListener(rootRef, function () {
            refreshOptions(selectedSkin && selectedSkin.id);
        });
    }
    else if (rootRef && typeof rootRef.addEventListener === 'function') {
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
        getSelectedSkinId: function () {
            return selectedSkin ? selectedSkin.id : catalogModule.DEFAULT_HAND_SKIN_ID;
        },
        syncDisplayedSkin: function () {
            return runtimeModule.syncDisplayedHandSkin(rootRef, selectedSkin ? selectedSkin.id : catalogModule.DEFAULT_HAND_SKIN_ID, handImageEl);
        },
        selectSkin: function (skinId) {
            return applySelection(skinId, true);
        },
        selectAppearanceTab: function (tabKey) {
            setActiveTab(tabKey);
            return activeTab;
        }
    };
}
const HandSkinControllerModule = {
    setupHandSkinControls
};
module.exports = HandSkinControllerModule;
//# sourceMappingURL=controller.js.map