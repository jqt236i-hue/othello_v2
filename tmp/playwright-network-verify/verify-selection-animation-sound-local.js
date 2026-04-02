const fs = require('fs');
const path = require('path');
const Module = require('module');
const { chromium } = require('playwright');

const { startStaticServer, stopStaticServer, stopPlaywrightBrowser } = require('../../test/e2e/e2e-runtime-helpers');
const Core = require('../../game/logic/core');
const CardLogic = require('../../game/logic/cards');
const PendingStateManager = require('../../game/logic/cards-internal/pending-state-manager');
const TurnPipelinePhases = require('../../game/turn/turn_pipeline_phases');
const SeededPRNG = require('../../game/schema/prng');
const SharedConstants = require('../../shared-constants');

const VIEWPORT = { width: 1440, height: 1200 };
const HEADLESS = !/^(0|false)$/i.test(String(process.env.HEADLESS || '0'));
const SLOW_MO_MS = Math.max(0, Number(process.env.SLOW_MO_MS || 120) || 0);
const PAGE_TIMEOUT_MS = Math.max(1000, Number(process.env.PAGE_TIMEOUT_MS || 30000) || 30000);
const STATE_TIMEOUT_MS = Math.max(1000, Number(process.env.STATE_TIMEOUT_MS || 20000) || 20000);
const PLAYBACK_TIMEOUT_MS = Math.max(1000, Number(process.env.PLAYBACK_TIMEOUT_MS || 20000) || 20000);
const MAX_BASELINE_ACTIONS = Math.max(10, Number(process.env.MAX_BASELINE_ACTIONS || 120) || 120);
const MAX_BASELINE_STALLS = Math.max(5, Number(process.env.MAX_BASELINE_STALLS || 40) || 40);
const MATCH_TIMEOUT_MS = Math.max(60000, Number(process.env.MATCH_TIMEOUT_MS || (6 * 60 * 1000)) || (6 * 60 * 1000));
const SCENARIO_FILTERS = String(process.env.SCENARIO_FILTER || '')
    .split(',')
    .map((entry) => String(entry || '').trim().toLowerCase())
    .filter(Boolean);

function nowTag() {
    const date = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

const RUN_TAG = String(process.env.RUN_TAG || `${nowTag()}-selection-audit`).trim();
const OUT_DIR = path.join(process.cwd(), 'tmp', 'playwright-network-verify', 'runs', RUN_TAG);
const RESULT_PATH = path.join(OUT_DIR, 'result.json');
const PROGRESS_PATH = path.join(OUT_DIR, 'progress.json');

fs.mkdirSync(OUT_DIR, { recursive: true });

function writeJson(filePath, value) {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function writeProgress(payload) {
    writeJson(PROGRESS_PATH, Object.assign({
        timestamp: new Date().toISOString(),
        runTag: RUN_TAG
    }, payload || {}));
}

function appendLimited(list, value, max = 200) {
    if (!Array.isArray(list)) return;
    list.push(value);
    if (list.length > max) {
        list.splice(0, list.length - max);
    }
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePlayerKey(value) {
    if (value === -1 || value === 'white' || value === '-1') return 'white';
    return 'black';
}

function getOpposingPlayerKey(playerKey) {
    return normalizePlayerKey(playerKey) === 'white' ? 'black' : 'white';
}

function isScenarioEnabled(name) {
    if (SCENARIO_FILTERS.length === 0) return true;
    return SCENARIO_FILTERS.includes(String(name || '').trim().toLowerCase());
}

function resolveExpectedCurrentPlayerKeyAfterSelection(pendingType, actingPlayerKey) {
    const normalizedPlayerKey = normalizePlayerKey(actingPlayerKey);
    const contract = PendingStateManager && typeof PendingStateManager.resolvePendingSelectionContract === 'function'
        ? PendingStateManager.resolvePendingSelectionContract(pendingType)
        : null;
    if (contract && contract.turnOutcome === 'end_turn') {
        return getOpposingPlayerKey(normalizedPlayerKey);
    }
    return normalizedPlayerKey;
}

function boardHash(board) {
    try {
        return JSON.stringify(Array.isArray(board) ? board : []);
    } catch (e) {
        return '[]';
    }
}

function pendingByPlayerHash(pendingByPlayer) {
    try {
        return JSON.stringify(pendingByPlayer || { black: null, white: null });
    } catch (e) {
        return '';
    }
}

function isMatchApiUrl(url) {
    return /\/api\/match\//.test(String(url || ''));
}

function getCardDefByType(type) {
    const found = (SharedConstants.CARD_DEFS || []).find((entry) => entry && entry.type === type);
    if (!found || !found.id) {
        throw new Error(`Missing card def for type ${type}`);
    }
    return found;
}

const CARD_DEFS = {
    trap: getCardDefByType('TRAP_WILL'),
    freeze: getCardDefByType('FREEZE_WILL'),
    capture: getCardDefByType('CAPTURE_WILL'),
    freePlacement: getCardDefByType('FREE_PLACEMENT'),
    doubleChain: getCardDefByType('DOUBLE_CHAIN_WILL'),
    dragon: getCardDefByType('ULTIMATE_REVERSE_DRAGON')
};

function createSelectionAuditInitScript() {
    return () => {
        if (!window.__copilotSelectionAudit) {
            window.__copilotSelectionAudit = {
                mediaPlays: [],
                mediaErrors: [],
                effectCalls: [],
                stoneClacks: [],
                animationCalls: [],
                functionCalls: [],
                installedAt: Date.now()
            };
        }
        const audit = window.__copilotSelectionAudit;
        const push = (bucket, payload) => {
            if (!Array.isArray(audit[bucket])) audit[bucket] = [];
            audit[bucket].push(Object.assign({
                time: Date.now(),
                perfNow: (typeof performance !== 'undefined' && performance && typeof performance.now === 'function')
                    ? performance.now()
                    : null
            }, payload || {}));
            if (audit[bucket].length > 300) {
                audit[bucket].splice(0, audit[bucket].length - 300);
            }
        };
        if (window.__copilotSelectionAuditMediaWrapped === true) return;
        window.__copilotSelectionAuditMediaWrapped = true;
        const proto = (typeof HTMLMediaElement !== 'undefined' && HTMLMediaElement && HTMLMediaElement.prototype)
            ? HTMLMediaElement.prototype
            : null;
        if (!proto || typeof proto.play !== 'function') return;
        const originalPlay = proto.play;
        proto.play = function patchedPlay() {
            let src = '';
            try {
                src = String(this.currentSrc || this.src || '').trim();
            } catch (e) {
                src = '';
            }
            push('mediaPlays', {
                src,
                volume: Number.isFinite(Number(this && this.volume)) ? Number(this.volume) : null,
                muted: !!(this && this.muted),
                currentTime: Number.isFinite(Number(this && this.currentTime)) ? Number(this.currentTime) : null
            });
            const result = originalPlay.apply(this, arguments);
            if (result && typeof result.catch === 'function') {
                result.catch((error) => {
                    push('mediaErrors', {
                        src,
                        error: String(error && error.message ? error.message : error)
                    });
                });
            }
            return result;
        };
    };
}

async function installRuntimeProbes(page) {
    await page.evaluate(() => {
        if (!window.__copilotSelectionAudit) {
            window.__copilotSelectionAudit = {
                mediaPlays: [],
                mediaErrors: [],
                effectCalls: [],
                stoneClacks: [],
                animationCalls: [],
                functionCalls: [],
                installedAt: Date.now()
            };
        }
        const audit = window.__copilotSelectionAudit;
        const push = (bucket, payload) => {
            if (!Array.isArray(audit[bucket])) audit[bucket] = [];
            audit[bucket].push(Object.assign({
                time: Date.now(),
                perfNow: (typeof performance !== 'undefined' && performance && typeof performance.now === 'function')
                    ? performance.now()
                    : null
            }, payload || {}));
            if (audit[bucket].length > 300) {
                audit[bucket].splice(0, audit[bucket].length - 300);
            }
        };
        const soundEngine = (() => {
            try {
                if (typeof SoundEngine !== 'undefined' && SoundEngine) return SoundEngine;
            } catch (e) {
                // ignore
            }
            try {
                if (window.SoundEngine) return window.SoundEngine;
            } catch (e) {
                // ignore
            }
            return null;
        })();
        if (soundEngine && soundEngine.__copilotRuntimeWrapped !== true) {
            if (typeof soundEngine.playEffectByKey === 'function') {
                const originalPlayEffectByKey = soundEngine.playEffectByKey.bind(soundEngine);
                soundEngine.playEffectByKey = function patchedPlayEffectByKey(effectKey, options) {
                    let filePath = null;
                    let volume = null;
                    try {
                        if (typeof soundEngine.getEffectFilePath === 'function') {
                            filePath = soundEngine.getEffectFilePath(effectKey, options || {});
                        }
                    } catch (e) {
                        filePath = null;
                    }
                    try {
                        if (typeof soundEngine.resolveEffectVolume === 'function') {
                            volume = soundEngine.resolveEffectVolume(effectKey, options || {});
                        }
                    } catch (e) {
                        volume = null;
                    }
                    push('effectCalls', {
                        key: String(effectKey || '').trim(),
                        filePath: filePath ? String(filePath) : null,
                        volume: Number.isFinite(Number(volume)) ? Number(volume) : null
                    });
                    return originalPlayEffectByKey(effectKey, options);
                };
            }
            if (typeof soundEngine.playStoneClack === 'function') {
                const originalPlayStoneClack = soundEngine.playStoneClack.bind(soundEngine);
                soundEngine.playStoneClack = function patchedPlayStoneClack() {
                    push('stoneClacks', { kind: 'playStoneClack' });
                    return originalPlayStoneClack.apply(soundEngine, arguments);
                };
            }
            soundEngine.__copilotRuntimeWrapped = true;
        }
        const wrapWindowFunction = (name, bucket, transform) => {
            try {
                const original = window[name];
                if (typeof original !== 'function' || original.__copilotRuntimeWrapped === true) return;
                const wrapped = function wrappedWindowFunction() {
                    const args = Array.from(arguments);
                    const payload = typeof transform === 'function' ? transform(args) : {};
                    push(bucket, Object.assign({ name }, payload || {}));
                    let result;
                    try {
                        result = original.apply(this, args);
                    } catch (error) {
                        push(bucket, {
                            name,
                            stage: 'throw',
                            error: String(error && error.message ? error.message : error)
                        });
                        throw error;
                    }
                    if (result && typeof result.then === 'function') {
                        return result.then((value) => {
                            push(bucket, { name, stage: 'end' });
                            return value;
                        }, (error) => {
                            push(bucket, {
                                name,
                                stage: 'error',
                                error: String(error && error.message ? error.message : error)
                            });
                            throw error;
                        });
                    }
                    push(bucket, { name, stage: 'sync_end' });
                    return result;
                };
                wrapped.__copilotRuntimeWrapped = true;
                window[name] = wrapped;
            } catch (e) {
                // ignore
            }
        };
        wrapWindowFunction('playCardUseHandAnimation', 'animationCalls', (args) => {
            const payload = args[0] || {};
            return {
                stage: 'start',
                cardId: payload && payload.cardId ? String(payload.cardId) : null,
                player: payload && payload.player ? String(payload.player) : null,
                owner: payload && payload.owner ? String(payload.owner) : null
            };
        });
        wrapWindowFunction('playCaptureToHandAnimation', 'animationCalls', (args) => {
            const payload = args[0] || {};
            return {
                stage: 'start',
                cardId: payload && payload.cardId ? String(payload.cardId) : null,
                player: payload && payload.player ? String(payload.player) : null,
                sourceRow: Number.isFinite(Number(payload && payload.sourceRow)) ? Number(payload.sourceRow) : null,
                sourceCol: Number.isFinite(Number(payload && payload.sourceCol)) ? Number(payload.sourceCol) : null,
                insertIndex: Number.isFinite(Number(payload && payload.insertIndex)) ? Number(payload.insertIndex) : null
            };
        });
        wrapWindowFunction('onCardClick', 'functionCalls', (args) => ({
            stage: 'start',
            cardId: args[0] ? String(args[0]) : null,
            ownerKey: args[1] ? String(args[1]) : null
        }));
        wrapWindowFunction('useSelectedCard', 'functionCalls', () => ({ stage: 'start' }));
    });
}

function loadLocalMatchServerDebugModule() {
    const sourcePath = path.resolve(process.cwd(), 'scripts', 'local-match-server.js');
    const original = fs.readFileSync(sourcePath, 'utf8');
    const augmented = `${original}

module.exports.__copilotDebug = {
    rooms,
    broadcastSnapshot,
    refreshTurnTimer,
    applyCommandPublishToSnapshot
};
`;
    const compiled = new Module(sourcePath, module);
    compiled.filename = sourcePath;
    compiled.paths = Module._nodeModulePaths(path.dirname(sourcePath));
    compiled._compile(augmented, sourcePath);
    return compiled.exports;
}

async function startLocalMatchServer() {
    const mod = loadLocalMatchServerDebugModule();
    const server = mod.createLocalMatchServer();
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address();
    const port = address && Number.isFinite(Number(address.port)) ? Number(address.port) : null;
    if (!port) {
        throw new Error('Failed to resolve local match server port');
    }
    return {
        server,
        serverUrl: `http://127.0.0.1:${port}`,
        debug: mod.__copilotDebug
    };
}

async function startStaticUiServer() {
    const server = startStaticServer(0);
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.once('listening', resolve);
    });
    const address = server.address();
    const port = address && Number.isFinite(Number(address.port)) ? Number(address.port) : null;
    if (!port) {
        throw new Error('Failed to resolve static server port');
    }
    return {
        server,
        baseUrl: `http://127.0.0.1:${port}/`
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

async function launchBrowserWithFallback(preferredChannel, fallbackLabel, launchEvents) {
    const launchOptions = {
        headless: HEADLESS,
        slowMo: SLOW_MO_MS || undefined
    };
    try {
        const browser = await chromium.launch(Object.assign({}, launchOptions, { channel: preferredChannel }));
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

async function waitForNetworkIdle(page, timeout = STATE_TIMEOUT_MS, minStateVersion = null) {
    await page.waitForFunction((expected) => {
        try {
            const client = window.NetworkMatchClient;
            if (!client || typeof client.getState !== 'function') return false;
            const state = client.getState();
            if (!state || !state.publishTracker || !Array.isArray(state.publishTracker.operations)) return false;
            const operations = state.publishTracker.operations;
            const version = Number.isFinite(Number(state.stateVersion)) ? Number(state.stateVersion) : null;
            if (Number.isFinite(Number(expected.minStateVersion)) && version !== null && version < Number(expected.minStateVersion)) {
                return false;
            }
            return operations.every((entry) => entry && entry.responseSettled === true);
        } catch (e) {
            return false;
        }
    }, { minStateVersion }, { timeout });
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
        // ignore
    }
}

async function createRoom(page, playerName, serverUrl) {
    await ensureNetworkMode(page);
    const result = await page.evaluate(async ({ playerName, serverUrl }) => {
        return window.NetworkMatchClient.createRoom({ playerName, serverUrl });
    }, { playerName, serverUrl });
    if (!result || result.ok !== true) {
        throw new Error(`createRoom failed: ${result && result.reason ? result.reason : 'UNKNOWN'}`);
    }
    return result;
}

async function joinRoom(page, roomId, playerName, serverUrl) {
    await ensureNetworkMode(page);
    const result = await page.evaluate(async ({ roomId, playerName, serverUrl }) => {
        return window.NetworkMatchClient.joinRoom(roomId, { playerName, serverUrl });
    }, { roomId, playerName, serverUrl });
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

async function getAudit(page) {
    return page.evaluate(() => {
        try {
            return JSON.parse(JSON.stringify(window.__copilotSelectionAudit || null));
        } catch (e) {
            return null;
        }
    });
}

async function waitForAuditEvent(page, bucket, expected, timeout = STATE_TIMEOUT_MS) {
    return page.waitForFunction(({ bucket, expected }) => {
        const audit = window.__copilotSelectionAudit || {};
        const list = Array.isArray(audit[bucket]) ? audit[bucket] : [];
        const keys = expected && typeof expected === 'object' ? Object.keys(expected) : [];
        return list.find((entry) => keys.every((key) => entry && entry[key] === expected[key])) || null;
    }, { bucket, expected }, { timeout });
}

async function collectScenarioEvidence(blackPage, whitePage) {
    const [black, white, blackAudit, whiteAudit] = await Promise.all([
        getLiveState(blackPage),
        getLiveState(whitePage),
        getAudit(blackPage),
        getAudit(whitePage)
    ]);
    return { black, white, blackAudit, whiteAudit };
}

async function getLiveState(page) {
    return page.evaluate(() => {
        function cloneBoard(board) {
            return Array.isArray(board) ? board.map((row) => Array.isArray(row) ? row.slice() : []) : [];
        }
        function clonePendingByPlayer(source) {
            return {
                black: source && source.black ? JSON.parse(JSON.stringify(source.black)) : null,
                white: source && source.white ? JSON.parse(JSON.stringify(source.white)) : null
            };
        }
        function summarizeHand(playerKey) {
            const handIds = window.cardState && window.cardState.hands && Array.isArray(window.cardState.hands[playerKey])
                ? window.cardState.hands[playerKey].slice()
                : [];
            return handIds.map((cardId) => {
                const cardDef = window.CardLogic && typeof window.CardLogic.getCardDef === 'function'
                    ? window.CardLogic.getCardDef(cardId)
                    : null;
                let canUse = false;
                try {
                    if (window.CardLogic && typeof window.CardLogic.getUsableCardIds === 'function') {
                        const usable = window.CardLogic.getUsableCardIds(window.cardState, window.gameState, playerKey) || [];
                        canUse = Array.isArray(usable) && usable.includes(cardId);
                    } else if (window.CardLogic && typeof window.CardLogic.canUseCard === 'function') {
                        canUse = !!window.CardLogic.canUseCard(window.cardState, playerKey, cardId);
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
        }
        function summarizeCells(selector) {
            return Array.from(document.querySelectorAll(selector)).map((cell) => ({
                row: Number(cell.dataset.row),
                col: Number(cell.dataset.col)
            })).filter((entry) => Number.isInteger(entry.row) && Number.isInteger(entry.col));
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
        const pendingByPlayer = clonePendingByPlayer(window.cardState && window.cardState.pendingEffectByPlayer);
        const useBtn = document.getElementById('use-card-btn');
        const reasonEl = document.getElementById('use-card-reason');
        const overlay = document.getElementById('result-overlay');
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
            legalMoves: Array.isArray(legalMoves)
                ? legalMoves
                    .filter((move) => move && Number.isInteger(Number(move.row)) && Number.isInteger(Number(move.col)))
                    .map((move) => ({
                        row: Number(move.row),
                        col: Number(move.col),
                        flips: Array.isArray(move.flips) ? move.flips.length : Number(move.flipCount || 0)
                    }))
                : [],
            blackHand: summarizeHand('black'),
            whiteHand: summarizeHand('white'),
            pending: seatKey && pendingByPlayer[seatKey] ? pendingByPlayer[seatKey] : null,
            pendingByPlayer,
            markers: Array.isArray(window.cardState && window.cardState.markers)
                ? window.cardState.markers.map((marker) => ({
                    row: Number(marker.row),
                    col: Number(marker.col),
                    kind: marker.kind || null,
                    owner: marker.owner || null,
                    data: marker.data ? {
                        type: marker.data.type || null,
                        sourceType: marker.data.sourceType || null,
                        sourceCardId: marker.data.sourceCardId || null,
                        remainingOwnerTurns: Number.isFinite(Number(marker.data.remainingOwnerTurns))
                            ? Number(marker.data.remainingOwnerTurns)
                            : null
                    } : null
                }))
                : [],
            chargeByPlayer: {
                black: Number(window.cardState && window.cardState.charge && window.cardState.charge.black) || 0,
                white: Number(window.cardState && window.cardState.charge && window.cardState.charge.white) || 0
            },
            selectedCardId: window.cardState ? window.cardState.selectedCardId || null : null,
            selectedCardOwnerKey: window.cardState ? window.cardState.selectedCardOwnerKey || null : null,
            highlightCells: summarizeCells('#board .cell.selectable-friendly'),
            noCircleCells: summarizeCells('#board .cell.selectable-friendly-no-circle'),
            effectTargetCells: summarizeCells('#board .cell.effect-target-highlight'),
            useButtonDisabled: !!(useBtn && useBtn.disabled),
            useReason: reasonEl ? String(reasonEl.textContent || '').trim() : '',
            logs: Array.from(document.querySelectorAll('#log .logEntry')).slice(-12).map((el) => String(el.textContent || '').trim()).filter(Boolean),
            busy: {
                VisualPlaybackActive: window.VisualPlaybackActive === true,
                isProcessing: window.isProcessing === true,
                isCardAnimating: window.isCardAnimating === true,
                animationEnginePlaying: !!(window.AnimationEngine && window.AnimationEngine.isPlaying === true),
                hasPendingPresentation: !!(
                    window.cardState
                    && (
                        (Array.isArray(window.cardState.presentationEvents) && window.cardState.presentationEvents.length > 0)
                        || window.cardState._presentationEventsPersist
                    )
                )
            },
            gameOver: (() => {
                try {
                    return !!(typeof window.isGameOver === 'function' && window.gameState && window.isGameOver(window.gameState));
                } catch (e) {
                    return false;
                }
            })(),
            overlayVisible: !!overlay
        };
    });
}

async function waitForConditionPair(blackPage, whitePage, predicate, timeout, description) {
    const startedAt = Date.now();
    let lastStates = null;
    while ((Date.now() - startedAt) < timeout) {
        const [black, white] = await Promise.all([getLiveState(blackPage), getLiveState(whitePage)]);
        lastStates = { black, white };
        if (predicate(black, white)) {
            return lastStates;
        }
        await wait(100);
    }
    const error = new Error(`Timeout: ${description || 'condition not reached'}`);
    error.lastStates = lastStates;
    throw error;
}

async function waitForSynchronizedState(blackPage, whitePage, timeout = STATE_TIMEOUT_MS) {
    return waitForConditionPair(
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

async function clickBoardCell(page, row, col) {
    await page.locator(`#board .cell[data-row="${row}"][data-col="${col}"]`).click();
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

async function performPass(page, state) {
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

function makeTurnSignature(blackState, whiteState) {
    return {
        currentPlayerKey: blackState ? blackState.currentPlayerKey : null,
        turnIndex: blackState && Number.isFinite(blackState.turnIndex) ? blackState.turnIndex : null,
        turnNumber: blackState && Number.isFinite(blackState.turnNumber) ? blackState.turnNumber : null,
        board: boardHash(blackState ? blackState.board : null),
        pending: pendingByPlayerHash(blackState ? blackState.pendingByPlayer : null),
        gameOver: !!(blackState && blackState.gameOver)
    };
}

async function waitForTurnAdvance(blackPage, whitePage, previousSignature, timeout = STATE_TIMEOUT_MS) {
    return waitForConditionPair(
        blackPage,
        whitePage,
        (black, white) => {
            const nextSignature = makeTurnSignature(black, white);
            return (
                nextSignature.gameOver === true
                || nextSignature.currentPlayerKey !== previousSignature.currentPlayerKey
                || nextSignature.turnIndex !== previousSignature.turnIndex
                || nextSignature.turnNumber !== previousSignature.turnNumber
                || nextSignature.board !== previousSignature.board
                || nextSignature.pending !== previousSignature.pending
            );
        },
        timeout,
        'wait for turn advance'
    );
}

async function useCardViaDom(page, seatKey, cardId) {
    const selector = `.card-item.visible[data-owner-key="${seatKey}"][data-card-id="${cardId}"]`;
    await page.locator(selector).first().click();
    await page.waitForFunction(() => {
        const button = document.getElementById('use-card-btn');
        return !!button && button.disabled === false;
    }, { timeout: STATE_TIMEOUT_MS });
    const immediate = await page.evaluate(() => ({
        selectedCardId: window.cardState ? window.cardState.selectedCardId || null : null,
        selectedCardOwnerKey: window.cardState ? window.cardState.selectedCardOwnerKey || null : null,
        useDisabled: (() => {
            const button = document.getElementById('use-card-btn');
            return !!(button && button.disabled);
        })(),
        useReason: (() => {
            const reasonEl = document.getElementById('use-card-reason');
            return reasonEl ? String(reasonEl.textContent || '').trim() : '';
        })()
    }));
    const usedAt = Date.now();
    await page.locator('#use-card-btn').click();
    return { immediate, usedAt };
}

function createScenarioBaseSnapshot() {
    const prng = SeededPRNG.createPRNG(123456789);
    const gameState = Core.createGameState();
    const cardState = CardLogic.createCardState(prng);
    TurnPipelinePhases.applyTurnStartPhase(
        CardLogic,
        Core,
        cardState,
        gameState,
        'black',
        [],
        prng
    );
    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    gameState.board[3][3] = Core.WHITE;
    gameState.board[3][4] = Core.BLACK;
    gameState.board[4][3] = Core.BLACK;
    gameState.board[4][4] = Core.WHITE;
    gameState.currentPlayer = Core.BLACK;
    gameState.turnNumber = 0;
    gameState.consecutivePasses = 0;
    cardState.debugNoDraw = true;
    cardState.hands = { black: [], white: [] };
    cardState.decks = { black: [], white: [] };
    cardState.deck = [];
    cardState.discard = [];
    cardState._nextCardCopySeq = 1;
    cardState._handCopyIdsByPlayer = { black: [], white: [] };
    cardState._deckCopyIdsByPlayer = { black: [], white: [] };
    cardState._discardCopyIds = [];
    cardState._revealedHandCopyIdsByViewer = { black: [], white: [] };
    cardState.selectedCardId = null;
    cardState.selectedCardOwnerKey = null;
    cardState.pendingEffectByPlayer = { black: null, white: null };
    cardState.hasUsedCardThisTurnByPlayer = { black: false, white: false };
    cardState.hasDestroyedCardThisTurnByPlayer = { black: false, white: false };
    cardState.cardUseCountByPlayer = { black: 0, white: 0 };
    cardState.lastUsedCardByPlayer = { black: null, white: null };
    cardState.charge = { black: 99, white: 99 };
    cardState.turnIndex = 1;
    cardState.lastTurnStartedFor = 'black';
    cardState.presentationEvents = [];
    cardState._presentationEventsPersist = [];
    cardState.markers = [];
    cardState.initialDeckSize = 0;
    cardState.initialDeckSizeByPlayer = { black: 0, white: 0 };
    return { gameState, cardState };
}

function addCardsToHand(cardState, playerKey, cardIds) {
    for (const cardId of cardIds) {
        CardLogic.addCardToHand(cardState, playerKey, cardId);
    }
}

function buildTrapScenarioSnapshot() {
    const snapshot = createScenarioBaseSnapshot();
    addCardsToHand(snapshot.cardState, 'black', [CARD_DEFS.trap.id]);
    snapshot.cardState.charge.black = Math.max(10, Number(CARD_DEFS.trap.cost || 0));
    snapshot.cardState.charge.white = 0;
    return snapshot;
}

function buildFreezeScenarioSnapshot() {
    const snapshot = createScenarioBaseSnapshot();
    addCardsToHand(snapshot.cardState, 'black', [CARD_DEFS.freeze.id]);
    snapshot.cardState.charge.black = Math.max(10, Number(CARD_DEFS.freeze.cost || 0));
    snapshot.cardState.charge.white = 0;
    return snapshot;
}

function buildCaptureScenarioSnapshot() {
    const snapshot = createScenarioBaseSnapshot();
    addCardsToHand(snapshot.cardState, 'black', [
        CARD_DEFS.trap.id,
        CARD_DEFS.capture.id,
        CARD_DEFS.doubleChain.id
    ]);
    snapshot.cardState.charge.black = Math.max(30, Number(CARD_DEFS.capture.cost || 0));
    snapshot.cardState.charge.white = 0;
    snapshot.cardState.stoneIdMap[3][3] = 'capture-special-target';
    snapshot.cardState.markers.push({
        id: 'capture-special-target',
        kind: 'specialStone',
        row: 3,
        col: 3,
        owner: 'white',
        data: {
            type: 'DRAGON',
            remainingOwnerTurns: 10,
            sourceType: 'ULTIMATE_REVERSE_DRAGON',
            sourceCardId: CARD_DEFS.dragon.id
        }
    });
    return snapshot;
}

function setRoomSnapshot(debug, roomId, snapshot, actionType) {
    const room = debug && debug.rooms ? debug.rooms.get(roomId) : null;
    if (!room) {
        throw new Error(`Room not found for snapshot override: ${roomId}`);
    }
    room.stateVersion = Number.isFinite(Number(room.stateVersion))
        ? Math.max(0, Math.trunc(Number(room.stateVersion))) + 1
        : 1;
    snapshot.stateVersion = room.stateVersion;
    snapshot.updatedAt = Date.now();
    room.snapshot = snapshot;
    room.updatedAt = snapshot.updatedAt;
    if (typeof debug.refreshTurnTimer === 'function') {
        debug.refreshTurnTimer(room, { nowMs: snapshot.updatedAt, forceRestart: true });
    }
    const currentPlayerKey = normalizePlayerKey(snapshot && snapshot.gameState && snapshot.gameState.currentPlayer);
    debug.broadcastSnapshot(room, {
        playerKey: currentPlayerKey,
        actionType: actionType || 'copilot_override',
        playbackEvents: [],
        publishMeta: {
            kind: 'accepted',
            actionType: actionType || 'copilot_override',
            authoritativeStateVersion: room.stateVersion,
            receivedBaseVersion: Math.max(0, room.stateVersion - 1),
            operationId: `copilot_${actionType || 'override'}_${room.stateVersion}`
        }
    });
    return room;
}

async function capturePageShot(page, fileName) {
    const targetPath = path.join(OUT_DIR, fileName);
    await page.screenshot({ path: targetPath, fullPage: true });
    return targetPath;
}

async function createPagesForRun(browserInfo, runResult, baseUrl) {
    const blackContext = await browserInfo.black.browser.newContext({ viewport: VIEWPORT });
    const whiteContext = await browserInfo.white.browser.newContext({ viewport: VIEWPORT });
    await blackContext.addInitScript(createSelectionAuditInitScript());
    await whiteContext.addInitScript(createSelectionAuditInitScript());
    const blackPage = await blackContext.newPage();
    const whitePage = await whiteContext.newPage();
    installPageObservers(blackPage, browserInfo.black.label, runResult);
    installPageObservers(whitePage, browserInfo.white.label, runResult);
    await Promise.all([
        blackPage.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS }),
        whitePage.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS })
    ]);
    await Promise.all([waitForGameReady(blackPage), waitForGameReady(whitePage)]);
    await Promise.all([installRuntimeProbes(blackPage), installRuntimeProbes(whitePage)]);
    return { blackContext, whiteContext, blackPage, whitePage };
}

async function runBaselineSelfmatch(browserInfo, baseUrl, serverUrl) {
    const result = {
        ok: false,
        kind: 'baseline',
        baseUrl,
        serverUrl,
        actions: [],
        pageEvents: [],
        error: null,
        final: null,
        launch: {
            black: browserInfo.black.label,
            white: browserInfo.white.label
        }
    };
    let blackContext = null;
    let whiteContext = null;
    let blackPage = null;
    let whitePage = null;
    try {
        const created = await createPagesForRun(browserInfo, result, baseUrl);
        blackContext = created.blackContext;
        whiteContext = created.whiteContext;
        blackPage = created.blackPage;
        whitePage = created.whitePage;

        const room = await createRoom(blackPage, 'BASE-B', serverUrl);
        result.roomId = room.roomId;
        await joinRoom(whitePage, room.roomId, 'BASE-W', serverUrl);
        await Promise.all([waitForTwoPlayers(blackPage), waitForTwoPlayers(whitePage)]);
        await Promise.all([closeNetworkOverlayIfOpen(blackPage), closeNetworkOverlayIfOpen(whitePage)]);
        await Promise.all([waitForPlaybackIdle(blackPage), waitForPlaybackIdle(whitePage)]);
        let actionCount = 0;
        let stallCycles = 0;
        const startedAt = Date.now();
        while (actionCount < MAX_BASELINE_ACTIONS) {
            if ((Date.now() - startedAt) > MATCH_TIMEOUT_MS) {
                throw new Error(`Baseline selfmatch timed out after ${MATCH_TIMEOUT_MS}ms`);
            }
            const synced = await waitForSynchronizedState(blackPage, whitePage, STATE_TIMEOUT_MS);
            if (synced.black.gameOver || synced.white.gameOver || synced.black.overlayVisible || synced.white.overlayVisible) {
                break;
            }
            const activePlayerKey = synced.black.currentPlayerKey;
            const activeState = synced.black.seatKey === activePlayerKey ? synced.black : synced.white;
            const activePage = synced.black.seatKey === activePlayerKey ? blackPage : whitePage;
            const previousSignature = makeTurnSignature(synced.black, synced.white);
            if (!activeState || activeState.canAct !== true) {
                stallCycles += 1;
                if (stallCycles >= MAX_BASELINE_STALLS) {
                    throw new Error(`Baseline selfmatch stalled waiting for actionable client: ${JSON.stringify(synced)}`);
                }
                await wait(250);
                continue;
            }
            stallCycles = 0;
            if (activeState.pending && activeState.pending.stage === 'selectTarget') {
                throw new Error(`Baseline selfmatch unexpectedly entered pending selection: ${activeState.pending.type}`);
            }
            if (Array.isArray(activeState.legalMoves) && activeState.legalMoves.length > 0) {
                const move = chooseMove(activeState.legalMoves);
                if (!move) throw new Error('Baseline selfmatch failed to choose a legal move');
                await clickBoardCell(activePage, move.row, move.col);
                const advanced = await waitForTurnAdvance(blackPage, whitePage, previousSignature, STATE_TIMEOUT_MS);
                result.actions.push({
                    index: actionCount + 1,
                    playerKey: activePlayerKey,
                    type: 'place',
                    row: move.row,
                    col: move.col,
                    blackTurnIndex: advanced.black.turnIndex,
                    whiteTurnIndex: advanced.white.turnIndex
                });
            } else {
                await performPass(activePage, activeState);
                const advanced = await waitForTurnAdvance(blackPage, whitePage, previousSignature, STATE_TIMEOUT_MS);
                result.actions.push({
                    index: actionCount + 1,
                    playerKey: activePlayerKey,
                    type: 'pass',
                    blackTurnIndex: advanced.black.turnIndex,
                    whiteTurnIndex: advanced.white.turnIndex
                });
            }
            actionCount += 1;
            await Promise.all([waitForPlaybackIdle(blackPage), waitForPlaybackIdle(whitePage)]);
        }
        const [finalBlack, finalWhite] = await Promise.all([getLiveState(blackPage), getLiveState(whitePage)]);
        result.final = {
            black: finalBlack,
            white: finalWhite,
            blackAudit: await getAudit(blackPage),
            whiteAudit: await getAudit(whitePage)
        };
        result.screenshots = {
            black: await capturePageShot(blackPage, 'baseline-black-final.png'),
            white: await capturePageShot(whitePage, 'baseline-white-final.png')
        };
        result.ok = !!(
            (finalBlack.gameOver || finalBlack.overlayVisible)
            && (finalWhite.gameOver || finalWhite.overlayVisible)
        );
        if (!result.ok) {
            throw new Error('Baseline selfmatch did not reach a final result overlay/gameOver on both clients');
        }
    } catch (error) {
        result.error = error && error.stack ? error.stack : String(error);
        if (blackPage) {
            try { result.errorBlackShot = await capturePageShot(blackPage, 'baseline-black-error.png'); } catch (e) { /* ignore */ }
        }
        if (whitePage) {
            try { result.errorWhiteShot = await capturePageShot(whitePage, 'baseline-white-error.png'); } catch (e) { /* ignore */ }
        }
    } finally {
        await Promise.allSettled([
            blackPage ? leaveRoomIfPossible(blackPage) : null,
            whitePage ? leaveRoomIfPossible(whitePage) : null
        ]);
        await Promise.allSettled([
            blackContext ? blackContext.close() : null,
            whiteContext ? whiteContext.close() : null
        ]);
    }
    return result;
}

async function runSelectionScenario(browserInfo, baseUrl, serverUrl, debug, config) {
    const result = {
        ok: false,
        kind: 'scenario',
        scenario: config.name,
        baseUrl,
        serverUrl,
        pageEvents: [],
        timings: {},
        error: null,
        launch: {
            black: browserInfo.black.label,
            white: browserInfo.white.label
        }
    };
    let blackContext = null;
    let whiteContext = null;
    let blackPage = null;
    let whitePage = null;
    try {
        const created = await createPagesForRun(browserInfo, result, baseUrl);
        blackContext = created.blackContext;
        whiteContext = created.whiteContext;
        blackPage = created.blackPage;
        whitePage = created.whitePage;

        const room = await createRoom(blackPage, `${config.shortLabel}-B`, serverUrl);
        result.roomId = room.roomId;
        await joinRoom(whitePage, room.roomId, `${config.shortLabel}-W`, serverUrl);
        await Promise.all([waitForTwoPlayers(blackPage), waitForTwoPlayers(whitePage)]);
        await Promise.all([closeNetworkOverlayIfOpen(blackPage), closeNetworkOverlayIfOpen(whitePage)]);
        await Promise.all([waitForPlaybackIdle(blackPage), waitForPlaybackIdle(whitePage)]);

        setRoomSnapshot(debug, room.roomId, config.buildSnapshot(), `copilot_seed_${config.name}`);
        const seeded = await waitForSynchronizedState(blackPage, whitePage, STATE_TIMEOUT_MS);
        await Promise.all([
            waitForNetworkIdle(blackPage, STATE_TIMEOUT_MS, 1),
            waitForNetworkIdle(whitePage, STATE_TIMEOUT_MS, 1),
            waitForPlaybackIdle(blackPage),
            waitForPlaybackIdle(whitePage)
        ]);
        result.seeded = {
            black: seeded.black,
            white: seeded.white
        };
        result.screenshots = {
            seededBlack: await capturePageShot(blackPage, `${config.name}-seeded-black.png`),
            seededWhite: await capturePageShot(whitePage, `${config.name}-seeded-white.png`)
        };

        const useStartState = await getLiveState(blackPage);
        const useViaDom = await useCardViaDom(blackPage, 'black', config.cardId);
        result.cardSelection = useViaDom.immediate;
        result.timings.useClickedAt = useViaDom.usedAt;

        let cardUseAnimationStart = null;
        try {
            cardUseAnimationStart = await waitForAuditEvent(blackPage, 'animationCalls', {
                name: 'playCardUseHandAnimation',
                stage: 'start'
            }, 5000);
            result.screenshots.cardUseAnimationBlack = await capturePageShot(blackPage, `${config.name}-card-use-animation-black.png`);
        } catch (e) {
            result.cardUseAnimationMissing = String(e && e.message ? e.message : e);
        }

        const pendingReady = await waitForConditionPair(
            blackPage,
            whitePage,
            (black, white) => {
                const blackPending = black.pendingByPlayer && black.pendingByPlayer.black;
                const whitePending = white.pendingByPlayer && white.pendingByPlayer.black;
                return !!(
                    blackPending
                    && whitePending
                    && blackPending.type === config.pendingType
                    && blackPending.stage === 'selectTarget'
                    && whitePending.type === config.pendingType
                    && whitePending.stage === 'selectTarget'
                    && black.highlightCells.length >= config.minimumHighlightCount
                );
            },
            STATE_TIMEOUT_MS,
            `wait for ${config.pendingType} pending selection`
        );
        result.timings.useToPendingMs = Date.now() - useViaDom.usedAt;
        result.pending = {
            black: pendingReady.black,
            white: pendingReady.white
        };
        result.screenshots.pendingBlack = await capturePageShot(blackPage, `${config.name}-pending-black.png`);
        result.screenshots.pendingWhite = await capturePageShot(whitePage, `${config.name}-pending-white.png`);

        const target = config.resolveTarget(pendingReady.black);
        const expectedCurrentPlayerKeyAfterResolve = resolveExpectedCurrentPlayerKeyAfterSelection(config.pendingType, 'black');
        const targetCellHighlighted = pendingReady.black.highlightCells.some((entry) => entry.row === target.row && entry.col === target.col)
            || pendingReady.black.noCircleCells.some((entry) => entry.row === target.row && entry.col === target.col)
            || pendingReady.black.effectTargetCells.some((entry) => entry.row === target.row && entry.col === target.col);
        if (!targetCellHighlighted) {
            throw new Error(`Target ${target.row},${target.col} was not highlighted for ${config.name}`);
        }

        const resolveStartedAt = Date.now();
        await clickBoardCell(blackPage, target.row, target.col);
        result.postClick = await collectScenarioEvidence(blackPage, whitePage);
        result.screenshots.postClickBlack = await capturePageShot(blackPage, `${config.name}-post-click-black.png`);
        result.screenshots.postClickWhite = await capturePageShot(whitePage, `${config.name}-post-click-white.png`);
        if (config.expectedAnimationName) {
            try {
                await waitForAuditEvent(blackPage, 'animationCalls', {
                    name: config.expectedAnimationName,
                    stage: 'start'
                }, 5000);
                result.screenshots.resolutionAnimationBlack = await capturePageShot(blackPage, `${config.name}-resolution-animation-black.png`);
            } catch (e) {
                result.resolutionAnimationMissing = String(e && e.message ? e.message : e);
            }
        }

        const resolved = await waitForConditionPair(
            blackPage,
            whitePage,
            (black, white) => {
                const blackPending = black.pendingByPlayer && black.pendingByPlayer.black;
                const whitePending = white.pendingByPlayer && white.pendingByPlayer.black;
                return (
                    !blackPending
                    && !whitePending
                    && black.currentPlayerKey === expectedCurrentPlayerKeyAfterResolve
                    && white.currentPlayerKey === expectedCurrentPlayerKeyAfterResolve
                );
            },
            STATE_TIMEOUT_MS,
            `wait for ${config.name} resolution`
        );
        result.timings.resolveMs = Date.now() - resolveStartedAt;
        await Promise.all([
            waitForNetworkIdle(blackPage, STATE_TIMEOUT_MS),
            waitForNetworkIdle(whitePage, STATE_TIMEOUT_MS),
            waitForPlaybackIdle(blackPage),
            waitForPlaybackIdle(whitePage)
        ]);
        const { black: finalBlack, white: finalWhite, blackAudit, whiteAudit } = await collectScenarioEvidence(blackPage, whitePage);

        result.final = {
            black: finalBlack,
            white: finalWhite,
            blackAudit,
            whiteAudit,
            target,
            preUseBlack: useStartState,
            cardUseAnimationObserved: !!cardUseAnimationStart,
            expectedCurrentPlayerKeyAfterResolve
        };
        result.screenshots.finalBlack = await capturePageShot(blackPage, `${config.name}-final-black.png`);
        result.screenshots.finalWhite = await capturePageShot(whitePage, `${config.name}-final-white.png`);
        result.assertions = config.assertions({
            target,
            seeded: result.seeded,
            pending: result.pending,
            finalBlack,
            finalWhite,
            blackAudit,
            whiteAudit,
            cardUseAnimationObserved: !!cardUseAnimationStart
        });
        result.ok = result.assertions.every((entry) => entry && entry.ok === true);
        if (!result.ok) {
            throw new Error(`Scenario ${config.name} assertions failed: ${JSON.stringify(result.assertions)}`);
        }
        void resolved;
    } catch (error) {
        result.error = error && error.stack ? error.stack : String(error);
        if (blackPage && whitePage) {
            try {
                result.failureState = await collectScenarioEvidence(blackPage, whitePage);
            } catch (e) {
                result.failureStateError = String(e && e.message ? e.message : e);
            }
        }
        if (blackPage) {
            try { result.errorBlackShot = await capturePageShot(blackPage, `${config.name}-error-black.png`); } catch (e) { /* ignore */ }
        }
        if (whitePage) {
            try { result.errorWhiteShot = await capturePageShot(whitePage, `${config.name}-error-white.png`); } catch (e) { /* ignore */ }
        }
    } finally {
        await Promise.allSettled([
            blackPage ? leaveRoomIfPossible(blackPage) : null,
            whitePage ? leaveRoomIfPossible(whitePage) : null
        ]);
        await Promise.allSettled([
            blackContext ? blackContext.close() : null,
            whiteContext ? whiteContext.close() : null
        ]);
    }
    return result;
}

function hasEffectCall(audit, effectKey) {
    return !!(
        audit
        && Array.isArray(audit.effectCalls)
        && audit.effectCalls.some((entry) => entry && entry.key === effectKey)
    );
}

function hasAnimationCall(audit, animationName) {
    return !!(
        audit
        && Array.isArray(audit.animationCalls)
        && audit.animationCalls.some((entry) => entry && entry.name === animationName && entry.stage === 'start')
    );
}

function findMarker(state, matcher) {
    const markers = Array.isArray(state && state.markers) ? state.markers : [];
    return markers.find((marker) => matcher(marker));
}

const SCENARIOS = [
    {
        name: 'trap',
        shortLabel: 'TRP',
        cardId: CARD_DEFS.trap.id,
        pendingType: 'TRAP_WILL',
        minimumHighlightCount: 2,
        expectedAnimationName: null,
        buildSnapshot: buildTrapScenarioSnapshot,
        resolveTarget: () => ({ row: 3, col: 4 }),
        assertions({ target, finalBlack, finalWhite, blackAudit, cardUseAnimationObserved }) {
            return [
                { name: 'card use animation observed', ok: cardUseAnimationObserved || hasAnimationCall(blackAudit, 'playCardUseHandAnimation') },
                { name: 'hand card select sound observed', ok: hasEffectCall(blackAudit, 'hand_card_select') },
                { name: 'card use button sound observed', ok: hasEffectCall(blackAudit, 'card_use_button') },
                { name: 'trap select sound observed', ok: hasEffectCall(blackAudit, 'trap_select') },
                {
                    name: 'trap marker present',
                    ok: !!findMarker(finalBlack, (marker) => marker && marker.row === target.row && marker.col === target.col && marker.data && marker.data.type === 'TRAP')
                },
                {
                    name: 'turn handed to white',
                    ok: finalBlack.currentPlayerKey === 'white'
                        && finalWhite.currentPlayerKey === 'white'
                        && finalBlack.canAct === false
                        && finalWhite.canAct === true
                },
                {
                    name: 'pending cleared',
                    ok: !finalBlack.pendingByPlayer.black && !finalWhite.pendingByPlayer.black
                }
            ];
        }
    },
    {
        name: 'freeze',
        shortLabel: 'FRZ',
        cardId: CARD_DEFS.freeze.id,
        pendingType: 'FREEZE_WILL',
        minimumHighlightCount: 4,
        expectedAnimationName: null,
        buildSnapshot: buildFreezeScenarioSnapshot,
        resolveTarget: () => ({ row: 3, col: 3 }),
        assertions({ target, finalBlack, finalWhite, blackAudit, cardUseAnimationObserved }) {
            return [
                { name: 'card use animation observed', ok: cardUseAnimationObserved || hasAnimationCall(blackAudit, 'playCardUseHandAnimation') },
                { name: 'hand card select sound observed', ok: hasEffectCall(blackAudit, 'hand_card_select') },
                { name: 'card use button sound observed', ok: hasEffectCall(blackAudit, 'card_use_button') },
                { name: 'freeze select sound observed', ok: hasEffectCall(blackAudit, 'freeze_select') },
                {
                    name: 'freeze marker present',
                    ok: !!findMarker(finalBlack, (marker) => marker && marker.row === target.row && marker.col === target.col && marker.data && marker.data.type === 'FREEZE')
                },
                {
                    name: 'turn stays black',
                    ok: finalBlack.currentPlayerKey === 'black'
                        && finalWhite.currentPlayerKey === 'black'
                        && finalBlack.canAct === true
                        && finalWhite.canAct === false
                },
                {
                    name: 'pending cleared',
                    ok: !finalBlack.pendingByPlayer.black && !finalWhite.pendingByPlayer.black
                }
            ];
        }
    },
    {
        name: 'capture',
        shortLabel: 'CAP',
        cardId: CARD_DEFS.capture.id,
        pendingType: 'CAPTURE_WILL',
        minimumHighlightCount: 1,
        expectedAnimationName: 'playCaptureToHandAnimation',
        buildSnapshot: buildCaptureScenarioSnapshot,
        resolveTarget: () => ({ row: 3, col: 3 }),
        assertions({ target, finalBlack, finalWhite, blackAudit, cardUseAnimationObserved }) {
            const blackHandIds = Array.isArray(finalBlack.blackHand) ? finalBlack.blackHand.map((entry) => entry && entry.id).filter(Boolean) : [];
            return [
                { name: 'card use animation observed', ok: cardUseAnimationObserved || hasAnimationCall(blackAudit, 'playCardUseHandAnimation') },
                { name: 'capture animation observed', ok: hasAnimationCall(blackAudit, 'playCaptureToHandAnimation') },
                { name: 'hand card select sound observed', ok: hasEffectCall(blackAudit, 'hand_card_select') },
                { name: 'card use button sound observed', ok: hasEffectCall(blackAudit, 'card_use_button') },
                { name: 'capture sound observed', ok: hasEffectCall(blackAudit, 'tempt_select') },
                { name: 'captured card inserted into hand', ok: blackHandIds[1] === CARD_DEFS.dragon.id },
                { name: 'board cell cleared', ok: Array.isArray(finalBlack.board) && finalBlack.board[target.row] && finalBlack.board[target.row][target.col] === Core.EMPTY },
                {
                    name: 'special marker removed',
                    ok: !findMarker(finalBlack, (marker) => marker && marker.row === target.row && marker.col === target.col && marker.kind === 'specialStone')
                },
                {
                    name: 'turn stays black',
                    ok: finalBlack.currentPlayerKey === 'black'
                        && finalWhite.currentPlayerKey === 'black'
                        && finalBlack.canAct === true
                        && finalWhite.canAct === false
                },
                {
                    name: 'pending cleared',
                    ok: !finalBlack.pendingByPlayer.black && !finalWhite.pendingByPlayer.black
                }
            ];
        }
    }
];

async function main() {
    const enabledScenarios = SCENARIOS.filter((scenario) => isScenarioEnabled(scenario.name));
    const topLevelResult = {
        ok: false,
        runTag: RUN_TAG,
        headless: HEADLESS,
        slowMoMs: SLOW_MO_MS,
        scenarioFilter: SCENARIO_FILTERS.slice(),
        scenarioNames: enabledScenarios.map((entry) => entry.name),
        browsers: null,
        launchEvents: [],
        baseUrl: null,
        serverUrl: null,
        baseline: null,
        scenarios: [],
        error: null
    };
    let uiServer = null;
    let matchServer = null;
    let browserInfo = null;
    try {
        if (SCENARIO_FILTERS.length > 0 && enabledScenarios.length === 0) {
            throw new Error(`No scenarios matched SCENARIO_FILTER=${SCENARIO_FILTERS.join(',')}`);
        }
        const startedUi = await startStaticUiServer();
        uiServer = startedUi.server;
        const startedMatch = await startLocalMatchServer();
        matchServer = startedMatch.server;
        topLevelResult.baseUrl = startedUi.baseUrl;
        topLevelResult.serverUrl = startedMatch.serverUrl;
        writeProgress({
            phase: 'starting',
            baseUrl: topLevelResult.baseUrl,
            serverUrl: topLevelResult.serverUrl
        });

        const blackBrowser = await launchBrowserWithFallback('chrome', 'black', topLevelResult.launchEvents);
        const whiteBrowser = await launchBrowserWithFallback('msedge', 'white', topLevelResult.launchEvents);
        browserInfo = {
            black: blackBrowser,
            white: whiteBrowser
        };
        topLevelResult.browsers = {
            black: blackBrowser.label,
            white: whiteBrowser.label
        };

        topLevelResult.baseline = await runBaselineSelfmatch(browserInfo, topLevelResult.baseUrl, topLevelResult.serverUrl);
        writeProgress({
            phase: 'baseline_complete',
            baselineOk: !!(topLevelResult.baseline && topLevelResult.baseline.ok),
            baseUrl: topLevelResult.baseUrl,
            serverUrl: topLevelResult.serverUrl
        });
        for (const scenario of enabledScenarios) {
            writeProgress({
                phase: 'scenario_start',
                scenario: scenario.name,
                baseUrl: topLevelResult.baseUrl,
                serverUrl: topLevelResult.serverUrl
            });
            const scenarioResult = await runSelectionScenario(
                browserInfo,
                topLevelResult.baseUrl,
                topLevelResult.serverUrl,
                startedMatch.debug,
                scenario
            );
            topLevelResult.scenarios.push(scenarioResult);
            writeProgress({
                phase: 'scenario_complete',
                scenario: scenario.name,
                ok: !!scenarioResult.ok
            });
        }
        topLevelResult.ok = !!(
            topLevelResult.baseline
            && topLevelResult.baseline.ok
            && topLevelResult.scenarios.length === enabledScenarios.length
            && topLevelResult.scenarios.every((entry) => entry && entry.ok === true)
        );
    } catch (error) {
        topLevelResult.error = error && error.stack ? error.stack : String(error);
    } finally {
        writeJson(RESULT_PATH, topLevelResult);
        await Promise.allSettled([
            browserInfo && browserInfo.black ? stopPlaywrightBrowser(browserInfo.black.browser, 10000) : null,
            browserInfo && browserInfo.white ? stopPlaywrightBrowser(browserInfo.white.browser, 10000) : null
        ]);
        await Promise.allSettled([
            matchServer ? new Promise((resolve) => matchServer.close(() => resolve())) : null,
            uiServer ? stopStaticServer(uiServer) : null
        ]);
    }
    if (!topLevelResult.ok) {
        process.stderr.write(`selection verification failed: ${RESULT_PATH}\n`);
        process.exit(1);
    }
    process.stdout.write(`selection verification succeeded: ${RESULT_PATH}\n`);
}

if (require.main === module) {
    Promise.resolve(main()).catch((error) => {
        process.stderr.write(`${error && error.stack ? error.stack : error}\n`);
        process.exit(1);
    });
}
