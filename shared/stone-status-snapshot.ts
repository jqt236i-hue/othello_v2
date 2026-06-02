(function (root: any, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        let SpecialStoneRegistry = null;
        let EvasionStatus = null;
        try {
            SpecialStoneRegistry = require('./special-stone-registry');
        } catch (e) { /* ignore */ }
        try {
            EvasionStatus = require('./evasion-status');
        } catch (e) { /* ignore */ }
        module.exports = factory(SpecialStoneRegistry, EvasionStatus);
    } else {
        root.StoneStatusSnapshot = factory(root.SpecialStoneRegistry || null, root.EvasionStatus || null);
    }
}(typeof self !== 'undefined' ? self : this as unknown as Record<string, unknown>, function (SpecialStoneRegistry: unknown, EvasionStatus: unknown) {
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
        hasFlipProtection: boolean;
        hasDestroyProtection: boolean;
        hasFlipEvade: boolean;
        hasDestroyEvade: boolean;
        flipEvadeRemaining: number | null;
        destroyEvadeRemaining: number | null;
    }

    interface MarkerData {
        type?: string;
        destroyEvadeRemaining?: unknown;
        remainingOwnerTurns?: unknown;
        remainingTurns?: unknown;
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
        inheritedTimer: number | null;
        inheritedOwner: unknown | null;
        flipEvadeRemaining: number | null;
        inheritedFlipEvadeRemaining: number | null;
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
        return type === 'GUARD' || type === 'INHERITED_HYPERACTIVE' || type === 'LIVING_WILL';
    }

    function getSpecialStoneTimerClass(rawType: unknown, fallback?: unknown): string {
        if (SpecialStoneRegistry && typeof (SpecialStoneRegistry as { getSpecialStoneTimerClass?: (v: unknown, f?: unknown) => string }).getSpecialStoneTimerClass === 'function') {
            return (SpecialStoneRegistry as { getSpecialStoneTimerClass: (v: unknown, f?: unknown) => string }).getSpecialStoneTimerClass(rawType, fallback);
        }
        return fallback !== undefined ? String(fallback) : 'special-timer';
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

    function isInheritedHyperactiveType(type: unknown): boolean {
        return normalizeSpecialStoneType(type) === 'INHERITED_HYPERACTIVE';
    }

    function isLivingWillType(type: unknown): boolean {
        return normalizeSpecialStoneType(type) === 'LIVING_WILL';
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
            }
            if (rawRegenRemaining === undefined) rawRegenRemaining = obj.regenRemaining;
        }

        const type = normalizeSpecialStoneType(rawType);
        if (isInheritedHyperactiveType(type)) return null;

        const timer = toCounterOrNull(rawTimer);
        if (timer !== null) return timer;
        if (type === 'REGEN') return toCounterOrNull(rawRegenRemaining);
        return null;
    }

    function createSpecialStoneStatusSnapshot(input: unknown, options: unknown): StatusSnapshot {
        const source = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
        const mode = (options && typeof options === 'object' && (options as Record<string, unknown>).mode) || 'raw';
        const rawType = source.type || source.special || null;
        const type = normalizeSpecialStoneType(rawType);
        const info = getSpecialStoneInfo(type);
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
        const hasFlipProtection = !hasGhost && (hasGuard || !!(info && info.flipProtected));
        const hasDestroyProtection = !hasGhost && (hasGuard || !!(info && info.destroyProtected));
        const hasFlipEvade = !ultimateExpired && flipEvadeRemaining !== null && flipEvadeRemaining > 0;
        const hasDestroyEvade = !ultimateExpired && destroyEvadeRemaining !== null && destroyEvadeRemaining > 0;

        return {
            rawType,
            type,
            info,
            name: (info && info.name) || (rawType ? String(rawType) : ''),
            description: (info && info.desc) || '効果情報は未登録です。',
            timerClass: getSpecialStoneTimerClass(type, 'special-timer'),
            displayTimer,
            hasGuard,
            hasGhost,
            hasMobility,
            hasFlipProtection,
            hasDestroyProtection,
            hasFlipEvade,
            hasDestroyEvade,
            flipEvadeRemaining,
            destroyEvadeRemaining
        };
    }

    function buildSpecialStoneStatusTags(inputs: unknown[], options: unknown): string[] {
        const items = Array.isArray(inputs) ? inputs : [];
        const snapshots = items
            .map((input) => createSpecialStoneStatusSnapshot(input, { mode: 'info' }))
            .filter((snapshot) => !!(snapshot && snapshot.type));
        const nonOverlaySnapshots = snapshots.filter((snapshot) => !isOverlayOnlySpecialStoneType(snapshot && snapshot.type));
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
        if ((!opts || opts.includeSpecialStone !== false) && (
            nonOverlaySnapshots.length > 0
            || snapshots.some((snapshot) => normalizeSpecialStoneType(snapshot && snapshot.type) === 'INHERITED_HYPERACTIVE')
        )) tags.push('特殊石');
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
        if (primarySnapshot && !primarySnapshot.hasGhost && primarySnapshot.hasDestroyProtection) tags.push('破壊保護');

        return Array.from(new Set(tags));
    }

    function resolveStoneVisualStatusFromMarkers(markersAtCell: unknown[], options: unknown): VisualStatus {
        const markers = Array.isArray(markersAtCell) ? markersAtCell.filter(Boolean) as Marker[] : [];
        const out: VisualStatus = {
            special: null,
            timer: null,
            owner: null,
            inheritedTimer: null,
            inheritedOwner: null,
            flipEvadeRemaining: null,
            inheritedFlipEvadeRemaining: null,
            destroyEvadeRemaining: null,
            livingWillAura: false
        };

        const destroyValues = markers
            .map((marker) => toCounterOrNull(marker && marker.data && marker.data.destroyEvadeRemaining))
            .filter((value): value is number => value !== null);
        if (destroyValues.length > 0) {
            out.destroyEvadeRemaining = destroyValues.reduce((sum, value) => sum + value, 0);
        }

        const inherited = markers.find((marker) => (
            marker &&
            marker.data &&
            isInheritedHyperactiveType(marker.data.type)
        ));
        if (inherited) {
            out.inheritedTimer = toCounterOrNull(inherited.data && inherited.data.remainingOwnerTurns);
            out.inheritedOwner = (inherited.owner !== undefined && inherited.owner !== null) ? inherited.owner : null;
            out.inheritedFlipEvadeRemaining = toCounterOrNull(inherited.data && inherited.data.flipEvadeRemaining);
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
                type: visualSpecial.data && visualSpecial.data.type,
                timer: visualSpecial.data && visualSpecial.data.remainingOwnerTurns,
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
