(function () {
let Engine = null;

if (typeof require === 'function') {
    try { Engine = require('./fixed-commentary-engine'); } catch (e) { Engine = null; }
}

if (!Engine && typeof globalThis !== 'undefined') {
    Engine = globalThis.FixedCommentaryEngine || null;
}

const fallback = {
    isEnabled: () => false,
    setConfig: () => ({ enabled: false, mode: 'unavailable' }),
    getStatus: () => ({ enabled: false, mode: 'unavailable' }),
    requestCommentary: async () => null,
    resetState: () => {}
};

const Api = Engine || fallback;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Api;
}

try {
    if (typeof globalThis !== 'undefined') {
        globalThis.CpuCommentaryRuntime = Api;
    }
} catch (e) { /* ignore */ }
})();
