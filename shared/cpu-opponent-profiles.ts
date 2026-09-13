'use strict';

interface CpuOpponentProfile {
    id: string;
    level: number;
    decisionLevel: number;
    name: string;
    menuLabel: string;
    portraitSrc: string;
    deckProfile: 'default' | 'lv6-default' | 'lv6-board-executor' | 'lv7-theory-incarnation' | 'lv8-ending-ash' | 'lv9-ending-ash-all-enabled';
    initialCharge?: number;
    initialChargeByPlayer?: { black?: number; white?: number };
    chargeGainMultiplier?: number;
    chargeGainMultiplierByPlayer?: { black?: number; white?: number };
    cardUseUnlockTurnNumber?: number;
}

interface CpuOpponentMenuOption {
    value: string;
    label: string;
}

interface CpuOpponentRuntimeSelection {
    profile: CpuOpponentProfile;
    profileId: string;
    level: number;
    decisionLevel: number;
    cardUseUnlockTurnNumber: number | null;
}

const CPU_OPPONENT_PROFILE_ALIASES: Record<string, string> = {
    '6-board-executor': '7-board-executor',
    '7-theory-incarnation': '8-theory-incarnation',
    '8-ending-ash': '9-ending-ash'
};

// Lv9 and Lv10 share game conditions; only their decision policy differs.
const ENDING_ASH_GAME_CONDITIONS = Object.freeze({
    deckProfile: 'lv9-ending-ash-all-enabled' as const,
    initialCharge: 99,
    initialChargeByPlayer: Object.freeze({ black: 99, white: 99 }),
    chargeGainMultiplier: 2,
    cardUseUnlockTurnNumber: 6
});

const CPU_OPPONENT_PROFILES: CpuOpponentProfile[] = [
    {
        id: '1',
        level: 1,
        decisionLevel: 1,
        name: '盤喰いの小鬼',
        menuLabel: 'Lv1: 盤喰いの小鬼',
        portraitSrc: 'assets/images/cpu/level1.png',
        deckProfile: 'default'
    },
    {
        id: '2',
        level: 2,
        decisionLevel: 2,
        name: '反転の影',
        menuLabel: 'Lv2: 反転の影',
        portraitSrc: 'assets/images/cpu/level2.png',
        deckProfile: 'default'
    },
    {
        id: '3',
        level: 3,
        decisionLevel: 3,
        name: '布石を紡ぐ者',
        menuLabel: 'Lv3: 布石を紡ぐ者',
        portraitSrc: 'assets/images/cpu/level3.png',
        deckProfile: 'default'
    },
    {
        id: '4',
        level: 4,
        decisionLevel: 4,
        name: '盤面支配者',
        menuLabel: 'Lv4: 盤面支配者',
        portraitSrc: 'assets/images/cpu/level4.png',
        deckProfile: 'default'
    },
    {
        id: '5',
        level: 5,
        decisionLevel: 5,
        name: '終局を告げる者',
        menuLabel: 'Lv5: 終局を告げる者',
        portraitSrc: 'assets/images/cpu/level5.png',
        deckProfile: 'default'
    },
    {
        id: '6',
        level: 6,
        decisionLevel: 6,
        name: '盤理の観測者',
        menuLabel: 'Lv6: 盤理の観測者',
        portraitSrc: 'assets/images/special-cards/characters/observer_will.png',
        deckProfile: 'lv6-default'
    },
    {
        id: '7-board-executor',
        level: 7,
        decisionLevel: 6,
        name: '盤界の執行者',
        menuLabel: 'Lv7: 盤界の執行者',
        portraitSrc: 'assets/images/special-cards/characters/board_executor.png',
        deckProfile: 'lv6-board-executor'
    },
    {
        id: '8-theory-incarnation',
        level: 8,
        decisionLevel: 6,
        name: '理論の化身',
        menuLabel: 'Lv8: 理論の化身',
        portraitSrc: 'assets/images/special-cards/characters/theory_incarnation.png',
        deckProfile: 'lv7-theory-incarnation',
        initialCharge: 50,
        initialChargeByPlayer: { white: 50 },
        cardUseUnlockTurnNumber: 8
    },
    {
        id: '9-ending-ash',
        level: 9,
        decisionLevel: 6,
        name: '終焉の冥灰',
        menuLabel: 'Lv9: 終焉の冥灰',
        portraitSrc: 'assets/images/special-cards/characters/終焉の冥灰.png',
        ...ENDING_ASH_GAME_CONDITIONS
    },
    {
        id: '10-observed-dark-dragon',
        level: 10,
        decisionLevel: 10,
        name: '観測ダークドラゴン',
        menuLabel: 'Lv10: 観測ダークドラゴン',
        portraitSrc: 'assets/images/cpu/observed-dark-dragon-transparent.png',
        ...ENDING_ASH_GAME_CONDITIONS
    }
];

const CPU_OPPONENT_PROFILE_BY_ID = new Map<string, CpuOpponentProfile>(
    CPU_OPPONENT_PROFILES.map((profile) => [profile.id, profile])
);
Object.keys(CPU_OPPONENT_PROFILE_ALIASES).forEach((alias) => {
    const profile = CPU_OPPONENT_PROFILE_BY_ID.get(CPU_OPPONENT_PROFILE_ALIASES[alias]);
    if (profile) CPU_OPPONENT_PROFILE_BY_ID.set(alias, profile);
});
const CPU_OPPONENT_DEFAULT_PROFILE_BY_LEVEL = new Map<number, CpuOpponentProfile>();
CPU_OPPONENT_PROFILES.forEach((profile) => {
    if (!CPU_OPPONENT_DEFAULT_PROFILE_BY_LEVEL.has(profile.level)) {
        CPU_OPPONENT_DEFAULT_PROFILE_BY_LEVEL.set(profile.level, profile);
    }
});

function clampCpuLevel(value: unknown): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return 1;
    return Math.max(1, Math.min(10, Math.floor(n)));
}

function getCpuOpponentProfiles(): CpuOpponentProfile[] {
    return CPU_OPPONENT_PROFILES.slice();
}

function getCpuOpponentMenuOptions(): CpuOpponentMenuOption[] {
    return CPU_OPPONENT_PROFILES.map((profile) => ({
        value: profile.id,
        label: profile.menuLabel
    }));
}

function getCpuOpponentProfile(value: unknown): CpuOpponentProfile {
    const raw = String(value || '').trim();
    const direct = CPU_OPPONENT_PROFILE_BY_ID.get(raw);
    if (direct) return direct;
    return CPU_OPPONENT_DEFAULT_PROFILE_BY_LEVEL.get(clampCpuLevel(raw)) || CPU_OPPONENT_PROFILES[0];
}

function getCpuOpponentLevel(value: unknown): number {
    return getCpuOpponentProfile(value).level;
}

function normalizeCpuOpponentDecisionLevel(profile: CpuOpponentProfile): number {
    return Number.isFinite(Number(profile.decisionLevel)) ? Math.max(1, Math.floor(Number(profile.decisionLevel))) : profile.level;
}

function getCpuOpponentDecisionLevel(value: unknown): number {
    return resolveCpuOpponentRuntimeSelection(value).decisionLevel;
}

function getCpuOpponentProfileId(value: unknown): string {
    return getCpuOpponentProfile(value).id;
}

function getCpuOpponentInitialChargeByPlayer(value: unknown): { black?: number; white?: number } {
    const profile = getCpuOpponentProfile(value);
    const source = profile.initialChargeByPlayer && typeof profile.initialChargeByPlayer === 'object'
        ? profile.initialChargeByPlayer
        : {};
    const next: { black?: number; white?: number } = {};
    if (Number.isFinite(Number(source.black))) next.black = Math.max(0, Math.floor(Number(source.black)));
    if (Number.isFinite(Number(source.white))) next.white = Math.max(0, Math.floor(Number(source.white)));
    return next;
}

function getCpuOpponentInitialChargeForPlayer(value: unknown, playerKey: unknown): number {
    const profile = getCpuOpponentProfile(value);
    const normalizedPlayerKey = playerKey === 'black' || playerKey === 'white' ? playerKey : null;
    if (normalizedPlayerKey && Number.isFinite(Number(profile.initialCharge))) {
        return Math.max(0, Math.floor(Number(profile.initialCharge)));
    }
    const byPlayer = getCpuOpponentInitialChargeByPlayer(value);
    if (normalizedPlayerKey && Number.isFinite(Number(byPlayer[normalizedPlayerKey]))) {
        return Math.max(0, Math.floor(Number(byPlayer[normalizedPlayerKey])));
    }
    return 0;
}

function getCpuOpponentChargeGainMultiplierForPlayer(value: unknown, playerKey: unknown): number {
    const profile = getCpuOpponentProfile(value);
    const normalizedPlayerKey = playerKey === 'black' || playerKey === 'white' ? playerKey : null;
    const source = profile.chargeGainMultiplierByPlayer && typeof profile.chargeGainMultiplierByPlayer === 'object'
        ? profile.chargeGainMultiplierByPlayer
        : {};
    const raw = normalizedPlayerKey && Number.isFinite(Number(source[normalizedPlayerKey]))
        ? Number(source[normalizedPlayerKey])
        : Number(profile.chargeGainMultiplier);
    if (!Number.isFinite(raw) || raw <= 0) return 1;
    return Math.max(1, Math.floor(raw));
}

function getCpuOpponentCardUseUnlockTurnNumber(value: unknown): number | null {
    const profile = getCpuOpponentProfile(value);
    const n = Number(profile.cardUseUnlockTurnNumber);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
}

function resolveCpuOpponentRuntimeSelection(value: unknown): CpuOpponentRuntimeSelection {
    const profile = getCpuOpponentProfile(value);
    return {
        profile,
        profileId: profile.id,
        level: profile.level,
        decisionLevel: normalizeCpuOpponentDecisionLevel(profile),
        cardUseUnlockTurnNumber: getCpuOpponentCardUseUnlockTurnNumber(profile.id)
    };
}

function shouldSkipCpuOpponentCardPhase(value: unknown, turnNumber: unknown): boolean {
    const selection = resolveCpuOpponentRuntimeSelection(value);
    if (!Number.isFinite(Number(selection.cardUseUnlockTurnNumber))) return false;
    const currentTurnNumber = Number(turnNumber);
    if (!Number.isFinite(currentTurnNumber)) return false;
    return currentTurnNumber < Math.max(0, Math.floor(Number(selection.cardUseUnlockTurnNumber)));
}

function isCpuOpponentProfile(value: unknown, profileId: string): boolean {
    return getCpuOpponentProfileId(value) === getCpuOpponentProfileId(profileId);
}

export = {
    getCpuOpponentProfiles,
    getCpuOpponentMenuOptions,
    getCpuOpponentProfile,
    getCpuOpponentLevel,
    getCpuOpponentDecisionLevel,
    getCpuOpponentProfileId,
    getCpuOpponentInitialChargeByPlayer,
    getCpuOpponentInitialChargeForPlayer,
    getCpuOpponentChargeGainMultiplierForPlayer,
    getCpuOpponentCardUseUnlockTurnNumber,
    resolveCpuOpponentRuntimeSelection,
    shouldSkipCpuOpponentCardPhase,
    isCpuOpponentProfile
};
