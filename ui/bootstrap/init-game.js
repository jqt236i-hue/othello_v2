/**
 * @file init-game.js
 * @description ゲーム初期化（公開APIのみ）
 */

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
        if (typeof resetGame === 'function') resetGame();
    } catch (e) { console.error('[init] resetGame threw', e && e.message); }

    try {
        if (typeof initWorkVisualsHelpers === 'function') initWorkVisualsHelpers();
        if (typeof initWorkVisualDiagnosticsAuto === 'function') initWorkVisualDiagnosticsAuto();
    } catch (e) { /* defensive */ }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initGameSystems };
}
