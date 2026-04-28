"use strict";
/**
 * @file init-game.ts
 * @description ゲーム初期化（公開APIのみ）
 */
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
async function initGameSystems() {
    if (typeof loadCpuPolicy === 'function' && typeof CpuPolicy !== 'undefined' && CpuPolicy && typeof CpuPolicy.loadPolicyForLevel === 'function') {
        loadCpuPolicy();
    }
    if (typeof initPolicyOnnxModel === 'function') {
        await initPolicyOnnxModel();
    }
    if (typeof initPolicyTableModel === 'function') {
        await initPolicyTableModel();
    }
    if (typeof initLvMaxModels === 'function' && typeof loadLvMaxModels === 'function') {
        initLvMaxModels();
    }
    try {
        if (typeof resetGame === 'function')
            resetGame();
    }
    catch (e) {
        const err = e;
        console.error('[init] resetGame threw', err && err.message);
    }
    try {
        if (typeof initWorkVisualsHelpers === 'function')
            initWorkVisualsHelpers();
        if (typeof initWorkVisualDiagnosticsAuto === 'function')
            initWorkVisualDiagnosticsAuto();
    }
    catch (e) { /* defensive */ }
}
module.exports = {
    initGameSystems
};
//# sourceMappingURL=init-game.js.map