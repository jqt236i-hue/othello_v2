'use strict';
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
let brokerConfig = {};
let commentaryContextHelpers = null;
let commentaryRuntimeHelpers = null;
let cpuCommentaryRuntime = null;
let requestChain = Promise.resolve();
let dedupeKeys = Object.create(null);
function resolveRootRef() {
    if (brokerConfig && brokerConfig.root)
        return brokerConfig.root;
    try {
        if (typeof globalThis !== 'undefined')
            return globalThis;
    }
    catch (e) { /* ignore */ }
    return null;
}
function resolveCommentaryRuntimeHelpers() {
    if (commentaryRuntimeHelpers)
        return commentaryRuntimeHelpers;
    const rootRef = resolveRootRef();
    try {
        if (rootRef && rootRef.CommentaryRuntimeHelpers) {
            commentaryRuntimeHelpers = rootRef.CommentaryRuntimeHelpers;
            return commentaryRuntimeHelpers;
        }
    }
    catch (e) { /* ignore */ }
    try {
        commentaryRuntimeHelpers = _require('../shared/commentary-runtime-helpers');
        return commentaryRuntimeHelpers;
    }
    catch (e) { /* ignore */ }
    return null;
}
function resolveCommentaryContextHelpers() {
    if (commentaryContextHelpers)
        return commentaryContextHelpers;
    const rootRef = resolveRootRef();
    try {
        if (rootRef && rootRef.CommentaryContextHelpers) {
            commentaryContextHelpers = rootRef.CommentaryContextHelpers;
            return commentaryContextHelpers;
        }
    }
    catch (e) { /* ignore */ }
    try {
        commentaryContextHelpers = _require('../shared/commentary-context-helpers');
        return commentaryContextHelpers;
    }
    catch (e) { /* ignore */ }
    return null;
}
function resolveCpuCommentaryRuntime() {
    const runtimeHelpers = resolveCommentaryRuntimeHelpers();
    if (runtimeHelpers && typeof runtimeHelpers.hasCommentaryRuntime === 'function' && runtimeHelpers.hasCommentaryRuntime(cpuCommentaryRuntime)) {
        return cpuCommentaryRuntime;
    }
    if (runtimeHelpers && typeof runtimeHelpers.resolveCommentaryRuntimeFromGlobal === 'function') {
        const runtime = runtimeHelpers.resolveCommentaryRuntimeFromGlobal(resolveRootRef());
        if (runtime) {
            cpuCommentaryRuntime = runtime;
            return cpuCommentaryRuntime;
        }
    }
    try {
        const runtime = _require('../game/ai/cpu-commentary-runtime');
        if (runtime && typeof runtime.requestCommentary === 'function') {
            cpuCommentaryRuntime = runtime;
            return cpuCommentaryRuntime;
        }
    }
    catch (e) { /* ignore */ }
    cpuCommentaryRuntime = null;
    return null;
}
function resolveLogWriter() {
    if (brokerConfig && typeof brokerConfig.addLog === 'function')
        return brokerConfig.addLog;
    const rootRef = resolveRootRef();
    try {
        if (rootRef && typeof rootRef.addLog === 'function')
            return rootRef.addLog.bind(rootRef);
    }
    catch (e) { /* ignore */ }
    return null;
}
function normalizeSpeakerRole(role) {
    const runtimeHelpers = resolveCommentaryRuntimeHelpers();
    if (runtimeHelpers && typeof runtimeHelpers.normalizeSpeakerRole === 'function') {
        return runtimeHelpers.normalizeSpeakerRole(role, 'cpu');
    }
    return String(role || '').trim().toLowerCase() === 'hero' ? 'hero' : 'cpu';
}
function buildFallbackContext(options) {
    const opts = (options && typeof options === 'object') ? options : {};
    const helpers = resolveCommentaryContextHelpers();
    const counts = opts.counts || { black: 0, white: 0 };
    const occupiedCells = Number.isFinite(Number(opts.occupiedCells))
        ? Number(opts.occupiedCells)
        : ((counts.black || 0) + (counts.white || 0));
    const playerKey = opts.playerKey === 'white' ? 'white' : 'black';
    const turnNumber = Number.isFinite(Number(opts.turnNumber)) ? Number(opts.turnNumber) : null;
    return Object.assign({
        eventType: String(opts.eventType || 'turn_start'),
        playerKey,
        turnNumber,
        counts,
        board: Array.isArray(opts.board) ? opts.board : null,
        cardId: opts.cardId ? String(opts.cardId) : null,
        cardType: opts.cardType ? String(opts.cardType) : null,
        occupiedCells,
        phase: (helpers && typeof helpers.resolvePhaseByTurn === 'function')
            ? helpers.resolvePhaseByTurn(turnNumber, occupiedCells)
            : 'middle',
        advantage: (helpers && typeof helpers.resolveAdvantageLabel === 'function')
            ? helpers.resolveAdvantageLabel(playerKey, counts)
            : 'even'
    }, opts.extra || {});
}
function buildCommentaryContext(options) {
    const opts = (options && typeof options === 'object') ? options : {};
    if (opts.context && typeof opts.context === 'object')
        return opts.context;
    const helpers = resolveCommentaryContextHelpers();
    const base = buildFallbackContext(opts);
    const context = (helpers && typeof helpers.buildCommentaryContext === 'function')
        ? helpers.buildCommentaryContext({
            eventType: base.eventType,
            playerKey: base.playerKey,
            turnNumber: base.turnNumber,
            counts: base.counts,
            board: base.board,
            cardId: base.cardId,
            extra: Object.assign({}, opts.extra || {}, {
                speakerRole: opts.speakerRole || base.speakerRole,
                cardType: base.cardType
            })
        })
        : base;
    if (context && typeof context === 'object' && opts.speakerRole) {
        context.speakerRole = opts.speakerRole;
    }
    return context;
}
function formatCommentaryEntry(playerKey, speakerRole, text) {
    const line = String(text || '').trim();
    if (!line)
        return null;
    const normalizedRole = normalizeSpeakerRole(speakerRole);
    const runtimeHelpers = resolveCommentaryRuntimeHelpers();
    const prefix = (runtimeHelpers && typeof runtimeHelpers.getSpeakerPrefix === 'function')
        ? runtimeHelpers.getSpeakerPrefix(playerKey, normalizedRole)
        : (normalizedRole === 'hero' ? '勇者' : (playerKey === 'white' ? '白CPU' : '黒CPU'));
    return {
        kind: 'commentary',
        speakerRole: normalizedRole,
        playerKey: playerKey === 'white' ? 'white' : 'black',
        prefix,
        line,
        text: `${prefix}: ${line}`
    };
}
function showCommentaryEntry(entry, options) {
    const opts = (options && typeof options === 'object') ? options : {};
    const safeEntry = entry && typeof entry === 'object' ? entry : null;
    if (!safeEntry || !safeEntry.line)
        return null;
    const speakerRole = normalizeSpeakerRole(safeEntry.speakerRole);
    const getter = speakerRole === 'hero'
        ? (brokerConfig && brokerConfig.getShowHeroSpeechBubble)
        : (brokerConfig && brokerConfig.getShowCpuSpeechBubble);
    const showBubble = typeof getter === 'function' ? getter() : null;
    if (typeof showBubble === 'function' && opts.show !== false) {
        if (speakerRole === 'hero')
            showBubble(safeEntry.line, safeEntry);
        else
            showBubble(safeEntry.line, safeEntry);
    }
    const logWriter = resolveLogWriter();
    if (typeof logWriter === 'function' && opts.log === true) {
        logWriter(safeEntry.text);
    }
    return safeEntry;
}
function isDuplicate(scope, key) {
    if (!scope || !key)
        return false;
    const normalizedScope = String(scope);
    const normalizedKey = String(key);
    if (dedupeKeys[normalizedScope] === normalizedKey)
        return true;
    dedupeKeys[normalizedScope] = normalizedKey;
    return false;
}
function enqueueCommentaryRequest(run) {
    const next = requestChain.then(run, run);
    requestChain = next.catch(() => null);
    return next;
}
function requestCommentaryAndShow(options) {
    const opts = (options && typeof options === 'object') ? options : {};
    if (isDuplicate(opts.dedupeScope, opts.dedupeKey))
        return Promise.resolve(null);
    const runtime = (opts.runtime && typeof opts.runtime.requestCommentary === 'function')
        ? opts.runtime
        : resolveCpuCommentaryRuntime();
    if (!runtime || typeof runtime.requestCommentary !== 'function')
        return Promise.resolve(null);
    const context = buildCommentaryContext(opts);
    if (!context || typeof context !== 'object')
        return Promise.resolve(null);
    const playerKey = opts.playerKey || context.playerKey || 'black';
    const speakerRole = opts.speakerRole || context.speakerRole || 'cpu';
    return enqueueCommentaryRequest(() => Promise.resolve(runtime.requestCommentary(context))
        .then((text) => formatCommentaryEntry(playerKey, speakerRole, text))
        .then((entry) => showCommentaryEntry(entry, opts))
        .catch(() => null));
}
function initBroker(config) {
    brokerConfig = Object.assign({}, brokerConfig, config || {});
    return api;
}
function resetState() {
    dedupeKeys = Object.create(null);
    requestChain = Promise.resolve();
    return api;
}
const api = {
    initBroker,
    resetState,
    buildCommentaryContext,
    formatCommentaryEntry,
    showCommentaryEntry,
    requestCommentaryAndShow
};
const CommentaryBroker = api;
module.exports = CommentaryBroker;
//# sourceMappingURL=commentary-broker.js.map