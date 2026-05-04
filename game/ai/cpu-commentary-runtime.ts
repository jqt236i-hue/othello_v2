declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

(function () {
let Engine = null;

try { Engine = _require('./fixed-commentary-engine'); } catch (e: any) { Engine = null; }

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
        (globalThis as any).CpuCommentaryRuntime = Api; // @compat - backward-compat export
    }
} catch (e: any) { /* ignore */ }
})();

export {};
