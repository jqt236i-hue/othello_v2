'use strict';

const CpuOpponentProfiles = require('./cpu-opponent-profiles');
const DeckSpecHelpers = require('./deck-spec');

type CpuOpponentPlayerKey = 'black' | 'white';

interface CpuOpponentStartupOptions {
    profileId: string;
    deckCode: string | null;
    deckCardIds: string[] | null;
    initialCharge: number | null;
    chargeGainMultiplier: number | null;
    cardUseUnlockTurnNumber: number | null;
    hasStartupOptions: boolean;
}

interface CpuOpponentProfileChangeResetInput {
    matchMode?: unknown;
    turnNumber?: unknown;
    previousProfileValue?: unknown;
    nextProfileValue?: unknown;
}

function normalizePlayerKey(value: unknown): CpuOpponentPlayerKey | null {
    return value === 'black' || value === 'white' ? value : null;
}

function getCpuOpponentDeckCode(profileValue: unknown): string | null {
    const profile = CpuOpponentProfiles.getCpuOpponentProfile(profileValue);
    if (!profile || !profile.deckProfile || profile.deckProfile === 'default') return null;
    if (profile.deckProfile === 'lv8-ending-ash'
        && typeof DeckSpecHelpers.getCpuLv8EndingAshDeckCode === 'function') {
        return DeckSpecHelpers.getCpuLv8EndingAshDeckCode();
    }
    if (profile.deckProfile === 'lv7-theory-incarnation'
        && typeof DeckSpecHelpers.getCpuLv7TheoryIncarnationWhiteDeckCode === 'function') {
        return DeckSpecHelpers.getCpuLv7TheoryIncarnationWhiteDeckCode();
    }
    if (profile.deckProfile === 'lv6-board-executor'
        && typeof DeckSpecHelpers.getCpuLv6BoardExecutorWhiteDeckCode === 'function') {
        return DeckSpecHelpers.getCpuLv6BoardExecutorWhiteDeckCode();
    }
    if (profile.deckProfile === 'lv6-default'
        && typeof DeckSpecHelpers.getCpuLv6WhiteDeckCode === 'function') {
        return DeckSpecHelpers.getCpuLv6WhiteDeckCode();
    }
    return null;
}

function getCpuOpponentDeckCardIds(profileValue: unknown): string[] | null {
    const profile = CpuOpponentProfiles.getCpuOpponentProfile(profileValue);
    if (!profile || profile.deckProfile !== 'lv9-ending-ash-all-enabled') return null;
    if (typeof DeckSpecHelpers.getCpuLv9EndingAshDeckCardIds !== 'function') return null;

    const cardIds = DeckSpecHelpers.getCpuLv9EndingAshDeckCardIds();
    return Array.isArray(cardIds) && cardIds.length > 0 ? cardIds.slice() : null;
}

function getCpuOpponentStartupOptions(profileValue: unknown, playerKey: unknown): CpuOpponentStartupOptions {
    const profile = CpuOpponentProfiles.getCpuOpponentProfile(profileValue);
    const profileId = String(profile && profile.id || CpuOpponentProfiles.getCpuOpponentProfileId(profileValue));
    const normalizedPlayerKey = normalizePlayerKey(playerKey);
    const deckCode = getCpuOpponentDeckCode(profileId);
    const deckCardIds = getCpuOpponentDeckCardIds(profileId);
    const rawInitialCharge = normalizedPlayerKey
        && typeof CpuOpponentProfiles.getCpuOpponentInitialChargeForPlayer === 'function'
        ? CpuOpponentProfiles.getCpuOpponentInitialChargeForPlayer(profileId, normalizedPlayerKey)
        : 0;
    const initialCharge = Number.isFinite(Number(rawInitialCharge)) && Number(rawInitialCharge) > 0
        ? Math.floor(Number(rawInitialCharge))
        : null;
    const rawChargeGainMultiplier = normalizedPlayerKey
        && typeof CpuOpponentProfiles.getCpuOpponentChargeGainMultiplierForPlayer === 'function'
        ? CpuOpponentProfiles.getCpuOpponentChargeGainMultiplierForPlayer(profileId, normalizedPlayerKey)
        : 1;
    const chargeGainMultiplier = Number.isFinite(Number(rawChargeGainMultiplier)) && Number(rawChargeGainMultiplier) > 1
        ? Math.floor(Number(rawChargeGainMultiplier))
        : null;
    const rawUnlockTurn = typeof CpuOpponentProfiles.getCpuOpponentCardUseUnlockTurnNumber === 'function'
        ? CpuOpponentProfiles.getCpuOpponentCardUseUnlockTurnNumber(profileId)
        : null;
    const cardUseUnlockTurnNumber = rawUnlockTurn !== null
        && typeof rawUnlockTurn !== 'undefined'
        && Number.isFinite(Number(rawUnlockTurn))
        ? Math.max(0, Math.floor(Number(rawUnlockTurn)))
        : null;

    return {
        profileId,
        deckCode,
        deckCardIds,
        initialCharge,
        chargeGainMultiplier,
        cardUseUnlockTurnNumber,
        hasStartupOptions: !!deckCode || !!deckCardIds || initialCharge !== null || chargeGainMultiplier !== null
    };
}

function hasAnyCpuOpponentStartupOptions(profileValue: unknown): boolean {
    return getCpuOpponentStartupOptions(profileValue, 'black').hasStartupOptions
        || getCpuOpponentStartupOptions(profileValue, 'white').hasStartupOptions;
}

function shouldResetOpeningCpuProfileChange(input: CpuOpponentProfileChangeResetInput): boolean {
    const normalized: CpuOpponentProfileChangeResetInput = input && typeof input === 'object' ? input : {};
    const matchMode = String(normalized.matchMode || '').trim();
    if (matchMode !== 'cpu') return false;

    if (normalized.turnNumber === null || typeof normalized.turnNumber === 'undefined') return false;
    const turnNumber = Number(normalized.turnNumber);
    if (!Number.isFinite(turnNumber)) return false;
    if (Math.max(0, Math.floor(turnNumber)) > 1) return false;

    return hasAnyCpuOpponentStartupOptions(normalized.previousProfileValue)
        || hasAnyCpuOpponentStartupOptions(normalized.nextProfileValue);
}

export = {
    getCpuOpponentDeckCode,
    getCpuOpponentDeckCardIds,
    getCpuOpponentStartupOptions,
    shouldResetOpeningCpuProfileChange
};
