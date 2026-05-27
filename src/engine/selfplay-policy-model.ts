/* eslint-disable @typescript-eslint/no-explicit-any */

type SelfplayPolicyModelConfig = {
    SharedBoardUtils?: any;
    CpuPolicyTableRuntime?: any;
    CpuLv6LookaheadProfile?: any;
    selfplaySchemaVersion?: string;
    legacySelfplaySchemaVersion?: string;
    getSelfplayBoard?: (gameState: any, cardState?: any) => any;
    encodeBoard?: (board: any) => string;
    canonicalizeBoard?: (board: any) => any;
    transformCoord?: (row: any, col: any, size: any, transformId: any) => any;
    countEmpties?: (board: any) => number;
    countDiscDiffOnBoard?: (board: any, playerValue: any) => number;
    toPlayerValue?: (playerKey: any) => any;
    countCorners?: (board: any, playerValue: any) => number;
};

function fallbackBoardKey() {
    return '';
}

function fallbackCanonicalizeBoard(board: any) {
    return {
        boardKey: Array.isArray(board) ? '' : String(board || ''),
        transformId: 0
    };
}

function fallbackTransformCoord(row: any, col: any) {
    return { row, col };
}

export function createSelfplayPolicyModel(config?: SelfplayPolicyModelConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as SelfplayPolicyModelConfig;
    const sharedBoardUtils = cfg.SharedBoardUtils || null;
    const cpuPolicyTableRuntime = cfg.CpuPolicyTableRuntime || null;
    const cpuLv6LookaheadProfile = cfg.CpuLv6LookaheadProfile || null;
    const selfplaySchemaVersion = typeof cfg.selfplaySchemaVersion === 'string' && cfg.selfplaySchemaVersion
        ? cfg.selfplaySchemaVersion
        : 'selfplay.v2';
    const legacySelfplaySchemaVersion = typeof cfg.legacySelfplaySchemaVersion === 'string' && cfg.legacySelfplaySchemaVersion
        ? cfg.legacySelfplaySchemaVersion
        : 'selfplay.v1';
    const getSelfplayBoard = typeof cfg.getSelfplayBoard === 'function' ? cfg.getSelfplayBoard : (() => []);
    const encodeBoard = typeof cfg.encodeBoard === 'function' ? cfg.encodeBoard : fallbackBoardKey;
    const canonicalizeBoard = typeof cfg.canonicalizeBoard === 'function' ? cfg.canonicalizeBoard : fallbackCanonicalizeBoard;
    const transformCoord = typeof cfg.transformCoord === 'function' ? cfg.transformCoord : fallbackTransformCoord;
    const countEmpties = typeof cfg.countEmpties === 'function' ? cfg.countEmpties : (() => 0);
    const countDiscDiffOnBoard = typeof cfg.countDiscDiffOnBoard === 'function' ? cfg.countDiscDiffOnBoard : (() => 0);
    const toPlayerValue = typeof cfg.toPlayerValue === 'function'
        ? cfg.toPlayerValue
        : ((playerKey: any) => playerKey === 'black' ? 1 : -1);
    const countCorners = typeof cfg.countCorners === 'function' ? cfg.countCorners : (() => 0);

    function isSupportedSchema(schemaVersion: any) {
        return (
            schemaVersion === selfplaySchemaVersion ||
            schemaVersion === legacySelfplaySchemaVersion ||
            schemaVersion === 'policy_table.v1' ||
            schemaVersion === 'policy_table.v2'
        );
    }

    function makePolicyStateKey(playerKey: any, boardOrBoardKey: any, pendingType: any, legalMovesCount: any) {
        const pending = pendingType || '-';
        const legal = Number.isFinite(legalMovesCount) ? legalMovesCount : 0;
        const boardKey = typeof boardOrBoardKey === 'string'
            ? boardOrBoardKey
            : encodeBoard(boardOrBoardKey);
        return `${playerKey}|${boardKey}|${pending}|${legal}`;
    }

    function makePolicyActionKey(move: any) {
        if (!move || !Number.isFinite(move.row) || !Number.isFinite(move.col)) return '';
        return `place:${move.row}:${move.col}`;
    }

    function cellType(row: any, col: any, boardOrSize: any) {
        if (sharedBoardUtils && typeof sharedBoardUtils.getCellType === 'function') {
            if (Array.isArray(boardOrSize)) return sharedBoardUtils.getCellType(row, col, boardOrSize);
            const n = Number.isFinite(boardOrSize) && boardOrSize > 0 ? boardOrSize : 8;
            return sharedBoardUtils.getCellType(row, col, n, n);
        }
        const n = Number.isFinite(boardOrSize) && boardOrSize > 0 ? boardOrSize : 8;
        if ((row === 0 || row === n - 1) && (col === 0 || col === n - 1)) return 'corner';
        if ((row === 1 || row === n - 2) && (col === 1 || col === n - 2)) return 'x';
        const nearTB = (row === 0 || row === n - 1) && (col === 1 || col === n - 2);
        const nearLR = (col === 0 || col === n - 1) && (row === 1 || row === n - 2);
        if (nearTB || nearLR) return 'c';
        if (row === 0 || row === n - 1 || col === 0 || col === n - 1) return 'edge';
        return 'inner';
    }

    function makePolicyAbstractActionKey(move: any, boardShapeOrSize: any) {
        if (!move || !Number.isFinite(move.row) || !Number.isFinite(move.col)) return 'place_cat:unknown';
        return `place_cat:${cellType(move.row, move.col, boardShapeOrSize)}`;
    }

    function countEmptiesInBoardKey(boardKey: any) {
        if (typeof boardKey !== 'string' || !boardKey) return 0;
        let count = 0;
        for (let i = 0; i < boardKey.length; i++) {
            if (boardKey[i] === '.') count += 1;
        }
        return count;
    }

    function discDiffFromPlayer(boardKey: any, playerKey: any) {
        if (typeof boardKey !== 'string') return 0;
        let black = 0;
        let white = 0;
        for (let i = 0; i < boardKey.length; i++) {
            if (boardKey[i] === 'B') black += 1;
            if (boardKey[i] === 'W') white += 1;
        }
        return playerKey === 'black' ? (black - white) : (white - black);
    }

    function cornerDiffFromPlayer(boardKey: any, playerKey: any) {
        const rows = typeof boardKey === 'string' ? boardKey.split('/') : [];
        if (!rows.length) return 0;
        const size = rows.length;
        const own = playerKey === 'black' ? 'B' : 'W';
        const opp = own === 'B' ? 'W' : 'B';
        const corners = [[0, 0], [0, size - 1], [size - 1, 0], [size - 1, size - 1]];
        let ownCount = 0;
        let oppCount = 0;
        for (const point of corners) {
            const cell = rows[point[0]] && rows[point[0]][point[1]];
            if (cell === own) ownCount += 1;
            else if (cell === opp) oppCount += 1;
        }
        return ownCount - oppCount;
    }

    function toBucket(value: any, steps: any[]) {
        for (let i = 0; i < steps.length; i++) {
            if (value <= steps[i]) return String(steps[i]);
        }
        return `>${steps[steps.length - 1]}`;
    }

    function makePolicyAbstractStateKey(playerKey: any, board: any, pendingType: any, legalMovesCount: any) {
        const pending = pendingType || '-';
        const legal = Number.isFinite(legalMovesCount) ? legalMovesCount : 0;
        const boardKey = typeof board === 'string' ? board : '';
        const empties = Array.isArray(board) ? countEmpties(board) : countEmptiesInBoardKey(boardKey);
        const phase = empties >= 44 ? 'opening' : (empties >= 16 ? 'mid' : 'end');
        const mobility = toBucket(legal, [0, 2, 4, 6, 10, 20]);
        const disc = toBucket(
            Array.isArray(board)
                ? countDiscDiffOnBoard(board, toPlayerValue(playerKey))
                : discDiffFromPlayer(boardKey, playerKey),
            [-20, -10, -4, 0, 4, 10, 20]
        );
        const corner = toBucket(
            Array.isArray(board)
                ? countCorners(board, toPlayerValue(playerKey))
                : cornerDiffFromPlayer(boardKey, playerKey),
            [-4, -2, -1, 0, 1, 2, 4]
        );
        return `${playerKey}|${pending}|${phase}|mob:${mobility}|disc:${disc}|corner:${corner}`;
    }

    function getPolicyScore(options: any, context: any, move: any) {
        if (!options || !options.policyTableModel || !options.policyTableModel.states) return null;
        const model = options.policyTableModel;
        const runtimeBoard = getSelfplayBoard(context && context.gameState, context && context.cardState);
        if (!isSupportedSchema(model.schemaVersion)) return null;

        if (
            model.schemaVersion !== selfplaySchemaVersion &&
            model.schemaVersion !== legacySelfplaySchemaVersion &&
            cpuPolicyTableRuntime &&
            typeof cpuPolicyTableRuntime.getActionScoreFromModel === 'function'
        ) {
            const score = cpuPolicyTableRuntime.getActionScoreFromModel(model, move, {
                playerKey: context.playerKey,
                level: 6,
                board: runtimeBoard,
                pendingType: context.pendingType || null,
                legalMovesCount: context.legalMovesCount
            });
            if (Number.isFinite(score)) return Number(score);
        }

        const schema = model.schemaVersion || 'policy_table.v1';
        const canonical = schema === 'policy_table.v2'
            ? canonicalizeBoard(runtimeBoard)
            : { boardKey: encodeBoard(runtimeBoard), transformId: 0 };
        const key = makePolicyStateKey(
            context.playerKey,
            canonical.boardKey,
            context.pendingType || '-',
            context.legalMovesCount
        );
        let state = model.states[key];
        let isAbstract = false;
        if ((!state || !state.actions) && model.abstractStates && typeof model.abstractStates === 'object') {
            const abstractKey = makePolicyAbstractStateKey(
                context.playerKey,
                runtimeBoard,
                context.pendingType || '-',
                context.legalMovesCount
            );
            state = model.abstractStates[abstractKey];
            isAbstract = !!state;
        }
        if (!state || !state.actions) return null;

        const actionKey = (() => {
            if (isAbstract) return makePolicyAbstractActionKey(move, runtimeBoard);
            if (schema !== 'policy_table.v2') return makePolicyActionKey(move);
            if (sharedBoardUtils && typeof sharedBoardUtils.makeCanonicalActionKey === 'function') {
                return sharedBoardUtils.makeCanonicalActionKey(move, runtimeBoard, canonical.transformId);
            }
            const boardSize = context && context.gameState && Array.isArray(context.gameState.board)
                ? context.gameState.board.length
                : 8;
            const mapped = transformCoord(move.row, move.col, boardSize, canonical.transformId);
            return `place:${mapped.row}:${mapped.col}`;
        })();
        const stat = state.actions[actionKey];
        if (!stat) return null;
        const visits = Number.isFinite(stat.visits) ? stat.visits : 0;
        const avgOutcome = Number.isFinite(stat.avgOutcome) ? stat.avgOutcome : 0;
        const bestBonus = state.bestAction === actionKey ? (isAbstract ? 50 : 100) : 0;
        const visitBonus = Math.log1p(Math.max(0, visits)) * 15;
        const outcomeBonus = avgOutcome * 80;
        return bestBonus + visitBonus + outcomeBonus;
    }

    function getPolicyActionScoreByKey(options: any, context: any, actionKey: any) {
        if (!options || !options.policyTableModel || !options.policyTableModel.states) return null;
        if (!actionKey || typeof actionKey !== 'string') return null;
        const model = options.policyTableModel;
        if (!isSupportedSchema(model.schemaVersion)) return null;

        const schema = model.schemaVersion || 'policy_table.v1';
        const runtimeBoard = getSelfplayBoard(context && context.gameState, context && context.cardState);
        const canonical = schema === 'policy_table.v2'
            ? canonicalizeBoard(runtimeBoard)
            : { boardKey: encodeBoard(runtimeBoard), transformId: 0 };
        const key = makePolicyStateKey(
            context.playerKey,
            canonical.boardKey,
            context.pendingType || '-',
            context.legalMovesCount
        );
        let state = model.states[key];
        if ((!state || !state.actions) && model.abstractStates && typeof model.abstractStates === 'object') {
            const abstractKey = makePolicyAbstractStateKey(
                context.playerKey,
                runtimeBoard,
                context.pendingType || '-',
                context.legalMovesCount
            );
            state = model.abstractStates[abstractKey];
        }
        if (!state || !state.actions) return null;

        const stat = state.actions[actionKey];
        if (!stat) return null;
        const visits = Number.isFinite(stat.visits) ? stat.visits : 0;
        const avgOutcome = Number.isFinite(stat.avgOutcome) ? stat.avgOutcome : 0;
        const bestBonus = state.bestAction === actionKey ? 1_000_000 : 0;
        return bestBonus + visits * 1_000 + avgOutcome;
    }

    function createPolicyRuntimeContext(context: any, legalMovesCountOverride: any) {
        return {
            playerKey: context && context.playerKey === 'black' ? 'black' : 'white',
            level: 6,
            board: getSelfplayBoard(context && context.gameState, context && context.cardState),
            pendingType: context && context.pendingType ? context.pendingType : null,
            legalMovesCount: Number.isFinite(legalMovesCountOverride)
                ? Number(legalMovesCountOverride)
                : (Number.isFinite(context && context.legalMovesCount) ? Number(context.legalMovesCount) : 0)
        };
    }

    function selectPlacementMoveFromPolicyModel(options: any, context: any, candidateMoves: any) {
        if (!options || !options.policyTableModel || !Array.isArray(candidateMoves) || candidateMoves.length <= 0) return null;
        if (
            options.policyTableModel.schemaVersion !== selfplaySchemaVersion &&
            options.policyTableModel.schemaVersion !== legacySelfplaySchemaVersion &&
            cpuPolicyTableRuntime &&
            typeof cpuPolicyTableRuntime.chooseMoveFromModel === 'function'
        ) {
            const selected = cpuPolicyTableRuntime.chooseMoveFromModel(
                options.policyTableModel,
                candidateMoves,
                createPolicyRuntimeContext(context, candidateMoves.length)
            );
            if (
                cpuLv6LookaheadProfile &&
                typeof cpuLv6LookaheadProfile.resolveCandidateMoveByCoord === 'function'
            ) {
                return cpuLv6LookaheadProfile.resolveCandidateMoveByCoord(candidateMoves, selected) || selected;
            }
            return selected;
        }

        let bestMove = null;
        let bestScore = Number.NEGATIVE_INFINITY;
        for (const move of candidateMoves) {
            const rawScore = getPolicyScore(options, Object.assign({}, context || {}, {
                legalMovesCount: candidateMoves.length
            }), move);
            const score = Number(rawScore);
            if (!Number.isFinite(score)) continue;
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
                continue;
            }
            if (score === bestScore && bestMove) {
                const bestRow = Number(bestMove.row);
                const bestCol = Number(bestMove.col);
                const row = Number(move.row);
                const col = Number(move.col);
                if (row < bestRow || (row === bestRow && col < bestCol)) {
                    bestMove = move;
                }
            }
        }
        return bestMove;
    }

    function chooseBestMoveByScore(candidateMoves: any, scoreFn: any) {
        if (!Array.isArray(candidateMoves) || candidateMoves.length <= 0 || typeof scoreFn !== 'function') return null;
        let bestMove = null;
        let bestScore = Number.NEGATIVE_INFINITY;
        for (const move of candidateMoves) {
            let score = Number.NEGATIVE_INFINITY;
            try {
                score = Number(scoreFn(move) || 0);
            } catch (e) {
                score = Number.NEGATIVE_INFINITY;
            }
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
                continue;
            }
            if (score === bestScore && bestMove) {
                const bestRow = Number(bestMove.row);
                const bestCol = Number(bestMove.col);
                const row = Number(move.row);
                const col = Number(move.col);
                if (row < bestRow || (row === bestRow && col < bestCol)) {
                    bestMove = move;
                }
            }
        }
        return bestMove;
    }

    return {
        makePolicyStateKey,
        makePolicyActionKey,
        cellType,
        makePolicyAbstractActionKey,
        countEmptiesInBoardKey,
        discDiffFromPlayer,
        cornerDiffFromPlayer,
        toBucket,
        makePolicyAbstractStateKey,
        getPolicyScore,
        getPolicyActionScoreByKey,
        createPolicyRuntimeContext,
        selectPlacementMoveFromPolicyModel,
        chooseBestMoveByScore
    };
}
