const fs = require('fs');
const path = require('path');
const Module = require('module');
const { chromium } = require('playwright');

const Core = require('../../game/logic/core');
const CardLogic = require('../../game/logic/cards');
const TurnPipelinePhases = require('../../game/turn/turn_pipeline_phases');
const SeededPRNG = require('../../game/schema/prng');

const BASE_URL = String(process.env.BASE_URL || 'http://127.0.0.1:8000').trim().replace(/\/+$/, '');
const VIEWPORT = { width: 1440, height: 1200 };
const OUT_DIR = path.join(process.cwd(), 'tmp', 'playwright-network-verify');
const RESULT_PATH = process.env.RESULT_PATH
    ? path.resolve(process.cwd(), String(process.env.RESULT_PATH))
    : path.join(OUT_DIR, 'reveal-hand-network-seeded-result.json');
const PROGRESS_PATH = process.env.PROGRESS_PATH
    ? path.resolve(process.cwd(), String(process.env.PROGRESS_PATH))
    : path.join(OUT_DIR, 'reveal-hand-network-seeded-progress.json');
const HEADLESS = !/^(0|false)$/i.test(String(process.env.HEADLESS || '1'));
const PAGE_TIMEOUT_MS = Number.isFinite(Number(process.env.PAGE_TIMEOUT_MS))
    ? Math.max(1000, Math.trunc(Number(process.env.PAGE_TIMEOUT_MS)))
    : 30000;
const STATE_TIMEOUT_MS = Number.isFinite(Number(process.env.STATE_TIMEOUT_MS))
    ? Math.max(1000, Math.trunc(Number(process.env.STATE_TIMEOUT_MS)))
    : 15000;
const PLAYBACK_TIMEOUT_MS = Number.isFinite(Number(process.env.PLAYBACK_TIMEOUT_MS))
    ? Math.max(1000, Math.trunc(Number(process.env.PLAYBACK_TIMEOUT_MS)))
    : 15000;
const CARD_PROGRESS_TIMEOUT_MS = Number.isFinite(Number(process.env.CARD_PROGRESS_TIMEOUT_MS))
    ? Math.max(1000, Math.trunc(Number(process.env.CARD_PROGRESS_TIMEOUT_MS)))
    : 10000;
const WHITE_HAND_IDS = String(process.env.WHITE_HAND_IDS || 'rebuild_01')
    .split(',')
    .map((value) => String(value || '').trim())
    .filter(Boolean);
const WHITE_DRAW_DECK_IDS = String(process.env.WHITE_DRAW_DECK_IDS || 'hard_01,free_01,chest_01')
    .split(',')
    .map((value) => String(value || '').trim())
    .filter(Boolean);
const USE_DOM_CARD_FLOW = /^(1|true)$/i.test(String(process.env.USE_DOM_CARD_FLOW || '0'));

fs.mkdirSync(OUT_DIR, { recursive: true });

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeJson(filePath, value) {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function writeProgress(payload) {
    writeJson(PROGRESS_PATH, Object.assign({
        timestamp: new Date().toISOString(),
        baseUrl: BASE_URL
    }, payload || {}));
}

function normalizePlayerKey(value) {
    return (value === -1 || value === 'white' || value === '-1') ? 'white' : 'black';
}

function isHiddenToken(value, ownerKey) {
    return typeof value === 'string' && value.startsWith(`__hidden_hand__:${ownerKey}:`);
}

function hiddenCount(values, ownerKey) {
    return Array.isArray(values)
        ? values.filter((value) => isHiddenToken(value, ownerKey)).length
        : 0;
}

function appendEvent(target, event) {
    if (!Array.isArray(target)) return;
    target.push(Object.assign({ time: new Date().toISOString() }, event || {}));
    if (target.length > 120) {
        target.splice(0, target.length - 120);
    }
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

function buildSeededScenarioSnapshot() {
    const gameState = Core.createGameState();
    const prng = SeededPRNG.createPRNG(123456789);
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
    cardState.pendingEffectByPlayer = { black: null, white: null };
    cardState.hasUsedCardThisTurnByPlayer = { black: false, white: false };
    cardState.hasDestroyedCardThisTurnByPlayer = { black: false, white: false };
    cardState.cardUseCountByPlayer = { black: 0, white: 0 };
    cardState.lastUsedCardByPlayer = { black: null, white: null };
    cardState.charge = { black: 6, white: 0 };
    cardState.turnIndex = 1;
    cardState.lastTurnStartedFor = 'black';
    cardState.presentationEvents = [];
    if (Array.isArray(cardState._presentationEventsPersist)) {
        cardState._presentationEventsPersist.length = 0;
    } else {
        cardState._presentationEventsPersist = [];
    }

    function pushDeckCard(playerKey, cardId) {
        const copyId = cardState._nextCardCopySeq++;
        cardState.decks[playerKey].push(cardId);
        cardState._deckCopyIdsByPlayer[playerKey].push(copyId);
    }

    for (const cardId of WHITE_DRAW_DECK_IDS) {
        pushDeckCard('white', cardId);
    }

    CardLogic.addCardToHand(cardState, 'black', 'reveal_hand_01');
    for (const cardId of WHITE_HAND_IDS) {
        CardLogic.addCardToHand(cardState, 'white', cardId);
    }

    cardState.initialDeckSize = 0;
    cardState.initialDeckSizeByPlayer = { black: 1, white: WHITE_HAND_IDS.length + WHITE_DRAW_DECK_IDS.length };

    return {
        gameState,
        cardState
    };
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

function seedRevealScenario(debug, roomId) {
    const snapshot = buildSeededScenarioSnapshot();
    setRoomSnapshot(debug, roomId, snapshot, 'copilot_seed_reveal_hand');
    return snapshot;
}

function handoffTurnToWhite(debug, roomId) {
    const room = debug && debug.rooms ? debug.rooms.get(roomId) : null;
    if (!room || !room.snapshot || !room.snapshot.gameState || !room.snapshot.cardState) {
        throw new Error(`Room not ready for white handoff: ${roomId}`);
    }

    const snapshot = JSON.parse(JSON.stringify(room.snapshot));
    snapshot.gameState.currentPlayer = -1;
    snapshot.gameState.turnNumber = 1;
    snapshot.cardState.turnIndex = 2;
    snapshot.cardState.lastTurnStartedFor = 'white';
    snapshot.cardState.selectedCardId = null;
    if (snapshot.cardState.pendingEffectByPlayer) {
        snapshot.cardState.pendingEffectByPlayer.white = null;
    }
    if (snapshot.cardState.hasUsedCardThisTurnByPlayer) {
        snapshot.cardState.hasUsedCardThisTurnByPlayer.white = false;
    }
    if (snapshot.cardState.hasDestroyedCardThisTurnByPlayer) {
        snapshot.cardState.hasDestroyedCardThisTurnByPlayer.white = false;
    }
    if (snapshot.cardState.presentationEvents) {
        snapshot.cardState.presentationEvents = [];
    }
    if (Array.isArray(snapshot.cardState._presentationEventsPersist)) {
        snapshot.cardState._presentationEventsPersist = [];
    }

    setRoomSnapshot(debug, roomId, snapshot, 'copilot_force_white_turn');
    return snapshot;
}

async function waitForGameReady(page) {
    await page.waitForFunction(() => {
        try {
            return !!(
                window.NetworkMatchClient
                && window.gameState
                && window.cardState
                && typeof window.useSelectedCard === 'function'
                && typeof window.onCardClick === 'function'
                && typeof window.isGameOver === 'function'
            );
        } catch (error) {
            return false;
        }
    }, { timeout: PAGE_TIMEOUT_MS });
}

async function waitForPlaybackIdle(page, timeoutMs = PLAYBACK_TIMEOUT_MS) {
    await page.evaluate(async (timeout) => {
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const startedAt = Date.now();

        function busyState() {
            const handLayer = document.getElementById('handLayer');
            const handWrapper = document.getElementById('handWrapper');
            return {
                VisualPlaybackActive: window.VisualPlaybackActive === true,
                isCardAnimating: window.isCardAnimating === true,
                isProcessing: window.isProcessing === true,
                movingCard: !!(handLayer && handLayer.querySelector('.card-item.visible')),
                heldDrawCard: !!(handWrapper && handWrapper.querySelector('.held-draw-card')),
                layerVisible: !!(handLayer && handLayer.style && handLayer.style.display === 'block'),
                animationEnginePlaying: !!(window.AnimationEngine && window.AnimationEngine.isPlaying === true)
            };
        }

        while ((Date.now() - startedAt) < timeout) {
            try {
                if (typeof window.waitForPlaybackIdle === 'function') {
                    await window.waitForPlaybackIdle();
                }
            } catch (error) {
                // fall through
            }

            const busy = busyState();
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

        throw new Error(`waitForPlaybackIdle timed out: ${JSON.stringify(busyState())}`);
    }, timeoutMs);
}

async function ensureNetworkMode(page) {
    await page.getByRole('button', { name: 'ネット対戦' }).click();
    await page.waitForFunction(() => {
        try {
            return window.MATCH_MODE === 'network' || window.__MATCH_MODE === 'network';
        } catch (error) {
            return false;
        }
    }, { timeout: PAGE_TIMEOUT_MS });
}

async function closeNetworkOverlayIfOpen(page) {
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
        if (visible && closeBtn && typeof closeBtn.click === 'function') {
            closeBtn.click();
        }
    }).catch(() => {});
}

async function createRoom(page, playerName, serverUrl) {
    await ensureNetworkMode(page);
    const result = await page.evaluate(async ({ name, url }) => {
        return window.NetworkMatchClient.createRoom({
            playerName: name,
            serverUrl: url
        });
    }, { name: playerName, url: serverUrl });
    if (!result || result.ok !== true) {
        throw new Error(`createRoom failed: ${result && result.reason ? result.reason : 'UNKNOWN'}`);
    }
    return result.roomId;
}

async function joinRoom(page, roomId, playerName, serverUrl) {
    await ensureNetworkMode(page);
    const result = await page.evaluate(async ({ id, name, url }) => {
        return window.NetworkMatchClient.joinRoom(id, {
            playerName: name,
            serverUrl: url
        });
    }, { id: roomId, name: playerName, url: serverUrl });
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
    }, { timeout: PAGE_TIMEOUT_MS });
}

async function getLiveState(page) {
    return page.evaluate(() => {
        function cloneBoard(board) {
            return Array.isArray(board) ? board.map((row) => Array.isArray(row) ? row.slice() : []) : [];
        }

        function normalize(value) {
            return (value === -1 || value === 'white' || value === '-1') ? 'white' : 'black';
        }

        const seatKey = window.NetworkMatchClient && typeof window.NetworkMatchClient.getSeatKey === 'function'
            ? window.NetworkMatchClient.getSeatKey()
            : null;
        const currentPlayerKey = normalize(window.gameState ? window.gameState.currentPlayer : null);
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
            charge: seatKey && window.cardState && window.cardState.charge
                ? Number(window.cardState.charge[seatKey]) || 0
                : 0,
            hasUsedCardThisTurn: !!(
                seatKey
                && window.cardState
                && window.cardState.hasUsedCardThisTurnByPlayer
                && window.cardState.hasUsedCardThisTurnByPlayer[seatKey]
            ),
            pending: seatKey && window.cardState && window.cardState.pendingEffectByPlayer
                ? (window.cardState.pendingEffectByPlayer[seatKey]
                    ? JSON.parse(JSON.stringify(window.cardState.pendingEffectByPlayer[seatKey]))
                    : null)
                : null,
            board: cloneBoard(window.gameState && window.gameState.board),
            projectedHands,
            hand,
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

async function getHandDomState(page, ownerKey) {
    return page.evaluate((targetOwnerKey) => {
        const container = document.getElementById(`hand-${targetOwnerKey}`);
        const track = container ? container.querySelector('.hand-track') : null;
        const cards = Array.from(track ? track.querySelectorAll('.card-item') : []).map((element) => ({
            cardId: element.dataset ? (element.dataset.cardId || null) : null,
            ownerKey: element.dataset ? (element.dataset.ownerKey || null) : null,
            hidden: !!(element.classList && element.classList.contains('hidden')),
            text: String(element.textContent || '').trim().slice(0, 80)
        }));
        return {
            ownerKey: targetOwnerKey,
            cardCount: cards.length,
            hiddenCount: cards.filter((card) => card.hidden).length,
            cards
        };
    }, ownerKey);
}

async function waitForCondition(blackPage, whitePage, predicate, timeoutMs, description) {
    const startedAt = Date.now();
    let lastStates = null;
    while ((Date.now() - startedAt) < timeoutMs) {
        const [black, white] = await Promise.all([getLiveState(blackPage), getLiveState(whitePage)]);
        lastStates = { black, white };
        if (predicate(black, white)) {
            return lastStates;
        }
        await wait(150);
    }
    const error = new Error(`Timeout: ${description || 'condition not reached'}`);
    error.lastStates = lastStates;
    throw error;
}

async function useCard(page, seatKey, cardId) {
    const before = await getLiveState(page);
    await waitForPlaybackIdle(page);

    const immediate = await page.evaluate(({ playerKey, targetCardId }) => {
        window.onCardClick(targetCardId, playerKey);
        window.useSelectedCard();
        return {
            selectedCardId: window.cardState ? window.cardState.selectedCardId : null,
            hasUsedCardThisTurn: !!(
                window.cardState
                && window.cardState.hasUsedCardThisTurnByPlayer
                && window.cardState.hasUsedCardThisTurnByPlayer[playerKey]
            )
        };
    }, { playerKey: seatKey, targetCardId: cardId });

    const beforeHandIds = Array.isArray(before.hand) ? before.hand.map((entry) => entry && entry.id).filter(Boolean) : [];
    const startedAt = Date.now();
    let after = await getLiveState(page);
    while ((Date.now() - startedAt) < CARD_PROGRESS_TIMEOUT_MS) {
        const afterHandIds = Array.isArray(after.hand) ? after.hand.map((entry) => entry && entry.id).filter(Boolean) : [];
        const progressed = (
            after.hasUsedCardThisTurn === true
            || before.charge !== after.charge
            || beforeHandIds.join('|') !== afterHandIds.join('|')
            || !!after.pending
        );
        if (progressed) {
            return { before, immediate, after };
        }
        await wait(100);
        after = await getLiveState(page);
    }

    const error = new Error(`No local progress after using ${cardId}`);
    error.before = before;
    error.immediate = immediate;
    error.after = after;
    throw error;
}

async function useCardViaDom(page, seatKey, cardId) {
    const before = await getLiveState(page);
    await waitForPlaybackIdle(page);

    const ready = await page.evaluate(({ ownerKey, targetCardId }) => {
        const matchingCards = Array.from(document.querySelectorAll('.card-item')).filter((element) => {
            if (!element || !element.dataset) return false;
            if (element.dataset.cardId !== targetCardId) return false;
            if (element.dataset.ownerKey !== ownerKey) return false;
            return !element.classList.contains('hidden');
        });
        const useBtn = document.getElementById('use-card-btn');
        const reasonEl = document.getElementById('use-card-reason');
        return {
            matchCount: matchingCards.length,
            useBtnDisabled: !!(useBtn && useBtn.disabled),
            reason: reasonEl ? String(reasonEl.textContent || '').trim() : ''
        };
    }, { ownerKey: seatKey, targetCardId: cardId });

    if (!ready || ready.matchCount <= 0) {
        throw new Error(`DOM card not found for ${seatKey}:${cardId}`);
    }

    await page.locator(`.card-item.visible[data-owner-key="${seatKey}"][data-card-id="${cardId}"]`).first().click();
    await page.waitForFunction(() => {
        const button = document.getElementById('use-card-btn');
        return !!button && button.disabled === false;
    }, { timeout: CARD_PROGRESS_TIMEOUT_MS });
    await page.locator('#use-card-btn').click();

    const beforeHandIds = Array.isArray(before.hand) ? before.hand.map((entry) => entry && entry.id).filter(Boolean) : [];
    const startedAt = Date.now();
    let after = await getLiveState(page);
    while ((Date.now() - startedAt) < CARD_PROGRESS_TIMEOUT_MS) {
        const afterHandIds = Array.isArray(after.hand) ? after.hand.map((entry) => entry && entry.id).filter(Boolean) : [];
        const progressed = (
            after.hasUsedCardThisTurn === true
            || before.charge !== after.charge
            || beforeHandIds.join('|') !== afterHandIds.join('|')
            || !!after.pending
        );
        if (progressed) {
            return { before, via: 'dom', after, preClick: ready };
        }
        await wait(100);
        after = await getLiveState(page);
    }

    const error = new Error(`No local progress after DOM using ${cardId}`);
    error.before = before;
    error.preClick = ready;
    error.after = after;
    throw error;
}

async function captureScreenshot(page, fileName) {
    const targetPath = path.join(OUT_DIR, fileName);
    await page.screenshot({ path: targetPath, fullPage: true });
    return targetPath;
}

function summarizeState(state) {
    return {
        seatKey: state.seatKey,
        currentPlayerKey: state.currentPlayerKey,
        canAct: state.canAct === true,
        turnIndex: state.turnIndex,
        turnNumber: state.turnNumber,
        charge: state.charge,
        hasUsedCardThisTurn: state.hasUsedCardThisTurn === true,
        hand: Array.isArray(state.hand) ? state.hand.map((card) => ({
            id: card.id,
            cost: card.cost,
            canUse: card.canUse === true
        })) : [],
        projectedHands: state.projectedHands
    };
}

async function main() {
    const pageEvents = [];
    let browser = null;
    let blackContext = null;
    let whiteContext = null;
    let blackPage = null;
    let whitePage = null;
    let serverHandle = null;
    let serverDebug = null;
    let roomId = null;

    try {
        writeProgress({ stage: 'starting' });
        serverHandle = await startLocalMatchServer();
        serverDebug = serverHandle.debug;
        writeProgress({
            stage: 'match-server-ready',
            serverUrl: serverHandle.serverUrl
        });

        browser = await chromium.launch({ headless: HEADLESS });
        blackContext = await browser.newContext({ viewport: VIEWPORT });
        whiteContext = await browser.newContext({ viewport: VIEWPORT });
        blackPage = await blackContext.newPage();
        whitePage = await whiteContext.newPage();

        blackPage.on('console', (message) => {
            const type = typeof message.type === 'function' ? message.type() : 'log';
            if (type === 'error' || type === 'warning') {
                appendEvent(pageEvents, {
                    browser: 'black',
                    kind: 'console',
                    type,
                    text: typeof message.text === 'function' ? message.text() : ''
                });
            }
        });
        whitePage.on('console', (message) => {
            const type = typeof message.type === 'function' ? message.type() : 'log';
            if (type === 'error' || type === 'warning') {
                appendEvent(pageEvents, {
                    browser: 'white',
                    kind: 'console',
                    type,
                    text: typeof message.text === 'function' ? message.text() : ''
                });
            }
        });

        await Promise.all([
            blackPage.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS }),
            whitePage.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS })
        ]);
        await Promise.all([waitForGameReady(blackPage), waitForGameReady(whitePage)]);

        roomId = await createRoom(blackPage, 'Black', serverHandle.serverUrl);
        await joinRoom(whitePage, roomId, 'White', serverHandle.serverUrl);
        await Promise.all([
            waitForTwoPlayers(blackPage),
            waitForTwoPlayers(whitePage)
        ]);
        await Promise.all([
            closeNetworkOverlayIfOpen(blackPage),
            closeNetworkOverlayIfOpen(whitePage)
        ]);
        await wait(500);

        writeProgress({
            stage: 'room-ready',
            roomId,
            serverUrl: serverHandle.serverUrl
        });

        seedRevealScenario(serverDebug, roomId);
        const seededStates = await waitForCondition(
            blackPage,
            whitePage,
            (black, white) => (
                black.currentPlayerKey === 'black'
                && white.currentPlayerKey === 'black'
                && Array.isArray(black.hand)
                && black.hand.length === 1
                && black.hand[0].id === 'reveal_hand_01'
                && Array.isArray(white.hand)
                && white.hand.length === WHITE_HAND_IDS.length
                && JSON.stringify(white.hand.map((entry) => entry.id)) === JSON.stringify(WHITE_HAND_IDS)
                && Array.isArray(black.projectedHands.white)
                && black.projectedHands.white.length === WHITE_HAND_IDS.length
                && hiddenCount(black.projectedHands.white, 'white') === WHITE_HAND_IDS.length
            ),
            STATE_TIMEOUT_MS,
            'seeded reveal scenario'
        );
        await Promise.all([waitForPlaybackIdle(blackPage), waitForPlaybackIdle(whitePage)]);

        const beforeRevealDom = {
            blackViewingWhite: await getHandDomState(blackPage, 'white'),
            whiteViewingWhite: await getHandDomState(whitePage, 'white')
        };
        const beforeRevealScreenshots = {
            black: await captureScreenshot(blackPage, 'reveal-hand-seeded-before-black.png'),
            white: await captureScreenshot(whitePage, 'reveal-hand-seeded-before-white.png')
        };

        const blackSeatKey = seededStates.black.seatKey;
        const revealUsage = USE_DOM_CARD_FLOW
            ? await useCardViaDom(blackPage, blackSeatKey, 'reveal_hand_01')
            : await useCard(blackPage, blackSeatKey, 'reveal_hand_01');
        const revealedStates = await waitForCondition(
            blackPage,
            whitePage,
            (black, white) => (
                black.currentPlayerKey === 'black'
                && Array.isArray(black.projectedHands.white)
                && black.projectedHands.white.length === WHITE_HAND_IDS.length
                && JSON.stringify(black.projectedHands.white) === JSON.stringify(WHITE_HAND_IDS)
                && hiddenCount(black.projectedHands.white, 'white') === 0
                && Array.isArray(white.projectedHands.white)
                && white.projectedHands.white.length === WHITE_HAND_IDS.length
                && JSON.stringify(white.projectedHands.white) === JSON.stringify(WHITE_HAND_IDS)
            ),
            STATE_TIMEOUT_MS,
            'reveal card reflected to both pages'
        );
        await Promise.all([waitForPlaybackIdle(blackPage), waitForPlaybackIdle(whitePage)]);

        const afterRevealDom = {
            blackViewingWhite: await getHandDomState(blackPage, 'white'),
            whiteViewingWhite: await getHandDomState(whitePage, 'white')
        };
        const afterRevealScreenshots = {
            black: await captureScreenshot(blackPage, 'reveal-hand-seeded-after-reveal-black.png'),
            white: await captureScreenshot(whitePage, 'reveal-hand-seeded-after-reveal-white.png')
        };

        if (revealedStates.black.charge !== 0) {
            throw new Error(`Reveal charge did not spend to zero: ${revealedStates.black.charge}`);
        }
        if (afterRevealDom.blackViewingWhite.hiddenCount !== 0) {
            throw new Error(`Black page still shows hidden opponent cards after reveal: ${afterRevealDom.blackViewingWhite.hiddenCount}`);
        }

        handoffTurnToWhite(serverDebug, roomId);
        const whiteTurnStates = await waitForCondition(
            blackPage,
            whitePage,
            (black, white) => (
                black.currentPlayerKey === 'white'
                && white.currentPlayerKey === 'white'
                && white.canAct === true
                && Array.isArray(white.hand)
                && white.hand.some((entry) => entry && entry.id === 'rebuild_01')
            ),
            STATE_TIMEOUT_MS,
            'forced white turn after reveal'
        );
        await Promise.all([waitForPlaybackIdle(blackPage), waitForPlaybackIdle(whitePage)]);

        const whiteSeatKey = whiteTurnStates.white.seatKey;
        const rebuildUsage = USE_DOM_CARD_FLOW
            ? await useCardViaDom(whitePage, whiteSeatKey, 'rebuild_01')
            : await useCard(whitePage, whiteSeatKey, 'rebuild_01');
        const postDrawStates = await waitForCondition(
            blackPage,
            whitePage,
            (black, white) => (
                Array.isArray(black.projectedHands.white)
                && black.projectedHands.white.length === 3
                && hiddenCount(black.projectedHands.white, 'white') === 3
                && Array.isArray(white.projectedHands.white)
                && white.projectedHands.white.length === 3
                && hiddenCount(white.projectedHands.white, 'white') === 0
            ),
            STATE_TIMEOUT_MS,
            'white rebuild draws stay hidden from black'
        );
        await Promise.all([waitForPlaybackIdle(blackPage), waitForPlaybackIdle(whitePage)]);

        const afterDrawDom = {
            blackViewingWhite: await getHandDomState(blackPage, 'white'),
            whiteViewingWhite: await getHandDomState(whitePage, 'white')
        };
        const afterDrawScreenshots = {
            black: await captureScreenshot(blackPage, 'reveal-hand-seeded-after-draw-black.png'),
            white: await captureScreenshot(whitePage, 'reveal-hand-seeded-after-draw-white.png')
        };

        const whiteDrawnCards = Array.isArray(postDrawStates.white.projectedHands.white)
            ? postDrawStates.white.projectedHands.white.slice().sort()
            : [];
        const expectedDrawnCards = WHITE_DRAW_DECK_IDS.slice().sort();
        if (JSON.stringify(whiteDrawnCards) !== JSON.stringify(expectedDrawnCards)) {
            throw new Error(`Unexpected white drawn cards: ${JSON.stringify(whiteDrawnCards)}`);
        }
        if (Array.isArray(postDrawStates.black.projectedHands.white) && postDrawStates.black.projectedHands.white.includes('rebuild_01')) {
            throw new Error(`Black still sees old revealed card after rebuild: ${JSON.stringify(postDrawStates.black.projectedHands.white)}`);
        }
        if (afterDrawDom.blackViewingWhite.hiddenCount !== 3) {
            throw new Error(`Black DOM should hide all 3 newly drawn cards, got ${afterDrawDom.blackViewingWhite.hiddenCount}`);
        }

        const result = {
            ok: true,
            mode: 'seeded-network-room',
            headless: HEADLESS,
            domCardFlow: USE_DOM_CARD_FLOW,
            baseUrl: BASE_URL,
            serverUrl: serverHandle.serverUrl,
            roomId,
            checks: {
                beforeReveal: {
                    black: summarizeState(seededStates.black),
                    white: summarizeState(seededStates.white),
                    dom: beforeRevealDom,
                    screenshots: beforeRevealScreenshots
                },
                revealUse: {
                    usage: revealUsage,
                    black: summarizeState(revealedStates.black),
                    white: summarizeState(revealedStates.white),
                    dom: afterRevealDom,
                    screenshots: afterRevealScreenshots
                },
                postDraw: {
                    usage: rebuildUsage,
                    black: summarizeState(postDrawStates.black),
                    white: summarizeState(postDrawStates.white),
                    dom: afterDrawDom,
                    screenshots: afterDrawScreenshots,
                    expectedDrawnCards,
                    actualWhiteDrawnCards: whiteDrawnCards
                }
            },
            pageEvents
        };

        writeJson(RESULT_PATH, result);
        writeProgress({
            stage: 'done',
            ok: true,
            roomId,
            resultPath: RESULT_PATH
        });
        console.log(`REVEAL_HAND_NETWORK_SEEDED_OK room=${roomId} result=${RESULT_PATH}`);
    } catch (error) {
        const failure = {
            ok: false,
            baseUrl: BASE_URL,
            roomId,
            error: error && error.message ? error.message : String(error),
            stack: error && error.stack ? String(error.stack) : null,
            lastStates: error && error.lastStates ? error.lastStates : null,
            pageEvents
        };

        if (blackPage) {
            try {
                failure.blackState = await getLiveState(blackPage);
                failure.blackWhiteHandDom = await getHandDomState(blackPage, 'white');
                failure.blackScreenshot = await captureScreenshot(blackPage, 'reveal-hand-seeded-error-black.png');
            } catch (innerError) {
                failure.blackCaptureError = innerError && innerError.message ? innerError.message : String(innerError);
            }
        }
        if (whitePage) {
            try {
                failure.whiteState = await getLiveState(whitePage);
                failure.whiteWhiteHandDom = await getHandDomState(whitePage, 'white');
                failure.whiteScreenshot = await captureScreenshot(whitePage, 'reveal-hand-seeded-error-white.png');
            } catch (innerError) {
                failure.whiteCaptureError = innerError && innerError.message ? innerError.message : String(innerError);
            }
        }

        writeJson(RESULT_PATH, failure);
        writeProgress({
            stage: 'failed',
            ok: false,
            roomId,
            error: failure.error,
            resultPath: RESULT_PATH
        });
        console.error(failure.error);
        process.exitCode = 1;
    } finally {
        if (blackContext) {
            try {
                await blackContext.close();
            } catch (error) {
                // ignore
            }
        }
        if (whiteContext) {
            try {
                await whiteContext.close();
            } catch (error) {
                // ignore
            }
        }
        if (browser) {
            try {
                await browser.close();
            } catch (error) {
                // ignore
            }
        }
        if (serverHandle && serverHandle.server) {
            try {
                await new Promise((resolve) => serverHandle.server.close(() => resolve()));
            } catch (error) {
                // ignore
            }
        }
    }
}

main();
