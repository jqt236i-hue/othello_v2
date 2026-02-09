/**
 * @file trap.js
 * @description Trap Will card handlers
 */

function emitPresentationEventViaBoardOps(ev) {
    try {
        const pres = (typeof require === 'function') ? require('../logic/presentation') : (typeof globalThis !== 'undefined' ? globalThis.PresentationHelper : null);
        if (pres && typeof pres.emitPresentationEvent === 'function') return pres.emitPresentationEvent(cardState, ev);
    } catch (e) { /* ignore */ }
    return false;
}

function _isTrapFlashVisibleForViewer(playerKey) {
    try {
        if (typeof window === 'undefined') return true;
        if (window.BOARD_VIEWER_KEY === 'black' || window.BOARD_VIEWER_KEY === 'white') {
            return window.BOARD_VIEWER_KEY === playerKey;
        }
        if (window.LOCAL_PLAYER_KEY === 'black' || window.LOCAL_PLAYER_KEY === 'white') {
            return window.LOCAL_PLAYER_KEY === playerKey;
        }
        // Local HvH: currently operating side is the viewer.
        if (window.DEBUG_HUMAN_VS_HUMAN === true) return true;
    } catch (e) { /* ignore */ }
    return true;
}

function _playTrapPlacementFlash(row, col, playerKey) {
    if (typeof document === 'undefined') return;
    if (!_isTrapFlashVisibleForViewer(playerKey)) return;

    const board = document.getElementById('board');
    if (!board) return;
    const cell = board.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
    if (!cell) return;
    const disc = cell.querySelector('.disc');
    if (!disc) return;

    const imagePath = playerKey === 'black'
        ? 'assets/images/stones/trap_stone-black.png'
        : 'assets/images/stones/trap_stone-white.png';

    const cleanup = () => {
        try {
            disc.classList.remove('trap-place-flash');
            disc.classList.remove('trap-stone');
            disc.classList.remove('special-stone');
            disc.style.removeProperty('--special-stone-image');
        } catch (e) { /* ignore */ }
    };

    try {
        disc.classList.remove('trap-place-flash');
        disc.classList.add('special-stone', 'trap-stone');
        disc.style.setProperty('--special-stone-image', `url('${imagePath}')`);
        // Reflow to restart the animation if needed.
        disc.offsetHeight;
        disc.classList.add('trap-place-flash');
    } catch (e) {
        cleanup();
        return;
    }

    let cleaned = false;
    const onEnd = () => {
        if (cleaned) return;
        cleaned = true;
        disc.removeEventListener('animationend', onEnd);
        cleanup();
    };
    disc.addEventListener('animationend', onEnd, { once: true });
    setTimeout(onEnd, 900);
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
    module.exports = { handleTrapSelection };
}
