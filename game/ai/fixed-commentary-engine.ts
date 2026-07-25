
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
    Data = _require('./commentary-data');
} catch (e) { Data = null; }
if (!Data) {
    try { Data = _require('./commentary-data.js'); } catch (e) { Data = null; }
}
try { CommentaryContextHelpers = _require('../../shared/commentary-context-helpers'); } catch (e) { CommentaryContextHelpers = null; }
try { CommentaryRuntimeHelpers = _require('../../shared/commentary-runtime-helpers'); } catch (e) { CommentaryRuntimeHelpers = null; }
try { OwnerHelpersModule = _require('../../utils/owner-helpers'); } catch (e) { OwnerHelpersModule = null; }


    const DEFAULT_DATA = {
        CARD_TYPE_LABELS: {},
        CPU_COMMENTARY_DEFAULT_LEVEL: 4,
        openingLines: ['盤面を見て次の手を考える'],
        middleAheadLines: ['優位を崩さず、次の形を作る'],
        middleEvenLines: ['まだ互角だ、次の一手を読む'],
        middleBehindLines: ['不利だが、返す手は残っている'],
        endAheadLines: ['終盤の優位を確実に守る'],
        endEvenLines: ['終盤でもまだ勝負は動く'],
        endBehindLines: ['終盤の不利を受けながら逆転を探す'],
        chatterLines: ['盤面を見て次の手を考える'],
        tauntLines: ['この流れなら主導権を取れる'],
        negativeLines: ['不利だが、まだ立て直せる'],
        bluffLines: ['無理をせず、次の形を作る'],
        boardSwingLines: ['盤面が動いた、流れを読み直す'],
        passLines: ['打てる場所がない、次に備える'],
        cardTargetLines: ['狙いを確認し、返しを準備する'],
        cornerFirstOwnedLines: ['角を先に取った、この流れを守る'],
        cornerFirstLostLines: ['角を取られたが、ここから立て直す'],
        cornerStreakTwoOwnedLines: ['角を続けて取った、形を固める'],
        cornerStreakTwoLostLines: ['角を続けて取られた、辺を固め直す'],
        cornerStreakThreeOwnedLines: ['角を重ねて取った、終盤まで形を残す'],
        cornerStreakThreeLostLines: ['角を重ねて失った、中央で受ける'],
        cornerAllOwnedLines: ['四隅を取った、終盤の形は強い'],
        cornerAllLostLines: ['四隅を取られたが、返し筋を探す'],
        getCardUseLines: function (cardType: any) {
            const label = String(cardType || 'カード').trim() || 'カード';
            return [`${label}の効果を使い、盤面を動かす`];
        },
        getCardHitLines: function (cardType: any) {
            const label = String(cardType || 'カード').trim() || 'カード';
            return [`相手の${label}を受け、盤面を立て直す`];
        }
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

    const config: any = Object.assign({}, DEFAULT_CONFIG);
    const perSpeakerState = Object.create(null);
    const CPU_TONE_PREFIXES = Object.freeze({
        goblin: Object.freeze({
            default: 'へへっ、',
            ahead: 'このまま、',
            behind: 'まだだ、',
            card_used: 'よし、',
            card_used_by_enemy: 'くっ、',
            card_targeted: '見えてる、',
            pass: '置けないな、',
            board_swing: '動いたな、',
            corner_owned: 'よし、',
            corner_lost: 'まずいな、'
        }),
        boss: Object.freeze({
            default: 'さて、',
            ahead: 'この流れだ、',
            behind: 'まだだ、',
            card_used: 'では、',
            card_used_by_enemy: 'なるほど、',
            card_targeted: '読んでいる、',
            pass: '手がないな、',
            board_swing: '流れが変わった、',
            corner_owned: '角は取った、',
            corner_lost: '受け直す、'
        }),
        finalBoss: Object.freeze({
            default: '解析する、',
            ahead: '優位を維持する、',
            behind: '再計算する、',
            card_used: '実行する、',
            card_used_by_enemy: '影響を確認する、',
            card_targeted: '対象は把握した、',
            pass: '手番を送る、',
            board_swing: '盤面を更新する、',
            corner_owned: '角を確保した、',
            corner_lost: '損失を補正する、'
        })
    });

    let fallbackCardTypeMap: any = null;

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

    function normalizeSpeakerRole(value: any) {
        try {
            if (CommentaryRuntimeHelpers && typeof CommentaryRuntimeHelpers.normalizeSpeakerRole === 'function') {
                const role = CommentaryRuntimeHelpers.normalizeSpeakerRole(value, 'cpu');
                return role === 'cpu' ? 'cpu' : 'cpu';
            }
        } catch (e) { /* ignore */ }
        return 'cpu';
    }

    function buildSpeakerStateKey(speakerRole: any, playerKey: any) {
        return `${normalizeSpeakerRole(speakerRole)}:${normalizePlayerKey(playerKey)}`;
    }

    function getSpeakerState(speakerRole: any, playerKey: any) {
        const stateKey = buildSpeakerStateKey(speakerRole, playerKey);
        if (!perSpeakerState[stateKey]) {
            perSpeakerState[stateKey] = createPlayerState();
        }
        return perSpeakerState[stateKey];
    }

    function initializeSpeakerStates() {
        for (const playerKey of ['black', 'white']) {
            perSpeakerState[buildSpeakerStateKey('cpu', playerKey)] = createPlayerState();
        }
    }

    function clampCornerCount(value: any) {
        const num = Number(value);
        if (!Number.isFinite(num)) return 0;
        if (num <= 0) return 0;
        if (num >= 4) return 4;
        return Math.floor(num);
    }

    function classifyCornerGainEvent(isOwnSide: any, streak: any, reachedAll: any, reachedFirst: any) {
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

    function resolveCornerEventType(playerState: any, corners: any) {
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

    function isCornerOwnedEventType(eventType: any) {
        return eventType === 'corner_first_owned' ||
            eventType === 'corner_streak_two_owned' ||
            eventType === 'corner_streak_three_owned' ||
            eventType === 'corner_all_owned';
    }

    function isCornerLostEventType(eventType: any) {
        return eventType === 'corner_first_lost' ||
            eventType === 'corner_streak_two_lost' ||
            eventType === 'corner_streak_three_lost' ||
            eventType === 'corner_all_lost';
    }

    function isCornerEventType(eventType: any) {
        return isCornerOwnedEventType(eventType) || isCornerLostEventType(eventType);
    }

    function toBool(value: any) {
        if (value === true || value === 1 || value === '1') return true;
        if (value === false || value === 0 || value === '0') return false;
        if (typeof value === 'string') {
            const s = value.trim().toLowerCase();
            if (s === 'true' || s === 'on' || s === 'yes') return true;
            if (s === 'false' || s === 'off' || s === 'no') return false;
        }
        return null;
    }

    function readQueryFlag(name: any) {
        try {
            const search = typeof config.readQuerySearch === 'function'
                ? String(config.readQuerySearch() || '')
                : '';
            if (!search) return null;
            const params = new URLSearchParams(search);
            if (!params.has(name)) return null;
            return toBool(params.get(name));
        } catch (e) {
            return null;
        }
    }

    function isEnabled() {
        try {
            if (typeof config.readCpuTalkEnabled === 'function') {
                const forced = toBool(config.readCpuTalkEnabled());
                if (forced !== null) return forced;
            }
        } catch (e) { /* ignore */ }
        const query = readQueryFlag('cpuTalk');
        if (query !== null) return query;
        const queryAlt = readQueryFlag('cpu_talk');
        if (queryAlt !== null) return queryAlt;

        return !!config.enabled;
    }

    function setConfig(nextConfig: any) {
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

    function normalizePlayerKey(value: any) {
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

    function normalizePhase(value: any, turnNumber: any, occupiedCells: any) {
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

    function normalizeCpuCommentaryLevel(value: any) {
        const raw = Number(value);
        if (!Number.isFinite(raw)) return getDefaultCpuCommentaryLevel();
        return Math.max(1, Math.floor(raw));
    }

    function resolveCpuCommentaryTier(level: any) {
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

    function resolveCpuCommentaryLevel(context: any) {
        const ctx = context && typeof context === 'object' ? context : {};
        return normalizeCpuCommentaryLevel(
            ctx.level !== undefined ? ctx.level
                : (ctx.cpuLevel !== undefined ? ctx.cpuLevel : ctx.difficultyLevel)
        );
    }

    function countCornersFromBoard(board: any, playerKey: any) {
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

    function normalizeCounts(context: any) {
        const counts = context && context.counts ? context.counts : {};
        const black = Number.isFinite(Number(counts.black)) ? Number(counts.black) : 0;
        const white = Number.isFinite(Number(counts.white)) ? Number(counts.white) : 0;
        return { black, white };
    }

    function normalizeCorners(context: any, playerKey: any) {
        const corners = context && context.corners ? context.corners : null;
        if (corners && Number.isFinite(Number(corners.own)) && Number.isFinite(Number(corners.opp))) {
            return { own: Number(corners.own), opp: Number(corners.opp) };
        }
        if (Array.isArray(context && context.board)) {
            return countCornersFromBoard(context.board, playerKey);
        }
        return { own: 0, opp: 0 };
    }

    function resolveAdvantage(context: any, playerKey: any, counts: any, corners: any) {
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

    function resolveCardType(context: any) {
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

    function pushRecent(playerState: any, line: any) {
        playerState.recent.push(line);
        if (playerState.recent.length > config.recentKeep) {
            playerState.recent.splice(0, playerState.recent.length - config.recentKeep);
        }
    }

    function readRandomUnit() {
        const randomSource = config && config.randomSource;
        if (randomSource && typeof randomSource.random === 'function') {
            const value = Number(randomSource.random());
            if (Number.isFinite(value)) return Math.max(0, Math.min(0.999999999999, value));
        }
        return Math.random();
    }

    function pickRandomLine(playerState: any, lines: any) {
        const pool = (Array.isArray(lines) ? lines : []).filter((line) => typeof line === 'string' && line.trim());
        if (!pool.length) return '';

        const recentSet = new Set(playerState.recent || []);
        const filtered = pool.filter((line) => !recentSet.has(line));
        const source = filtered.length > 0 ? filtered : pool;
        const idx = Math.floor(readRandomUnit() * source.length);
        const line = source[Math.max(0, Math.min(source.length - 1, idx))] || source[0] || '';
        if (line) pushRecent(playerState, line);
        return line;
    }

    function pickRandomLineFromPools(playerState: any, pools: any) {
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

        const poolIdx = Math.floor(readRandomUnit() * sourcePools.length);
        const selected = sourcePools[Math.max(0, Math.min(sourcePools.length - 1, poolIdx))] || sourcePools[0] || [];
        return pickRandomLine(playerState, selected);
    }

    function sanitize(line: any, maxChars: any) {
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

    function resolveTonePrefix(eventType: any, advantage: any, speakerRole: any, level: any) {
        const prefixes = (CPU_TONE_PREFIXES as any)[resolveCpuCommentaryTier(level)] || CPU_TONE_PREFIXES.boss;
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

    function applyToneConsistency(line: any, eventType: any, advantage: any, speakerRole: any, level: any) {
        const raw = String(line || '').trim();
        if (!raw) return '';
        const body = raw
            .replace(/^(へへっ、|このまま、|まだだ、|よし、|くっ、|見えてる、|置けないな、|動いたな、|まずいな、|さて、|この流れだ、|では、|なるほど、|読んでいる、|手がないな、|流れが変わった、|角は取った、|受け直す、|解析する、|優位を維持する、|再計算する、|実行する、|影響を確認する、|対象は把握した、|手番を送る、|盤面を更新する、|角を確保した、|損失を補正する、)+/, '')
            .replace(/[。！!？?]+$/g, '')
            .trim();
        if (!body) return '';
        const prefix = resolveTonePrefix(eventType, advantage, speakerRole, level);
        const end = (eventType === 'card_used' || eventType === 'card_used_by_enemy' || isCornerEventType(eventType)) ? '！' : '。';
        return `${prefix}${body}${end}`;
    }

    function resolveEventType(context: any, playerState: any, discDiff: any) {
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

    function isAdvantageReversed(playerState: any, currentAdvantage: any) {
        const prev = String(playerState && playerState.lastAdvantage || '').toLowerCase();
        const next = String(currentAdvantage || '').toLowerCase();
        if (!prev || !next) return false;
        if (prev === 'ahead' && next === 'behind') return true;
        if (prev === 'behind' && next === 'ahead') return true;
        return false;
    }

    function shouldEmitRegularTurnLine(playerState: any, turnNumber: any) {
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

    function chooseTurnStartLine(playerState: any, phase: any, advantage: any, level: any) {
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

    function resolveLinePool(primaryLines: any, fallbackLines: any) {
        if (Array.isArray(primaryLines) && primaryLines.length) return primaryLines;
        if (Array.isArray(fallbackLines) && fallbackLines.length) return fallbackLines;
        return [];
    }

    function resolveLineFactory(primaryFactory: any, fallbackFactory: any) {
        if (typeof primaryFactory === 'function') return primaryFactory;
        if (typeof fallbackFactory === 'function') return fallbackFactory;
        return function () { return []; };
    }

    function resolveCpuPool(sharedLines: any, legacyLines: any, fallbackLines: any) {
        if (Array.isArray(sharedLines) && sharedLines.length) return sharedLines;
        return resolveLinePool(legacyLines, fallbackLines);
    }

    function resolveCpuFixedPool(getter: any, sharedLines: any, legacyLines: any, fallbackLines: any, level: any) {
        if (typeof getter === 'function') {
            const lines = getter(level);
            if (Array.isArray(lines) && lines.length) return lines;
        }
        return resolveCpuPool(sharedLines, legacyLines, fallbackLines);
    }

    function pickCpuPoolLine(playerState: any, lines: any) {
        return pickRandomLine(playerState, Array.isArray(lines) ? lines : []);
    }

    function chooseCpuLine(playerState: any, eventType: any, phase: any, advantage: any, context: any, level: any) {
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

    function buildCommentary(context: any) {
        const ctx = context && typeof context === 'object' ? context : {};
        const playerKey = normalizePlayerKey(ctx.playerKey);
        const speakerRole = normalizeSpeakerRole(ctx.speakerRole);
        const playerState = getSpeakerState(speakerRole, playerKey);

        const counts = normalizeCounts(ctx);
        const corners = normalizeCorners(ctx, playerKey);
        const phase = normalizePhase(ctx.phase, ctx.turnNumber, (counts.black + counts.white));
        const advantage = resolveAdvantage(ctx, playerKey, counts, corners);
        const commentaryLevel = resolveCpuCommentaryLevel(ctx);

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

        const line = chooseCpuLine(playerState, eventType, phase, advantage, ctx, commentaryLevel);

        const unified = applyToneConsistency(line, eventType, advantage, speakerRole, commentaryLevel);
        return sanitize(unified, Number(config.maxChars));
    }

    function requestCommentary(context: any) {
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
