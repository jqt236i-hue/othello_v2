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

function _shouldUseCardSpecialistByDefault() {
    try {
        const qs = (typeof location !== 'undefined' && location.search) ? location.search : '';
        if (/[?&]cardSpecialist=1\b/i.test(qs) || /[?&]card_specialist=1\b/i.test(qs)) return true;
    } catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && window.CPU_USE_CARD_SPECIALIST === true) return true;
    } catch (e) { /* ignore */ }
    return false;
}

function _uniqueStrings(values) {
    const out = [];
    const seen = new Set();
    for (const one of Array.isArray(values) ? values : []) {
        const s = String(one || '').trim();
        if (!s || seen.has(s)) continue;
        seen.add(s);
        out.push(s);
    }
    return out;
}

function _shouldForceOnnxLoad() {
    try {
        const qs = (typeof location !== 'undefined' && location.search) ? location.search : '';
        if (/[?&]cpuOnnx=1\b/i.test(qs) || /[?&]cpu_onnx=1\b/i.test(qs)) return true;
    } catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && window.CPU_FORCE_ONNX_POLICY === true) return true;
    } catch (e) { /* ignore */ }
    return false;
}

function _resolveCpuLv6SharedProfile() {
    try {
        if (typeof globalThis !== 'undefined' && globalThis.CPU_LV6_SHARED_PROFILE && typeof globalThis.CPU_LV6_SHARED_PROFILE === 'object') {
            return globalThis.CPU_LV6_SHARED_PROFILE;
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof require === 'function') {
            const shared = require('../../constants/cpu-lv6-shared-profile.js');
            if (shared && typeof shared === 'object') return shared;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function _usesOnnxMoveDecision(mode) {
    const normalized = String(mode || '').trim().toLowerCase();
    if (!normalized) return true;
    return normalized !== 'policy-table-lookahead' && normalized !== 'browser-policy-lookahead' && normalized !== 'policy-table-core';
}

function _usesOnnxCardDecision(mode) {
    const normalized = String(mode || '').trim().toLowerCase();
    if (!normalized) return true;
    return normalized !== 'policy-table-core';
}

function _shouldLoadBrowserOnnxRuntime() {
    if (_shouldForceOnnxLoad()) return true;

    const shared = _resolveCpuLv6SharedProfile();
    const browserProfile = shared && shared.browser && typeof shared.browser === 'object'
        ? shared.browser
        : null;
    if (!browserProfile) return true;

    return _usesOnnxMoveDecision(browserProfile.moveDecisionMode) || _usesOnnxCardDecision(browserProfile.cardDecisionMode);
}

function _getCpuModelLoadStatusStore() {
    try {
        if (typeof window === 'undefined') return null;
        if (!window.__CPU_MODEL_LOAD_STATUS__ || typeof window.__CPU_MODEL_LOAD_STATUS__ !== 'object') {
            window.__CPU_MODEL_LOAD_STATUS__ = {
                onnx: {
                    loaded: false,
                    sourceUrl: '',
                    metaUrl: '',
                    triedRoots: [],
                    lastError: ''
                },
                table: {
                    loaded: false,
                    sourceUrl: '',
                    triedRoots: [],
                    lastError: ''
                }
            };
        }
        return window.__CPU_MODEL_LOAD_STATUS__;
    } catch (e) {
        return null;
    }
}

function _setCpuModelLoadStatus(kind, patch) {
    const store = _getCpuModelLoadStatusStore();
    if (!store || !store[kind]) return;
    store[kind] = Object.assign({}, store[kind], patch || {});
}

function _reportCriticalModelLoadIssue(kind, message, extra) {
    const normalizedKind = kind === 'table' ? 'table' : 'onnx';
    const errorMessage = String(message || '').trim() || 'unknown error';
    const details = Object.assign({}, extra || {}, {
        loaded: false,
        lastError: errorMessage
    });
    _setCpuModelLoadStatus(normalizedKind, details);
    try {
        if (typeof console !== 'undefined' && typeof console.error === 'function') {
            console.error(
                `[CPU] ${normalizedKind} model unavailable: ${errorMessage}`,
                extra || {}
            );
        }
    } catch (e) { /* ignore */ }
}

function _candidateAssetRoots() {
    const roots = ['', './', '/', '../', '../../'];
    try {
        const pathname = (typeof location !== 'undefined' && typeof location.pathname === 'string')
            ? location.pathname
            : '';
        const baseDir = pathname
            ? (pathname.endsWith('/') ? pathname : pathname.replace(/[^/]*$/, ''))
            : '';
        if (baseDir && baseDir !== '/') {
            roots.push(baseDir);
            const parentDir = baseDir.replace(/[^/]+\/$/, '/');
            if (parentDir && parentDir !== baseDir) roots.push(parentDir);
        }
    } catch (e) { /* ignore */ }
    return _uniqueStrings(roots);
}

function _joinAssetUrl(root, relativePath) {
    const cleanPath = String(relativePath || '').replace(/^\/+/, '');
    const cleanRoot = String(root || '');
    if (!cleanRoot) return cleanPath;
    if (cleanRoot === '/') return `/${cleanPath}`;
    return `${cleanRoot}${cleanPath}`.replace(/\/{2,}/g, '/');
}

function _deriveResolvedRootFromUrl(resolvedUrl, relativePath) {
    const url = String(resolvedUrl || '').trim();
    const rel = String(relativePath || '').replace(/^\/+/, '');
    if (!url || !rel) return '';
    const idx = url.lastIndexOf(rel);
    if (idx >= 0) return url.slice(0, idx);
    const slash = url.lastIndexOf('/');
    if (slash >= 0) return url.slice(0, slash + 1);
    return '';
}

async function _probeUrl(fetchImpl, url) {
    if (!fetchImpl || !url) return false;
    try {
        const headRes = await fetchImpl(url, { method: 'HEAD', cache: 'no-store' });
        if (headRes && headRes.ok) return true;
        const status = headRes ? Number(headRes.status || 0) : 0;
        if (status !== 405 && status !== 501) return false;
    } catch (e) {
        return false;
    }
    try {
        const getRes = await fetchImpl(url, {
            method: 'GET',
            cache: 'no-store',
            headers: { Range: 'bytes=0-0' }
        });
        return !!(getRes && getRes.ok);
    } catch (e) {
        return false;
    }
}

async function _resolveAssetPair(fetchImpl, primaryRelativePath, secondaryRelativePath) {
    const roots = _candidateAssetRoots();
    for (const root of roots) {
        const primaryUrl = _joinAssetUrl(root, primaryRelativePath);
        const secondaryUrl = _joinAssetUrl(root, secondaryRelativePath);
        const primaryOk = await _probeUrl(fetchImpl, primaryUrl);
        if (!primaryOk) continue;
        const secondaryOk = await _probeUrl(fetchImpl, secondaryUrl);
        if (!secondaryOk) continue;
        return { primaryUrl, secondaryUrl, triedRoots: roots };
    }
    return null;
}

async function _resolveSingleAsset(fetchImpl, relativePath) {
    const roots = _candidateAssetRoots();
    for (const root of roots) {
        const url = _joinAssetUrl(root, relativePath);
        const ok = await _probeUrl(fetchImpl, url);
        if (ok) return { url, triedRoots: roots };
    }
    return null;
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
 * ONNX model loading for browser CPU runtime.
 * Fails safely: CPU falls back to policy-table/default logic.
 */
async function initPolicyOnnxModel() {
    let runtime = null;
    try {
        if (typeof window !== 'undefined' && window.CpuPolicyOnnxRuntime) {
            runtime = window.CpuPolicyOnnxRuntime;
        }
    } catch (e) { /* ignore */ }
    if (!runtime || typeof runtime.loadFromUrl !== 'function') return;
    if (!_shouldLoadBrowserOnnxRuntime()) {
        _setCpuModelLoadStatus('onnx', {
            loaded: false,
            sourceUrl: '',
            metaUrl: '',
            triedRoots: [],
            lastError: '',
            skipped: true,
            skipReason: 'shared-profile-policy-table-parity'
        });
        if (_isDebugEnabled()) console.log('[CPU] policy-onnx skipped by shared Lv6 parity profile');
        return;
    }

    const modelRel = 'data/models/policy-net.onnx';
    const metaRel = 'data/models/policy-net.onnx.meta.json';
    const cardModelRel = 'data/models/policy-card.onnx';
    const cardMetaRel = 'data/models/policy-card.onnx.meta.json';
    let modelUrl = modelRel;
    let metaUrl = metaRel;
    let cardModelUrl = cardModelRel;
    let cardMetaUrl = cardMetaRel;
    let useCardSpecialist = _shouldUseCardSpecialistByDefault();

    // If the model files are not present locally, skip loading to avoid noisy 404/errors.
    // Browser-only: use window.fetch so Node/Jest tests do not attempt relative URL fetches.
    const fetchImpl = (typeof window !== 'undefined' && typeof window.fetch === 'function')
        ? window.fetch.bind(window)
        : null;
    if (fetchImpl) {
        const resolved = await _resolveAssetPair(fetchImpl, modelRel, metaRel);
        if (!resolved) {
            _reportCriticalModelLoadIssue(
                'onnx',
                'missing policy-net assets; Lv6 loses ONNX guidance and falls back to policy-table or heuristic CPU. Serve the repo root so data/models is reachable.',
                { sourceUrl: '', metaUrl: '', triedRoots: _candidateAssetRoots() }
            );
            return;
        }
        modelUrl = resolved.primaryUrl;
        metaUrl = resolved.secondaryUrl;
        _setCpuModelLoadStatus('onnx', {
            loaded: false,
            sourceUrl: modelUrl,
            metaUrl,
            triedRoots: Array.isArray(resolved.triedRoots) ? resolved.triedRoots.slice() : [],
            lastError: ''
        });
    }

    if (fetchImpl && useCardSpecialist) {
        const resolvedRoot = _deriveResolvedRootFromUrl(modelUrl, modelRel);
        const candidateCardModelUrl = _joinAssetUrl(resolvedRoot, cardModelRel);
        const candidateCardMetaUrl = _joinAssetUrl(resolvedRoot, cardMetaRel);
        const hasCardModel = await _probeUrl(fetchImpl, candidateCardModelUrl);
        const hasCardMeta = hasCardModel ? await _probeUrl(fetchImpl, candidateCardMetaUrl) : false;
        if (hasCardModel && hasCardMeta) {
            cardModelUrl = candidateCardModelUrl;
            cardMetaUrl = candidateCardMetaUrl;
            useCardSpecialist = true;
        } else {
            useCardSpecialist = false;
        }
    }

    try {
        if (typeof runtime.configure === 'function') {
            runtime.configure({
                enabled: true,
                minLevel: 6,
                sourceUrl: modelUrl,
                metaUrl: metaUrl,
                cardSourceUrl: cardModelUrl,
                cardMetaUrl: cardMetaUrl,
                useCardSpecialist
            });
        }
        const ok = await runtime.loadFromUrl(modelUrl, metaUrl);
        if (ok) {
            _setCpuModelLoadStatus('onnx', {
                loaded: true,
                sourceUrl: modelUrl,
                metaUrl,
                lastError: ''
            });
            console.log(`[CPU] policy-onnx loaded (${modelUrl})`);
            if (useCardSpecialist && typeof runtime.loadCardModelFromUrl === 'function') {
                try {
                    const cardOk = await runtime.loadCardModelFromUrl(cardModelUrl, cardMetaUrl);
                    if (cardOk) {
                        console.log(`[CPU] policy-card loaded (${cardModelUrl})`);
                    } else if (_isDebugEnabled()) {
                        const status = (typeof runtime.getStatus === 'function') ? runtime.getStatus() : null;
                        console.warn('[CPU] policy-card not loaded', status && status.cardLastError ? status.cardLastError : '');
                    }
                } catch (cardErr) {
                    if (_isDebugEnabled()) console.warn('[CPU] policy-card loading failed', cardErr);
                }
            }
        } else {
            const status = (typeof runtime.getStatus === 'function') ? runtime.getStatus() : null;
            _reportCriticalModelLoadIssue('onnx', status && status.lastError ? status.lastError : 'runtime returned not loaded', {
                sourceUrl: modelUrl,
                metaUrl
            });
            if (_isDebugEnabled()) console.warn('[CPU] policy-onnx not loaded', status && status.lastError ? status.lastError : '');
        }
    } catch (err) {
        _reportCriticalModelLoadIssue('onnx', err && err.message ? err.message : 'load failed', {
            sourceUrl: modelUrl,
            metaUrl
        });
        if (_isDebugEnabled()) console.warn('[CPU] policy-onnx loading failed', err);
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

    const modelRel = 'data/models/policy-table.json';
    let modelUrl = modelRel;
    const fetchImpl = (typeof window !== 'undefined' && typeof window.fetch === 'function')
        ? window.fetch.bind(window)
        : null;
    if (fetchImpl) {
        const resolved = await _resolveSingleAsset(fetchImpl, modelRel);
        if (!resolved) {
            _reportCriticalModelLoadIssue(
                'table',
                'missing policy-table asset; Lv6 loses table guidance. ONNX may still load if policy-net assets are reachable.',
                { sourceUrl: '', triedRoots: _candidateAssetRoots() }
            );
            return;
        }
        modelUrl = resolved.url;
        _setCpuModelLoadStatus('table', {
            loaded: false,
            sourceUrl: modelUrl,
            triedRoots: Array.isArray(resolved.triedRoots) ? resolved.triedRoots.slice() : [],
            lastError: ''
        });
    }

    try {
        // Keep defaults explicit so behavior is easy to track.
        if (typeof runtime.configure === 'function') {
            runtime.configure({
                enabled: true,
                minLevel: 6,
                sourceUrl: modelUrl
            });
        }
        const ok = await runtime.loadFromUrl(modelUrl);
        if (ok) {
            _setCpuModelLoadStatus('table', {
                loaded: true,
                sourceUrl: modelUrl,
                lastError: ''
            });
            const status = (typeof runtime.getStatus === 'function') ? runtime.getStatus() : null;
            const statesCount = status && Number.isFinite(status.statesCount) ? status.statesCount : '?';
            console.log(`[CPU] policy-table loaded (states=${statesCount}, url=${modelUrl})`);
        } else {
            const status = (typeof runtime.getStatus === 'function') ? runtime.getStatus() : null;
            _reportCriticalModelLoadIssue('table', status && status.lastError ? status.lastError : 'runtime returned not loaded', {
                sourceUrl: modelUrl
            });
            if (_isDebugEnabled()) console.warn('[CPU] policy-table not loaded', status && status.lastError ? status.lastError : '');
        }
    } catch (err) {
        _reportCriticalModelLoadIssue('table', err && err.message ? err.message : 'load failed', {
            sourceUrl: modelUrl
        });
        if (_isDebugEnabled()) console.warn('[CPU] policy-table loading failed', err);
    }
}

if (typeof window !== 'undefined') {
    window.initLvMaxModels = initLvMaxModels;
    window.loadCpuPolicy = loadCpuPolicy;
    window.initPolicyOnnxModel = initPolicyOnnxModel;
    window.initPolicyTableModel = initPolicyTableModel;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initLvMaxModels,
        loadCpuPolicy,
        initPolicyOnnxModel,
        initPolicyTableModel
    };
}
