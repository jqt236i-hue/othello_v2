(function (root: any, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        let EvasionStatus = null;
        let ManifestStoneRegistry = null;
        try {
            EvasionStatus = require('./evasion-status');
        } catch (e) { /* ignore */ }
        try {
            ManifestStoneRegistry = require('./manifest-stone-registry');
        } catch (e) { /* ignore */ }
        module.exports = factory(EvasionStatus, ManifestStoneRegistry);
    } else {
        root.SpecialStoneRegistry = factory(root.EvasionStatus || null, root.ManifestStoneRegistry || null);
    }
}(typeof self !== 'undefined' ? self : this as unknown as Record<string, unknown>, function (EvasionStatus: unknown, ManifestStoneRegistry: any) {
    'use strict';

    interface SpecialStoneInfo {
        name: string;
        desc: string;
        flipProtected?: boolean;
        destroyProtected?: boolean;
        timerClass?: string;
        mobility?: boolean;
        ghost?: boolean;
        overlayOnlyVisual?: boolean;
        tagFlipEvadeDefault?: number;
        tagDestroyEvadeDefault?: number;
        visualFlipEvadeDefault?: number;
    }

    interface SpecialStoneRegistryMap {
        [key: string]: Readonly<SpecialStoneInfo>;
    }

    interface TypeAliases {
        [key: string]: string;
    }

    interface SpecialCardMarkerMetadata {
        cardId: string;
        markerType: string;
        displayName: string;
        durationOwnerTurns: number;
        absoluteProtected: boolean;
        visualEffectKey: string;
        imagePathByOwner: Readonly<Record<string, string>>;
    }

    interface SpecialCardMarkerMetadataMap {
        [key: string]: Readonly<SpecialCardMarkerMetadata>;
    }

    type SpecialStoneRuleClass =
        | 'true_special_stone'
        | 'manifest_stone'
        | 'stone_status'
        | 'bomb'
        | 'trap'
        | 'board_marker'
        | 'placement_effect';

    interface StoneEffectTraits {
        category: SpecialStoneRuleClass;
        countsAsSpecialStone: boolean;
        targetableAsSpecialStone: boolean;
        revertibleByLossWill: boolean;
        spawnableByTheoryIncarnation: boolean;
        inviolable: boolean;
    }

    const SPECIAL_STONE_TYPE_ALIASES: Readonly<TypeAliases> = Object.freeze({
        EXTREME_HYPERACTIVE_WILL: 'EXTREME_HYPERACTIVE',
        TRAP_REVEAL: 'TRAP',
        ULTIMATE_HYPERACTIVE_GOD: 'ULTIMATE_HYPERACTIVE'
    });

    function getManifestStoneRegistryModule(): any {
        if (ManifestStoneRegistry && typeof ManifestStoneRegistry === 'object') {
            return ManifestStoneRegistry;
        }
        if (typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>).ManifestStoneRegistry) {
            return (globalThis as Record<string, unknown>).ManifestStoneRegistry;
        }
        if (typeof self !== 'undefined' && (self as Record<string, unknown>).ManifestStoneRegistry) {
            return (self as Record<string, unknown>).ManifestStoneRegistry;
        }
        return null;
    }

    function buildSpecialCardMarkerMetadata(): Readonly<SpecialCardMarkerMetadataMap> {
        const registry = getManifestStoneRegistryModule();
        const source = registry && registry.MANIFEST_STONE_METADATA && typeof registry.MANIFEST_STONE_METADATA === 'object'
            ? registry.MANIFEST_STONE_METADATA
            : null;
        if (!source) return Object.freeze({});
        const out: SpecialCardMarkerMetadataMap = {};
        for (const key of Object.keys(source)) {
            const metadata = source[key];
            if (!metadata || typeof metadata !== 'object') continue;
            out[key] = Object.freeze(Object.assign({}, metadata));
        }
        return Object.freeze(out);
    }

    const SPECIAL_CARD_MARKER_METADATA: Readonly<SpecialCardMarkerMetadataMap> = buildSpecialCardMarkerMetadata();

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

    function readFlipDefault(type: string): number | undefined {
        const evasionStatus = getEvasionStatusModule();
        if (!evasionStatus || typeof (evasionStatus as { getFlipEvadeDefault?: (t: string, o?: unknown) => number | null }).getFlipEvadeDefault !== 'function') {
            return undefined;
        }
        const value = (evasionStatus as { getFlipEvadeDefault: (t: string, o?: unknown) => number | null }).getFlipEvadeDefault(type, { mode: 'info' });
        return Number.isFinite(Number(value)) ? Number(value) : undefined;
    }

    function readDestroyDefault(type: string): number | undefined {
        const evasionStatus = getEvasionStatusModule();
        if (!evasionStatus || typeof (evasionStatus as { getDestroyEvadeDefault?: (t: string, o?: unknown) => number | null }).getDestroyEvadeDefault !== 'function') {
            return undefined;
        }
        const value = (evasionStatus as { getDestroyEvadeDefault: (t: string, o?: unknown) => number | null }).getDestroyEvadeDefault(type, { mode: 'info' });
        return Number.isFinite(Number(value)) ? Number(value) : undefined;
    }

    function readVisualFlipDefault(type: string): number | undefined {
        const evasionStatus = getEvasionStatusModule();
        if (!evasionStatus || typeof (evasionStatus as { getFlipEvadeDefault?: (t: string, o?: unknown) => number | null }).getFlipEvadeDefault !== 'function') {
            return undefined;
        }
        const value = (evasionStatus as { getFlipEvadeDefault: (t: string, o?: unknown) => number | null }).getFlipEvadeDefault(type, { mode: 'visual' });
        return Number.isFinite(Number(value)) ? Number(value) : undefined;
    }

    const SPECIAL_STONE_REGISTRY: Readonly<SpecialStoneRegistryMap> = Object.freeze({
        PROTECTED: Object.freeze({
            name: '弱い石',
            desc: '相手の反転を受けない。',
            flipProtected: true
        }),
        PERMA_PROTECTED: Object.freeze({
            name: '強い石',
            desc: '相手の反転を受けない。',
            flipProtected: true,
            timerClass: 'countdown-timer'
        }),
        DRAGON: Object.freeze({
            name: '究極反転龍',
            desc: 'ターン開始時に移動し、周囲を反転する。',
            flipProtected: true,
            timerClass: 'dragon-timer'
        }),
        BREEDING: Object.freeze({
            name: '繁殖石',
            desc: '周囲に同色の石を生成する。',
            flipProtected: true,
            timerClass: 'breeding-timer'
        }),
        PROLIFERATION: Object.freeze({
            name: '増殖石',
            desc: '破壊される時、近くの空きマスへ増殖する。'
        }),
        ULTIMATE_DESTROY_GOD: Object.freeze({
            name: '究極破壊神',
            desc: 'ターン開始時に移動し、周囲の敵石を破壊する。',
            flipProtected: true,
            timerClass: 'udg-timer'
        }),
        DESTROY_DRAGON: Object.freeze({
            name: '破壊龍',
            desc: '周囲の敵石を破壊する。',
            flipProtected: true,
            timerClass: 'dragon-timer'
        }),
        SNIPER: Object.freeze({
            name: '狙撃石',
            desc: 'ターン開始時、近い敵石を1つ破壊する。'
        }),
        LIGHTNING: Object.freeze({
            name: '落雷石',
            desc: '敵石をランダムに1つ破壊する。',
            flipProtected: true,
            timerClass: 'dragon-timer'
        }),
        METEOR_GOD: Object.freeze({
            name: '因果抹消神石',
            desc: '敵石をランダムに1つ選び、そのマスを穴化する。',
            flipProtected: true,
            timerClass: 'dragon-timer'
        }),
        HYPERACTIVE: Object.freeze({
            name: '多動石',
            desc: 'ターン開始時に移動し、移動後に反転する。',
            mobility: true,
            tagFlipEvadeDefault: readFlipDefault('HYPERACTIVE')
        }),
        EXTREME_HYPERACTIVE: Object.freeze({
            name: '極悪多動魔',
            desc: 'ターン開始時に移動し、周囲の石を押しのける。',
            mobility: true,
            tagFlipEvadeDefault: readFlipDefault('EXTREME_HYPERACTIVE'),
            tagDestroyEvadeDefault: readDestroyDefault('EXTREME_HYPERACTIVE'),
            visualFlipEvadeDefault: readVisualFlipDefault('EXTREME_HYPERACTIVE')
        }),
        ESCAPE_HYPERACTIVE: Object.freeze({
            name: '逃亡石',
            desc: 'ターン開始時に近くの石から逃げる。',
            mobility: true,
            tagFlipEvadeDefault: readFlipDefault('ESCAPE_HYPERACTIVE')
        }),
        ROBOT_VACUUM: Object.freeze({
            name: 'ロボット掃除機石',
            desc: 'ターン開始時に敵石へ近づき、周囲の敵石を吸い込む。'
        }),
        GLUTTONOUS: Object.freeze({
            name: '悪食石',
            desc: 'ターン開始時に移動し、隣接する敵石を捕食する。',
            flipProtected: true
        }),
        ULTIMATE_HYPERACTIVE: Object.freeze({
            name: '究極多動神',
            desc: 'ターン開始時に大きく移動し、移動後に反転する。',
            mobility: true,
            tagFlipEvadeDefault: readFlipDefault('ULTIMATE_HYPERACTIVE'),
            tagDestroyEvadeDefault: readDestroyDefault('ULTIMATE_HYPERACTIVE'),
            visualFlipEvadeDefault: readVisualFlipDefault('ULTIMATE_HYPERACTIVE')
        }),
        REGEN: Object.freeze({
            name: '復活石',
            desc: '失われた時に元の色へ戻る。'
        }),
        LIVING_WILL: Object.freeze({
            name: '生きる意志',
            desc: '失われた時に一度だけ復活する。',
            overlayOnlyVisual: true
        }),
        GOLD: Object.freeze({
            name: '金石',
            desc: '配置直後に自壊し、そのターンの獲得布石を4倍にする。'
        }),
        RAINBOW: Object.freeze({
            name: '虹石',
            desc: '配置直後に自壊し、そのターンの獲得布石を6倍にする。'
        }),
        SILVER: Object.freeze({
            name: '銀石',
            desc: '配置直後に自壊し、そのターンの獲得布石を3倍にする。'
        }),
        WORK: Object.freeze({
            name: '労働石',
            desc: 'ターン開始時に布石を得る。',
            timerClass: 'work-timer'
        }),
        TIME_BOMB: Object.freeze({
            name: '時限爆弾',
            desc: '3ターン後に周囲9マスを爆破。反転されると解除。'
        }),
        TIME_STOP: Object.freeze({
            name: '時間停石',
            desc: 'カウント終了時に時間停止を発動する。',
            timerClass: 'countdown-timer'
        }),
        CROSS_BOMB: Object.freeze({
            name: '十字爆弾',
            desc: '通常反転の直後に即起爆し、中心と縦横2マスの石を爆破。'
        }),
        X_BOMB: Object.freeze({
            name: 'クロス爆弾',
            desc: '通常反転の直後に即起爆し、中心と斜め2マスの石を爆破。'
        }),
        GUARD: Object.freeze({
            name: '守る石',
            desc: 'あらゆる妨害効果を防ぐ。',
            flipProtected: true,
            destroyProtected: true,
            overlayOnlyVisual: true
        }),
        STONE_SALVATION_GOD: Object.freeze({
            name: '救済神',
            desc: '破壊された石を復活させる。',
            flipProtected: true,
            timerClass: 'countdown-timer'
        }),
        TRAP: Object.freeze({
            name: '罠石',
            desc: '次の相手ターン中に反転されると発動する。'
        }),
        FREEZE: Object.freeze({
            name: '凍結マス',
            desc: '5ターンの間このマスを凍結する。石がある場合はその石ごと凍結され、凍結中の石は反転・破壊・移動されない。凍結マスには配置・移動できず、反転経路も遮断する。'
        }),
        BLOCKADE: Object.freeze({
            name: '封鎖マス',
            desc: 'このマスには3ターンの間、配置・移動で入れない。'
        }),
        SEED: Object.freeze({
            name: '種マス',
            desc: '所有者ターン開始時だけ残り回数が減り、5回目で空いたままなら同色の通常石が1個芽生える。種マスには通常どおり配置・移動でき、石が置かれた時点で種は消える。'
        }),
        THEORY_INCARNATION: Object.freeze({
            name: '理論の化身',
            desc: '5ターン不可侵の顕現石。所有者のカード使用と石配置を封じる。'
        }),
        BOARD_EXECUTOR: Object.freeze({
            name: '盤界の執行者',
            desc: '4ターン不可侵の顕現石。盤面にある間、両者のカード使用を封じる。'
        }),
        OBSERVER_WILL: Object.freeze({
            name: '盤理の観測者',
            desc: '5ターン不可侵の顕現石。'
        }),
        GHOST: Object.freeze({
            name: '幽体石',
            desc: '反転や破壊の対象になるが、その効果を受けない。',
            ghost: true
        }),
        AFTERIMAGE_WILL: Object.freeze({
            name: '残像石',
            desc: '反転や破壊を回避する。',
            tagFlipEvadeDefault: readFlipDefault('AFTERIMAGE_WILL'),
            tagDestroyEvadeDefault: readDestroyDefault('AFTERIMAGE_WILL')
        }),
        WILL_HUNTER_KING: Object.freeze({
            name: '意志狩りの王',
            desc: '敵石を狙って移動し、破壊する。',
            tagFlipEvadeDefault: readFlipDefault('WILL_HUNTER_KING'),
            tagDestroyEvadeDefault: readDestroyDefault('WILL_HUNTER_KING')
        }),
        METEOR_HOLE: Object.freeze({
            name: '流星穴',
            desc: '因果抹消や盤面縮小で生じた永続穴。このマスには配置・移動で入れず、反転経路も遮断する。'
        }),
        ABSOLUTE_PROTECTED: Object.freeze({
            name: '絶対保護石',
            desc: 'あらゆる効果を受けない。',
            flipProtected: true,
            destroyProtected: true
        })
    });

    const STONE_STATUS_TYPES: ReadonlySet<string> = new Set([
        'GUARD',
        'LIVING_WILL'
    ]);

    const BOARD_MARKER_TYPES: ReadonlySet<string> = new Set([
        'BLOCKADE',
        'METEOR_HOLE',
        'FREEZE',
        'SEED'
    ]);

    const PLACEMENT_EFFECT_TYPES: ReadonlySet<string> = new Set([
        'CROSS_BOMB',
        'X_BOMB',
        'GOLD',
        'SILVER',
        'RAINBOW'
    ]);

    const THEORY_INCARNATION_SPAWN_EXCLUDED_TYPES: ReadonlySet<string> = new Set([
        'TRAP',
        'TIME_BOMB'
    ]);

    const INVIOLABLE_MANIFEST_STONE_TYPES: ReadonlySet<string> = new Set([
        'THEORY_INCARNATION',
        'BOARD_EXECUTOR',
        'OBSERVER_WILL'
    ]);

    function normalizeSpecialStoneType(rawType: unknown): string | null {
        if (rawType === null || typeof rawType === 'undefined') return null;
        const asString = String(rawType).trim();
        if (!asString) return null;
        const upper = asString.toUpperCase();
        return SPECIAL_STONE_TYPE_ALIASES[upper] || upper;
    }

    function hydrateEvasionDefaults(type: string, info: Readonly<SpecialStoneInfo> | null): Readonly<SpecialStoneInfo> | null {
        if (!type || !info) return info;
        const tagFlipEvadeDefault = info.tagFlipEvadeDefault !== undefined ? info.tagFlipEvadeDefault : readFlipDefault(type);
        const tagDestroyEvadeDefault = info.tagDestroyEvadeDefault !== undefined ? info.tagDestroyEvadeDefault : readDestroyDefault(type);
        const visualFlipEvadeDefault = info.visualFlipEvadeDefault !== undefined ? info.visualFlipEvadeDefault : readVisualFlipDefault(type);
        if (
            tagFlipEvadeDefault === info.tagFlipEvadeDefault &&
            tagDestroyEvadeDefault === info.tagDestroyEvadeDefault &&
            visualFlipEvadeDefault === info.visualFlipEvadeDefault
        ) {
            return info;
        }
        return Object.freeze(Object.assign({}, info, {
            tagFlipEvadeDefault,
            tagDestroyEvadeDefault,
            visualFlipEvadeDefault
        }));
    }

    function getSpecialStoneInfo(rawType: unknown): Readonly<SpecialStoneInfo> | null {
        const type = normalizeSpecialStoneType(rawType);
        if (!type) return null;
        return hydrateEvasionDefaults(type, SPECIAL_STONE_REGISTRY[type] || null);
    }

    function getSpecialStoneDisplayName(rawType: unknown, fallback?: unknown): string {
        const info = getSpecialStoneInfo(rawType);
        if (info && info.name) return info.name;
        if (fallback !== undefined) return String(fallback);
        return rawType ? String(rawType) : '';
    }

    function getSpecialStoneDescription(rawType: unknown, fallback?: unknown): string {
        const info = getSpecialStoneInfo(rawType);
        if (info && info.desc) return info.desc;
        if (fallback !== undefined) return String(fallback);
        return '';
    }

    function getSpecialCardMarkerMetadata(rawType: unknown): Readonly<SpecialCardMarkerMetadata> | null {
        const registry = getManifestStoneRegistryModule();
        if (registry && typeof registry.getManifestStoneMetadata === 'function') {
            return registry.getManifestStoneMetadata(rawType);
        }
        const type = normalizeSpecialStoneType(rawType);
        if (!type) return null;
        return SPECIAL_CARD_MARKER_METADATA[type] || null;
    }

    function isAbsoluteProtectedSpecialType(rawType: unknown): boolean {
        const type = normalizeSpecialStoneType(rawType);
        if (!type) return false;
        if (type === 'ABSOLUTE_PROTECTED') return true;
        const metadata = getSpecialCardMarkerMetadata(type);
        return !!(metadata && metadata.absoluteProtected === true);
    }

    function getSpecialStoneTimerClass(rawType: unknown, fallback?: unknown): string {
        const info = getSpecialStoneInfo(rawType);
        if (info && info.timerClass) return info.timerClass;
        if (fallback !== undefined) return String(fallback);
        return 'special-timer';
    }

    function isOverlayOnlySpecialStoneType(rawType: unknown): boolean {
        const info = getSpecialStoneInfo(rawType);
        return !!(info && info.overlayOnlyVisual === true);
    }

    function classifySpecialStoneRuleClass(rawType: unknown, markerData?: any): SpecialStoneRuleClass | null {
        const type = normalizeSpecialStoneType(rawType);
        const data = (markerData && typeof markerData === 'object') ? markerData : null;
        const category = String(data && data.category ? data.category : '').toLowerCase();

        if (category === 'bomb' || type === 'TIME_BOMB') {
            return 'bomb';
        }
        if (!type) return null;
        if (type === 'TRAP') {
            return 'trap';
        }
        const manifestStoneRegistry = getManifestStoneRegistryModule();
        if (manifestStoneRegistry && typeof manifestStoneRegistry.isManifestStoneType === 'function' && manifestStoneRegistry.isManifestStoneType(type)) {
            return 'manifest_stone';
        }
        if (INVIOLABLE_MANIFEST_STONE_TYPES.has(type)) {
            return 'manifest_stone';
        }
        if (type === 'HYPERACTIVE' && !!(data && data.instantPlacementOnly)) {
            return 'placement_effect';
        }
        if (PLACEMENT_EFFECT_TYPES.has(type)) {
            return 'placement_effect';
        }
        if (BOARD_MARKER_TYPES.has(type)) {
            return 'board_marker';
        }
        if (STONE_STATUS_TYPES.has(type)) {
            return 'stone_status';
        }
        return 'true_special_stone';
    }

    function getStoneEffectTraits(rawType: unknown, markerData?: any): Readonly<StoneEffectTraits> | null {
        const type = normalizeSpecialStoneType(rawType);
        if (!type) return null;
        const category = classifySpecialStoneRuleClass(type, markerData);
        if (!category) return null;
        const countsAsSpecialStone = category === 'true_special_stone' || category === 'trap' || category === 'bomb';
        const inviolable = category === 'manifest_stone' || INVIOLABLE_MANIFEST_STONE_TYPES.has(type);
        const targetableAsSpecialStone = countsAsSpecialStone && !inviolable;
        return Object.freeze({
            category,
            countsAsSpecialStone,
            targetableAsSpecialStone,
            revertibleByLossWill: targetableAsSpecialStone && type !== 'ABSOLUTE_PROTECTED',
            spawnableByTheoryIncarnation: category === 'true_special_stone' && !THEORY_INCARNATION_SPAWN_EXCLUDED_TYPES.has(type),
            inviolable
        });
    }

    function countsAsSpecialStone(rawType: unknown, markerData?: any): boolean {
        const traits = getStoneEffectTraits(rawType, markerData);
        return !!(traits && traits.countsAsSpecialStone);
    }

    function isTargetableSpecialStone(rawType: unknown, markerData?: any): boolean {
        const traits = getStoneEffectTraits(rawType, markerData);
        return !!(traits && traits.targetableAsSpecialStone);
    }

    function canLossWillRevert(rawType: unknown, markerData?: any): boolean {
        const traits = getStoneEffectTraits(rawType, markerData);
        return !!(traits && traits.revertibleByLossWill);
    }

    function isTheoryIncarnationSpawnCandidate(rawType: unknown, markerData?: any): boolean {
        const traits = getStoneEffectTraits(rawType, markerData);
        return !!(traits && traits.spawnableByTheoryIncarnation);
    }

    function isInviolableStoneEffect(rawType: unknown, markerData?: any): boolean {
        const traits = getStoneEffectTraits(rawType, markerData);
        return !!(traits && traits.inviolable);
    }

    function getTheoryIncarnationSpawnCandidates(): string[] {
        return Object.keys(SPECIAL_STONE_REGISTRY)
            .filter((type) => isTheoryIncarnationSpawnCandidate(type));
    }

    function classifyMarkerRuleClass(marker: any): SpecialStoneRuleClass | null {
        if (!marker || typeof marker !== 'object') return null;
        return classifySpecialStoneRuleClass(marker.data && marker.data.type, marker.data || null);
    }

    function isTrueSpecialStoneRuleClass(value: unknown): boolean {
        return value === 'true_special_stone';
    }

    function isTrueSpecialStoneMarker(marker: any): boolean {
        return classifyMarkerRuleClass(marker) === 'true_special_stone';
    }

    function isStoneStatusMarker(marker: any): boolean {
        return classifyMarkerRuleClass(marker) === 'stone_status';
    }

    function isBombMarker(marker: any): boolean {
        return classifyMarkerRuleClass(marker) === 'bomb';
    }

    function isTrapMarker(marker: any): boolean {
        return classifyMarkerRuleClass(marker) === 'trap';
    }

    function isBoardMarker(marker: any): boolean {
        return classifyMarkerRuleClass(marker) === 'board_marker';
    }

    function isPlacementEffectMarker(marker: any): boolean {
        return classifyMarkerRuleClass(marker) === 'placement_effect';
    }

    function isDurationAffectableMarker(marker: any): boolean {
        const ruleClass = classifyMarkerRuleClass(marker);
        return ruleClass === 'true_special_stone' || ruleClass === 'stone_status';
    }

    return {
        SPECIAL_STONE_REGISTRY,
        SPECIAL_STONE_TYPE_ALIASES,
        SPECIAL_CARD_MARKER_METADATA,
        STONE_STATUS_TYPES,
        BOARD_MARKER_TYPES,
        PLACEMENT_EFFECT_TYPES,
        normalizeSpecialStoneType,
        getSpecialStoneInfo,
        getSpecialStoneDisplayName,
        getSpecialStoneDescription,
        getSpecialCardMarkerMetadata,
        isAbsoluteProtectedSpecialType,
        getSpecialStoneTimerClass,
        isOverlayOnlySpecialStoneType,
        getStoneEffectTraits,
        countsAsSpecialStone,
        isTargetableSpecialStone,
        canLossWillRevert,
        isTheoryIncarnationSpawnCandidate,
        isInviolableStoneEffect,
        getTheoryIncarnationSpawnCandidates,
        classifySpecialStoneRuleClass,
        classifyMarkerRuleClass,
        isTrueSpecialStoneRuleClass,
        isTrueSpecialStoneMarker,
        isStoneStatusMarker,
        isBombMarker,
        isTrapMarker,
        isBoardMarker,
        isPlacementEffectMarker,
        isDurationAffectableMarker
    };
}));

export {};
