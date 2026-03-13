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
    const baseUrl = normalizeBaseUrl(readArgValue('base') || process.env.MATCH_SERVER_URL || DEFAULT_BASE);

    console.log(`[match-check] base=${baseUrl}`);

    const created = await requestJson(baseUrl, 'POST', '/api/match/create', {});
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

    const joined = await requestJson(baseUrl, 'POST', '/api/match/join', { roomId });
    assertTrue(joined.ok && joined.data && joined.data.ok === true, '参加に失敗しました');
    assertTrue(joined.data.seatKey === 'white', '参加側の席が白ではありません');
    assertSeatProjection(joined.data.snapshot, 'white');
    const joinedSeatToken = String(joined.data.seatToken || '').trim();
    assertTrue(!!joinedSeatToken, '参加側の合言葉がありません');
    console.log('[match-check] join ok seat=white');

    const rejoined = await requestJson(baseUrl, 'POST', '/api/match/join', { roomId, seatKey, seatToken });
    assertTrue(rejoined.ok && rejoined.data && rejoined.data.ok === true, '再参加に失敗しました');
    assertTrue(rejoined.data.seatKey === 'black', '再参加で元の席を復元できませんでした');
    assertTrue(rejoined.data.rejoined === true, '再参加判定がtrueになっていません');
    assertSeatProjection(rejoined.data.snapshot, 'black');
    console.log('[match-check] rejoin ok seat=black');

    const publishSnapshot = JSON.parse(JSON.stringify(rejoined.data.snapshot || {}));
    if (!publishSnapshot.cardState || typeof publishSnapshot.cardState !== 'object') {
        throw new Error('publish snapshot cardState がありません');
    }
    publishSnapshot.cardState.pendingEffectByPlayer = publishSnapshot.cardState.pendingEffectByPlayer || {};
    publishSnapshot.cardState.pendingEffectByPlayer.black = {
        type: 'CONDEMN_WILL',
        stage: 'selectTarget',
        offers: [
            { handIndex: 0, cardId: 'gold_stone' },
            { handIndex: 1, cardId: 'silver_stone' }
        ]
    };
    const published = await requestJson(baseUrl, 'POST', '/api/match/publish', {
        roomId,
        seatKey: 'black',
        seatToken,
        playerKey: 'black',
        actionType: 'smoke_condemn_projection',
        operationId: `smoke_${Date.now()}`,
        baseVersion: Number(rejoined.data.stateVersion || 0),
        playbackEvents: [],
        snapshot: publishSnapshot
    });
    assertTrue(published.ok && published.data && published.data.ok === true, 'publish に失敗しました');

    const blackState = await requestJson(
        baseUrl,
        'GET',
        `/api/match/state?roomId=${encodeURIComponent(roomId)}&seatKey=black&seatToken=${encodeURIComponent(seatToken)}`
    );
    assertTrue(blackState.ok && blackState.data && blackState.data.ok === true, 'state(black) 取得に失敗しました');
    assertSeatProjection(blackState.data.snapshot, 'black');
    const blackCondemn = blackState.data.snapshot.cardState
        && blackState.data.snapshot.cardState.pendingEffectByPlayer
        ? blackState.data.snapshot.cardState.pendingEffectByPlayer.black
        : null;
    assertTrue(blackCondemn && blackCondemn.type === 'CONDEMN_WILL', 'state(black) に断罪選択状態がありません');
    assertTrue(Array.isArray(blackCondemn.offers) && blackCondemn.offers.length >= 2, 'state(black) の断罪候補が不足しています');
    assertTrue(blackCondemn.offers[0].cardId === 'gold_stone', 'state(black) 断罪候補[0] が表示されていません');
    assertTrue(blackCondemn.offers[1].cardId === 'silver_stone', 'state(black) 断罪候補[1] が表示されていません');

    const whiteState = await requestJson(
        baseUrl,
        'GET',
        `/api/match/state?roomId=${encodeURIComponent(roomId)}&seatKey=white&seatToken=${encodeURIComponent(joinedSeatToken)}`
    );
    assertTrue(whiteState.ok && whiteState.data && whiteState.data.ok === true, 'state(white) 取得に失敗しました');
    assertSeatProjection(whiteState.data.snapshot, 'white');
    const whiteViewCondemn = whiteState.data.snapshot.cardState
        && whiteState.data.snapshot.cardState.pendingEffectByPlayer
        ? whiteState.data.snapshot.cardState.pendingEffectByPlayer.black
        : null;
    assertTrue(whiteViewCondemn && whiteViewCondemn.type === 'CONDEMN_WILL', 'state(white) から断罪状態が確認できません');
    assertTrue(Array.isArray(whiteViewCondemn.offers) && whiteViewCondemn.offers.length >= 2, 'state(white) の断罪候補が不足しています');
    assertTrue(isHiddenHandToken(whiteViewCondemn.offers[0].cardId, 'white', 0), 'state(white) 断罪候補[0] が秘匿されていません');
    assertTrue(isHiddenHandToken(whiteViewCondemn.offers[1].cardId, 'white', 1), 'state(white) 断罪候補[1] が秘匿されていません');

    const deniedState = await requestJson(baseUrl, 'GET', `/api/match/state?roomId=${encodeURIComponent(roomId)}`);
    assertTrue(!deniedState.ok && deniedState.status === 403, 'seatTokenなしstateが拒否されませんでした');

    const left = await requestJson(baseUrl, 'POST', '/api/match/leave', { roomId, seatKey, seatToken });
    assertTrue(left.ok && left.data && left.data.ok === true, '退出に失敗しました');
    console.log('[match-check] leave ok');

    console.log('[match-check] success');
}

main().catch((error) => {
    console.error(`[match-check] failed: ${error && error.message ? error.message : String(error)}`);
    process.exit(1);
});
