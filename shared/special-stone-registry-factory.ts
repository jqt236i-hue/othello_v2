type RuntimeResolver = () => unknown;

interface SpecialStoneRegistryCompatibilityReaders {
    readEvasionStatus?: RuntimeResolver;
    readManifestStoneRegistry?: RuntimeResolver;
}

function readCompatibilityValue(resolver: RuntimeResolver | undefined): unknown {
    if (typeof resolver !== 'function') return null;
    try {
        return resolver();
    } catch (_error) {
        return null;
    }
}

function createSpecialStoneRegistry(
    EvasionStatusInput: unknown,
    ManifestStoneRegistryInput: unknown,
    MultiCellStoneInput: unknown,
    compatibilityReadersInput?: SpecialStoneRegistryCompatibilityReaders
): any {
    const compatibilityReaders = compatibilityReadersInput || {};
    return (function (
    EvasionStatus: unknown,
    ManifestStoneRegistry: any,
    MultiCellStone: any
) {
    'use strict';

    interface SpecialStoneInfo {
        name: string;
        desc: string;
        flipProtected?: boolean;
        destroyProtected?: boolean;
        inviolable?: boolean;
        multiCellFootprint?: string;
        detailBackgroundImage?: string;
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
        inviolable: boolean;
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

    type StoneEffectCategory =
        | 'special_stone_body'
        | 'trap'
        | 'bomb'
        | 'stone_status'
        | 'manifest_stone'
        | 'board_marker'
        | 'placement_effect';

    type OwnershipChangePolicy = 'revert' | 'resolve_after_change' | 'preserve';
    type MarkerSubjectKind =
        | 'stone_body'
        | 'stone_status'
        | 'cell_marker'
        | 'topology'
        | 'placement_effect';
    type MarkerOwnershipPolicy = 'stone_owner' | 'source_player' | 'none';
    type MarkerDurationClock = 'owner_turn' | 'completed_turn' | 'permanent' | 'none';
    type MarkerExclusivityGroup = 'temporary_special_cell' | null;

    interface MarkerSemanticTraits {
        subjectKind: MarkerSubjectKind;
        ownershipPolicy: MarkerOwnershipPolicy;
        durationClock: MarkerDurationClock;
        exclusivityGroup: MarkerExclusivityGroup;
        visualLayer: 'stone' | 'stone_overlay' | 'cell' | 'topology';
    }

    interface SpecialStoneCardDefinition {
        cardId: string;
        cardNameJa: string;
        cardType: string;
        markerType: string;
    }

    interface StoneEffectRule {
        markerType: string;
        category: StoneEffectCategory;
        countsAsSpecialStone: boolean;
        temptTargetable: boolean;
        captureTargetable: boolean;
        lossWillRevertible: boolean;
        willHunterPriority: boolean;
        durationAffectable: boolean;
        theorySpawnCandidate: boolean;
        normalVisual: boolean;
        blocksTempt: boolean;
        ownershipChangePolicy: OwnershipChangePolicy;
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
        const compatibilityCandidate = readCompatibilityValue(compatibilityReaders.readManifestStoneRegistry);
        if (compatibilityCandidate && typeof compatibilityCandidate === 'object') {
            return compatibilityCandidate;
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
        const compatibilityCandidate = readCompatibilityValue(compatibilityReaders.readEvasionStatus) as {
            getFlipEvadeDefault?: unknown;
            getDestroyEvadeDefault?: unknown;
        } | null;
        if (
            compatibilityCandidate &&
            typeof compatibilityCandidate.getFlipEvadeDefault === 'function' &&
            typeof compatibilityCandidate.getDestroyEvadeDefault === 'function'
        ) {
            return compatibilityCandidate;
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
            flipProtected: true
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
        FIRE: Object.freeze({
            name: '火石',
            desc: 'ランダムなマスを灼熱マスにする。',
            flipProtected: true,
            timerClass: 'dragon-timer'
        }),
        WATER: Object.freeze({
            name: '水石',
            desc: 'ランダムなマスを治癒マスにする。自分の特殊石があるマスを優先する。',
            flipProtected: true,
            timerClass: 'dragon-timer'
        }),
        GRASS: Object.freeze({
            name: '草石',
            desc: 'ランダムな空きマスに種をまく。',
            flipProtected: true,
            timerClass: 'dragon-timer'
        }),
        SHINRA_BANSHO_GOD: Object.freeze({
            name: '森羅万象神',
            desc: '火・水・草・雷の意志が融合した2×2の永続特殊石。不可侵を持ち、自ターン開始時に4属性効果を順番に発動する。',
            inviolable: true,
            multiCellFootprint: 'square_2x2.v1',
            detailBackgroundImage: 'assets/images/special-cards/backgrounds/shinra_bansho_god_background.png'
        }),
        METEOR_GOD: Object.freeze({
            name: '因果抹消神石',
            desc: '敵石をランダムに1つ選び、そのマスを穴化する。',
            flipProtected: true,
            timerClass: 'dragon-timer'
        }),
        HYPERACTIVE: Object.freeze({
            name: '躍動石',
            desc: 'ターン開始時に移動し、移動後に反転する。',
            mobility: true,
            tagFlipEvadeDefault: readFlipDefault('HYPERACTIVE')
        }),
        EXTREME_HYPERACTIVE: Object.freeze({
            name: '極悪躍動魔',
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
            name: '究極躍動神',
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
        ZOMBIE: Object.freeze({
            name: '屍石',
            desc: '所有者ターン開始時に隣接1マスへ移動し、4回ごとに移動後位置から隣接敵通常石を屍石へ感染させ、失われた時に1回だけ復活する。',
            timerClass: 'countdown-timer'
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
        ULTIMATE_WORK_GOD: Object.freeze({
            name: '究極労働神',
            desc: '所有者ターン開始時、布石を5得るか上昇する確率で自壊する。'
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
        TIME_STOP_DEITY: Object.freeze({
            name: '時間停神',
            desc: 'カウント終了時に時間停止を発動し、発動ターンを含めて合計4回連続で行動する。',
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
            flipProtected: true
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
        POISON_CELL: Object.freeze({
            name: '毒マス',
            desc: '10ターン持続し、このマスにいる完全保護・不可侵以外の石を毒状態にする。'
        }),
        POISONED: Object.freeze({
            name: '毒状態',
            desc: '付与後5ターンで通常の破壊を受ける。完全保護で解除される。',
            overlayOnlyVisual: true
        }),
        SCORCHED_CELL: Object.freeze({
            name: '灼熱マス',
            desc: '10ターン持続し、このマスに同じ石が3ターン居続けると通常の破壊を試みる。'
        }),
        HEALING_CELL: Object.freeze({
            name: '治癒マス',
            desc: '8ターン持続し、所有者ターン開始時に上の特殊石本体の持続ターンを3増やす。'
        }),
        SCORCHED: Object.freeze({
            name: '灼熱状態',
            desc: '同じ灼熱マスに居続けると3ターンで通常の破壊を受ける。',
            overlayOnlyVisual: true
        }),
        THEORY_INCARNATION: Object.freeze({
            name: '理論の化身',
            desc: '3ターン不可侵の顕現石。所有者のカード使用を封じる。'
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
        SACRIFICE: Object.freeze({
            name: '犠牲石',
            desc: '相手の通常カード使用時に自壊し、そのカード効果を無効化する。5ターン持続。',
            timerClass: 'special-timer'
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
        })
    });

    const SPECIAL_STONE_CARD_DEFINITIONS: Readonly<Record<string, Readonly<SpecialStoneCardDefinition>>> = Object.freeze({
        PROTECTED_NEXT_STONE: Object.freeze({ cardId: 'hard_01', cardNameJa: '弱い意志', cardType: 'PROTECTED_NEXT_STONE', markerType: 'PROTECTED' }),
        PERMA_PROTECT_NEXT_STONE: Object.freeze({ cardId: 'perma_01', cardNameJa: '強い意志', cardType: 'PERMA_PROTECT_NEXT_STONE', markerType: 'PERMA_PROTECTED' }),
        SNIPER_WILL: Object.freeze({ cardId: 'sniper_01', cardNameJa: '狙撃の意志', cardType: 'SNIPER_WILL', markerType: 'SNIPER' }),
        GHOST_WILL: Object.freeze({ cardId: 'ghost_01', cardNameJa: '幽霊の意志', cardType: 'GHOST_WILL', markerType: 'GHOST' }),
        SACRIFICE_WILL: Object.freeze({ cardId: 'sacrifice_will_01', cardNameJa: '犠牲の意志', cardType: 'SACRIFICE_WILL', markerType: 'SACRIFICE' }),
        AFTERIMAGE_WILL: Object.freeze({ cardId: 'afterimage_will_01', cardNameJa: '避ける意志', cardType: 'AFTERIMAGE_WILL', markerType: 'AFTERIMAGE_WILL' }),
        TRAP_WILL: Object.freeze({ cardId: 'trap_01', cardNameJa: '罠の意志', cardType: 'TRAP_WILL', markerType: 'TRAP' }),
        TIME_BOMB: Object.freeze({ cardId: 'bomb_01', cardNameJa: '時限爆弾', cardType: 'TIME_BOMB', markerType: 'TIME_BOMB' }),
        TIME_STOP_GOD: Object.freeze({ cardId: 'time_stop_god_01', cardNameJa: '時間停石', cardType: 'TIME_STOP_GOD', markerType: 'TIME_STOP' }),
        TIME_STOP_DEITY: Object.freeze({ cardId: 'time_stop_deity_01', cardNameJa: '時間停神', cardType: 'TIME_STOP_DEITY', markerType: 'TIME_STOP_DEITY' }),
        REGEN_WILL: Object.freeze({ cardId: 'regen_01', cardNameJa: '復活の意志', cardType: 'REGEN_WILL', markerType: 'REGEN' }),
        ZOMBIE_WILL: Object.freeze({ cardId: 'zombie_will_01', cardNameJa: 'ゾンビの意志', cardType: 'ZOMBIE_WILL', markerType: 'ZOMBIE' }),
        ULTIMATE_REVERSE_DRAGON: Object.freeze({ cardId: 'udr_01', cardNameJa: '究極反転龍', cardType: 'ULTIMATE_REVERSE_DRAGON', markerType: 'DRAGON' }),
        BREEDING_WILL: Object.freeze({ cardId: 'breeding_01', cardNameJa: '繁殖の意志', cardType: 'BREEDING_WILL', markerType: 'BREEDING' }),
        PROLIFERATION_WILL: Object.freeze({ cardId: 'proliferation_01', cardNameJa: '増殖の意志', cardType: 'PROLIFERATION_WILL', markerType: 'PROLIFERATION' }),
        HYPERACTIVE_WILL: Object.freeze({ cardId: 'hyperactive_01', cardNameJa: '躍動の意志', cardType: 'HYPERACTIVE_WILL', markerType: 'HYPERACTIVE' }),
        EXTREME_HYPERACTIVE_WILL: Object.freeze({ cardId: 'extreme_hyperactive_01', cardNameJa: '極悪躍動魔', cardType: 'EXTREME_HYPERACTIVE_WILL', markerType: 'EXTREME_HYPERACTIVE' }),
        ESCAPE_WILL: Object.freeze({ cardId: 'escape_01', cardNameJa: '逃げる意志', cardType: 'ESCAPE_WILL', markerType: 'ESCAPE_HYPERACTIVE' }),
        ROBOT_VACUUM_WILL: Object.freeze({ cardId: 'robot_vacuum_01', cardNameJa: 'ロボット掃除機', cardType: 'ROBOT_VACUUM_WILL', markerType: 'ROBOT_VACUUM' }),
        GLUTTONOUS_WILL: Object.freeze({ cardId: 'gluttonous_will_01', cardNameJa: '悪食の意志', cardType: 'GLUTTONOUS_WILL', markerType: 'GLUTTONOUS' }),
        WILL_HUNTER_KING: Object.freeze({ cardId: 'will_hunter_king_01', cardNameJa: '意志狩りの王', cardType: 'WILL_HUNTER_KING', markerType: 'WILL_HUNTER_KING' }),
        WORK_WILL: Object.freeze({ cardId: 'work_01', cardNameJa: '出稼ぎの意志', cardType: 'WORK_WILL', markerType: 'WORK' }),
        ULTIMATE_WORK_GOD: Object.freeze({ cardId: 'ultimate_work_god_01', cardNameJa: '究極労働神', cardType: 'ULTIMATE_WORK_GOD', markerType: 'ULTIMATE_WORK_GOD' }),
        STONE_SALVATION_GOD: Object.freeze({ cardId: 'stone_salvation_god_01', cardNameJa: '救済神', cardType: 'STONE_SALVATION_GOD', markerType: 'STONE_SALVATION_GOD' }),
        DESTROY_DRAGON_WILL: Object.freeze({ cardId: 'destroy_dragon_01', cardNameJa: '破壊龍', cardType: 'DESTROY_DRAGON_WILL', markerType: 'DESTROY_DRAGON' }),
        LIGHTNING_WILL: Object.freeze({ cardId: 'lightning_01', cardNameJa: '雷の意志', cardType: 'LIGHTNING_WILL', markerType: 'LIGHTNING' }),
        FIRE_WILL: Object.freeze({ cardId: 'fire_will_01', cardNameJa: '火の意志', cardType: 'FIRE_WILL', markerType: 'FIRE' }),
        WATER_WILL: Object.freeze({ cardId: 'water_will_01', cardNameJa: '水の意志', cardType: 'WATER_WILL', markerType: 'WATER' }),
        GRASS_WILL: Object.freeze({ cardId: 'grass_will_01', cardNameJa: '草の意志', cardType: 'GRASS_WILL', markerType: 'GRASS' }),
        ULTIMATE_DESTROY_GOD: Object.freeze({ cardId: 'udg_01', cardNameJa: '究極破壊神', cardType: 'ULTIMATE_DESTROY_GOD', markerType: 'ULTIMATE_DESTROY_GOD' }),
        ULTIMATE_HYPERACTIVE_GOD: Object.freeze({ cardId: 'ultimate_hyperactive_01', cardNameJa: '究極躍動神', cardType: 'ULTIMATE_HYPERACTIVE_GOD', markerType: 'ULTIMATE_HYPERACTIVE' }),
        METEOR_GOD: Object.freeze({ cardId: 'meteor_god_01', cardNameJa: '因果抹消神', cardType: 'METEOR_GOD', markerType: 'METEOR_GOD' })
    });

    const STONE_STATUS_TYPES: ReadonlySet<string> = new Set([
        'GUARD',
        'LIVING_WILL',
        'POISONED',
        'SCORCHED'
    ]);

    const BOARD_MARKER_TYPES: ReadonlySet<string> = new Set([
        'BLOCKADE',
        'METEOR_HOLE',
        'FREEZE',
        'SEED',
        'POISON_CELL',
        'SCORCHED_CELL',
        'HEALING_CELL'
    ]);

    const TEMPORARY_SPECIAL_CELL_TYPES: ReadonlySet<string> = new Set([
        'BLOCKADE',
        'FREEZE',
        'SEED',
        'POISON_CELL',
        'SCORCHED_CELL',
        'HEALING_CELL'
    ]);

    const HAZARD_CELL_TYPES: ReadonlySet<string> = new Set([
        'POISON_CELL',
        'SCORCHED_CELL'
    ]);

    const COMPLETED_TURN_CELL_TYPES: ReadonlySet<string> = new Set([
        'POISON_CELL',
        'SCORCHED_CELL',
        'HEALING_CELL'
    ]);

    const HAZARD_STONE_STATUS_TYPES: ReadonlySet<string> = new Set([
        'POISONED',
        'SCORCHED'
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

    function makeStoneEffectRule(markerType: string, overrides: Partial<StoneEffectRule>): Readonly<StoneEffectRule> {
        const category = overrides.category || 'special_stone_body';
        const countsAsSpecialStone = overrides.countsAsSpecialStone !== undefined
            ? overrides.countsAsSpecialStone
            : (category === 'special_stone_body' || category === 'trap' || category === 'bomb');
        const defaultOwnershipChangePolicy: OwnershipChangePolicy = (
            category === 'special_stone_body' || category === 'bomb'
        )
            ? 'revert'
            : (category === 'trap' ? 'resolve_after_change' : 'preserve');
        return Object.freeze({
            markerType,
            category,
            countsAsSpecialStone,
            temptTargetable: overrides.temptTargetable !== undefined ? overrides.temptTargetable : countsAsSpecialStone,
            captureTargetable: overrides.captureTargetable !== undefined ? overrides.captureTargetable : category === 'special_stone_body',
            lossWillRevertible: overrides.lossWillRevertible !== undefined ? overrides.lossWillRevertible : countsAsSpecialStone,
            willHunterPriority: overrides.willHunterPriority !== undefined ? overrides.willHunterPriority : countsAsSpecialStone,
            durationAffectable: overrides.durationAffectable !== undefined ? overrides.durationAffectable : category === 'special_stone_body' || category === 'stone_status',
            theorySpawnCandidate: overrides.theorySpawnCandidate !== undefined ? overrides.theorySpawnCandidate : category === 'special_stone_body',
            normalVisual: overrides.normalVisual !== undefined ? overrides.normalVisual : false,
            blocksTempt: overrides.blocksTempt === true,
            ownershipChangePolicy: overrides.ownershipChangePolicy || defaultOwnershipChangePolicy
        });
    }

    function buildStoneEffectRules(): Readonly<Record<string, Readonly<StoneEffectRule>>> {
        const out: Record<string, Readonly<StoneEffectRule>> = {};
        for (const definition of Object.values(SPECIAL_STONE_CARD_DEFINITIONS)) {
            if (definition && definition.markerType && !out[definition.markerType]) {
                out[definition.markerType] = makeStoneEffectRule(definition.markerType, {});
            }
        }

        out.ULTIMATE_WORK_GOD = makeStoneEffectRule('ULTIMATE_WORK_GOD', {
            durationAffectable: false
        });
        out.SHINRA_BANSHO_GOD = makeStoneEffectRule('SHINRA_BANSHO_GOD', {
            temptTargetable: false,
            captureTargetable: false,
            lossWillRevertible: false,
            willHunterPriority: false,
            durationAffectable: false,
            theorySpawnCandidate: false,
            ownershipChangePolicy: 'preserve'
        });

        out.REGEN = makeStoneEffectRule('REGEN', {
            durationAffectable: false,
            ownershipChangePolicy: 'resolve_after_change'
        });
        out.ZOMBIE = makeStoneEffectRule('ZOMBIE', {
            ownershipChangePolicy: 'resolve_after_change'
        });

        out.TRAP = makeStoneEffectRule('TRAP', {
            category: 'trap',
            captureTargetable: false,
            theorySpawnCandidate: false,
            normalVisual: true,
            willHunterPriority: false
        });
        out.TIME_BOMB = makeStoneEffectRule('TIME_BOMB', {
            category: 'bomb',
            captureTargetable: false,
            theorySpawnCandidate: false
        });
        out.GUARD = makeStoneEffectRule('GUARD', {
            category: 'stone_status',
            countsAsSpecialStone: false,
            temptTargetable: false,
            captureTargetable: false,
            lossWillRevertible: false,
            theorySpawnCandidate: false,
            willHunterPriority: false,
            blocksTempt: true
        });
        out.LIVING_WILL = makeStoneEffectRule('LIVING_WILL', {
            category: 'stone_status',
            countsAsSpecialStone: false,
            temptTargetable: true,
            captureTargetable: false,
            lossWillRevertible: false,
            theorySpawnCandidate: false,
            normalVisual: true,
            willHunterPriority: false,
            ownershipChangePolicy: 'resolve_after_change'
        });
        out.POISONED = makeStoneEffectRule('POISONED', {
            category: 'stone_status',
            countsAsSpecialStone: false,
            temptTargetable: false,
            captureTargetable: false,
            lossWillRevertible: false,
            theorySpawnCandidate: false,
            normalVisual: true,
            willHunterPriority: false,
            durationAffectable: false
        });
        out.SCORCHED = makeStoneEffectRule('SCORCHED', {
            category: 'stone_status',
            countsAsSpecialStone: false,
            temptTargetable: false,
            captureTargetable: false,
            lossWillRevertible: false,
            theorySpawnCandidate: false,
            normalVisual: true,
            willHunterPriority: false,
            durationAffectable: false
        });

        for (const type of BOARD_MARKER_TYPES) {
            out[type] = makeStoneEffectRule(type, {
                category: 'board_marker',
                countsAsSpecialStone: false,
                temptTargetable: false,
                captureTargetable: false,
                lossWillRevertible: false,
                willHunterPriority: false,
                durationAffectable: false,
                theorySpawnCandidate: false,
                normalVisual: true
            });
        }
        for (const type of PLACEMENT_EFFECT_TYPES) {
            out[type] = makeStoneEffectRule(type, {
                category: 'placement_effect',
                countsAsSpecialStone: false,
                temptTargetable: false,
                captureTargetable: false,
                lossWillRevertible: false,
                willHunterPriority: false,
                durationAffectable: false,
                theorySpawnCandidate: false
            });
        }
        for (const type of INVIOLABLE_MANIFEST_STONE_TYPES) {
            out[type] = makeStoneEffectRule(type, {
                category: 'manifest_stone',
                countsAsSpecialStone: false,
                temptTargetable: false,
                captureTargetable: false,
                lossWillRevertible: false,
                willHunterPriority: false,
                durationAffectable: false,
                theorySpawnCandidate: false
            });
        }
        return Object.freeze(out);
    }

    const STONE_EFFECT_RULES: Readonly<Record<string, Readonly<StoneEffectRule>>> = buildStoneEffectRules();

    function normalizeSpecialStoneType(rawType: unknown): string | null {
        if (rawType === null || typeof rawType === 'undefined') return null;
        const asString = String(rawType).trim();
        if (!asString) return null;
        const upper = asString.toUpperCase();
        return SPECIAL_STONE_TYPE_ALIASES[upper] || upper;
    }

    function normalizeSpecialStoneCardType(rawCardType: unknown): string | null {
        if (rawCardType === null || typeof rawCardType === 'undefined') return null;
        const asString = String(rawCardType).trim();
        return asString ? asString.toUpperCase() : null;
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

    function getSpecialStoneFootprint(marker: any): ReadonlyArray<Readonly<{ row: number; col: number; role: string }>> {
        if (MultiCellStone && typeof MultiCellStone.getSpecialStoneFootprint === 'function') {
            return MultiCellStone.getSpecialStoneFootprint(marker);
        }
        if (!marker || typeof marker !== 'object' || Array.isArray(marker)) return Object.freeze([]);
        const type = normalizeSpecialStoneType(marker.data && marker.data.type);
        const row = marker.row;
        const col = marker.col;
        if (!Number.isInteger(row) || !Number.isInteger(col)) return Object.freeze([]);
        const footprint = String(marker && marker.data && marker.data.footprint || '');
        if (type !== 'SHINRA_BANSHO_GOD' || (footprint && footprint !== 'square_2x2.v1')) {
            return Object.freeze([Object.freeze({ row, col, role: 'anchor' })]);
        }
        return Object.freeze([
            Object.freeze({ row, col, role: 'anchor' }),
            Object.freeze({ row, col: col + 1, role: 'top-right' }),
            Object.freeze({ row: row + 1, col, role: 'bottom-left' }),
            Object.freeze({ row: row + 1, col: col + 1, role: 'bottom-right' })
        ]);
    }

    function markerOccupiesCell(marker: any, row: unknown, col: unknown): boolean {
        if (MultiCellStone && typeof MultiCellStone.markerOccupiesCell === 'function') {
            return MultiCellStone.markerOccupiesCell(marker, row, col) === true;
        }
        const targetRow = Number(row);
        const targetCol = Number(col);
        if (!Number.isInteger(targetRow) || !Number.isInteger(targetCol)) return false;
        return getSpecialStoneFootprint(marker).some((cell) => cell.row === targetRow && cell.col === targetCol);
    }

    function isMultiCellSpecialStoneMarker(marker: any): boolean {
        if (MultiCellStone && typeof MultiCellStone.isMultiCellSpecialStoneMarker === 'function') {
            return MultiCellStone.isMultiCellSpecialStoneMarker(marker) === true;
        }
        return normalizeSpecialStoneType(marker && marker.data && marker.data.type) === 'SHINRA_BANSHO_GOD';
    }

    function isFullyProtectedSpecialStoneMarker(marker: any): boolean {
        if (!marker || marker.kind !== 'specialStone' || !marker.data) return false;
        const info = getSpecialStoneInfo(marker.data.type);
        return !!(info && info.flipProtected === true && info.destroyProtected === true);
    }

    function isFullyProtectedCell(markers: unknown, row: unknown, col: unknown): boolean {
        if (!Array.isArray(markers)) return false;
        return markers.some((marker) => (
            isFullyProtectedSpecialStoneMarker(marker)
            && markerOccupiesCell(marker, row, col)
        ));
    }

    function isInviolableSpecialStoneMarker(marker: any): boolean {
        if (
            !marker
            || (marker.kind !== 'specialStone' && marker.kind !== 'manifestStone')
            || !marker.data
            || !isInviolableStoneEffect(marker.data.type, marker.data)
        ) {
            return false;
        }
        if (Object.prototype.hasOwnProperty.call(marker.data, 'remainingOwnerTurns')) {
            const remaining = Number(marker.data.remainingOwnerTurns);
            return Number.isFinite(remaining) && remaining > 0;
        }
        return true;
    }

    function isInviolableCell(markers: unknown, row: unknown, col: unknown): boolean {
        if (!Array.isArray(markers)) return false;
        return markers.some((marker) => (
            isInviolableSpecialStoneMarker(marker)
            && markerOccupiesCell(marker, row, col)
        ));
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

    function isInviolableSpecialType(rawType: unknown): boolean {
        const type = normalizeSpecialStoneType(rawType);
        if (!type) return false;
        const info = getSpecialStoneInfo(type);
        if (info && info.inviolable === true) return true;
        const metadata = getSpecialCardMarkerMetadata(type);
        return !!(metadata && metadata.inviolable === true);
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

    function getSpecialStoneCardDefinition(rawCardType: unknown): Readonly<SpecialStoneCardDefinition> | null {
        const cardType = normalizeSpecialStoneCardType(rawCardType);
        if (!cardType) return null;
        return SPECIAL_STONE_CARD_DEFINITIONS[cardType] || null;
    }

    function getMarkerTypeForSpecialStoneCard(rawCardType: unknown): string | null {
        const def = getSpecialStoneCardDefinition(rawCardType);
        return def ? def.markerType : null;
    }

    function getStoneEffectRule(rawType: unknown, markerData?: any): Readonly<StoneEffectRule> | null {
        const type = normalizeSpecialStoneType(rawType);
        const data = (markerData && typeof markerData === 'object') ? markerData : null;
        const category = String(data && data.category ? data.category : '').toLowerCase();
        if (!type) return null;
        if (category === 'bomb' && type !== 'TIME_BOMB') {
            return makeStoneEffectRule(type, {
                category: 'bomb',
                captureTargetable: false,
                theorySpawnCandidate: false
            });
        }
        if (type === 'HYPERACTIVE' && !!(data && data.instantPlacementOnly)) {
            return makeStoneEffectRule('HYPERACTIVE', {
                category: 'placement_effect',
                countsAsSpecialStone: false,
                temptTargetable: false,
                captureTargetable: false,
                lossWillRevertible: false,
                willHunterPriority: false,
                durationAffectable: false,
                theorySpawnCandidate: false
            });
        }
        return STONE_EFFECT_RULES[type] || null;
    }

    function ruleCategoryToLegacyRuleClass(category: StoneEffectCategory): SpecialStoneRuleClass {
        if (category === 'special_stone_body') return 'true_special_stone';
        return category;
    }

    function isTemptTargetableStoneEffect(rawType: unknown, markerData?: any): boolean {
        const rule = getStoneEffectRule(rawType, markerData);
        return !!(rule && rule.temptTargetable);
    }

    function isCaptureTargetableStoneEffect(rawType: unknown, markerData?: any): boolean {
        const rule = getStoneEffectRule(rawType, markerData);
        return !!(rule && rule.captureTargetable);
    }

    function isWillHunterPriorityTarget(rawType: unknown, markerData?: any): boolean {
        const rule = getStoneEffectRule(rawType, markerData);
        return !!(rule && rule.willHunterPriority && !rule.normalVisual);
    }

    function isNormalVisualStoneEffect(rawType: unknown, markerData?: any): boolean {
        const rule = getStoneEffectRule(rawType, markerData);
        return !!(rule && rule.normalVisual);
    }

    function blocksTempt(rawType: unknown, markerData?: any): boolean {
        const rule = getStoneEffectRule(rawType, markerData);
        return !!(rule && rule.blocksTempt);
    }

    function getOwnershipChangePolicy(rawType: unknown, markerData?: any): OwnershipChangePolicy {
        const rule = getStoneEffectRule(rawType, markerData);
        if (rule) return rule.ownershipChangePolicy;
        const ruleClass = classifySpecialStoneRuleClass(rawType, markerData);
        if (ruleClass === 'true_special_stone' || ruleClass === 'bomb') return 'revert';
        if (ruleClass === 'trap') return 'resolve_after_change';
        return 'preserve';
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
        const rule = getStoneEffectRule(type, data);
        return rule ? ruleCategoryToLegacyRuleClass(rule.category) : 'true_special_stone';
    }

    function getStoneEffectTraits(rawType: unknown, markerData?: any): Readonly<StoneEffectTraits> | null {
        const type = normalizeSpecialStoneType(rawType);
        if (!type) return null;
        const data = (markerData && typeof markerData === 'object') ? markerData : null;
        const category = classifySpecialStoneRuleClass(type, data);
        if (!category) return null;
        const rule = getStoneEffectRule(type, data);
        const countsAsSpecialStone = rule
            ? rule.countsAsSpecialStone
            : category === 'true_special_stone' || category === 'trap' || category === 'bomb';
        const info = getSpecialStoneInfo(type);
        const inviolable = (
            category === 'manifest_stone'
            || INVIOLABLE_MANIFEST_STONE_TYPES.has(type)
            || !!(info && info.inviolable === true)
        );
        const targetableAsSpecialStone = countsAsSpecialStone && !inviolable;
        return Object.freeze({
            category,
            countsAsSpecialStone,
            targetableAsSpecialStone,
            revertibleByLossWill: rule ? rule.lossWillRevertible : targetableAsSpecialStone,
            spawnableByTheoryIncarnation: rule ? rule.theorySpawnCandidate : category === 'true_special_stone' && !THEORY_INCARNATION_SPAWN_EXCLUDED_TYPES.has(type),
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

    function isBoardMarkerType(rawType: unknown): boolean {
        const rule = getStoneEffectRule(rawType);
        return !!rule && rule.category === 'board_marker';
    }

    function isTemporarySpecialCellType(rawType: unknown): boolean {
        const type = normalizeSpecialStoneType(rawType);
        return !!type && TEMPORARY_SPECIAL_CELL_TYPES.has(type);
    }

    function isHazardCellType(rawType: unknown): boolean {
        const type = normalizeSpecialStoneType(rawType);
        return !!type && HAZARD_CELL_TYPES.has(type);
    }

    function isHazardStoneStatusType(rawType: unknown): boolean {
        const type = normalizeSpecialStoneType(rawType);
        return !!type && HAZARD_STONE_STATUS_TYPES.has(type);
    }

    function getMarkerSemanticTraits(rawType: unknown, markerData?: any): Readonly<MarkerSemanticTraits> | null {
        const type = normalizeSpecialStoneType(rawType);
        if (!type) return null;
        if (type === 'METEOR_HOLE') {
            return Object.freeze({
                subjectKind: 'topology',
                ownershipPolicy: 'none',
                durationClock: 'permanent',
                exclusivityGroup: null,
                visualLayer: 'topology'
            });
        }
        if (TEMPORARY_SPECIAL_CELL_TYPES.has(type)) {
            const completedTurnCell = COMPLETED_TURN_CELL_TYPES.has(type);
            return Object.freeze({
                subjectKind: 'cell_marker',
                ownershipPolicy: completedTurnCell ? 'none' : 'source_player',
                durationClock: completedTurnCell ? 'completed_turn' : 'owner_turn',
                exclusivityGroup: 'temporary_special_cell',
                visualLayer: 'cell'
            });
        }
        if (STONE_STATUS_TYPES.has(type)) {
            return Object.freeze({
                subjectKind: 'stone_status',
                ownershipPolicy: 'stone_owner',
                durationClock: HAZARD_STONE_STATUS_TYPES.has(type) ? 'completed_turn' : 'owner_turn',
                exclusivityGroup: null,
                visualLayer: 'stone_overlay'
            });
        }
        const rule = getStoneEffectRule(type, markerData);
        if (!rule) return null;
        if (rule.category === 'placement_effect') {
            return Object.freeze({
                subjectKind: 'placement_effect',
                ownershipPolicy: 'stone_owner',
                durationClock: 'none',
                exclusivityGroup: null,
                visualLayer: 'stone_overlay'
            });
        }
        if (rule.category === 'board_marker') {
            return Object.freeze({
                subjectKind: 'cell_marker',
                ownershipPolicy: 'source_player',
                durationClock: 'owner_turn',
                exclusivityGroup: null,
                visualLayer: 'cell'
            });
        }
        return Object.freeze({
            subjectKind: 'stone_body',
            ownershipPolicy: 'stone_owner',
            durationClock: 'owner_turn',
            exclusivityGroup: null,
            visualLayer: 'stone'
        });
    }

    function getMarkerSubjectKind(rawType: unknown, markerData?: any): MarkerSubjectKind | null {
        const traits = getMarkerSemanticTraits(rawType, markerData);
        return traits ? traits.subjectKind : null;
    }

    function getMarkerOwnershipPolicy(rawType: unknown, markerData?: any): MarkerOwnershipPolicy | null {
        const traits = getMarkerSemanticTraits(rawType, markerData);
        return traits ? traits.ownershipPolicy : null;
    }

    function getMarkerDurationClock(rawType: unknown, markerData?: any): MarkerDurationClock | null {
        const traits = getMarkerSemanticTraits(rawType, markerData);
        return traits ? traits.durationClock : null;
    }

    function getMarkerDurationValue(rawType: unknown, markerData?: any): number | null {
        const data = markerData && typeof markerData === 'object' ? markerData : {};
        const clock = getMarkerDurationClock(rawType, data);
        const raw = clock === 'completed_turn'
            ? data.remainingTurns
            : clock === 'owner_turn'
                ? data.remainingOwnerTurns
                : null;
        if (raw === null || raw === undefined || raw === '') return null;
        const value = Number(raw);
        return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : null;
    }

    function isPlacementEffectMarker(marker: any): boolean {
        return classifyMarkerRuleClass(marker) === 'placement_effect';
    }

    function isDurationAffectableMarker(marker: any): boolean {
        const rule = getStoneEffectRule(marker && marker.data && marker.data.type, marker && marker.data);
        if (rule) return rule.durationAffectable;
        const ruleClass = classifyMarkerRuleClass(marker);
        return ruleClass === 'true_special_stone' || ruleClass === 'stone_status';
    }

    return {
        SPECIAL_STONE_REGISTRY,
        SPECIAL_STONE_TYPE_ALIASES,
        SPECIAL_CARD_MARKER_METADATA,
        SPECIAL_STONE_CARD_DEFINITIONS,
        STONE_EFFECT_RULES,
        STONE_STATUS_TYPES,
        BOARD_MARKER_TYPES,
        TEMPORARY_SPECIAL_CELL_TYPES,
        HAZARD_CELL_TYPES,
        COMPLETED_TURN_CELL_TYPES,
        HAZARD_STONE_STATUS_TYPES,
        PLACEMENT_EFFECT_TYPES,
        normalizeSpecialStoneType,
        getSpecialStoneInfo,
        getSpecialStoneFootprint,
        markerOccupiesCell,
        isMultiCellSpecialStoneMarker,
        isFullyProtectedSpecialStoneMarker,
        isFullyProtectedCell,
        isInviolableSpecialStoneMarker,
        isInviolableCell,
        getSpecialStoneDisplayName,
        getSpecialStoneDescription,
        getSpecialCardMarkerMetadata,
        isInviolableSpecialType,
        getSpecialStoneTimerClass,
        isOverlayOnlySpecialStoneType,
        getSpecialStoneCardDefinition,
        getMarkerTypeForSpecialStoneCard,
        getStoneEffectRule,
        isTemptTargetableStoneEffect,
        isCaptureTargetableStoneEffect,
        isWillHunterPriorityTarget,
        isNormalVisualStoneEffect,
        blocksTempt,
        getOwnershipChangePolicy,
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
        isBoardMarkerType,
        isTemporarySpecialCellType,
        isHazardCellType,
        isHazardStoneStatusType,
        getMarkerSemanticTraits,
        getMarkerSubjectKind,
        getMarkerOwnershipPolicy,
        getMarkerDurationClock,
        getMarkerDurationValue,
        isPlacementEffectMarker,
        isDurationAffectableMarker
    };
    })(EvasionStatusInput, ManifestStoneRegistryInput, MultiCellStoneInput);
}

export = createSpecialStoneRegistry;
