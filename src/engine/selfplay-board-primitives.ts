/* eslint-disable @typescript-eslint/no-explicit-any */

type SelfplayBoardPrimitivesConfig = {
    Core?: any;
    CardLogic?: any;
    SharedBoardUtils?: any;
    OthelloCore?: any;
    PendingCoordinator?: any;
    ContextHelper?: any;
};

export function createSelfplayBoardPrimitives(config?: SelfplayBoardPrimitivesConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as SelfplayBoardPrimitivesConfig;
    const core = cfg.Core || null;
    const cardLogic = cfg.CardLogic || null;
    const sharedBoardUtils = cfg.SharedBoardUtils || null;
    const othelloCore = cfg.OthelloCore || null;
    const pendingCoordinator = cfg.PendingCoordinator || null;
    const contextHelper = cfg.ContextHelper || null;

    function toPlayerKey(playerValue: any) {
        return playerValue === core.BLACK ? 'black' : 'white';
    }

    function toPlayerValue(playerKey: any) {
        return playerKey === 'black' ? core.BLACK : core.WHITE;
    }

    function getSafeCardContext(cardState: any) {
        let context = null;
        try {
            if (contextHelper && typeof contextHelper.getSafeCardContext === 'function') {
                context = contextHelper.getSafeCardContext(cardState);
            }
        } catch (e) { /* ignore */ }
        if (context) return context;
        try {
            return cardLogic.getCardContext(cardState);
        } catch (e) {
            return {
                protectedStones: [],
                permaProtectedStones: [],
                bombs: []
            };
        }
    }

    function getShapeAwareBoard(board: any, options: any = null) {
        if (!Array.isArray(board)) return [];
        if (sharedBoardUtils && typeof sharedBoardUtils.attachBoardShape === 'function') {
            return sharedBoardUtils.attachBoardShape(board, options || null);
        }
        return board;
    }

    function getSelfplayBoard(gameState: any, cardState: any = null) {
        if (!gameState || !Array.isArray(gameState.board)) return [];
        return getShapeAwareBoard(gameState.board, {
            boardConfig: gameState.boardConfig,
            boardExpansion: gameState.boardExpansion,
            cardState
        });
    }

    function readSelfplayPendingEffect(cardState: any, playerKey: any) {
        if (pendingCoordinator && typeof pendingCoordinator.readPendingEffect === 'function') {
            return pendingCoordinator.readPendingEffect(cardState, playerKey);
        }
        return (cardState && cardState.pendingEffectByPlayer)
            ? (cardState.pendingEffectByPlayer[playerKey] || null)
            : null;
    }

    function getBoardCellValue(board: any, row: any, col: any) {
        if (sharedBoardUtils && typeof sharedBoardUtils.getCellValue === 'function') {
            return sharedBoardUtils.getCellValue(board, row, col);
        }
        return Array.isArray(board) && Array.isArray(board[row]) ? board[row][col] : null;
    }

    function setBoardCellValue(board: any, row: any, col: any, value: any) {
        if (sharedBoardUtils && typeof sharedBoardUtils.setCellValue === 'function') {
            return sharedBoardUtils.setCellValue(board, row, col, value);
        }
        if (!Array.isArray(board) || !Array.isArray(board[row])) return false;
        board[row][col] = value;
        return true;
    }

    function encodeBoard(board: any) {
        if (sharedBoardUtils && typeof sharedBoardUtils.encodeBoard === 'function') {
            return sharedBoardUtils.encodeBoard(board);
        }
        if (!Array.isArray(board)) return '';
        return board
            .map((row: any) => row.map((v: any) => (v === core.BLACK ? 'B' : (v === core.WHITE ? 'W' : '.'))).join(''))
            .join('/');
    }

    function encodeMainBoard(board: any) {
        if (!Array.isArray(board)) return '';
        return board
            .map((row: any) => (Array.isArray(row) ? row : []).map((v: any) => (v === core.BLACK ? 'B' : (v === core.WHITE ? 'W' : '.'))).join(''))
            .join('/');
    }

    function decodeBoard(boardStr: any) {
        if (!boardStr) return [];
        return boardStr.split('/').map((row: any) => row.split(''));
    }

    function transformCoord(row: any, col: any, size: any, t: any) {
        if (sharedBoardUtils && typeof sharedBoardUtils.transformCoord === 'function') {
            return sharedBoardUtils.transformCoord(row, col, size, t);
        }
        if (t === 0) return { row, col };
        if (t === 1) return { row: col, col: size - 1 - row };
        if (t === 2) return { row: size - 1 - row, col: size - 1 - col };
        if (t === 3) return { row: size - 1 - col, col: row };
        if (t === 4) return { row, col: size - 1 - col };
        if (t === 5) return { row: size - 1 - col, col: size - 1 - row };
        if (t === 6) return { row: size - 1 - row, col };
        if (t === 7) return { row: col, col: row };
        return { row, col };
    }

    function transformBoard(board: any, t: any) {
        if (!Array.isArray(board) || !board.length) return [];
        const size = board.length;
        const out = Array.from({ length: size }, () => Array.from({ length: size }, () => '.'));
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const next = transformCoord(r, c, size, t);
                out[next.row][next.col] = board[r][c];
            }
        }
        return out;
    }

    function canonicalizeBoard(board: any) {
        if (sharedBoardUtils && typeof sharedBoardUtils.canonicalizeBoard === 'function') {
            return sharedBoardUtils.canonicalizeBoard(board);
        }
        const raw = encodeBoard(board);
        if (!raw) return { boardKey: raw, transformId: 0 };
        const decoded = decodeBoard(raw);
        let best = null;
        let bestT = 0;
        for (let t = 0; t < 8; t++) {
            const encoded = encodeBoard(transformBoard(decoded, t));
            if (best === null || encoded < best) {
                best = encoded;
                bestT = t;
            }
        }
        return { boardKey: best || raw, transformId: bestT };
    }

    function isCorner(row: any, col: any, boardOrSize: any = 8) {
        if (sharedBoardUtils && typeof sharedBoardUtils.isCorner === 'function') {
            if (Array.isArray(boardOrSize)) return sharedBoardUtils.isCorner(row, col, boardOrSize);
            const n = Number.isFinite(boardOrSize) && boardOrSize > 0 ? boardOrSize : 8;
            return sharedBoardUtils.isCorner(row, col, n, n);
        }
        const n = Number.isFinite(boardOrSize) && boardOrSize > 0 ? boardOrSize : 8;
        return (row === 0 || row === n - 1) && (col === 0 || col === n - 1);
    }

    function isEdge(row: any, col: any, boardOrSize: any = 8) {
        if (sharedBoardUtils && typeof sharedBoardUtils.isEdge === 'function') {
            if (Array.isArray(boardOrSize)) return sharedBoardUtils.isEdge(row, col, boardOrSize);
            const n = Number.isFinite(boardOrSize) && boardOrSize > 0 ? boardOrSize : 8;
            return sharedBoardUtils.isEdge(row, col, n, n);
        }
        const n = Number.isFinite(boardOrSize) && boardOrSize > 0 ? boardOrSize : 8;
        return row === 0 || row === n - 1 || col === 0 || col === n - 1;
    }

    function resolveForcedPlacementCandidates(legalMoves: any, options: any, board: any) {
        const safeLegalMoves = Array.isArray(legalMoves)
            ? legalMoves.filter((move: any) => move && Number.isInteger(move.row) && Number.isInteger(move.col))
            : [];
        const defaultMoves = safeLegalMoves.length > 0
            ? safeLegalMoves
            : (Array.isArray(legalMoves) ? legalMoves : []);

        if (options && options.forceCornerEdgePlacement === false) {
            return {
                category: null,
                moves: defaultMoves
            };
        }

        const cornerMoves = safeLegalMoves.filter((move: any) => isCorner(move.row, move.col, board));
        if (cornerMoves.length > 0) {
            return {
                category: 'corner',
                moves: cornerMoves
            };
        }

        if (!options || options.forceCornerEdgePlacement !== true) {
            return {
                category: null,
                moves: defaultMoves
            };
        }

        const edgeMoves = safeLegalMoves.filter((move: any) => !isCorner(move.row, move.col, board) && isEdge(move.row, move.col, board));
        if (edgeMoves.length > 0) {
            return {
                category: 'edge',
                moves: edgeMoves
            };
        }

        return {
            category: null,
            moves: defaultMoves
        };
    }

    function isXSquare(row: any, col: any, boardOrSize: any = 8) {
        if (sharedBoardUtils && typeof sharedBoardUtils.isXSquare === 'function') {
            if (Array.isArray(boardOrSize)) return sharedBoardUtils.isXSquare(row, col, boardOrSize);
            const n = Number.isFinite(boardOrSize) && boardOrSize > 0 ? boardOrSize : 8;
            return sharedBoardUtils.isXSquare(row, col, n, n);
        }
        const n = Number.isFinite(boardOrSize) && boardOrSize > 0 ? boardOrSize : 8;
        return (row === 1 || row === n - 2) && (col === 1 || col === n - 2);
    }

    function isCSquare(row: any, col: any, boardOrSize: any = 8) {
        if (sharedBoardUtils && typeof sharedBoardUtils.isCSquare === 'function') {
            if (Array.isArray(boardOrSize)) return sharedBoardUtils.isCSquare(row, col, boardOrSize);
            const n = Number.isFinite(boardOrSize) && boardOrSize > 0 ? boardOrSize : 8;
            return sharedBoardUtils.isCSquare(row, col, n, n);
        }
        const n = Number.isFinite(boardOrSize) && boardOrSize > 0 ? boardOrSize : 8;
        const nearTopBottom = (row === 0 || row === n - 1) && (col === 1 || col === n - 2);
        const nearLeftRight = (col === 0 || col === n - 1) && (row === 1 || row === n - 2);
        return nearTopBottom || nearLeftRight;
    }

    function getFlipsBasic(board: any, row: any, col: any, playerValue: any) {
        if (sharedBoardUtils && typeof sharedBoardUtils.getFlipsBasic === 'function') {
            return sharedBoardUtils.getFlipsBasic(board, row, col, playerValue);
        }
        if (othelloCore && typeof othelloCore.getFlipsBasic === 'function') {
            return othelloCore.getFlipsBasic(board, row, col, playerValue);
        }
        throw new Error('SharedBoardUtils.getFlipsBasic is required by selfplay board primitives');
    }

    function getLegalMovesBasic(board: any, playerValue: any) {
        if (sharedBoardUtils && typeof sharedBoardUtils.getLegalMovesBasic === 'function') {
            return sharedBoardUtils.getLegalMovesBasic(board, playerValue);
        }
        if (othelloCore && typeof othelloCore.getLegalMovesBasic === 'function') {
            return othelloCore.getLegalMovesBasic(board, playerValue);
        }
        throw new Error('SharedBoardUtils.getLegalMovesBasic is required by selfplay board primitives');
    }

    return {
        toPlayerKey,
        toPlayerValue,
        getSafeCardContext,
        getShapeAwareBoard,
        getSelfplayBoard,
        readSelfplayPendingEffect,
        getBoardCellValue,
        setBoardCellValue,
        encodeBoard,
        encodeMainBoard,
        decodeBoard,
        transformCoord,
        transformBoard,
        canonicalizeBoard,
        isCorner,
        isEdge,
        resolveForcedPlacementCandidates,
        isXSquare,
        isCSquare,
        getFlipsBasic,
        getLegalMovesBasic
    };
}
