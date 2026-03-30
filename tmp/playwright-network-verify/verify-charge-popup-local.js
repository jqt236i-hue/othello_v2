const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const DEFAULT_BASE_URL = 'http://127.0.0.1:8011/';
const DEFAULT_SERVER_URL = 'http://127.0.0.1:8791';
const VIEWPORT = { width: 1440, height: 1200 };
const OUT_DIR = path.join(process.cwd(), 'tmp', 'playwright-network-verify');
const RESULT_PATH = path.join(OUT_DIR, 'charge-popup-local-result.json');
const PROGRESS_PATH = path.join(OUT_DIR, 'charge-popup-local-progress.json');
const SCREENSHOT_BLACK_PATH = path.join(OUT_DIR, 'charge-popup-local-black-final.png');
const SCREENSHOT_WHITE_PATH = path.join(OUT_DIR, 'charge-popup-local-white-final.png');
const ERROR_SCREENSHOT_BLACK_PATH = path.join(OUT_DIR, 'charge-popup-local-black-error.png');
const ERROR_SCREENSHOT_WHITE_PATH = path.join(OUT_DIR, 'charge-popup-local-white-error.png');
const MAX_ACTIONS = 100;
const MATCH_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_STALL_CYCLES = 40;
const MAX_EVENT_LOG = 120;
const HEADLESS = !/^(0|false)$/i.test(String(process.env.HEADLESS || '0'));
const SLOW_MO_MS = Math.max(0, Number(process.env.SLOW_MO_MS || 100) || 0);
const TARGET_ACTIONS = Number.isFinite(Number(process.env.TARGET_ACTIONS))
    ? Math.max(1, Math.trunc(Number(process.env.TARGET_ACTIONS)))
    : null;

function readFirstEnv(names) {
    for (const name of names) {
        const raw = String(process.env[name] || '').trim();
        if (raw) return raw;
    }
    return '';
}

function normalizeAbsoluteUrl(value, label) {
    const raw = String(value || '').trim();
    if (!raw) {
        throw new Error(`${label} must be a non-empty URL`);
    }
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
    return new URL(withProtocol).toString();
}

function trimTrailingSlash(value) {
    return String(value || '').replace(/\/+$/, '');
}

function resolveRunnerUrls() {
    const baseUrl = normalizeAbsoluteUrl(readFirstEnv(['BASE_URL']) || DEFAULT_BASE_URL, 'BASE_URL');
    const baseUrlObject = new URL(baseUrl);
    const serverUrl = trimTrailingSlash(normalizeAbsoluteUrl(
        readFirstEnv(['MATCH_SERVER_URL', 'MATCH_SERVER', 'SERVER_URL'])
            || baseUrlObject.searchParams.get('matchServer')
            || DEFAULT_SERVER_URL,
        'SERVER_URL'
    ));
    baseUrlObject.searchParams.set('matchServer', serverUrl);
    return {
        baseUrl: baseUrlObject.toString(),
        serverUrl
    };
}

const { baseUrl: BASE_URL, serverUrl: SERVER_URL } = resolveRunnerUrls();

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

function posToNotation(row, col) {
    const cols = 'abcdefgh';
    return `${cols[col] || '?'}${Number(row) + 1}`;
}

function isCorner(row, col) {
    return (row === 0 || row === 7) && (col === 0 || col === 7);
}

function isEdge(row, col) {
    return row === 0 || row === 7 || col === 0 || col === 7;
}

function chooseMove(moves) {
    if (!Array.isArray(moves) || moves.length <= 0) return null;
    const scored = moves
        .filter((move) => move && Number.isInteger(move.row) && Number.isInteger(move.col))
        .map((move) => {
            let score = 0;
            if (isCorner(move.row, move.col)) score += 100000;
            else if (isEdge(move.row, move.col)) score += 10000;
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

function summarizeState(state) {
    if (!state || typeof state !== 'object') return null;
    return {
        seatKey: state.seatKey || null,
        currentPlayerKey: state.currentPlayerKey || null,
        canAct: state.canAct === true,
        turnNumber: Number.isFinite(state.turnNumber) ? state.turnNumber : null,
        turnIndex: Number.isFinite(state.turnIndex) ? state.turnIndex : null,
        legalMoves: Array.isArray(state.legalMoves) ? state.legalMoves.length : 0,
        pending: state.pending || null,
        consecutivePasses: Number.isFinite(state.consecutivePasses) ? state.consecutivePasses : 0,
        counts: state.counts || null,
        charge: state.charge || null,
        overlayVisible: state.overlayVisible === true,
        resultTitle: state.resultTitle || '',
        gameOver: state.gameOver === true
    };
}

async function launchBrowserWithFallback(preferredChannel, fallbackLabel, launchEvents) {
    const launchOptions = {
        headless: HEADLESS,
        slowMo: SLOW_MO_MS || undefined
    };
    try {
        const browser = await chromium.launch({
            ...launchOptions,
            channel: preferredChannel
        });
        launchEvents.push({
            browser: fallbackLabel,
            channel: preferredChannel,
            mode: 'preferred'
        });
        return { browser, label: preferredChannel };
    } catch (error) {
        launchEvents.push({
            browser: fallbackLabel,
            channel: preferredChannel,
            mode: 'fallback',
            error: error && error.message ? error.message : String(error)
        });
        const browser = await chromium.launch(launchOptions);
        return { browser, label: `chromium-${fallbackLabel}` };
    }
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
                && typeof window.isGameOver === 'function'
            );
        } catch (e) {
            return false;
        }
    }, { timeout: 30000 });
}

async function installChargeAudit(page) {
    await page.evaluate(() => {
        if (window.__chargePopupAuditInstalled === true) {
            if (window.__chargePopupAudit && Array.isArray(window.__chargePopupAudit.events)) {
                window.__chargePopupAudit.events.length = 0;
            }
            if (window.__chargePopupAudit && window.__chargePopupAudit.boardBubbleSeenIds) {
                window.__chargePopupAudit.boardBubbleSeenIds = {};
                window.__chargePopupAudit.nextBoardBubbleAuditId = 1;
            }
            return;
        }
        window.__chargePopupAudit = window.__chargePopupAudit || {
            events: [],
            boardBubbleSeenIds: {},
            nextBoardBubbleAuditId: 1,
            boardHookInstalled: false
        };
        const audit = window.__chargePopupAudit;
        function installNow() {
            if (window.__chargePopupAuditInstalled === true) return true;
            if (!window.StoneVisuals || typeof window.StoneVisuals.showChargeDelta !== 'function') return false;
            const original = window.StoneVisuals.showChargeDelta.bind(window.StoneVisuals);
            window.StoneVisuals.showChargeDelta = function patchedShowChargeDelta(slotKey, delta) {
                try {
                    const currentPlayerValue = window.gameState ? window.gameState.currentPlayer : null;
                    const currentPlayerKey = (currentPlayerValue === -1 || currentPlayerValue === 'white' || currentPlayerValue === '-1')
                        ? 'white'
                        : 'black';
                    const seatKey = window.NetworkMatchClient && typeof window.NetworkMatchClient.getSeatKey === 'function'
                        ? window.NetworkMatchClient.getSeatKey()
                        : null;
                    audit.events.push({
                        time: new Date().toISOString(),
                        slotKey: String(slotKey || ''),
                        delta: Number(delta || 0),
                        seatKey,
                        currentPlayerKey,
                        turnIndex: Number.isFinite(window.cardState && window.cardState.turnIndex)
                            ? Number(window.cardState.turnIndex)
                            : null,
                        charge: window.cardState && window.cardState.charge
                            ? {
                                black: Number(window.cardState.charge.black || 0),
                                white: Number(window.cardState.charge.white || 0)
                            }
                            : { black: 0, white: 0 },
                        texts: {
                            bottom: (document.getElementById('charge-black') || {}).textContent || '',
                            top: (document.getElementById('charge-white') || {}).textContent || ''
                        }
                    });
                } catch (error) {
                    // best effort only
                }
                return original(slotKey, delta);
            };
            if (audit.boardHookInstalled !== true
                && window.AnimationEngine
                && typeof window.AnimationEngine.handleObserverBubble === 'function') {
                const originalHandleObserverBubble = window.AnimationEngine.handleObserverBubble.bind(window.AnimationEngine);
                window.AnimationEngine.handleObserverBubble = function patchedHandleObserverBubble(ev) {
                    try {
                        const currentPlayerValue = window.gameState ? window.gameState.currentPlayer : null;
                        const currentPlayerKey = (currentPlayerValue === -1 || currentPlayerValue === 'white' || currentPlayerValue === '-1')
                            ? 'white'
                            : 'black';
                        const seatKey = window.NetworkMatchClient && typeof window.NetworkMatchClient.getSeatKey === 'function'
                            ? window.NetworkMatchClient.getSeatKey()
                            : null;
                        const charge = window.cardState && window.cardState.charge
                            ? {
                                black: Number(window.cardState.charge.black || 0),
                                white: Number(window.cardState.charge.white || 0)
                            }
                            : { black: 0, white: 0 };
                        const turnIndex = Number.isFinite(window.cardState && window.cardState.turnIndex)
                            ? Number(window.cardState.turnIndex)
                            : null;
                        const targets = Array.isArray(ev && ev.targets) ? ev.targets : [];
                        for (const target of targets) {
                            if (!target) continue;
                            const bubbleKind = String(target.bubbleKind || '').trim().toLowerCase();
                            if (bubbleKind !== 'charge') continue;
                            const ownerKey = String(target.owner || '').trim().toLowerCase() === 'white' ? 'white' : 'black';
                            const gained = Number(target.gained || 0);
                            audit.events.push({
                                kind: 'board',
                                time: new Date().toISOString(),
                                row: Number.isFinite(Number(target.r)) ? Number(target.r) : null,
                                col: Number.isFinite(Number(target.col)) ? Number(target.col) : null,
                                ownerKey,
                                delta: gained,
                                seatKey,
                                currentPlayerKey,
                                turnIndex,
                                charge,
                                bubbleKind,
                                text: gained > 0 ? `+${gained}` : String(target.text || '').trim()
                            });
                        }
                    } catch (error) {
                        // best effort only
                    }
                    return originalHandleObserverBubble(ev);
                };
                audit.boardHookInstalled = true;
            }
            audit.events.length = 0;
            window.__chargePopupAuditInstalled = true;
            return true;
        }
        if (installNow()) return;
        const startedAt = Date.now();
        const timer = setInterval(() => {
            if (installNow() || (Date.now() - startedAt) > 10000) {
                clearInterval(timer);
            }
        }, 50);
    });
    await page.waitForFunction(() => window.__chargePopupAuditInstalled === true, { timeout: 10000 });
}

async function drainChargeAuditEvents(page) {
    return page.evaluate(() => {
        const audit = window.__chargePopupAudit && Array.isArray(window.__chargePopupAudit.events)
            ? window.__chargePopupAudit
            : { events: [], boardBubbleSeenIds: {}, nextBoardBubbleAuditId: 1 };
        const events = audit.events.slice();
        const boardBubbleSeenIds = (audit.boardBubbleSeenIds && typeof audit.boardBubbleSeenIds === 'object')
            ? audit.boardBubbleSeenIds
            : {};
        let nextBoardBubbleAuditId = Number.isFinite(Number(audit.nextBoardBubbleAuditId))
            ? Math.max(1, Math.trunc(Number(audit.nextBoardBubbleAuditId)))
            : 1;
        const currentPlayerValue = window.gameState ? window.gameState.currentPlayer : null;
        const currentPlayerKey = (currentPlayerValue === -1 || currentPlayerValue === 'white' || currentPlayerValue === '-1')
            ? 'white'
            : 'black';
        const seatKey = window.NetworkMatchClient && typeof window.NetworkMatchClient.getSeatKey === 'function'
            ? window.NetworkMatchClient.getSeatKey()
            : null;
        const charge = window.cardState && window.cardState.charge
            ? {
                black: Number(window.cardState.charge.black || 0),
                white: Number(window.cardState.charge.white || 0)
            }
            : { black: 0, white: 0 };
        const turnIndex = Number.isFinite(window.cardState && window.cardState.turnIndex)
            ? Number(window.cardState.turnIndex)
            : null;
        if (audit.boardHookInstalled !== true) {
            const boardBubbles = Array.from(document.querySelectorAll('.board-charge-bubble[data-bubble-kind="charge"]'));
            for (const bubble of boardBubbles) {
                if (!bubble || !bubble.dataset) continue;
                if (!bubble.dataset.auditId) {
                    bubble.dataset.auditId = `charge-bubble-${nextBoardBubbleAuditId}`;
                    nextBoardBubbleAuditId += 1;
                }
                const auditId = String(bubble.dataset.auditId || '').trim();
                if (!auditId || boardBubbleSeenIds[auditId] === true) continue;
                boardBubbleSeenIds[auditId] = true;
                const labelEl = bubble.querySelector('[data-charge-label="true"]');
                const gained = Number(bubble.dataset.gained || 0);
                events.push({
                    kind: 'board',
                    time: new Date().toISOString(),
                    auditId,
                    row: Number.isFinite(Number(bubble.dataset.row)) ? Number(bubble.dataset.row) : null,
                    col: Number.isFinite(Number(bubble.dataset.col)) ? Number(bubble.dataset.col) : null,
                    ownerKey: String(bubble.dataset.owner || '').trim().toLowerCase() === 'white' ? 'white' : 'black',
                    delta: gained,
                    seatKey,
                    currentPlayerKey,
                    turnIndex,
                    charge,
                    bubbleKind: String(bubble.dataset.bubbleKind || '').trim().toLowerCase() || 'charge',
                    text: labelEl ? String(labelEl.textContent || '').trim() : String(bubble.textContent || '').trim()
                });
            }
        }
        audit.events.length = 0;
        audit.boardBubbleSeenIds = boardBubbleSeenIds;
        audit.nextBoardBubbleAuditId = nextBoardBubbleAuditId;
        return {
            boardHookInstalled: audit.boardHookInstalled === true,
            events
        };
    });
}

async function waitForPlaybackIdle(page, timeout = 20000) {
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
        } catch (e) {
            return true;
        }
    }, { timeout });
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
        // best effort only
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
        function cloneBoard(board) {
            return Array.isArray(board)
                ? board.map((row) => Array.isArray(row) ? row.slice() : [])
                : [];
        }
        const currentPlayerValue = window.gameState ? window.gameState.currentPlayer : null;
        const currentPlayerKey = (currentPlayerValue === -1 || currentPlayerValue === 'white' || currentPlayerValue === '-1')
            ? 'white'
            : 'black';
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
        } catch (e) {
            legalMoves = [];
        }
        if (!Array.isArray(legalMoves) || legalMoves.length <= 0) {
            const domMoves = Array.from(document.querySelectorAll('#board .cell.legal, #board .cell.legal-free'));
            legalMoves = domMoves.map((cell) => ({
                row: Number(cell.dataset.row),
                col: Number(cell.dataset.col),
                flips: []
            }));
        }
        const pending = seatKey && window.cardState && window.cardState.pendingEffectByPlayer
            ? window.cardState.pendingEffectByPlayer[seatKey] || null
            : null;
        const counts = typeof window.countDiscs === 'function' && window.gameState
            ? window.countDiscs(window.gameState)
            : null;
        const overlay = document.getElementById('result-overlay');
        const resultTitleEl = overlay ? overlay.querySelector('.result-title') : null;
        let gameOver = false;
        try {
            gameOver = typeof window.isGameOver === 'function' && window.gameState
                ? !!window.isGameOver(window.gameState)
                : false;
        } catch (e) {
            gameOver = false;
        }
        return {
            seatKey,
            currentPlayerKey,
            canAct: seatKey === currentPlayerKey,
            legalMoves: Array.isArray(legalMoves)
                ? legalMoves
                    .filter((move) => move && Number.isInteger(Number(move.row)) && Number.isInteger(Number(move.col)))
                    .map((move) => ({
                        row: Number(move.row),
                        col: Number(move.col),
                        flips: Array.isArray(move.flips) ? move.flips.length : Number(move.flipCount || 0)
                    }))
                : [],
            pending: pending ? { type: pending.type || null, stage: pending.stage || null } : null,
            turnNumber: Number.isFinite(window.gameState && window.gameState.turnNumber)
                ? Number(window.gameState.turnNumber)
                : null,
            turnIndex: Number.isFinite(window.cardState && window.cardState.turnIndex)
                ? Number(window.cardState.turnIndex)
                : null,
            consecutivePasses: Number(window.gameState && window.gameState.consecutivePasses) || 0,
            counts,
            charge: window.cardState && window.cardState.charge
                ? {
                    black: Number(window.cardState.charge.black || 0),
                    white: Number(window.cardState.charge.white || 0)
                }
                : { black: 0, white: 0 },
            overlayVisible: !!overlay,
            resultTitle: resultTitleEl ? String(resultTitleEl.textContent || '').trim() : '',
            gameOver,
            board: cloneBoard(window.gameState && window.gameState.board)
        };
    });
}

function makeTurnSignature(leftState, rightState) {
    return {
        leftCurrentPlayerKey: leftState ? leftState.currentPlayerKey : null,
        rightCurrentPlayerKey: rightState ? rightState.currentPlayerKey : null,
        leftTurnIndex: leftState && Number.isFinite(leftState.turnIndex) ? leftState.turnIndex : null,
        rightTurnIndex: rightState && Number.isFinite(rightState.turnIndex) ? rightState.turnIndex : null,
        leftConsecutivePasses: leftState && Number.isFinite(leftState.consecutivePasses) ? leftState.consecutivePasses : 0,
        rightConsecutivePasses: rightState && Number.isFinite(rightState.consecutivePasses) ? rightState.consecutivePasses : 0
    };
}

function didTurnSignatureAdvance(previousSignature, leftState, rightState) {
    if (!previousSignature) return true;
    if (!leftState || !rightState) return false;
    if (leftState.gameOver || rightState.gameOver || leftState.overlayVisible || rightState.overlayVisible) return true;
    if (leftState.currentPlayerKey !== previousSignature.leftCurrentPlayerKey) return true;
    if (rightState.currentPlayerKey !== previousSignature.rightCurrentPlayerKey) return true;
    if (Number.isFinite(leftState.turnIndex) && Number.isFinite(previousSignature.leftTurnIndex) && leftState.turnIndex !== previousSignature.leftTurnIndex) return true;
    if (Number.isFinite(rightState.turnIndex) && Number.isFinite(previousSignature.rightTurnIndex) && rightState.turnIndex !== previousSignature.rightTurnIndex) return true;
    if ((leftState.consecutivePasses || 0) !== (previousSignature.leftConsecutivePasses || 0)) return true;
    if ((rightState.consecutivePasses || 0) !== (previousSignature.rightConsecutivePasses || 0)) return true;
    return false;
}

async function waitForSynchronizedState(leftPage, rightPage, timeout = 25000) {
    const startedAt = Date.now();
    let lastStates = null;
    while ((Date.now() - startedAt) < timeout) {
        const states = await Promise.all([
            getLiveState(leftPage),
            getLiveState(rightPage)
        ]);
        lastStates = states;
        const leftState = states[0];
        const rightState = states[1];
        const sameCurrentPlayer = leftState.currentPlayerKey === rightState.currentPlayerKey;
        const sameTurnIndex = (
            Number.isFinite(leftState.turnIndex)
            && Number.isFinite(rightState.turnIndex)
        ) ? leftState.turnIndex === rightState.turnIndex : true;
        if (sameCurrentPlayer && sameTurnIndex) {
            return { leftState, rightState };
        }
        await wait(250);
    }
    const leftState = lastStates ? lastStates[0] : null;
    const rightState = lastStates ? lastStates[1] : null;
    throw new Error(`state sync timeout: left=${JSON.stringify(leftState)} right=${JSON.stringify(rightState)}`);
}

async function waitForGlobalTurnAdvance(leftPage, rightPage, previousSignature, timeout = 25000) {
    const startedAt = Date.now();
    let lastStates = null;
    while ((Date.now() - startedAt) < timeout) {
        const { leftState, rightState } = await waitForSynchronizedState(leftPage, rightPage, Math.min(5000, timeout));
        lastStates = [leftState, rightState];
        if (didTurnSignatureAdvance(previousSignature, leftState, rightState)) {
            return { leftState, rightState };
        }
        await wait(250);
    }
    const leftState = lastStates ? lastStates[0] : null;
    const rightState = lastStates ? lastStates[1] : null;
    throw new Error(`turn advance timeout: left=${JSON.stringify(leftState)} right=${JSON.stringify(rightState)}`);
}

async function performPlacement(page, move) {
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
        } catch (e) {
            return { ok: false, reason: e && e.message ? e.message : String(e) };
        }
    }, move);
    if (!actionResult || actionResult.ok !== true) {
        throw new Error(`placement failed: ${actionResult ? actionResult.reason : 'unknown'}`);
    }
    return actionResult;
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
        } catch (e) {
            return { ok: false, reason: e && e.message ? e.message : String(e) };
        }
    });
    if (!actionResult || actionResult.ok !== true) {
        throw new Error(`pass failed: ${actionResult ? actionResult.reason : 'unknown'}`);
    }
    return actionResult;
}

async function waitForBothIdle(leftPage, rightPage) {
    await Promise.all([
        waitForPlaybackIdle(leftPage).catch(() => {}),
        waitForPlaybackIdle(rightPage).catch(() => {})
    ]);
    await wait(300);
}

async function waitForFinalResult(leftPage, rightPage) {
    await Promise.all([
        leftPage.waitForFunction(() => {
            try {
                return !!document.getElementById('result-overlay')
                    || (typeof window.isGameOver === 'function' && window.gameState && window.isGameOver(window.gameState));
            } catch (e) {
                return false;
            }
        }, { timeout: 10000 }).catch(() => {}),
        rightPage.waitForFunction(() => {
            try {
                return !!document.getElementById('result-overlay')
                    || (typeof window.isGameOver === 'function' && window.gameState && window.isGameOver(window.gameState));
            } catch (e) {
                return false;
            }
        }, { timeout: 10000 }).catch(() => {})
    ]);
}

function mapSlotKeyToOwner(slotKey, seatKey) {
    const bottomOwnerKey = seatKey === 'white' ? 'white' : 'black';
    const topOwnerKey = bottomOwnerKey === 'black' ? 'white' : 'black';
    return slotKey === 'black' ? bottomOwnerKey : topOwnerKey;
}

function updateBoardHookStatus(result, leftAuditCapture, rightAuditCapture) {
    if (!result || !result.chargeAudit) return;
    result.chargeAudit.boardHookInstalled = {
        left: !!(leftAuditCapture && leftAuditCapture.boardHookInstalled === true),
        right: !!(rightAuditCapture && rightAuditCapture.boardHookInstalled === true)
    };
}

function describeBoardHookMode(installed) {
    return installed === true ? 'hook' : 'dom-fallback';
}

function analyzeChargePopupEvents(pageLabel, beforeState, afterState, auditCapture) {
    const safeBefore = beforeState || { charge: { black: 0, white: 0 }, seatKey: 'black' };
    const safeAfter = afterState || safeBefore;
    const normalizedEvents = Array.isArray(auditCapture && auditCapture.events)
        ? auditCapture.events
        : (Array.isArray(auditCapture) ? auditCapture : []);
    const popupByOwner = { black: 0, white: 0 };
    const detailedEvents = normalizedEvents.map((event) => {
        const ownerKey = (event && event.kind === 'board')
            ? (String(event && event.ownerKey || '').trim().toLowerCase() === 'white' ? 'white' : 'black')
            : mapSlotKeyToOwner(event && event.slotKey, safeAfter.seatKey || safeBefore.seatKey);
        const delta = Number(event && event.delta) || 0;
        popupByOwner[ownerKey] += delta;
        return Object.assign({}, event, {
            kind: event && event.kind === 'board' ? 'board' : 'hud',
            ownerKey,
            delta
        });
    });
    const expectedByOwner = {
        black: Number((safeAfter.charge && safeAfter.charge.black) || 0) - Number((safeBefore.charge && safeBefore.charge.black) || 0),
        white: Number((safeAfter.charge && safeAfter.charge.white) || 0) - Number((safeBefore.charge && safeBefore.charge.white) || 0)
    };
    const mismatches = [];
    for (const ownerKey of ['black', 'white']) {
        const popupDelta = Number(popupByOwner[ownerKey] || 0);
        const expectedDelta = Number(expectedByOwner[ownerKey] || 0);
        if (popupDelta !== expectedDelta) {
            mismatches.push({
                page: pageLabel,
                ownerKey,
                popupDelta,
                expectedDelta,
                afterCharge: Number((safeAfter.charge && safeAfter.charge[ownerKey]) || 0),
                beforeCharge: Number((safeBefore.charge && safeBefore.charge[ownerKey]) || 0),
                replayedCurrentTotal: popupDelta !== 0 && popupDelta === Number((safeAfter.charge && safeAfter.charge[ownerKey]) || 0) && expectedDelta !== popupDelta
            });
        }
    }
    return {
        page: pageLabel,
        seatKey: safeAfter.seatKey || safeBefore.seatKey || null,
        boardHookInstalled: !!(auditCapture && auditCapture.boardHookInstalled === true),
        popupByOwner,
        expectedByOwner,
        events: detailedEvents,
        mismatches
    };
}

async function leaveRoomIfPossible(page) {
    try {
        await page.evaluate(async () => {
            if (window.NetworkMatchClient && typeof window.NetworkMatchClient.leaveRoom === 'function') {
                await window.NetworkMatchClient.leaveRoom();
            }
        });
    } catch (e) {
        // ignore
    }
}

async function getLiveStateSafe(page) {
    try {
        return await getLiveState(page);
    } catch (error) {
        return { error: error && error.message ? error.message : String(error) };
    }
}

async function captureEvidence(result, leftPage, rightPage, screenshotLeftPath, screenshotRightPath) {
    const [leftState, rightState] = await Promise.all([
        getLiveStateSafe(leftPage),
        getLiveStateSafe(rightPage)
    ]);
    result.final = {
        actionsExecuted: Array.isArray(result.actions) ? result.actions.length : 0,
        left: leftState,
        right: rightState
    };
    await Promise.allSettled([
        leftPage.screenshot({ path: screenshotLeftPath, fullPage: true, animations: 'disabled' }),
        rightPage.screenshot({ path: screenshotRightPath, fullPage: true, animations: 'disabled' })
    ]);
    writeJson(PROGRESS_PATH, result);
}

async function main() {
    const launchEvents = [];
    const leftLaunch = await launchBrowserWithFallback('chrome', 'left', launchEvents);
    const rightLaunch = await launchBrowserWithFallback('msedge', 'right', launchEvents);
    const leftBrowser = leftLaunch.browser;
    const rightBrowser = rightLaunch.browser;
    const leftContext = await leftBrowser.newContext({ viewport: VIEWPORT });
    const rightContext = await rightBrowser.newContext({ viewport: VIEWPORT });
    const leftPage = await leftContext.newPage();
    const rightPage = await rightContext.newPage();

    const result = {
        ok: false,
        baseUrl: BASE_URL,
        serverUrl: SERVER_URL,
        timestamp: new Date().toISOString(),
        browsers: {
            left: leftLaunch.label,
            right: rightLaunch.label
        },
        launchEvents,
        headless: HEADLESS,
        slowMoMs: SLOW_MO_MS,
        roomId: null,
        actions: [],
        stallEvents: [],
        pageEvents: [],
        chargeAudit: {
            totalPopupEvents: 0,
            totalActionsWithChargeChange: 0,
            mismatches: [],
            boardHookInstalled: {
                left: null,
                right: null
            }
        },
        final: null,
        error: null
    };

    try {
        installPageObservers(leftPage, result.browsers.left, result);
        installPageObservers(rightPage, result.browsers.right, result);
        logLine(`[charge-verify] base=${BASE_URL} server=${SERVER_URL} headless=${HEADLESS} slowMo=${SLOW_MO_MS}`);
        await Promise.all([
            leftPage.goto(BASE_URL, { waitUntil: 'domcontentloaded' }),
            rightPage.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
        ]);
        await Promise.all([waitForGameReady(leftPage), waitForGameReady(rightPage)]);
        await Promise.all([installChargeAudit(leftPage), installChargeAudit(rightPage)]);

        const createResult = await createRoom(leftPage, 'C01');
        result.roomId = createResult && createResult.roomId ? createResult.roomId : null;
        logLine(`[charge-verify] room=${result.roomId}`);
        await joinRoom(rightPage, result.roomId, 'E01');
        await Promise.all([waitForTwoPlayers(leftPage), waitForTwoPlayers(rightPage)]);
        await Promise.all([closeNetworkOverlayIfOpen(leftPage), closeNetworkOverlayIfOpen(rightPage)]);
        await waitForBothIdle(leftPage, rightPage);
        await waitForSynchronizedState(leftPage, rightPage);
        const [initialLeftAuditCapture, initialRightAuditCapture] = await Promise.all([
            drainChargeAuditEvents(leftPage),
            drainChargeAuditEvents(rightPage)
        ]);
        updateBoardHookStatus(result, initialLeftAuditCapture, initialRightAuditCapture);
        logLine(
            `[charge-verify] capture mode left=${describeBoardHookMode(result.chargeAudit.boardHookInstalled.left)} `
            + `right=${describeBoardHookMode(result.chargeAudit.boardHookInstalled.right)}`
        );
        writeJson(PROGRESS_PATH, result);

        let actionCount = 0;
        let stallCycles = 0;
        const matchStartedAt = Date.now();
        let targetActionsReached = false;
        while (actionCount < MAX_ACTIONS) {
            if ((Date.now() - matchStartedAt) > MATCH_TIMEOUT_MS) {
                throw new Error(`charge verification timeout after ${MATCH_TIMEOUT_MS}ms`);
            }

            const { leftState, rightState } = await waitForSynchronizedState(leftPage, rightPage);
            const previousSignature = makeTurnSignature(leftState, rightState);
            writeJson(PROGRESS_PATH, {
                ...result,
                live: {
                    left: summarizeState(leftState),
                    right: summarizeState(rightState)
                }
            });

            if (leftState.gameOver || rightState.gameOver || leftState.overlayVisible || rightState.overlayVisible) {
                break;
            }

            const activePlayerKey = leftState.currentPlayerKey;
            const activePage = leftState.seatKey === activePlayerKey ? leftPage : rightPage;
            const activeBrowser = leftState.seatKey === activePlayerKey ? result.browsers.left : result.browsers.right;
            const activeState = leftState.seatKey === activePlayerKey ? leftState : rightState;

            if (!activeState || activeState.canAct !== true) {
                stallCycles += 1;
                if (stallCycles === 1 || (stallCycles % 5) === 0) {
                    appendLimited(result.stallEvents, {
                        time: new Date().toISOString(),
                        stallCycles,
                        activePlayerKey,
                        left: summarizeState(leftState),
                        right: summarizeState(rightState)
                    });
                    logLine(`[charge-verify] stall cycles=${stallCycles} active=${activePlayerKey}`);
                }
                if (stallCycles >= MAX_STALL_CYCLES) {
                    throw new Error(`verification stalled without an actionable client: left=${JSON.stringify(summarizeState(leftState))} right=${JSON.stringify(summarizeState(rightState))}`);
                }
                await wait(500);
                continue;
            }
            stallCycles = 0;

            if (activeState.pending && activeState.pending.stage === 'selectTarget') {
                throw new Error(`pending selection encountered during baseline selfmatch: ${activeState.pending.type}`);
            }

            if (Array.isArray(activeState.legalMoves) && activeState.legalMoves.length > 0) {
                const move = chooseMove(activeState.legalMoves);
                if (!move) {
                    throw new Error('failed to choose a legal move');
                }
                await performPlacement(activePage, move);
                const advanced = await waitForGlobalTurnAdvance(leftPage, rightPage, previousSignature);
                await waitForBothIdle(leftPage, rightPage);
                const [leftAuditCapture, rightAuditCapture] = await Promise.all([
                    drainChargeAuditEvents(leftPage),
                    drainChargeAuditEvents(rightPage)
                ]);
                updateBoardHookStatus(result, leftAuditCapture, rightAuditCapture);
                const leftAudit = analyzeChargePopupEvents('left', leftState, advanced.leftState, leftAuditCapture);
                const rightAudit = analyzeChargePopupEvents('right', rightState, advanced.rightState, rightAuditCapture);
                const actionRecord = {
                    index: actionCount + 1,
                    browser: activeBrowser,
                    playerKey: activePlayerKey,
                    type: 'place',
                    row: move.row,
                    col: move.col,
                    notation: posToNotation(move.row, move.col),
                    before: {
                        left: summarizeState(leftState),
                        right: summarizeState(rightState)
                    },
                    after: {
                        left: summarizeState(advanced.leftState),
                        right: summarizeState(advanced.rightState)
                    },
                    chargeAudit: {
                        left: leftAudit,
                        right: rightAudit
                    }
                };
                result.actions.push(actionRecord);
                result.chargeAudit.totalPopupEvents += leftAudit.events.length + rightAudit.events.length;
                if ((leftAudit.expectedByOwner.black !== 0 || leftAudit.expectedByOwner.white !== 0)
                    || (rightAudit.expectedByOwner.black !== 0 || rightAudit.expectedByOwner.white !== 0)) {
                    result.chargeAudit.totalActionsWithChargeChange += 1;
                }
                if (leftAudit.mismatches.length > 0 || rightAudit.mismatches.length > 0) {
                    result.chargeAudit.mismatches.push({
                        actionIndex: actionCount + 1,
                        notation: posToNotation(move.row, move.col),
                        left: leftAudit.mismatches,
                        right: rightAudit.mismatches
                    });
                    throw new Error(`charge popup mismatch after ${posToNotation(move.row, move.col)}: ${JSON.stringify({ left: leftAudit.mismatches, right: rightAudit.mismatches })}`);
                }
                logLine(`[charge-verify] #${actionCount + 1} ${activeBrowser}/${activePlayerKey} place ${posToNotation(move.row, move.col)} popupEvents=${leftAudit.events.length + rightAudit.events.length}`);
            } else {
                await performPass(activePage);
                const advanced = await waitForGlobalTurnAdvance(leftPage, rightPage, previousSignature);
                await waitForBothIdle(leftPage, rightPage);
                const [leftAuditCapture, rightAuditCapture] = await Promise.all([
                    drainChargeAuditEvents(leftPage),
                    drainChargeAuditEvents(rightPage)
                ]);
                updateBoardHookStatus(result, leftAuditCapture, rightAuditCapture);
                const leftAudit = analyzeChargePopupEvents('left', leftState, advanced.leftState, leftAuditCapture);
                const rightAudit = analyzeChargePopupEvents('right', rightState, advanced.rightState, rightAuditCapture);
                const actionRecord = {
                    index: actionCount + 1,
                    browser: activeBrowser,
                    playerKey: activePlayerKey,
                    type: 'pass',
                    before: {
                        left: summarizeState(leftState),
                        right: summarizeState(rightState)
                    },
                    after: {
                        left: summarizeState(advanced.leftState),
                        right: summarizeState(advanced.rightState)
                    },
                    chargeAudit: {
                        left: leftAudit,
                        right: rightAudit
                    }
                };
                result.actions.push(actionRecord);
                result.chargeAudit.totalPopupEvents += leftAudit.events.length + rightAudit.events.length;
                if ((leftAudit.expectedByOwner.black !== 0 || leftAudit.expectedByOwner.white !== 0)
                    || (rightAudit.expectedByOwner.black !== 0 || rightAudit.expectedByOwner.white !== 0)) {
                    result.chargeAudit.totalActionsWithChargeChange += 1;
                }
                if (leftAudit.mismatches.length > 0 || rightAudit.mismatches.length > 0) {
                    result.chargeAudit.mismatches.push({
                        actionIndex: actionCount + 1,
                        notation: 'pass',
                        left: leftAudit.mismatches,
                        right: rightAudit.mismatches
                    });
                    throw new Error(`charge popup mismatch after pass: ${JSON.stringify({ left: leftAudit.mismatches, right: rightAudit.mismatches })}`);
                }
                logLine(`[charge-verify] #${actionCount + 1} ${activeBrowser}/${activePlayerKey} pass popupEvents=${leftAudit.events.length + rightAudit.events.length}`);
            }

            actionCount += 1;
            writeJson(PROGRESS_PATH, result);
            if (TARGET_ACTIONS !== null && actionCount >= TARGET_ACTIONS) {
                targetActionsReached = true;
                break;
            }
        }

        if (actionCount >= MAX_ACTIONS) {
            throw new Error(`verification reached MAX_ACTIONS=${MAX_ACTIONS} without final resolution`);
        }

        if (!targetActionsReached) {
            await waitForFinalResult(leftPage, rightPage);
            await waitForBothIdle(leftPage, rightPage);
        }
        const [finalLeftState, finalRightState] = await Promise.all([
            getLiveState(leftPage),
            getLiveState(rightPage)
        ]);

        result.final = {
            actionsExecuted: result.actions.length,
            targetActions: TARGET_ACTIONS,
            left: finalLeftState,
            right: finalRightState
        };
        result.ok = targetActionsReached
            ? !!(
                result.chargeAudit.mismatches.length === 0
                && result.chargeAudit.totalPopupEvents > 0
                && result.actions.length >= TARGET_ACTIONS
            )
            : !!(
                result.chargeAudit.mismatches.length === 0
                && result.chargeAudit.totalPopupEvents > 0
                && (finalLeftState.gameOver || finalLeftState.overlayVisible)
                && (finalRightState.gameOver || finalRightState.overlayVisible)
            );
        logLine(
            targetActionsReached
                ? `[charge-verify] target actions reached=${TARGET_ACTIONS} popups=${result.chargeAudit.totalPopupEvents} `
                    + `hooks=left:${describeBoardHookMode(result.chargeAudit.boardHookInstalled.left)},`
                    + `right:${describeBoardHookMode(result.chargeAudit.boardHookInstalled.right)} `
                    + `mismatches=${result.chargeAudit.mismatches.length} ok=${result.ok}`
                : `[charge-verify] final popups=${result.chargeAudit.totalPopupEvents} `
                    + `hooks=left:${describeBoardHookMode(result.chargeAudit.boardHookInstalled.left)},`
                    + `right:${describeBoardHookMode(result.chargeAudit.boardHookInstalled.right)} `
                    + `mismatches=${result.chargeAudit.mismatches.length} ok=${result.ok}`
        );

        await leftPage.screenshot({ path: SCREENSHOT_BLACK_PATH, fullPage: true, animations: 'disabled' });
        await rightPage.screenshot({ path: SCREENSHOT_WHITE_PATH, fullPage: true, animations: 'disabled' });
        writeJson(PROGRESS_PATH, result);
    } catch (error) {
        result.error = error && error.stack ? error.stack : String(error);
        logLine(`[charge-verify] error ${result.error}`);
        await captureEvidence(result, leftPage, rightPage, ERROR_SCREENSHOT_BLACK_PATH, ERROR_SCREENSHOT_WHITE_PATH);
    } finally {
        await Promise.allSettled([
            leaveRoomIfPossible(leftPage),
            leaveRoomIfPossible(rightPage)
        ]);
        await Promise.allSettled([
            leftContext.close(),
            rightContext.close()
        ]);
        await Promise.allSettled([
            leftBrowser.close(),
            rightBrowser.close()
        ]);
    }

    writeJson(RESULT_PATH, result);
    if (result.ok) {
        process.stdout.write(`charge verification succeeded: ${RESULT_PATH}\n`);
        process.exit(0);
    }

    process.stderr.write(`charge verification failed: ${RESULT_PATH}\n`);
    process.exit(1);
}

if (require.main === module) {
    main();
}
