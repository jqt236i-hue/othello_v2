import LocalMatchServer = require('./local-match-server');
import Core = require('../game/logic/core');

const SharedBoardUtils = require('../shared/shared-board-utils') as any;
const { createLocalMatchServer, resetRoomsForTests } = LocalMatchServer;

const DEFAULT_BASE = 'http://127.0.0.1:8787';
const HIDDEN_HAND_TOKEN_RE = /^__hidden_hand__:(black|white):(\d+)$/;

type SeatKey = 'black' | 'white';

interface BoardConfig {
    rows: number;
    cols: number;
}

interface JsonResponse {
    ok: boolean;
    status: number;
    data: any;
}

interface SseEvent {
    eventName: string;
    eventId: string;
    data: any;
}

interface SseStream {
    response: Response;
    reader: ReadableStreamDefaultReader<Uint8Array>;
    buffer: string;
}

function getErrorMessage(error: any): string {
    return error && typeof error.message === 'string' ? error.message : String(error);
}

function readArgValue(name: string): string {
    const key = `--${name}`;
    const idx = process.argv.indexOf(key);
    if (idx >= 0 && idx + 1 < process.argv.length) {
        return String(process.argv[idx + 1] || '').trim();
    }
    return '';
}

function normalizeBaseUrl(value: any): string {
    const raw = String(value || '').trim();
    if (!raw) return DEFAULT_BASE;
    if (/^https?:\/\//i.test(raw)) return raw.replace(/\/+$/, '');
    return `http://${raw}`.replace(/\/+$/, '');
}

function hasExplicitBaseOverride(): boolean {
    return !!readArgValue('base') || !!String(process.env.MATCH_SERVER_URL || '').trim();
}

function readArgInteger(name: string): number | null {
    const raw = readArgValue(name);
    if (!raw) return null;
    const value = Number(raw);
    if (!Number.isFinite(value)) return null;
    return Math.trunc(value);
}

function resolveRequestedRoomBoardConfig(): BoardConfig | null {
    const rawRows = readArgValue('rows');
    const rawCols = readArgValue('cols');
    if (!rawRows && !rawCols) return null;
    const rows = readArgInteger('rows');
    const cols = readArgInteger('cols');
    assertTrue(rows !== null || cols !== null, '盤面サイズ引数が不正です');
    return SharedBoardUtils.resolveBoardConfig({
        rows: rows !== null ? rows : cols,
        cols: cols !== null ? cols : rows
    });
}

async function listenServer(server: any, host: string, port: number): Promise<any> {
    await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => {
            server.removeListener('error', onError);
            reject(error);
        };
        server.once('error', onError);
        server.listen(port, host, () => {
            server.removeListener('error', onError);
            resolve();
        });
    });
    return server.address();
}

function buildBaseUrlFromAddress(address: any, fallbackHost: string): string {
    const host = address && typeof address === 'object' && address.address
        ? String(address.address)
        : String(fallbackHost || '127.0.0.1');
    const port = address && typeof address === 'object' && Number.isFinite(Number(address.port))
        ? Number(address.port)
        : 0;
    assertTrue(port > 0, 'managed local server port が取得できません');
    return `http://${host}:${port}`;
}

async function startManagedLocalServerIfNeeded(): Promise<{ baseUrl: string; server: any | null }> {
    if (hasExplicitBaseOverride()) {
        return {
            baseUrl: normalizeBaseUrl(readArgValue('base') || process.env.MATCH_SERVER_URL || DEFAULT_BASE),
            server: null
        };
    }
    resetRoomsForTests();
    const defaultUrl = new URL(DEFAULT_BASE);
    const server = createLocalMatchServer();
    const address = await listenServer(server, defaultUrl.hostname || '127.0.0.1', 0);
    return {
        baseUrl: buildBaseUrlFromAddress(address, defaultUrl.hostname),
        server
    };
}

async function closeManagedLocalServer(server: any): Promise<void> {
    if (!server) return;
    await new Promise<void>((resolve) => {
        server.close(() => resolve());
    });
    resetRoomsForTests();
}

async function requestJson(baseUrl: string, method: string, path: string, body?: any): Promise<JsonResponse> {
    const init: any = { method };
    if (body !== undefined) {
        init.headers = { 'Content-Type': 'application/json' };
        init.body = JSON.stringify(body || {});
    }
    const response = await fetch(`${baseUrl}${path}`, init);
    const data: any = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
}

function assertTrue(value: any, message: string): asserts value {
    if (!value) {
        throw new Error(message);
    }
}

function getBoardShape(board: any): BoardConfig | null {
    if (!Array.isArray(board)) return null;
    let cols = 0;
    for (const row of board) {
        if (Array.isArray(row)) cols = Math.max(cols, row.length);
    }
    if (board.length <= 0 || cols <= 0) return null;
    return { rows: board.length, cols };
}

function assertBoardConfigMatches(actual: any, expected: BoardConfig | null, label: string): void {
    if (!expected) return;
    assertTrue(actual && typeof actual === 'object', `${label} がありません`);
    assertTrue(Number(actual.rows) === Number(expected.rows), `${label} rows が ${expected.rows} ではありません`);
    assertTrue(Number(actual.cols) === Number(expected.cols), `${label} cols が ${expected.cols} ではありません`);
}

function assertSnapshotBoardShape(snapshot: any, expected: BoardConfig | null, label: string): void {
    if (!expected) return;
    assertTrue(snapshot && typeof snapshot === 'object', `${label} snapshot がありません`);
    const shape = getBoardShape(snapshot && snapshot.gameState && snapshot.gameState.board);
    assertTrue(shape, `${label} snapshot board shape が取得できません`);
    assertTrue(shape.rows === Number(expected.rows), `${label} snapshot board rows が ${expected.rows} ではありません`);
    assertTrue(shape.cols === Number(expected.cols), `${label} snapshot board cols が ${expected.cols} ではありません`);
}

function assertPayloadBoardState(payload: any, expected: BoardConfig | null, label: string): void {
    if (!expected) return;
    assertBoardConfigMatches(payload && payload.roomBoardConfig, expected, `${label} roomBoardConfig`);
    assertSnapshotBoardShape(payload && payload.snapshot, expected, `${label}`);
}

function isHiddenHandToken(value: any, ownerKey?: SeatKey, handIndex?: number): boolean {
    const raw = String(value || '');
    const match = raw.match(HIDDEN_HAND_TOKEN_RE);
    if (!match) return false;
    if (ownerKey && String(ownerKey) !== match[1]) return false;
    if (Number.isInteger(handIndex) && Number(match[2]) !== handIndex) return false;
    return true;
}

function decodeTextChunk(value: any): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof Buffer !== 'undefined') return Buffer.from(value).toString('utf8');
    return new TextDecoder().decode(value);
}

async function openSseStream(baseUrl: string, roomId: string, seatKey: SeatKey, seatToken: string): Promise<SseStream> {
    const response = await fetch(
        `${baseUrl}/api/match/stream?roomId=${encodeURIComponent(roomId)}&seatKey=${encodeURIComponent(seatKey)}&seatToken=${encodeURIComponent(seatToken)}`
    );
    assertTrue(response && response.ok, `stream(${seatKey}) 接続に失敗しました`);
    const body = response.body;
    assertTrue(body && typeof body.getReader === 'function', `stream(${seatKey}) reader が取得できません`);
    return {
        response,
        reader: body.getReader(),
        buffer: ''
    };
}

function takeNextSseEvent(stream: SseStream | null): SseEvent | null {
    if (!stream || typeof stream.buffer !== 'string') return null;
    const sepIndex = stream.buffer.indexOf('\n\n');
    if (sepIndex < 0) return null;
    const block = stream.buffer.slice(0, sepIndex);
    stream.buffer = stream.buffer.slice(sepIndex + 2);
    const lines = block.split('\n');
    const dataLines: string[] = [];
    let eventName = 'message';
    let eventId = '';
    for (const rawLine of lines) {
        const line = String(rawLine || '');
        if (!line) continue;
        if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
            continue;
        }
        if (line.startsWith('id:')) {
            eventId = line.slice(3).trim();
            continue;
        }
        if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trim());
        }
    }
    let data: any = {};
    const rawData = dataLines.join('\n');
    if (rawData) {
        try {
            data = JSON.parse(rawData);
        } catch (error) {
            throw new Error(`SSE data JSON parse failed: ${getErrorMessage(error)}`);
        }
    }
    return { eventName, eventId, data };
}

async function readSseEvent(stream: SseStream, timeoutMs: number, predicate?: (event: SseEvent) => boolean): Promise<SseEvent> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        const queued = takeNextSseEvent(stream);
        if (queued && (!predicate || predicate(queued))) {
            return queued;
        }
        const remaining = Math.max(1, timeoutMs - (Date.now() - startedAt));
        let readResult: ReadableStreamReadResult<Uint8Array> | null = null;
        try {
            readResult = await Promise.race([
                stream.reader.read(),
                new Promise<ReadableStreamReadResult<Uint8Array>>((_: any, reject: any) => setTimeout(() => reject(new Error('SSE_READ_TIMEOUT')), remaining))
            ]) as ReadableStreamReadResult<Uint8Array>;
        } catch (error) {
            if (getErrorMessage(error) === 'SSE_READ_TIMEOUT') break;
            throw error;
        }
        if (!readResult || readResult.done) break;
        stream.buffer += decodeTextChunk(readResult.value).replace(/\r\n/g, '\n');
    }
    throw new Error('SSE event がタイムアウトしました');
}

async function closeSseStream(stream: SseStream | null): Promise<void> {
    try {
        if (stream && stream.reader && typeof stream.reader.cancel === 'function') {
            await stream.reader.cancel();
        }
    } catch (error) {
        // ignore
    }
}

function assertSeatProjection(snapshot: any, seatKey: SeatKey): void {
    assertTrue(snapshot && typeof snapshot === 'object', 'snapshot がありません');
    assertTrue(snapshot.cardState && snapshot.cardState.hands, 'snapshot.cardState.hands がありません');

    const ownKey = seatKey === 'white' ? 'white' : 'black';
    const oppKey = ownKey === 'black' ? 'white' : 'black';
    const ownHand = Array.isArray(snapshot.cardState.hands[ownKey]) ? snapshot.cardState.hands[ownKey] : [];
    const oppHand = Array.isArray(snapshot.cardState.hands[oppKey]) ? snapshot.cardState.hands[oppKey] : [];

    assertTrue(Array.isArray(ownHand), `${ownKey} の手札配列がありません`);
    assertTrue(Array.isArray(oppHand), `${oppKey} の手札配列がありません`);
    assertTrue(ownHand.every((id: any) => !isHiddenHandToken(id)), `自分手札(${ownKey})が秘匿値になっています`);
    assertTrue(oppHand.every((id: any, idx: any) => isHiddenHandToken(id, oppKey, idx)), `相手手札(${oppKey})が秘匿されていません`);
}

function choosePublishAction(snapshot: any): { playerKey: SeatKey; row: number; col: number; turnIndex: number } {
    assertTrue(snapshot && snapshot.gameState, 'publish 用 snapshot がありません');
    const gameState = snapshot.gameState;
    const currentPlayer = Number(gameState.currentPlayer);
    assertTrue(currentPlayer === 1 || currentPlayer === -1, 'publish 用 currentPlayer が不正です');
    const legalMoves = Core.getLegalMoves(gameState, currentPlayer);
    assertTrue(Array.isArray(legalMoves) && legalMoves.length > 0, 'publish 用の合法手が見つかりません');
    const move = legalMoves[0];
    return {
        playerKey: currentPlayer === -1 ? 'white' : 'black',
        row: Number(move.row),
        col: Number(move.col),
        turnIndex: Number(snapshot && snapshot.cardState && snapshot.cardState.turnIndex) || 1
    };
}

async function main() {
    const requestedRoomBoardConfig = resolveRequestedRoomBoardConfig();
    const managedServerState = await startManagedLocalServerIfNeeded();
    const baseUrl = managedServerState.baseUrl;
    const managedServer = managedServerState.server;
    let blackStream: SseStream | null = null;
    let roomId = '';
    let blackSeatToken = '';
    let whiteSeatToken = '';

    if (managedServer) {
        console.log(`[match-check] auto-start local server ${baseUrl}`);
    }
    console.log(`[match-check] base=${baseUrl}`);
    try {
        const createBody: any = { playerName: 'くろ' };
        if (requestedRoomBoardConfig) createBody.roomBoardConfig = requestedRoomBoardConfig;
        const created = await requestJson(baseUrl, 'POST', '/api/match/create', createBody);
        assertTrue(created.ok && created.data && created.data.ok === true, '部屋作成に失敗しました');
        roomId = String(created.data.roomId || '').trim().toUpperCase();
        const seatKey = String(created.data.seatKey || '').trim();
        const seatToken = String(created.data.seatToken || '').trim();
        blackSeatToken = seatToken;
        assertTrue(!!roomId, '部屋番号が空です');
        assertTrue(/^[A-Z0-9]{3}$/.test(roomId), '部屋番号は英数字3文字ではありません');
        assertTrue(seatKey === 'black', '作成側の席が黒ではありません');
        assertTrue(!!seatToken, '作成側の合言葉がありません');
        assertSeatProjection(created.data.snapshot, 'black');
        assertPayloadBoardState(created.data, requestedRoomBoardConfig, 'create');
        console.log(`[match-check] create ok room=${roomId}`);

        const joined = await requestJson(baseUrl, 'POST', '/api/match/join', { roomId, playerName: 'しろ' });
        assertTrue(joined.ok && joined.data && joined.data.ok === true, '参加に失敗しました');
        assertTrue(joined.data.seatKey === 'white', '参加側の席が白ではありません');
        assertSeatProjection(joined.data.snapshot, 'white');
        assertPayloadBoardState(joined.data, requestedRoomBoardConfig, 'join');
        const joinedSeatToken = String(joined.data.seatToken || '').trim();
        whiteSeatToken = joinedSeatToken;
        assertTrue(!!joinedSeatToken, '参加側の合言葉がありません');
        console.log('[match-check] join ok seat=white');

        const rejoined = await requestJson(baseUrl, 'POST', '/api/match/join', { roomId, seatKey, seatToken, playerName: 'くろ' });
        assertTrue(rejoined.ok && rejoined.data && rejoined.data.ok === true, '再参加に失敗しました');
        assertTrue(rejoined.data.seatKey === 'black', '再参加で元の席を復元できませんでした');
        assertTrue(rejoined.data.rejoined === true, '再参加判定がtrueになっていません');
        assertSeatProjection(rejoined.data.snapshot, 'black');
        assertPayloadBoardState(rejoined.data, requestedRoomBoardConfig, 'rejoin');
        console.log('[match-check] rejoin ok seat=black');

        blackStream = await openSseStream(baseUrl, roomId, 'black', seatToken);
        const initialSnapshotEvent = await readSseEvent(blackStream, 1500, (event: any) => event && event.eventName === 'snapshot');
        assertTrue(!!initialSnapshotEvent.eventId, '初回 stream snapshot に SSE event id がありません');
        assertSeatProjection(initialSnapshotEvent.data && initialSnapshotEvent.data.snapshot, 'black');
        assertPayloadBoardState(initialSnapshotEvent.data, requestedRoomBoardConfig, 'stream bootstrap');
        const historyEvent = await readSseEvent(blackStream, 1500, (event: any) => event && event.eventName === 'chat');
        assertTrue(historyEvent.data && historyEvent.data.type === 'history', '初回 stream chat history が取得できませんでした');
        console.log('[match-check] stream bootstrap ok');

        const action = choosePublishAction(rejoined.data.snapshot);
        const actingSeatToken = action.playerKey === 'white' ? joinedSeatToken : seatToken;
        const placedValue = action.playerKey === 'white' ? -1 : 1;
        const expectedNextPlayer = placedValue === 1 ? -1 : 1;

        const published = await requestJson(baseUrl, 'POST', '/api/match/publish', {
            roomId,
            seatKey: action.playerKey,
            seatToken: actingSeatToken,
            playerKey: action.playerKey,
            actionType: 'place',
            operationId: `smoke_${Date.now()}`,
            baseVersion: Number(rejoined.data.stateVersion || 0),
            actor: action.playerKey,
            params: { row: action.row, col: action.col },
            turnIndex: action.turnIndex,
            action: { type: 'place', playerKey: action.playerKey, row: action.row, col: action.col, turnIndex: action.turnIndex }
        });
        assertTrue(published.ok && published.data && published.data.ok === true, 'publish に失敗しました');
        assertPayloadBoardState(published.data, requestedRoomBoardConfig, 'publish');
        const streamedPublishSnapshot = await readSseEvent(
            blackStream,
            1500,
            (event: any) => event && event.eventName === 'snapshot' && event.data && event.data.playerKey === action.playerKey && event.data.actionType === 'place'
        );
        assertPayloadBoardState(streamedPublishSnapshot.data, requestedRoomBoardConfig, 'stream publish');
        assertTrue(streamedPublishSnapshot.data.snapshot.gameState.board[action.row][action.col] === placedValue, 'stream snapshot に配置結果が反映されていません');
        assertTrue(streamedPublishSnapshot.data.snapshot.gameState.currentPlayer === expectedNextPlayer, 'stream snapshot の次手番が期待値と一致しません');
        console.log('[match-check] stream publish ok');

        const blackState = await requestJson(
            baseUrl,
            'GET',
            `/api/match/state?roomId=${encodeURIComponent(roomId)}&seatKey=black&seatToken=${encodeURIComponent(seatToken)}`
        );
        assertTrue(blackState.ok && blackState.data && blackState.data.ok === true, 'state(black) 取得に失敗しました');
        assertSeatProjection(blackState.data.snapshot, 'black');
        assertPayloadBoardState(blackState.data, requestedRoomBoardConfig, 'state(black)');
        assertTrue(blackState.data.snapshot.gameState.board[action.row][action.col] === placedValue, 'state(black) に配置結果が反映されていません');
        assertTrue(blackState.data.snapshot.gameState.currentPlayer === expectedNextPlayer, 'state(black) の次手番が期待値と一致しません');

        const whiteState = await requestJson(
            baseUrl,
            'GET',
            `/api/match/state?roomId=${encodeURIComponent(roomId)}&seatKey=white&seatToken=${encodeURIComponent(joinedSeatToken)}`
        );
        assertTrue(whiteState.ok && whiteState.data && whiteState.data.ok === true, 'state(white) 取得に失敗しました');
        assertSeatProjection(whiteState.data.snapshot, 'white');
        assertPayloadBoardState(whiteState.data, requestedRoomBoardConfig, 'state(white)');
        assertTrue(whiteState.data.snapshot.gameState.board[action.row][action.col] === placedValue, 'state(white) に配置結果が反映されていません');
        assertTrue(whiteState.data.snapshot.gameState.currentPlayer === expectedNextPlayer, 'state(white) の次手番が期待値と一致しません');

        const deniedState = await requestJson(baseUrl, 'GET', `/api/match/state?roomId=${encodeURIComponent(roomId)}`);
        assertTrue(!deniedState.ok && deniedState.status === 403, 'seatTokenなしstateが拒否されませんでした');

        const whiteLeft = await requestJson(baseUrl, 'POST', '/api/match/leave', {
            roomId,
            seatKey: 'white',
            seatToken: whiteSeatToken
        });
        assertTrue(whiteLeft.ok && whiteLeft.data && whiteLeft.data.ok === true, '退出(white)に失敗しました');
        whiteSeatToken = '';

        const blackLeft = await requestJson(baseUrl, 'POST', '/api/match/leave', {
            roomId,
            seatKey: 'black',
            seatToken: blackSeatToken
        });
        assertTrue(blackLeft.ok && blackLeft.data && blackLeft.data.ok === true, '退出(black)に失敗しました');
        blackSeatToken = '';
        console.log('[match-check] leave ok seats=white,black');

        const listedAfterLeave = await requestJson(baseUrl, 'GET', '/api/match/list');
        assertTrue(
            listedAfterLeave.ok && listedAfterLeave.data && listedAfterLeave.data.ok === true,
            '退出後の部屋一覧取得に失敗しました'
        );
        const remainingRooms = Array.isArray(listedAfterLeave.data.rooms)
            ? listedAfterLeave.data.rooms
            : [];
        assertTrue(
            !remainingRooms.some((room: any) => String(room?.roomId || '').trim().toUpperCase() === roomId),
            '退出後も部屋一覧にテスト部屋が残っています'
        );
        console.log('[match-check] room cleanup verified');

        console.log('[match-check] success');
    } finally {
        await closeSseStream(blackStream);
        if (roomId && whiteSeatToken) {
            const cleanup = await requestJson(baseUrl, 'POST', '/api/match/leave', {
                roomId,
                seatKey: 'white',
                seatToken: whiteSeatToken
            }).catch(() => null);
            if (!cleanup?.ok || cleanup.data?.ok !== true) {
                console.warn(`[match-check] cleanup leave failed seat=white room=${roomId}`);
            }
        }
        if (roomId && blackSeatToken) {
            const cleanup = await requestJson(baseUrl, 'POST', '/api/match/leave', {
                roomId,
                seatKey: 'black',
                seatToken: blackSeatToken
            }).catch(() => null);
            if (!cleanup?.ok || cleanup.data?.ok !== true) {
                console.warn(`[match-check] cleanup leave failed seat=black room=${roomId}`);
            }
        }
        await closeManagedLocalServer(managedServer);
    }
}

main().catch((error: any) => {
    console.error(`[match-check] failed: ${error && error.message ? error.message : String(error)}`);
    process.exit(1);
});
