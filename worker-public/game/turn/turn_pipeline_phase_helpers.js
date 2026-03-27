/**
 * @file turn_pipeline_phase_helpers.js
 * @description Shared constants and pure helpers for turn_pipeline_phases (UMD)
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.TurnPipelinePhaseHelpers = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    const OBSERVER_PLACE_LINES = Object.freeze([
        '今日も観測しますかっと',
        '盤理は観測するためにある',
        '観測最高！'
    ]);

    const OBSERVER_LOST_LINE = '盤理観測してる場合じゃなかったわ';

    const WORK_PLACE_LINES = Object.freeze([
        'ここで稼いで一発逆転や！',
        '布石いっぱい掘るでー！',
        'ワイには夢があるんや！',
        '一攫千金や！'
    ]);

    const WORK_LOST_LINE = 'あああああああああああああ';

    const WORK_INCOME_LINES_BY_STEP = Object.freeze({
        1: '布石＋1 初儲けや！',
        2: '布石＋2 もっと掘るでー！',
        3: '布石＋4 順調やな！',
        4: '布石＋8 ぼろ儲けや！',
        5: '布石＋16 これで家族が養える...！'
    });

    const OBSERVER_CARD_ONE_LINERS = Object.freeze({
        TREASURE_BOX: '宝箱は即布石化',
        FREE_PLACEMENT: '挟めず置ける',
        LAST_RESORT: '石数劣勢かつパス時に3連続自由配置',
        SNIPER_WILL: '狙撃は毎開幕判定',
        PROTECTED_NEXT_STONE: '次の被弾だけ守る',
        SWAP_WITH_ENEMY: '敵石1個を奪取',
        POSITION_SWAP_WILL: '石2つの位置交換',
        PERMA_PROTECT_NEXT_STONE: '次石を永続保護',
        STRONG_WIND_WILL: '石を最長直線移動',
        SUPER_BUOYANCY_WILL: '石を上方向へ貫通移動',
        SUPER_GRAVITY_WILL: '石を下方向へ貫通移動',
        TRAP_WILL: '罠設置でターン終了',
        TEMPT_WILL: '敵特殊石を奪う',
        DOUBLE_CHAIN_WILL: '追加反転1回で三連鎖生成',
        TRIPLE_CHAIN_WILL: '追加反転2回で四連鎖生成',
        QUAD_CHAIN_WILL: '追加反転3回で無限連鎖生成',
        INFINITE_CHAIN_WILL: '追加反転できる限り継続',
        REGEN_WILL: '反転を一度巻戻す',
        DESTROY_ONE_STONE: '石1つを即破壊',
        TIME_BOMB: '3ターン後に爆破',
        ULTIMATE_REVERSE_DRAGON: '周囲反転を連発',
        BREEDING_WILL: '周囲へ石を増殖',
        CLONE_WILL: '隣接空きへ複製',
        SPLIT_WILL: '隣接空きへ分裂',
        TELEPORT_WILL: '石を空きへ転送',
        CELL_TELEPORT_WILL: '外側へ転送して穴化',
        CROSS_BOMB: '十字2マス爆破',
        X_BOMB: '斜め2マス爆破',
        DOUBLE_PLACE: '2連続で置き三連投石生成',
        TRIPLE_PLACE: '3連続で置き四連投石生成',
        QUAD_PLACE: '4連続で置き無限投石生成',
        INFINITE_PLACE: '合法手が尽きるまで置く',
        HEAVEN_BLESSING: '候補5枚から選択',
        CONDEMN_WILL: '相手手札1枚破壊',
        PLUNDER_WILL: '反転分を吸収',
        CORNER_TRIBUTE: '敵角4個以上で布石を奪う',
        WORK_WILL: '布石収入が増加',
        LOSS_WILL: '特殊石を全解除',
        GOLD_STONE: '反転布石4倍',
        RAINBOW_STONE: '反転布石6倍',
        SILVER_STONE: '反転布石3倍',
        CRYSTAL_STONE: '数字マス布石4倍',
        EXTEND_LIFE_WILL: '特殊石寿命2倍',
        EXTEND_LIFE_GOD: '特殊石寿命4倍',
        CORROSION_WILL: '特殊石寿命を半減',
        GUARD_WILL: '完全保護3ターン',
        DESTROY_DRAGON_WILL: '周囲敵1体破壊',
        ULTIMATE_DESTROY_GOD: '周囲敵を毎破壊',
        ULTIMATE_HYPERACTIVE_GOD: '直線移動を2回',
        BOARD_EXPANSION_WILL: '盤を1マス拡張',
        BOARD_EXPANSION_GOD: '角から3マス拡張',
    BLOCKADE_WILL: '空き1マス封鎖',
    METEOR_WILL: 'マスごと1セル破壊',
    FREEZE_WILL: '1マス凍結',
        OBSERVER_WILL: '観測成功で布石',
        HYPERACTIVE_WILL: '毎開幕1マス移動',
        HYPERACTIVE_INHERIT_WILL: '多動を10ターン付与',
        EXTREME_HYPERACTIVE_WILL: '移動後に隣接石を後退',
        ESCAPE_WILL: '離れる移動を継続',
        ROBOT_VACUUM_WILL: '敵を吸い込み移動',
        GLUTTONOUS_WILL: '敵を食べて進み2連続空腹で消滅',
        INSTANT_HYPERACTIVE_WILL: '即3回移動して消滅',
        SELL_CARD_WILL: '手札売却で布石',
        REBUILD_WILL: '手札全破壊3ドロー',
        SUPPLY_WILL: '2ドロー',
        SALVATION_WILL: '前ターン破壊の通常石を復活'
    });

    function pickRandomLine(lines, prng) {
        if (!Array.isArray(lines) || lines.length === 0) return null;
        const source = (prng && typeof prng.random === 'function') ? prng : Math;
        let value = Number(source.random());
        if (!Number.isFinite(value)) value = 0;
        if (value < 0) value = 0;
        if (value >= 1) value = 0.999999;
        const index = Math.floor(value * lines.length);
        return lines[Math.max(0, Math.min(lines.length - 1, index))] || null;
    }

    function resolveWorkIncomeLine(gained, incomeStep) {
        const normalizedStep = Number.isFinite(Number(incomeStep))
            ? Math.max(1, Math.min(5, Math.trunc(Number(incomeStep))))
            : null;
        if (normalizedStep && WORK_INCOME_LINES_BY_STEP[normalizedStep]) {
            return WORK_INCOME_LINES_BY_STEP[normalizedStep];
        }
        const g = Number(gained) || 0;
        const inferredStep = g >= 16 ? 5 : (g >= 8 ? 4 : (g >= 4 ? 3 : (g >= 2 ? 2 : 1)));
        return WORK_INCOME_LINES_BY_STEP[inferredStep] || WORK_INCOME_LINES_BY_STEP[1];
    }

    return {
        OBSERVER_PLACE_LINES,
        OBSERVER_LOST_LINE,
        WORK_PLACE_LINES,
        WORK_LOST_LINE,
        WORK_INCOME_LINES_BY_STEP,
        OBSERVER_CARD_ONE_LINERS,
        pickRandomLine,
        resolveWorkIncomeLine
    };
}));
