/**
 * @file trap.js
 * @description Trap Will card handlers
 */

let __uiImpl_trap = {};
function setUIImpl(obj) {
    __uiImpl_trap = Object.assign({}, __uiImpl_trap || {}, obj || {});
}

function getTrapBoardElement() {
    try {
        if (__uiImpl_trap && typeof __uiImpl_trap.getBoardElement === 'function') {
            return __uiImpl_trap.getBoardElement();
        }
    } catch (e) { /* ignore */ }
    try {
        if (
            typeof globalThis !== 'undefined' &&
            globalThis.__uiImpl_trap &&
            typeof globalThis.__uiImpl_trap.getBoardElement === 'function'
        ) {
            return globalThis.__uiImpl_trap.getBoardElement();
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && globalThis.boardEl && typeof globalThis.boardEl.querySelector === 'function') {
            return globalThis.boardEl;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function emitPresentationEventViaBoardOps(ev) {
    try {
        const pres = (typeof require === 'function') ? require('../logic/presentation') : (typeof globalThis !== 'undefined' ? globalThis.PresentationHelper : null);
        if (pres && typeof pres.emitPresentationEvent === 'function') return pres.emitPresentationEvent(cardState, ev);
    } catch (e) { /* ignore */ }
    return false;
}

function _isTrapFlashVisibleForViewer(playerKey) {
    try {
        const root = (typeof globalThis !== 'undefined') ? globalThis : null;
        if (!root) return true;
        if (root.BOARD_VIEWER_KEY === 'black' || root.BOARD_VIEWER_KEY === 'white') {
            return root.BOARD_VIEWER_KEY === playerKey;
        }
        if (root.LOCAL_PLAYER_KEY === 'black' || root.LOCAL_PLAYER_KEY === 'white') {
            return root.LOCAL_PLAYER_KEY === playerKey;
        }
        // Local HvH: currently operating side is the viewer.
        if (root.DEBUG_HUMAN_VS_HUMAN === true) return true;
    } catch (e) { /* ignore */ }
    return true;
}

function _playTrapPlacementFlash(row, col, playerKey) {
    if (!_isTrapFlashVisibleForViewer(playerKey)) return;

    const imagePath = playerKey === 'black'
        ? 'assets/images/stones/trap_stone-black.png'
        : 'assets/images/stones/trap_stone-white.png';
    const flashId = `trapflash-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const durationMs = 760;
    const stepMs = 90;
    const endAt = Date.now() + durationMs;

    function ensureOverlay() {
        const board = getTrapBoardElement();
        if (!board || typeof board.querySelector !== 'function') return null;
        const cell = board.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
        if (!cell) return null;
        const baseDisc = cell.querySelector('.disc');
        if (!baseDisc) return null;
        const domDoc = cell.ownerDocument;
        if (!domDoc || typeof domDoc.createElement !== 'function') return null;

        let overlay = cell.querySelector(`.trap-place-overlay[data-trap-flash-id="${flashId}"]`);
        if (!overlay) {
            overlay = domDoc.createElement('div');
            overlay.className = 'disc special-stone trap-stone trap-place-flash trap-place-overlay';
            overlay.dataset.trapFlashId = flashId;
            cell.appendChild(overlay);
        }
        try {
            overlay.style.setProperty('--special-stone-image', `url('${imagePath}')`);
        } catch (e) { /* ignore */ }
        return overlay;
    }

    function clearOverlay() {
        const board = getTrapBoardElement();
        if (!board || typeof board.querySelector !== 'function') return;
        const cell = board.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
        if (!cell) return;
        const target = cell.querySelector(`.trap-place-overlay[data-trap-flash-id="${flashId}"]`);
        if (target && target.parentNode) {
            target.parentNode.removeChild(target);
        }
    }

    (function tick() {
        ensureOverlay();
        if (Date.now() >= endAt) {
            clearOverlay();
            return;
        }
        setTimeout(tick, stepMs);
    })();
}

async function handleTrapSelection(row, col, playerKey) {
    if (isProcessing || isCardAnimating) return;
    isProcessing = true;
    isCardAnimating = true;
    let shouldCheckAutoPass = false;

    try {
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (!pending || pending.type !== 'TRAP_WILL' || pending.stage !== 'selectTarget') return;

        const action = (typeof ActionManager !== 'undefined' && ActionManager.ActionManager && typeof ActionManager.ActionManager.createAction === 'function')
            ? ActionManager.ActionManager.createAction('place', playerKey, { trapTarget: { row, col } })
            : { type: 'place', trapTarget: { row, col } };
        if (action && cardState && typeof cardState.turnIndex === 'number') {
            action.turnIndex = cardState.turnIndex;
        }

        const res = (typeof TurnPipelineUIAdapter !== 'undefined' && typeof TurnPipeline !== 'undefined')
            ? TurnPipelineUIAdapter.runTurnWithAdapter(cardState, gameState, playerKey, action, TurnPipeline)
            : null;

        if (!res || res.ok === false) {
            if (typeof emitLogAdded === 'function') emitLogAdded('罠石にする自分の石を選んでください');
            return;
        }

        const selected = (res.rawEvents || []).find(e => e && e.type === 'trap_selected');
        if (!selected || !selected.applied) {
            if (typeof emitLogAdded === 'function') emitLogAdded('罠石にする自分の石を選んでください');
            return;
        }

        if (res.nextCardState) cardState = res.nextCardState;
        if (res.nextGameState) gameState = res.nextGameState;

        if (res.playbackEvents && res.playbackEvents.length) {
            emitPresentationEventViaBoardOps({
                type: 'PLAYBACK_EVENTS',
                events: res.playbackEvents,
                meta: { cause: 'TRAP_WILL', target: { row, col } }
            });
        }

        if (typeof emitCardStateChange === 'function') emitCardStateChange();
        if (typeof emitBoardUpdate === 'function') emitBoardUpdate();
        if (typeof emitGameStateChange === 'function') emitGameStateChange();
        // Brief local-only reveal to make placement intent understandable, then hide as normal stone.
        try {
            requestAnimationFrame(() => _playTrapPlacementFlash(row, col, playerKey));
        } catch (e) {
            _playTrapPlacementFlash(row, col, playerKey);
        }
        shouldCheckAutoPass = true;
    } finally {
        isProcessing = false;
        isCardAnimating = false;
        if (shouldCheckAutoPass && typeof ensureCurrentPlayerCanActOrPass === 'function') {
            try { ensureCurrentPlayerCanActOrPass({ useBlackDelay: true }); } catch (e) { /* ignore */ }
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleTrapSelection, setUIImpl };
}
