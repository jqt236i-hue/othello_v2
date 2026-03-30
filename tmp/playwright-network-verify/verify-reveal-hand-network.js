const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const DeckCodec = require('../../shared/deck-codec');
const DeckSpecHelpers = require('../../shared/deck-spec');

const BASE_URL = String(process.env.BASE_URL || 'http://127.0.0.1:8000').trim();
const SERVER_URL = String(process.env.SERVER_URL || 'http://127.0.0.1:8787').trim().replace(/\/+$/, '');
const VIEWPORT = { width: 1440, height: 1200 };
const OUT_DIR = path.join(process.cwd(), 'tmp', 'playwright-network-verify');
const RESULT_PATH = process.env.RESULT_PATH
    ? path.resolve(process.cwd(), String(process.env.RESULT_PATH))
    : path.join(OUT_DIR, 'reveal-hand-network-result.json');
const PROGRESS_PATH = process.env.PROGRESS_PATH
    ? path.resolve(process.cwd(), String(process.env.PROGRESS_PATH))
    : path.join(OUT_DIR, 'reveal-hand-network-progress.json');
const HEADLESS = !/^(0|false)$/i.test(String(process.env.HEADLESS || '0'));
const SLOW_MO_MS = Math.max(0, Number(process.env.SLOW_MO_MS || 0) || 0);
const PAGE_TIMEOUT_MS = Number.isFinite(Number(process.env.PAGE_TIMEOUT_MS))
    ? Math.max(1000, Math.trunc(Number(process.env.PAGE_TIMEOUT_MS)))
    : 30000;
const PLAYBACK_TIMEOUT_MS = Number.isFinite(Number(process.env.PLAYBACK_TIMEOUT_MS))
    ? Math.max(1000, Math.trunc(Number(process.env.PLAYBACK_TIMEOUT_MS)))
    : 20000;
const STATE_TIMEOUT_MS = Number.isFinite(Number(process.env.STATE_TIMEOUT_MS))
    ? Math.max(1000, Math.trunc(Number(process.env.STATE_TIMEOUT_MS)))
    : 20000;
const PROGRESS_TIMEOUT_MS = Number.isFinite(Number(process.env.PROGRESS_TIMEOUT_MS))
    ? Math.max(500, Math.trunc(Number(process.env.PROGRESS_TIMEOUT_MS)))
    : 6000;
const MAX_ATTEMPTS = Number.isFinite(Number(process.env.MAX_ATTEMPTS))
    ? Math.max(1, Math.trunc(Number(process.env.MAX_ATTEMPTS)))
    : 8;
const MAX_ACTIONS = Number.isFinite(Number(process.env.MAX_ACTIONS))
    ? Math.max(8, Math.trunc(Number(process.env.MAX_ACTIONS)))
    : 30;
const TARGET_CARD_ID = 'reveal_hand_01';
const DRAW_CARD_IDS = ['rebuild_01', 'supply_01'];
const MAX_EVENT_LOG = 120;

fs.mkdirSync(OUT_DIR, { recursive: true });

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function appendLimited(list, value, max = MAX_EVENT_LOG) {
    list.push(value);
    if (list.length > max) {
        list.splice(0, list.length - max);
    }
}

function writeJson(filePath, value) {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function writeProgress(payload) {
    writeJson(PROGRESS_PATH, Object.assign({
        target: TARGET_CARD_ID,
        timestamp: new Date().toISOString()
    }, payload || {}));
}

function normalizePlayerKey(value) {
    if (value === -1 || value === 'white' || value === '-1') return 'white';
    return 'black';
}

function getOpponentKey(playerKey) {
    return normalizePlayerKey(playerKey) === 'white' ? 'black' : 'white';
}

function boardHash(board) {
    try {
        return JSON.stringify(Array.isArray(board) ? board : []);
    } catch (e) {
        return '[]';
    }
}

function pendingHash(pending) {
    if (!pending || typeof pending !== 'object') return '';
    try {
        return JSON.stringify(pending);
    } catch (e) {
        return String(pending.type || 'pending');
    }
}

function isHiddenToken(value, ownerKey) {
    return typeof value === 'string' && value.startsWith(`__hidden_hand__:${ownerKey}:`);
}

function hiddenCount(values, ownerKey) {
    return Array.isArray(values)
        ? values.filter((value) => isHiddenToken(value, ownerKey)).length
        : 0;
}

function chooseMove(moves) {
    if (!Array.isArray(moves) || moves.length <= 0) return null;
    const scored = moves
        .filter((move) => move && Number.isInteger(move.row) && Number.isInteger(move.col))
        .map((move) => {
            let score = 0;
            if ((move.row === 0 || move.row === 7) && (move.col === 0 || move.col === 7)) score += 100000;
            else if (move.row === 0 || move.row === 7 || move.col === 0 || move.col === 7) score += 10000;
            score += Number(move.flips || 0) * 10;
            score -= Math.abs(3.5 - move.row) + Math.abs(3.5 - move.col);
            return { move, score };
        })
        .sort((left, right) => {
            if (right.score !== left.score) return right.score - left.score;
            if (left.move.row !== right.move.row) return left.move.row - right.move.row;
            return left.move.col - right.move.col;
        });
    return scored.length > 0 ? scored[0].move : null;
}

function buildDeckCode() {
    const special = [TARGET_CARD_ID, TARGET_CARD_ID, TARGET_CARD_ID, 'rebuild_01', 'rebuild_01', 'rebuild_01', 'supply_01', 'supply_01', 'supply_01'];
    const excluded = new Set([TARGET_CARD_ID, 'rebuild_01', 'supply_01']);
    const filler = DeckSpecHelpers.getStandardDeckCardIds().filter((cardId) => !excluded.has(cardId)).slice(0, 21);
    const deckCardIds = special.concat(filler);
    const deckSpec = DeckSpecHelpers.createDeckSpecFromCardIds(deckCardIds);
    return DeckCodec.encodeDeckSpec(deckSpec);
}

function installPageObservers(page, browserName, attempt) {
    page.on('console', (message) => {
        const type = typeof message.type === 'function' ? message.type() : 'log';
        if (type !== 'error' && type !== 'warning') return;
        appendLimited(attempt.pageEvents, {
            time: new Date().toISOString(),
            browser: browserName,
            kind: 'console',
            type,
            text: typeof message.text === 'function' ? message.text() : ''
        });
    });
    page.on('requestfailed', (request) => {
        appendLimited(attempt.pageEvents, {
            time: new Date().toISOString(),
            browser: browserName,
            kind: 'requestfailed',
            url: typeof request.url === 'function' ? request.url() : '',
            method: typeof request.method === 'function' ? request.method() : '',
            failure: (() => {
                const details = typeof request.failure === 'function' ? request.failure() : null;
                return details && details.errorText ? details.errorText : null;
            })()
        });
    });
}

async function waitForGameReady(page) {
    await page.waitForFunction(() => {
        try {
            return !!(
                window.NetworkMatchClient
                && window.gameState
                && window.cardState
                && typeof window.passCurrentTurn === 'function'
                && typeof window.useSelectedCard === 'function'
                && typeof window.onCardClick === 'function'
                && typeof window.isGameOver === 'function'
            );
        } catch (e) {
            return false;
        }
    }, { timeout: PAGE_TIMEOUT_MS });
}

async function waitForPlaybackIdle(page, timeout = PLAYBACK_TIMEOUT_MS) {
    await page.evaluate(async (timeoutMs) => {
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const startedAt = Date.now();

        function getBusyDiagnostics() {
            const layer = document.getElementById('handLayer');
            const wrapper = document.getElementById('handWrapper');
            return {
                VisualPlaybackActive: window.VisualPlaybackActive === true,
                isCardAnimating: window.isCardAnimating === true,
                isProcessing: window.isProcessing === true,
                movingCard: !!(layer && layer.querySelector('.card-item.visible')),
                heldDrawCard: !!(wrapper && wrapper.querySelector('.held-draw-card')),
                layerVisible: !!(layer && layer.style && layer.style.display === 'block'),
                animationEnginePlaying: !!(window.AnimationEngine && window.AnimationEngine.isPlaying === true),
                playbackStartedAt: Number.isFinite(Number(window.__playbackActiveSince))
                    ? Number(window.__playbackActiveSince)
                    : null
            };
        }

        while ((Date.now() - startedAt) < timeoutMs) {
            try {
                if (typeof window.waitForPlaybackIdle === 'function') {
                    await window.waitForPlaybackIdle();
                }
            } catch (e) {
                // fall through to direct checks
            }
            const busy = getBusyDiagnostics();
            if (
                !busy.VisualPlaybackActive
                && !busy.isCardAnimating
                && !busy.isProcessing
                && !busy.movingCard
                && !busy.heldDrawCard
                && !busy.layerVisible
                && !busy.animationEnginePlaying
            ) {
                return true;
            }
            await sleep(50);
        }

        throw new Error(`waitForPlaybackIdle timed out: ${JSON.stringify(getBusyDiagnostics())}`);
    }, timeout);
}

async function ensureNetworkMode(page) {
    await page.getByRole('button', { name: 'ネット対戦' }).click();
    await page.waitForFunction(() => {
        try {
            return window.MATCH_MODE === 'network' || window.__MATCH_MODE === 'network';
        } catch (e) {
            return false;
        }
    }, { timeout: 10000 });
}

async function closeNetworkOverlayIfOpen(page) {
    try {
        await page.evaluate(() => {
            const overlay = document.getElementById('networkOverlay');
            const closeBtn = document.getElementById('networkCloseBtn');
            const visible = !!(
                overlay
                && overlay.classList
                && (
                    overlay.classList.contains('is-open')
                    || overlay.classList.contains('active')
                    || overlay.getAttribute('aria-hidden') === 'false'
                )
            );
            if (visible && closeBtn && typeof closeBtn.click === 'function') closeBtn.click();
        });
    } catch (e) {
        // best effort
    }
}

async function createRoom(page, playerName, deckCode) {
    await ensureNetworkMode(page);
    const result = await page.evaluate(async ({ playerName, deckCode, serverUrl }) => {
        return window.NetworkMatchClient.createRoom({
            playerName,
            deckCode,
            serverUrl,
            networkDebugEnabled: true
        });
    }, { playerName, deckCode, serverUrl: SERVER_URL });
    if (!result || result.ok !== true) {
        throw new Error(`createRoom failed: ${result && result.reason ? result.reason : 'UNKNOWN'}`);
    }
    return result.roomId;
}

async function joinRoom(page, roomId, playerName, deckCode) {
    await ensureNetworkMode(page);
    const result = await page.evaluate(async ({ roomId, playerName, deckCode, serverUrl }) => {
        return window.NetworkMatchClient.joinRoom(roomId, { playerName, deckCode, serverUrl });
    }, { roomId, playerName, deckCode, serverUrl: SERVER_URL });
    if (!result || result.ok !== true) {
        throw new Error(`joinRoom failed: ${result && result.reason ? result.reason : 'UNKNOWN'}`);
    }
    return result;
}

async function waitForTwoPlayers(page) {
    await page.waitForFunction(() => {
        try {
            return !!(
                window.NetworkMatchClient
                && typeof window.NetworkMatchClient.hasTwoPlayers === 'function'
                && window.NetworkMatchClient.hasTwoPlayers()
            );
        } catch (e) {
            return false;
        }
    }, { timeout: 20000 });
}

async function publishDebugFillHand(page, playerKey) {
    const result = await page.evaluate(async ({ seatKey }) => {
        if (!window.NetworkMatchClient || typeof window.NetworkMatchClient.publishSnapshot !== 'function') {
            throw new Error('publishSnapshot unavailable');
        }
        return window.NetworkMatchClient.publishSnapshot({
            playerKey: seatKey,
            actionType: 'debug_fill_hand',
            playbackEvents: [],
            action: { type: 'debug_fill_hand' }
        });
    }, { seatKey: playerKey });
    if (!result || result.ok !== true) {
        throw new Error(`debug_fill_hand failed for ${playerKey}: ${result && result.reason ? result.reason : 'UNKNOWN'}`);
    }
    return result;
}

async function getLiveState(page) {
    return page.evaluate(() => {
        function cloneBoard(board) {
            return Array.isArray(board) ? board.map((row) => Array.isArray(row) ? row.slice() : []) : [];
        }

        function normalizePlayerKey(value) {
            return (value === -1 || value === 'white' || value === '-1') ? 'white' : 'black';
        }

        const seatKey = window.NetworkMatchClient && typeof window.NetworkMatchClient.getSeatKey === 'function'
            ? window.NetworkMatchClient.getSeatKey()
            : null;
        const currentPlayerKey = normalizePlayerKey(window.gameState ? window.gameState.currentPlayer : null);
        const projectedHands = {
            black: window.cardState && window.cardState.hands && Array.isArray(window.cardState.hands.black)
                ? window.cardState.hands.black.slice()
                : [],
            white: window.cardState && window.cardState.hands && Array.isArray(window.cardState.hands.white)
                ? window.cardState.hands.white.slice()
                : []
        };
        const ownHandIds = seatKey && projectedHands[seatKey] ? projectedHands[seatKey].slice() : [];
        const hand = ownHandIds.map((cardId) => {
            const cardDef = window.CardLogic && typeof window.CardLogic.getCardDef === 'function'
                ? window.CardLogic.getCardDef(cardId)
                : null;
            let canUse = false;
            try {
                canUse = !!(
                    window.CardLogic
                    && typeof window.CardLogic.canUseCard === 'function'
                    && window.CardLogic.canUseCard(window.cardState, seatKey, cardId)
                );
            } catch (e) {
                canUse = false;
            }
            return {
                id: cardId,
                type: cardDef ? cardDef.type : null,
                name: cardDef ? cardDef.name : null,
                cost: cardDef ? Number(cardDef.cost || 0) : null,
                canUse
            };
        });

        let legalMoves = [];
        try {
            const protection = typeof window.getActiveProtectionForPlayer === 'function'
                ? window.getActiveProtectionForPlayer(window.gameState ? window.gameState.currentPlayer : null)
                : [];
            const perma = typeof window.getFlipBlockers === 'function'
                ? window.getFlipBlockers()
                : [];
            if (typeof window.getLegalMoves === 'function' && window.gameState) {
                legalMoves = window.getLegalMoves(window.gameState, protection, perma) || [];
            }
        } catch (e) {
            legalMoves = [];
        }

        const pendingByPlayer = window.cardState && window.cardState.pendingEffectByPlayer
            ? {
                black: window.cardState.pendingEffectByPlayer.black
                    ? JSON.parse(JSON.stringify(window.cardState.pendingEffectByPlayer.black))
                    : null,
                white: window.cardState.pendingEffectByPlayer.white
                    ? JSON.parse(JSON.stringify(window.cardState.pendingEffectByPlayer.white))
                    : null
            }
            : { black: null, white: null };

        return {
            seatKey,
            currentPlayerKey,
            canAct: seatKey === currentPlayerKey,
            turnIndex: Number.isFinite(Number(window.cardState && window.cardState.turnIndex))
                ? Number(window.cardState.turnIndex)
                : null,
            turnNumber: Number.isFinite(Number(window.gameState && window.gameState.turnNumber))
                ? Number(window.gameState.turnNumber)
                : null,
            charge: Number(window.cardState && window.cardState.charge && window.cardState.charge[seatKey]) || 0,
            hasUsedCardThisTurn: !!(
                window.cardState
                && window.cardState.hasUsedCardThisTurnByPlayer
                && window.cardState.hasUsedCardThisTurnByPlayer[seatKey]
            ),
            pending: pendingByPlayer[seatKey] || null,
            pendingByPlayer,
            board: cloneBoard(window.gameState && window.gameState.board),
            projectedHands,
            hand,
            legalMoves: Array.isArray(legalMoves)
                ? legalMoves
                    .filter((move) => move && Number.isInteger(Number(move.row)) && Number.isInteger(Number(move.col)))
                    .map((move) => ({
                        row: Number(move.row),
                        col: Number(move.col),
                        flips: Array.isArray(move.flips) ? move.flips.length : Number(move.flipCount || 0)
                    }))
                : [],
            gameOver: (() => {
                try {
                    return !!(typeof window.isGameOver === 'function' && window.gameState && window.isGameOver(window.gameState));
                } catch (e) {
                    return false;
                }
            })()
        };
    });
}

async function getHandDomState(page, ownerKey) {
    return page.evaluate((targetOwnerKey) => {
        const container = document.getElementById(`hand-${targetOwnerKey}`);
        const track = container ? container.querySelector('.hand-track') : null;
        const cards = Array.from(track ? track.querySelectorAll('.card-item') : []).map((el) => ({
            cardId: el.dataset ? (el.dataset.cardId || null) : null,
            ownerKey: el.dataset ? (el.dataset.ownerKey || null) : null,
            hidden: !!(el.classList && el.classList.contains('hidden')),
            text: String(el.textContent || '').trim().slice(0, 60)
        }));
        return {
            ownerKey: targetOwnerKey,
            cardCount: cards.length,
            hiddenCount: cards.filter((card) => card.hidden).length,
            cards
        };
    }, ownerKey);
}

async function waitForCondition(blackPage, whitePage, predicate, timeout, description) {
    const startedAt = Date.now();
    let lastStates = null;
    while ((Date.now() - startedAt) < timeout) {
        const [black, white] = await Promise.all([getLiveState(blackPage), getLiveState(whitePage)]);
        lastStates = { black, white };
        if (predicate(black, white)) {
            return lastStates;
        }
        await wait(200);
    }
    const error = new Error(`Timeout: ${description || 'condition not reached'}`);
    error.lastStates = lastStates;
    throw error;
}

async function waitForSynchronizedState(blackPage, whitePage, timeout = STATE_TIMEOUT_MS) {
    return waitForCondition(
        blackPage,
        whitePage,
        (black, white) => (
            black.currentPlayerKey === white.currentPlayerKey
            && black.turnIndex === white.turnIndex
            && black.turnNumber === white.turnNumber
            && boardHash(black.board) === boardHash(white.board)
            && pendingHash(black.pending) === pendingHash(white.pending)
        ),
        timeout,
        'wait for synchronized state'
    );
}

async function waitForTurnActionProgress(blackPage, whitePage, beforeStates, description) {
    const beforeBlack = beforeStates && beforeStates.black ? beforeStates.black : null;
    const beforeWhite = beforeStates && beforeStates.white ? beforeStates.white : null;
    return waitForCondition(
        blackPage,
        whitePage,
        (black, white) => {
            const blackChanged = !!(
                beforeBlack
                && (
                    black.currentPlayerKey !== beforeBlack.currentPlayerKey
                    || black.turnIndex !== beforeBlack.turnIndex
                    || black.turnNumber !== beforeBlack.turnNumber
                    || boardHash(black.board) !== boardHash(beforeBlack.board)
                    || pendingHash(black.pending) !== pendingHash(beforeBlack.pending)
                )
            );
            const whiteChanged = !!(
                beforeWhite
                && (
                    white.currentPlayerKey !== beforeWhite.currentPlayerKey
                    || white.turnIndex !== beforeWhite.turnIndex
                    || white.turnNumber !== beforeWhite.turnNumber
                    || boardHash(white.board) !== boardHash(beforeWhite.board)
                    || pendingHash(white.pending) !== pendingHash(beforeWhite.pending)
                )
            );
            return blackChanged || whiteChanged;
        },
        STATE_TIMEOUT_MS,
        description || 'wait for turn action progress'
    );
}

async function performPlacement(page, playerKey, turnIndex, row, col) {
    const actionResult = await page.evaluate(async ({ actingPlayerKey, actingTurnIndex, targetRow, targetCol }) => {
        try {
            const seatKey = window.NetworkMatchClient && typeof window.NetworkMatchClient.getSeatKey === 'function'
                ? window.NetworkMatchClient.getSeatKey()
                : null;
            if (window.NetworkMatchClient && typeof window.NetworkMatchClient.publishSnapshot === 'function' && seatKey) {
                const result = await window.NetworkMatchClient.publishSnapshot({
                    playerKey: seatKey,
                    actionType: 'place',
                    playbackEvents: [],
                    action: {
                        type: 'place',
                        playerKey: actingPlayerKey,
                        turnIndex: actingTurnIndex,
                        row: targetRow,
                        col: targetCol
                    }
                });
                return Object.assign({ via: 'publishSnapshot' }, result || {});
            }
            if (typeof window.handleCellClick === 'function') {
                window.handleCellClick(targetRow, targetCol);
                return { ok: true, via: 'handleCellClick' };
            }
            const cell = document.querySelector(`#board .cell[data-row="${targetRow}"][data-col="${targetCol}"]`);
            if (cell && typeof cell.click === 'function') {
                cell.click();
                return { ok: true, via: 'dom-click' };
            }
            return { ok: false, reason: 'NO_MOVE_TRIGGER' };
        } catch (e) {
            return { ok: false, reason: e && e.message ? e.message : String(e) };
        }
    }, { actingPlayerKey: playerKey, actingTurnIndex: turnIndex, targetRow: row, targetCol: col });
    if (!actionResult || actionResult.ok !== true) {
        throw new Error(`placement failed: ${actionResult ? actionResult.reason : 'unknown'}`);
    }
}

async function performTurnAction(page, state, actionLog, label) {
    if (!state || state.canAct !== true) {
        throw new Error(`${label || 'turn action'} attempted while page cannot act`);
    }
    if (Array.isArray(state.legalMoves) && state.legalMoves.length > 0) {
        const move = chooseMove(state.legalMoves);
        if (!move) {
            throw new Error(`${label || 'turn action'} could not choose a legal move`);
        }
        actionLog.push({ type: label || 'place', row: move.row, col: move.col });
        await performPlacement(page, state.seatKey, state.turnIndex, move.row, move.col);
        return;
    }
    actionLog.push({ type: label || 'pass' });
    const passResult = await page.evaluate(async ({ actingPlayerKey, actingTurnIndex }) => {
        const seatKey = window.NetworkMatchClient && typeof window.NetworkMatchClient.getSeatKey === 'function'
            ? window.NetworkMatchClient.getSeatKey()
            : null;
        if (window.NetworkMatchClient && typeof window.NetworkMatchClient.publishSnapshot === 'function' && seatKey) {
            const result = await window.NetworkMatchClient.publishSnapshot({
                playerKey: seatKey,
                actionType: 'pass',
                playbackEvents: [],
                action: {
                    type: 'pass',
                    playerKey: actingPlayerKey,
                    turnIndex: actingTurnIndex
                }
            });
            return Object.assign({ via: 'publishSnapshot' }, result || {});
        }
        if (typeof window.passCurrentTurn === 'function') {
            window.passCurrentTurn();
            return { ok: true, via: 'passCurrentTurn' };
        }
        return { ok: false, reason: 'NO_PASS_TRIGGER' };
    }, { actingPlayerKey: state.seatKey, actingTurnIndex: state.turnIndex });
    if (!passResult || passResult.ok !== true) {
        throw new Error(`pass failed: ${passResult ? passResult.reason : 'unknown'}`);
    }
}

async function useCard(page, seatKey, cardId) {
    const before = await getLiveState(page);
    await waitForPlaybackIdle(page);

    const immediate = await page.evaluate(({ playerKey, targetCardId }) => {
        const beforeSelected = window.cardState ? window.cardState.selectedCardId : null;
        window.onCardClick(targetCardId, playerKey);
        const afterSelected = window.cardState ? window.cardState.selectedCardId : null;
        window.useSelectedCard();
        return {
            beforeSelected,
            afterSelected,
            afterUseSelected: window.cardState ? window.cardState.selectedCardId : null,
            hasUsed: !!(
                window.cardState
                && window.cardState.hasUsedCardThisTurnByPlayer
                && window.cardState.hasUsedCardThisTurnByPlayer[playerKey]
            ),
            charge: Number(window.cardState && window.cardState.charge && window.cardState.charge[playerKey]) || 0
        };
    }, { playerKey: seatKey, targetCardId: cardId });

    const beforeHandIds = Array.isArray(before.hand) ? before.hand.map((entry) => entry && entry.id).filter(Boolean) : [];
    const startedAt = Date.now();
    let after = await getLiveState(page);
    while ((Date.now() - startedAt) < PROGRESS_TIMEOUT_MS) {
        const afterHandIds = Array.isArray(after.hand) ? after.hand.map((entry) => entry && entry.id).filter(Boolean) : [];
        const localProgress = (
            after.hasUsedCardThisTurn === true
            || beforeHandIds.join('|') !== afterHandIds.join('|')
            || after.charge !== before.charge
            || !!after.pending
        );
        if (localProgress) {
            return { before, immediate, after };
        }
        await wait(100);
        after = await getLiveState(page);
    }

    const error = new Error(`useCard made no local progress for ${cardId}`);
    error.before = before;
    error.immediate = immediate;
    error.after = after;
    throw error;
}

function summarizeState(state) {
    if (!state || typeof state !== 'object') return null;
    return {
        seatKey: state.seatKey || null,
        currentPlayerKey: state.currentPlayerKey || null,
        canAct: state.canAct === true,
        turnIndex: Number.isFinite(state.turnIndex) ? state.turnIndex : null,
        turnNumber: Number.isFinite(state.turnNumber) ? state.turnNumber : null,
        charge: Number.isFinite(state.charge) ? state.charge : null,
        ownHand: Array.isArray(state.hand) ? state.hand.map((card) => ({
            id: card.id,
            canUse: card.canUse === true,
            cost: card.cost
        })) : [],
        projectedHands: state.projectedHands || { black: [], white: [] },
        pending: state.pending || null,
        legalMoves: Array.isArray(state.legalMoves) ? state.legalMoves.length : 0,
        gameOver: state.gameOver === true
    };
}

function verifyFullReveal(actorState, opponentState, actorKey, opponentKey) {
    const actorProjected = actorState.projectedHands && actorState.projectedHands[opponentKey];
    const opponentOwn = opponentState.projectedHands && opponentState.projectedHands[opponentKey];
    if (!Array.isArray(actorProjected) || !Array.isArray(opponentOwn)) {
        throw new Error('Reveal verification missing opponent hand arrays');
    }
    if (actorProjected.length !== opponentOwn.length || actorProjected.length <= 0) {
        throw new Error(`Reveal hand length mismatch: actor=${actorProjected.length} opponent=${opponentOwn.length}`);
    }
    if (hiddenCount(actorProjected, opponentKey) !== 0) {
        throw new Error(`Reveal still contains hidden tokens: ${JSON.stringify(actorProjected)}`);
    }
    if (JSON.stringify(actorProjected) !== JSON.stringify(opponentOwn)) {
        throw new Error(`Reveal projection mismatch. actor=${JSON.stringify(actorProjected)} opponent=${JSON.stringify(opponentOwn)}`);
    }
    return {
        actorKey,
        opponentKey,
        revealedProjected: actorProjected.slice(),
        opponentOwn: opponentOwn.slice()
    };
}

function verifyPostDrawVisibility(drawCardId, beforeRevealHand, actorState, opponentState, opponentKey) {
    const actorProjected = actorState.projectedHands && actorState.projectedHands[opponentKey];
    const opponentOwn = opponentState.projectedHands && opponentState.projectedHands[opponentKey];
    if (!Array.isArray(actorProjected) || !Array.isArray(opponentOwn)) {
        throw new Error('Post-draw verification missing opponent hand arrays');
    }
    if (actorProjected.length !== opponentOwn.length) {
        throw new Error(`Post-draw hand length mismatch: actor=${actorProjected.length} opponent=${opponentOwn.length}`);
    }

    const hidden = hiddenCount(actorProjected, opponentKey);
    if (drawCardId === 'rebuild_01') {
        if (actorProjected.length <= 0) {
            throw new Error('Rebuild left no cards to verify');
        }
        if (hidden !== actorProjected.length) {
            throw new Error(`Expected every rebuilt card to be hidden, got ${JSON.stringify(actorProjected)}`);
        }
        return {
            mode: 'rebuild',
            actorProjected: actorProjected.slice(),
            opponentOwn: opponentOwn.slice(),
            hiddenCount: hidden
        };
    }

    if (hidden <= 0) {
        throw new Error(`Expected supply to introduce hidden cards, got ${JSON.stringify(actorProjected)}`);
    }
    if (actorProjected.length <= beforeRevealHand.length) {
        throw new Error(`Expected supply to increase hand size beyond ${beforeRevealHand.length}, got ${actorProjected.length}`);
    }
    const visibleEntries = actorProjected.filter((value) => !isHiddenToken(value, opponentKey));
    const missingVisible = beforeRevealHand.filter((value) => !visibleEntries.includes(value));
    if (missingVisible.length > 0) {
        throw new Error(`Supply hid previously revealed cards unexpectedly: ${JSON.stringify({ beforeRevealHand, actorProjected })}`);
    }
    return {
        mode: 'supply',
        actorProjected: actorProjected.slice(),
        opponentOwn: opponentOwn.slice(),
        hiddenCount: hidden
    };
}

async function captureStageArtifacts(blackPage, whitePage, attemptIndex, stageLabel) {
    const blackPath = path.join(OUT_DIR, `reveal-hand-attempt${attemptIndex}-${stageLabel}-black.png`);
    const whitePath = path.join(OUT_DIR, `reveal-hand-attempt${attemptIndex}-${stageLabel}-white.png`);
    await blackPage.screenshot({ path: blackPath, fullPage: true });
    await whitePage.screenshot({ path: whitePath, fullPage: true });
    return { blackPath, whitePath };
}

async function runAttempt(attemptIndex) {
    const blackBrowser = await chromium.launch({
        headless: HEADLESS,
        slowMo: SLOW_MO_MS,
        channel: process.env.BLACK_CHANNEL || process.env.CHANNEL || undefined
    });
    const whiteBrowser = await chromium.launch({
        headless: HEADLESS,
        slowMo: SLOW_MO_MS,
        channel: process.env.WHITE_CHANNEL || process.env.CHANNEL || undefined
    });
    const blackContext = await blackBrowser.newContext({ viewport: VIEWPORT });
    const whiteContext = await whiteBrowser.newContext({ viewport: VIEWPORT });
    const blackPage = await blackContext.newPage();
    const whitePage = await whiteContext.newPage();
    const deckCode = buildDeckCode();
    const attempt = {
        attempt: attemptIndex,
        ok: false,
        roomId: null,
        headless: HEADLESS,
        deckCode,
        actionLog: [],
        pageEvents: [],
        verification: null,
        final: null,
        error: null,
        screenshots: {}
    };

    installPageObservers(blackPage, 'black', attempt);
    installPageObservers(whitePage, 'white', attempt);

    try {
        writeProgress({ phase: 'attempt_start', attemptIndex, baseUrl: BASE_URL, serverUrl: SERVER_URL, headless: HEADLESS });
        await Promise.all([
            blackPage.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS }),
            whitePage.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS })
        ]);
        await Promise.all([waitForGameReady(blackPage), waitForGameReady(whitePage)]);

        const roomId = await createRoom(blackPage, `B${attemptIndex}`, deckCode);
        attempt.roomId = roomId;
        await joinRoom(whitePage, roomId, `W${attemptIndex}`, deckCode);
        await Promise.all([waitForTwoPlayers(blackPage), waitForTwoPlayers(whitePage)]);
        await Promise.all([closeNetworkOverlayIfOpen(blackPage), closeNetworkOverlayIfOpen(whitePage)]);
        await wait(1200);
        await Promise.all([waitForPlaybackIdle(blackPage), waitForPlaybackIdle(whitePage)]);
        await publishDebugFillHand(blackPage, 'black');
        await publishDebugFillHand(whitePage, 'white');
        await Promise.all([waitForPlaybackIdle(blackPage), waitForPlaybackIdle(whitePage)]);
        await wait(250);

        let phase = 'search';
        let revealActorKey = null;
        let revealOpponentKey = null;
        let drawCardId = null;
        let revealedHand = null;

        for (let actionIndex = 0; actionIndex < MAX_ACTIONS; actionIndex += 1) {
            const synced = await waitForSynchronizedState(blackPage, whitePage, STATE_TIMEOUT_MS);
            attempt.actionLog.push({
                type: 'synced_state',
                index: actionIndex,
                black: summarizeState(synced.black),
                white: summarizeState(synced.white)
            });
            writeProgress({
                phase,
                attemptIndex,
                actionIndex,
                roomId,
                black: summarizeState(synced.black),
                white: summarizeState(synced.white)
            });

            if (synced.black.gameOver || synced.white.gameOver) {
                throw new Error(`Game reached gameOver during ${phase}`);
            }

            if (phase === 'search') {
                const actorKey = synced.black.currentPlayerKey;
                const opponentKey = getOpponentKey(actorKey);
                const actorState = synced[actorKey];
                const opponentState = synced[opponentKey];
                const revealCard = Array.isArray(actorState.hand)
                    ? actorState.hand.find((entry) => entry && entry.id === TARGET_CARD_ID && entry.canUse === true)
                    : null;
                const usableDrawCard = Array.isArray(opponentState.hand)
                    ? opponentState.hand.find((entry) => entry && entry.id === 'rebuild_01')
                    : null;

                if (revealCard && usableDrawCard) {
                    const actorPage = actorKey === 'white' ? whitePage : blackPage;
                    attempt.actionLog.push({
                        type: 'use_reveal_card',
                        actorKey,
                        opponentKey,
                        drawCardId: usableDrawCard.id,
                        actorState: summarizeState(actorState),
                        opponentState: summarizeState(opponentState)
                    });
                    await Promise.all([waitForPlaybackIdle(blackPage), waitForPlaybackIdle(whitePage)]);
                    await useCard(actorPage, actorKey, TARGET_CARD_ID);
                    await Promise.all([waitForPlaybackIdle(blackPage), waitForPlaybackIdle(whitePage)]);
                    await wait(150);

                    const afterReveal = await waitForSynchronizedState(blackPage, whitePage, STATE_TIMEOUT_MS);
                    const revealCheck = verifyFullReveal(afterReveal[actorKey], afterReveal[opponentKey], actorKey, opponentKey);
                    const revealDom = await getHandDomState(actorPage, opponentKey);
                    if (revealDom.hiddenCount !== 0) {
                        throw new Error(`Opponent hand DOM still hidden after reveal: ${JSON.stringify(revealDom)}`);
                    }
                    attempt.screenshots.afterReveal = await captureStageArtifacts(blackPage, whitePage, attemptIndex, 'after-reveal');

                    revealActorKey = actorKey;
                    revealOpponentKey = opponentKey;
                    drawCardId = usableDrawCard.id;
                    revealedHand = revealCheck.opponentOwn.slice();
                    phase = 'post_reveal_turn';
                    attempt.verification = Object.assign({}, attempt.verification, {
                        revealCheck,
                        revealDom
                    });
                    continue;
                }
            }

            if (phase === 'post_reveal_turn') {
                const actorPage = revealActorKey === 'white' ? whitePage : blackPage;
                const actorState = synced[revealActorKey];
                if (actorState.canAct !== true) {
                    throw new Error(`Expected ${revealActorKey} to act after reveal card usage`);
                }
                await performTurnAction(actorPage, actorState, attempt.actionLog, `${revealActorKey}_post_reveal_turn`);
                await waitForTurnActionProgress(blackPage, whitePage, synced, 'wait for post-reveal turn progress');
                await Promise.all([waitForPlaybackIdle(blackPage), waitForPlaybackIdle(whitePage)]);
                await wait(150);

                const preDraw = await waitForSynchronizedState(blackPage, whitePage, STATE_TIMEOUT_MS);
                const preDrawCheck = verifyFullReveal(preDraw[revealActorKey], preDraw[revealOpponentKey], revealActorKey, revealOpponentKey);
                const actorPageAfterTurn = revealActorKey === 'white' ? whitePage : blackPage;
                const preDrawDom = await getHandDomState(actorPageAfterTurn, revealOpponentKey);
                if (preDrawDom.hiddenCount !== 0) {
                    throw new Error(`Opponent hand DOM re-hidden before future draw: ${JSON.stringify(preDrawDom)}`);
                }
                attempt.screenshots.beforeFutureDraw = await captureStageArtifacts(blackPage, whitePage, attemptIndex, 'before-future-draw');
                attempt.verification = Object.assign({}, attempt.verification, {
                    preDrawCheck,
                    preDrawDom
                });
                phase = 'future_draw';
                continue;
            }

            if (phase === 'future_draw') {
                const opponentState = synced[revealOpponentKey];
                if (opponentState.canAct !== true) {
                    throw new Error(`Expected ${revealOpponentKey} to act for future draw verification`);
                }
                const drawCard = Array.isArray(opponentState.hand)
                    ? opponentState.hand.find((entry) => entry && entry.id === drawCardId && entry.canUse === true)
                    : null;
                if (!drawCard) {
                    throw new Error(`Expected opponent draw card ${drawCardId} to remain usable after reveal`);
                }

                const opponentPage = revealOpponentKey === 'white' ? whitePage : blackPage;
                attempt.actionLog.push({
                    type: 'use_draw_card_after_reveal',
                    actorKey: revealActorKey,
                    opponentKey: revealOpponentKey,
                    drawCardId,
                    opponentState: summarizeState(opponentState)
                });
                await useCard(opponentPage, revealOpponentKey, drawCardId);
                await Promise.all([waitForPlaybackIdle(blackPage), waitForPlaybackIdle(whitePage)]);
                await wait(150);

                const afterFutureDraw = await waitForSynchronizedState(blackPage, whitePage, STATE_TIMEOUT_MS);
                const postDrawCheck = verifyPostDrawVisibility(
                    drawCardId,
                    revealedHand,
                    afterFutureDraw[revealActorKey],
                    afterFutureDraw[revealOpponentKey],
                    revealOpponentKey
                );
                const actorPage = revealActorKey === 'white' ? whitePage : blackPage;
                const postDrawDom = await getHandDomState(actorPage, revealOpponentKey);
                if (drawCardId === 'rebuild_01' && postDrawDom.hiddenCount !== postDrawDom.cardCount) {
                    throw new Error(`Rebuild DOM should be fully hidden for actor view: ${JSON.stringify(postDrawDom)}`);
                }
                if (drawCardId === 'supply_01' && postDrawDom.hiddenCount <= 0) {
                    throw new Error(`Supply DOM should contain hidden future draws: ${JSON.stringify(postDrawDom)}`);
                }
                attempt.screenshots.afterFutureDraw = await captureStageArtifacts(blackPage, whitePage, attemptIndex, 'after-future-draw');
                attempt.verification = Object.assign({}, attempt.verification, {
                    actorKey: revealActorKey,
                    opponentKey: revealOpponentKey,
                    drawCardId,
                    postDrawCheck,
                    postDrawDom
                });
                attempt.ok = true;
                break;
            }

            const actingPage = synced.black.currentPlayerKey === 'white' ? whitePage : blackPage;
            const actingState = synced.black.currentPlayerKey === 'white' ? synced.white : synced.black;
            await performTurnAction(actingPage, actingState, attempt.actionLog, `${actingState.currentPlayerKey}_turn_${actionIndex}`);
            await waitForTurnActionProgress(blackPage, whitePage, synced, `wait for ${actingState.currentPlayerKey} turn progress`);
            await Promise.all([waitForPlaybackIdle(blackPage), waitForPlaybackIdle(whitePage)]);
        }

        if (!attempt.ok) {
            throw new Error(`Reveal-hand verification did not complete within ${MAX_ACTIONS} actions`);
        }
    } catch (error) {
        attempt.error = error && error.stack ? error.stack : String(error);
        try {
            attempt.screenshots.error = await captureStageArtifacts(blackPage, whitePage, attemptIndex, 'error');
        } catch (captureError) {
            // ignore capture failure
        }
    } finally {
        try {
            attempt.final = {
                black: summarizeState(await getLiveState(blackPage)),
                white: summarizeState(await getLiveState(whitePage))
            };
        } catch (e) {
            // ignore final snapshot failure
        }
        try {
            await blackPage.evaluate(async () => {
                if (window.NetworkMatchClient && typeof window.NetworkMatchClient.leaveRoom === 'function') {
                    await window.NetworkMatchClient.leaveRoom();
                }
            });
        } catch (e) {
            // ignore
        }
        try {
            await whitePage.evaluate(async () => {
                if (window.NetworkMatchClient && typeof window.NetworkMatchClient.leaveRoom === 'function') {
                    await window.NetworkMatchClient.leaveRoom();
                }
            });
        } catch (e) {
            // ignore
        }
        await Promise.allSettled([
            blackContext.close(),
            whiteContext.close(),
            blackBrowser.close(),
            whiteBrowser.close()
        ]);
    }

    return attempt;
}

async function main() {
    const result = {
        ok: false,
        target: TARGET_CARD_ID,
        baseUrl: BASE_URL,
        serverUrl: SERVER_URL,
        headless: HEADLESS,
        timestamp: new Date().toISOString(),
        attempts: []
    };

    for (let attemptIndex = 1; attemptIndex <= MAX_ATTEMPTS; attemptIndex += 1) {
        const attempt = await runAttempt(attemptIndex);
        result.attempts.push(attempt);
        writeJson(RESULT_PATH, result);
        if (attempt.ok) {
            result.ok = true;
            break;
        }
    }

    writeJson(RESULT_PATH, result);
    if (result.ok) {
        process.stdout.write(`reveal-hand network verification succeeded: ${RESULT_PATH}\n`);
        process.exit(0);
    }
    process.stderr.write(`reveal-hand network verification failed: ${RESULT_PATH}\n`);
    process.exit(1);
}

main().catch((error) => {
    const result = {
        ok: false,
        target: TARGET_CARD_ID,
        baseUrl: BASE_URL,
        serverUrl: SERVER_URL,
        headless: HEADLESS,
        timestamp: new Date().toISOString(),
        fatalError: error && error.stack ? error.stack : String(error)
    };
    writeJson(RESULT_PATH, result);
    process.stderr.write(`reveal-hand network verification crashed: ${RESULT_PATH}\n`);
    process.exit(1);
});
