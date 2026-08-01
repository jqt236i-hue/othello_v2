import LocalMatchServer = require('./local-match-server');
import Core = require('../game/logic/core');
import MatchAuthority = require('../utils/match-authority');

const { createLocalMatchServer, patchRoomSnapshotForTests, resetRoomsForTests } = LocalMatchServer;

const DEFAULT_GAMES = 5;
const DEFAULT_MAX_STEPS = 240;
const PLAYER_VALUE_BY_SEAT = { black: 1, white: -1 };

const CARD_PLANS = [
    ['hard_01', 'ghost_01', 'silver_stone', 'afterimage_will_01', 'chest_01'],
    ['gold_stone', 'crystal_stone', 'afterimage_will_01', 'perma_01', 'hard_01'],
    ['afterimage_will_01', 'silver_stone', 'regen_01', 'chest_01', 'gold_stone'],
    ['ghost_01', 'hard_01', 'perma_01', 'chest_01', 'silver_stone'],
    ['crystal_stone', 'gold_stone', 'chest_01', 'regen_01', 'hard_01']
];

function expectedCardIdsForGames(games: number): string[] {
    const expected = new Set<string>();
    for (let gameIndex = 1; gameIndex <= games; gameIndex += 1) {
        for (const cardId of CARD_PLANS[(gameIndex - 1) % CARD_PLANS.length]) expected.add(cardId);
    }
    return Array.from(expected).sort();
}

function readArgInteger(name: string, fallback: number): number {
    const key = `--${name}`;
    const index = process.argv.indexOf(key);
    if (index < 0 || index + 1 >= process.argv.length) return fallback;
    const value = Number(process.argv[index + 1]);
    return Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback;
}

async function listen(server: any): Promise<number> {
    await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => {
            server.removeListener('error', onError);
            reject(error);
        };
        server.once('error', onError);
        server.listen(0, '127.0.0.1', () => {
            server.removeListener('error', onError);
            resolve();
        });
    });
    return Number(server.address().port);
}

async function closeServer(server: any): Promise<void> {
    await new Promise<void>((resolve) => server.close(() => resolve()));
}

async function requestJson(baseUrl: string, method: string, path: string, body?: any): Promise<any> {
    const init: any = { method };
    if (typeof body !== 'undefined') {
        init.headers = { 'Content-Type': 'application/json' };
        init.body = JSON.stringify(body || {});
    }
    const response = await fetch(`${baseUrl}${path}`, init);
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
}

function seatFromCurrentPlayer(snapshot: any): 'black' | 'white' {
    const current = Number(snapshot && snapshot.gameState && snapshot.gameState.currentPlayer);
    if (current === -1) return 'white';
    return 'black';
}

function getTurnIndex(snapshot: any): number {
    const value = Number(snapshot && snapshot.cardState && snapshot.cardState.turnIndex);
    return Number.isFinite(value) ? Math.trunc(value) : 0;
}

function assertOk(response: any, label: string): void {
    if (response && response.ok && response.data && response.data.ok === true) return;
    const reason = response && response.data && (response.data.rejectedReason || response.data.errorMessage);
    throw new Error(`${label} failed status=${response && response.status}${reason ? ` reason=${reason}` : ''}`);
}

function pickLegalMove(snapshot: any, seatKey: 'black' | 'white', step: number): any | null {
    const playerValue = PLAYER_VALUE_BY_SEAT[seatKey];
    const legalMoves = Core.getLegalMoves(snapshot.gameState, playerValue);
    if (!Array.isArray(legalMoves) || legalMoves.length === 0) return null;
    return legalMoves[step % legalMoves.length];
}

function listCandidateMoves(snapshot: any, seatKey: 'black' | 'white', step: number): any[] {
    const playerValue = PLAYER_VALUE_BY_SEAT[seatKey];
    const legalMoves = Core.getLegalMoves(snapshot.gameState, playerValue);
    if (!Array.isArray(legalMoves) || legalMoves.length === 0) return [];
    const offset = step % legalMoves.length;
    return legalMoves.slice(offset).concat(legalMoves.slice(0, offset));
}

function buildPublishBase(ctx: any, seatKey: 'black' | 'white', actionType: string, operationId: string): any {
    return {
        roomId: ctx.roomId,
        seatKey,
        playerKey: seatKey,
        seatToken: ctx.tokens[seatKey],
        baseVersion: Number(ctx.stateVersion),
        actionType,
        actor: seatKey,
        operationId
    };
}

function prepareCardForSmoke(ctx: any, seatKey: 'black' | 'white', cardId: string): void {
    let preparedSnapshot: any = null;
    let preparedStateVersion: number | null = null;
    const patched = patchRoomSnapshotForTests(ctx.roomId, (room: any) => {
        const snapshot = room && room.snapshot;
        const cardState = snapshot && snapshot.cardState;
        if (!cardState || !cardState.hands || typeof cardState.hands !== 'object') {
            throw new Error(`card fixture snapshot is invalid for ${seatKey}`);
        }
        if (!cardState.charge || typeof cardState.charge !== 'object') {
            cardState.charge = { black: 0, white: 0 };
        }
        cardState.hands[seatKey] = [cardId];
        cardState.charge[seatKey] = 99;
        room.authoritativeStateHash = MatchAuthority.computeAuthoritativeStateHash(snapshot);
        preparedSnapshot = JSON.parse(JSON.stringify(snapshot));
        preparedStateVersion = Number(room.stateVersion);
    });
    if (!patched || !preparedSnapshot || !Number.isFinite(preparedStateVersion)) {
        throw new Error(`failed to prepare card fixture for ${seatKey}: ${cardId}`);
    }
    ctx.snapshot = preparedSnapshot;
    ctx.stateVersion = preparedStateVersion;
}

async function publishUseCard(baseUrl: string, ctx: any, seatKey: 'black' | 'white', cardId: string, gameIndex: number, step: number): Promise<void> {
    const turnIndex = getTurnIndex(ctx.snapshot);
    const body = {
        ...buildPublishBase(ctx, seatKey, 'use_card', `endgame_g${gameIndex}_s${step}_card_${seatKey}_${cardId}`),
        params: { useCardId: cardId },
        turnIndex,
        action: {
            type: 'use_card',
            playerKey: seatKey,
            useCardId: cardId,
            turnIndex
        }
    };
    const response = await requestJson(baseUrl, 'POST', '/api/match/publish', body);
    assertOk(response, `use_card(${seatKey}, ${cardId})`);
    ctx.snapshot = response.data.snapshot;
    ctx.stateVersion = Number(response.data.stateVersion);
    ctx.usedCards.push(cardId);
}

async function publishPlace(baseUrl: string, ctx: any, seatKey: 'black' | 'white', move: any, gameIndex: number, step: number, attempt: number): Promise<boolean> {
    const turnIndex = getTurnIndex(ctx.snapshot);
    const body = {
        ...buildPublishBase(ctx, seatKey, 'place', `endgame_g${gameIndex}_s${step}_place_${seatKey}_${attempt}`),
        params: { row: move.row, col: move.col },
        turnIndex,
        action: {
            type: 'place',
            playerKey: seatKey,
            row: move.row,
            col: move.col,
            turnIndex
        }
    };
    const response = await requestJson(baseUrl, 'POST', '/api/match/publish', body);
    if (!response.ok && response.status === 409 && response.data && response.data.rejectedReason === 'ILLEGAL_MOVE') {
        return false;
    }
    assertOk(response, `place(${seatKey}, ${move.row}, ${move.col})`);
    ctx.snapshot = response.data.snapshot;
    ctx.stateVersion = Number(response.data.stateVersion);
    ctx.moves += 1;
    return true;
}

async function publishPass(baseUrl: string, ctx: any, seatKey: 'black' | 'white', gameIndex: number, step: number): Promise<void> {
    const turnIndex = getTurnIndex(ctx.snapshot);
    const body = {
        ...buildPublishBase(ctx, seatKey, 'pass', `endgame_g${gameIndex}_s${step}_pass_${seatKey}`),
        params: {},
        turnIndex,
        action: {
            type: 'pass',
            playerKey: seatKey,
            turnIndex
        }
    };
    const response = await requestJson(baseUrl, 'POST', '/api/match/publish', body);
    assertOk(response, `pass(${seatKey})`);
    ctx.snapshot = response.data.snapshot;
    ctx.stateVersion = Number(response.data.stateVersion);
    ctx.passes += 1;
}

async function runGame(baseUrl: string, gameIndex: number, maxSteps: number): Promise<any> {
    const created = await requestJson(baseUrl, 'POST', '/api/match/create', {
        playerName: `くろ${gameIndex}`,
        networkDebugEnabled: true
    });
    assertOk(created, `create game ${gameIndex}`);

    const joined = await requestJson(baseUrl, 'POST', '/api/match/join', {
        roomId: created.data.roomId,
        playerName: `しろ${gameIndex}`
    });
    assertOk(joined, `join game ${gameIndex}`);
    if (created.data.networkDebugEnabled !== false || joined.data.networkDebugEnabled !== false) {
        throw new Error(`public network debug unexpectedly enabled for game ${gameIndex}`);
    }

    const ctx = {
        roomId: created.data.roomId,
        tokens: {
            black: created.data.seatToken,
            white: joined.data.seatToken
        },
        snapshot: joined.data.snapshot,
        stateVersion: Number(joined.data.stateVersion),
        usedCards: [],
        moves: 0,
        passes: 0
    };
    const cardPlan = CARD_PLANS[(gameIndex - 1) % CARD_PLANS.length];
    let cardCursor = 0;

    for (let step = 1; step <= maxSteps; step += 1) {
        if (Core.isGameOver(ctx.snapshot.gameState)) {
            if (cardCursor !== cardPlan.length) {
                throw new Error(`game ${gameIndex} ended before all planned cards were used (${cardCursor}/${cardPlan.length})`);
            }
            const counts = Core.countDiscs(ctx.snapshot.gameState, ctx.snapshot.cardState);
            return {
                gameIndex,
                roomId: ctx.roomId,
                stateVersion: ctx.stateVersion,
                moves: ctx.moves,
                passes: ctx.passes,
                usedCards: ctx.usedCards.slice(),
                counts
            };
        }

        const seatKey = seatFromCurrentPlayer(ctx.snapshot);
        const move = pickLegalMove(ctx.snapshot, seatKey, step);
        if (!move) {
            await publishPass(baseUrl, ctx, seatKey, gameIndex, step);
            continue;
        }

        if (cardCursor < cardPlan.length) {
            const cardId = cardPlan[cardCursor];
            prepareCardForSmoke(ctx, seatKey, cardId);
            await publishUseCard(baseUrl, ctx, seatKey, cardId, gameIndex, step);
            cardCursor += 1;
        }

        const latestSeatKey = seatFromCurrentPlayer(ctx.snapshot);
        const latestMoves = listCandidateMoves(ctx.snapshot, latestSeatKey, step);
        if (!latestMoves.length) {
            await publishPass(baseUrl, ctx, latestSeatKey, gameIndex, step);
        } else {
            let placed = false;
            for (let attempt = 0; attempt < latestMoves.length; attempt += 1) {
                placed = await publishPlace(baseUrl, ctx, latestSeatKey, latestMoves[attempt], gameIndex, step, attempt + 1);
                if (placed) break;
            }
            if (!placed) {
                throw new Error(`no server-accepted move for ${latestSeatKey} on game ${gameIndex} step ${step}`);
            }
        }
    }

    throw new Error(`game ${gameIndex} did not finish within ${maxSteps} steps`);
}

async function main(): Promise<void> {
    const games = readArgInteger('games', DEFAULT_GAMES);
    const maxSteps = readArgInteger('max-steps', DEFAULT_MAX_STEPS);
    resetRoomsForTests();
    const server = createLocalMatchServer();
    const port = await listen(server);
    const baseUrl = `http://127.0.0.1:${port}`;

    console.log(`[network-endgame] server=${baseUrl} games=${games} maxSteps=${maxSteps}`);
    try {
        const usedCardIds = new Set<string>();
        for (let gameIndex = 1; gameIndex <= games; gameIndex += 1) {
            const result = await runGame(baseUrl, gameIndex, maxSteps);
            for (const cardId of result.usedCards) usedCardIds.add(cardId);
            console.log(`[network-endgame] game ${gameIndex} ok room=${result.roomId} version=${result.stateVersion} moves=${result.moves} passes=${result.passes} cards=${result.usedCards.join(',')} discs=${result.counts.black}-${result.counts.white}`);
        }
        const missingCardIds = expectedCardIdsForGames(games).filter((cardId) => !usedCardIds.has(cardId));
        if (missingCardIds.length > 0) {
            throw new Error(`card coverage incomplete: ${missingCardIds.join(',')}`);
        }
        console.log(`[network-endgame] card coverage=${Array.from(usedCardIds).sort().join(',')}`);
        console.log('[network-endgame] success');
    } finally {
        await closeServer(server);
        resetRoomsForTests();
    }
}

main().catch((error) => {
    console.error(`[network-endgame] failed: ${error && error.message ? error.message : String(error)}`);
    process.exitCode = 1;
});
