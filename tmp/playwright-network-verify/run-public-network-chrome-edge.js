const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = 'https://card-othello-match.jqt236i.workers.dev';
const VIEWPORT = { width: 1440, height: 1200 };
const OUT_DIR = path.join(process.cwd(), 'tmp', 'playwright-network-verify');
const RESULT_PATH = path.join(OUT_DIR, 'chrome-edge-public-match-result.json');
const SCREENSHOT_BLACK_PATH = path.join(OUT_DIR, 'chrome-final.png');
const SCREENSHOT_WHITE_PATH = path.join(OUT_DIR, 'edge-final.png');
const MAX_ACTIONS = 100;
const MATCH_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_STALL_CYCLES = 40;
const PROGRESS_PATH = path.join(OUT_DIR, 'chrome-edge-public-match-progress.json');
const ERROR_SCREENSHOT_BLACK_PATH = path.join(OUT_DIR, 'chrome-error.png');
const ERROR_SCREENSHOT_WHITE_PATH = path.join(OUT_DIR, 'edge-error.png');
const MAX_EVENT_LOG = 80;
const HEADLESS = !/^(0|false)$/i.test(String(process.env.HEADLESS || '1'));
const SLOW_MO_MS = Math.max(0, Number(process.env.SLOW_MO_MS || 0) || 0);

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
    if (value === -1 || value === 'white' || value === '-1') return 'white';
    return 'black';
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
        overlayVisible: state.overlayVisible === true,
        resultTitle: state.resultTitle || '',
        gameOver: state.gameOver === true
    };
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

async function closeNetworkOverlayIfOpen(page) {
    try {
        await page.evaluate(() => {
            const overlay = document.getElementById('networkOverlay');
            const closeBtn = document.getElementById('networkCloseBtn');
            const visible = !!(overlay && overlay.classList && overlay.classList.contains('active'));
            if (visible && closeBtn && typeof closeBtn.click === 'function') closeBtn.click();
        });
    } catch (e) {
        // best-effort only
    }
}

async function openNetworkDialog(page, playerName) {
    await page.getByRole('button', { name: 'ネット対戦' }).click();
    await page.waitForFunction(() => {
        try {
            return window.MATCH_MODE === 'network' || window.__MATCH_MODE === 'network';
        } catch (e) {
            return false;
        }
    }, { timeout: 10000 });
    await page.getByRole('textbox', { name: '名前を入力してください' }).fill(playerName);
}

async function createRoom(page, playerName) {
    await openNetworkDialog(page, playerName);
    await page.getByRole('button', { name: '部屋作成' }).click();
    const roomInput = page.getByRole('textbox', { name: '部屋番号（3桁）' });
    await page.waitForFunction(() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        const room = inputs.find((input) => String(input.getAttribute('placeholder') || '').includes('部屋番号'));
        return !!(room && /^[A-Z0-9]{3}$/.test(room.value));
    }, { timeout: 15000 });
    return roomInput.inputValue();
}

async function joinRoom(page, roomId, playerName) {
    await openNetworkDialog(page, playerName);
    await page.getByRole('textbox', { name: '部屋番号（3桁）' }).fill(roomId);
    await page.getByRole('button', { name: '参加' }).click();
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
        const currentPlayerValue = window.gameState ? window.gameState.currentPlayer : null;
        const currentPlayerKey = currentPlayerValue === -1 || currentPlayerValue === 'white' || currentPlayerValue === '-1'
            ? 'white'
            : 'black';
        const seatKey = window.NetworkMatchClient && typeof window.NetworkMatchClient.getSeatKey === 'function'
            ? window.NetworkMatchClient.getSeatKey()
            : null;
        const protection = typeof window.getActiveProtectionForPlayer === 'function'
            ? window.getActiveProtectionForPlayer(currentPlayerValue)
            : [];
        const perma = typeof window.getFlipBlockers === 'function'
            ? window.getFlipBlockers()
            : [];
        let legalMoves = [];
        try {
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
        const pending = window.cardState && window.cardState.pendingEffectByPlayer
            ? window.cardState.pendingEffectByPlayer[currentPlayerKey] || null
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
            overlayVisible: !!overlay,
            resultTitle: resultTitleEl ? String(resultTitleEl.textContent || '').trim() : '',
            resultText: overlay ? String(overlay.innerText || '').replace(/\s+/g, ' ').trim() : '',
            gameOver
        };
    });
}

function makeTurnSignature(chromeState, edgeState) {
    return {
        chromeCurrentPlayerKey: chromeState ? chromeState.currentPlayerKey : null,
        edgeCurrentPlayerKey: edgeState ? edgeState.currentPlayerKey : null,
        chromeTurnIndex: chromeState && Number.isFinite(chromeState.turnIndex) ? chromeState.turnIndex : null,
        edgeTurnIndex: edgeState && Number.isFinite(edgeState.turnIndex) ? edgeState.turnIndex : null,
        chromeConsecutivePasses: chromeState && Number.isFinite(chromeState.consecutivePasses) ? chromeState.consecutivePasses : 0,
        edgeConsecutivePasses: edgeState && Number.isFinite(edgeState.consecutivePasses) ? edgeState.consecutivePasses : 0
    };
}

function didTurnSignatureAdvance(previousSignature, chromeState, edgeState) {
    if (!previousSignature) return true;
    if (!chromeState || !edgeState) return false;
    if (chromeState.gameOver || edgeState.gameOver || chromeState.overlayVisible || edgeState.overlayVisible) return true;
    if (chromeState.currentPlayerKey !== previousSignature.chromeCurrentPlayerKey) return true;
    if (edgeState.currentPlayerKey !== previousSignature.edgeCurrentPlayerKey) return true;
    if (Number.isFinite(chromeState.turnIndex) && Number.isFinite(previousSignature.chromeTurnIndex) && chromeState.turnIndex !== previousSignature.chromeTurnIndex) return true;
    if (Number.isFinite(edgeState.turnIndex) && Number.isFinite(previousSignature.edgeTurnIndex) && edgeState.turnIndex !== previousSignature.edgeTurnIndex) return true;
    if ((chromeState.consecutivePasses || 0) !== (previousSignature.chromeConsecutivePasses || 0)) return true;
    if ((edgeState.consecutivePasses || 0) !== (previousSignature.edgeConsecutivePasses || 0)) return true;
    return false;
}

async function waitForSynchronizedState(chromePage, edgePage, timeout = 25000) {
    const startedAt = Date.now();
    let lastStates = null;
    while ((Date.now() - startedAt) < timeout) {
        const states = await Promise.all([
            getLiveState(chromePage),
            getLiveState(edgePage)
        ]);
        lastStates = states;
        const chromeState = states[0];
        const edgeState = states[1];
        const sameCurrentPlayer = chromeState.currentPlayerKey === edgeState.currentPlayerKey;
        const sameTurnIndex = (
            Number.isFinite(chromeState.turnIndex)
            && Number.isFinite(edgeState.turnIndex)
        ) ? chromeState.turnIndex === edgeState.turnIndex : true;
        if (sameCurrentPlayer && sameTurnIndex) {
            return { chromeState, edgeState };
        }
        await wait(250);
    }
    const chromeState = lastStates ? lastStates[0] : null;
    const edgeState = lastStates ? lastStates[1] : null;
    throw new Error(`state sync timeout: chrome=${JSON.stringify(chromeState)} edge=${JSON.stringify(edgeState)}`);
}

async function waitForGlobalTurnAdvance(chromePage, edgePage, previousSignature, timeout = 25000) {
    const startedAt = Date.now();
    let lastStates = null;
    while ((Date.now() - startedAt) < timeout) {
        const { chromeState, edgeState } = await waitForSynchronizedState(chromePage, edgePage, Math.min(5000, timeout));
        lastStates = [chromeState, edgeState];
        if (didTurnSignatureAdvance(previousSignature, chromeState, edgeState)) {
            return { chromeState, edgeState };
        }
        await wait(250);
    }
    const chromeState = lastStates ? lastStates[0] : null;
    const edgeState = lastStates ? lastStates[1] : null;
    throw new Error(`turn advance timeout: chrome=${JSON.stringify(chromeState)} edge=${JSON.stringify(edgeState)}`);
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

async function waitForBothIdle(blackPage, whitePage) {
    await Promise.all([
        waitForPlaybackIdle(blackPage).catch(() => {}),
        waitForPlaybackIdle(whitePage).catch(() => {})
    ]);
    await wait(300);
}

async function waitForFinalResult(blackPage, whitePage) {
    await Promise.all([
        blackPage.waitForFunction(() => {
            try {
                return !!document.getElementById('result-overlay')
                    || (typeof window.isGameOver === 'function' && window.gameState && window.isGameOver(window.gameState));
            } catch (e) {
                return false;
            }
        }, { timeout: 10000 }).catch(() => {}),
        whitePage.waitForFunction(() => {
            try {
                return !!document.getElementById('result-overlay')
                    || (typeof window.isGameOver === 'function' && window.gameState && window.isGameOver(window.gameState));
            } catch (e) {
                return false;
            }
        }, { timeout: 10000 }).catch(() => {})
    ]);
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
        return {
            error: error && error.message ? error.message : String(error)
        };
    }
}

async function captureEvidence(result, chromePage, edgePage, screenshotBlackPath, screenshotWhitePath) {
    const [chromeState, edgeState] = await Promise.all([
        getLiveStateSafe(chromePage),
        getLiveStateSafe(edgePage)
    ]);
    result.final = {
        actionsExecuted: Array.isArray(result.actions) ? result.actions.length : 0,
        chrome: chromeState,
        edge: edgeState
    };
    await Promise.allSettled([
        chromePage.screenshot({ path: screenshotBlackPath, fullPage: true, animations: 'disabled' }),
        edgePage.screenshot({ path: screenshotWhitePath, fullPage: true, animations: 'disabled' })
    ]);
    writeJson(PROGRESS_PATH, result);
}

async function main() {
    const chromeBrowser = await chromium.launch({ channel: 'chrome', headless: HEADLESS, slowMo: SLOW_MO_MS || undefined });
    const edgeBrowser = await chromium.launch({ channel: 'msedge', headless: HEADLESS, slowMo: SLOW_MO_MS || undefined });
    const chromeContext = await chromeBrowser.newContext({ viewport: VIEWPORT });
    const edgeContext = await edgeBrowser.newContext({ viewport: VIEWPORT });
    const chromePage = await chromeContext.newPage();
    const edgePage = await edgeContext.newPage();

    const result = {
        ok: false,
        baseUrl: BASE_URL,
        timestamp: new Date().toISOString(),
        browsers: {
            black: 'chrome',
            white: 'msedge'
        },
        headless: HEADLESS,
        slowMoMs: SLOW_MO_MS,
        roomId: null,
        actions: [],
        stallEvents: [],
        pageEvents: [],
        final: null,
        error: null
    };

    try {
        installPageObservers(chromePage, 'chrome', result);
        installPageObservers(edgePage, 'msedge', result);
        logLine(`[selfmatch] base=${BASE_URL} headless=${HEADLESS} slowMo=${SLOW_MO_MS}`);
        await Promise.all([
            chromePage.goto(BASE_URL, { waitUntil: 'domcontentloaded' }),
            edgePage.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
        ]);
        await Promise.all([waitForGameReady(chromePage), waitForGameReady(edgePage)]);

        const roomId = await createRoom(chromePage, 'C01');
        result.roomId = roomId;
        logLine(`[selfmatch] room=${roomId}`);
        await joinRoom(edgePage, roomId, 'E01');
        await Promise.all([waitForTwoPlayers(chromePage), waitForTwoPlayers(edgePage)]);
        await Promise.all([closeNetworkOverlayIfOpen(chromePage), closeNetworkOverlayIfOpen(edgePage)]);
        await waitForBothIdle(chromePage, edgePage);
        await waitForSynchronizedState(chromePage, edgePage);

        let actionCount = 0;
        let stallCycles = 0;
        const matchStartedAt = Date.now();
        while (actionCount < MAX_ACTIONS) {
            if ((Date.now() - matchStartedAt) > MATCH_TIMEOUT_MS) {
                throw new Error(`selfmatch timeout after ${MATCH_TIMEOUT_MS}ms`);
            }
            const { chromeState, edgeState } = await waitForSynchronizedState(chromePage, edgePage);
            const previousSignature = makeTurnSignature(chromeState, edgeState);
            writeJson(PROGRESS_PATH, {
                ...result,
                live: {
                    chrome: summarizeState(chromeState),
                    edge: summarizeState(edgeState)
                }
            });

            if (chromeState.gameOver || edgeState.gameOver || chromeState.overlayVisible || edgeState.overlayVisible) {
                break;
            }

            const activePlayerKey = chromeState.currentPlayerKey;
            const activePage = chromeState.seatKey === activePlayerKey ? chromePage : edgePage;
            const activeBrowser = chromeState.seatKey === activePlayerKey ? 'chrome' : 'msedge';
            const activeState = chromeState.seatKey === activePlayerKey ? chromeState : edgeState;

            if (!activeState || activeState.canAct !== true) {
                stallCycles += 1;
                if (stallCycles === 1 || (stallCycles % 5) === 0) {
                    appendLimited(result.stallEvents, {
                        time: new Date().toISOString(),
                        stallCycles,
                        activePlayerKey,
                        chrome: summarizeState(chromeState),
                        edge: summarizeState(edgeState)
                    }, MAX_STALL_CYCLES);
                    writeJson(PROGRESS_PATH, {
                        ...result,
                        live: {
                            chrome: summarizeState(chromeState),
                            edge: summarizeState(edgeState)
                        }
                    });
                    logLine(`[selfmatch] stall cycles=${stallCycles} active=${activePlayerKey}`);
                }
                if (stallCycles >= MAX_STALL_CYCLES) {
                    throw new Error(`selfmatch stalled without an actionable client: chrome=${JSON.stringify(summarizeState(chromeState))} edge=${JSON.stringify(summarizeState(edgeState))}`);
                }
                await wait(500);
                continue;
            }
            stallCycles = 0;

            if (activeState.pending && activeState.pending.stage === 'selectTarget') {
                throw new Error(`pending selection encountered without card use: ${activeState.pending.type}`);
            }

            if (Array.isArray(activeState.legalMoves) && activeState.legalMoves.length > 0) {
                const move = chooseMove(activeState.legalMoves);
                if (!move) {
                    throw new Error('failed to choose a legal move');
                }
                await performPlacement(activePage, move);
                const advanced = await waitForGlobalTurnAdvance(chromePage, edgePage, previousSignature);
                result.actions.push({
                    index: actionCount + 1,
                    browser: activeBrowser,
                    playerKey: activePlayerKey,
                    type: 'place',
                    row: move.row,
                    col: move.col,
                    notation: posToNotation(move.row, move.col),
                    before: summarizeState(activeState),
                    after: {
                        chrome: summarizeState(advanced.chromeState),
                        edge: summarizeState(advanced.edgeState)
                    }
                });
                logLine(`[selfmatch] #${actionCount + 1} ${activeBrowser}/${activePlayerKey} place ${posToNotation(move.row, move.col)}`);
            } else {
                await performPass(activePage);
                const advanced = await waitForGlobalTurnAdvance(chromePage, edgePage, previousSignature);
                result.actions.push({
                    index: actionCount + 1,
                    browser: activeBrowser,
                    playerKey: activePlayerKey,
                    type: 'pass',
                    before: summarizeState(activeState),
                    after: {
                        chrome: summarizeState(advanced.chromeState),
                        edge: summarizeState(advanced.edgeState)
                    }
                });
                logLine(`[selfmatch] #${actionCount + 1} ${activeBrowser}/${activePlayerKey} pass`);
            }

            actionCount += 1;
            await waitForBothIdle(chromePage, edgePage);
            writeJson(PROGRESS_PATH, result);
        }

        if (actionCount >= MAX_ACTIONS) {
            throw new Error(`selfmatch reached MAX_ACTIONS=${MAX_ACTIONS} without final resolution`);
        }

        await waitForFinalResult(chromePage, edgePage);
        await waitForBothIdle(chromePage, edgePage);

        const [finalChromeState, finalEdgeState] = await Promise.all([
            getLiveState(chromePage),
            getLiveState(edgePage)
        ]);

        result.final = {
            actionsExecuted: result.actions.length,
            chrome: finalChromeState,
            edge: finalEdgeState
        };
        result.ok = !!(
            (finalChromeState.gameOver || finalChromeState.overlayVisible)
            && (finalEdgeState.gameOver || finalEdgeState.overlayVisible)
        );
        logLine(`[selfmatch] final black=${finalChromeState && finalChromeState.counts ? finalChromeState.counts.black : '?'} white=${finalChromeState && finalChromeState.counts ? finalChromeState.counts.white : '?'} ok=${result.ok}`);

        await chromePage.screenshot({ path: SCREENSHOT_BLACK_PATH, fullPage: true, animations: 'disabled' });
        await edgePage.screenshot({ path: SCREENSHOT_WHITE_PATH, fullPage: true, animations: 'disabled' });
        writeJson(PROGRESS_PATH, result);
    } catch (error) {
        result.error = error && error.stack ? error.stack : String(error);
        logLine(`[selfmatch] error ${result.error}`);
        await captureEvidence(result, chromePage, edgePage, ERROR_SCREENSHOT_BLACK_PATH, ERROR_SCREENSHOT_WHITE_PATH);
    } finally {
        await Promise.allSettled([
            leaveRoomIfPossible(chromePage),
            leaveRoomIfPossible(edgePage)
        ]);
        await Promise.allSettled([
            chromeContext.close(),
            edgeContext.close()
        ]);
        await Promise.allSettled([
            chromeBrowser.close(),
            edgeBrowser.close()
        ]);
    }

    writeJson(RESULT_PATH, result);
    if (result.ok) {
        process.stdout.write(`network match succeeded: ${RESULT_PATH}\n`);
        process.exit(0);
    }

    process.stderr.write(`network match failed: ${RESULT_PATH}\n`);
    process.exit(1);
}

main();
