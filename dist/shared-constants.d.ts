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
export declare const BLACK = 1;
export declare const WHITE = -1;
export declare const EMPTY = 0;
export declare const DIRECTIONS: readonly [readonly [-1, -1], readonly [-1, 0], readonly [-1, 1], readonly [0, -1], readonly [0, 1], readonly [1, -1], readonly [1, 0], readonly [1, 1]];
export declare const ORTHOGONAL_DIRECTIONS: readonly [readonly [-1, 0], readonly [1, 0], readonly [0, -1], readonly [0, 1]];
export declare const BOARD_SIZE = 8;
export declare const DEFAULT_BOARD_ROWS = 8;
export declare const DEFAULT_BOARD_COLS = 8;
export declare const MIN_BOARD_ROWS = 4;
export declare const MAX_BOARD_ROWS = 10;
export declare const MIN_BOARD_COLS = 4;
export declare const MAX_BOARD_COLS = 10;
export declare const HAND_LIMIT = 5;
export declare const CHARGE_LIMIT = 3;
export declare const CHARGE_MAX = 99;
export declare const DRAW_PERIOD = 1;
export declare const INITIAL_BOARD_BONUS_DISTRIBUTION: readonly [{
    readonly value: 1;
    readonly count: 9;
}, {
    readonly value: 2;
    readonly count: 8;
}, {
    readonly value: 3;
    readonly count: 6;
}, {
    readonly value: 4;
    readonly count: 5;
}, {
    readonly value: 5;
    readonly count: 4;
}, {
    readonly value: 6;
    readonly count: 3;
}, {
    readonly value: 7;
    readonly count: 2;
}, {
    readonly value: 8;
    readonly count: 1;
}, {
    readonly value: 9;
    readonly count: 1;
}, {
    readonly value: 10;
    readonly count: 1;
}];
export declare const DEFAULT_DECK: readonly [{
    readonly id: "free_01";
    readonly count: 1;
}, {
    readonly id: "hard_01";
    readonly count: 1;
}, {
    readonly id: "swap_01";
    readonly count: 1;
}];
export declare const CARD_DEFS: any[] | readonly [{
    readonly id: "chest_01";
    readonly name: "宝箱";
    readonly type: "TREASURE_BOX";
    readonly cost: 0;
    readonly desc: "使用時に布石を1〜3ランダムで獲得する。";
}, {
    readonly id: "free_01";
    readonly name: "自由の意志";
    readonly type: "FREE_PLACEMENT";
    readonly cost: 14;
    readonly desc: "反転できなくても、空いているマスならどこにでも石を置ける";
}, {
    readonly id: "last_resort_01";
    readonly name: "最後の切り札";
    readonly type: "LAST_RESORT";
    readonly cost: 9;
    readonly desc: "石数負けかつ合法手0の時に使用可能、空きマスに石を3個配置できる。";
}, {
    readonly id: "sniper_01";
    readonly name: "狙撃の意志";
    readonly type: "SNIPER_WILL";
    readonly cost: 23;
    readonly desc: "次に置く石は空きマスならどこでも配置でき、狙撃石化。狙撃石は自ターン開始時に最も近い敵石を1つ破壊する（同距離はランダム）。5ターン持続。";
}, {
    readonly id: "hard_01";
    readonly name: "弱い意志";
    readonly type: "PROTECTED_NEXT_STONE";
    readonly cost: 1;
    readonly desc: "次に置いた石は、次の相手ターンの間、反転されない";
}, {
    readonly id: "ghost_01";
    readonly name: "幽霊の意志";
    readonly type: "GHOST_WILL";
    readonly cost: 5;
    readonly desc: "次に置く石を幽体化する。5ターンの間、反転・破壊の対象にはなるがその石自身は受けない。交換の意志の対象外で、入替や他の効果は通常どおり受ける。";
}, {
    readonly id: "afterimage_will_01";
    readonly name: "残像の意志";
    readonly type: "AFTERIMAGE_WILL";
    readonly cost: 8;
    readonly desc: "次に置く石は反転または破壊されたとき3回まで復活する、復活後挟める列があれば反転させる。";
}, {
    readonly id: "swap_01";
    readonly name: "交換の意志";
    readonly type: "SWAP_WITH_ENEMY";
    readonly cost: 17;
    readonly desc: "相手通常石1つ選んで自分の通常石に交換する。(反転可能)";
}, {
    readonly id: "position_swap_01";
    readonly name: "入替の意志";
    readonly type: "POSITION_SWAP_WILL";
    readonly cost: 13;
    readonly desc: "盤面上の石2つを選び、位置を入れ替える。通常石・特殊石・爆弾を問わず対象にできる。";
}, {
    readonly id: "perma_01";
    readonly name: "強い意志";
    readonly type: "PERMA_PROTECT_NEXT_STONE";
    readonly cost: 15;
    readonly desc: "次に置いた石は、ずっと反転されない。所有者ターン開始10回で最強の意志に昇格し、絶対保護になる。";
}, {
    readonly id: "strong_wind_01";
    readonly name: "強風の意志";
    readonly type: "STRONG_WIND_WILL";
    readonly cost: 9;
    readonly desc: "盤面の石1つを選び、最も長く進める上下左右方向へ飛ばす（同距離はランダム）。";
}, {
    readonly id: "super_buoyancy_01";
    readonly name: "超浮力";
    readonly type: "SUPER_BUOYANCY_WILL";
    readonly cost: 16;
    readonly desc: "盤面の石1つを選び、上方向へ限界まで移動させる。進行方向上の石は衝突時にすべて破壊して進む。";
}, {
    readonly id: "super_gravity_01";
    readonly name: "超重力";
    readonly type: "SUPER_GRAVITY_WILL";
    readonly cost: 16;
    readonly desc: "盤面の石1つを選び、下方向へ限界まで移動させる。進行方向上の石は衝突時にすべて破壊して進む。";
}, {
    readonly id: "trap_01";
    readonly name: "罠の意志";
    readonly type: "TRAP_WILL";
    readonly cost: 4;
    readonly desc: "自分の石を1つ罠石にしてターン終了。次の相手ターン中に反転されると、相手の布石を最大20奪う＋手札全破壊。";
}, {
    readonly id: "tempt_01";
    readonly name: "誘惑の意志";
    readonly type: "TEMPT_WILL";
    readonly cost: 23;
    readonly desc: "相手の特殊石を1つ選んで自分の色に変える。";
}, {
    readonly id: "capture_01";
    readonly name: "捕獲の意志";
    readonly type: "CAPTURE_WILL";
    readonly cost: 20;
    readonly desc: "盤面上の敵の特殊石を1つ捕獲して自分の手札に加える。対象が無いと使えない。";
}, {
    readonly id: "double_chain_01";
    readonly name: "二連鎖の意志";
    readonly type: "DOUBLE_CHAIN_WILL";
    readonly cost: 22;
    readonly desc: "反転後新たに挟める列ができた場合、1列追加反転する。使用後、三連鎖の意志が手札に加わる。";
}, {
    readonly id: "triple_chain_01";
    readonly name: "三連鎖の意志";
    readonly type: "TRIPLE_CHAIN_WILL";
    readonly cost: 22;
    readonly desc: "反転後新たに挟める列ができた場合、2列追加反転する。使用後、四連鎖の意志が手札に加わる。";
    readonly enabled: false;
}, {
    readonly id: "quad_chain_01";
    readonly name: "四連鎖の意志";
    readonly type: "QUAD_CHAIN_WILL";
    readonly cost: 22;
    readonly desc: "反転後新たに挟める列ができた場合、3列追加反転する。使用後、無限連鎖の意志が手札に加わる。";
    readonly enabled: false;
}, {
    readonly id: "infinite_chain_01";
    readonly name: "無限連鎖の意志";
    readonly type: "INFINITE_CHAIN_WILL";
    readonly cost: 50;
    readonly desc: "反転後新たに挟める列ができた場合、可能な限り追加反転する。";
    readonly enabled: false;
}, {
    readonly id: "taboo_reverse_01";
    readonly name: "禁忌の反転";
    readonly type: "TABOO_REVERSE_WILL";
    readonly cost: 44;
    readonly desc: "次に置く石は挟めなくても反転可能。最も反転枚数が多い列1方向のみ。";
}, {
    readonly id: "regen_01";
    readonly name: "復活の意志";
    readonly type: "REGEN_WILL";
    readonly cost: 12;
    readonly desc: "次に置いた石は復活可能回数3を持つ。反転または破壊されるたびに1回消費して元の色へ戻り、そのマスを起点に挟める列があれば成立する方向の石を反転する。";
}, {
    readonly id: "destroy_01";
    readonly name: "破壊神";
    readonly type: "DESTROY_ONE_STONE";
    readonly cost: 19;
    readonly desc: "盤上の石を1つ選び、破壊する。";
}, {
    readonly id: "bomb_01";
    readonly name: "時限爆弾";
    readonly type: "TIME_BOMB";
    readonly cost: 13;
    readonly desc: "盤面上の自分の石1つを時限爆弾化。3ターン後に周囲9マスを破壊。反転されると解除。";
}, {
    readonly id: "time_stop_god_01";
    readonly name: "時間停石";
    readonly type: "TIME_STOP_GOD";
    readonly cost: 0;
    readonly desc: "手札に入った時点で即時破壊され、通常プレイでは使用しない。デバッグ等で手札に残った場合のみ、5ターン後時間停止を発動し2連続行動できる。";
}, {
    readonly id: "udr_01";
    readonly name: "究極反転龍";
    readonly type: "ULTIMATE_REVERSE_DRAGON";
    readonly cost: 30;
    readonly desc: "空きマス自由配置可。置いた石が龍化し、配置時に周囲1マスを反転。自ターン開始時はランダムな空きマスへ移動してから周囲1マスを反転（5ターン）。";
}, {
    readonly id: "breeding_01";
    readonly name: "繁殖の意志";
    readonly type: "BREEDING_WILL";
    readonly cost: 16;
    readonly desc: "次に置く石を繁殖化。配置時+自ターン開始時周囲に石を1個生成。(5ターン)";
}, {
    readonly id: "proliferation_01";
    readonly name: "増殖の意志";
    readonly type: "PROLIFERATION_WILL";
    readonly cost: 4;
    readonly desc: "次に置く石を増殖石化。破壊される時はその破壊を受けず、周囲8マスの空きへランダム1個増殖する。空きがなければ通常どおり破壊。各増殖石は所有者ターン10回持続し、期限切れでは消えずに通常石へ戻る。増殖で生まれた石も親の残りターンを引き継がず毎回10ターン。反転されると増殖状態を失って普通に反転する。";
}, {
    readonly id: "clone_01";
    readonly name: "複製の意志";
    readonly type: "CLONE_WILL";
    readonly cost: 16;
    readonly desc: "盤面上の自分の石1つを選び、周囲8マスの空きからランダム1マスへ同じ石を複製する。生成では反転しない。特殊石は残り持続ターンなどを引き継ぐ。周囲に空きがない石は対象外。";
}, {
    readonly id: "split_01";
    readonly name: "分裂の意志";
    readonly type: "SPLIT_WILL";
    readonly cost: 12;
    readonly desc: "盤面上の自分の石1つを選び、周囲8マスの空きからランダム1マスへ同じ石を分裂生成する。生成では反転しない。特殊石の残り持続ターンは元石・生成石とも半分になる。周囲に空きがない石は対象外。";
}, {
    readonly id: "teleport_01";
    readonly name: "テレポート";
    readonly type: "TELEPORT_WILL";
    readonly cost: 10;
    readonly desc: "盤面上の石1つを選び、ランダムな空きマスへテレポートさせる。対象は敵味方・通常石・特殊石を問わない。";
}, {
    readonly id: "cell_teleport_01";
    readonly name: "マステレポート";
    readonly type: "CELL_TELEPORT_WILL";
    readonly cost: 18;
    readonly desc: "マスを1つ選び、盤面外側へランダムテレポートさせ、元マスを穴化。";
}, {
    readonly id: "cross_bomb_01";
    readonly name: "十字爆弾";
    readonly type: "CROSS_BOMB";
    readonly cost: 18;
    readonly desc: "次に置く石を十字爆弾化。通常反転後に即起爆し、中心と縦横2マス（中心含む十字）の石を爆破する。";
}, {
    readonly id: "x_bomb_01";
    readonly name: "クロス爆弾";
    readonly type: "X_BOMB";
    readonly cost: 18;
    readonly desc: "次に置く石をクロス爆弾化。通常反転後に即起爆し、中心と斜め2マス（中心含むX字）の石を爆破する。";
}, {
    readonly id: "hyperactive_01";
    readonly name: "多動の意志";
    readonly type: "HYPERACTIVE_WILL";
    readonly cost: 8;
    readonly desc: "次に置く石を多動化。両者ターン開始時に1マス移動、反転回避を1回持つ。";
}, {
    readonly id: "hyperactive_inherit_01";
    readonly name: "多動の継承";
    readonly type: "HYPERACTIVE_INHERIT_WILL";
    readonly cost: 11;
    readonly desc: "盤面上の自分の石1つに多動状態を付与する。通常石・特殊石を問わず選択でき、他の状態とも併用可能。両者ターン開始時に1マス移動し、移動後に挟めば反転。反転対象時は1回だけマス移動で回避し、破壊対象時も1回だけ空きマスへ移動して回避する。持続は10ターン（所有者ターン開始時のみ減算）。";
}, {
    readonly id: "extreme_hyperactive_01";
    readonly name: "極悪多動魔";
    readonly type: "EXTREME_HYPERACTIVE_WILL";
    readonly cost: 35;
    readonly desc: "次に置く石を極悪多動魔化。ターン制限なしの多動状態となり、両者ターン開始時に周囲8マス（空き・占有）からランダム1マス移動。占有マスを選んだ場合はその石を1マス退避させてから進入し、退避先が無い場合はその石と位置交換して進入する。退避も位置交換もできる候補が無い場合は消滅する。移動後に挟めば反転し、隣接1マス（周囲8マス）の石を敵味方問わず遠ざかるように1マス退避させる。退避先が無い石はその場に残る。反転対象時はマス移動で回避し、最大3回まで。破壊対象時も1回だけ空きマスへ移動して回避する。";
}, {
    readonly id: "escape_01";
    readonly name: "逃げる意志";
    readonly type: "ESCAPE_WILL";
    readonly cost: 12;
    readonly desc: "次に置く石を逃亡石化。毎ターン1マス逃げるように移動し、移動できるマスがなくなると爆発。反転回避を1回持つ。";
}, {
    readonly id: "robot_vacuum_01";
    readonly name: "ロボット掃除機";
    readonly type: "ROBOT_VACUUM_WILL";
    readonly cost: 17;
    readonly desc: "次に置く石は毎ターン1マス移動し、周囲の敵石を1個吸い込む。吸い込むと持続ターンが1増える。";
}, {
    readonly id: "gluttonous_will_01";
    readonly name: "悪食の意志";
    readonly type: "GLUTTONOUS_WILL";
    readonly cost: 29;
    readonly desc: "使用後、残り手札をすべて破壊し、次に置く石を悪食石化。両者ターン開始時に敵石方向へ1マス移動し、隣接敵石へは優先して進入しながら捕食する。隣接敵石が無い場合は近づくように移動し、2連続で捕食できなければ飢えて消滅する。反転保護を持つ特殊石。";
}, {
    readonly id: "will_hunter_king_01";
    readonly name: "意志狩りの王";
    readonly type: "WILL_HUNTER_KING";
    readonly cost: 33;
    readonly desc: "次に置く石を意志狩り化。自ターン開始時、敵石を1つ破壊してそのマスへ移動する。敵の特殊石を優先して狙う。";
}, {
    readonly id: "instant_hyperactive_01";
    readonly name: "瞬間多動";
    readonly type: "INSTANT_HYPERACTIVE_WILL";
    readonly cost: 5;
    readonly desc: "次に置く石を瞬間多動石化。配置直後にランダム1マス移動を3回行い、各移動後に挟める場合は通常反転。最後に消滅する。";
}, {
    readonly id: "rebuild_01";
    readonly name: "再構築の意志";
    readonly type: "REBUILD_WILL";
    readonly cost: 0;
    readonly desc: "手札をすべて破壊し、新たに3枚ドローする。";
}, {
    readonly id: "supply_01";
    readonly name: "補給の意志";
    readonly type: "SUPPLY_WILL";
    readonly cost: 1;
    readonly desc: "山札から2枚ドローする。";
}, {
    readonly id: "plunder_will";
    readonly name: "吸収の意志";
    readonly type: "PLUNDER_WILL";
    readonly cost: 4;
    readonly desc: "次の反転数だけ相手の布石を吸収する。";
}, {
    readonly id: "corner_tribute_01";
    readonly name: "角の代償";
    readonly type: "CORNER_TRIBUTE";
    readonly cost: 0;
    readonly desc: "相手が角に4個以上石を置いている時だけ使用可能。相手の布石を最大20奪う。";
}, {
    readonly id: "work_01";
    readonly name: "出稼ぎの意志";
    readonly type: "WORK_WILL";
    readonly cost: 11;
    readonly desc: "次の配置をアンカーにして、その石がある限り自ターン開始時に1,2,4,8,16の順でチャージを得る（最大99）。石が相手に取られるか破壊されると効果は終了する。";
}, {
    readonly id: "ribo_01";
    readonly name: "リボ払いの意志";
    readonly type: "RIBO_WILL";
    readonly cost: 0;
    readonly desc: "布石を30得る。その後9ターンの間4返済。足りない場合は自石2個を消滅させる。";
}, {
    readonly id: "loss_will_01";
    readonly name: "意志の喪失";
    readonly type: "LOSS_WILL";
    readonly cost: 15;
    readonly desc: "盤面上の特殊石をすべて通常石に戻す。敵味方を問わず、色は変わらない。";
}, {
    readonly id: "double_01";
    readonly name: "二連投石";
    readonly type: "DOUBLE_PLACE";
    readonly cost: 24;
    readonly desc: "このターン、石を2回置ける。使用後、三連投石が手札に加わる。";
}, {
    readonly id: "triple_01";
    readonly name: "三連投石";
    readonly type: "TRIPLE_PLACE";
    readonly cost: 24;
    readonly desc: "生成専用。 このターン、石を3回置ける。使用後、四連投石が手札に加わる。";
    readonly enabled: false;
}, {
    readonly id: "quad_01";
    readonly name: "四連投石";
    readonly type: "QUAD_PLACE";
    readonly cost: 24;
    readonly desc: "生成専用。 このターン、石を4回置ける。使用後、無限投石が手札に加わる。";
    readonly enabled: false;
}, {
    readonly id: "infinite_01";
    readonly name: "無限投石";
    readonly type: "INFINITE_PLACE";
    readonly cost: 50;
    readonly desc: "生成専用。合法手が尽きるまで同じ手番で置き続け、置けなくなった時点で終了する。";
    readonly enabled: false;
}, {
    readonly id: "heaven_01";
    readonly name: "天の恵み";
    readonly type: "HEAVEN_BLESSING";
    readonly cost: 3;
    readonly desc: "ランダムな候補5枚から1枚を選んで獲得する。";
}, {
    readonly id: "reveal_hand_01";
    readonly name: "観測の意志";
    readonly type: "REVEAL_HAND_WILL";
    readonly cost: 2;
    readonly desc: "現在の相手手札をすべて表にする。使用後に相手が引いたカードは表にならない。";
}, {
    readonly id: "condemn_01";
    readonly name: "断罪の意志";
    readonly type: "CONDEMN_WILL";
    readonly cost: 8;
    readonly desc: "相手手札を公開し、1枚選んで破壊する。";
}, {
    readonly id: "gold_stone";
    readonly name: "金の意志";
    readonly type: "GOLD_STONE";
    readonly cost: 6;
    readonly desc: "次の反転で得る布石が4倍。使用後その石は消滅する。";
}, {
    readonly id: "rainbow_stone";
    readonly name: "虹の意志";
    readonly type: "RAINBOW_STONE";
    readonly cost: 10;
    readonly desc: "次の反転で得る布石が6倍。使用後その石は消滅する。";
}, {
    readonly id: "silver_stone";
    readonly name: "銀の意志";
    readonly type: "SILVER_STONE";
    readonly cost: 3;
    readonly desc: "次の反転で得る布石が3倍。使用後その石は消滅する。";
}, {
    readonly id: "crystal_stone";
    readonly name: "水晶の意志";
    readonly type: "CRYSTAL_STONE";
    readonly cost: 8;
    readonly desc: "次に得る数字マスの布石が4倍。使用後その石は消滅する。";
}, {
    readonly id: "extend_life_01";
    readonly name: "延命の意志";
    readonly type: "EXTEND_LIFE_WILL";
    readonly cost: 4;
    readonly desc: "盤面上の自分の特殊石1つを選び、その持続ターン(remainingOwnerTurns)を2倍にする。";
}, {
    readonly id: "extend_life_god_01";
    readonly name: "延命神";
    readonly type: "EXTEND_LIFE_GOD";
    readonly cost: 10;
    readonly desc: "盤面上の自分の特殊石1つを選び、その持続ターン(remainingOwnerTurns)を4倍にする。";
}, {
    readonly id: "corrosion_01";
    readonly name: "腐食の意志";
    readonly type: "CORROSION_WILL";
    readonly cost: 2;
    readonly desc: "盤面上の特殊石1つを選び、その持続ターン(remainingOwnerTurns)を半減させる。対象がない場合は使用不可。";
}, {
    readonly id: "guard_01";
    readonly name: "守る意志";
    readonly type: "GUARD_WILL";
    readonly cost: 2;
    readonly desc: "自分の石1つに完全保護を付与する。3ターン持続。";
}, {
    readonly id: "guardian_god_01";
    readonly name: "守護神";
    readonly type: "GUARDIAN_GOD";
    readonly cost: 10;
    readonly desc: "自分の石1つに完全保護を付与する。10ターン持続。";
}, {
    readonly id: "destroy_dragon_01";
    readonly name: "破壊龍";
    readonly type: "DESTROY_DRAGON_WILL";
    readonly cost: 7;
    readonly desc: "次に置く石を破壊龍化。配置時と自ターン開始時に周囲1マス（8方向）の敵石をランダム1個だけ破壊する。3ターン持続。反転保護を持つ特殊石。";
}, {
    readonly id: "lightning_01";
    readonly name: "落雷";
    readonly type: "LIGHTNING_WILL";
    readonly cost: 26;
    readonly desc: "次に置く石を落雷石化。配置ターン即時と自ターン開始時に盤面上のランダムな敵石を1個破壊する。5ターン持続。反転保護を持つ特殊石。";
}, {
    readonly id: "udg_01";
    readonly name: "究極破壊神";
    readonly type: "ULTIMATE_DESTROY_GOD";
    readonly cost: 25;
    readonly desc: "反転0でも空きマスに配置可能。次に置く石を究極破壊神化。置いた時に周囲1マス（8方向）の敵石を破壊。自ターン開始時はランダムな空きマスへ移動してから周囲1マス（8方向）の敵石を破壊し、移動先が無いときはその場で破壊する。5ターン持続。";
}, {
    readonly id: "ultimate_hyperactive_01";
    readonly name: "究極多動神";
    readonly type: "ULTIMATE_HYPERACTIVE_GOD";
    readonly cost: 28;
    readonly desc: "次に置く石を究極多動神化。両者ターン開始時に直線1〜5マス移動を2回行い、2マス以上は途中の石を飛び越える。移動後に挟めば反転。反転対象時はマス移動で回避し、最大3回まで。破壊対象時も1回だけマス移動で回避する。移動先が無いと消滅。特殊石として扱われ、10ターン後は同色の通常石に戻る。";
}, {
    readonly id: "board_expand_01";
    readonly name: "盤面拡張";
    readonly type: "BOARD_EXPANSION_WILL";
    readonly cost: 19;
    readonly desc: "盤面の左右どちらか外側に1マスを追加する。追加位置は左右端マスから選ぶ。1対局で1回のみ使用可能。";
}, {
    readonly id: "board_expand_god_01";
    readonly name: "盤面拡張神";
    readonly type: "BOARD_EXPANSION_GOD";
    readonly cost: 27;
    readonly desc: "初期8x8の角マスから拡張可能な角を最大2つ選び、その外側3〜6マス（各角3マスずつ、直交2方向+斜め）に拡張セルを追加する。";
}, {
    readonly id: "blockade_01";
    readonly name: "封鎖の意志";
    readonly type: "BLOCKADE_WILL";
    readonly cost: 1;
    readonly desc: "盤面の空きマス1つを封鎖し、3ターンの間は両者とも配置・移動で入れない。";
}, {
    readonly id: "meteor_01";
    readonly name: "隕石";
    readonly type: "METEOR_WILL";
    readonly cost: 21;
    readonly desc: "盤面上のマスを1つ選び、石ごとマスを破壊して穴にする。穴は永続し、誰も配置できず反転経路も遮断する。守る意志・守護神の完全保護も貫通する。";
}, {
    readonly id: "freeze_01";
    readonly name: "凍結の意志";
    readonly type: "FREEZE_WILL";
    readonly cost: 5;
    readonly desc: "盤面上のマスを1つ選び、5ターン凍結する。凍結マスとその石は反転・破壊されず、凍結中は特殊石の持続ターンが減らない。";
}, {
    readonly id: "observer_01";
    readonly name: "盤理の観測者";
    readonly type: "OBSERVER_WILL";
    readonly cost: 1;
    readonly desc: "次に置く石を観測者石化。所有者ターン開始時に30%で発動し、布石を1〜5獲得。5ターン持続。";
}, {
    readonly id: "salvation_01";
    readonly name: "救済の意志";
    readonly type: "SALVATION_WILL";
    readonly cost: 17;
    readonly desc: "直前の相手ターンで破壊された全ての石を救済し、自分の通常石として空きマスにランダム配置。";
}, {
    readonly id: "reinforcement_01";
    readonly name: "増援の意志";
    readonly type: "REINFORCEMENT_WILL";
    readonly cost: 6;
    readonly desc: "石に隣接する内側空きマスへランダム1マス通常石を配置する。(反転可能)";
}, {
    readonly id: "equality_will_01";
    readonly name: "平等の意志";
    readonly type: "EQUALITY_WILL";
    readonly cost: 15;
    readonly desc: "空きマスに3個石をランダム配置、石数が10個以上負けているときに使用可能。";
}];
export declare const CARD_TYPE_BY_ID: Record<string, string>;
export declare const CARD_TYPES: readonly ["TREASURE_BOX", "FREE_PLACEMENT", "LAST_RESORT", "SNIPER_WILL", "PROTECTED_NEXT_STONE", "GHOST_WILL", "AFTERIMAGE_WILL", "SWAP_WITH_ENEMY", "POSITION_SWAP_WILL", "PERMA_PROTECT_NEXT_STONE", "STRONG_WIND_WILL", "SUPER_BUOYANCY_WILL", "SUPER_GRAVITY_WILL", "TRAP_WILL", "TEMPT_WILL", "CAPTURE_WILL", "DOUBLE_CHAIN_WILL", "TRIPLE_CHAIN_WILL", "QUAD_CHAIN_WILL", "INFINITE_CHAIN_WILL", "REGEN_WILL", "DESTROY_ONE_STONE", "TIME_BOMB", "TIME_STOP_GOD", "ULTIMATE_REVERSE_DRAGON", "BREEDING_WILL", "PROLIFERATION_WILL", "CLONE_WILL", "SPLIT_WILL", "SEED_WILL", "TELEPORT_WILL", "CELL_TELEPORT_WILL", "CROSS_BOMB", "X_BOMB", "DOUBLE_PLACE", "TRIPLE_PLACE", "QUAD_PLACE", "INFINITE_PLACE", "HEAVEN_BLESSING", "REVEAL_HAND_WILL", "CONDEMN_WILL", "PLUNDER_WILL", "CORNER_TRIBUTE", "WORK_WILL", "RIBO_WILL", "LOSS_WILL", "GOLD_STONE", "RAINBOW_STONE", "SILVER_STONE", "CRYSTAL_STONE", "EXTEND_LIFE_WILL", "EXTEND_LIFE_GOD", "CORROSION_WILL", "GUARD_WILL", "GUARDIAN_GOD", "DESTROY_DRAGON_WILL", "LIGHTNING_WILL", "ULTIMATE_DESTROY_GOD", "ULTIMATE_HYPERACTIVE_GOD", "BOARD_EXPANSION_WILL", "BOARD_EXPANSION_GOD", "BLOCKADE_WILL", "METEOR_WILL", "FREEZE_WILL", "OBSERVER_WILL", "HYPERACTIVE_WILL", "HYPERACTIVE_INHERIT_WILL", "EXTREME_HYPERACTIVE_WILL", "ESCAPE_WILL", "ROBOT_VACUUM_WILL", "GLUTTONOUS_WILL", "WILL_HUNTER_KING", "INSTANT_HYPERACTIVE_WILL", "REBUILD_WILL", "SUPPLY_WILL", "REINFORCEMENT_WILL", "EQUALITY_WILL", "SALVATION_WILL"];
export declare const DEBUG_MODE: {
    TURBO_AI_BATTLE: boolean;
    SKIP_ANIMATIONS: boolean;
};
export declare const TIME_BOMB_TURNS = 3;
export declare const TIME_STOP_GOD_TURNS = 5;
export declare const TIME_STOP_GOD_CONSECUTIVE_TURNS = 2;
export declare const TIME_STOP_GOD_SELF_DESTROY_COUNT = 3;
export declare const STRONG_WILL_PROMOTION_OWNER_TURNS = 10;
export declare const DESTROY_FADE_MS = 500;
export declare const MAX_SWAP_TARGETS = 6;
export declare const MAX_DESTROY_TARGETS = 8;
declare const _default: {
    BLACK: number;
    WHITE: number;
    EMPTY: number;
    DIRECTIONS: readonly [readonly [-1, -1], readonly [-1, 0], readonly [-1, 1], readonly [0, -1], readonly [0, 1], readonly [1, -1], readonly [1, 0], readonly [1, 1]];
    ORTHOGONAL_DIRECTIONS: readonly [readonly [-1, 0], readonly [1, 0], readonly [0, -1], readonly [0, 1]];
    BOARD_SIZE: number;
    DEFAULT_BOARD_ROWS: number;
    DEFAULT_BOARD_COLS: number;
    MIN_BOARD_ROWS: number;
    MAX_BOARD_ROWS: number;
    MIN_BOARD_COLS: number;
    MAX_BOARD_COLS: number;
    HAND_LIMIT: number;
    CHARGE_LIMIT: number;
    CHARGE_MAX: number;
    DRAW_PERIOD: number;
    INITIAL_BOARD_BONUS_DISTRIBUTION: readonly [{
        readonly value: 1;
        readonly count: 9;
    }, {
        readonly value: 2;
        readonly count: 8;
    }, {
        readonly value: 3;
        readonly count: 6;
    }, {
        readonly value: 4;
        readonly count: 5;
    }, {
        readonly value: 5;
        readonly count: 4;
    }, {
        readonly value: 6;
        readonly count: 3;
    }, {
        readonly value: 7;
        readonly count: 2;
    }, {
        readonly value: 8;
        readonly count: 1;
    }, {
        readonly value: 9;
        readonly count: 1;
    }, {
        readonly value: 10;
        readonly count: 1;
    }];
    DEFAULT_DECK: readonly [{
        readonly id: "free_01";
        readonly count: 1;
    }, {
        readonly id: "hard_01";
        readonly count: 1;
    }, {
        readonly id: "swap_01";
        readonly count: 1;
    }];
    CARD_DEFS: any[] | readonly [{
        readonly id: "chest_01";
        readonly name: "宝箱";
        readonly type: "TREASURE_BOX";
        readonly cost: 0;
        readonly desc: "使用時に布石を1〜3ランダムで獲得する。";
    }, {
        readonly id: "free_01";
        readonly name: "自由の意志";
        readonly type: "FREE_PLACEMENT";
        readonly cost: 14;
        readonly desc: "反転できなくても、空いているマスならどこにでも石を置ける";
    }, {
        readonly id: "last_resort_01";
        readonly name: "最後の切り札";
        readonly type: "LAST_RESORT";
        readonly cost: 9;
        readonly desc: "石数負けかつ合法手0の時に使用可能、空きマスに石を3個配置できる。";
    }, {
        readonly id: "sniper_01";
        readonly name: "狙撃の意志";
        readonly type: "SNIPER_WILL";
        readonly cost: 23;
        readonly desc: "次に置く石は空きマスならどこでも配置でき、狙撃石化。狙撃石は自ターン開始時に最も近い敵石を1つ破壊する（同距離はランダム）。5ターン持続。";
    }, {
        readonly id: "hard_01";
        readonly name: "弱い意志";
        readonly type: "PROTECTED_NEXT_STONE";
        readonly cost: 1;
        readonly desc: "次に置いた石は、次の相手ターンの間、反転されない";
    }, {
        readonly id: "ghost_01";
        readonly name: "幽霊の意志";
        readonly type: "GHOST_WILL";
        readonly cost: 5;
        readonly desc: "次に置く石を幽体化する。5ターンの間、反転・破壊の対象にはなるがその石自身は受けない。交換の意志の対象外で、入替や他の効果は通常どおり受ける。";
    }, {
        readonly id: "afterimage_will_01";
        readonly name: "残像の意志";
        readonly type: "AFTERIMAGE_WILL";
        readonly cost: 8;
        readonly desc: "次に置く石は反転または破壊されたとき3回まで復活する、復活後挟める列があれば反転させる。";
    }, {
        readonly id: "swap_01";
        readonly name: "交換の意志";
        readonly type: "SWAP_WITH_ENEMY";
        readonly cost: 17;
        readonly desc: "相手通常石1つ選んで自分の通常石に交換する。(反転可能)";
    }, {
        readonly id: "position_swap_01";
        readonly name: "入替の意志";
        readonly type: "POSITION_SWAP_WILL";
        readonly cost: 13;
        readonly desc: "盤面上の石2つを選び、位置を入れ替える。通常石・特殊石・爆弾を問わず対象にできる。";
    }, {
        readonly id: "perma_01";
        readonly name: "強い意志";
        readonly type: "PERMA_PROTECT_NEXT_STONE";
        readonly cost: 15;
        readonly desc: "次に置いた石は、ずっと反転されない。所有者ターン開始10回で最強の意志に昇格し、絶対保護になる。";
    }, {
        readonly id: "strong_wind_01";
        readonly name: "強風の意志";
        readonly type: "STRONG_WIND_WILL";
        readonly cost: 9;
        readonly desc: "盤面の石1つを選び、最も長く進める上下左右方向へ飛ばす（同距離はランダム）。";
    }, {
        readonly id: "super_buoyancy_01";
        readonly name: "超浮力";
        readonly type: "SUPER_BUOYANCY_WILL";
        readonly cost: 16;
        readonly desc: "盤面の石1つを選び、上方向へ限界まで移動させる。進行方向上の石は衝突時にすべて破壊して進む。";
    }, {
        readonly id: "super_gravity_01";
        readonly name: "超重力";
        readonly type: "SUPER_GRAVITY_WILL";
        readonly cost: 16;
        readonly desc: "盤面の石1つを選び、下方向へ限界まで移動させる。進行方向上の石は衝突時にすべて破壊して進む。";
    }, {
        readonly id: "trap_01";
        readonly name: "罠の意志";
        readonly type: "TRAP_WILL";
        readonly cost: 4;
        readonly desc: "自分の石を1つ罠石にしてターン終了。次の相手ターン中に反転されると、相手の布石を最大20奪う＋手札全破壊。";
    }, {
        readonly id: "tempt_01";
        readonly name: "誘惑の意志";
        readonly type: "TEMPT_WILL";
        readonly cost: 23;
        readonly desc: "相手の特殊石を1つ選んで自分の色に変える。";
    }, {
        readonly id: "capture_01";
        readonly name: "捕獲の意志";
        readonly type: "CAPTURE_WILL";
        readonly cost: 20;
        readonly desc: "盤面上の敵の特殊石を1つ捕獲して自分の手札に加える。対象が無いと使えない。";
    }, {
        readonly id: "double_chain_01";
        readonly name: "二連鎖の意志";
        readonly type: "DOUBLE_CHAIN_WILL";
        readonly cost: 22;
        readonly desc: "反転後新たに挟める列ができた場合、1列追加反転する。使用後、三連鎖の意志が手札に加わる。";
    }, {
        readonly id: "triple_chain_01";
        readonly name: "三連鎖の意志";
        readonly type: "TRIPLE_CHAIN_WILL";
        readonly cost: 22;
        readonly desc: "反転後新たに挟める列ができた場合、2列追加反転する。使用後、四連鎖の意志が手札に加わる。";
        readonly enabled: false;
    }, {
        readonly id: "quad_chain_01";
        readonly name: "四連鎖の意志";
        readonly type: "QUAD_CHAIN_WILL";
        readonly cost: 22;
        readonly desc: "反転後新たに挟める列ができた場合、3列追加反転する。使用後、無限連鎖の意志が手札に加わる。";
        readonly enabled: false;
    }, {
        readonly id: "infinite_chain_01";
        readonly name: "無限連鎖の意志";
        readonly type: "INFINITE_CHAIN_WILL";
        readonly cost: 50;
        readonly desc: "反転後新たに挟める列ができた場合、可能な限り追加反転する。";
        readonly enabled: false;
    }, {
        readonly id: "taboo_reverse_01";
        readonly name: "禁忌の反転";
        readonly type: "TABOO_REVERSE_WILL";
        readonly cost: 44;
        readonly desc: "次に置く石は挟めなくても反転可能。最も反転枚数が多い列1方向のみ。";
    }, {
        readonly id: "regen_01";
        readonly name: "復活の意志";
        readonly type: "REGEN_WILL";
        readonly cost: 12;
        readonly desc: "次に置いた石は復活可能回数3を持つ。反転または破壊されるたびに1回消費して元の色へ戻り、そのマスを起点に挟める列があれば成立する方向の石を反転する。";
    }, {
        readonly id: "destroy_01";
        readonly name: "破壊神";
        readonly type: "DESTROY_ONE_STONE";
        readonly cost: 19;
        readonly desc: "盤上の石を1つ選び、破壊する。";
    }, {
        readonly id: "bomb_01";
        readonly name: "時限爆弾";
        readonly type: "TIME_BOMB";
        readonly cost: 13;
        readonly desc: "盤面上の自分の石1つを時限爆弾化。3ターン後に周囲9マスを破壊。反転されると解除。";
    }, {
        readonly id: "time_stop_god_01";
        readonly name: "時間停石";
        readonly type: "TIME_STOP_GOD";
        readonly cost: 0;
        readonly desc: "手札に入った時点で即時破壊され、通常プレイでは使用しない。デバッグ等で手札に残った場合のみ、5ターン後時間停止を発動し2連続行動できる。";
    }, {
        readonly id: "udr_01";
        readonly name: "究極反転龍";
        readonly type: "ULTIMATE_REVERSE_DRAGON";
        readonly cost: 30;
        readonly desc: "空きマス自由配置可。置いた石が龍化し、配置時に周囲1マスを反転。自ターン開始時はランダムな空きマスへ移動してから周囲1マスを反転（5ターン）。";
    }, {
        readonly id: "breeding_01";
        readonly name: "繁殖の意志";
        readonly type: "BREEDING_WILL";
        readonly cost: 16;
        readonly desc: "次に置く石を繁殖化。配置時+自ターン開始時周囲に石を1個生成。(5ターン)";
    }, {
        readonly id: "proliferation_01";
        readonly name: "増殖の意志";
        readonly type: "PROLIFERATION_WILL";
        readonly cost: 4;
        readonly desc: "次に置く石を増殖石化。破壊される時はその破壊を受けず、周囲8マスの空きへランダム1個増殖する。空きがなければ通常どおり破壊。各増殖石は所有者ターン10回持続し、期限切れでは消えずに通常石へ戻る。増殖で生まれた石も親の残りターンを引き継がず毎回10ターン。反転されると増殖状態を失って普通に反転する。";
    }, {
        readonly id: "clone_01";
        readonly name: "複製の意志";
        readonly type: "CLONE_WILL";
        readonly cost: 16;
        readonly desc: "盤面上の自分の石1つを選び、周囲8マスの空きからランダム1マスへ同じ石を複製する。生成では反転しない。特殊石は残り持続ターンなどを引き継ぐ。周囲に空きがない石は対象外。";
    }, {
        readonly id: "split_01";
        readonly name: "分裂の意志";
        readonly type: "SPLIT_WILL";
        readonly cost: 12;
        readonly desc: "盤面上の自分の石1つを選び、周囲8マスの空きからランダム1マスへ同じ石を分裂生成する。生成では反転しない。特殊石の残り持続ターンは元石・生成石とも半分になる。周囲に空きがない石は対象外。";
    }, {
        readonly id: "teleport_01";
        readonly name: "テレポート";
        readonly type: "TELEPORT_WILL";
        readonly cost: 10;
        readonly desc: "盤面上の石1つを選び、ランダムな空きマスへテレポートさせる。対象は敵味方・通常石・特殊石を問わない。";
    }, {
        readonly id: "cell_teleport_01";
        readonly name: "マステレポート";
        readonly type: "CELL_TELEPORT_WILL";
        readonly cost: 18;
        readonly desc: "マスを1つ選び、盤面外側へランダムテレポートさせ、元マスを穴化。";
    }, {
        readonly id: "cross_bomb_01";
        readonly name: "十字爆弾";
        readonly type: "CROSS_BOMB";
        readonly cost: 18;
        readonly desc: "次に置く石を十字爆弾化。通常反転後に即起爆し、中心と縦横2マス（中心含む十字）の石を爆破する。";
    }, {
        readonly id: "x_bomb_01";
        readonly name: "クロス爆弾";
        readonly type: "X_BOMB";
        readonly cost: 18;
        readonly desc: "次に置く石をクロス爆弾化。通常反転後に即起爆し、中心と斜め2マス（中心含むX字）の石を爆破する。";
    }, {
        readonly id: "hyperactive_01";
        readonly name: "多動の意志";
        readonly type: "HYPERACTIVE_WILL";
        readonly cost: 8;
        readonly desc: "次に置く石を多動化。両者ターン開始時に1マス移動、反転回避を1回持つ。";
    }, {
        readonly id: "hyperactive_inherit_01";
        readonly name: "多動の継承";
        readonly type: "HYPERACTIVE_INHERIT_WILL";
        readonly cost: 11;
        readonly desc: "盤面上の自分の石1つに多動状態を付与する。通常石・特殊石を問わず選択でき、他の状態とも併用可能。両者ターン開始時に1マス移動し、移動後に挟めば反転。反転対象時は1回だけマス移動で回避し、破壊対象時も1回だけ空きマスへ移動して回避する。持続は10ターン（所有者ターン開始時のみ減算）。";
    }, {
        readonly id: "extreme_hyperactive_01";
        readonly name: "極悪多動魔";
        readonly type: "EXTREME_HYPERACTIVE_WILL";
        readonly cost: 35;
        readonly desc: "次に置く石を極悪多動魔化。ターン制限なしの多動状態となり、両者ターン開始時に周囲8マス（空き・占有）からランダム1マス移動。占有マスを選んだ場合はその石を1マス退避させてから進入し、退避先が無い場合はその石と位置交換して進入する。退避も位置交換もできる候補が無い場合は消滅する。移動後に挟めば反転し、隣接1マス（周囲8マス）の石を敵味方問わず遠ざかるように1マス退避させる。退避先が無い石はその場に残る。反転対象時はマス移動で回避し、最大3回まで。破壊対象時も1回だけ空きマスへ移動して回避する。";
    }, {
        readonly id: "escape_01";
        readonly name: "逃げる意志";
        readonly type: "ESCAPE_WILL";
        readonly cost: 12;
        readonly desc: "次に置く石を逃亡石化。毎ターン1マス逃げるように移動し、移動できるマスがなくなると爆発。反転回避を1回持つ。";
    }, {
        readonly id: "robot_vacuum_01";
        readonly name: "ロボット掃除機";
        readonly type: "ROBOT_VACUUM_WILL";
        readonly cost: 17;
        readonly desc: "次に置く石は毎ターン1マス移動し、周囲の敵石を1個吸い込む。吸い込むと持続ターンが1増える。";
    }, {
        readonly id: "gluttonous_will_01";
        readonly name: "悪食の意志";
        readonly type: "GLUTTONOUS_WILL";
        readonly cost: 29;
        readonly desc: "使用後、残り手札をすべて破壊し、次に置く石を悪食石化。両者ターン開始時に敵石方向へ1マス移動し、隣接敵石へは優先して進入しながら捕食する。隣接敵石が無い場合は近づくように移動し、2連続で捕食できなければ飢えて消滅する。反転保護を持つ特殊石。";
    }, {
        readonly id: "will_hunter_king_01";
        readonly name: "意志狩りの王";
        readonly type: "WILL_HUNTER_KING";
        readonly cost: 33;
        readonly desc: "次に置く石を意志狩り化。自ターン開始時、敵石を1つ破壊してそのマスへ移動する。敵の特殊石を優先して狙う。";
    }, {
        readonly id: "instant_hyperactive_01";
        readonly name: "瞬間多動";
        readonly type: "INSTANT_HYPERACTIVE_WILL";
        readonly cost: 5;
        readonly desc: "次に置く石を瞬間多動石化。配置直後にランダム1マス移動を3回行い、各移動後に挟める場合は通常反転。最後に消滅する。";
    }, {
        readonly id: "rebuild_01";
        readonly name: "再構築の意志";
        readonly type: "REBUILD_WILL";
        readonly cost: 0;
        readonly desc: "手札をすべて破壊し、新たに3枚ドローする。";
    }, {
        readonly id: "supply_01";
        readonly name: "補給の意志";
        readonly type: "SUPPLY_WILL";
        readonly cost: 1;
        readonly desc: "山札から2枚ドローする。";
    }, {
        readonly id: "plunder_will";
        readonly name: "吸収の意志";
        readonly type: "PLUNDER_WILL";
        readonly cost: 4;
        readonly desc: "次の反転数だけ相手の布石を吸収する。";
    }, {
        readonly id: "corner_tribute_01";
        readonly name: "角の代償";
        readonly type: "CORNER_TRIBUTE";
        readonly cost: 0;
        readonly desc: "相手が角に4個以上石を置いている時だけ使用可能。相手の布石を最大20奪う。";
    }, {
        readonly id: "work_01";
        readonly name: "出稼ぎの意志";
        readonly type: "WORK_WILL";
        readonly cost: 11;
        readonly desc: "次の配置をアンカーにして、その石がある限り自ターン開始時に1,2,4,8,16の順でチャージを得る（最大99）。石が相手に取られるか破壊されると効果は終了する。";
    }, {
        readonly id: "ribo_01";
        readonly name: "リボ払いの意志";
        readonly type: "RIBO_WILL";
        readonly cost: 0;
        readonly desc: "布石を30得る。その後9ターンの間4返済。足りない場合は自石2個を消滅させる。";
    }, {
        readonly id: "loss_will_01";
        readonly name: "意志の喪失";
        readonly type: "LOSS_WILL";
        readonly cost: 15;
        readonly desc: "盤面上の特殊石をすべて通常石に戻す。敵味方を問わず、色は変わらない。";
    }, {
        readonly id: "double_01";
        readonly name: "二連投石";
        readonly type: "DOUBLE_PLACE";
        readonly cost: 24;
        readonly desc: "このターン、石を2回置ける。使用後、三連投石が手札に加わる。";
    }, {
        readonly id: "triple_01";
        readonly name: "三連投石";
        readonly type: "TRIPLE_PLACE";
        readonly cost: 24;
        readonly desc: "生成専用。 このターン、石を3回置ける。使用後、四連投石が手札に加わる。";
        readonly enabled: false;
    }, {
        readonly id: "quad_01";
        readonly name: "四連投石";
        readonly type: "QUAD_PLACE";
        readonly cost: 24;
        readonly desc: "生成専用。 このターン、石を4回置ける。使用後、無限投石が手札に加わる。";
        readonly enabled: false;
    }, {
        readonly id: "infinite_01";
        readonly name: "無限投石";
        readonly type: "INFINITE_PLACE";
        readonly cost: 50;
        readonly desc: "生成専用。合法手が尽きるまで同じ手番で置き続け、置けなくなった時点で終了する。";
        readonly enabled: false;
    }, {
        readonly id: "heaven_01";
        readonly name: "天の恵み";
        readonly type: "HEAVEN_BLESSING";
        readonly cost: 3;
        readonly desc: "ランダムな候補5枚から1枚を選んで獲得する。";
    }, {
        readonly id: "reveal_hand_01";
        readonly name: "観測の意志";
        readonly type: "REVEAL_HAND_WILL";
        readonly cost: 2;
        readonly desc: "現在の相手手札をすべて表にする。使用後に相手が引いたカードは表にならない。";
    }, {
        readonly id: "condemn_01";
        readonly name: "断罪の意志";
        readonly type: "CONDEMN_WILL";
        readonly cost: 8;
        readonly desc: "相手手札を公開し、1枚選んで破壊する。";
    }, {
        readonly id: "gold_stone";
        readonly name: "金の意志";
        readonly type: "GOLD_STONE";
        readonly cost: 6;
        readonly desc: "次の反転で得る布石が4倍。使用後その石は消滅する。";
    }, {
        readonly id: "rainbow_stone";
        readonly name: "虹の意志";
        readonly type: "RAINBOW_STONE";
        readonly cost: 10;
        readonly desc: "次の反転で得る布石が6倍。使用後その石は消滅する。";
    }, {
        readonly id: "silver_stone";
        readonly name: "銀の意志";
        readonly type: "SILVER_STONE";
        readonly cost: 3;
        readonly desc: "次の反転で得る布石が3倍。使用後その石は消滅する。";
    }, {
        readonly id: "crystal_stone";
        readonly name: "水晶の意志";
        readonly type: "CRYSTAL_STONE";
        readonly cost: 8;
        readonly desc: "次に得る数字マスの布石が4倍。使用後その石は消滅する。";
    }, {
        readonly id: "extend_life_01";
        readonly name: "延命の意志";
        readonly type: "EXTEND_LIFE_WILL";
        readonly cost: 4;
        readonly desc: "盤面上の自分の特殊石1つを選び、その持続ターン(remainingOwnerTurns)を2倍にする。";
    }, {
        readonly id: "extend_life_god_01";
        readonly name: "延命神";
        readonly type: "EXTEND_LIFE_GOD";
        readonly cost: 10;
        readonly desc: "盤面上の自分の特殊石1つを選び、その持続ターン(remainingOwnerTurns)を4倍にする。";
    }, {
        readonly id: "corrosion_01";
        readonly name: "腐食の意志";
        readonly type: "CORROSION_WILL";
        readonly cost: 2;
        readonly desc: "盤面上の特殊石1つを選び、その持続ターン(remainingOwnerTurns)を半減させる。対象がない場合は使用不可。";
    }, {
        readonly id: "guard_01";
        readonly name: "守る意志";
        readonly type: "GUARD_WILL";
        readonly cost: 2;
        readonly desc: "自分の石1つに完全保護を付与する。3ターン持続。";
    }, {
        readonly id: "guardian_god_01";
        readonly name: "守護神";
        readonly type: "GUARDIAN_GOD";
        readonly cost: 10;
        readonly desc: "自分の石1つに完全保護を付与する。10ターン持続。";
    }, {
        readonly id: "destroy_dragon_01";
        readonly name: "破壊龍";
        readonly type: "DESTROY_DRAGON_WILL";
        readonly cost: 7;
        readonly desc: "次に置く石を破壊龍化。配置時と自ターン開始時に周囲1マス（8方向）の敵石をランダム1個だけ破壊する。3ターン持続。反転保護を持つ特殊石。";
    }, {
        readonly id: "lightning_01";
        readonly name: "落雷";
        readonly type: "LIGHTNING_WILL";
        readonly cost: 26;
        readonly desc: "次に置く石を落雷石化。配置ターン即時と自ターン開始時に盤面上のランダムな敵石を1個破壊する。5ターン持続。反転保護を持つ特殊石。";
    }, {
        readonly id: "udg_01";
        readonly name: "究極破壊神";
        readonly type: "ULTIMATE_DESTROY_GOD";
        readonly cost: 25;
        readonly desc: "反転0でも空きマスに配置可能。次に置く石を究極破壊神化。置いた時に周囲1マス（8方向）の敵石を破壊。自ターン開始時はランダムな空きマスへ移動してから周囲1マス（8方向）の敵石を破壊し、移動先が無いときはその場で破壊する。5ターン持続。";
    }, {
        readonly id: "ultimate_hyperactive_01";
        readonly name: "究極多動神";
        readonly type: "ULTIMATE_HYPERACTIVE_GOD";
        readonly cost: 28;
        readonly desc: "次に置く石を究極多動神化。両者ターン開始時に直線1〜5マス移動を2回行い、2マス以上は途中の石を飛び越える。移動後に挟めば反転。反転対象時はマス移動で回避し、最大3回まで。破壊対象時も1回だけマス移動で回避する。移動先が無いと消滅。特殊石として扱われ、10ターン後は同色の通常石に戻る。";
    }, {
        readonly id: "board_expand_01";
        readonly name: "盤面拡張";
        readonly type: "BOARD_EXPANSION_WILL";
        readonly cost: 19;
        readonly desc: "盤面の左右どちらか外側に1マスを追加する。追加位置は左右端マスから選ぶ。1対局で1回のみ使用可能。";
    }, {
        readonly id: "board_expand_god_01";
        readonly name: "盤面拡張神";
        readonly type: "BOARD_EXPANSION_GOD";
        readonly cost: 27;
        readonly desc: "初期8x8の角マスから拡張可能な角を最大2つ選び、その外側3〜6マス（各角3マスずつ、直交2方向+斜め）に拡張セルを追加する。";
    }, {
        readonly id: "blockade_01";
        readonly name: "封鎖の意志";
        readonly type: "BLOCKADE_WILL";
        readonly cost: 1;
        readonly desc: "盤面の空きマス1つを封鎖し、3ターンの間は両者とも配置・移動で入れない。";
    }, {
        readonly id: "meteor_01";
        readonly name: "隕石";
        readonly type: "METEOR_WILL";
        readonly cost: 21;
        readonly desc: "盤面上のマスを1つ選び、石ごとマスを破壊して穴にする。穴は永続し、誰も配置できず反転経路も遮断する。守る意志・守護神の完全保護も貫通する。";
    }, {
        readonly id: "freeze_01";
        readonly name: "凍結の意志";
        readonly type: "FREEZE_WILL";
        readonly cost: 5;
        readonly desc: "盤面上のマスを1つ選び、5ターン凍結する。凍結マスとその石は反転・破壊されず、凍結中は特殊石の持続ターンが減らない。";
    }, {
        readonly id: "observer_01";
        readonly name: "盤理の観測者";
        readonly type: "OBSERVER_WILL";
        readonly cost: 1;
        readonly desc: "次に置く石を観測者石化。所有者ターン開始時に30%で発動し、布石を1〜5獲得。5ターン持続。";
    }, {
        readonly id: "salvation_01";
        readonly name: "救済の意志";
        readonly type: "SALVATION_WILL";
        readonly cost: 17;
        readonly desc: "直前の相手ターンで破壊された全ての石を救済し、自分の通常石として空きマスにランダム配置。";
    }, {
        readonly id: "reinforcement_01";
        readonly name: "増援の意志";
        readonly type: "REINFORCEMENT_WILL";
        readonly cost: 6;
        readonly desc: "石に隣接する内側空きマスへランダム1マス通常石を配置する。(反転可能)";
    }, {
        readonly id: "equality_will_01";
        readonly name: "平等の意志";
        readonly type: "EQUALITY_WILL";
        readonly cost: 15;
        readonly desc: "空きマスに3個石をランダム配置、石数が10個以上負けているときに使用可能。";
    }];
    CARD_TYPE_BY_ID: Record<string, string>;
    CARD_TYPES: readonly ["TREASURE_BOX", "FREE_PLACEMENT", "LAST_RESORT", "SNIPER_WILL", "PROTECTED_NEXT_STONE", "GHOST_WILL", "AFTERIMAGE_WILL", "SWAP_WITH_ENEMY", "POSITION_SWAP_WILL", "PERMA_PROTECT_NEXT_STONE", "STRONG_WIND_WILL", "SUPER_BUOYANCY_WILL", "SUPER_GRAVITY_WILL", "TRAP_WILL", "TEMPT_WILL", "CAPTURE_WILL", "DOUBLE_CHAIN_WILL", "TRIPLE_CHAIN_WILL", "QUAD_CHAIN_WILL", "INFINITE_CHAIN_WILL", "REGEN_WILL", "DESTROY_ONE_STONE", "TIME_BOMB", "TIME_STOP_GOD", "ULTIMATE_REVERSE_DRAGON", "BREEDING_WILL", "PROLIFERATION_WILL", "CLONE_WILL", "SPLIT_WILL", "SEED_WILL", "TELEPORT_WILL", "CELL_TELEPORT_WILL", "CROSS_BOMB", "X_BOMB", "DOUBLE_PLACE", "TRIPLE_PLACE", "QUAD_PLACE", "INFINITE_PLACE", "HEAVEN_BLESSING", "REVEAL_HAND_WILL", "CONDEMN_WILL", "PLUNDER_WILL", "CORNER_TRIBUTE", "WORK_WILL", "RIBO_WILL", "LOSS_WILL", "GOLD_STONE", "RAINBOW_STONE", "SILVER_STONE", "CRYSTAL_STONE", "EXTEND_LIFE_WILL", "EXTEND_LIFE_GOD", "CORROSION_WILL", "GUARD_WILL", "GUARDIAN_GOD", "DESTROY_DRAGON_WILL", "LIGHTNING_WILL", "ULTIMATE_DESTROY_GOD", "ULTIMATE_HYPERACTIVE_GOD", "BOARD_EXPANSION_WILL", "BOARD_EXPANSION_GOD", "BLOCKADE_WILL", "METEOR_WILL", "FREEZE_WILL", "OBSERVER_WILL", "HYPERACTIVE_WILL", "HYPERACTIVE_INHERIT_WILL", "EXTREME_HYPERACTIVE_WILL", "ESCAPE_WILL", "ROBOT_VACUUM_WILL", "GLUTTONOUS_WILL", "WILL_HUNTER_KING", "INSTANT_HYPERACTIVE_WILL", "REBUILD_WILL", "SUPPLY_WILL", "REINFORCEMENT_WILL", "EQUALITY_WILL", "SALVATION_WILL"];
    MAX_SWAP_TARGETS: number;
    MAX_DESTROY_TARGETS: number;
    TIME_BOMB_TURNS: number;
    TIME_STOP_GOD_TURNS: number;
    TIME_STOP_GOD_CONSECUTIVE_TURNS: number;
    TIME_STOP_GOD_SELF_DESTROY_COUNT: number;
    STRONG_WILL_PROMOTION_OWNER_TURNS: number;
    DESTROY_FADE_MS: number;
};
export default _default;
//# sourceMappingURL=shared-constants.d.ts.map