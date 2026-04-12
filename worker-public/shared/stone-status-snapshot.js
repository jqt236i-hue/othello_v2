(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        let SpecialStoneRegistry = null;
        try {
            SpecialStoneRegistry = require('./special-stone-registry');
        } catch (e) { /* ignore */ }
        module.exports = factory(SpecialStoneRegistry);
    } else {
        root.StoneStatusSnapshot = factory(root.SpecialStoneRegistry || null);
    }
}(typeof self !== 'undefined' ? self : this, function (SpecialStoneRegistry) {
    'use strict';

    function normalizeSpecialStoneType(rawType) {
        if (SpecialStoneRegistry && typeof SpecialStoneRegistry.normalizeSpecialStoneType === 'function') {
            return SpecialStoneRegistry.normalizeSpecialStoneType(rawType);
        }
        if (rawType === null || typeof rawType === 'undefined') return null;
        const asString = String(rawType).trim();
        return asString ? asString.toUpperCase() : null;
    }

    function getSpecialStoneInfo(rawType) {
        if (SpecialStoneRegistry && typeof SpecialStoneRegistry.getSpecialStoneInfo === 'function') {
            return SpecialStoneRegistry.getSpecialStoneInfo(rawType);
        }
        return null;
    }

    function isOverlayOnlySpecialStoneType(rawType) {
        if (SpecialStoneRegistry && typeof SpecialStoneRegistry.isOverlayOnlySpecialStoneType === 'function') {
            return SpecialStoneRegistry.isOverlayOnlySpecialStoneType(rawType);
        }
        const type = normalizeSpecialStoneType(rawType);
        return type === 'GUARD' || type === 'INHERITED_HYPERACTIVE' || type === 'LIVING_WILL';
    }

    function getSpecialStoneTimerClass(rawType, fallback) {
        if (SpecialStoneRegistry && typeof SpecialStoneRegistry.getSpecialStoneTimerClass === 'function') {
            return SpecialStoneRegistry.getSpecialStoneTimerClass(rawType, fallback);
        }
        return fallback !== undefined ? fallback : 'special-timer';
    }

    function toCounterOrNull(value) {
        if (value === null || value === undefined || value === '') return null;
        const n = Number(value);
        if (!Number.isFinite(n)) return null;
        return Math.max(0, Math.trunc(n));
    }

    function isInheritedHyperactiveType(type) {
        return normalizeSpecialStoneType(type) === 'INHERITED_HYPERACTIVE';
    }

    function isLivingWillType(type) {
        return normalizeSpecialStoneType(type) === 'LIVING_WILL';
    }

    function resolveDisplayTimerValue(typeOrInput, timerValue, regenRemainingValue) {
        let rawType = typeOrInput;
        let rawTimer = timerValue;
        let rawRegenRemaining = regenRemainingValue;

        if (typeOrInput && typeof typeOrInput === 'object') {
            rawType = typeOrInput.type || typeOrInput.special || null;
            if (rawTimer === undefined) {
                if (Object.prototype.hasOwnProperty.call(typeOrInput, 'timer')) rawTimer = typeOrInput.timer;
                else if (Object.prototype.hasOwnProperty.call(typeOrInput, 'remainingOwnerTurns')) rawTimer = typeOrInput.remainingOwnerTurns;
            }
            if (rawRegenRemaining === undefined) rawRegenRemaining = typeOrInput.regenRemaining;
        }

        const type = normalizeSpecialStoneType(rawType);
        if (isInheritedHyperactiveType(type)) return null;

        const timer = toCounterOrNull(rawTimer);
        if (timer !== null) return timer;
        if (type === 'REGEN') return toCounterOrNull(rawRegenRemaining);
        return null;
    }

    function createSpecialStoneStatusSnapshot(input, options) {
        const source = (input && typeof input === 'object') ? input : {};
        const mode = (options && options.mode) || 'raw';
        const rawType = source.type || source.special || null;
        const type = normalizeSpecialStoneType(rawType);
        const info = getSpecialStoneInfo(type);
        const displayTimer = resolveDisplayTimerValue(source);
        const ultimateExpired = type === 'ULTIMATE_HYPERACTIVE' && displayTimer !== null && displayTimer <= 0;

        let flipEvadeRemaining = toCounterOrNull(source.flipEvadeRemaining);
        if (flipEvadeRemaining === null && info) {
            if (mode === 'info') flipEvadeRemaining = toCounterOrNull(info.tagFlipEvadeDefault);
            else if (mode === 'visual') flipEvadeRemaining = toCounterOrNull(info.visualFlipEvadeDefault);
        }

        let destroyEvadeRemaining = toCounterOrNull(source.destroyEvadeRemaining);
        if (destroyEvadeRemaining === null && info && mode === 'info') {
            destroyEvadeRemaining = toCounterOrNull(info.tagDestroyEvadeDefault);
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

    function buildSpecialStoneStatusTags(inputs, options) {
        const items = Array.isArray(inputs) ? inputs : [];
        const snapshots = items
            .map((input) => createSpecialStoneStatusSnapshot(input, { mode: 'info' }))
            .filter((snapshot) => !!(snapshot && snapshot.type));
        const nonOverlaySnapshots = snapshots.filter((snapshot) => !isOverlayOnlySpecialStoneType(snapshot && snapshot.type));
        const primaryInput = options && options.primary
            ? options.primary
            : (items.length > 0 ? items[0] : null);
        const primarySnapshot = primaryInput
            ? createSpecialStoneStatusSnapshot(primaryInput, { mode: 'info' })
            : null;
        const livingWillAura = !!((options && options.livingWillAura) || snapshots.some((snapshot) => isLivingWillType(snapshot && snapshot.type)));
        const tags = [];

        if (options && options.hasGuard) tags.push('守る意志適用中');
        if ((!options || options.includeSpecialStone !== false) && nonOverlaySnapshots.length > 0) tags.push('特殊石');
        if (livingWillAura) tags.push('生きる意志付与');
        if (primarySnapshot && primarySnapshot.hasGhost) tags.push('幽体');
        if (snapshots.some((snapshot) => snapshot.hasMobility)) tags.push('多動状態');
        if (snapshots.some((snapshot) => snapshot.hasFlipEvade)) tags.push('反転回避');
        if (snapshots.some((snapshot) => snapshot.hasDestroyEvade)) tags.push('破壊回避');
        if (primarySnapshot && !primarySnapshot.hasGhost && primarySnapshot.hasFlipProtection) tags.push('反転保護');
        if (primarySnapshot && !primarySnapshot.hasGhost && primarySnapshot.hasDestroyProtection) tags.push('破壊保護');

        return Array.from(new Set(tags));
    }

    function resolveStoneVisualStatusFromMarkers(markersAtCell, options) {
        const markers = Array.isArray(markersAtCell) ? markersAtCell.filter(Boolean) : [];
        const out = {
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
            .filter((value) => value !== null);
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
            }, { mode: (options && options.mode) || 'raw' });
            out.special = snapshot.type || null;
            out.timer = snapshot.displayTimer;
            out.owner = (visualSpecial.owner !== undefined && visualSpecial.owner !== null) ? visualSpecial.owner : null;
            out.flipEvadeRemaining = snapshot.flipEvadeRemaining;
            out.destroyEvadeRemaining = snapshot.destroyEvadeRemaining;
            return out;
        }

        const bombMarker = options && options.bombMarker;
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
