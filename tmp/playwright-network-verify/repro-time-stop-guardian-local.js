const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8000';
const SERVER_URL = process.env.SERVER_URL || 'http://127.0.0.1:8787';
const VIEWPORT = { width: 1440, height: 1200 };
const OUT_DIR = path.join(process.cwd(), 'tmp', 'playwright-network-verify');
const RESULT_PATH = process.env.RESULT_PATH
    ? path.resolve(process.cwd(), String(process.env.RESULT_PATH))
    : path.join(OUT_DIR, 'time-stop-guardian-local-result.json');
const PROGRESS_PATH = process.env.PROGRESS_PATH
    ? path.resolve(process.cwd(), String(process.env.PROGRESS_PATH))
    : path.join(OUT_DIR, 'time-stop-guardian-local-progress.json');
const SCREENSHOT_BLACK_PATH = path.join(OUT_DIR, 'time-stop-guardian-local-black-final.png');
const SCREENSHOT_WHITE_PATH = path.join(OUT_DIR, 'time-stop-guardian-local-white-final.png');
const ERROR_SCREENSHOT_BLACK_PATH = path.join(OUT_DIR, 'time-stop-guardian-local-black-error.png');
const ERROR_SCREENSHOT_WHITE_PATH = path.join(OUT_DIR, 'time-stop-guardian-local-white-error.png');
const PAGE_TIMEOUT_MS = 30000;
const PLAYBACK_TIMEOUT_MS = 20000;
const STATE_TIMEOUT_MS = 25000;
const MATCH_TIMEOUT_MS = 7 * 60 * 1000;
const MAX_ACTIONS = 120;
const HEADLESS = !/^(0|false)$/i.test(String(process.env.HEADLESS || '0'));
const SLOW_MO_MS = Math.max(0, Number(process.env.SLOW_MO_MS || 150) || 0);
const MAX_EVENT_LOG = 120;
const TARGET_CARD_IDS = {
    timeStop: 'time_stop_god_01',
    robotVacuum: 'robot_vacuum_01',
    guardian: 'guardian_god_01'
};

fs.mkdirSync(OUT_DIR, { recursive: true });

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function logLine(message) {
    process.stdout.write(`${message}\n`);
}

function writeJson(filePath, value) {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function writeProgress(payload) {
    writeJson(PROGRESS_PATH, Object.assign({
        timestamp: new Date().toISOString()
    }, payload || {}));
}

function appendLimited(list, value, max = MAX_EVENT_LOG) {
    list.push(value);
    if (list.length > max) {
        list.splice(0, list.length - max);
    }
}

function isMatchApiUrl(url) {
    return /\/api\/match\//.test(String(url || ''));
}

function normalizePlayerKey(value) {
    if (value === -1 || value === 'white' || value === '-1') return 'white';
    return 'black';
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

function pendingByPlayerHash(pendingByPlayer) {
    if (!pendingByPlayer || typeof pendingByPlayer !== 'object') return '';
    try {
        return JSON.stringify(pendingByPlayer);
    } catch (e) {
        return '';
    }
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

function collectCellsByOwner(state, ownerKey) {
    const playerValue = ownerKey === 'white' ? -1 : 1;
    const candidates = [];
    const board = Array.isArray(state && state.board) ? state.board : [];
    for (let row = 0; row < board.length; row += 1) {
        const line = Array.isArray(board[row]) ? board[row] : [];
        for (let col = 0; col < line.length; col += 1) {
            if (Number(line[col]) === playerValue) {
                candidates.push({ row, col });
            }
        }
    }
    candidates.sort((left, right) => {
        const leftEdge = (left.row === 0 || left.row === 7 || left.col === 0 || left.col === 7) ? 1 : 0;
        const rightEdge = (right.row === 0 || right.row === 7 || right.col === 0 || right.col === 7) ? 1 : 0;
        if (leftEdge !== rightEdge) return leftEdge - rightEdge;
        if (left.row !== right.row) return left.row - right.row;
        return left.col - right.col;
    });
    return candidates;
}

function installPageObservers(page, browserName, result) {
    page.on('console', (message) => {
        const type = typeof message.type === 'function' ? message.type() : 'log';
        if (type !== 'error' && type !== 'warning') return;
        appendLimited(result.pageEvents, {
            time: new Date().toISOString(),
            browser: browserName,
            kind: 'console',
            type,
            text: typeof message.text === 'function' ? message.text() : ''
        });
    });
    page.on('requestfailed', (request) => {
        if (!isMatchApiUrl(typeof request.url === 'function' ? request.url() : '')) return;
        const failure = typeof request.failure === 'function' ? request.failure() : null;
        appendLimited(result.pageEvents, {
            time: new Date().toISOString(),
            browser: browserName,
            kind: 'requestfailed',
            url: typeof request.url === 'function' ? request.url() : '',
            method: typeof request.method === 'function' ? request.method() : '',
            failure: failure && failure.errorText ? failure.errorText : null
        });
    });
    page.on('response', (response) => {
        const url = typeof response.url === 'function' ? response.url() : '';
        const status = typeof response.status === 'function' ? response.status() : 0;
        if (!isMatchApiUrl(url) || status < 400) return;
        appendLimited(result.pageEvents, {
            time: new Date().toISOString(),
            browser: browserName,
            kind: 'response',
            status,
            url
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
                && typeof window.setDebugModeEnabled === 'function'
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
            const movingCard = !!(layer && layer.querySelector('.card-item.visible'));
            const heldDrawCard = !!(wrapper && wrapper.querySelector('.held-draw-card'));
            const layerVisible = !!(layer && layer.style && layer.style.display === 'block');
            const animationEnginePlaying = !!(window.AnimationEngine && window.AnimationEngine.isPlaying === true);
            return {
                VisualPlaybackActive: window.VisualPlaybackActive === true,
                isCardAnimating: window.isCardAnimating === true,
                isProcessing: window.isProcessing === true,
                movingCard,
                heldDrawCard,
                layerVisible,
                animationEnginePlaying
            };
        }
        while ((Date.now() - startedAt) < timeoutMs) {
            try {
                if (typeof window.waitForPlaybackIdle === 'function') {
                    await window.waitForPlaybackIdle();
                }
            } catch (e) {
                // fall through
            }
            const busy = getBusyDiagnostics();
            const isBusy = !!(
                busy.VisualPlaybackActive
                || busy.isCardAnimating
                || busy.isProcessing
                || busy.movingCard
                || busy.heldDrawCard
                || busy.layerVisible
                || busy.animationEnginePlaying
            );
            if (!isBusy) return true;
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
        // best-effort only
    }
}

async function createRoom(page, playerName) {
    await ensureNetworkMode(page);
    const result = await page.evaluate(async ({ playerName, serverUrl }) => {
        return window.NetworkMatchClient.createRoom({ playerName, serverUrl, networkDebugEnabled: true });
    }, { playerName, serverUrl: SERVER_URL });
    if (!result || result.ok !== true) {
        throw new Error(`createRoom failed: ${result && result.reason ? result.reason : 'UNKNOWN'}`);
    }
    return result;
}

async function joinRoom(page, roomId, playerName) {
    await ensureNetworkMode(page);
    const result = await page.evaluate(async ({ roomId, playerName, serverUrl }) => {
        return window.NetworkMatchClient.joinRoom(roomId, { playerName, serverUrl });
    }, { roomId, playerName, serverUrl: SERVER_URL });
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

async function getLiveState(page) {
    return page.evaluate(() => {
        const networkState = window.NetworkMatchClient && typeof window.NetworkMatchClient.getState === 'function'
            ? window.NetworkMatchClient.getState()
            : null;
        const publishOperations = networkState && networkState.publishTracker && Array.isArray(networkState.publishTracker.operations)
            ? networkState.publishTracker.operations
            : [];
        function cloneBoard(board) {
            return Array.isArray(board) ? board.map((row) => Array.isArray(row) ? row.slice() : []) : [];
        }
        const currentPlayerValue = window.gameState ? window.gameState.currentPlayer : null;
        const currentPlayerKey = (currentPlayerValue === -1 || currentPlayerValue === 'white' || currentPlayerValue === '-1')
            ? 'white'
            : 'black';
        const seatKey = window.NetworkMatchClient && typeof window.NetworkMatchClient.getSeatKey === 'function'
            ? window.NetworkMatchClient.getSeatKey()
            : null;
        const pending = window.cardState && window.cardState.pendingEffectByPlayer
            ? window.cardState.pendingEffectByPlayer[seatKey] || null
            : null;
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
        let legalMoves = [];
        try {
            const protection = typeof window.getActiveProtectionForPlayer === 'function'
                ? window.getActiveProtectionForPlayer(currentPlayerValue)
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
        const handIds = window.cardState && window.cardState.hands && Array.isArray(window.cardState.hands[seatKey])
            ? window.cardState.hands[seatKey].slice()
            : [];
        const hand = handIds.map((cardId) => {
            const cardDef = window.CardLogic && typeof window.CardLogic.getCardDef === 'function'
                ? window.CardLogic.getCardDef(cardId)
                : null;
            let canUse = false;
            try {
                if (
                    window.CardLogic
                    && typeof window.CardLogic.getUsableCardIds === 'function'
                    && window.gameState
                ) {
                    const usableIds = window.CardLogic.getUsableCardIds(window.cardState, window.gameState, seatKey) || [];
                    canUse = Array.isArray(usableIds) && usableIds.includes(cardId);
                } else {
                    canUse = !!(
                        window.CardLogic
                        && typeof window.CardLogic.canUseCard === 'function'
                        && window.CardLogic.canUseCard(window.cardState, seatKey, cardId)
                    );
                }
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
        const markers = Array.isArray(window.cardState && window.cardState.markers)
            ? window.cardState.markers.map((marker) => ({
                row: Number(marker.row),
                col: Number(marker.col),
                kind: marker.kind || null,
                owner: marker.owner || null,
                data: marker.data ? {
                    type: marker.data.type || null,
                    remainingOwnerTurns: Number.isFinite(Number(marker.data.remainingOwnerTurns))
                        ? Number(marker.data.remainingOwnerTurns)
                        : null
                } : null
            }))
            : [];
        const timeStopConsecutiveTurnsRemainingByPlayer = window.cardState && window.cardState.timeStopConsecutiveTurnsRemainingByPlayer
            ? {
                black: Number(window.cardState.timeStopConsecutiveTurnsRemainingByPlayer.black || 0),
                white: Number(window.cardState.timeStopConsecutiveTurnsRemainingByPlayer.white || 0)
            }
            : { black: 0, white: 0 };
        return {
            seatKey,
            currentPlayerKey,
            turnIndex: Number.isFinite(Number(window.cardState && window.cardState.turnIndex))
                ? Number(window.cardState.turnIndex)
                : null,
            turnNumber: Number.isFinite(Number(window.gameState && window.gameState.turnNumber))
                ? Number(window.gameState.turnNumber)
                : null,
            canAct: seatKey === currentPlayerKey,
            board: cloneBoard(window.gameState && window.gameState.board),
            hand,
            charge: Number(window.cardState && window.cardState.charge && window.cardState.charge[seatKey]) || 0,
            hasUsedCardThisTurn: !!(window.cardState && window.cardState.hasUsedCardThisTurnByPlayer && window.cardState.hasUsedCardThisTurnByPlayer[seatKey]),
            pending: pending ? JSON.parse(JSON.stringify(pending)) : null,
            pendingByPlayer,
            legalMoves: Array.isArray(legalMoves)
                ? legalMoves
                    .filter((move) => move && Number.isInteger(Number(move.row)) && Number.isInteger(Number(move.col)))
                    .map((move) => ({
                        row: Number(move.row),
                        col: Number(move.col),
                        flips: Array.isArray(move.flips) ? move.flips.length : Number(move.flipCount || 0)
                    }))
                : [],
            markers,
            timeStopConsecutiveTurnsRemainingByPlayer,
            debugUnlimited: window.DEBUG_UNLIMITED_USAGE === true,
            networkDebugEnabled: !!(networkState && networkState.networkDebugEnabled === true),
            networkStateVersion: (networkState && Number.isFinite(Number(networkState.stateVersion)))
                ? Number(networkState.stateVersion)
                : null,
            networkUnsettledPublishes: publishOperations.filter((entry) => !entry || !entry.completedAt).length,
            networkPendingResponses: publishOperations.filter((entry) => entry && entry.responseSettled !== true).length,
            busy: {
                VisualPlaybackActive: window.VisualPlaybackActive === true,
                isProcessing: window.isProcessing === true,
                isCardAnimating: window.isCardAnimating === true,
                animationEnginePlaying: !!(window.AnimationEngine && window.AnimationEngine.isPlaying === true)
            },
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

async function waitForNetworkIdle(page, timeout = STATE_TIMEOUT_MS, minStateVersion = null) {
    await page.waitForFunction((expected) => {
        const client = window.NetworkMatchClient;
        if (!client || typeof client.getState !== 'function') return false;
        const state = client.getState();
        if (!state || !state.publishTracker || !Array.isArray(state.publishTracker.operations)) return false;
        const operations = state.publishTracker.operations;
        const allResponsesSettled = operations.every((entry) => entry && entry.responseSettled === true);
        const version = Number.isFinite(Number(state.stateVersion)) ? Number(state.stateVersion) : null;
        if (Number.isFinite(Number(expected.minStateVersion)) && version !== null && version < Number(expected.minStateVersion)) {
            return false;
        }
        return allResponsesSettled;
    }, { timeout }, { minStateVersion });
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

async function waitForSynchronizedState(blackPage, whitePage, timeout) {
    return waitForCondition(
        blackPage,
        whitePage,
        (black, white) => (
            black.currentPlayerKey === white.currentPlayerKey
            && black.turnIndex === white.turnIndex
            && black.turnNumber === white.turnNumber
            && boardHash(black.board) === boardHash(white.board)
            && pendingByPlayerHash(black.pendingByPlayer) === pendingByPlayerHash(white.pendingByPlayer)
        ),
        timeout,
        'wait for synchronized state'
    );
}

async function performPlacement(page, row, col) {
    const cell = page.locator(`#board .cell[data-row="${row}"][data-col="${col}"]`);
    await cell.click();
}

async function performTurnAction(page, state, actionLog, label) {
    if (!state || state.canAct !== true) {
        throw new Error(`${label || 'turn action'} attempted while page cannot act`);
    }
    await waitForPlaybackIdle(page);
    if (Array.isArray(state.legalMoves) && state.legalMoves.length > 0) {
        const move = chooseMove(state.legalMoves);
        if (!move) {
            throw new Error(`${label || 'turn action'} could not choose a legal move`);
        }
        actionLog.push({ type: label || 'place', row: move.row, col: move.col });
        await performPlacement(page, move.row, move.col);
        return move;
    }
    actionLog.push({ type: label || 'pass' });
    await page.evaluate(() => {
        if (typeof window.passCurrentTurn === 'function') window.passCurrentTurn();
    });
    return null;
}

async function useTargetCard(page, seatKey, cardId) {
    await waitForPlaybackIdle(page);
    const result = await page.evaluate(({ seatKey, cardId }) => {
        const useBtn = document.getElementById('use-card-btn');
        const reasonEl = document.getElementById('use-card-reason');
        const beforeSelected = window.cardState ? window.cardState.selectedCardId : null;
        const beforeUseDisabled = useBtn ? !!useBtn.disabled : null;
        const beforeUseReason = reasonEl ? String(reasonEl.textContent || '') : '';
        window.onCardClick(cardId, seatKey);
        const afterSelected = window.cardState ? window.cardState.selectedCardId : null;
        const afterSelectUseDisabled = useBtn ? !!useBtn.disabled : null;
        const afterSelectUseReason = reasonEl ? String(reasonEl.textContent || '') : '';
        window.useSelectedCard();
        const pending = window.cardState && window.cardState.pendingEffectByPlayer
            ? window.cardState.pendingEffectByPlayer[seatKey] || null
            : null;
        return {
            beforeSelected,
            beforeUseDisabled,
            beforeUseReason,
            afterSelected,
            afterSelectUseDisabled,
            afterSelectUseReason,
            afterUseSelected: window.cardState ? window.cardState.selectedCardId : null,
            afterUseDisabled: useBtn ? !!useBtn.disabled : null,
            afterUseReason: reasonEl ? String(reasonEl.textContent || '') : '',
            pending: pending ? JSON.parse(JSON.stringify(pending)) : null
        };
    }, { seatKey, cardId });
    await wait(200);
    return result;
}

async function setDebugModeEnabled(page) {
    const result = await page.evaluate(() => {
        if (typeof window.setDebugModeEnabled !== 'function') {
            throw new Error('setDebugModeEnabled is not available');
        }
        return window.setDebugModeEnabled(true);
    });
    if (result !== true) {
        throw new Error(`setDebugModeEnabled returned ${String(result)}`);
    }
}

async function ensureBlackDebugHand(blackPage, blackPageName, result) {
    await setDebugModeEnabled(blackPage);
    appendLimited(result.pageEvents, {
        time: new Date().toISOString(),
        browser: blackPageName,
        kind: 'debug',
        detail: 'setDebugModeEnabled(true)'
    });
    await waitForCondition(
        blackPage,
        blackPage,
        (left) => {
            const handIds = Array.isArray(left.hand) ? left.hand.map((entry) => entry && entry.id) : [];
            return left.debugUnlimited === true
                && handIds.includes(TARGET_CARD_IDS.timeStop)
                && handIds.includes(TARGET_CARD_IDS.robotVacuum)
                && handIds.includes(TARGET_CARD_IDS.guardian);
        },
        STATE_TIMEOUT_MS,
        'wait for black debug hand'
    );
    await waitForNetworkIdle(blackPage, STATE_TIMEOUT_MS, 1);
}

async function resolveGuardianSelection(actorPage, actorSeatKey, blackPage, whitePage, actionLog) {
    const initial = await waitForCondition(
        blackPage,
        whitePage,
        (black, white) => {
            const bPending = black.pendingByPlayer && black.pendingByPlayer[actorSeatKey];
            const wPending = white.pendingByPlayer && white.pendingByPlayer[actorSeatKey];
            return !!(bPending && wPending && bPending.type === 'GUARDIAN_GOD' && wPending.type === 'GUARDIAN_GOD');
        },
        STATE_TIMEOUT_MS,
        'wait for GUARDIAN_GOD pending selection'
    );
    actionLog.push({ type: 'guardian_pending_ready', black: initial.black, white: initial.white });
    const actorState = actorSeatKey === 'white' ? initial.white : initial.black;
    const beforePending = pendingHash(actorState.pending);
    const beforeTurnIndex = actorState.turnIndex;
    const beforeBoard = boardHash(actorState.board);
    const candidates = collectCellsByOwner(actorState, actorSeatKey);
    if (!Array.isArray(candidates) || candidates.length <= 0) {
        throw new Error('No guard target candidates found');
    }
    for (const candidate of candidates) {
        actionLog.push({ type: 'guardian_target_attempt', candidate });
        await performPlacement(actorPage, candidate.row, candidate.col);
        try {
            const progressed = await waitForCondition(
                blackPage,
                whitePage,
                (black, white) => (
                    pendingHash(black.pending) !== beforePending
                    || pendingHash(white.pending) !== beforePending
                    || black.turnIndex !== beforeTurnIndex
                    || white.turnIndex !== beforeTurnIndex
                    || boardHash(black.board) !== beforeBoard
                    || boardHash(white.board) !== beforeBoard
                ),
                5000,
                'wait for guardian target progress'
            );
            actionLog.push({ type: 'guardian_target_progress', candidate, black: progressed.black, white: progressed.white });
            return progressed;
        } catch (e) {
            actionLog.push({ type: 'guardian_target_rejected', candidate });
        }
    }
    throw new Error('Unable to resolve GUARDIAN_GOD target selection');
}

async function main() {
    const startedAt = Date.now();
    const result = {
        ok: false,
        baseUrl: BASE_URL,
        serverUrl: SERVER_URL,
        headless: HEADLESS,
        slowMoMs: SLOW_MO_MS,
        roomId: null,
        actionLog: [],
        pageEvents: [],
        snapshots: {},
        error: null
    };
    let browser = null;
    let blackContext = null;
    let whiteContext = null;
    let blackPage = null;
    let whitePage = null;
    try {
        browser = await chromium.launch({ headless: HEADLESS, slowMo: SLOW_MO_MS });
        blackContext = await browser.newContext({ viewport: VIEWPORT });
        whiteContext = await browser.newContext({ viewport: VIEWPORT });
        blackPage = await blackContext.newPage();
        whitePage = await whiteContext.newPage();
        installPageObservers(blackPage, 'black', result);
        installPageObservers(whitePage, 'white', result);

        await Promise.all([
            blackPage.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS }),
            whitePage.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS })
        ]);
        await Promise.all([waitForGameReady(blackPage), waitForGameReady(whitePage)]);

        const created = await createRoom(blackPage, 'DBG-B');
        result.roomId = created.roomId;
        result.actionLog.push({ type: 'room_created', roomId: created.roomId, networkDebugEnabled: created.networkDebugEnabled === true });
        const joined = await joinRoom(whitePage, created.roomId, 'DBG-W');
        result.actionLog.push({ type: 'room_joined', networkDebugEnabled: joined.networkDebugEnabled === true });
        await Promise.all([waitForTwoPlayers(blackPage), waitForTwoPlayers(whitePage)]);
        await Promise.all([closeNetworkOverlayIfOpen(blackPage), closeNetworkOverlayIfOpen(whitePage)]);
        await wait(1200);
        await Promise.all([waitForPlaybackIdle(blackPage), waitForPlaybackIdle(whitePage)]);

        await ensureBlackDebugHand(blackPage, 'black', result);
        const syncedAfterDebug = await waitForSynchronizedState(blackPage, whitePage, STATE_TIMEOUT_MS);
        result.actionLog.push({ type: 'debug_ready', black: syncedAfterDebug.black, white: syncedAfterDebug.white });

        let phase = 'setup_time_stop';
        let blackBonusTurnsAfterTrigger = null;
        let matchTimedOut = false;
        const hardDeadline = startedAt + MATCH_TIMEOUT_MS;

        for (let actionIndex = 0; actionIndex < MAX_ACTIONS; actionIndex += 1) {
            if (Date.now() > hardDeadline) {
                matchTimedOut = true;
                break;
            }
            const synced = await waitForSynchronizedState(blackPage, whitePage, STATE_TIMEOUT_MS);
            result.snapshots[`step_${actionIndex}`] = {
                black: synced.black,
                white: synced.white,
                phase
            };
            writeProgress({
                phase,
                actionIndex,
                roomId: result.roomId,
                black: {
                    currentPlayerKey: synced.black.currentPlayerKey,
                    turnNumber: synced.black.turnNumber,
                    turnIndex: synced.black.turnIndex,
                    hand: synced.black.hand,
                    pending: synced.black.pending,
                    markers: synced.black.markers,
                    bonusTurns: synced.black.timeStopConsecutiveTurnsRemainingByPlayer
                },
                white: {
                    currentPlayerKey: synced.white.currentPlayerKey,
                    turnNumber: synced.white.turnNumber,
                    turnIndex: synced.white.turnIndex,
                    hand: synced.white.hand,
                    pending: synced.white.pending,
                    markers: synced.white.markers,
                    bonusTurns: synced.white.timeStopConsecutiveTurnsRemainingByPlayer
                }
            });

            if (synced.black.gameOver || synced.white.gameOver) {
                throw new Error(`Game reached gameOver during phase ${phase}`);
            }

            if (phase === 'setup_time_stop') {
                if (synced.black.currentPlayerKey === 'black') {
                    const timeStopCard = Array.isArray(synced.black.hand)
                        ? synced.black.hand.find((entry) => entry && entry.id === TARGET_CARD_IDS.timeStop)
                        : null;
                    if (timeStopCard && timeStopCard.canUse === true) {
                        await waitForNetworkIdle(blackPage, STATE_TIMEOUT_MS, 1);
                        result.actionLog.push({ type: 'use_time_stop_begin', turnNumber: synced.black.turnNumber, turnIndex: synced.black.turnIndex });
                        const useTimeStopResult = await useTargetCard(blackPage, 'black', TARGET_CARD_IDS.timeStop);
                        result.actionLog.push({ type: 'use_time_stop_result', result: useTimeStopResult });
                        const afterUse = await waitForCondition(
                            blackPage,
                            whitePage,
                            (black, white) => (
                                black.pendingByPlayer.black && black.pendingByPlayer.black.type === 'TIME_STOP_GOD'
                                && white.pendingByPlayer.black && white.pendingByPlayer.black.type === 'TIME_STOP_GOD'
                            ),
                            STATE_TIMEOUT_MS,
                            'wait for TIME_STOP_GOD pending'
                        );
                        result.actionLog.push({ type: 'time_stop_pending', black: afterUse.black, white: afterUse.white });
                        phase = 'place_time_stop_when_possible';
                        continue;
                    }
                }
                const actorKey = synced.black.currentPlayerKey;
                const actorPage = actorKey === 'white' ? whitePage : blackPage;
                const actorState = synced[actorKey];
                await performTurnAction(actorPage, actorState, result.actionLog, `${actorKey}_setup_progress`);
                continue;
            }

            if (phase === 'place_time_stop_when_possible') {
                const blackPending = synced.black.pendingByPlayer && synced.black.pendingByPlayer.black;
                const whitePending = synced.white.pendingByPlayer && synced.white.pendingByPlayer.black;
                if (!blackPending || blackPending.type !== 'TIME_STOP_GOD' || !whitePending || whitePending.type !== 'TIME_STOP_GOD') {
                    throw new Error('TIME_STOP_GOD pending cleared before follow-up placement');
                }
                if (synced.black.currentPlayerKey === 'black' && Array.isArray(synced.black.legalMoves) && synced.black.legalMoves.length > 0) {
                    await performTurnAction(blackPage, synced.black, result.actionLog, 'time_stop_followup_place');
                    const afterPlace = await waitForSynchronizedState(blackPage, whitePage, STATE_TIMEOUT_MS);
                    const timeStopMarker = Array.isArray(afterPlace.black.markers)
                        ? afterPlace.black.markers.find((marker) => marker && marker.data && marker.data.type === 'TIME_STOP' && marker.owner === 'black')
                        : null;
                    if (!timeStopMarker) {
                        throw new Error('TIME_STOP marker was not found after placement');
                    }
                    result.actionLog.push({ type: 'time_stop_placed', marker: timeStopMarker, black: afterPlace.black, white: afterPlace.white });
                    phase = 'wait_time_stop_trigger';
                    continue;
                }
                const actorKey = synced.black.currentPlayerKey;
                const actorPage = actorKey === 'white' ? whitePage : blackPage;
                const actorState = synced[actorKey];
                await performTurnAction(actorPage, actorState, result.actionLog, `${actorKey}_advance_until_time_stop_place`);
                continue;
            }

            if (phase === 'wait_time_stop_trigger') {
                if (Number(synced.black.timeStopConsecutiveTurnsRemainingByPlayer.black || 0) > 0) {
                    blackBonusTurnsAfterTrigger = Number(synced.black.timeStopConsecutiveTurnsRemainingByPlayer.black || 0);
                    result.actionLog.push({
                        type: 'time_stop_triggered_in_browser',
                        bonusTurns: blackBonusTurnsAfterTrigger,
                        black: synced.black,
                        white: synced.white
                    });
                    phase = 'bonus_turn_robot';
                    continue;
                }
                const actorKey = synced.black.currentPlayerKey;
                const actorPage = actorKey === 'white' ? whitePage : blackPage;
                const actorState = synced[actorKey];
                await performTurnAction(actorPage, actorState, result.actionLog, `${actorKey}_advance_until_trigger`);
                continue;
            }

            if (phase === 'bonus_turn_robot') {
                if (synced.black.currentPlayerKey !== 'black') {
                    throw new Error(`Expected black bonus turn for robot vacuum, got ${synced.black.currentPlayerKey}`);
                }
                const robotCard = Array.isArray(synced.black.hand)
                    ? synced.black.hand.find((entry) => entry && entry.id === TARGET_CARD_IDS.robotVacuum)
                    : null;
                if (!robotCard || robotCard.canUse !== true) {
                    throw new Error('ROBOT_VACUUM_WILL was not usable on the first bonus turn');
                }
                await waitForNetworkIdle(blackPage, STATE_TIMEOUT_MS);
                result.actionLog.push({ type: 'use_robot_vacuum_begin', bonusTurns: synced.black.timeStopConsecutiveTurnsRemainingByPlayer.black });
                await useTargetCard(blackPage, 'black', TARGET_CARD_IDS.robotVacuum);
                const afterUse = await waitForCondition(
                    blackPage,
                    whitePage,
                    (black, white) => (
                        black.pendingByPlayer.black && black.pendingByPlayer.black.type === 'ROBOT_VACUUM_WILL'
                        && white.pendingByPlayer.black && white.pendingByPlayer.black.type === 'ROBOT_VACUUM_WILL'
                    ),
                    STATE_TIMEOUT_MS,
                    'wait for ROBOT_VACUUM_WILL pending'
                );
                result.actionLog.push({ type: 'robot_vacuum_pending', black: afterUse.black, white: afterUse.white });
                await performTurnAction(blackPage, afterUse.black, result.actionLog, 'robot_vacuum_place');
                const afterRobot = await waitForSynchronizedState(blackPage, whitePage, STATE_TIMEOUT_MS);
                result.actionLog.push({ type: 'after_robot_vacuum_place', black: afterRobot.black, white: afterRobot.white });
                if (afterRobot.black.currentPlayerKey !== 'black') {
                    throw new Error('Time stop extra turn did not stay on black after robot vacuum placement');
                }
                if (Number(afterRobot.black.timeStopConsecutiveTurnsRemainingByPlayer.black || 0) >= Number(blackBonusTurnsAfterTrigger || 0)) {
                    throw new Error('Time stop bonus turn counter did not decrease after robot vacuum placement');
                }
                phase = 'bonus_turn_guardian';
                continue;
            }

            if (phase === 'bonus_turn_guardian') {
                if (synced.black.currentPlayerKey !== 'black') {
                    throw new Error(`Expected black bonus turn for guardian, got ${synced.black.currentPlayerKey}`);
                }
                const guardianCard = Array.isArray(synced.black.hand)
                    ? synced.black.hand.find((entry) => entry && entry.id === TARGET_CARD_IDS.guardian)
                    : null;
                if (!guardianCard || guardianCard.canUse !== true) {
                    throw new Error('GUARDIAN_GOD was not usable on the second bonus turn');
                }
                await waitForNetworkIdle(blackPage, STATE_TIMEOUT_MS);
                result.actionLog.push({ type: 'use_guardian_begin', bonusTurns: synced.black.timeStopConsecutiveTurnsRemainingByPlayer.black });
                await useTargetCard(blackPage, 'black', TARGET_CARD_IDS.guardian);
                const afterGuardianUse = await resolveGuardianSelection(blackPage, 'black', blackPage, whitePage, result.actionLog);
                if (afterGuardianUse.black.currentPlayerKey !== 'black' || afterGuardianUse.white.currentPlayerKey !== 'black') {
                    throw new Error('Guardian target selection should keep the turn on black before the follow-up placement');
                }
                if (afterGuardianUse.black.pendingByPlayer.black || afterGuardianUse.white.pendingByPlayer.black) {
                    throw new Error('Guardian target selection left pending selection active');
                }
                await performTurnAction(blackPage, afterGuardianUse.black, result.actionLog, 'guardian_followup_place');
                const finalState = await waitForSynchronizedState(blackPage, whitePage, STATE_TIMEOUT_MS);
                result.actionLog.push({ type: 'after_guardian_followup_place', black: finalState.black, white: finalState.white });
                if (finalState.black.currentPlayerKey !== 'white' || finalState.white.currentPlayerKey !== 'white') {
                    throw new Error('White did not receive the turn after guardian follow-up placement');
                }
                result.ok = true;
                result.final = finalState;
                break;
            }

            throw new Error(`Unknown phase: ${phase}`);
        }

        if (result.ok !== true) {
            if (matchTimedOut) {
                throw new Error(`Timed out before finishing target chain in phase ${String(result.phase || 'unknown')}`);
            }
            throw new Error('Target chain did not complete within MAX_ACTIONS');
        }

        await Promise.all([
            waitForPlaybackIdle(blackPage).catch(() => {}),
            waitForPlaybackIdle(whitePage).catch(() => {})
        ]);
        await Promise.all([
            blackPage.screenshot({ path: SCREENSHOT_BLACK_PATH, fullPage: true }),
            whitePage.screenshot({ path: SCREENSHOT_WHITE_PATH, fullPage: true })
        ]);
    } catch (error) {
        result.ok = false;
        result.error = {
            message: error && error.message ? error.message : String(error),
            stack: error && error.stack ? error.stack : null,
            lastStates: error && error.lastStates ? error.lastStates : null
        };
        if (blackPage) {
            try { await blackPage.screenshot({ path: ERROR_SCREENSHOT_BLACK_PATH, fullPage: true }); } catch (e) {}
        }
        if (whitePage) {
            try { await whitePage.screenshot({ path: ERROR_SCREENSHOT_WHITE_PATH, fullPage: true }); } catch (e) {}
        }
        throw error;
    } finally {
        result.durationMs = Date.now() - startedAt;
        writeJson(RESULT_PATH, result);
        if (whiteContext) {
            try { await whiteContext.close(); } catch (e) {}
        }
        if (blackContext) {
            try { await blackContext.close(); } catch (e) {}
        }
        if (browser) {
            try { await browser.close(); } catch (e) {}
        }
    }
}

main().then(() => {
    logLine(`OK: wrote ${RESULT_PATH}`);
}).catch((error) => {
    logLine(`ERROR: ${error && error.message ? error.message : String(error)}`);
    process.exitCode = 1;
});
