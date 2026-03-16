const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const DeckCodec = require('../../shared/deck-codec');
const DeckSpecHelpers = require('../../shared/deck-spec');

const BASE_URL = process.env.BASE_URL || 'https://card-othello-match.jqt236i.workers.dev';
const SERVER_URL = process.env.SERVER_URL || BASE_URL;
const TARGET_CARD_ID = 'hyperactive_01';
const TARGET_CARD_TYPE = 'HYPERACTIVE_WILL';
const TARGET_MARKER_TYPE = 'HYPERACTIVE';
const VIEWPORT = { width: 1440, height: 1200 };
const OUT_DIR = path.join(process.cwd(), 'tmp', 'playwright-network-verify');
const RESULT_PATH = process.env.RESULT_PATH
    ? path.resolve(process.cwd(), String(process.env.RESULT_PATH))
    : path.join(OUT_DIR, 'hyperactive-public-result.json');
const PROGRESS_PATH = process.env.PROGRESS_PATH
    ? path.resolve(process.cwd(), String(process.env.PROGRESS_PATH))
    : path.join(OUT_DIR, 'hyperactive-public-progress.json');
const MAX_ATTEMPTS = Number.isFinite(Number(process.env.MAX_ATTEMPTS))
    ? Math.max(1, Math.trunc(Number(process.env.MAX_ATTEMPTS)))
    : 3;
const MAX_SEARCH_ACTIONS = Number.isFinite(Number(process.env.MAX_SEARCH_ACTIONS))
    ? Math.max(1, Math.trunc(Number(process.env.MAX_SEARCH_ACTIONS)))
    : 28;
const FOLLOWUP_ACTIONS = Number.isFinite(Number(process.env.FOLLOWUP_ACTIONS))
    ? Math.max(1, Math.trunc(Number(process.env.FOLLOWUP_ACTIONS)))
    : 6;
const PAGE_TIMEOUT_MS = Number.isFinite(Number(process.env.PAGE_TIMEOUT_MS))
    ? Math.max(1000, Math.trunc(Number(process.env.PAGE_TIMEOUT_MS)))
    : 30000;
const PLAYBACK_TIMEOUT_MS = Number.isFinite(Number(process.env.PLAYBACK_TIMEOUT_MS))
    ? Math.max(1000, Math.trunc(Number(process.env.PLAYBACK_TIMEOUT_MS)))
    : 25000;
const STATE_TIMEOUT_MS = Number.isFinite(Number(process.env.STATE_TIMEOUT_MS))
    ? Math.max(1000, Math.trunc(Number(process.env.STATE_TIMEOUT_MS)))
    : 25000;
const HEADLESS = !/^(0|false)$/i.test(String(process.env.HEADLESS || '1'));
const SLOW_MO_MS = Math.max(0, Number(process.env.SLOW_MO_MS || 0) || 0);
const MAX_EVENT_LOG = 120;

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
    return (value === -1 || value === 'white' || value === '-1') ? 'white' : 'black';
}

function posToNotation(row, col) {
    const cols = 'abcdefgh';
    return `${cols[col] || '?'}${Number(row) + 1}`;
}

function boardHash(board) {
    try {
        return JSON.stringify(Array.isArray(board) ? board : []);
    } catch (error) {
        return '[]';
    }
}

function markerHash(markers) {
    try {
        const normalized = Array.isArray(markers)
            ? markers
                .map((marker) => ({
                    row: Number(marker.row),
                    col: Number(marker.col),
                    owner: marker.owner || null,
                    type: marker.type || null,
                    hyperactiveSeq: Number.isFinite(Number(marker.hyperactiveSeq)) ? Number(marker.hyperactiveSeq) : null,
                    remainingOwnerTurns: Number.isFinite(Number(marker.remainingOwnerTurns)) ? Number(marker.remainingOwnerTurns) : null
                }))
                .sort((left, right) => {
                    if ((left.hyperactiveSeq || 0) !== (right.hyperactiveSeq || 0)) return (left.hyperactiveSeq || 0) - (right.hyperactiveSeq || 0);
                    if (left.row !== right.row) return left.row - right.row;
                    if (left.col !== right.col) return left.col - right.col;
                    return String(left.type || '').localeCompare(String(right.type || ''));
                })
            : [];
        return JSON.stringify(normalized);
    } catch (error) {
        return '[]';
    }
}

function chooseMove(moves) {
    if (!Array.isArray(moves) || moves.length <= 0) return null;
    const scored = moves
        .filter((move) => move && Number.isInteger(move.row) && Number.isInteger(move.col))
        .map((move) => {
            let score = 0;
            const isCorner = (move.row === 0 || move.row === 7) && (move.col === 0 || move.col === 7);
            const isEdge = move.row === 0 || move.row === 7 || move.col === 0 || move.col === 7;
            if (isCorner) score += 100000;
            else if (isEdge) score += 10000;
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

function buildTargetDeckCode(cardId) {
    const standardCardIds = DeckSpecHelpers.getStandardDeckCardIds();
    const filler = standardCardIds.filter((one) => one !== cardId);
    const deckCardIds = [cardId, cardId, cardId, ...filler.slice(0, 27)];
    const deckSpec = DeckSpecHelpers.createDeckSpecFromCardIds(deckCardIds);
    return DeckCodec.encodeDeckSpec(deckSpec);
}

function summarizeState(state) {
    if (!state || typeof state !== 'object') return null;
    return {
        seatKey: state.seatKey || null,
        currentPlayerKey: state.currentPlayerKey || null,
        canAct: state.canAct === true,
        turnNumber: Number.isFinite(state.turnNumber) ? state.turnNumber : null,
        turnIndex: Number.isFinite(state.turnIndex) ? state.turnIndex : null,
        hand: Array.isArray(state.hand) ? state.hand.map((entry) => ({
            id: entry.id,
            type: entry.type,
            canUse: entry.canUse === true
        })) : [],
        legalMoves: Array.isArray(state.legalMoves) ? state.legalMoves.length : 0,
        pending: state.pending || null,
        counts: state.counts || null,
        markers: Array.isArray(state.markers) ? state.markers : [],
        gameOver: state.gameOver === true,
        overlayVisible: state.overlayVisible === true
    };
}

function summarizeCardUseState(state) {
    const safe = (state && typeof state === 'object') ? state : {};
    const hand = Array.isArray(safe.hand) ? safe.hand : [];
    return {
        selectedCardId: safe.selectedCardId || null,
        selectedCardOwnerKey: safe.selectedCardOwnerKey || null,
        hasUsedCardThisTurn: safe.hasUsedCardThisTurn === true,
        pendingType: safe.pending && safe.pending.type ? safe.pending.type : null,
        handHasTarget: hand.includes(TARGET_CARD_ID)
    };
}

function installPageObservers(page, browserName, sink) {
    page.on('console', (message) => {
        const type = typeof message.type === 'function' ? message.type() : 'log';
        if (type !== 'error' && type !== 'warning') return;
        appendLimited(sink, {
            time: new Date().toISOString(),
            browser: browserName,
            kind: 'console',
            type,
            text: typeof message.text === 'function' ? message.text() : ''
        });
    });
    page.on('requestfailed', (request) => {
        const url = typeof request.url === 'function' ? request.url() : '';
        if (!isMatchApiUrl(url)) return;
        const failure = typeof request.failure === 'function' ? request.failure() : null;
        appendLimited(sink, {
            time: new Date().toISOString(),
            browser: browserName,
            kind: 'requestfailed',
            url,
            method: typeof request.method === 'function' ? request.method() : '',
            failure: failure && failure.errorText ? failure.errorText : null
        });
    });
    page.on('response', (response) => {
        const url = typeof response.url === 'function' ? response.url() : '';
        const status = typeof response.status === 'function' ? response.status() : 0;
        if (!isMatchApiUrl(url) || status < 400) return;
        appendLimited(sink, {
            time: new Date().toISOString(),
            browser: browserName,
            kind: 'response',
            status,
            url
        });
    });
}

function writeProgress(payload) {
    writeJson(PROGRESS_PATH, Object.assign({
        baseUrl: BASE_URL,
        serverUrl: SERVER_URL,
        targetCardId: TARGET_CARD_ID,
        timestamp: new Date().toISOString()
    }, payload || {}));
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
            );
        } catch (error) {
            return false;
        }
    }, { timeout: PAGE_TIMEOUT_MS });
}

async function waitForPlaybackIdle(page, timeout = PLAYBACK_TIMEOUT_MS) {
    await page.waitForFunction(() => {
        try {
            const layer = document.getElementById('handLayer');
            const wrapper = document.getElementById('handWrapper');
            const movingCard = !!(layer && layer.querySelector('.card-item.visible'));
            const heldDrawCard = !!(wrapper && wrapper.querySelector('.held-draw-card'));
            const layerVisible = !!(layer && layer.style && layer.style.display === 'block');
            const busy = !!(
                window.VisualPlaybackActive
                || window.isCardAnimating
                || window.isProcessing
                || movingCard
                || heldDrawCard
                || layerVisible
            );
            return !busy;
        } catch (error) {
            return true;
        }
    }, { timeout });
}

async function waitForBothIdle(chromePage, edgePage) {
    await Promise.all([
        waitForPlaybackIdle(chromePage).catch(() => {}),
        waitForPlaybackIdle(edgePage).catch(() => {})
    ]);
    await wait(250);
}

async function ensureNetworkMode(page) {
    await page.getByRole('button', { name: 'ネット対戦' }).click();
    await page.waitForFunction(() => {
        try {
            return window.MATCH_MODE === 'network' || window.__MATCH_MODE === 'network';
        } catch (error) {
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
        await page.waitForFunction(() => {
            const overlay = document.getElementById('networkOverlay');
            if (!overlay) return true;
            const open = !!(
                overlay.classList
                && (
                    overlay.classList.contains('is-open')
                    || overlay.classList.contains('active')
                    || overlay.getAttribute('aria-hidden') === 'false'
                )
            );
            return !open;
        }, { timeout: 5000 });
    } catch (error) {
        // best-effort only for temp runner
    }
}

async function createRoom(page, playerName, deckCode) {
    await ensureNetworkMode(page);
    const result = await page.evaluate(async ({ playerName, deckCode, serverUrl }) => {
        return window.NetworkMatchClient.createRoom({ playerName, deckCode, serverUrl });
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
        } catch (error) {
            return false;
        }
    }, { timeout: 20000 });
}

async function getLiveState(page) {
    return page.evaluate(() => {
        function cloneBoard(board) {
            return Array.isArray(board) ? board.map((row) => Array.isArray(row) ? row.slice() : []) : [];
        }

        function normalizePlayerKeyInner(value) {
            return (value === -1 || value === 'white' || value === '-1') ? 'white' : 'black';
        }

        const currentPlayerValue = window.gameState ? window.gameState.currentPlayer : null;
        const currentPlayerKey = normalizePlayerKeyInner(currentPlayerValue);
        const seatKey = window.NetworkMatchClient && typeof window.NetworkMatchClient.getSeatKey === 'function'
            ? window.NetworkMatchClient.getSeatKey()
            : null;

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
        } catch (error) {
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
                canUse = !!(
                    window.CardLogic
                    && typeof window.CardLogic.canUseCard === 'function'
                    && window.CardLogic.canUseCard(window.cardState, seatKey, cardId)
                );
            } catch (error) {
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
            ? window.cardState.markers
                .filter((marker) => marker && marker.kind === 'specialStone')
                .map((marker) => ({
                    row: Number(marker.row),
                    col: Number(marker.col),
                    owner: marker.owner || null,
                    type: marker.data ? marker.data.type || null : null,
                    hyperactiveSeq: marker.data && Number.isFinite(Number(marker.data.hyperactiveSeq))
                        ? Number(marker.data.hyperactiveSeq)
                        : null,
                    remainingOwnerTurns: marker.data && Number.isFinite(Number(marker.data.remainingOwnerTurns))
                        ? Number(marker.data.remainingOwnerTurns)
                        : null
                }))
            : [];

        const overlay = document.getElementById('result-overlay');
        const counts = typeof window.countDiscs === 'function' && window.gameState
            ? window.countDiscs(window.gameState)
            : null;

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
            hasUsedCardThisTurn: !!(
                window.cardState
                && window.cardState.hasUsedCardThisTurnByPlayer
                && window.cardState.hasUsedCardThisTurnByPlayer[seatKey]
            ),
            pending: (() => {
                try {
                    const pendingByPlayer = window.cardState && window.cardState.pendingEffectByPlayer;
                    const pending = pendingByPlayer ? pendingByPlayer[seatKey] : null;
                    return pending ? JSON.parse(JSON.stringify(pending)) : null;
                } catch (error) {
                    return null;
                }
            })(),
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
            busy: {
                VisualPlaybackActive: window.VisualPlaybackActive === true,
                isProcessing: window.isProcessing === true,
                isCardAnimating: window.isCardAnimating === true
            },
            counts,
            overlayVisible: !!overlay,
            gameOver: (() => {
                try {
                    return !!(typeof window.isGameOver === 'function' && window.gameState && window.isGameOver(window.gameState));
                } catch (error) {
                    return false;
                }
            })()
        };
    });
}

async function getLiveStateSafe(page) {
    try {
        return await getLiveState(page);
    } catch (error) {
        return {
            error: error && error.message ? error.message : String(error)
        };
    }
}

async function waitForCondition(chromePage, edgePage, predicate, timeout, description) {
    const startedAt = Date.now();
    let lastStates = null;
    while ((Date.now() - startedAt) < timeout) {
        const [black, white] = await Promise.all([
            getLiveState(chromePage),
            getLiveState(edgePage)
        ]);
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

async function waitForSynchronizedState(chromePage, edgePage, timeout) {
    return waitForCondition(
        chromePage,
        edgePage,
        (black, white) => (
            black.currentPlayerKey === white.currentPlayerKey
            && black.turnIndex === white.turnIndex
            && black.turnNumber === white.turnNumber
            && boardHash(black.board) === boardHash(white.board)
            && markerHash(black.markers) === markerHash(white.markers)
        ),
        timeout,
        'wait for synchronized state'
    );
}

async function performPlacement(page, row, col) {
    const actionResult = await page.evaluate(({ row, col }) => {
        try {
            if (typeof window.handleCellClick === 'function') {
                window.handleCellClick(row, col);
                return { ok: true, via: 'handleCellClick' };
            }
            const cell = document.querySelector(`#board .cell[data-row="${row}"][data-col="${col}"]`);
            if (cell && typeof cell.click === 'function') {
                cell.click();
                return { ok: true, via: 'dom-click' };
            }
            return { ok: false, reason: 'NO_MOVE_TRIGGER' };
        } catch (error) {
            return { ok: false, reason: error && error.message ? error.message : String(error) };
        }
    }, { row, col });
    if (!actionResult || actionResult.ok !== true) {
        throw new Error(`placement failed: ${actionResult ? actionResult.reason : 'unknown'}`);
    }
}

async function performPass(page) {
    const actionResult = await page.evaluate(() => {
        try {
            if (typeof window.passCurrentTurn === 'function') {
                window.passCurrentTurn();
                return { ok: true, via: 'passCurrentTurn' };
            }
            const passBtn = document.getElementById('passBtn');
            if (passBtn && typeof passBtn.click === 'function') {
                passBtn.click();
                return { ok: true, via: 'dom-click' };
            }
            return { ok: false, reason: 'NO_PASS_TRIGGER' };
        } catch (error) {
            return { ok: false, reason: error && error.message ? error.message : String(error) };
        }
    });
    if (!actionResult || actionResult.ok !== true) {
        throw new Error(`pass failed: ${actionResult ? actionResult.reason : 'unknown'}`);
    }
}

async function performTurnAction(page, state) {
    if (!state || state.canAct !== true) {
        throw new Error('turn action attempted while page cannot act');
    }
    if (Array.isArray(state.legalMoves) && state.legalMoves.length > 0) {
        const move = chooseMove(state.legalMoves);
        if (!move) {
            throw new Error('failed to choose a legal move');
        }
        await performPlacement(page, move.row, move.col);
        return {
            type: 'place',
            row: move.row,
            col: move.col,
            notation: posToNotation(move.row, move.col)
        };
    }
    await performPass(page);
    return { type: 'pass' };
}

async function readCardUseState(page, seatKey) {
    return page.evaluate((seatKey) => {
        const ownHand = window.cardState && window.cardState.hands && Array.isArray(window.cardState.hands[seatKey])
            ? window.cardState.hands[seatKey].slice()
            : [];
        const pendingByPlayer = window.cardState && window.cardState.pendingEffectByPlayer;
        const pending = pendingByPlayer ? pendingByPlayer[seatKey] : null;
        return {
            selectedCardId: window.cardState ? window.cardState.selectedCardId : null,
            selectedCardOwnerKey: window.cardState ? window.cardState.selectedCardOwnerKey : null,
            hasUsedCardThisTurn: !!(
                window.cardState
                && window.cardState.hasUsedCardThisTurnByPlayer
                && window.cardState.hasUsedCardThisTurnByPlayer[seatKey]
            ),
            pending: pending ? JSON.parse(JSON.stringify(pending)) : null,
            hand: ownHand
        };
    }, seatKey);
}

async function probeTargetCardDom(page, seatKey, cardId) {
    return page.evaluate(({ seatKey, cardId }) => {
        const handSelector = seatKey === 'white' ? '#hand-white' : '#hand-black';
        const cardEl = document.querySelector(`${handSelector} .card-item[data-card-id="${cardId}"]`);
        const useButton = document.getElementById('use-card-btn');
        return {
            handSelector,
            cardExists: !!cardEl,
            className: cardEl ? cardEl.className : '',
            ownerKey: cardEl && cardEl.dataset ? cardEl.dataset.ownerKey || null : null,
            clickable: !!(cardEl && cardEl.classList && cardEl.classList.contains('clickable')),
            usable: !!(cardEl && cardEl.classList && cardEl.classList.contains('usable')),
            selected: !!(cardEl && cardEl.classList && cardEl.classList.contains('selected')),
            useButtonDisabled: !!(useButton && useButton.disabled === true),
            useButtonText: useButton ? String(useButton.textContent || '').trim() : ''
        };
    }, { seatKey, cardId });
}

async function waitForCardUseProgress(page, seatKey, cardId) {
    await page.waitForFunction(({ seatKey, cardId, expectedType }) => {
        try {
            const ownHand = window.cardState && window.cardState.hands && Array.isArray(window.cardState.hands[seatKey])
                ? window.cardState.hands[seatKey]
                : [];
            const pendingByPlayer = window.cardState && window.cardState.pendingEffectByPlayer;
            const pending = pendingByPlayer ? pendingByPlayer[seatKey] : null;
            const used = !!(
                window.cardState
                && window.cardState.hasUsedCardThisTurnByPlayer
                && window.cardState.hasUsedCardThisTurnByPlayer[seatKey]
            );
            return used || !ownHand.includes(cardId) || !!(pending && pending.type === expectedType);
        } catch (error) {
            return false;
        }
    }, { seatKey, cardId, expectedType: TARGET_CARD_TYPE }, { timeout: STATE_TIMEOUT_MS });
    return readCardUseState(page, seatKey);
}

async function useTargetCard(page, seatKey, cardId) {
    const direct = await page.evaluate(({ seatKey, cardId }) => {
        function snapshot() {
            const ownHand = window.cardState && window.cardState.hands && Array.isArray(window.cardState.hands[seatKey])
                ? window.cardState.hands[seatKey].slice()
                : [];
            const pendingByPlayer = window.cardState && window.cardState.pendingEffectByPlayer;
            const pending = pendingByPlayer ? pendingByPlayer[seatKey] : null;
            return {
                selectedCardId: window.cardState ? window.cardState.selectedCardId : null,
                selectedCardOwnerKey: window.cardState ? window.cardState.selectedCardOwnerKey : null,
                hasUsedCardThisTurn: !!(
                    window.cardState
                    && window.cardState.hasUsedCardThisTurnByPlayer
                    && window.cardState.hasUsedCardThisTurnByPlayer[seatKey]
                ),
                pending: pending ? JSON.parse(JSON.stringify(pending)) : null,
                hand: ownHand
            };
        }

        const before = snapshot();
        let selectError = null;
        let useError = null;
        try {
            if (typeof window.onCardClick === 'function') {
                window.onCardClick(cardId, seatKey);
            }
        } catch (error) {
            selectError = error && error.message ? error.message : String(error);
        }
        const afterSelect = snapshot();
        try {
            if (typeof window.useSelectedCard === 'function') {
                window.useSelectedCard();
            }
        } catch (error) {
            useError = error && error.message ? error.message : String(error);
        }
        const afterUse = snapshot();
        return {
            strategy: 'direct',
            selectError,
            useError,
            before,
            afterSelect,
            afterUse
        };
    }, { seatKey, cardId });

    const directState = direct && direct.afterUse ? direct.afterUse : null;
    if (directState && (
        directState.hasUsedCardThisTurn
        || !Array.isArray(directState.hand)
        || !directState.hand.includes(cardId)
        || (directState.pending && directState.pending.type === TARGET_CARD_TYPE)
    )) {
        return direct;
    }

    const handSelector = seatKey === 'white' ? '#hand-white' : '#hand-black';
    const beforeFallback = await readCardUseState(page, seatKey);
    const domProbeBefore = await probeTargetCardDom(page, seatKey, cardId);
    if (!(beforeFallback.selectedCardId === cardId && beforeFallback.selectedCardOwnerKey === seatKey) && domProbeBefore.cardExists) {
        await page.evaluate(({ seatKey, cardId }) => {
            const selector = `${seatKey === 'white' ? '#hand-white' : '#hand-black'} .card-item[data-card-id="${cardId}"]`;
            const cardEl = document.querySelector(selector);
            if (cardEl && typeof cardEl.click === 'function') {
                cardEl.click();
            }
        }, { seatKey, cardId });
        await wait(150);
    }
    const beforeUseClick = await readCardUseState(page, seatKey);
    const domProbeAfterSelect = await probeTargetCardDom(page, seatKey, cardId);
    const useButtonReady = await page.evaluate(() => {
        const button = document.getElementById('use-card-btn');
        if (!button || button.disabled === true) return false;
        if (typeof button.click === 'function') {
            button.click();
            return true;
        }
        return false;
    });
    await wait(150);
    const afterFallback = await readCardUseState(page, seatKey);
    const domProbeAfterUse = await probeTargetCardDom(page, seatKey, cardId);
    return {
        strategy: 'dom-fallback',
        direct,
        beforeFallback,
        domProbeBefore,
        beforeUseClick,
        domProbeAfterSelect,
        useButtonReady,
        afterFallback,
        domProbeAfterUse,
        handSelector
    };
}

function findTrackedMarker(state, hyperactiveSeq) {
    const markers = Array.isArray(state && state.markers) ? state.markers : [];
    if (Number.isFinite(Number(hyperactiveSeq))) {
        return markers.find((marker) => marker && marker.type === TARGET_MARKER_TYPE && Number(marker.hyperactiveSeq) === Number(hyperactiveSeq)) || null;
    }
    return markers.find((marker) => marker && marker.type === TARGET_MARKER_TYPE) || null;
}

async function inspectBoardPage(page, positions) {
    return page.evaluate((targets) => {
        const board = Array.isArray(window.gameState && window.gameState.board) ? window.gameState.board : [];
        const boardDiscCount = board.reduce((sum, row) => sum + (Array.isArray(row) ? row.filter((value) => Number(value) !== 0).length : 0), 0);
        const domDiscCount = document.querySelectorAll('#board .cell .disc').length;
        const cells = (Array.isArray(targets) ? targets : []).map((target) => {
            const row = Number(target.row);
            const col = Number(target.col);
            const cell = document.querySelector(`#board .cell[data-row="${row}"][data-col="${col}"]`);
            return {
                row,
                col,
                boardValue: Array.isArray(board[row]) ? Number(board[row][col]) : null,
                hasDisc: !!(cell && cell.querySelector('.disc')),
                hasDiscClass: !!(cell && cell.classList && cell.classList.contains('has-disc')),
                className: cell ? cell.className : '',
                text: cell ? String(cell.textContent || '').trim() : ''
            };
        });
        return { boardDiscCount, domDiscCount, cells };
    }, positions);
}

function collectDomIssues(browserName, inspection) {
    const issues = [];
    if (!inspection || typeof inspection !== 'object') {
        issues.push({ browser: browserName, type: 'missing_inspection' });
        return issues;
    }
    if (Number.isFinite(inspection.boardDiscCount) && Number.isFinite(inspection.domDiscCount) && inspection.boardDiscCount !== inspection.domDiscCount) {
        issues.push({
            browser: browserName,
            type: 'disc_count_mismatch',
            boardDiscCount: inspection.boardDiscCount,
            domDiscCount: inspection.domDiscCount
        });
    }
    const cells = Array.isArray(inspection.cells) ? inspection.cells : [];
    for (const cell of cells) {
        if (!cell || !Number.isFinite(cell.row) || !Number.isFinite(cell.col)) continue;
        if (Number(cell.boardValue) === 0 && cell.hasDisc) {
            issues.push({
                browser: browserName,
                type: 'source_split_disc',
                row: cell.row,
                col: cell.col,
                boardValue: cell.boardValue,
                hasDisc: cell.hasDisc,
                className: cell.className
            });
        }
        if (Number(cell.boardValue) !== 0 && !cell.hasDisc) {
            issues.push({
                browser: browserName,
                type: 'missing_disc',
                row: cell.row,
                col: cell.col,
                boardValue: cell.boardValue,
                hasDisc: cell.hasDisc,
                className: cell.className
            });
        }
    }
    return issues;
}

async function leaveRoomIfPossible(page) {
    try {
        await page.evaluate(async () => {
            if (window.NetworkMatchClient && typeof window.NetworkMatchClient.leaveRoom === 'function') {
                await window.NetworkMatchClient.leaveRoom();
            }
        });
    } catch (error) {
        // best-effort only for temp runner
    }
}

async function captureAttemptEvidence(attempt, chromePage, edgePage, prefix) {
    const [chromeState, edgeState] = await Promise.all([
        getLiveStateSafe(chromePage),
        getLiveStateSafe(edgePage)
    ]);
    attempt.final = {
        chrome: chromeState,
        edge: edgeState
    };
    const chromePath = path.join(OUT_DIR, `hyperactive-attempt${attempt.attempt}-${prefix}-chrome.png`);
    const edgePath = path.join(OUT_DIR, `hyperactive-attempt${attempt.attempt}-${prefix}-edge.png`);
    attempt.screenshots = attempt.screenshots || [];
    attempt.screenshots.push(chromePath, edgePath);
    await Promise.allSettled([
        chromePage.screenshot({ path: chromePath, fullPage: true, animations: 'disabled' }),
        edgePage.screenshot({ path: edgePath, fullPage: true, animations: 'disabled' })
    ]);
}

async function runAttempt(chromeBrowser, edgeBrowser, attemptIndex) {
    const deckCode = buildTargetDeckCode(TARGET_CARD_ID);
    const chromeContext = await chromeBrowser.newContext({ viewport: VIEWPORT });
    const edgeContext = await edgeBrowser.newContext({ viewport: VIEWPORT });
    const chromePage = await chromeContext.newPage();
    const edgePage = await edgeContext.newPage();
    const attempt = {
        attempt: attemptIndex,
        ok: false,
        reproduced: false,
        roomId: null,
        pageEvents: [],
        actionLog: [],
        hyperactive: null,
        reproduction: null,
        screenshots: [],
        error: null,
        final: null
    };

    installPageObservers(chromePage, 'chrome', attempt.pageEvents);
    installPageObservers(edgePage, 'msedge', attempt.pageEvents);

    try {
        logLine(`[hyperactive] attempt=${attemptIndex} base=${BASE_URL} headless=${HEADLESS} slowMo=${SLOW_MO_MS}`);
        writeProgress({ phase: 'attempt_start', attemptIndex, deckCode });

        await Promise.all([
            chromePage.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS }),
            edgePage.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS })
        ]);
        await Promise.all([waitForGameReady(chromePage), waitForGameReady(edgePage)]);

        const roomId = await createRoom(chromePage, `HB${attemptIndex}`, deckCode);
        attempt.roomId = roomId;
        logLine(`[hyperactive] attempt=${attemptIndex} room=${roomId}`);
        await joinRoom(edgePage, roomId, `HW${attemptIndex}`, '');
        await Promise.all([waitForTwoPlayers(chromePage), waitForTwoPlayers(edgePage)]);
        await Promise.all([closeNetworkOverlayIfOpen(chromePage), closeNetworkOverlayIfOpen(edgePage)]);
        await waitForBothIdle(chromePage, edgePage);

        let synced = await waitForSynchronizedState(chromePage, edgePage, STATE_TIMEOUT_MS);
        writeProgress({ phase: 'joined', attemptIndex, roomId, live: { chrome: summarizeState(synced.black), edge: summarizeState(synced.white) } });

        for (let actionIndex = 0; actionIndex < MAX_SEARCH_ACTIONS; actionIndex += 1) {
            const actorKey = ['black', 'white'].find((seatKey) => {
                const state = synced[seatKey];
                const targetCard = Array.isArray(state && state.hand)
                    ? state.hand.find((entry) => entry && entry.id === TARGET_CARD_ID)
                    : null;
                return !!(
                    state
                    && state.canAct === true
                    && targetCard
                    && targetCard.canUse === true
                    && state.hasUsedCardThisTurn !== true
                );
            });

            if (actorKey) {
                const actorPage = actorKey === 'black' ? chromePage : edgePage;
                const actorState = synced[actorKey];
                const targetCard = actorState.hand.find((entry) => entry && entry.id === TARGET_CARD_ID);
                const move = chooseMove(actorState.legalMoves);
                if (!move) {
                    throw new Error('target card became usable but no legal move was available to place the marker');
                }
                logLine(`[hyperactive] actor=${actorKey} uses ${TARGET_CARD_ID} then places ${posToNotation(move.row, move.col)}`);
                attempt.actionLog.push({
                    phase: 'use_target_card',
                    actorKey,
                    card: targetCard,
                    move
                });
                const immediateUseState = await useTargetCard(actorPage, actorKey, TARGET_CARD_ID);
                const immediateUseSummary = immediateUseState && immediateUseState.afterFallback
                    ? summarizeCardUseState(immediateUseState.afterFallback)
                    : (immediateUseState && immediateUseState.afterUse
                        ? summarizeCardUseState(immediateUseState.afterUse)
                        : null);
                logLine(`[hyperactive] use immediate strategy=${immediateUseState && immediateUseState.strategy ? immediateUseState.strategy : 'unknown'} selected=${immediateUseSummary ? immediateUseSummary.selectedCardId : 'null'} used=${immediateUseSummary ? immediateUseSummary.hasUsedCardThisTurn : false} pending=${immediateUseSummary ? immediateUseSummary.pendingType : 'null'} handHasCard=${immediateUseSummary ? immediateUseSummary.handHasTarget : true}`);
                writeProgress({
                    phase: 'use_target_card_attempt',
                    attemptIndex,
                    roomId,
                    actorKey,
                    immediateUseState,
                    immediateUseSummary
                });
                let useProgress;
                try {
                    useProgress = await waitForCardUseProgress(actorPage, actorKey, TARGET_CARD_ID);
                } catch (error) {
                    const stalledUseState = await readCardUseState(actorPage, actorKey).catch(() => null);
                    writeProgress({
                        phase: 'use_target_card_timeout',
                        attemptIndex,
                        roomId,
                        actorKey,
                        error: error && error.stack ? error.stack : String(error),
                        immediateUseState,
                        immediateUseSummary,
                        stalledUseState,
                        stalledUseSummary: summarizeCardUseState(stalledUseState)
                    });
                    throw new Error(`card use did not progress: ${JSON.stringify({
                        actorKey,
                        immediateUseSummary,
                        stalledUseSummary: summarizeCardUseState(stalledUseState)
                    })}`);
                }
                attempt.actionLog.push({
                    phase: 'after_use_target_card',
                    actorKey,
                    immediateUseState,
                    useProgress
                });
                logLine(`[hyperactive] use progress used=${useProgress.hasUsedCardThisTurn} pending=${useProgress.pending ? useProgress.pending.type : 'null'} handHasCard=${Array.isArray(useProgress.hand) && useProgress.hand.includes(TARGET_CARD_ID)}`);
                await waitForPlaybackIdle(actorPage).catch(() => {});
                await performPlacement(actorPage, move.row, move.col);
                await waitForBothIdle(chromePage, edgePage);
                synced = await waitForSynchronizedState(chromePage, edgePage, STATE_TIMEOUT_MS);

                const placedMarker = findTrackedMarker(synced.black, null) || findTrackedMarker(synced.white, null);
                if (!placedMarker) {
                    throw new Error('hyperactive marker was not visible in synchronized state after placement');
                }
                attempt.hyperactive = {
                    actorKey,
                    cardId: TARGET_CARD_ID,
                    placedMove: {
                        row: move.row,
                        col: move.col,
                        notation: posToNotation(move.row, move.col)
                    },
                    placedMarker,
                    followup: []
                };
                logLine(`[hyperactive] marker seq=${placedMarker.hyperactiveSeq || '?'} at ${posToNotation(placedMarker.row, placedMarker.col)}`);
                writeProgress({
                    phase: 'marker_placed',
                    attemptIndex,
                    roomId,
                    hyperactive: attempt.hyperactive,
                    live: { chrome: summarizeState(synced.black), edge: summarizeState(synced.white) }
                });
                break;
            }

            const activeKey = synced.black.currentPlayerKey;
            const activePage = activeKey === 'black' ? chromePage : edgePage;
            const activeState = synced[activeKey];
            const action = await performTurnAction(activePage, activeState);
            attempt.actionLog.push({
                phase: 'search_turn',
                index: actionIndex + 1,
                actorKey: activeKey,
                action
            });
            logLine(`[hyperactive] search #${actionIndex + 1} ${activeKey} ${action.type === 'place' ? `place ${action.notation}` : 'pass'}`);
            await waitForBothIdle(chromePage, edgePage);
            synced = await waitForSynchronizedState(chromePage, edgePage, STATE_TIMEOUT_MS);
            writeProgress({
                phase: 'search_turn_done',
                attemptIndex,
                actionIndex: actionIndex + 1,
                live: { chrome: summarizeState(synced.black), edge: summarizeState(synced.white) }
            });
        }

        if (!attempt.hyperactive) {
            throw new Error(`failed to use ${TARGET_CARD_ID} within ${MAX_SEARCH_ACTIONS} actions`);
        }

        let currentSynced = synced;
        const trackedSeq = attempt.hyperactive.placedMarker.hyperactiveSeq;
        for (let followIndex = 1; followIndex <= FOLLOWUP_ACTIONS; followIndex += 1) {
            if (currentSynced.black.gameOver || currentSynced.white.gameOver) {
                logLine(`[hyperactive] follow #${followIndex} reached game over before reproduction`);
                break;
            }

            const activeKey = currentSynced.black.currentPlayerKey;
            const activePage = activeKey === 'black' ? chromePage : edgePage;
            const activeState = currentSynced[activeKey];
            const action = await performTurnAction(activePage, activeState);
            attempt.actionLog.push({
                phase: 'followup_turn',
                index: followIndex,
                actorKey: activeKey,
                action
            });
            logLine(`[hyperactive] follow #${followIndex} ${activeKey} ${action.type === 'place' ? `place ${action.notation}` : 'pass'}`);

            await waitForBothIdle(chromePage, edgePage);
            const nextSynced = await waitForSynchronizedState(chromePage, edgePage, STATE_TIMEOUT_MS);
            const prevMarker = findTrackedMarker(currentSynced.black, trackedSeq) || findTrackedMarker(currentSynced.white, trackedSeq);
            const nextMarker = findTrackedMarker(nextSynced.black, trackedSeq) || findTrackedMarker(nextSynced.white, trackedSeq);

            const followRecord = {
                index: followIndex,
                actorKey,
                action,
                before: summarizeState(currentSynced.black),
                after: summarizeState(nextSynced.black),
                prevMarker,
                nextMarker,
                issues: []
            };

            if (prevMarker && nextMarker && (prevMarker.row !== nextMarker.row || prevMarker.col !== nextMarker.col)) {
                const positions = [
                    { row: prevMarker.row, col: prevMarker.col },
                    { row: nextMarker.row, col: nextMarker.col }
                ];
                const [chromeInspection, edgeInspection] = await Promise.all([
                    inspectBoardPage(chromePage, positions),
                    inspectBoardPage(edgePage, positions)
                ]);
                followRecord.chromeInspection = chromeInspection;
                followRecord.edgeInspection = edgeInspection;
                followRecord.issues = collectDomIssues('chrome', chromeInspection).concat(collectDomIssues('msedge', edgeInspection));
                logLine(`[hyperactive] move ${posToNotation(prevMarker.row, prevMarker.col)} -> ${posToNotation(nextMarker.row, nextMarker.col)} issues=${followRecord.issues.length}`);
                if (followRecord.issues.length > 0) {
                    attempt.reproduced = true;
                    attempt.reproduction = followRecord;
                    await captureAttemptEvidence(attempt, chromePage, edgePage, `reproduced-step${followIndex}`);
                    attempt.hyperactive.followup.push(followRecord);
                    writeProgress({
                        phase: 'reproduced',
                        attemptIndex,
                        roomId,
                        reproduction: followRecord,
                        live: { chrome: summarizeState(nextSynced.black), edge: summarizeState(nextSynced.white) }
                    });
                    break;
                }
            } else if (prevMarker && !nextMarker) {
                followRecord.note = 'marker_missing_after_followup';
                logLine(`[hyperactive] marker missing after follow #${followIndex}`);
            } else if (prevMarker && nextMarker) {
                followRecord.note = 'marker_stable';
            } else {
                followRecord.note = 'marker_unavailable';
            }

            attempt.hyperactive.followup.push(followRecord);
            currentSynced = nextSynced;
            writeProgress({
                phase: 'followup_step',
                attemptIndex,
                roomId,
                followIndex,
                followRecord,
                live: { chrome: summarizeState(nextSynced.black), edge: summarizeState(nextSynced.white) }
            });

            if (attempt.reproduced) {
                break;
            }
        }

        attempt.ok = true;
        await captureAttemptEvidence(attempt, chromePage, edgePage, attempt.reproduced ? 'final-reproduced' : 'final-clean');
    } catch (error) {
        attempt.error = error && error.stack ? error.stack : String(error);
        logLine(`[hyperactive] attempt=${attemptIndex} error ${attempt.error}`);
        await captureAttemptEvidence(attempt, chromePage, edgePage, 'error');
        writeProgress({
            phase: 'attempt_error',
            attemptIndex,
            roomId: attempt.roomId,
            error: attempt.error,
            live: {
                chrome: attempt.final ? summarizeState(attempt.final.chrome) : null,
                edge: attempt.final ? summarizeState(attempt.final.edge) : null
            }
        });
    } finally {
        await Promise.allSettled([
            leaveRoomIfPossible(chromePage),
            leaveRoomIfPossible(edgePage)
        ]);
        await Promise.allSettled([
            chromeContext.close(),
            edgeContext.close()
        ]);
    }

    return attempt;
}

async function main() {
    const chromeBrowser = await chromium.launch({ channel: 'chrome', headless: HEADLESS, slowMo: SLOW_MO_MS || undefined });
    const edgeBrowser = await chromium.launch({ channel: 'msedge', headless: HEADLESS, slowMo: SLOW_MO_MS || undefined });
    const result = {
        ok: false,
        reproduced: false,
        targetCardId: TARGET_CARD_ID,
        targetCardType: TARGET_CARD_TYPE,
        targetMarkerType: TARGET_MARKER_TYPE,
        baseUrl: BASE_URL,
        serverUrl: SERVER_URL,
        headless: HEADLESS,
        slowMoMs: SLOW_MO_MS,
        timestamp: new Date().toISOString(),
        attempts: []
    };

    try {
        for (let attemptIndex = 1; attemptIndex <= MAX_ATTEMPTS; attemptIndex += 1) {
            const attempt = await runAttempt(chromeBrowser, edgeBrowser, attemptIndex);
            result.attempts.push(attempt);
            if (attempt.reproduced) {
                result.reproduced = true;
                result.ok = true;
                break;
            }
            if (attempt.ok) {
                result.ok = true;
            }
        }
    } finally {
        await Promise.allSettled([
            chromeBrowser.close(),
            edgeBrowser.close()
        ]);
    }

    writeJson(RESULT_PATH, result);
    if (result.reproduced) {
        process.stdout.write(`hyperactive reproduction found: ${RESULT_PATH}\n`);
        process.exit(0);
    }
    if (result.ok) {
        process.stdout.write(`hyperactive reproduction not found: ${RESULT_PATH}\n`);
        process.exit(0);
    }
    process.stderr.write(`hyperactive reproduction failed: ${RESULT_PATH}\n`);
    process.exit(1);
}

main().catch((error) => {
    const result = {
        ok: false,
        reproduced: false,
        targetCardId: TARGET_CARD_ID,
        targetCardType: TARGET_CARD_TYPE,
        targetMarkerType: TARGET_MARKER_TYPE,
        baseUrl: BASE_URL,
        serverUrl: SERVER_URL,
        headless: HEADLESS,
        slowMoMs: SLOW_MO_MS,
        timestamp: new Date().toISOString(),
        fatalError: error && error.stack ? error.stack : String(error)
    };
    writeJson(RESULT_PATH, result);
    process.stderr.write(`hyperactive reproduction crashed: ${RESULT_PATH}\n`);
    process.exit(1);
});
