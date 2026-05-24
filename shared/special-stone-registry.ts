(function (root: any, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.SpecialStoneRegistry = factory();
    }
}(typeof self !== 'undefined' ? self : this as unknown as Record<string, unknown>, function () {
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

    const SPECIAL_STONE_TYPE_ALIASES: Readonly<TypeAliases> = Object.freeze({
        EXTREME_HYPERACTIVE_WILL: 'EXTREME_HYPERACTIVE',
        TRAP_REVEAL: 'TRAP',
        ULTIMATE_HYPERACTIVE_GOD: 'ULTIMATE_HYPERACTIVE'
    });

    const SPECIAL_STONE_REGISTRY: Readonly<SpecialStoneRegistryMap> = Object.freeze({
        PROTECTED: Object.freeze({
            name: '弱い石',
            desc: '次の自分ターン開始まで反転されない。',
            flipProtected: true
        }),
        PERMA_PROTECTED: Object.freeze({
            name: '強い石',
            desc: '反転されない。所有者ターン開始10回で絶対保護石へ昇格する。',
            flipProtected: true,
            timerClass: 'countdown-timer'
        }),
        DRAGON: Object.freeze({
            name: '究極反転龍',
            desc: '配置時に周囲8マスを反転。自ターン開始時はランダムな空きマスへ移動してから周囲8マスを反転。5ターンで消滅。',
            flipProtected: true,
            timerClass: 'dragon-timer'
        }),
        BREEDING: Object.freeze({
            name: '繁殖石',
            desc: '配置時と自ターン開始時に周囲へ石を1つ生成。前回生成石起点で拡散し、5ターン持続。',
            flipProtected: true,
            timerClass: 'breeding-timer'
        }),
        PROLIFERATION: Object.freeze({
            name: '増殖石',
            desc: '破壊対象になった時はその破壊を受けず、周囲8マスの空きへ同色の増殖石を1つ増やす。各増殖石は所有者ターン10回持続し、親石の残りターンは引き継がない。空きが無い場合は通常どおり破壊され、10ターン経過後や反転時は通常石に戻る。'
        }),
        ULTIMATE_DESTROY_GOD: Object.freeze({
            name: '究極破壊神',
            desc: '配置時に周囲8マスの敵石を破壊。自ターン開始時はランダムな空きマスへ移動してから周囲8マスの敵石を破壊。5ターンで消滅。',
            flipProtected: true,
            timerClass: 'udg-timer'
        }),
        DESTROY_DRAGON: Object.freeze({
            name: '破壊龍',
            desc: '配置時と自ターン開始時に周囲8マスの敵石をランダム1個だけ破壊。3ターンで消滅。',
            flipProtected: true,
            timerClass: 'dragon-timer'
        }),
        SNIPER: Object.freeze({
            name: '狙撃石',
            desc: '自ターン開始時に最も近い敵石を1つ破壊。同距離ならランダム。5ターンで消滅。'
        }),
        LIGHTNING: Object.freeze({
            name: '落雷石',
            desc: '配置ターン即時＋自ターン開始時に盤面上のランダムな敵石を1つ破壊。5ターン持続。反転保護を持つ特殊石。',
            flipProtected: true,
            timerClass: 'dragon-timer'
        }),
        HYPERACTIVE: Object.freeze({
            name: '多動石',
            desc: '両者ターン開始時に周囲の空きへ1マス移動。ターン開始移動で空きが無い場合は同色の通常石に戻る。移動後に挟めば反転。反転対象時は1回だけマス移動で回避する。',
            mobility: true,
            tagFlipEvadeDefault: 1
        }),
        EXTREME_HYPERACTIVE: Object.freeze({
            name: '極悪多動魔',
            desc: '両者ターン開始時に周囲8マス（空き・占有）からランダム1マス移動。占有マスを選んだ場合はその石を1マス退避させてから進入し、退避先が無い場合はその石と位置交換して進入。退避も位置交換もできる候補が無い場合は同色の通常石に戻る。移動後に挟めば反転し、隣接1マス（周囲8マス）の石を敵味方問わず遠ざかるように1マス退避させる。退避先が無い石はその場に残る。反転対象時はマス移動で回避し、最大3回まで。破壊対象時も1回だけ空きマスへ移動して回避する。',
            mobility: true,
            tagFlipEvadeDefault: 3,
            tagDestroyEvadeDefault: 1,
            visualFlipEvadeDefault: 3
        }),
        ESCAPE_HYPERACTIVE: Object.freeze({
            name: '逃亡石',
            desc: '両者ターン開始時に近くの石から逃げるように1マス移動。移動先で挟める石があれば反転可能。反転対象時は1回だけマス移動で回避し、移動先が無いと周囲8マスを爆破して消滅する。',
            mobility: true,
            tagFlipEvadeDefault: 1
        }),
        ROBOT_VACUUM: Object.freeze({
            name: 'ロボット掃除機石',
            desc: '両者ターン開始時に敵石へ近づくよう1マス移動し、移動後に周囲8マスの敵石を吸い込んで破壊する。空きが無い場合は同色の通常石に戻る。吸い込み1個につき布石+3。守る石の完全保護は吸い込めず、5ターンで同色の通常石に戻る。'
        }),
        GLUTTONOUS: Object.freeze({
            name: '悪食石',
            desc: '両者ターン開始時に1マス移動し、隣接敵石があれば優先して進入して捕食する。隣接敵石が無い時は敵に近づくよう移動し、2連続で捕食失敗すると飢えて消滅する。反転保護を持つ特殊石。',
            flipProtected: true
        }),
        ULTIMATE_HYPERACTIVE: Object.freeze({
            name: '究極多動神',
            desc: '両者ターン開始時に直線1〜5マス移動を2回行い、2マス以上は途中の石を飛び越える。移動後に挟めば反転。ターン開始移動で移動先が無い場合は同色の通常石に戻る。反転対象時はマス移動で回避（最大3回）。破壊対象時も1回だけマス移動で回避する。10ターン後は同色の通常石に戻る。',
            mobility: true,
            tagFlipEvadeDefault: 3,
            tagDestroyEvadeDefault: 1,
            visualFlipEvadeDefault: 3
        }),
        INHERITED_HYPERACTIVE: Object.freeze({
            name: '継承多動石',
            desc: '両者ターン開始時に周囲の空きへ1マス移動。ターン開始移動で空きが無い場合は継承多動状態を解除して通常石に戻る。移動後に挟めば反転。反転対象時は1回だけマス移動で回避し、破壊対象時も1回だけ空きマスへ移動して回避する。反転回避後は通常どおり反転される。10ターン持続（所有者ターン開始時のみ減算）。',
            mobility: true,
            tagFlipEvadeDefault: 1,
            tagDestroyEvadeDefault: 1,
            overlayOnlyVisual: true
        }),
        REGEN: Object.freeze({
            name: '復活石',
            desc: '反転または破壊されるたびに、残り復活可能回数を1消費して元の色へ戻り、その位置から挟める列を反転する。'
        }),
        LIVING_WILL: Object.freeze({
            name: '生きる意志',
            desc: '一度だけ、その石が失われる直前に付与時点の状態へ復活させる。隕石や盤面縮小で元マスが使えない時は別の空きマスへ移る。',
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
            desc: '石が残っている間、自ターン開始時に1→2→4→8→16の順で布石獲得。',
            timerClass: 'work-timer'
        }),
        TIME_BOMB: Object.freeze({
            name: '時限爆弾',
            desc: '3ターン後に周囲9マスを爆破。反転されると解除。'
        }),
        TIME_STOP: Object.freeze({
            name: '時間停石',
            desc: '配置ターンは減算せず、以後は所有者ターン開始ごとにカウント減少する。5回目の所有者ターン開始時に時間停止を発動し、そのターンと次のターンを同じプレイヤーが連続で行動する。時間停止中は画面全体をモノクロ表示する。発動時に効果は終了し、その石は同色の通常石に戻る。先に空マスになった、または所有者の石でなくなった場合は不発で終了する。反転保護は持たない。',
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
            desc: '3ターン、反転/交換/破壊/誘惑を無効化する。',
            flipProtected: true,
            destroyProtected: true,
            overlayOnlyVisual: true
        }),
        STONE_SALVATION_GOD: Object.freeze({
            name: '救済神',
            desc: '反転されない。盤面にいる間、破壊された石を救済神の持ち主の通常石としてランダムな空きマスに復活させる。10ターン後は同色の通常石に戻る。',
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
        OBSERVER: Object.freeze({
            name: '盤理の観測者石',
            desc: '所有者ターン開始時に30%で発動し、布石を1〜5獲得する。5ターン持続。'
        }),
        GHOST: Object.freeze({
            name: '幽体石',
            desc: '5ターンの間、反転と石破壊の対象にはなるがその石自身は受けない。反転列の成立は無効化せず、交換の意志の対象外で、入替や他の効果は通常どおり受ける。',
            ghost: true
        }),
        AFTERIMAGE_WILL: Object.freeze({
            name: '残像石',
            desc: '反転回避3回と破壊回避3回を持つ特殊石。回避成功時だけ対応する回数を消費し、両方0になると通常石へ戻る。反転回避で移動先が無いと消滅し、破壊回避で空きマスが無いとそのまま破壊される。',
            tagFlipEvadeDefault: 3,
            tagDestroyEvadeDefault: 3
        }),
        WILL_HUNTER_KING: Object.freeze({
            name: '意志狩りの王',
            desc: '自ターン開始時に敵石1つを狙い、特殊石があれば優先してその方向へ移動しながら斬撃で破壊する。反転回避2回と破壊回避2回を持ち、8ターン後は同色の通常石に戻る。',
            tagFlipEvadeDefault: 1
        }),
        METEOR_HOLE: Object.freeze({
            name: '流星穴',
            desc: '隕石で破壊された永続穴。このマスには配置・移動で入れず、反転経路も遮断する。'
        }),
        ABSOLUTE_PROTECTED: Object.freeze({
            name: '絶対保護石',
            desc: '反転・交換・破壊・誘惑・テレポート・隕石・意志の喪失を含む全ての効果を無効化する。解除なし（永続）。',
            flipProtected: true,
            destroyProtected: true
        })
    });

    function normalizeSpecialStoneType(rawType: unknown): string | null {
        if (rawType === null || typeof rawType === 'undefined') return null;
        const asString = String(rawType).trim();
        if (!asString) return null;
        const upper = asString.toUpperCase();
        return SPECIAL_STONE_TYPE_ALIASES[upper] || upper;
    }

    function getSpecialStoneInfo(rawType: unknown): Readonly<SpecialStoneInfo> | null {
        const type = normalizeSpecialStoneType(rawType);
        if (!type) return null;
        return SPECIAL_STONE_REGISTRY[type] || null;
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

    return {
        SPECIAL_STONE_REGISTRY,
        SPECIAL_STONE_TYPE_ALIASES,
        normalizeSpecialStoneType,
        getSpecialStoneInfo,
        getSpecialStoneDisplayName,
        getSpecialStoneDescription,
        getSpecialStoneTimerClass,
        isOverlayOnlySpecialStoneType
    };
}));

export {};
