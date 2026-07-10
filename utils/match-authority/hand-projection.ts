import type { MatchAuthoritySeatKey } from '../match-authority-types';

interface MatchAuthorityHandProjectionDeps {
    hiddenHandTokenPrefix: string;
    hiddenHandTokenRe: RegExp;
    normalizePlayerKey: (value: unknown) => MatchAuthoritySeatKey;
}

function asRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' ? value as Record<string, any> : {};
}

export function createMatchAuthorityHandProjectionApi(deps: MatchAuthorityHandProjectionDeps) {
    function makeHiddenHandToken(ownerKey: unknown, handIndex: unknown): string {
        const normalizedOwner = deps.normalizePlayerKey(ownerKey);
        const index = Number.isFinite(Number(handIndex)) ? Math.max(0, Math.trunc(Number(handIndex))) : 0;
        return `${deps.hiddenHandTokenPrefix}${normalizedOwner}:${index}`;
    }

    function isHiddenHandTokenLike(value: unknown): boolean {
        return typeof value === 'string' && value.startsWith(deps.hiddenHandTokenPrefix);
    }

    function parseHiddenHandToken(value: unknown): { ownerKey: MatchAuthoritySeatKey; handIndex: number } | null {
        const match = String(value || '').match(deps.hiddenHandTokenRe);
        if (!match) return null;
        const ownerKey = deps.normalizePlayerKey(match[1]);
        const handIndex = Number(match[2]);
        return Number.isInteger(handIndex) && handIndex >= 0 ? { ownerKey, handIndex } : null;
    }

    function normalizeProjectedHandIndex(value: unknown, fallbackIndex: unknown, handLength: unknown): number | null {
        if (typeof handLength !== 'number' || !Number.isInteger(handLength) || handLength <= 0) return null;
        if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < handLength) return value;
        if (typeof fallbackIndex === 'number' && Number.isInteger(fallbackIndex) && fallbackIndex >= 0 && fallbackIndex < handLength) return fallbackIndex;
        return null;
    }

    function normalizeCardCopyIdList(values: unknown): number[] {
        if (!Array.isArray(values)) return [];
        const next: number[] = [];
        for (const rawValue of values) {
            const numeric = Number(rawValue);
            if (Number.isInteger(numeric) && numeric > 0) next.push(numeric);
        }
        return next;
    }

    function normalizeHandCopyIdArray(values: unknown, targetLength: unknown): Array<number | null> {
        const length = Number.isFinite(Number(targetLength)) ? Math.max(0, Math.trunc(Number(targetLength))) : 0;
        const next: Array<number | null> = Array(length).fill(null);
        if (!Array.isArray(values)) return next;
        for (let index = 0; index < length; index += 1) {
            const numeric = Number(values[index]);
            next[index] = Number.isInteger(numeric) && numeric > 0 ? numeric : null;
        }
        return next;
    }

    function buildVisibleHandCostAdjustments(
        cardState: Record<string, unknown>,
        ownerHandCopyIds: Array<number | null>,
        projectedOwnerHand: unknown[]
    ): Array<Record<string, number> | null> {
        const length = Array.isArray(projectedOwnerHand) ? projectedOwnerHand.length : 0;
        const adjustments: Array<Record<string, number> | null> = Array(length).fill(null);
        const overridesByCopyId = (cardState.cardCostOverridesByCopyId && typeof cardState.cardCostOverridesByCopyId === 'object')
            ? asRecord(cardState.cardCostOverridesByCopyId)
            : {};
        const modifiersByCopyId = (cardState.cardCostModifiersByCopyId && typeof cardState.cardCostModifiersByCopyId === 'object')
            ? asRecord(cardState.cardCostModifiersByCopyId)
            : {};
        for (let handIndex = 0; handIndex < length; handIndex += 1) {
            if (isHiddenHandTokenLike(projectedOwnerHand[handIndex])) continue;
            const copyId = ownerHandCopyIds[handIndex];
            if (!Number.isInteger(copyId) || Number(copyId) <= 0) continue;
            const copyKey = String(copyId);
            const adjustment: Record<string, number> = {};
            const overrideCost = Number(asRecord(overridesByCopyId[copyKey]).cost);
            if (Number.isFinite(overrideCost)) adjustment.overrideCost = overrideCost;
            const modifierValue = modifiersByCopyId[copyKey];
            const modifierEntries = Array.isArray(modifierValue)
                ? modifierValue
                : (modifierValue && typeof modifierValue === 'object' ? [modifierValue] : []);
            let delta = 0;
            for (const modifierEntry of modifierEntries) {
                const modifierDelta = Number(asRecord(modifierEntry).delta);
                if (Number.isFinite(modifierDelta)) delta += modifierDelta;
            }
            if (delta !== 0) adjustment.delta = delta;
            if (Object.keys(adjustment).length > 0) adjustments[handIndex] = adjustment;
        }
        return adjustments;
    }

    return {
        makeHiddenHandToken,
        isHiddenHandTokenLike,
        parseHiddenHandToken,
        normalizeProjectedHandIndex,
        normalizeCardCopyIdList,
        normalizeHandCopyIdArray,
        buildVisibleHandCostAdjustments
    };
}
