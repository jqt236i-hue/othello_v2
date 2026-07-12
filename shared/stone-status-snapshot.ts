(function (root: any, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        let SpecialStoneRegistry = null;
        let EvasionStatus = null;
        let ManifestStoneRegistry = null;
        try {
            SpecialStoneRegistry = require('./special-stone-registry');
        } catch (e) { /* ignore */ }
        try {
            EvasionStatus = require('./evasion-status');
        } catch (e) { /* ignore */ }
        try {
            ManifestStoneRegistry = require('./manifest-stone-registry');
        } catch (e) { /* ignore */ }
        module.exports = factory(SpecialStoneRegistry, EvasionStatus, ManifestStoneRegistry);
    } else {
        root.StoneStatusSnapshot = factory(root.SpecialStoneRegistry || null, root.EvasionStatus || null, root.ManifestStoneRegistry || null);
    }
}(typeof self !== 'undefined' ? self : this as unknown as Record<string, unknown>, function (SpecialStoneRegistry: unknown, EvasionStatus: unknown, ManifestStoneRegistry: unknown) {
    'use strict';

    interface SpecialStoneInfo {
        name?: string;
        desc?: string;
        timerClass?: string;
        mobility?: boolean;
        ghost?: boolean;
        flipProtected?: boolean;
        destroyProtected?: boolean;
        overlayOnlyVisual?: boolean;
        tagFlipEvadeDefault?: number;
        tagDestroyEvadeDefault?: number;
        visualFlipEvadeDefault?: number;
    }

    interface StatusSnapshot {
        rawType: unknown;
        type: string | null;
        info: Readonly<SpecialStoneInfo> | null;
        name: string;
        description: string;
        timerClass: string;
        displayTimer: number | null;
        hasGuard: boolean;
        hasGhost: boolean;
        hasMobility: boolean;
        inviolable: boolean;
        hasFlipProtection: boolean;
        hasDestroyProtection: boolean;
        hasFlipEvade: boolean;
        hasDestroyEvade: boolean;
        flipEvadeRemaining: number | null;
        destroyEvadeRemaining: number | null;
        isManifestStone: boolean;
    }

    interface MarkerData {
        type?: string;
        destroyEvadeRemaining?: unknown;
        remainingOwnerTurns?: unknown;
        remainingTurns?: unknown;
        turnsUntilInfection?: unknown;
        flipEvadeRemaining?: unknown;
        regenRemaining?: unknown;
    }

    interface Marker {
        row: number;
        col: number;
        kind: string;
        data?: MarkerData;
        owner?: unknown;
    }

    interface VisualStatus {
        special: string | null;
        timer: number | null;
        owner: unknown | null;
        flipEvadeRemaining: number | null;
        destroyEvadeRemaining: number | null;
        livingWillAura: boolean;
    }

    function normalizeSpecialStoneType(rawType: unknown): string | null {
        if (SpecialStoneRegistry && typeof (SpecialStoneRegistry as { normalizeSpecialStoneType?: (v: unknown) => string | null }).normalizeSpecialStoneType === 'function') {
            return (SpecialStoneRegistry as { normalizeSpecialStoneType: (v: unknown) => string | null }).normalizeSpecialStoneType(rawType);
        }
        if (rawType === null || typeof rawType === 'undefined') return null;
        const asString = String(rawType).trim();
        return asString ? asString.toUpperCase() : null;
    }

    function getSpecialStoneInfo(rawType: unknown): Readonly<SpecialStoneInfo> | null {
        if (SpecialStoneRegistry && typeof (SpecialStoneRegistry as { getSpecialStoneInfo?: (v: unknown) => Readonly<SpecialStoneInfo> | null }).getSpecialStoneInfo === 'function') {
            return (SpecialStoneRegistry as { getSpecialStoneInfo: (v: unknown) => Readonly<SpecialStoneInfo> | null }).getSpecialStoneInfo(rawType);
        }
        return null;
    }

    function isOverlayOnlySpecialStoneType(rawType: unknown): boolean {
        if (SpecialStoneRegistry && typeof (SpecialStoneRegistry as { isOverlayOnlySpecialStoneType?: (v: unknown) => boolean }).isOverlayOnlySpecialStoneType === 'function') {
            return (SpecialStoneRegistry as { isOverlayOnlySpecialStoneType: (v: unknown) => boolean }).isOverlayOnlySpecialStoneType(rawType);
        }
        const type = normalizeSpecialStoneType(rawType);
        return type === 'GUARD' || type === 'LIVING_WILL' || type === 'POISONED';
    }

    function getSpecialStoneTimerClass(rawType: unknown, fallback?: unknown): string {
        if (SpecialStoneRegistry && typeof (SpecialStoneRegistry as { getSpecialStoneTimerClass?: (v: unknown, f?: unknown) => string }).getSpecialStoneTimerClass === 'function') {
            return (SpecialStoneRegistry as { getSpecialStoneTimerClass: (v: unknown, f?: unknown) => string }).getSpecialStoneTimerClass(rawType, fallback);
        }
        return fallback !== undefined ? String(fallback) : 'special-timer';
    }

    function isInviolableSpecialType(rawType: unknown): boolean {
        if (SpecialStoneRegistry && typeof (SpecialStoneRegistry as { isInviolableSpecialType?: (v: unknown) => boolean }).isInviolableSpecialType === 'function') {
            return (SpecialStoneRegistry as { isInviolableSpecialType: (v: unknown) => boolean }).isInviolableSpecialType(rawType);
        }
        return false;
    }

    function getEvasionStatusModule(): unknown {
        const candidate = EvasionStatus as { getFlipEvadeDefault?: unknown; getDestroyEvadeDefault?: unknown } | null;
        if (
            candidate &&
            typeof candidate.getFlipEvadeDefault === 'function' &&
            typeof candidate.getDestroyEvadeDefault === 'function'
        ) {
            return candidate;
        }
        if (typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>).EvasionStatus) {
            return (globalThis as Record<string, unknown>).EvasionStatus;
        }
        if (typeof self !== 'undefined' && (self as Record<string, unknown>).EvasionStatus) {
            return (self as Record<string, unknown>).EvasionStatus;
        }
        return null;
    }

    function readFlipEvadeDefault(rawTypeOrSource: unknown, mode: 'runtime' | 'info' | 'visual'): number | null {
        const evasionStatus = getEvasionStatusModule();
        if (evasionStatus && typeof (evasionStatus as { getFlipEvadeDefault?: (v: unknown, o?: unknown) => number | null }).getFlipEvadeDefault === 'function') {
            return (evasionStatus as { getFlipEvadeDefault: (v: unknown, o?: unknown) => number | null }).getFlipEvadeDefault(rawTypeOrSource, { mode });
        }
        const info = getSpecialStoneInfo(rawTypeOrSource);
        if (!info) return null;
        if (mode === 'info') return toCounterOrNull(info.tagFlipEvadeDefault);
        if (mode === 'visual') return toCounterOrNull(info.visualFlipEvadeDefault);
        return toCounterOrNull(info.tagFlipEvadeDefault);
    }

    function readDestroyEvadeDefault(rawTypeOrSource: unknown, mode: 'runtime' | 'info' | 'visual'): number | null {
        const evasionStatus = getEvasionStatusModule();
        if (evasionStatus && typeof (evasionStatus as { getDestroyEvadeDefault?: (v: unknown, o?: unknown) => number | null }).getDestroyEvadeDefault === 'function') {
            return (evasionStatus as { getDestroyEvadeDefault: (v: unknown, o?: unknown) => number | null }).getDestroyEvadeDefault(rawTypeOrSource, { mode });
        }
        const info = getSpecialStoneInfo(rawTypeOrSource);
        if (!info || mode === 'visual') return null;
        return toCounterOrNull(info.tagDestroyEvadeDefault);
    }

    function toCounterOrNull(value: unknown): number | null {
        if (value === null || value === undefined || value === '') return null;
        const n = Number(value);
        if (!Number.isFinite(n)) return null;
        return Math.max(0, Math.trunc(n));
    }

    function isLivingWillType(type: unknown): boolean {
        return normalizeSpecialStoneType(type) === 'LIVING_WILL';
    }

    const FALLBACK_MANIFEST_STONE_TYPES = Object.freeze([
        'THEORY_INCARNATION',
        'BOARD_EXECUTOR',
        'OBSERVER_WILL'
    ]);

    function isManifestStoneType(rawType: unknown): boolean {
        if (ManifestStoneRegistry && typeof (ManifestStoneRegistry as { isManifestStoneType?: (v: unknown) => boolean }).isManifestStoneType === 'function') {
            return (ManifestStoneRegistry as { isManifestStoneType: (v: unknown) => boolean }).isManifestStoneType(rawType);
        }
        const type = normalizeSpecialStoneType(rawType);
        return !!type && FALLBACK_MANIFEST_STONE_TYPES.includes(type);
    }

    function isManifestStoneStatusInput(source: Record<string, unknown>, type: unknown): boolean {
        const marker = source.marker;
        if (
            ManifestStoneRegistry &&
            typeof (ManifestStoneRegistry as { isManifestStoneMarker?: (v: unknown) => boolean }).isManifestStoneMarker === 'function' &&
            (ManifestStoneRegistry as { isManifestStoneMarker: (v: unknown) => boolean }).isManifestStoneMarker(marker)
        ) {
            return true;
        }
        const rawKind = source.kind || (marker && typeof marker === 'object' ? (marker as Record<string, unknown>).kind : null);
        const kind = rawKind === null || rawKind === undefined ? '' : String(rawKind);
        if (kind === 'manifestStone' && isManifestStoneType(type)) return true;
        return isManifestStoneType(type);
    }

    function getManifestStoneDisplayName(type: unknown): string | null {
        if (ManifestStoneRegistry && typeof (ManifestStoneRegistry as { getManifestStoneMetadata?: (v: unknown) => { displayName?: unknown } | null }).getManifestStoneMetadata === 'function') {
            const metadata = (ManifestStoneRegistry as { getManifestStoneMetadata: (v: unknown) => { displayName?: unknown } | null }).getManifestStoneMetadata(type);
            if (metadata && metadata.displayName) return String(metadata.displayName);
        }
        return null;
    }

    function resolveDisplayTimerValue(typeOrInput: unknown, timerValue?: unknown, regenRemainingValue?: unknown): number | null {
        let rawType: unknown = typeOrInput;
        let rawTimer: unknown = timerValue;
        let rawRegenRemaining: unknown = regenRemainingValue;

        if (typeOrInput && typeof typeOrInput === 'object') {
            const obj = typeOrInput as Record<string, unknown>;
            rawType = obj.type || obj.special || null;
            if (rawTimer === undefined) {
                if (Object.prototype.hasOwnProperty.call(obj, 'timer')) rawTimer = obj.timer;
                else if (Object.prototype.hasOwnProperty.call(obj, 'remainingOwnerTurns')) rawTimer = obj.remainingOwnerTurns;
                else if (Object.prototype.hasOwnProperty.call(obj, 'turnsUntilInfection')) rawTimer = obj.turnsUntilInfection;
            }
            if (rawRegenRemaining === undefined) rawRegenRemaining = obj.regenRemaining;
        }

        const timer = toCounterOrNull(rawTimer);
        if (timer !== null) return timer;
        if (normalizeSpecialStoneType(rawType) === 'REGEN') return toCounterOrNull(rawRegenRemaining);
        return null;
    }

    function createSpecialStoneStatusSnapshot(input: unknown, options: unknown): StatusSnapshot {
        const source = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
        const mode = (options && typeof options === 'object' && (options as Record<string, unknown>).mode) || 'raw';
        const rawType = source.type || source.special || null;
        const type = normalizeSpecialStoneType(rawType);
        const info = getSpecialStoneInfo(type);
        const isManifestStone = isManifestStoneStatusInput(source, type);
        const displayTimer = resolveDisplayTimerValue(source);
        const ultimateExpired = type === 'ULTIMATE_HYPERACTIVE' && displayTimer !== null && displayTimer <= 0;

        let flipEvadeRemaining = toCounterOrNull(source.flipEvadeRemaining);
        if (flipEvadeRemaining === null) {
            if (mode === 'info') flipEvadeRemaining = readFlipEvadeDefault(source, 'info');
            else if (mode === 'visual') flipEvadeRemaining = readFlipEvadeDefault(source, 'visual');
        }

        let destroyEvadeRemaining = toCounterOrNull(source.destroyEvadeRemaining);
        if (destroyEvadeRemaining === null && mode === 'info') {
            destroyEvadeRemaining = readDestroyEvadeDefault(source, 'info');
        }

        const hasGuard = source.hasGuard === true;
        const hasGhost = !!(info && info.ghost);
        const hasMobility = !!(info && info.mobility);
        const inviolable = !hasGhost && isInviolableSpecialType(type);
        const hasFlipProtection = !hasGhost && (hasGuard || !!(info && info.flipProtected));
        const hasDestroyProtection = !hasGhost && (hasGuard || !!(info && info.destroyProtected));
        const hasFlipEvade = !ultimateExpired && flipEvadeRemaining !== null && flipEvadeRemaining > 0;
        const hasDestroyEvade = !ultimateExpired && destroyEvadeRemaining !== null && destroyEvadeRemaining > 0;

        return {
            rawType,
            type,
            info,
            name: (isManifestStone && getManifestStoneDisplayName(type)) || (info && info.name) || (rawType ? String(rawType) : ''),
            description: (info && info.desc) || '効果情報は未登録です。',
            timerClass: getSpecialStoneTimerClass(type, 'special-timer'),
            displayTimer,
            hasGuard,
            hasGhost,
            hasMobility,
            inviolable,
            hasFlipProtection,
            hasDestroyProtection,
            hasFlipEvade,
            hasDestroyEvade,
            flipEvadeRemaining,
            destroyEvadeRemaining,
            isManifestStone
        };
    }

    function buildSpecialStoneStatusTags(inputs: unknown[], options: unknown): string[] {
        const items = Array.isArray(inputs) ? inputs : [];
        const snapshots = items
            .map((input) => createSpecialStoneStatusSnapshot(input, { mode: 'info' }))
            .filter((snapshot) => !!(snapshot && snapshot.type));
        const manifestSnapshots = snapshots.filter((snapshot) => !!(snapshot && snapshot.isManifestStone));
        const nonOverlaySnapshots = snapshots.filter((snapshot) => !snapshot.isManifestStone && !isOverlayOnlySpecialStoneType(snapshot && snapshot.type));
        const opts = options && typeof options === 'object' ? options as Record<string, unknown> : {};
        const primaryInput = opts.primary
            ? opts.primary
            : (items.length > 0 ? items[0] : null);
        const primarySnapshot = primaryInput
            ? createSpecialStoneStatusSnapshot(primaryInput, { mode: 'info' })
            : null;
        const livingWillAura = !!((opts && opts.livingWillAura) || snapshots.some((snapshot) => isLivingWillType(snapshot && snapshot.type)));
        const tags: string[] = [];
        const sumCounters = (field: 'flipEvadeRemaining' | 'destroyEvadeRemaining'): number | null => {
            const values = snapshots
                .map((snapshot) => toCounterOrNull(snapshot && snapshot[field]))
                .filter((value): value is number => value !== null && value > 0);
            if (values.length <= 0) return null;
            return values.reduce((sum, value) => sum + value, 0);
        };
        const displayTimer = primarySnapshot ? toCounterOrNull(primarySnapshot.displayTimer) : null;
        const primaryType = normalizeSpecialStoneType(primarySnapshot && primarySnapshot.type);
        const flipEvadeTotal = sumCounters('flipEvadeRemaining');
        const destroyEvadeTotal = sumCounters('destroyEvadeRemaining');

        if (opts && opts.hasGuard) tags.push('守る意志適用中');
        if (manifestSnapshots.length > 0) {
            tags.push('顕現石');
            tags.push('不可侵');
        }
        if ((!opts || opts.includeSpecialStone !== false) && nonOverlaySnapshots.length > 0) tags.push('特殊石');
        if (displayTimer !== null && primaryType === 'REGEN') tags.push(`復活 残り${displayTimer}回`);
        else if (displayTimer !== null) tags.push(`残り${displayTimer}T`);
        if (livingWillAura) tags.push('生きる意志付与');
        if (primarySnapshot && primarySnapshot.hasGhost) tags.push('幽体');
        if (snapshots.some((snapshot) => snapshot.hasMobility)) tags.push('多動状態');
        if (flipEvadeTotal !== null) tags.push(`反転回避 残り${flipEvadeTotal}回`);
        else if (snapshots.some((snapshot) => snapshot.hasFlipEvade)) tags.push('反転回避');
        if (destroyEvadeTotal !== null) tags.push(`破壊回避 残り${destroyEvadeTotal}回`);
        else if (snapshots.some((snapshot) => snapshot.hasDestroyEvade)) tags.push('破壊回避');
        if (primarySnapshot && !primarySnapshot.hasGhost && primarySnapshot.hasFlipProtection) tags.push('反転保護');

        return Array.from(new Set(tags));
    }

    function resolveStoneVisualStatusFromMarkers(markersAtCell: unknown[], options: unknown): VisualStatus {
        const markers = Array.isArray(markersAtCell) ? markersAtCell.filter(Boolean) as Marker[] : [];
        const out: VisualStatus = {
            special: null,
            timer: null,
            owner: null,
            flipEvadeRemaining: null,
            destroyEvadeRemaining: null,
            livingWillAura: false
        };

        const destroyValues = markers
            .map((marker) => toCounterOrNull(marker && marker.data && marker.data.destroyEvadeRemaining))
            .filter((value): value is number => value !== null);
        if (destroyValues.length > 0) {
            out.destroyEvadeRemaining = destroyValues.reduce((sum, value) => sum + value, 0);
        }

        out.livingWillAura = markers.some((marker) => (
            marker &&
            marker.data &&
            isLivingWillType(marker.data.type)
        ));

        const visualSpecial = markers.find((marker) => {
            const type = normalizeSpecialStoneType(marker && marker.data && marker.data.type);
            if (!type) return false;
            return !isOverlayOnlySpecialStoneType(type);
        });
        if (visualSpecial) {
            const snapshot = createSpecialStoneStatusSnapshot({
                kind: visualSpecial.kind,
                marker: visualSpecial,
                type: visualSpecial.data && visualSpecial.data.type,
                timer: visualSpecial.data && (
                    visualSpecial.data.remainingOwnerTurns ??
                    visualSpecial.data.turnsUntilInfection
                ),
                regenRemaining: visualSpecial.data && visualSpecial.data.regenRemaining,
                flipEvadeRemaining: visualSpecial.data && visualSpecial.data.flipEvadeRemaining,
                destroyEvadeRemaining: out.destroyEvadeRemaining !== null
                    ? out.destroyEvadeRemaining
                    : (visualSpecial.data && visualSpecial.data.destroyEvadeRemaining)
            }, { mode: (options && typeof options === 'object' && (options as Record<string, unknown>).mode) || 'raw' });
            out.special = snapshot.type || null;
            out.timer = snapshot.displayTimer;
            out.owner = (visualSpecial.owner !== undefined && visualSpecial.owner !== null) ? visualSpecial.owner : null;
            out.flipEvadeRemaining = snapshot.flipEvadeRemaining;
            out.destroyEvadeRemaining = snapshot.destroyEvadeRemaining;
            return out;
        }

        const opts = options && typeof options === 'object' ? options as Record<string, unknown> : {};
        const bombMarker = opts.bombMarker as Marker | undefined;
        if (bombMarker) {
            const snapshot = createSpecialStoneStatusSnapshot({
                type: (bombMarker.data && bombMarker.data.type) || 'TIME_BOMB',
                timer: bombMarker.data && bombMarker.data.remainingTurns
            }, { mode: 'raw' });
            out.special = snapshot.type || 'TIME_BOMB';
            out.timer = snapshot.displayTimer;
            out.owner = (bombMarker.owner !== undefined && bombMarker.owner !== null) ? bombMarker.owner : null;
        }

        return out;
    }

    return {
        toCounterOrNull,
        resolveDisplayTimerValue,
        createSpecialStoneStatusSnapshot,
        buildSpecialStoneStatusTags,
        resolveStoneVisualStatusFromMarkers
    };
}));

export {};
