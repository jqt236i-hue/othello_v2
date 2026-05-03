// @ts-nocheck
import type { CardState, GameState, PlayerKey } from '../../src/types';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

function createEngine() {
let Data: any = null;
let CommentaryContextHelpers: any = null;
let CommentaryRuntimeHelpers: any = null;
let OwnerHelpersModule: any = null;
try {
    Data = _require('../../data/dialogue/fixed-commentary-data');
} catch (e) { Data = null; }
if (!Data) {
    try { Data = _require('../..//data/dialogue/fixed-commentary-data'); } catch (e) { Data = null; }
}
try { CommentaryContextHelpers = _require('../../shared/commentary-context-helpers'); } catch (e) { CommentaryContextHelpers = null; }
try { CommentaryRuntimeHelpers = _require('../../shared/commentary-runtime-helpers'); } catch (e) { CommentaryRuntimeHelpers = null; }
try { OwnerHelpersModule = _require('../../utils/owner-helpers'); } catch (e) { OwnerHelpersModule = null; }


    const DEFAULT_DATA = {
        CARD_TYPE_LABELS: {},
        CPU_COMMENTARY_DEFAULT_LEVEL: 3,
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
        heroChatterLines: ['まだ五分だ、次の一手で流れを作る'],
        heroAheadLines: ['この優位を崩さず、次も主導権を取る'],
        heroBehindLines: ['苦しくても、ここから逆転の筋を拾う'],
        heroCornerGainLines: ['角を取った、この流れを勝ち筋につなげる'],
        heroCornerLossLines: ['角を取られた、でもここから立て直す'],
        cornerFirstOwnedLines: ['角を先に取った、この流れは渡さない'],
        cornerFirstLostLines: ['先に角を取られた、ここから立て直す'],
        cornerStreakTwoOwnedLines: ['角を連続で取った、このまま押し切る'],
        cornerStreakTwoLostLines: ['角を連続で取られた、受けを固める'],
        cornerStreakThreeOwnedLines: ['角を3連続で取った、勝ち筋が太い'],
        cornerStreakThreeLostLines: ['角を3連続で失った、まだ逆転は捨てない'],
        cornerAllOwnedLines: ['四隅を全部取った、盤面は支配した'],
        cornerAllLostLines: ['四隅を全部取られた、最後まで食らいつく'],
        getCardUseLines: function () { return ['ここでカードを切る、流れを動かす']; },
        getCardHitLines: function () { return ['そのカードは重い、受け切って返す']; },
        getHeroCardUseLines: function () { return ['ここでカードを使う、この一手で流れを引き寄せる']; },
        getHeroCardHitLines: function () { return ['相手がカードを切った、受けて返す手を探す']; }
    };

    const DB = Data || DEFAULT_DATA;

    const DEFAULT_CONFIG = {
        enabled: true,
        maxChars: 60,
        recentKeep: 8,
        regularTurnInterval: 2,
        unchangedThreshold: 1,
        behindThreshold: 2,
        cornerWeight: 4
    };

    const config = Object.assign({}, DEFAULT_CONFIG);
    const perSpeakerState = Object.create(null);
    const CPU_TONE_PREFIXES = Object.freeze({
        goblin: Object.freeze({
            default: 'グヘヘ、',
            ahead: 'ケケッ、',
            behind: 'グギッ、',
            card_used: 'ゲヒヒ、',
            card_used_by_enemy: 'ギャッ、',
            card_targeted: 'ケッ、',
            pass: 'チッ、',
            board_swing: 'グハハ、',
            corner_owned: 'グヘヘ、',
            corner_lost: 'ギリッ、'
        }),
        boss: Object.freeze({
            default: 'さて、',
            ahead: 'フフ、',
            behind: 'まだだ、',
            card_used: '見せよう、',
            card_used_by_enemy: 'なるほど、',
            card_targeted: '把握している、',
            pass: '……',
            board_swing: 'いいだろう、',
            corner_owned: '当然だ、',
            corner_lost: '侮るな、'
        }),
        finalBoss: Object.freeze({
            default: '観測どおり、',
            ahead: '既定どおり、',
            behind: '想定内だ、',
            card_used: '介入する、',
            card_used_by_enemy: '誤差か、',
            card_targeted: '把握済みだ、',
            pass: 'まだだ、',
            board_swing: '再計算する、',
            corner_owned: '収束した、',
            corner_lost: '補正する、'
        })
    });

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

    function normalizeSpeakerRole(value) {
        try {
            if (CommentaryRuntimeHelpers && typeof CommentaryRuntimeHelpers.normalizeSpeakerRole === 'function') {
                return CommentaryRuntimeHelpers.normalizeSpeakerRole(value, 'cpu');
            }
        } catch (e) { /* ignore */ }
        return String(value || '').trim().toLowerCase() === 'hero' ? 'hero' : 'cpu';
    }

    function buildSpeakerStateKey(speakerRole, playerKey) {
        return `${normalizeSpeakerRole(speakerRole)}:${normalizePlayerKey(playerKey)}`;
    }

    function getSpeakerState(speakerRole, playerKey) {
        const stateKey = buildSpeakerStateKey(speakerRole, playerKey);
        if (!perSpeakerState[stateKey]) {
            perSpeakerState[stateKey] = createPlayerState();
        }
        return perSpeakerState[stateKey];
    }

    function initializeSpeakerStates() {
        for (const speakerRole of ['cpu', 'hero']) {
            for (const playerKey of ['black', 'white']) {
                perSpeakerState[buildSpeakerStateKey(speakerRole, playerKey)] = createPlayerState();
            }
        }
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
                const forced = toBool(globalThis.CPU_TALK_ENABLED); // @compat - test flag
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

    function getDefaultCpuCommentaryLevel() {
        const raw = Number(DB && DB.CPU_COMMENTARY_DEFAULT_LEVEL);
        if (Number.isFinite(raw) && raw >= 1) return Math.floor(raw);
        return 3;
    }

    function normalizeCpuCommentaryLevel(value) {
        const raw = Number(value);
        if (!Number.isFinite(raw)) return getDefaultCpuCommentaryLevel();
        return Math.max(1, Math.floor(raw));
    }

    function resolveCpuCommentaryTier(level) {
        try {
            if (DB && typeof DB.resolveCpuCommentaryTier === 'function') {
                const resolved = DB.resolveCpuCommentaryTier(level);
                if (resolved === 'goblin' || resolved === 'boss' || resolved === 'finalBoss') return resolved;
            }
        } catch (e) { /* ignore */ }

        const normalizedLevel = normalizeCpuCommentaryLevel(level);
        if (normalizedLevel >= 6) return 'finalBoss';
        if (normalizedLevel >= 3) return 'boss';
        return 'goblin';
    }

    function resolveCpuCommentaryLevel(context) {
        const ctx = context && typeof context === 'object' ? context : {};
        return normalizeCpuCommentaryLevel(
            ctx.level !== undefined ? ctx.level
                : (ctx.cpuLevel !== undefined ? ctx.cpuLevel : ctx.difficultyLevel)
        );
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

        try {
            if (CommentaryContextHelpers && typeof CommentaryContextHelpers.resolveAdvantageLabel === 'function') {
                const resolved = CommentaryContextHelpers.resolveAdvantageLabel(playerKey, counts, {
                    board: Array.isArray(context && context.board) ? context.board : null,
                    turnNumber: Number.isFinite(Number(context && context.turnNumber)) ? Number(context.turnNumber) : null,
                    occupiedCells: (counts.black || 0) + (counts.white || 0),
                    phase: String(context && context.phase || '').toLowerCase()
                });
                if (resolved === 'ahead' || resolved === 'behind' || resolved === 'even') return resolved;
            }
        } catch (e) { /* ignore */ }

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
            const Shared = _require('../../shared-constants');
            if (Shared && Shared.CARD_TYPE_BY_ID) {
                fallbackCardTypeMap = Object.assign({}, Shared.CARD_TYPE_BY_ID);
            }
        } catch (e) { /* ignore */ }
        return fallbackCardTypeMap;
    }

    function resolveCardType(context) {
        if (context && context.cardType) return String(context.cardType);
        const cardId = context && context.cardId ? String(context.cardId) : '';
        if (!cardId) return '';

        try {
            const CardLogic = _require('../logic/cards');
            if (CardLogic && typeof CardLogic.getCardType === 'function') {
                const t = CardLogic.getCardType(cardId);
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

    function pickRandomLineFromPools(playerState, pools) {
        const recentSet = new Set(playerState.recent || []);
        const allPools = [];
        const freshPools = [];

        for (const pool of (Array.isArray(pools) ? pools : [])) {
            const lines = (Array.isArray(pool) ? pool : []).filter((line) => typeof line === 'string' && line.trim());
            if (!lines.length) continue;
            allPools.push(lines);

            const freshLines = lines.filter((line) => !recentSet.has(line));
            if (freshLines.length) freshPools.push(freshLines);
        }

        const sourcePools = freshPools.length ? freshPools : allPools;
        if (!sourcePools.length) return '';

        const poolIdx = Math.floor(Math.random() * sourcePools.length);
        const selected = sourcePools[Math.max(0, Math.min(sourcePools.length - 1, poolIdx))] || sourcePools[0] || [];
        return pickRandomLine(playerState, selected);
    }

    function sanitize(line, maxChars) {
        const text = String(line || '').replace(/\s+/g, ' ').trim();
        if (!text) return '';
        const chars = Array.from(text);
        if (!Number.isFinite(maxChars) || maxChars <= 0 || chars.length <= maxChars) return text;

        const tokens = text.match(/[^\s、。！!？?]+(?:[、。！!？?]+)?|\s+/g) || [];
        let compact = '';
        for (const token of tokens) {
            const candidate = compact + token;
            if (Array.from(candidate).length > maxChars) break;
            compact = candidate;
        }

        const normalizedCompact = String(compact || '')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/[、，\s]+$/g, '')
            .replace(/[。！!？?]+$/g, '');
        if (normalizedCompact) return normalizedCompact;

        return chars
            .slice(0, maxChars)
            .join('')
            .replace(/[、，\s]+$/g, '')
            .replace(/[。！!？?]+$/g, '');
    }

    function resolveTonePrefix(eventType, advantage, speakerRole, level) {
        if (speakerRole === 'cpu') {
            const prefixes = CPU_TONE_PREFIXES[resolveCpuCommentaryTier(level)] || CPU_TONE_PREFIXES.boss;
            if (eventType === 'card_used') return prefixes.card_used;
            if (eventType === 'card_used_by_enemy') return prefixes.card_used_by_enemy;
            if (eventType === 'card_targeted') return prefixes.card_targeted;
            if (eventType === 'pass') return prefixes.pass;
            if (eventType === 'board_swing') return prefixes.board_swing;
            if (isCornerOwnedEventType(eventType)) return prefixes.corner_owned;
            if (isCornerLostEventType(eventType)) return prefixes.corner_lost;
            if (advantage === 'ahead') return prefixes.ahead;
            if (advantage === 'behind') return prefixes.behind;
            return prefixes.default;
        }
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

    function applyToneConsistency(line, eventType, advantage, speakerRole, level) {
        const raw = String(line || '').trim();
        if (!raw) return '';
        const body = raw
            .replace(/^(へへっ、|くそっ、|おっと、|ちっ、|よし、|くっ、|グヘヘ、|ケケッ、|グギッ、|ゲヒヒ、|ギャッ、|ケッ、|チッ、|グハハ、|ギリッ、|さて、|フフ、|まだだ、|見せよう、|なるほど、|把握している、|……|いいだろう、|当然だ、|侮るな、|観測どおり、|既定どおり、|想定内だ、|介入する、|誤差か、|把握済みだ、|再計算する、|収束した、|補正する、)+/, '')
            .replace(/[。！!？?]+$/g, '')
            .trim();
        if (!body) return '';
        const prefix = resolveTonePrefix(eventType, advantage, speakerRole, level);
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

    function chooseTurnStartLine(playerState, phase, advantage, level) {
        if (advantage === 'ahead') {
            return pickCpuPoolLine(
                playerState,
                resolveCpuFixedPool(DB.getCpuAheadLines, DB.cpuAheadLines, DB.middleAheadLines, DEFAULT_DATA.middleAheadLines, level)
            );
        }
        if (advantage === 'behind') {
            return pickCpuPoolLine(
                playerState,
                resolveCpuFixedPool(DB.getCpuBehindLines, DB.cpuBehindLines, DB.middleBehindLines, DEFAULT_DATA.middleBehindLines, level)
            );
        }
        return pickCpuPoolLine(
            playerState,
            resolveCpuFixedPool(DB.getCpuChatterLines, DB.cpuChatterLines, DB.chatterLines, DEFAULT_DATA.chatterLines, level)
        );
    }

    function resolveLinePool(primaryLines, fallbackLines) {
        if (Array.isArray(primaryLines) && primaryLines.length) return primaryLines;
        if (Array.isArray(fallbackLines) && fallbackLines.length) return fallbackLines;
        return [];
    }

    function resolveLineFactory(primaryFactory, fallbackFactory) {
        if (typeof primaryFactory === 'function') return primaryFactory;
        if (typeof fallbackFactory === 'function') return fallbackFactory;
        return function () { return []; };
    }

    function resolveCpuPool(sharedLines, legacyLines, fallbackLines) {
        if (Array.isArray(sharedLines) && sharedLines.length) return sharedLines;
        return resolveLinePool(legacyLines, fallbackLines);
    }

    function resolveCpuFixedPool(getter, sharedLines, legacyLines, fallbackLines, level) {
        if (typeof getter === 'function') {
            const lines = getter(level);
            if (Array.isArray(lines) && lines.length) return lines;
        }
        return resolveCpuPool(sharedLines, legacyLines, fallbackLines);
    }

    function pickCpuPoolLine(playerState, lines) {
        return pickRandomLine(playerState, Array.isArray(lines) ? lines : []);
    }

    function chooseHeroLine(playerState, eventType, advantage, context) {
        if (isCornerOwnedEventType(eventType)) {
            return pickRandomLine(
                playerState,
                resolveLinePool(DB.heroCornerGainLines, DEFAULT_DATA.heroCornerGainLines)
            );
        }
        if (isCornerLostEventType(eventType)) {
            return pickRandomLine(
                playerState,
                resolveLinePool(DB.heroCornerLossLines, DEFAULT_DATA.heroCornerLossLines)
            );
        }
        if (eventType === 'card_used') {
            const type = resolveCardType(context);
            const factory = resolveLineFactory(DB.getHeroCardUseLines, DEFAULT_DATA.getHeroCardUseLines);
            return pickRandomLine(playerState, factory(type, advantage));
        }
        if (eventType === 'card_used_by_enemy') {
            const type = resolveCardType(context);
            const factory = resolveLineFactory(DB.getHeroCardHitLines, DEFAULT_DATA.getHeroCardHitLines);
            return pickRandomLine(playerState, factory(type, advantage));
        }
        if (advantage === 'ahead') {
            return pickRandomLine(playerState, resolveLinePool(DB.heroAheadLines, DEFAULT_DATA.heroAheadLines));
        }
        if (advantage === 'behind') {
            return pickRandomLine(playerState, resolveLinePool(DB.heroBehindLines, DEFAULT_DATA.heroBehindLines));
        }
        return pickRandomLine(playerState, resolveLinePool(DB.heroChatterLines, DEFAULT_DATA.heroChatterLines));
    }

    function chooseCpuLine(playerState, eventType, phase, advantage, context, level) {
        if (eventType === 'game_start') {
            return pickCpuPoolLine(
                playerState,
                resolveCpuFixedPool(DB.getCpuChatterLines, DB.cpuChatterLines, DB.openingLines, DEFAULT_DATA.openingLines, level)
            );
        }
        if (eventType === 'corner_first_owned') {
            return pickCpuPoolLine(
                playerState,
                resolveCpuFixedPool(DB.getCpuCornerGainLines, DB.cpuCornerGainLines, DB.cornerFirstOwnedLines, DEFAULT_DATA.middleAheadLines, level)
            );
        }
        if (eventType === 'corner_first_lost') {
            return pickCpuPoolLine(
                playerState,
                resolveCpuFixedPool(DB.getCpuCornerLossLines, DB.cpuCornerLossLines, DB.cornerFirstLostLines, DEFAULT_DATA.middleBehindLines, level)
            );
        }
        if (eventType === 'corner_streak_two_owned') {
            return pickCpuPoolLine(
                playerState,
                resolveCpuFixedPool(DB.getCpuCornerGainLines, DB.cpuCornerGainLines, DB.cornerStreakTwoOwnedLines, DEFAULT_DATA.middleAheadLines, level)
            );
        }
        if (eventType === 'corner_streak_two_lost') {
            return pickCpuPoolLine(
                playerState,
                resolveCpuFixedPool(DB.getCpuCornerLossLines, DB.cpuCornerLossLines, DB.cornerStreakTwoLostLines, DEFAULT_DATA.middleBehindLines, level)
            );
        }
        if (eventType === 'corner_streak_three_owned') {
            return pickCpuPoolLine(
                playerState,
                resolveCpuFixedPool(DB.getCpuCornerGainLines, DB.cpuCornerGainLines, DB.cornerStreakThreeOwnedLines, DEFAULT_DATA.endAheadLines, level)
            );
        }
        if (eventType === 'corner_streak_three_lost') {
            return pickCpuPoolLine(
                playerState,
                resolveCpuFixedPool(DB.getCpuCornerLossLines, DB.cpuCornerLossLines, DB.cornerStreakThreeLostLines, DEFAULT_DATA.endBehindLines, level)
            );
        }
        if (eventType === 'corner_all_owned') {
            return pickCpuPoolLine(
                playerState,
                resolveCpuFixedPool(DB.getCpuCornerGainLines, DB.cpuCornerGainLines, DB.cornerAllOwnedLines, DEFAULT_DATA.endAheadLines, level)
            );
        }
        if (eventType === 'corner_all_lost') {
            return pickCpuPoolLine(
                playerState,
                resolveCpuFixedPool(DB.getCpuCornerLossLines, DB.cpuCornerLossLines, DB.cornerAllLostLines, DEFAULT_DATA.endBehindLines, level)
            );
        }
        if (eventType === 'board_swing') {
            return chooseTurnStartLine(playerState, phase, advantage, level);
        }
        if (eventType === 'pass') {
            return chooseTurnStartLine(playerState, phase, advantage, level);
        }
        if (eventType === 'card_targeted') {
            return chooseTurnStartLine(playerState, phase, advantage, level);
        }
        if (eventType === 'card_used') {
            const type = resolveCardType(context);
            const factory = resolveLineFactory(DB.getCardUseLines, DEFAULT_DATA.getCardUseLines);
            return pickRandomLine(playerState, factory(type, advantage, level));
        }
        if (eventType === 'card_used_by_enemy') {
            const type = resolveCardType(context);
            const factory = resolveLineFactory(DB.getCardHitLines, DEFAULT_DATA.getCardHitLines);
            return pickRandomLine(playerState, factory(type, advantage, level));
        }
        return chooseTurnStartLine(playerState, phase, advantage, level);
    }

    function buildCommentary(context) {
        const ctx = context && typeof context === 'object' ? context : {};
        const playerKey = normalizePlayerKey(ctx.playerKey);
        const speakerRole = normalizeSpeakerRole(ctx.speakerRole);
        const playerState = getSpeakerState(speakerRole, playerKey);

        const counts = normalizeCounts(ctx);
        const corners = normalizeCorners(ctx, playerKey);
        const phase = normalizePhase(ctx.phase, ctx.turnNumber, (counts.black + counts.white));
        const advantage = resolveAdvantage(ctx, playerKey, counts, corners);
        const commentaryLevel = speakerRole === 'cpu' ? resolveCpuCommentaryLevel(ctx) : null;

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

        const line = speakerRole === 'hero'
            ? chooseHeroLine(playerState, eventType, advantage, ctx)
            : chooseCpuLine(playerState, eventType, phase, advantage, ctx, commentaryLevel);

        const unified = applyToneConsistency(line, eventType, advantage, speakerRole, commentaryLevel);
        return sanitize(unified, Number(config.maxChars));
    }

    function requestCommentary(context) {
        if (!isEnabled()) return Promise.resolve(null);
        const line = buildCommentary(context || {});
        return Promise.resolve(line || null);
    }

    function resetState() {
        for (const key of Object.keys(perSpeakerState)) {
            delete perSpeakerState[key];
        }
        initializeSpeakerStates();
    }

    initializeSpeakerStates();

    return {
        isEnabled,
        setConfig,
        getStatus,
        requestCommentary,
        resetState,
        _buildCommentaryForTest: buildCommentary
    };
}

const engine = createEngine();

export = engine;