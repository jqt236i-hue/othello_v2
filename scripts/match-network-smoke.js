const { createLocalMatchServer, resetRoomsForTests } = require('./local-match-server');

const DEFAULT_BASE = 'http://127.0.0.1:8787';
const HIDDEN_HAND_TOKEN_RE = /^__hidden_hand__:(black|white):(\d+)$/;

function readArgValue(name) {
    const key = `--${name}`;
    const idx = process.argv.indexOf(key);
    if (idx >= 0 && idx + 1 < process.argv.length) {
        return String(process.argv[idx + 1] || '').trim();
    }
    return '';
}

function normalizeBaseUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return DEFAULT_BASE;
    if (/^https?:\/\//i.test(raw)) return raw.replace(/\/+$/, '');
    return `http://${raw}`.replace(/\/+$/, '');
}

function hasExplicitBaseOverride() {
    return !!readArgValue('base') || !!String(process.env.MATCH_SERVER_URL || '').trim();
}

async function listenServer(server, host, port) {
    await new Promise((resolve, reject) => {
        const onError = (error) => {
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

function buildBaseUrlFromAddress(address, fallbackHost) {
    const host = address && typeof address === 'object' && address.address
        ? String(address.address)
        : String(fallbackHost || '127.0.0.1');
    const port = address && typeof address === 'object' && Number.isFinite(Number(address.port))
        ? Number(address.port)
        : 0;
    assertTrue(port > 0, 'managed local server port が取得できません');
    return `http://${host}:${port}`;
}

async function startManagedLocalServerIfNeeded() {
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

async function closeManagedLocalServer(server) {
    if (!server) return;
    await new Promise((resolve) => {
        server.close(() => resolve());
    });
    resetRoomsForTests();
}

async function requestJson(baseUrl, method, path, body) {
    const init = { method };
    if (body !== undefined) {
        init.headers = { 'Content-Type': 'application/json' };
        init.body = JSON.stringify(body || {});
    }
    const response = await fetch(`${baseUrl}${path}`, init);
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
}

function assertTrue(value, message) {
    if (!value) {
        throw new Error(message);
    }
}

function isHiddenHandToken(value, ownerKey, handIndex) {
    const raw = String(value || '');
    const match = raw.match(HIDDEN_HAND_TOKEN_RE);
    if (!match) return false;
    if (ownerKey && String(ownerKey) !== match[1]) return false;
    if (Number.isInteger(handIndex) && Number(match[2]) !== handIndex) return false;
    return true;
}

function decodeTextChunk(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof Buffer !== 'undefined') return Buffer.from(value).toString('utf8');
    return new TextDecoder().decode(value);
}

async function openSseStream(baseUrl, roomId, seatKey, seatToken) {
    const response = await fetch(
        `${baseUrl}/api/match/stream?roomId=${encodeURIComponent(roomId)}&seatKey=${encodeURIComponent(seatKey)}&seatToken=${encodeURIComponent(seatToken)}`
    );
    assertTrue(response && response.ok, `stream(${seatKey}) 接続に失敗しました`);
    assertTrue(response.body && typeof response.body.getReader === 'function', `stream(${seatKey}) reader が取得できません`);
    return {
        response,
        reader: response.body.getReader(),
        buffer: ''
    };
}

function takeNextSseEvent(stream) {
    if (!stream || typeof stream.buffer !== 'string') return null;
    const sepIndex = stream.buffer.indexOf('\n\n');
    if (sepIndex < 0) return null;
    const block = stream.buffer.slice(0, sepIndex);
    stream.buffer = stream.buffer.slice(sepIndex + 2);
    const lines = block.split('\n');
    const dataLines = [];
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
    let data = {};
    const rawData = dataLines.join('\n');
    if (rawData) {
        try {
            data = JSON.parse(rawData);
        } catch (error) {
            throw new Error(`SSE data JSON parse failed: ${error && error.message ? error.message : String(error)}`);
        }
    }
    return { eventName, eventId, data };
}

async function readSseEvent(stream, timeoutMs, predicate) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        const queued = takeNextSseEvent(stream);
        if (queued && (!predicate || predicate(queued))) {
            return queued;
        }
        const remaining = Math.max(1, timeoutMs - (Date.now() - startedAt));
        let readResult = null;
        try {
            readResult = await Promise.race([
                stream.reader.read(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('SSE_READ_TIMEOUT')), remaining))
            ]);
        } catch (error) {
            if (error && error.message === 'SSE_READ_TIMEOUT') break;
            throw error;
        }
        if (!readResult || readResult.done) break;
        stream.buffer += decodeTextChunk(readResult.value).replace(/\r\n/g, '\n');
    }
    throw new Error('SSE event がタイムアウトしました');
}

async function closeSseStream(stream) {
    try {
        if (stream && stream.reader && typeof stream.reader.cancel === 'function') {
            await stream.reader.cancel();
        }
    } catch (error) {
        // ignore
    }
}

function assertSeatProjection(snapshot, seatKey) {
    assertTrue(snapshot && typeof snapshot === 'object', 'snapshot がありません');
    assertTrue(snapshot.cardState && snapshot.cardState.hands, 'snapshot.cardState.hands がありません');

    const ownKey = seatKey === 'white' ? 'white' : 'black';
    const oppKey = ownKey === 'black' ? 'white' : 'black';
    const ownHand = Array.isArray(snapshot.cardState.hands[ownKey]) ? snapshot.cardState.hands[ownKey] : [];
    const oppHand = Array.isArray(snapshot.cardState.hands[oppKey]) ? snapshot.cardState.hands[oppKey] : [];

    assertTrue(Array.isArray(ownHand), `${ownKey} の手札配列がありません`);
    assertTrue(Array.isArray(oppHand), `${oppKey} の手札配列がありません`);
    assertTrue(ownHand.every((id) => !isHiddenHandToken(id)), `自分手札(${ownKey})が秘匿値になっています`);
    assertTrue(oppHand.every((id, idx) => isHiddenHandToken(id, oppKey, idx)), `相手手札(${oppKey})が秘匿されていません`);
}

async function main() {
    const managedServerState = await startManagedLocalServerIfNeeded();
    const baseUrl = managedServerState.baseUrl;
    const managedServer = managedServerState.server;
    let blackStream = null;

    if (managedServer) {
        console.log(`[match-check] auto-start local server ${baseUrl}`);
    }
    console.log(`[match-check] base=${baseUrl}`);
    try {
        const created = await requestJson(baseUrl, 'POST', '/api/match/create', { playerName: 'くろ' });
        assertTrue(created.ok && created.data && created.data.ok === true, '部屋作成に失敗しました');
        const roomId = String(created.data.roomId || '').trim().toUpperCase();
        const seatKey = String(created.data.seatKey || '').trim();
        const seatToken = String(created.data.seatToken || '').trim();
        assertTrue(!!roomId, '部屋番号が空です');
        assertTrue(/^[A-Z0-9]{3}$/.test(roomId), '部屋番号は英数字3文字ではありません');
        assertTrue(seatKey === 'black', '作成側の席が黒ではありません');
        assertTrue(!!seatToken, '作成側の合言葉がありません');
        assertSeatProjection(created.data.snapshot, 'black');
        console.log(`[match-check] create ok room=${roomId}`);

        const joined = await requestJson(baseUrl, 'POST', '/api/match/join', { roomId, playerName: 'しろ' });
        assertTrue(joined.ok && joined.data && joined.data.ok === true, '参加に失敗しました');
        assertTrue(joined.data.seatKey === 'white', '参加側の席が白ではありません');
        assertSeatProjection(joined.data.snapshot, 'white');
        const joinedSeatToken = String(joined.data.seatToken || '').trim();
        assertTrue(!!joinedSeatToken, '参加側の合言葉がありません');
        console.log('[match-check] join ok seat=white');

        const rejoined = await requestJson(baseUrl, 'POST', '/api/match/join', { roomId, seatKey, seatToken, playerName: 'くろ' });
        assertTrue(rejoined.ok && rejoined.data && rejoined.data.ok === true, '再参加に失敗しました');
        assertTrue(rejoined.data.seatKey === 'black', '再参加で元の席を復元できませんでした');
        assertTrue(rejoined.data.rejoined === true, '再参加判定がtrueになっていません');
        assertSeatProjection(rejoined.data.snapshot, 'black');
        console.log('[match-check] rejoin ok seat=black');

        blackStream = await openSseStream(baseUrl, roomId, 'black', seatToken);
        const initialSnapshotEvent = await readSseEvent(blackStream, 1500, (event) => event && event.eventName === 'snapshot');
        assertTrue(!!initialSnapshotEvent.eventId, '初回 stream snapshot に SSE event id がありません');
        assertSeatProjection(initialSnapshotEvent.data && initialSnapshotEvent.data.snapshot, 'black');
        const historyEvent = await readSseEvent(blackStream, 1500, (event) => event && event.eventName === 'chat');
        assertTrue(historyEvent.data && historyEvent.data.type === 'history', '初回 stream chat history が取得できませんでした');
        console.log('[match-check] stream bootstrap ok');

        const published = await requestJson(baseUrl, 'POST', '/api/match/publish', {
            roomId,
            seatKey: 'black',
            seatToken,
            playerKey: 'black',
            actionType: 'place',
            operationId: `smoke_${Date.now()}`,
            baseVersion: Number(rejoined.data.stateVersion || 0),
            actor: 'black',
            params: { row: 2, col: 3 },
            turnIndex: 1,
            action: { type: 'place', playerKey: 'black', row: 2, col: 3, turnIndex: 1 }
        });
        assertTrue(published.ok && published.data && published.data.ok === true, 'publish に失敗しました');
        const streamedPublishSnapshot = await readSseEvent(
            blackStream,
            1500,
            (event) => event && event.eventName === 'snapshot' && event.data && event.data.playerKey === 'black' && event.data.actionType === 'place'
        );
        assertTrue(streamedPublishSnapshot.data.snapshot.gameState.board[2][3] === 1, 'stream snapshot に配置結果が反映されていません');
        assertTrue(streamedPublishSnapshot.data.snapshot.gameState.currentPlayer === -1, 'stream snapshot の次手番が白になっていません');
        console.log('[match-check] stream publish ok');

        const blackState = await requestJson(
            baseUrl,
            'GET',
            `/api/match/state?roomId=${encodeURIComponent(roomId)}&seatKey=black&seatToken=${encodeURIComponent(seatToken)}`
        );
        assertTrue(blackState.ok && blackState.data && blackState.data.ok === true, 'state(black) 取得に失敗しました');
        assertSeatProjection(blackState.data.snapshot, 'black');
        assertTrue(blackState.data.snapshot.gameState.board[2][3] === 1, 'state(black) に配置結果が反映されていません');
        assertTrue(blackState.data.snapshot.gameState.currentPlayer === -1, 'state(black) の次手番が白になっていません');

        const whiteState = await requestJson(
            baseUrl,
            'GET',
            `/api/match/state?roomId=${encodeURIComponent(roomId)}&seatKey=white&seatToken=${encodeURIComponent(joinedSeatToken)}`
        );
        assertTrue(whiteState.ok && whiteState.data && whiteState.data.ok === true, 'state(white) 取得に失敗しました');
        assertSeatProjection(whiteState.data.snapshot, 'white');
        assertTrue(whiteState.data.snapshot.gameState.board[2][3] === 1, 'state(white) に配置結果が反映されていません');
        assertTrue(whiteState.data.snapshot.gameState.currentPlayer === -1, 'state(white) の次手番が白になっていません');

        const deniedState = await requestJson(baseUrl, 'GET', `/api/match/state?roomId=${encodeURIComponent(roomId)}`);
        assertTrue(!deniedState.ok && deniedState.status === 403, 'seatTokenなしstateが拒否されませんでした');

        const left = await requestJson(baseUrl, 'POST', '/api/match/leave', { roomId, seatKey, seatToken });
        assertTrue(left.ok && left.data && left.data.ok === true, '退出に失敗しました');
        console.log('[match-check] leave ok');

        console.log('[match-check] success');
    } finally {
        await closeSseStream(blackStream);
        await closeManagedLocalServer(managedServer);
    }
}

main().catch((error) => {
    console.error(`[match-check] failed: ${error && error.message ? error.message : String(error)}`);
    process.exit(1);
});
