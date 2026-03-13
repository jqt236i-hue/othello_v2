/**
 * Shared Constants Module
 * Centralized definitions used across game-logic.js, card-system.js, 
 * cpu-policy.js, and scripts/train-mccfr.js
 * 
 * This module eliminates duplication of:
 * - Board state constants (BLACK, WHITE, EMPTY)
 * - Board navigation constants (DIRECTIONS)
 * - Card definitions (CARD_DEFS, CARD_TYPE_BY_ID)
 * 
 * Usage:
 *   Browser: Include via <script> before other game files
 *   Node.js: const SharedConstants = require('./shared-constants');
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SharedConstants = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    // ===== BOARD STATE CONSTANTS =====
    const BLACK = 1;
    const WHITE = -1;
    const EMPTY = 0;

    // ===== BOARD NAVIGATION =====
    const DIRECTIONS = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1], [0, 1],
        [1, -1], [1, 0], [1, 1]
    ];

    // ===== GAME CONSTANTS (canonicalized) =====
    // These constants are the single source of truth for core game parameters.
    const BOARD_SIZE = 8;
    const HAND_LIMIT = 5;
    const CHARGE_LIMIT = 3;
    const CHARGE_MAX = 99;
    const DRAW_PERIOD = 1; // number of cards drawn per draw action
    const INITIAL_BOARD_BONUS_DISTRIBUTION = [
        { value: 1, count: 9 },
        { value: 2, count: 8 },
        { value: 3, count: 6 },
        { value: 4, count: 5 },
        { value: 5, count: 4 },
        { value: 6, count: 3 },
        { value: 7, count: 2 },
        { value: 8, count: 1 },
        { value: 9, count: 1 },
        { value: 10, count: 1 }
    ];
    const DEFAULT_DECK = [
        // Minimal example deck structure; real deck is defined elsewhere (cards/catalog.json)
        { id: 'free_01', count: 1 },
        { id: 'hard_01', count: 1 },
        { id: 'swap_01', count: 1 }
    ];

    // ===== CARD DEFINITIONS =====
    // Primary source of truth: `cards/catalog.json` (and `cards/catalog.js` in browser).
    // Fallback: the inline CARD_DEFS below (kept for resilience).

    // Load catalog cards if available
    let catalogCards = null;
    try {
        // Browser path: loaded via <script src="cards/catalog.js">
        if (typeof window !== 'undefined' && window.CardCatalog && Array.isArray(window.CardCatalog.cards)) {
            catalogCards = window.CardCatalog.cards.map(c => ({
                id: c.id,
                name: c.name,
                type: c.type,
                cost: c.cost,
                desc: c.desc,
                enabled: c.enabled
            }));
        }
    } catch (e) {
        // ignore
    }
    try {
        // Node path: load JSON directly
        if (!catalogCards && typeof module === 'object' && module.exports) {
            // eslint-disable-next-line global-require
            const json = require('./cards/catalog.json');
            if (json && Array.isArray(json.cards)) {
                catalogCards = json.cards.map(c => ({
                    id: c.id,
                    name: c.name_ja,
                    type: c.type,
                    cost: c.cost,
                    desc: c.desc_ja,
                    enabled: c.enabled
                }));
            }
        }
    } catch (e) {
        // ignore
    }
    // 23-card deck: FREE_PLACEMENT(4), PROTECTED_NEXT_STONE(4), SWAP_WITH_ENEMY(4), 
    // PERMA_PROTECT_NEXT_STONE(4), DESTROY_ONE_STONE(4), TIME_BOMB(3)
    // 20-card deck (Rule 4.1)
    const CARD_DEFS_FALLBACK = [
        // TREASURE_BOX (宝箱) - 1 card, cost: 0
        { id: 'chest_01', name: '宝箱', type: 'TREASURE_BOX', cost: 0, desc: '使用時に布石を1〜3ランダムで獲得する。' },

        // FREE_PLACEMENT (自由の意志) - 1 card, cost: 16
        { id: 'free_01', name: '自由の意志', type: 'FREE_PLACEMENT', cost: 16, desc: '反転できなくても、空いているマスならどこにでも石を置ける' },

        // LAST_RESORT (最後の切り札) - 1 card, cost: 12
        { id: 'last_resort_01', name: '最後の切り札', type: 'LAST_RESORT', cost: 12, desc: '通常の合法手がない時だけ使用可能。空きマスに自由配置で2回置ける（固定2回）。' },

        // SNIPER_WILL (狙撃の意志) - 1 card, cost: 23
        { id: 'sniper_01', name: '狙撃の意志', type: 'SNIPER_WILL', cost: 23, desc: '次に置く石は空きマスならどこでも配置でき、狙撃石化。狙撃石は自ターン開始時に最も近い敵石を1つ破壊する（同距離はランダム）。5ターン持続。' },



        // PROTECTED_NEXT_STONE (弱い意志) - 1 card, cost: 1
        { id: 'hard_01', name: '弱い意志', type: 'PROTECTED_NEXT_STONE', cost: 1, desc: '次に置いた石は、次の相手ターンの間、反転されない' },

        // SWAP_WITH_ENEMY (交換の意志) - 1 card, cost: 17
        { id: 'swap_01', name: '交換の意志', type: 'SWAP_WITH_ENEMY', cost: 17, desc: '相手の通常石1つを自分色に交換し、その位置で挟める相手石を反転する。' },
        // POSITION_SWAP_WILL (入替の意志) - 1 card, cost: 13
        { id: 'position_swap_01', name: '入替の意志', type: 'POSITION_SWAP_WILL', cost: 13, desc: '盤面上の石2つを選び、位置を入れ替える。通常石・特殊石・爆弾を問わず対象にできる。' },

        // SACRIFICE_WILL (生贄の意志) - 1 card, cost: 5
        { id: 'sacrifice_01', name: '生贄の意志', type: 'SACRIFICE_WILL', cost: 5, desc: '盤面上の自分の石を最大3つまで選んで破壊し、1つにつき布石を5獲得する。' },

        // PERMA_PROTECT_NEXT_STONE (強い意志) - 1 card, cost: 15
        { id: 'perma_01', name: '強い意志', type: 'PERMA_PROTECT_NEXT_STONE', cost: 15, desc: '次に置いた石は、ずっと反転されない。' },
        // STRONG_WIND_WILL (強風の意志) - 1 card, cost: 9
        { id: 'strong_wind_01', name: '強風の意志', type: 'STRONG_WIND_WILL', cost: 9, desc: '盤面の石1つを選び、最も長く進める上下左右方向へ飛ばす（同距離はランダム）。' },
        // SUPER_BUOYANCY_WILL (超浮力) - 1 card, cost: 14
        { id: 'super_buoyancy_01', name: '超浮力', type: 'SUPER_BUOYANCY_WILL', cost: 14, desc: '盤面の石1つを選び、上方向へ限界まで移動させる。進行方向上の石は衝突時にすべて破壊して進む。' },
        // SUPER_GRAVITY_WILL (超重力) - 1 card, cost: 14
        { id: 'super_gravity_01', name: '超重力', type: 'SUPER_GRAVITY_WILL', cost: 14, desc: '盤面の石1つを選び、下方向へ限界まで移動させる。進行方向上の石は衝突時にすべて破壊して進む。' },

        { id: 'trap_01', name: '罠の意志', type: 'TRAP_WILL', cost: 4, desc: '自分の石を1つ罠石にする。次の相手ターン中に反転されると、相手の布石全没収＋手札全破壊。' },

        { id: 'chain_01', name: '連鎖の意志', type: 'CHAIN_WILL', cost: 22, desc: 'このターンの配置で発生した通常反転を起点に、追加反転を最大2回まで行う。' },

        { id: 'taboo_reverse_01', name: '禁忌の反転', type: 'TABOO_REVERSE_WILL', cost: 44, desc: '次に置く石は挟めなくても反転可能。最も反転枚数が多い列1方向のみ。' },

        { id: 'regen_01', name: '復活の意志', type: 'REGEN_WILL', cost: 12, desc: '次に置いた石は1回だけ再生し、反転されたら元の色に戻る。戻った結果、そのマスを起点に挟める列があれば成立する方向の石を反転する。' },

        // DESTROY_ONE_STONE (破壊神) - 1 card, cost: 19
        { id: 'destroy_01', name: '破壊神', type: 'DESTROY_ONE_STONE', cost: 19, desc: '盤上の石を1つ選び、破壊する。' },

        // TIME_BOMB (時限爆弾) - 1 card, cost: 13
        { id: 'bomb_01', name: '時限爆弾', type: 'TIME_BOMB', cost: 13, desc: '盤面上の自分の石1つを時限爆弾化。3ターン後に周囲9マスを破壊。反転されると解除。' },

        // ULTIMATE_REVERSE_DRAGON (究極反転龍) - 1 card, cost: 30
        { id: 'udr_01', name: '究極反転龍', type: 'ULTIMATE_REVERSE_DRAGON', cost: 30, desc: '次に置く石を龍化。配置ターン即時＋自ターン開始時、周囲8マスの相手石を自分色に反転（反転数はチャージ対象）。持続5ターン（配置ターン含め最大6回発動）で消滅。反転保護を持つ特殊石。' },

        // BREEDING_WILL (繁殖の意志) - 1 card, cost: 16
        { id: 'breeding_01', name: '繁殖の意志', type: 'BREEDING_WILL', cost: 16, desc: '次に置く石を繁殖石化。配置時と自ターン開始時に周囲8マスへランダム1個生成。以後は前回生成石の周囲へ拡散。生成石が反転/消滅した場合は親石起点に戻る。持続3ターン。' },
        { id: 'clone_01', name: '複製の意志', type: 'CLONE_WILL', cost: 16, desc: '盤面上の自分の石1つを選び、周囲8マスの空きからランダム1マスへ同じ石を複製する。生成では反転しない。特殊石は残り持続ターンなどを引き継ぐ。周囲に空きがない石は対象外。' },
        { id: 'split_01', name: '分裂の意志', type: 'SPLIT_WILL', cost: 12, desc: '盤面上の自分の石1つを選び、周囲8マスの空きからランダム1マスへ同じ石を分裂生成する。生成では反転しない。特殊石の残り持続ターンは元石・生成石とも半分になる。周囲に空きがない石は対象外。' },
        { id: 'teleport_01', name: 'テレポート', type: 'TELEPORT_WILL', cost: 10, desc: '盤面上の石1つを選び、ランダムな空きマスへテレポートさせる。対象は敵味方・通常石・特殊石を問わない。' },
        { id: 'cell_teleport_01', name: 'マステレポート', type: 'CELL_TELEPORT_WILL', cost: 23, desc: '盤面上の石があるマス1つを選び、盤面拡張・盤面拡張神で追加できる外側マスのどこかへランダムにテレポートさせる。移動元のマスは穴になる。対象は敵味方・通常石・特殊石を問わない。' },
        { id: 'cross_bomb_01', name: '十字爆弾', type: 'CROSS_BOMB', cost: 18, desc: '次に置く石を十字爆弾化。通常反転後に即起爆し、中心と縦横2マス（中心含む十字）の石を爆破する。' },
        { id: 'x_bomb_01', name: 'クロス爆弾', type: 'X_BOMB', cost: 18, desc: '次に置く石をクロス爆弾化。通常反転後に即起爆し、中心と斜め2マス（中心含むX字）の石を爆破する。' },

        // HYPERACTIVE_WILL (多動の意志) - 1 card, cost: 8
        { id: 'hyperactive_01', name: '多動の意志', type: 'HYPERACTIVE_WILL', cost: 8, desc: '次に置く石を多動石化。両者のターン開始時に、周囲8マスの空きへランダムに1マス移動し、移動後に挟める場合は通常反転。反転対象時は1回だけマス移動で回避する。' },

        // HYPERACTIVE_INHERIT_WILL (多動の継承) - 1 card, cost: 11
        { id: 'hyperactive_inherit_01', name: '多動の継承', type: 'HYPERACTIVE_INHERIT_WILL', cost: 11, desc: '盤面上の自分の石1つに多動状態を付与する。通常石・特殊石を問わず選択でき、他の状態とも併用可能。両者ターン開始時に1マス移動し、移動後に挟めば反転。反転対象時は1回だけマス移動で回避する。持続は10ターン（所有者ターン開始時のみ減算）。' },

        // EXTREME_HYPERACTIVE_WILL (極悪多動魔) - 1 card, cost: 35
        { id: 'extreme_hyperactive_01', name: '極悪多動魔', type: 'EXTREME_HYPERACTIVE_WILL', cost: 35, desc: '次に置く石を極悪多動魔化。ターン制限なしの多動状態となり、両者ターン開始時に周囲8マス（空き・占有）からランダム1マス移動。占有マスを選んだ場合はその石を1マス退避させてから進入する。移動後に挟めば反転し、隣接1マス（周囲8マス）の石を敵味方問わず遠ざかるように1マス退避させる。退避先が無い石はその場に残る。反転対象時は1回だけマス移動で回避する。' },

        // ESCAPE_WILL (逃げる意志) - 1 card, cost: 12
        { id: 'escape_01', name: '逃げる意志', type: 'ESCAPE_WILL', cost: 12, desc: '次に置く石を逃亡石化。両者ターン開始時に近くの石から逃げるように1マス移動し、移動先で挟める場合は反転。反転対象時は1回だけマス移動で回避し、移動先が無いと周囲8マスを爆破して消滅。' },

        // ROBOT_VACUUM_WILL (ロボット掃除機) - 1 card, cost: 17
        { id: 'robot_vacuum_01', name: 'ロボット掃除機', type: 'ROBOT_VACUUM_WILL', cost: 17, desc: '次に置く石をロボット掃除機化。両者ターン開始時に敵石へ近づくよう周囲空きへ1マス移動し、移動後に周囲8マスの敵石を吸い込んで破壊する。吸い込み1個につき布石+3。5ターン持続。守る意志の完全保護だけは吸い込めない。' },

        // GLUTTONOUS_WILL (悪食の意志) - 1 card, cost: 29
        { id: 'gluttonous_will_01', name: '悪食の意志', type: 'GLUTTONOUS_WILL', cost: 29, desc: '使用後、残り手札をすべて破壊し、次に置く石を悪食石化。両者ターン開始時に敵石方向へ1マス移動し、隣接敵石へは優先して進入しながら捕食する。隣接敵石が無い場合は近づくように移動し、2連続で捕食できなければ飢えて消滅する。反転保護を持つ特殊石。' },

        // INSTANT_HYPERACTIVE_WILL (瞬間多動) - 1 card, cost: 5
        { id: 'instant_hyperactive_01', name: '瞬間多動', type: 'INSTANT_HYPERACTIVE_WILL', cost: 5, desc: '次に置く石を瞬間多動石化。配置直後にランダム1マス移動を3回行い、各移動後に挟める場合は通常反転。最後に消滅する。' },

        // SELL_CARD_WILL (売却の意志) - 1 card, cost: 8
        { id: 'sell_01', name: '売却の意志', type: 'SELL_CARD_WILL', cost: 8, desc: 'カード使用後、自分の手札から1枚を売却し、そのカードのコスト分の布石を獲得する。' },

        // REBUILD_WILL (再構築の意志) - 1 card, cost: 0
        { id: 'rebuild_01', name: '再構築の意志', type: 'REBUILD_WILL', cost: 0, desc: '手札をすべて破壊し、新たに3枚ドローする。' },

        // SUPPLY_WILL (補給の意志) - 1 card, cost: 1
        { id: 'supply_01', name: '補給の意志', type: 'SUPPLY_WILL', cost: 1, desc: '山札から2枚ドローする。' },

        // PLUNDER_WILL (吸収の意志) - 1 card, cost: 4
        { id: 'plunder_will', name: '吸収の意志', type: 'PLUNDER_WILL', cost: 4, desc: '次の反転数だけ相手の布石を吸収する。' },

        { id: 'work_01', name: '出稼ぎの意志', type: 'WORK_WILL', cost: 11, desc: '次の配置をアンカーにして、その石がある限り自ターン開始時に1,2,4,8,16の順でチャージを得る（最大99）。石が相手に取られるか破壊されると効果は終了する。' },

        { id: 'ribo_01', name: 'リボ払いの意志', type: 'RIBO_WILL', cost: 0, desc: '18手経過後に使用可。布石を30得る。次の自ターン開始から9回、毎回4返済。足りない回は自石2個をランダム破壊。' },

        { id: 'loss_will_01', name: '意志の喪失', type: 'LOSS_WILL', cost: 11, desc: '盤面上の特殊石をすべて通常石に戻す。敵味方を問わず、色は変わらない。' },

        // DOUBLE_PLACE (二連投石) - 1 card, cost: 24
        { id: 'double_01', name: '二連投石', type: 'DOUBLE_PLACE', cost: 24, desc: 'このターン、石を2回置ける。' },
        // HEAVEN_BLESSING (天の恵み) - 1 card, cost: 3
        { id: 'heaven_01', name: '天の恵み', type: 'HEAVEN_BLESSING', cost: 3, desc: 'ランダムな候補5枚から1枚を選んで獲得する。' },
        // CONDEMN_WILL (断罪の意志) - 1 card, cost: 6
        { id: 'condemn_01', name: '断罪の意志', type: 'CONDEMN_WILL', cost: 6, desc: '相手手札を公開し、1枚選んで破壊する。' },

        // GOLD_STONE (金の意志) - 1 card, cost: 6
        { id: 'gold_stone', name: '金の意志', type: 'GOLD_STONE', cost: 6, desc: '次の反転で得る布石が4倍。使用後その石は消滅する。' },

        // STEAL_CARD (転売の意志) - 1 card, cost: 7
        { id: 'steal_card_01', name: '転売の意志', type: 'STEAL_CARD', cost: 7, desc: 'この手の反転枚数ぶん相手手札からカードを奪って売却する。売却したカード1枚につき布石を2獲得。' },

        // EXTEND_LIFE_WILL (延命の意志) - 1 card, cost: 2
        { id: 'extend_life_01', name: '延命の意志', type: 'EXTEND_LIFE_WILL', cost: 2, desc: '盤面上の自分の特殊石1つを選び、その持続ターン(remainingOwnerTurns)を2倍にする。' },

        // CORROSION_WILL (腐食の意志) - 1 card, cost: 2
        { id: 'corrosion_01', name: '腐食の意志', type: 'CORROSION_WILL', cost: 2, desc: '盤面上の特殊石1つを選び、その持続ターン(remainingOwnerTurns)を半減させる。対象がない場合は使用不可。' },

        // GUARD_WILL (守る意志) - 1 card, cost: 2
        { id: 'guard_01', name: '守る意志', type: 'GUARD_WILL', cost: 2, desc: '自分の石1つに完全保護を付与する。3ターン持続。' },

        // GUARDIAN_GOD (守護神) - 1 card, cost: 10
        { id: 'guardian_god_01', name: '守護神', type: 'GUARDIAN_GOD', cost: 10, desc: '自分の石1つに完全保護を付与する。10ターン持続。' },

        // DESTROY_DRAGON_WILL (破壊龍) - 1 card, cost: 15
        { id: 'destroy_dragon_01', name: '破壊龍', type: 'DESTROY_DRAGON_WILL', cost: 15, desc: '次に置く石を破壊龍化。配置時と自ターン開始時に周囲1マス（8方向）の敵石をランダム1個だけ破壊する。3ターン持続。反転保護を持つ特殊石。' },

        // LIGHTNING_WILL (落雷) - 1 card, cost: 26
        { id: 'lightning_01', name: '落雷', type: 'LIGHTNING_WILL', cost: 26, desc: '次に置く石を落雷石化。配置ターン即時と自ターン開始時に盤面上のランダムな敵石を1個破壊する。5ターン持続。反転保護を持つ特殊石。' },

        // ULTIMATE_DESTROY_GOD (究極破壊神) - 1 card, cost: 25
        { id: 'udg_01', name: '究極破壊神', type: 'ULTIMATE_DESTROY_GOD', cost: 25, desc: '次に置く石を究極破壊神化。配置ターン即時＋自ターン開始時、周囲8マスの敵石を破壊。持続5ターン（配置ターン含め最大6回）。' },

        // ULTIMATE_HYPERACTIVE_GOD (究極多動神) - 1 card, cost: 28
        { id: 'ultimate_hyperactive_01', name: '究極多動神', type: 'ULTIMATE_HYPERACTIVE_GOD', cost: 28, desc: '次に置く石を究極多動神化。両者ターン開始時に直線1〜5マス移動を2回行い、2マス以上は途中の石を飛び越える。移動後に挟めば反転。反転対象時はマス移動で回避し、最大5回まで。移動先が無いと消滅。特殊石として扱われ、10ターン後は自己消滅する。' },

        // BOARD_EXPANSION_WILL (盤面拡張) - 1 card, cost: 19
        { id: 'board_expand_01', name: '盤面拡張', type: 'BOARD_EXPANSION_WILL', cost: 19, desc: '盤面の左右どちらか外側に1マスを追加する。追加位置は左右端マスから選ぶ。1対局で1回のみ使用可能。' },

        // BOARD_EXPANSION_GOD (盤面拡張神) - 1 card, cost: 27
        { id: 'board_expand_god_01', name: '盤面拡張神', type: 'BOARD_EXPANSION_GOD', cost: 27, desc: '初期8x8の角マスを2つ選び、その外側6マス（各角3マスずつ、直交2方向+斜め）に拡張セルを同時追加する。' },

        // BLOCKADE_WILL (封鎖の意志) - 1 card, cost: 1
        { id: 'blockade_01', name: '封鎖の意志', type: 'BLOCKADE_WILL', cost: 1, desc: '盤面の空きマス1つを封鎖し、3ターンの間は両者とも配置・移動で入れない。' },

        // METEOR_WILL (隕石) - 1 card, cost: 21
        { id: 'meteor_01', name: '隕石', type: 'METEOR_WILL', cost: 21, desc: '盤面上のマスを1つ選び、石ごとマスを破壊して穴にする。穴は永続し、誰も配置できず反転経路も遮断する。守る意志・守護神の完全保護も貫通する。' },

        // OBSERVER_WILL (盤理の観測者) - 1 card, cost: 1
        { id: 'observer_01', name: '盤理の観測者', type: 'OBSERVER_WILL', cost: 1, desc: '次に置く石を観測者石化。所有者ターン開始時に30%で発動し、布石を1〜5獲得。5ターン持続。' }
    ];

    const CARD_DEFS = (catalogCards && catalogCards.length) ? catalogCards : CARD_DEFS_FALLBACK;

    // ===== DERIVED MAPPINGS =====
    const CARD_TYPE_BY_ID = CARD_DEFS.reduce((map, card) => {
        map[card.id] = card.type;
        return map;
    }, {});

    const CARD_TYPES = [
        'TREASURE_BOX',
        'FREE_PLACEMENT',
        'LAST_RESORT',
        'SNIPER_WILL',
        'PROTECTED_NEXT_STONE',
        'SWAP_WITH_ENEMY',
        'POSITION_SWAP_WILL',
        'SACRIFICE_WILL',
        'PERMA_PROTECT_NEXT_STONE',
        'STRONG_WIND_WILL',
        'SUPER_BUOYANCY_WILL',
        'SUPER_GRAVITY_WILL',
        'TRAP_WILL',
        'TEMPT_WILL',
        'CHAIN_WILL',
        'REGEN_WILL',
        'DESTROY_ONE_STONE',
        'TIME_BOMB',
        'ULTIMATE_REVERSE_DRAGON',
        'BREEDING_WILL',
        'CLONE_WILL',
        'SPLIT_WILL',
        'TELEPORT_WILL',
        'CELL_TELEPORT_WILL',
        'CROSS_BOMB',
        'X_BOMB',
        'DOUBLE_PLACE',
        'HEAVEN_BLESSING',
        'CONDEMN_WILL',
        'PLUNDER_WILL',
        'WORK_WILL',
        'RIBO_WILL',
        'LOSS_WILL',
        'GOLD_STONE',
        'SILVER_STONE',
        'STEAL_CARD',
        'EXTEND_LIFE_WILL',
        'CORROSION_WILL',
        'GUARD_WILL',
        'GUARDIAN_GOD',
        'DESTROY_DRAGON_WILL',
        'LIGHTNING_WILL',
        'ULTIMATE_DESTROY_GOD',
        'ULTIMATE_HYPERACTIVE_GOD',
        'BOARD_EXPANSION_WILL',
        'BOARD_EXPANSION_GOD',
        'BLOCKADE_WILL',
        'METEOR_WILL',
        'OBSERVER_WILL',
        'HYPERACTIVE_WILL',
        'HYPERACTIVE_INHERIT_WILL',
        'EXTREME_HYPERACTIVE_WILL',
        'ESCAPE_WILL',
        'ROBOT_VACUUM_WILL',
        'GLUTTONOUS_WILL',
        'INSTANT_HYPERACTIVE_WILL',
        'SELL_CARD_WILL',
        'REBUILD_WILL',
        'SUPPLY_WILL'
    ];

    // ===== DEBUG MODE =====
    // グローバルデバッグモード設定（初期値は false）
    const DEBUG_MODE = {
        TURBO_AI_BATTLE: false,    // レベル1同士の超高速対局（モーションなし）
        SKIP_ANIMATIONS: false      // アニメーションをスキップ
    };

    // TIME BOMB default turns
    const TIME_BOMB_TURNS = 3;

    // Destroy fade duration (ms)
    // Used by UI animation utilities to align JS waiting with CSS animation time
    const DESTROY_FADE_MS = 500;

    // ===== EXPORT =====
    const exports = {
        // Board constants
        BLACK,
        WHITE,
        EMPTY,
        DIRECTIONS,
        BOARD_SIZE,
        HAND_LIMIT,
        CHARGE_LIMIT,
        CHARGE_MAX,
        DRAW_PERIOD,
        INITIAL_BOARD_BONUS_DISTRIBUTION,
        DEFAULT_DECK,

        // Card definitions
        CARD_DEFS,
        CARD_TYPE_BY_ID,
        CARD_TYPES,

        // Card info
        MAX_SWAP_TARGETS: 6,
        MAX_DESTROY_TARGETS: 8,
        TIME_BOMB_TURNS: TIME_BOMB_TURNS,
        DESTROY_FADE_MS: DESTROY_FADE_MS,
    };

    // Also expose key constants directly on global scope for legacy compatibility
    if (typeof window !== 'undefined') {
        window.BLACK = BLACK;
        window.WHITE = WHITE;
        window.EMPTY = EMPTY;
        window.DIRECTIONS = DIRECTIONS;
        window.CARD_DEFS = CARD_DEFS;
        window.CARD_TYPE_BY_ID = CARD_TYPE_BY_ID;
        window.CARD_TYPES = CARD_TYPES;
        window.DEBUG_MODE = DEBUG_MODE;
        window.TIME_BOMB_TURNS = TIME_BOMB_TURNS;
        window.DESTROY_FADE_MS = DESTROY_FADE_MS;
        // Expose new canonical game constants for browser usage
        window.BOARD_SIZE = BOARD_SIZE;
        window.HAND_LIMIT = HAND_LIMIT;
        window.CHARGE_LIMIT = CHARGE_LIMIT;
        window.CHARGE_MAX = CHARGE_MAX;
        window.DRAW_PERIOD = DRAW_PERIOD;
        window.INITIAL_BOARD_BONUS_DISTRIBUTION = INITIAL_BOARD_BONUS_DISTRIBUTION;
        window.DEFAULT_DECK = DEFAULT_DECK;
    }

    return exports;
});

