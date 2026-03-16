const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const DeckCodec = require('../../shared/deck-codec');
const DeckSpecHelpers = require('../../shared/deck-spec');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8000';
const SERVER_URL = process.env.SERVER_URL || 'http://127.0.0.1:8787';
const TARGET = String(process.env.TARGET || 'trap').trim().toLowerCase();
const VIEWPORT = { width: 1440, height: 1200 };
const OUT_DIR = path.join(process.cwd(), 'tmp', 'playwright-network-verify');
const RESULT_PATH = process.env.RESULT_PATH
    ? path.resolve(process.cwd(), String(process.env.RESULT_PATH))
    : path.join(OUT_DIR, `selection-card-${TARGET}-result.json`);
const MAX_ATTEMPTS = Number.isFinite(Number(process.env.MAX_ATTEMPTS))
    ? Math.max(1, Math.trunc(Number(process.env.MAX_ATTEMPTS)))
    : 6;
const MAX_ACTIONS = Number.isFinite(Number(process.env.MAX_ACTIONS))
    ? Math.max(4, Math.trunc(Number(process.env.MAX_ACTIONS)))
    : 28;
const PAGE_TIMEOUT_MS = Number.isFinite(Number(process.env.PAGE_TIMEOUT_MS))
    ? Math.max(1000, Math.trunc(Number(process.env.PAGE_TIMEOUT_MS)))
    : 30000;
const PLAYBACK_TIMEOUT_MS = Number.isFinite(Number(process.env.PLAYBACK_TIMEOUT_MS))
    ? Math.max(1000, Math.trunc(Number(process.env.PLAYBACK_TIMEOUT_MS)))
    : 20000;
const STATE_TIMEOUT_MS = Number.isFinite(Number(process.env.STATE_TIMEOUT_MS))
    ? Math.max(1000, Math.trunc(Number(process.env.STATE_TIMEOUT_MS)))
    : 20000;
const TARGET_PROGRESS_TIMEOUT_MS = Number.isFinite(Number(process.env.TARGET_PROGRESS_TIMEOUT_MS))
    ? Math.max(500, Math.trunc(Number(process.env.TARGET_PROGRESS_TIMEOUT_MS)))
    : 6000;
const PROGRESS_PATH = process.env.PROGRESS_PATH
    ? path.resolve(process.cwd(), String(process.env.PROGRESS_PATH))
    : null;

fs.mkdirSync(OUT_DIR, { recursive: true });

const TARGET_CONFIGS = {
    trap: {
        label: 'trap',
        cardId: 'trap_01',
        pendingType: 'TRAP_WILL',
        pickCandidates(state) {
            return collectCellsByOwner(state, state.seatKey);
        },
        async verifyResolution(context) {
            const { actorKey, blackPage, whitePage, actionLog } = context;
            const nextPlayerKey = actorKey === 'white' ? 'black' : 'white';
            const nextPage = nextPlayerKey === 'white' ? whitePage : blackPage;
            const synced = await waitForSynchronizedState(blackPage, whitePage, STATE_TIMEOUT_MS);
            actionLog.push({ type: 'post_selection_sync', black: synced.black, white: synced.white });
            if (synced.black.currentPlayerKey !== nextPlayerKey || synced.white.currentPlayerKey !== nextPlayerKey) {
                throw new Error(`TRAP_WILL selection did not hand off to ${nextPlayerKey}`);
            }
            if (synced.black.pending || synced.white.pending) {
                throw new Error('TRAP_WILL pending selection still remained after target selection');
            }
            await performTurnAction(nextPage, synced[nextPlayerKey], actionLog, `${nextPlayerKey}_followup`);
            await waitForSynchronizedState(blackPage, whitePage, STATE_TIMEOUT_MS);
        }
    },
    sacrifice: {
        label: 'sacrifice',
        cardId: 'sacrifice_01',
        pendingType: 'SACRIFICE_WILL',
        pickCandidates(state) {
            return collectCellsByOwner(state, state.seatKey);
        },
        async verifyResolution(context) {
            const { actorKey, blackPage, whitePage, actionLog } = context;
            const actorPage = actorKey === 'white' ? whitePage : blackPage;
            const nextPlayerKey = actorKey === 'white' ? 'black' : 'white';
            const afterFirstSelection = await waitForSynchronizedState(blackPage, whitePage, STATE_TIMEOUT_MS);
            actionLog.push({ type: 'after_first_selection', black: afterFirstSelection.black, white: afterFirstSelection.white });
            const blackActorPending = afterFirstSelection.black.pendingByPlayer && afterFirstSelection.black.pendingByPlayer[actorKey];
            const whiteActorPending = afterFirstSelection.white.pendingByPlayer && afterFirstSelection.white.pendingByPlayer[actorKey];
            if (!blackActorPending || !whiteActorPending || blackActorPending.type !== 'SACRIFICE_WILL' || whiteActorPending.type !== 'SACRIFICE_WILL') {
                throw new Error('SACRIFICE_WILL pending selection disappeared too early');
            }
            if (Number(blackActorPending.selectedCount || 0) < 1 || Number(whiteActorPending.selectedCount || 0) < 1) {
                throw new Error('SACRIFICE_WILL first selection did not increment selectedCount');
            }
            if (afterFirstSelection.black.currentPlayerKey !== actorKey || afterFirstSelection.white.currentPlayerKey !== actorKey) {
                throw new Error(`SACRIFICE_WILL should keep the turn on ${actorKey} after first selection`);
            }

            await actorPage.evaluate((seatKey) => {
                if (typeof window.cancelPendingSelection === 'function') {
                    window.cancelPendingSelection(seatKey);
                }
            }, actorKey);
            actionLog.push({ type: 'cancel_pending_selection' });

            const afterCancel = await waitForCondition(
                blackPage,
                whitePage,
                (black, white) => {
                    const bActor = black.pendingByPlayer && black.pendingByPlayer[actorKey];
                    const wActor = white.pendingByPlayer && white.pendingByPlayer[actorKey];
                    return !bActor && !wActor;
                },
                STATE_TIMEOUT_MS,
                'wait for sacrifice cancel to clear pending selection'
            );
            actionLog.push({ type: 'after_cancel', black: afterCancel.black, white: afterCancel.white });
            if (afterCancel.black.currentPlayerKey !== actorKey || afterCancel.white.currentPlayerKey !== actorKey) {
                throw new Error(`SACRIFICE_WILL cancel should keep the turn on ${actorKey}`);
            }

            await performTurnAction(actorPage, afterCancel[actorKey], actionLog, `${actorKey}_followup_after_cancel`);
            const syncedAfterMove = await waitForSynchronizedState(blackPage, whitePage, STATE_TIMEOUT_MS);
            actionLog.push({ type: 'after_black_followup', black: syncedAfterMove.black, white: syncedAfterMove.white });
            if (syncedAfterMove.black.currentPlayerKey !== nextPlayerKey || syncedAfterMove.white.currentPlayerKey !== nextPlayerKey) {
                throw new Error(`SACRIFICE_WILL follow-up move did not hand off to ${nextPlayerKey}`);
            }
        }
    }
};

if (!TARGET_CONFIGS[TARGET]) {
    throw new Error(`Unsupported TARGET: ${TARGET}`);
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeProgress(payload) {
    if (!PROGRESS_PATH) return;
    try {
        fs.writeFileSync(PROGRESS_PATH, JSON.stringify(Object.assign({
            target: TARGET,
            timestamp: new Date().toISOString()
        }, payload || {}), null, 2), 'utf8');
    } catch (e) {
        // best-effort only
    }
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

function buildTargetDeckCode(cardId) {
    const standardCardIds = DeckSpecHelpers.getStandardDeckCardIds();
    const filler = standardCardIds.filter((one) => one !== cardId);
    const deckCardIds = [cardId, cardId, cardId, ...filler.slice(0, 27)];
    const deckSpec = DeckSpecHelpers.createDeckSpecFromCardIds(deckCardIds);
    return DeckCodec.encodeDeckSpec(deckSpec);
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
            const hasPendingPresentation = !!(
                window.cardState
                && (
                    (Array.isArray(window.cardState.presentationEvents) && window.cardState.presentationEvents.length > 0)
                    || window.cardState._presentationEventsPersist
                )
            );
            return {
                VisualPlaybackActive: window.VisualPlaybackActive === true,
                isCardAnimating: window.isCardAnimating === true,
                isProcessing: window.isProcessing === true,
                movingCard,
                heldDrawCard,
                layerVisible,
                animationEnginePlaying,
                hasPendingPresentation,
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
                // fall through to direct busy check
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
    } catch (e) {
        // best-effort only
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
        } catch (e) {
            return false;
        }
    }, { timeout: 20000 });
}

async function getLiveState(page) {
    return page.evaluate(() => {
        function cloneBoard(board) {
            return Array.isArray(board) ? board.map((row) => Array.isArray(row) ? row.slice() : []) : [];
        }

        function normalizePlayerKey(value) {
            return (value === -1 || value === 'white' || value === '-1') ? 'white' : 'black';
        }

        const currentPlayerValue = window.gameState ? window.gameState.currentPlayer : null;
        const currentPlayerKey = normalizePlayerKey(currentPlayerValue);
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
            busy: {
                VisualPlaybackActive: window.VisualPlaybackActive === true,
                isProcessing: window.isProcessing === true,
                isCardAnimating: window.isCardAnimating === true,
                animationEnginePlaying: !!(window.AnimationEngine && window.AnimationEngine.isPlaying === true),
                playbackStartedAt: Number.isFinite(Number(window.__playbackActiveSince))
                    ? Number(window.__playbackActiveSince)
                    : null,
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
            })()
        };
    });
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
            && pendingHash(black.pending) === pendingHash(white.pending)
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
    if (Array.isArray(state.legalMoves) && state.legalMoves.length > 0) {
        const move = chooseMove(state.legalMoves);
        if (!move) {
            throw new Error(`${label || 'turn action'} could not choose a legal move`);
        }
        actionLog.push({ type: label || 'place', row: move.row, col: move.col });
        await performPlacement(page, move.row, move.col);
        return;
    }
    actionLog.push({ type: label || 'pass' });
    await page.evaluate(() => {
        if (typeof window.passCurrentTurn === 'function') window.passCurrentTurn();
    });
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

async function useTargetCard(page, seatKey, cardId) {
    const before = await getLiveState(page);
    await waitForPlaybackIdle(page);

    const immediate = await page.evaluate(({ seatKey, cardId }) => {
        const useBtn = document.getElementById('use-card-btn');
        const selectedBeforeClick = window.cardState ? window.cardState.selectedCardId : null;
        window.onCardClick(cardId, seatKey);
        const selectedAfterClick = window.cardState ? window.cardState.selectedCardId : null;
        window.useSelectedCard();
        return {
            selectedBeforeClick,
            selectedAfterClick,
            selectedAfterUse: window.cardState ? window.cardState.selectedCardId : null,
            useButtonDisabled: !!(useBtn && useBtn.disabled),
            hasUsedAfterUse: !!(
                window.cardState
                && window.cardState.hasUsedCardThisTurnByPlayer
                && window.cardState.hasUsedCardThisTurnByPlayer[seatKey]
            ),
            chargeAfterUse: Number(
                window.cardState
                && window.cardState.charge
                && window.cardState.charge[seatKey]
            ) || 0,
            pendingAfterUse: (() => {
                const pending = window.cardState
                    && window.cardState.pendingEffectByPlayer
                    && window.cardState.pendingEffectByPlayer[seatKey];
                return pending ? JSON.parse(JSON.stringify(pending)) : null;
            })()
        };
    }, { seatKey, cardId });

    const startedAt = Date.now();
    let after = await getLiveState(page);
    const beforeHandIds = Array.isArray(before.hand) ? before.hand.map((entry) => entry && entry.id).filter(Boolean) : [];
    while ((Date.now() - startedAt) < TARGET_PROGRESS_TIMEOUT_MS) {
        const afterHandIds = Array.isArray(after.hand) ? after.hand.map((entry) => entry && entry.id).filter(Boolean) : [];
        const localProgress = !!(
            after.hasUsedCardThisTurn === true
            || after.charge !== before.charge
            || !!after.pending
            || beforeHandIds.join('|') !== afterHandIds.join('|')
        );
        if (localProgress) {
            return { before, immediate, after };
        }
        await wait(100);
        after = await getLiveState(page);
    }

    const error = new Error(`useTargetCard made no local progress for ${cardId}`);
    error.before = before;
    error.immediate = immediate;
    error.after = after;
    throw error;
}

async function resolvePendingSelection(actorPage, actorSeatKey, blackPage, whitePage, config, actionLog) {
    writeProgress({ phase: 'wait_pending_selection', actorSeatKey, pendingType: config.pendingType });
    const initial = await waitForCondition(
        blackPage,
        whitePage,
        (black, white) => {
            const bPending = black.pendingByPlayer && black.pendingByPlayer[actorSeatKey];
            const wPending = white.pendingByPlayer && white.pendingByPlayer[actorSeatKey];
            return !!(bPending && wPending && bPending.type === config.pendingType && wPending.type === config.pendingType);
        },
        STATE_TIMEOUT_MS,
        `wait for ${config.pendingType} pending selection`
    );
    actionLog.push({ type: 'pending_ready', black: initial.black, white: initial.white });

    const actorState = actorSeatKey === 'white' ? initial.white : initial.black;
    const beforePendingHash = pendingHash(actorState.pending);
    const beforeTurnIndex = actorState.turnIndex;
    const beforeTurnNumber = actorState.turnNumber;
    const beforeBoardHash = boardHash(actorState.board);
    const candidates = config.pickCandidates(actorState);
    if (!Array.isArray(candidates) || candidates.length <= 0) {
        throw new Error(`No candidate cells found for ${config.pendingType}`);
    }

    let lastStates = initial;
    for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        writeProgress({ phase: 'select_target_attempt', actorSeatKey, pendingType: config.pendingType, candidate, attemptIndex: index + 1 });
        actionLog.push({ type: 'select_target_attempt', actorSeatKey, candidate });
        await performPlacement(actorPage, candidate.row, candidate.col);
        try {
            lastStates = await waitForCondition(
                blackPage,
                whitePage,
                (black, white) => {
                    const progress = (
                        pendingHash(black.pending) !== beforePendingHash
                        || pendingHash(white.pending) !== beforePendingHash
                        || black.turnIndex !== beforeTurnIndex
                        || white.turnIndex !== beforeTurnIndex
                        || black.turnNumber !== beforeTurnNumber
                        || white.turnNumber !== beforeTurnNumber
                        || boardHash(black.board) !== beforeBoardHash
                        || boardHash(white.board) !== beforeBoardHash
                    );
                    return progress;
                },
                TARGET_PROGRESS_TIMEOUT_MS,
                `wait for ${config.pendingType} target selection progress`
            );
            actionLog.push({ type: 'select_target_progress', candidate, black: lastStates.black, white: lastStates.white });
            return lastStates;
        } catch (error) {
            actionLog.push({
                type: 'select_target_rejected',
                candidate,
                lastStates: error && error.lastStates ? error.lastStates : null
            });
        }
    }

    const error = new Error(`Unable to resolve ${config.pendingType} with available candidate cells`);
    error.lastStates = lastStates;
    throw error;
}

async function runAttempt(browser, config, attemptIndex) {
    const blackContext = await browser.newContext({ viewport: VIEWPORT });
    const whiteContext = await browser.newContext({ viewport: VIEWPORT });
    const blackPage = await blackContext.newPage();
    const whitePage = await whiteContext.newPage();
    const actionLog = [];
    const deckCode = buildTargetDeckCode(config.cardId);
    const attempt = {
        attempt: attemptIndex,
        ok: false,
        roomId: null,
        actionLog,
        error: null,
        final: null
    };

    try {
        writeProgress({ phase: 'attempt_start', attemptIndex, cardId: config.cardId, pendingType: config.pendingType });
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

        for (let actionIndex = 0; actionIndex < MAX_ACTIONS; actionIndex += 1) {
            const synced = await waitForSynchronizedState(blackPage, whitePage, STATE_TIMEOUT_MS);
            actionLog.push({ type: 'synced_state', index: actionIndex, black: synced.black, white: synced.white });
            writeProgress({
                phase: 'synced_state',
                attemptIndex,
                actionIndex,
                black: {
                    currentPlayerKey: synced.black.currentPlayerKey,
                    canAct: synced.black.canAct,
                    charge: synced.black.charge,
                    hand: synced.black.hand,
                    pending: synced.black.pending,
                    busy: synced.black.busy
                },
                white: {
                    currentPlayerKey: synced.white.currentPlayerKey,
                    canAct: synced.white.canAct,
                    charge: synced.white.charge,
                    hand: synced.white.hand,
                    pending: synced.white.pending,
                    busy: synced.white.busy
                }
            });
            if (synced.black.gameOver || synced.white.gameOver) {
                throw new Error(`Game reached gameOver before ${config.cardId} became usable`);
            }

            const actorKey = ['black', 'white'].find((seatKey) => {
                const state = synced[seatKey];
                const targetCard = Array.isArray(state && state.hand)
                    ? state.hand.find((entry) => entry && entry.id === config.cardId)
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
                await Promise.all([waitForPlaybackIdle(blackPage), waitForPlaybackIdle(whitePage)]);

                const idleSynced = await waitForSynchronizedState(blackPage, whitePage, STATE_TIMEOUT_MS);
                const idleActorKey = ['black', 'white'].find((seatKey) => {
                    const state = idleSynced[seatKey];
                    const targetCard = Array.isArray(state && state.hand)
                        ? state.hand.find((entry) => entry && entry.id === config.cardId)
                        : null;
                    return !!(
                        state
                        && state.canAct === true
                        && targetCard
                        && targetCard.canUse === true
                        && state.hasUsedCardThisTurn !== true
                    );
                });

                if (!idleActorKey) {
                    actionLog.push({ type: 'target_card_lost_before_use', black: idleSynced.black, white: idleSynced.white });
                    continue;
                }

                const actorPage = idleActorKey === 'white' ? whitePage : blackPage;
                const actorState = idleSynced[idleActorKey];
                const actorTargetCard = actorState.hand.find((entry) => entry && entry.id === config.cardId);
                writeProgress({ phase: 'use_target_card', attemptIndex, actionIndex, actorKey, card: actorTargetCard, state: actorState });
                actionLog.push({ type: 'use_target_card', actorKey: idleActorKey, card: actorTargetCard, state: actorState });
                const useResult = await useTargetCard(actorPage, idleActorKey, config.cardId);
                writeProgress({ phase: 'used_target_card', attemptIndex, actionIndex, actorKey: idleActorKey, cardId: config.cardId, after: useResult.after });
                actionLog.push({ type: 'used_target_card', actorKey: idleActorKey, before: useResult.before, immediate: useResult.immediate, after: useResult.after });
                await resolvePendingSelection(actorPage, idleActorKey, blackPage, whitePage, config, actionLog);
                await config.verifyResolution({ actorKey: idleActorKey, blackPage, whitePage, actionLog });
                attempt.ok = true;
                break;
            }

            const actingPage = synced.black.currentPlayerKey === 'white' ? whitePage : blackPage;
            const actingState = synced.black.currentPlayerKey === 'white' ? synced.white : synced.black;
            await performTurnAction(actingPage, actingState, actionLog, `${actingState.currentPlayerKey}_turn_${actionIndex}`);
            await Promise.all([waitForPlaybackIdle(blackPage), waitForPlaybackIdle(whitePage)]);
        }

        if (!attempt.ok) {
            throw new Error(`Target flow for ${config.cardId} was not exercised within ${MAX_ACTIONS} actions`);
        }
    } catch (error) {
        writeProgress({ phase: 'attempt_error', attemptIndex, error: error && error.stack ? error.stack : String(error) });
        attempt.error = error && error.stack ? error.stack : String(error);
    } finally {
        try {
            attempt.final = {
                black: await getLiveState(blackPage),
                white: await getLiveState(whitePage)
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
        } catch (e) { /* ignore */ }
        try {
            await whitePage.evaluate(async () => {
                if (window.NetworkMatchClient && typeof window.NetworkMatchClient.leaveRoom === 'function') {
                    await window.NetworkMatchClient.leaveRoom();
                }
            });
        } catch (e) { /* ignore */ }

        await blackContext.close();
        await whiteContext.close();
    }

    return attempt;
}

async function main() {
    const browser = await chromium.launch({ headless: true, channel: process.env.CHANNEL || undefined });
    const config = TARGET_CONFIGS[TARGET];
    const result = {
        ok: false,
        target: TARGET,
        cardId: config.cardId,
        pendingType: config.pendingType,
        baseUrl: BASE_URL,
        serverUrl: SERVER_URL,
        timestamp: new Date().toISOString(),
        attempts: []
    };

    try {
        for (let attemptIndex = 1; attemptIndex <= MAX_ATTEMPTS; attemptIndex += 1) {
            const attempt = await runAttempt(browser, config, attemptIndex);
            result.attempts.push(attempt);
            if (attempt.ok) {
                result.ok = true;
                break;
            }
        }
    } finally {
        await browser.close();
    }

    fs.writeFileSync(RESULT_PATH, JSON.stringify(result, null, 2), 'utf8');
    if (result.ok) {
        process.stdout.write(`selection card verification succeeded: ${RESULT_PATH}\n`);
        process.exit(0);
    }
    process.stderr.write(`selection card verification failed: ${RESULT_PATH}\n`);
    process.exit(1);
}

main().catch((error) => {
    const result = {
        ok: false,
        target: TARGET,
        cardId: TARGET_CONFIGS[TARGET] ? TARGET_CONFIGS[TARGET].cardId : null,
        pendingType: TARGET_CONFIGS[TARGET] ? TARGET_CONFIGS[TARGET].pendingType : null,
        baseUrl: BASE_URL,
        serverUrl: SERVER_URL,
        timestamp: new Date().toISOString(),
        fatalError: error && error.stack ? error.stack : String(error)
    };
    fs.writeFileSync(RESULT_PATH, JSON.stringify(result, null, 2), 'utf8');
    process.stderr.write(`selection card verification crashed: ${RESULT_PATH}\n`);
    process.exit(1);
});