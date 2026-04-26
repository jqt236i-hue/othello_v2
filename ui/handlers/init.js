/**
 * @file init.js
 * @description UI event handler initialization
 */

const InitBootstrapShared = (() => {
    if (typeof require === 'function') {
        try { return require('../../shared/ui-bootstrap-shared'); } catch (e) { /* ignore */ }
    }
    try {
        if (typeof globalThis !== 'undefined' && globalThis.SharedUIBootstrap) return globalThis.SharedUIBootstrap;
    } catch (e) { /* ignore */ }
    return null;
})();

function _getUiBootstrapModule() {
    if (InitBootstrapShared && typeof InitBootstrapShared.resolveUIBootstrap === 'function') {
        return InitBootstrapShared.resolveUIBootstrap();
    }
    return (typeof UIBootstrap !== 'undefined' && UIBootstrap && typeof UIBootstrap.installGameDI === 'function')
        ? UIBootstrap
        : null;
}

function setUiInitializedFlag(value) {
    try {
        const ready = value === true;
        if (typeof globalThis !== 'undefined') globalThis.__uiInitialized = ready;
        if (typeof window !== 'undefined') window.__uiInitialized = ready;
    } catch (e) { /* ignore */ }
}

async function initializeUI() {
    setUiInitializedFlag(false);
    try {
        const uiBootstrap = _getUiBootstrapModule();
        if (uiBootstrap && typeof uiBootstrap.installGameDI === 'function') {
            uiBootstrap.installGameDI();
        }
    } catch (e) {
        console.warn('[init] UIBootstrap.installGameDI failed', e);
    }

    const { getInitDomElements } = (typeof require === 'function')
        ? require('../bootstrap/init-dom')
        : (typeof window !== 'undefined' && window.InitDOM ? window.InitDOM : {});
    const { attachInitEventListeners } = (typeof require === 'function')
        ? require('../bootstrap/init-events')
        : (typeof window !== 'undefined' && window.InitEvents ? window.InitEvents : {});
    const { initGameSystems } = (typeof require === 'function')
        ? require('../bootstrap/init-game')
        : (typeof window !== 'undefined' && window.InitGame ? window.InitGame : {});
    const { initNetworkAndDebug } = (typeof require === 'function')
        ? require('../bootstrap/init-network')
        : (typeof window !== 'undefined' && window.InitNetwork ? window.InitNetwork : {});

    const refs = (typeof getInitDomElements === 'function') ? getInitDomElements() : {};
    const debugAllowed = (typeof window !== 'undefined' && window.DEBUG_MODE_ALLOWED === true)
        || /[?&]debug=1/.test((typeof location !== 'undefined' && location.search) ? location.search : '')
        || /[?&]debug=true/.test((typeof location !== 'undefined' && location.search) ? location.search : '');

    try {
        if (typeof SoundEngine !== 'undefined' && typeof SoundEngine.primeEffectSounds === 'function') {
            SoundEngine.primeEffectSounds();
        }
    } catch (e) { /* ignore */ }

    if (typeof attachInitEventListeners === 'function') {
        attachInitEventListeners(refs, debugAllowed);
    }

    if (typeof initGameSystems === 'function') {
        await initGameSystems();
    }

    setUiInitializedFlag(true);

    if (typeof initNetworkAndDebug === 'function') {
        await initNetworkAndDebug();
    }
}

// Auto-initialize UI when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    Promise.resolve(initializeUI()).catch((err) => {
        console.error('[init] initializeUI failed', err && err.message ? err.message : err);
    });
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeUI,
        setupSmartSelects: (typeof setupSmartSelects !== 'undefined') ? setupSmartSelects : function () {},
        setupSoundControls: (typeof setupSoundControls !== 'undefined') ? setupSoundControls : function () {},
        setupBgmControls: (typeof setupBgmControls !== 'undefined') ? setupBgmControls : function () {},
        loadCpuPolicy: (typeof loadCpuPolicy !== 'undefined') ? loadCpuPolicy : function () {},
        setUiInitializedFlag
    };
}

if (typeof window !== 'undefined') {
    window.initializeUI = initializeUI;
}
