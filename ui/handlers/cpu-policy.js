/**
 * @file cpu-policy.js
 * @description CPU policy loading handlers
 */

function _isDebugEnabled() {
    try {
        const qs = (typeof location !== 'undefined' && location.search) ? location.search : '';
        if (/[?&]debug=1\b/.test(qs) || /[?&]debug=true\b/.test(qs)) return true;
    } catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && window.DEBUG_UNLIMITED_USAGE === true) return true;
    } catch (e) { /* ignore */ }
    return false;
}

/**
 * LvMax Deep CFR モデルの読み込み
 * Load LvMax Deep CFR models
 */
async function initLvMaxModels() {
    if (typeof loadLvMaxModels === 'undefined') {
        if (_isDebugEnabled()) console.warn('[LvMax] loadLvMaxModels function not available');
        return;
    }

    try {
        console.log('[LvMax] Loading Deep CFR models...');
        const success = await window.loadLvMaxModels('/ai/deepcfr/models/final');
        if (success) {
            console.log('[LvMax] Models loaded successfully');
            // Silent loading - only log to console, not UI
        } else {
            console.warn('[LvMax] Model loading failed');
        }
    } catch (err) {
        console.error('[LvMax] Model loading error:', err);
    }
}

/**
 * CPUポリシー読み込み
 * Load MCCFR policy based on CPU level
 */
async function loadCpuPolicy() {
    if (typeof CpuPolicy === 'undefined' || !CpuPolicy.loadPolicyForLevel) {
        if (_isDebugEnabled()) console.warn('CpuPolicy.loadPolicyForLevel not available');
        return;
    }
    try {
        const whiteLevel = cpuSmartness.white || 3;
        console.log(`Attempting to load policy for level ${whiteLevel}`);
        mccfrPolicy = await CpuPolicy.loadPolicyForLevel(whiteLevel);
        console.log('Policy loaded successfully:', mccfrPolicy);
        addLog(`MCCFRポリシー (レベル ${whiteLevel}) を読み込みました`);
    } catch (err) {
        console.error('Policy load failed - Full error:', err);
        console.error('Error message:', err.message);
        console.error('Error stack:', err.stack);
        addLog(`ポリシー読み込みに失敗しました: ${err.message}`);
    }
}

/**
 * Policy-table model loading for browser CPU runtime.
 * Fails safely: CPU falls back to default policy logic.
 */
async function initPolicyTableModel() {
    let runtime = null;
    try {
        if (typeof window !== 'undefined' && window.CpuPolicyTableRuntime) {
            runtime = window.CpuPolicyTableRuntime;
        }
    } catch (e) { /* ignore */ }
    if (!runtime || typeof runtime.loadFromUrl !== 'function') return;

    try {
        // Keep defaults explicit so behavior is easy to track.
        if (typeof runtime.configure === 'function') {
            runtime.configure({
                enabled: true,
                minLevel: 4,
                sourceUrl: 'data/models/policy-table.json'
            });
        }
        const ok = await runtime.loadFromUrl('data/models/policy-table.json');
        if (ok) {
            const status = (typeof runtime.getStatus === 'function') ? runtime.getStatus() : null;
            const statesCount = status && Number.isFinite(status.statesCount) ? status.statesCount : '?';
            console.log(`[CPU] policy-table loaded (states=${statesCount})`);
        } else if (_isDebugEnabled()) {
            const status = (typeof runtime.getStatus === 'function') ? runtime.getStatus() : null;
            console.warn('[CPU] policy-table not loaded', status && status.lastError ? status.lastError : '');
        }
    } catch (err) {
        if (_isDebugEnabled()) console.warn('[CPU] policy-table loading failed', err);
    }
}

if (typeof window !== 'undefined') {
    window.initLvMaxModels = initLvMaxModels;
    window.loadCpuPolicy = loadCpuPolicy;
    window.initPolicyTableModel = initPolicyTableModel;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initLvMaxModels,
        loadCpuPolicy,
        initPolicyTableModel
    };
}
