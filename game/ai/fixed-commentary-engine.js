(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.FixedCommentaryEngine = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    let Data = null;
    let CommentaryContextHelpers = null;
    let OwnerHelpersModule = null;
    if (typeof require === 'function') {
        try { Data = require('../../data/dialogue/fixed-commentary-data'); } catch (e) { Data = null; }
        if (!Data) {
            try { Data = require('../..//data/dialogue/fixed-commentary-data'); } catch (e) { Data = null; }
        }
        try { CommentaryContextHelpers = require('../../shared/commentary-context-helpers'); } catch (e) { CommentaryContextHelpers = null; }
        try { OwnerHelpersModule = require('../../utils/owner-helpers'); } catch (e) { OwnerHelpersModule = null; }
    }
    if (!Data && typeof globalThis !== 'undefined') {
        Data = globalThis.FixedCommentaryData || null;
    }
    if (!CommentaryContextHelpers && typeof globalThis !== 'undefined') {
        CommentaryContextHelpers = globalThis.CommentaryContextHelpers || null;
    }
    if (!OwnerHelpersModule && typeof globalThis !== 'undefined') {
        OwnerHelpersModule = globalThis.OwnerHelpers || null;
    }

    const DEFAULT_DATA = {
        CARD_TYPE_LABELS: {},
        openingLines: ['開幕だ、盤面の温度を測る'],
        middleAheadLines: ['この流れは押せる、丁寧に詰める'],
        middleEvenLines: ['まだ拮抗、次の一手を研ぐ'],
        middleBehindLines: ['苦しいが、逆転筋を探す'],
        endAheadLines: ['終盤は優位、逃げ切る'],
        endEvenLines: ['終盤で五分、精度で押す'],
        endBehindLines: ['終盤で劣勢、最後まで噛みつく'],
        chatterLines: ['今日は静かだ、でも手は止めない'],
        tauntLines: ['その手は甘い、次で差を広げる'],
        negativeLines: ['もう無理かも、でも一手は置く'],
        bluffLines: ['余裕だ、…と言い聞かせる'],
        boardSwingLines: ['盤面が一気に動いた、ここからが本番だ'],
        passLines: ['打てる場所がない、次で取り返す'],
        cardTargetLines: ['その狙いは見えている、返しを準備する'],
        cornerFirstOwnedLines: ['角を先に取った、この流れは渡さない'],
        cornerFirstLostLines: ['先に角を取られた、ここから立て直す'],
        cornerStreakTwoOwnedLines: ['角を連続で取った、このまま押し切る'],
        cornerStreakTwoLostLines: ['角を連続で取られた、受けを固める'],
        cornerStreakThreeOwnedLines: ['角を3連続で取った、勝ち筋が太い'],
        cornerStreakThreeLostLines: ['角を3連続で失った、まだ逆転は捨てない'],
        cornerAllOwnedLines: ['四隅を全部取った、盤面は支配した'],
        cornerAllLostLines: ['四隅を全部取られた、最後まで食らいつく'],
        getCardUseLines: function () { return ['ここでカードを切る、流れを動かす']; },
        getCardHitLines: function () { return ['そのカードは重い、受け切って返す']; }
    };

    const DB = Data || DEFAULT_DATA;

    const DEFAULT_CONFIG = {
        enabled: true,
        maxChars: 120,
        recentKeep: 8,
        regularTurnInterval: 2,
        unchangedThreshold: 1,
        behindThreshold: 2,
        cornerWeight: 4
    };

    const config = Object.assign({}, DEFAULT_CONFIG);
    const perPlayerState = {
        black: createPlayerState(),
        white: createPlayerState()
    };

    let fallbackCardTypeMap = null;

    function createPlayerState() {
        return {
            started: false,
            lastSituationKey: '',
            unchangedStreak: 0,
            behindStreak: 0,
            recent: [],
            lastDiscDiff: null,
            lastTurnNumber: null,
            lastPhase: '',
            lastAdvantage: '',
            lastRegularCommentTurn: null,
            regularTurnCallCount: 0,
            lastOwnCorners: null,
            lastOppCorners: null,
            ownCornerGainStreak: 0,
            oppCornerGainStreak: 0
        };
    }

    function clampCornerCount(value) {
        const num = Number(value);
        if (!Number.isFinite(num)) return 0;
        if (num <= 0) return 0;
        if (num >= 4) return 4;
        return Math.floor(num);
    }

    function classifyCornerGainEvent(isOwnSide, streak, reachedAll, reachedFirst) {
        if (isOwnSide) {
            if (reachedAll) return 'corner_all_owned';
            if (reachedFirst) return 'corner_first_owned';
            if (streak >= 3) return 'corner_streak_three_owned';
            if (streak === 2) return 'corner_streak_two_owned';
            return '';
        }
        if (reachedAll) return 'corner_all_lost';
        if (reachedFirst) return 'corner_first_lost';
        if (streak >= 3) return 'corner_streak_three_lost';
        if (streak === 2) return 'corner_streak_two_lost';
        return '';
    }

    function resolveCornerEventType(playerState, corners) {
        const ownNow = clampCornerCount(corners && corners.own);
        const oppNow = clampCornerCount(corners && corners.opp);

        if (!playerState.started || !Number.isFinite(playerState.lastOwnCorners) || !Number.isFinite(playerState.lastOppCorners)) {
            playerState.lastOwnCorners = ownNow;
            playerState.lastOppCorners = oppNow;
            playerState.ownCornerGainStreak = 0;
            playerState.oppCornerGainStreak = 0;
            return '';
        }

        const prevOwn = clampCornerCount(playerState.lastOwnCorners);
        const prevOpp = clampCornerCount(playerState.lastOppCorners);
        const ownDelta = ownNow - prevOwn;
        const oppDelta = oppNow - prevOpp;
        const ownGain = ownDelta > 0;
        const oppGain = oppDelta > 0;

        let eventType = '';
        if (ownGain && !oppGain) {
            playerState.ownCornerGainStreak += 1;
            playerState.oppCornerGainStreak = 0;
            eventType = classifyCornerGainEvent(true, playerState.ownCornerGainStreak, ownNow >= 4, prevOwn <= 0 && ownNow > 0);
        } else if (!ownGain && oppGain) {
            playerState.oppCornerGainStreak += 1;
            playerState.ownCornerGainStreak = 0;
            eventType = classifyCornerGainEvent(false, playerState.oppCornerGainStreak, oppNow >= 4, prevOpp <= 0 && oppNow > 0);
        } else if (ownGain && oppGain) {
            const ownPriority = (ownNow >= 4 ? 100 : 0) + ownDelta;
            const oppPriority = (oppNow >= 4 ? 100 : 0) + oppDelta;
            if (ownPriority >= oppPriority) {
                playerState.ownCornerGainStreak += 1;
                playerState.oppCornerGainStreak = 0;
                eventType = classifyCornerGainEvent(true, playerState.ownCornerGainStreak, ownNow >= 4, prevOwn <= 0 && ownNow > 0);
            } else {
                playerState.oppCornerGainStreak += 1;
                playerState.ownCornerGainStreak = 0;
                eventType = classifyCornerGainEvent(false, playerState.oppCornerGainStreak, oppNow >= 4, prevOpp <= 0 && oppNow > 0);
            }
        } else {
            playerState.ownCornerGainStreak = 0;
            playerState.oppCornerGainStreak = 0;
        }

        playerState.lastOwnCorners = ownNow;
        playerState.lastOppCorners = oppNow;
        return eventType;
    }

    function isCornerOwnedEventType(eventType) {
        return eventType === 'corner_first_owned' ||
            eventType === 'corner_streak_two_owned' ||
            eventType === 'corner_streak_three_owned' ||
            eventType === 'corner_all_owned';
    }

    function isCornerLostEventType(eventType) {
        return eventType === 'corner_first_lost' ||
            eventType === 'corner_streak_two_lost' ||
            eventType === 'corner_streak_three_lost' ||
            eventType === 'corner_all_lost';
    }

    function isCornerEventType(eventType) {
        return isCornerOwnedEventType(eventType) || isCornerLostEventType(eventType);
    }

    function toBool(value) {
        if (value === true || value === 1 || value === '1') return true;
        if (value === false || value === 0 || value === '0') return false;
        if (typeof value === 'string') {
            const s = value.trim().toLowerCase();
            if (s === 'true' || s === 'on' || s === 'yes') return true;
            if (s === 'false' || s === 'off' || s === 'no') return false;
        }
        return null;
    }

    function readQueryFlag(name) {
        try {
            if (typeof location === 'undefined' || !location.search) return null;
            const params = new URLSearchParams(location.search);
            if (!params.has(name)) return null;
            return toBool(params.get(name));
        } catch (e) {
            return null;
        }
    }

    function isEnabled() {
        try {
            if (typeof globalThis !== 'undefined') {
                const forced = toBool(globalThis.CPU_TALK_ENABLED);
                if (forced !== null) return forced;
            }
        } catch (e) { /* ignore */ }

        const query = readQueryFlag('cpuTalk');
        if (query !== null) return query;
        const queryAlt = readQueryFlag('cpu_talk');
        if (queryAlt !== null) return queryAlt;

        return !!config.enabled;
    }

    function setConfig(nextConfig) {
        if (!nextConfig || typeof nextConfig !== 'object') return getStatus();
        Object.assign(config, nextConfig);
        return getStatus();
    }

    function getStatus() {
        return {
            mode: 'fixed-random',
            enabled: isEnabled(),
            maxChars: config.maxChars,
            regularTurnInterval: config.regularTurnInterval,
            unchangedThreshold: config.unchangedThreshold,
            behindThreshold: config.behindThreshold
        };
    }

    function normalizePlayerKey(value) {
        try {
            if (CommentaryContextHelpers && typeof CommentaryContextHelpers.normalizePlayerKey === 'function') {
                return CommentaryContextHelpers.normalizePlayerKey(value, 'white');
            }
        } catch (e) { /* ignore */ }
        try {
            if (OwnerHelpersModule && typeof OwnerHelpersModule.normalizePlayerKey === 'function') {
                return OwnerHelpersModule.normalizePlayerKey(value, 'white');
            }
        } catch (e) { /* ignore */ }
        return value === 'black' ? 'black' : 'white';
    }

    function normalizePhase(value, turnNumber, occupiedCells) {
        const key = String(value || '').toLowerCase();
        if (key === 'opening' || key === 'middle' || key === 'endgame') return key;
        const turn = Number(turnNumber || 0);
        const occupied = Number(occupiedCells || 0);
        if (turn > 0) {
            if (turn <= 12) return 'opening';
            if (turn >= 38) return 'endgame';
            return 'middle';
        }
        if (occupied <= 20) return 'opening';
        if (occupied >= 52) return 'endgame';
        return 'middle';
    }

    function countCornersFromBoard(board, playerKey) {
        if (!Array.isArray(board) || board.length < 8) return { own: 0, opp: 0 };
        const ownVal = playerKey === 'black' ? 1 : -1;
        const oppVal = -ownVal;
        const corners = [[0, 0], [0, 7], [7, 0], [7, 7]];
        let own = 0;
        let opp = 0;
        for (const p of corners) {
            const row = board[p[0]];
            if (!Array.isArray(row)) continue;
            const v = row[p[1]];
            if (v === ownVal) own += 1;
            else if (v === oppVal) opp += 1;
        }
        return { own, opp };
    }

    function normalizeCounts(context) {
        const counts = context && context.counts ? context.counts : {};
        const black = Number.isFinite(Number(counts.black)) ? Number(counts.black) : 0;
        const white = Number.isFinite(Number(counts.white)) ? Number(counts.white) : 0;
        return { black, white };
    }

    function normalizeCorners(context, playerKey) {
        const corners = context && context.corners ? context.corners : null;
        if (corners && Number.isFinite(Number(corners.own)) && Number.isFinite(Number(corners.opp))) {
            return { own: Number(corners.own), opp: Number(corners.opp) };
        }
        if (Array.isArray(context && context.board)) {
            return countCornersFromBoard(context.board, playerKey);
        }
        return { own: 0, opp: 0 };
    }

    function resolveAdvantage(context, playerKey, counts, corners) {
        const direct = String(context && context.advantage || '').toLowerCase();
        if (direct === 'ahead' || direct === 'behind' || direct === 'even') return direct;

        const own = playerKey === 'black' ? counts.black : counts.white;
        const opp = playerKey === 'black' ? counts.white : counts.black;
        const discDiff = own - opp;
        const cornerDiff = (corners.own || 0) - (corners.opp || 0);
        const score = discDiff + (cornerDiff * Number(config.cornerWeight || 4));
        if (score >= 8) return 'ahead';
        if (score <= -8) return 'behind';
        return 'even';
    }

    function getCardTypeMap() {
        if (fallbackCardTypeMap) return fallbackCardTypeMap;
        fallbackCardTypeMap = {};
        try {
            if (typeof globalThis !== 'undefined' && globalThis.CARD_TYPE_BY_ID && typeof globalThis.CARD_TYPE_BY_ID === 'object') {
                fallbackCardTypeMap = Object.assign({}, globalThis.CARD_TYPE_BY_ID);
                return fallbackCardTypeMap;
            }
        } catch (e) { /* ignore */ }
        try {
            if (typeof require === 'function') {
                const Shared = require('../../shared-constants');
                if (Shared && Shared.CARD_TYPE_BY_ID) {
                    fallbackCardTypeMap = Object.assign({}, Shared.CARD_TYPE_BY_ID);
                }
            }
        } catch (e) { /* ignore */ }
        return fallbackCardTypeMap;
    }

    function resolveCardType(context) {
        if (context && context.cardType) return String(context.cardType);
        const cardId = context && context.cardId ? String(context.cardId) : '';
        if (!cardId) return '';

        try {
            if (typeof globalThis !== 'undefined' && globalThis.CardLogic && typeof globalThis.CardLogic.getCardType === 'function') {
                const t = globalThis.CardLogic.getCardType(cardId);
                if (typeof t === 'string' && t) return t;
            }
        } catch (e) { /* ignore */ }

        const map = getCardTypeMap();
        return map[cardId] || '';
    }

    function pushRecent(playerState, line) {
        playerState.recent.push(line);
        if (playerState.recent.length > config.recentKeep) {
            playerState.recent.splice(0, playerState.recent.length - config.recentKeep);
        }
    }

    function pickRandomLine(playerState, lines) {
        const pool = (Array.isArray(lines) ? lines : []).filter((line) => typeof line === 'string' && line.trim());
        if (!pool.length) return '';

        const recentSet = new Set(playerState.recent || []);
        const filtered = pool.filter((line) => !recentSet.has(line));
        const source = filtered.length > 0 ? filtered : pool;
        const idx = Math.floor(Math.random() * source.length);
        const line = source[Math.max(0, Math.min(source.length - 1, idx))] || source[0] || '';
        if (line) pushRecent(playerState, line);
        return line;
    }

    function sanitize(line, maxChars) {
        const text = String(line || '').replace(/\s+/g, ' ').trim();
        if (!text) return '';
        const chars = Array.from(text);
        if (!Number.isFinite(maxChars) || maxChars <= 0 || chars.length <= maxChars) return text;
        return chars.slice(0, maxChars).join('');
    }

    function resolveTonePrefix(eventType, advantage) {
        if (eventType === 'card_used') return 'へへっ、';
        if (eventType === 'card_used_by_enemy') return 'くそっ、';
        if (eventType === 'card_targeted') return 'おっと、';
        if (eventType === 'pass') return 'ちっ、';
        if (eventType === 'board_swing') return 'よし、';
        if (isCornerOwnedEventType(eventType)) return 'よし、';
        if (isCornerLostEventType(eventType)) return 'くっ、';
        if (advantage === 'ahead') return 'へへっ、';
        if (advantage === 'behind') return 'くっ、';
        return 'よし、';
    }

    function applyToneConsistency(line, eventType, advantage) {
        const raw = String(line || '').trim();
        if (!raw) return '';
        const body = raw
            .replace(/^(へへっ、|くそっ、|おっと、|ちっ、|よし、|くっ、)+/, '')
            .replace(/[。！!？?]+$/g, '')
            .trim();
        if (!body) return '';
        const prefix = resolveTonePrefix(eventType, advantage);
        const end = (eventType === 'card_used' || eventType === 'card_used_by_enemy' || isCornerEventType(eventType)) ? '！' : '。';
        return `${prefix}${body}${end}`;
    }

    function resolveEventType(context, playerState, discDiff) {
        let eventType = String(context && context.eventType || 'turn_start').toLowerCase();
        if (eventType === 'card_used_by_enemy') return eventType;
        if (eventType === 'card_used') return eventType;
        if (eventType === 'card_targeted') return eventType;
        if (eventType === 'pass') return eventType;
        if (eventType === 'board_swing') return eventType;
        if (eventType === 'game_start') return eventType;

        const turnNumber = Number.isFinite(Number(context && context.turnNumber)) ? Number(context.turnNumber) : null;
        if (!playerState.started || (turnNumber !== null && turnNumber <= 1)) {
            return 'game_start';
        }
        if (Number.isFinite(playerState.lastDiscDiff) && Math.abs(discDiff - playerState.lastDiscDiff) >= 8) {
            return 'board_swing';
        }
        return 'turn_start';
    }

    function isAdvantageReversed(playerState, currentAdvantage) {
        const prev = String(playerState && playerState.lastAdvantage || '').toLowerCase();
        const next = String(currentAdvantage || '').toLowerCase();
        if (!prev || !next) return false;
        if (prev === 'ahead' && next === 'behind') return true;
        if (prev === 'behind' && next === 'ahead') return true;
        return false;
    }

    function shouldEmitRegularTurnLine(playerState, turnNumber) {
        const intervalRaw = Number(config.regularTurnInterval);
        const interval = Math.max(1, Math.floor(Number.isFinite(intervalRaw) ? intervalRaw : 2));
        if (interval <= 1) {
            if (Number.isFinite(turnNumber)) playerState.lastRegularCommentTurn = turnNumber;
            playerState.regularTurnCallCount = (Number(playerState.regularTurnCallCount) || 0) + 1;
            return true;
        }

        if (Number.isFinite(turnNumber)) {
            if (!Number.isFinite(playerState.lastRegularCommentTurn)) {
                playerState.lastRegularCommentTurn = turnNumber;
                return true;
            }
            if ((turnNumber - playerState.lastRegularCommentTurn) >= interval) {
                playerState.lastRegularCommentTurn = turnNumber;
                return true;
            }
            return false;
        }

        playerState.regularTurnCallCount = (Number(playerState.regularTurnCallCount) || 0) + 1;
        return ((playerState.regularTurnCallCount - 1) % interval) === 0;
    }

    function chooseTurnStartLine(playerState, phase, advantage) {
        if (phase === 'opening') {
            const roll = Math.random();
            if (roll < 0.2) return pickRandomLine(playerState, DB.tauntLines);
            if (roll < 0.35) return pickRandomLine(playerState, DB.chatterLines);
            return pickRandomLine(playerState, DB.openingLines);
        }

        if (advantage === 'behind' && playerState.behindStreak >= config.behindThreshold) {
            const fromNegative = Math.random() < 0.75;
            if (fromNegative) return pickRandomLine(playerState, DB.negativeLines);
            return pickRandomLine(playerState, DB.bluffLines);
        }

        if (playerState.unchangedStreak >= config.unchangedThreshold) {
            if (advantage === 'ahead') {
                if (Math.random() < 0.55) return pickRandomLine(playerState, DB.tauntLines);
                return pickRandomLine(playerState, DB.middleAheadLines);
            }
            if (advantage === 'behind') {
                const roll = Math.random();
                if (roll < 0.45) return pickRandomLine(playerState, DB.negativeLines);
                if (roll < 0.70) return pickRandomLine(playerState, DB.bluffLines);
                return pickRandomLine(playerState, DB.chatterLines);
            }
            const roll = Math.random();
            if (roll < 0.5) return pickRandomLine(playerState, DB.chatterLines);
            if (roll < 0.8) return pickRandomLine(playerState, DB.tauntLines);
            return pickRandomLine(playerState, DB.bluffLines);
        }

        if (phase === 'endgame') {
            if (advantage === 'ahead') {
                if (Math.random() < 0.35) return pickRandomLine(playerState, DB.tauntLines);
                return pickRandomLine(playerState, DB.endAheadLines);
            }
            if (advantage === 'behind') {
                const roll = Math.random();
                if (roll < 0.55) return pickRandomLine(playerState, DB.negativeLines);
                if (roll < 0.75) return pickRandomLine(playerState, DB.bluffLines);
                return pickRandomLine(playerState, DB.endBehindLines);
            }
            return pickRandomLine(playerState, DB.endEvenLines);
        }

        if (advantage === 'ahead') {
            if (Math.random() < 0.3) return pickRandomLine(playerState, DB.tauntLines);
            return pickRandomLine(playerState, DB.middleAheadLines);
        }
        if (advantage === 'behind') {
            const roll = Math.random();
            if (roll < 0.35) return pickRandomLine(playerState, DB.negativeLines);
            if (roll < 0.52) return pickRandomLine(playerState, DB.bluffLines);
            return pickRandomLine(playerState, DB.middleBehindLines);
        }

        if (Math.random() < 0.2) return pickRandomLine(playerState, DB.chatterLines);
        return pickRandomLine(playerState, DB.middleEvenLines);
    }

    function buildCommentary(context) {
        const ctx = context && typeof context === 'object' ? context : {};
        const playerKey = normalizePlayerKey(ctx.playerKey);
        const playerState = perPlayerState[playerKey] || (perPlayerState[playerKey] = createPlayerState());

        const counts = normalizeCounts(ctx);
        const corners = normalizeCorners(ctx, playerKey);
        const phase = normalizePhase(ctx.phase, ctx.turnNumber, (counts.black + counts.white));
        const advantage = resolveAdvantage(ctx, playerKey, counts, corners);

        const own = playerKey === 'black' ? counts.black : counts.white;
        const opp = playerKey === 'black' ? counts.white : counts.black;
        const discDiff = own - opp;
        const cornerDiff = (corners.own || 0) - (corners.opp || 0);
        const turnNumber = Number.isFinite(Number(ctx.turnNumber)) ? Number(ctx.turnNumber) : null;
        const phaseChanged = !!playerState.started && !!playerState.lastPhase && playerState.lastPhase !== phase;
        const advantageReversed = !!playerState.started && isAdvantageReversed(playerState, advantage);

        const situationKey = `${phase}|${advantage}|${Math.sign(discDiff)}|${Math.sign(cornerDiff)}`;
        if (playerState.lastSituationKey === situationKey) {
            playerState.unchangedStreak += 1;
        } else {
            playerState.unchangedStreak = 0;
            playerState.lastSituationKey = situationKey;
        }

        if (phase !== 'opening' && advantage === 'behind') {
            playerState.behindStreak += 1;
        } else {
            playerState.behindStreak = 0;
        }

        const cornerEventType = resolveCornerEventType(playerState, corners);
        const eventType = cornerEventType || resolveEventType(ctx, playerState, discDiff);
        const isInterruptEvent = eventType !== 'turn_start' || phaseChanged || advantageReversed;
        playerState.started = true;
        playerState.lastDiscDiff = discDiff;
        playerState.lastTurnNumber = (turnNumber !== null) ? turnNumber : playerState.lastTurnNumber;
        playerState.lastPhase = phase;
        playerState.lastAdvantage = advantage;

        if (!isInterruptEvent && !shouldEmitRegularTurnLine(playerState, turnNumber)) {
            return '';
        }

        let line = '';
        if (eventType === 'game_start') {
            line = pickRandomLine(playerState, DB.openingLines);
        } else if (eventType === 'corner_first_owned') {
            line = pickRandomLine(playerState, DB.cornerFirstOwnedLines || DB.middleAheadLines);
        } else if (eventType === 'corner_first_lost') {
            line = pickRandomLine(playerState, DB.cornerFirstLostLines || DB.middleBehindLines);
        } else if (eventType === 'corner_streak_two_owned') {
            line = pickRandomLine(playerState, DB.cornerStreakTwoOwnedLines || DB.middleAheadLines);
        } else if (eventType === 'corner_streak_two_lost') {
            line = pickRandomLine(playerState, DB.cornerStreakTwoLostLines || DB.middleBehindLines);
        } else if (eventType === 'corner_streak_three_owned') {
            line = pickRandomLine(playerState, DB.cornerStreakThreeOwnedLines || DB.endAheadLines);
        } else if (eventType === 'corner_streak_three_lost') {
            line = pickRandomLine(playerState, DB.cornerStreakThreeLostLines || DB.endBehindLines);
        } else if (eventType === 'corner_all_owned') {
            line = pickRandomLine(playerState, DB.cornerAllOwnedLines || DB.endAheadLines);
        } else if (eventType === 'corner_all_lost') {
            line = pickRandomLine(playerState, DB.cornerAllLostLines || DB.endBehindLines);
        } else if (eventType === 'board_swing') {
            line = pickRandomLine(playerState, DB.boardSwingLines);
        } else if (eventType === 'pass') {
            line = pickRandomLine(playerState, DB.passLines);
        } else if (eventType === 'card_targeted') {
            line = pickRandomLine(playerState, DB.cardTargetLines);
        } else if (eventType === 'card_used') {
            const type = resolveCardType(ctx);
            line = pickRandomLine(playerState, DB.getCardUseLines(type, advantage));
        } else if (eventType === 'card_used_by_enemy') {
            const type = resolveCardType(ctx);
            line = pickRandomLine(playerState, DB.getCardHitLines(type, advantage));
        } else {
            line = chooseTurnStartLine(playerState, phase, advantage);
        }

        const unified = applyToneConsistency(line, eventType, advantage);
        return sanitize(unified, Number(config.maxChars));
    }

    function requestCommentary(context) {
        if (!isEnabled()) return Promise.resolve(null);
        const line = buildCommentary(context || {});
        return Promise.resolve(line || null);
    }

    function resetState() {
        perPlayerState.black = createPlayerState();
        perPlayerState.white = createPlayerState();
    }

    return {
        isEnabled,
        setConfig,
        getStatus,
        requestCommentary,
        resetState,
        _buildCommentaryForTest: buildCommentary
    };
}));
