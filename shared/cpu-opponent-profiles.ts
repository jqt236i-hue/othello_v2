'use strict';

interface CpuOpponentProfile {
    id: string;
    level: number;
    name: string;
    menuLabel: string;
    portraitSrc: string;
    deckProfile: 'default' | 'lv6-default' | 'lv6-board-executor';
}

interface CpuOpponentMenuOption {
    value: string;
    label: string;
}

const CPU_OPPONENT_PROFILES: CpuOpponentProfile[] = [
    {
        id: '1',
        level: 1,
        name: '盤喰いの小鬼',
        menuLabel: 'Lv1: 盤喰いの小鬼',
        portraitSrc: 'assets/images/cpu/level1.png',
        deckProfile: 'default'
    },
    {
        id: '2',
        level: 2,
        name: '反転の影',
        menuLabel: 'Lv2: 反転の影',
        portraitSrc: 'assets/images/cpu/level2.png',
        deckProfile: 'default'
    },
    {
        id: '3',
        level: 3,
        name: '布石を紡ぐ者',
        menuLabel: 'Lv3: 布石を紡ぐ者',
        portraitSrc: 'assets/images/cpu/level3.png',
        deckProfile: 'default'
    },
    {
        id: '4',
        level: 4,
        name: '盤面支配者',
        menuLabel: 'Lv4: 盤面支配者',
        portraitSrc: 'assets/images/cpu/level4.png',
        deckProfile: 'default'
    },
    {
        id: '5',
        level: 5,
        name: '終局を告げる者',
        menuLabel: 'Lv5: 終局を告げる者',
        portraitSrc: 'assets/images/cpu/level5.png',
        deckProfile: 'default'
    },
    {
        id: '6',
        level: 6,
        name: '盤理の観測者',
        menuLabel: 'Lv6: 盤理の観測者',
        portraitSrc: 'assets/images/cpu/level6.png',
        deckProfile: 'lv6-default'
    },
    {
        id: '6-board-executor',
        level: 6,
        name: '盤界の執行者',
        menuLabel: 'Lv6: 盤界の執行者',
        portraitSrc: 'assets/images/special-cards/characters/board_executor.png',
        deckProfile: 'lv6-board-executor'
    }
];

const CPU_OPPONENT_PROFILE_BY_ID = new Map<string, CpuOpponentProfile>(
    CPU_OPPONENT_PROFILES.map((profile) => [profile.id, profile])
);

function clampCpuLevel(value: unknown): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return 1;
    return Math.max(1, Math.min(6, Math.floor(n)));
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
    return CPU_OPPONENT_PROFILE_BY_ID.get(String(clampCpuLevel(raw))) || CPU_OPPONENT_PROFILES[0];
}

function getCpuOpponentLevel(value: unknown): number {
    return getCpuOpponentProfile(value).level;
}

function getCpuOpponentProfileId(value: unknown): string {
    return getCpuOpponentProfile(value).id;
}

function isCpuOpponentProfile(value: unknown, profileId: string): boolean {
    return getCpuOpponentProfileId(value) === profileId;
}

export = {
    getCpuOpponentProfiles,
    getCpuOpponentMenuOptions,
    getCpuOpponentProfile,
    getCpuOpponentLevel,
    getCpuOpponentProfileId,
    isCpuOpponentProfile
};
