(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.TutorialRuntimeModule = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const OBSERVER_CARD_ID = 'observer_01';
    const BOARD_SIZE = 8;

    function createEmptyBoard() {
        return Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
    }

    function createTutorialRuntime(options) {
        const opts = options && typeof options === 'object' ? options : {};
        const rootRef = opts.root || (typeof window !== 'undefined' ? window : globalThis);
        const blackValue = (typeof rootRef.BLACK !== 'undefined') ? rootRef.BLACK : 1;
        const whiteValue = (typeof rootRef.WHITE !== 'undefined') ? rootRef.WHITE : -1;

        let originalCpuHandlers = null;

        function isOpenPanel(element) {
            if (!element) return false;
            if (element.getAttribute('aria-hidden') === 'false') return true;
            return element.classList.contains('is-open');
        }

        function getStartAvailability() {
            const doc = rootRef && rootRef.document ? rootRef.document : null;
            if (!doc) return { ok: false, message: 'tutorial を開始できません' };

            const rulesHelpPanel = doc.getElementById('rules-help-panel');
            const networkOverlay = doc.getElementById('networkOverlay');
            const gachaOverlay = doc.getElementById('gachaOverlay');
            const leaderboardOverlay = doc.getElementById('leaderboardOverlay');
            const resultOverlay = doc.getElementById('result-overlay');

            if (isOpenPanel(rulesHelpPanel) || isOpenPanel(networkOverlay) || isOpenPanel(gachaOverlay) || isOpenPanel(leaderboardOverlay) || !!resultOverlay) {
                return {
                    ok: false,
                    message: 'help / ネット対戦設定 / ガチャ / ランキング / リザルトを閉じてから tutorial を開始してください'
                };
            }

            const mode = typeof rootRef.getCurrentMatchMode === 'function'
                ? rootRef.getCurrentMatchMode()
                : (rootRef.MATCH_MODE || rootRef.__MATCH_MODE || 'cpu');
            if (mode === 'network') {
                return {
                    ok: false,
                    message: 'ネット対戦中は tutorial を開始できません'
                };
            }

            if (rootRef.isProcessing === true || rootRef.isCardAnimating === true || rootRef.VisualPlaybackActive === true) {
                return {
                    ok: false,
                    message: '演出中は tutorial を開始できません'
                };
            }

            return { ok: true };
        }

        function waitFor(predicate, timeoutMs) {
            const timeout = Number.isFinite(Number(timeoutMs)) ? Math.max(100, Number(timeoutMs)) : 6000;
            const startedAt = Date.now();
            return new Promise((resolve, reject) => {
                const tick = () => {
                    let done = false;
                    try {
                        done = predicate() === true;
                    } catch (e) {
                        done = false;
                    }
                    if (done) {
                        resolve(true);
                        return;
                    }
                    if ((Date.now() - startedAt) >= timeout) {
                        reject(new Error('tutorial runtime wait timed out'));
                        return;
                    }
                    setTimeout(tick, 60);
                };
                tick();
            });
        }

        function emitRefresh() {
            let cardStateChangeRequested = false;
            try {
                if (typeof rootRef.emitCardStateChange === 'function') {
                    cardStateChangeRequested = rootRef.emitCardStateChange() === true;
                }
            } catch (e) { /* ignore */ }
            try {
                if (rootRef.BoardUpdateDispatch && typeof rootRef.BoardUpdateDispatch.requestBoardUpdate === 'function') {
                    rootRef.BoardUpdateDispatch.requestBoardUpdate({
                        emitBoardUpdate: rootRef.emitBoardUpdate,
                        renderBoard: rootRef.renderBoard
                    });
                } else if (typeof rootRef.emitBoardUpdate === 'function') {
                    rootRef.emitBoardUpdate();
                }
            } catch (e) { /* ignore */ }
            try { if (typeof rootRef.emitGameStateChange === 'function') rootRef.emitGameStateChange(); } catch (e) { /* ignore */ }
            try {
                if (!cardStateChangeRequested) {
                    if (typeof rootRef.requestCardUiSync === 'function') rootRef.requestCardUiSync('tutorial-runtime:refresh');
                    else if (typeof rootRef.renderCardUI === 'function') rootRef.renderCardUI();
                }
            } catch (e) { /* ignore */ }
            try { if (typeof rootRef.updateCardDetailPanel === 'function') rootRef.updateCardDetailPanel(); } catch (e) { /* ignore */ }
            try { if (typeof rootRef.updateStatus === 'function') rootRef.updateStatus(); } catch (e) { /* ignore */ }
        }

        function isVisualIdle() {
            return !(
                rootRef &&
                (
                    rootRef.isProcessing === true
                    || rootRef.isCardAnimating === true
                    || rootRef.VisualPlaybackActive === true
                )
            );
        }

        function waitForVisualIdle(timeoutMs) {
            return waitFor(() => isVisualIdle(), timeoutMs || 2000).catch(() => true);
        }

        function abortVisualPlayback() {
            try {
                if (
                    rootRef &&
                    rootRef.AnimationEngine &&
                    typeof rootRef.AnimationEngine.abortAndSync === 'function'
                ) {
                    rootRef.AnimationEngine.abortAndSync();
                }
            } catch (e) { /* ignore */ }
            try { rootRef.VisualPlaybackActive = false; } catch (e) { /* ignore */ }
            try { rootRef.__playbackActiveSince = null; } catch (e) { /* ignore */ }
            try { rootRef.__drawHandAnimActive = false; } catch (e) { /* ignore */ }
        }

        function forceBoardSync() {
            const doc = rootRef && rootRef.document ? rootRef.document : null;
            const boardEl = doc ? doc.getElementById('board') : null;
            if (!boardEl) return false;
            try {
                if (typeof rootRef.forceFullRender === 'function') {
                    rootRef.forceFullRender(boardEl);
                    return true;
                }
            } catch (e) { /* ignore */ }
            try {
                if (rootRef.BoardUpdateDispatch && typeof rootRef.BoardUpdateDispatch.requestBoardUpdate === 'function') {
                    rootRef.BoardUpdateDispatch.requestBoardUpdate({
                        emitBoardUpdate: rootRef.emitBoardUpdate,
                        renderBoard: rootRef.renderBoard
                    });
                    return true;
                }
                if (typeof rootRef.renderBoard === 'function') {
                    rootRef.renderBoard();
                    return true;
                }
            } catch (e) { /* ignore */ }
            return false;
        }

        async function resetGameAndWait(options) {
            const opts = options && typeof options === 'object' ? options : {};
            if (typeof opts.beforeReset === 'function') {
                opts.beforeReset();
            }
            if (typeof rootRef.resetGame !== 'function') {
                if (typeof opts.afterReset === 'function') {
                    opts.afterReset();
                }
                return false;
            }
            abortVisualPlayback();
            rootRef.resetGame();
            await waitForResetReady();
            if (typeof opts.afterReset === 'function') {
                opts.afterReset();
            }
            return true;
        }

        async function syncTutorialVisualState() {
            await waitForVisualIdle(1800);
            emitRefresh();
            await new Promise((resolve) => setTimeout(resolve, 0));
            forceBoardSync();
            emitRefresh();
        }

        function getCardContext() {
            try {
                if (rootRef.CardLogic && typeof rootRef.CardLogic.getCardContext === 'function' && rootRef.cardState) {
                    return rootRef.CardLogic.getCardContext(rootRef.cardState);
                }
            } catch (e) { /* ignore */ }
            return { protectedStones: [], permaProtectedStones: [], bombs: [] };
        }

        function getLegalMovesForPlayer(playerValue) {
            const gameState = rootRef.gameState;
            if (!gameState) return [];
            const context = getCardContext();
            try {
                if (rootRef.CoreLogic && typeof rootRef.CoreLogic.getLegalMoves === 'function') {
                    return rootRef.CoreLogic.getLegalMoves(gameState, playerValue, context) || [];
                }
            } catch (e) { /* ignore */ }
            try {
                if (typeof rootRef.getLegalMoves === 'function') {
                    const previous = gameState.currentPlayer;
                    gameState.currentPlayer = playerValue;
                    const moves = rootRef.getLegalMoves(gameState, context.protectedStones, context.permaProtectedStones) || [];
                    gameState.currentPlayer = previous;
                    return moves;
                }
            } catch (e) { /* ignore */ }
            return [];
        }

        function clearCardSelections() {
            const cardState = rootRef.cardState;
            if (!cardState || typeof cardState !== 'object') return;
            cardState.selectedCardId = null;
            cardState.selectedCardOwnerKey = null;
        }

        function clearPresentationBuffers() {
            const cardState = rootRef.cardState;
            if (!cardState || typeof cardState !== 'object') return;
            if (Array.isArray(cardState.presentationEvents)) {
                cardState.presentationEvents = [];
            }
            if (Array.isArray(cardState._presentationEventsPersist)) {
                cardState._presentationEventsPersist = [];
            }
        }

        function resetActionState() {
            const cardState = rootRef.cardState;
            if (cardState && typeof cardState === 'object') {
                cardState.turnIndex = 0;
                if (cardState.lastUsedCardByPlayer && typeof cardState.lastUsedCardByPlayer === 'object') {
                    cardState.lastUsedCardByPlayer.black = null;
                    cardState.lastUsedCardByPlayer.white = null;
                }
            }
            try {
                if (
                    rootRef.ActionManager &&
                    rootRef.ActionManager.ActionManager &&
                    typeof rootRef.ActionManager.ActionManager.reset === 'function'
                ) {
                    rootRef.ActionManager.ActionManager.reset();
                }
            } catch (e) { /* ignore */ }
        }

        function ensureObserverCardInHand() {
            const cardState = rootRef.cardState;
            if (!cardState || !cardState.hands || !Array.isArray(cardState.hands.black)) return false;
            if (!cardState.hands.black.includes(OBSERVER_CARD_ID)) {
                cardState.hands.black.unshift(OBSERVER_CARD_ID);
            }
            return true;
        }

        function clearBoardBonuses() {
            const cardState = rootRef.cardState;
            if (!cardState || typeof cardState !== 'object') return;
            cardState.boardBonusByCell = {};
            cardState.boardBonusConsumedByCell = {};
        }

        function ensureBlackTurn() {
            const gameState = rootRef.gameState;
            const cardState = rootRef.cardState;
            if (!gameState || !cardState) return;
            gameState.currentPlayer = blackValue;
            gameState.consecutivePasses = 0;
            cardState.hasUsedCardThisTurnByPlayer.black = false;
            cardState.hasUsedCardThisTurnByPlayer.white = false;
            cardState.hasDestroyedCardThisTurnByPlayer.black = false;
            cardState.hasDestroyedCardThisTurnByPlayer.white = false;
            cardState.pendingEffectByPlayer.black = null;
            cardState.pendingEffectByPlayer.white = null;
            clearCardSelections();
        }

        function rebuildStoneIdMapFromBoard() {
            const gameState = rootRef.gameState;
            const cardState = rootRef.cardState;
            if (!gameState || !cardState || !Array.isArray(gameState.board)) return;
            const map = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
            let nextStoneId = 1;
            for (let row = 0; row < BOARD_SIZE; row += 1) {
                for (let col = 0; col < BOARD_SIZE; col += 1) {
                    if (gameState.board[row][col] !== 0) {
                        map[row][col] = `s${nextStoneId++}`;
                    }
                }
            }
            cardState.stoneIdMap = map;
            cardState._nextStoneId = nextStoneId;
            cardState.markers = [];
            cardState.expansionStoneIdByCell = {};
        }

        function applyBoardSnapshot(snapshot) {
            const gameState = rootRef.gameState;
            const cardState = rootRef.cardState;
            if (!gameState || !cardState) return;
            const board = snapshot && Array.isArray(snapshot.board) ? snapshot.board : null;
            if (!board) return;
            gameState.board = board.map((row) => row.slice());
            gameState.currentPlayer = snapshot.currentPlayer === whiteValue ? whiteValue : blackValue;
            gameState.consecutivePasses = Number(snapshot.consecutivePasses) || 0;
            gameState.turnNumber = Number.isFinite(Number(snapshot.turnNumber))
                ? Math.max(0, Math.trunc(Number(snapshot.turnNumber)))
                : 0;
            gameState.boardExpansion = snapshot.boardExpansion || null;
            clearBoardBonuses();
            cardState.pendingEffectByPlayer.black = null;
            cardState.pendingEffectByPlayer.white = null;
            cardState.hasUsedCardThisTurnByPlayer.black = false;
            cardState.hasUsedCardThisTurnByPlayer.white = false;
            cardState.hasDestroyedCardThisTurnByPlayer.black = false;
            cardState.hasDestroyedCardThisTurnByPlayer.white = false;
            if (cardState.lastUsedCardByPlayer && typeof cardState.lastUsedCardByPlayer === 'object') {
                cardState.lastUsedCardByPlayer.black = null;
                cardState.lastUsedCardByPlayer.white = null;
            }
            clearPresentationBuffers();
            resetActionState();
            clearCardSelections();
            rebuildStoneIdMapFromBoard();
        }

        function createStandardBoardSnapshot() {
            let fresh = null;
            try {
                if (typeof rootRef.createGameState === 'function') fresh = rootRef.createGameState();
            } catch (e) { /* ignore */ }
            if (!fresh) {
                fresh = {
                    board: createEmptyBoard(),
                    currentPlayer: blackValue,
                    consecutivePasses: 0,
                    turnNumber: 0,
                    boardExpansion: null
                };
                fresh.board[3][3] = whiteValue;
                fresh.board[3][4] = blackValue;
                fresh.board[4][3] = blackValue;
                fresh.board[4][4] = whiteValue;
            }
            return {
                board: fresh.board,
                currentPlayer: blackValue,
                consecutivePasses: 0,
                turnNumber: 0,
                boardExpansion: fresh.boardExpansion || null
            };
        }

        function applyStandardBoardSnapshot() {
            applyBoardSnapshot(createStandardBoardSnapshot());
        }

        function chooseNumericTarget() {
            const legalMoves = getLegalMovesForPlayer(blackValue);
            if (!Array.isArray(legalMoves) || legalMoves.length === 0) return null;
            return legalMoves[0];
        }

        async function resetTutorialBoardState() {
            setHumanDebugFlagsForTutorial();
            suppressCpuTurns();
            await resetGameAndWait({ afterReset: suppressCpuTurns });
            resetActionState();
            clearPresentationBuffers();
            await waitForVisualIdle(1800);
        }

        async function prepareNumericDemo(stateApi) {
            await resetTutorialBoardState();
            applyStandardBoardSnapshot();
            ensureBlackTurn();
            clearBoardBonuses();
            const target = chooseNumericTarget();
            if (!target) {
                if (stateApi && typeof stateApi.setFlag === 'function') {
                    stateApi.setFlag('numericTargetCell', null);
                }
                await syncTutorialVisualState();
                return null;
            }
            rootRef.cardState.boardBonusByCell[`${target.row},${target.col}`] = 2;
            if (stateApi && typeof stateApi.setFlag === 'function') {
                stateApi.setFlag('numericTargetCell', { row: target.row, col: target.col });
            }
            await syncTutorialVisualState();
            return target;
        }

        async function prepareObserverUseDemo() {
            await resetTutorialBoardState();
            ensureBlackTurn();
            ensureObserverCardInHand();
            clearBoardBonuses();
            const legalMoves = getLegalMovesForPlayer(blackValue);
            if (!legalMoves.length) {
                applyStandardBoardSnapshot();
            }
            rootRef.cardState.charge.black = Math.max(1, Number(rootRef.cardState.charge.black) || 0);
            rootRef.cardState.lastUsedCardByPlayer.black = null;
            rootRef.cardState.pendingEffectByPlayer.black = null;
            rootRef.cardState.hasUsedCardThisTurnByPlayer.black = false;
            clearCardSelections();
            await syncTutorialVisualState();
        }

        async function ensureObserverCardReady() {
            ensureObserverCardInHand();
            clearCardSelections();
            await syncTutorialVisualState();
        }

        function waitForResetReady() {
            return waitFor(() => {
                const gameState = rootRef.gameState;
                const cardState = rootRef.cardState;
                return !!(
                    gameState &&
                    cardState &&
                    isVisualIdle() &&
                    cardState.hands &&
                    Array.isArray(cardState.hands.black)
                );
            }, 8000).catch(() => true);
        }

        function suppressCpuTurns() {
            if (!originalCpuHandlers) {
                originalCpuHandlers = {
                    processCpuTurn: rootRef.processCpuTurn,
                    processAutoBlackTurn: rootRef.processAutoBlackTurn
                };
            }
            if (typeof rootRef.processCpuTurn === 'function') {
                rootRef.processCpuTurn = function () { return undefined; };
            }
            if (typeof rootRef.processAutoBlackTurn === 'function') {
                rootRef.processAutoBlackTurn = function () { return undefined; };
            }
        }

        function restoreCpuTurns() {
            if (!originalCpuHandlers) return;
            if (originalCpuHandlers.processCpuTurn) rootRef.processCpuTurn = originalCpuHandlers.processCpuTurn;
            if (originalCpuHandlers.processAutoBlackTurn) rootRef.processAutoBlackTurn = originalCpuHandlers.processAutoBlackTurn;
            originalCpuHandlers = null;
        }

        function setHumanDebugFlagsForTutorial() {
            try { rootRef.DEBUG_HUMAN_VS_HUMAN = false; } catch (e) { /* ignore */ }
        }

        async function startMainTutorial() {
            setHumanDebugFlagsForTutorial();
            suppressCpuTurns();
            await resetGameAndWait();
            await ensureObserverCardReady();
        }

        async function completeMainTutorial() {
            restoreCpuTurns();
            await resetGameAndWait();
        }

        function updateCpuLabel() {
            try { if (typeof rootRef.updateCpuCharacter === 'function') rootRef.updateCpuCharacter(); } catch (e) { /* ignore */ }
        }

        return {
            root: rootRef,
            blackValue,
            whiteValue,
            getStartAvailability,
            startMainTutorial,
            completeMainTutorial,
            ensureObserverCardReady,
            prepareNumericDemo,
            prepareObserverUseDemo,
            suppressCpuTurns,
            restoreCpuTurns,
            ensureObserverCardInHand,
            ensureBlackTurn,
            applyStandardBoardSnapshot,
            emitRefresh,
            waitForResetReady,
            resetGameAndWait,
            updateCpuLabel
        };
    }

    return {
        createTutorialRuntime
    };
}));
