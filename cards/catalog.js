// Auto-loaded card catalog for browser usage.
// Source of truth: `cards/catalog.json`
// Keep in sync with SharedConstants/CARD_DEFS.

window.CardCatalog = {
  "version": 1,
  "cards": [
    {"id": "free_01", "name": "自由の意志", "type": "FREE_PLACEMENT", "cost": 2, "desc": "反転できなくても、空いているマスならどこにでも石を置ける"},
    {"id": "hard_01", "name": "弱い意志", "type": "PROTECTED_NEXT_STONE", "cost": 1, "desc": "次に置いた石は、次の相手ターンの間、反転されない"},
    {"id": "swap_01", "name": "交換の意志", "type": "SWAP_WITH_ENEMY", "cost": 5, "desc": "次に置く石を、相手の石1つと入れ替えて配置できる"},
    {"id": "perma_01", "name": "強い意志", "type": "PERMA_PROTECT_NEXT_STONE", "cost": 12, "desc": "次に置いた石は、ずっと反転されない。"},
    {"id": "inherit_01", "name": "意志の継承", "type": "INHERIT_WILL", "cost": 14, "desc": "盤面上の自分の通常石を1つ選び、強い意志状態にする。"},
    {"id": "tempt_01", "name": "誘惑の意志", "type": "TEMPT_WILL", "cost": 20, "desc": "盤面上の相手の特殊石（通常石以外の見た目の石）を1つ選び、自分の石にする（残りターン等は保持）。相手の特殊石が無い場合は使用不可。"},
    {"id": "chain_01", "name": "連鎖の意志", "type": "CHAIN_WILL", "cost": 22, "desc": "このターンの配置で発生した通常反転を起点に、最大1方向のみ追加反転を行う。"},
    {"id": "regen_01", "name": "再生の意志", "type": "REGEN_WILL", "cost": 15, "desc": "次に置いた石は1回だけ再生し、反転されたら元の色に戻る。戻った結果、そのマスを起点に挟める列があれば成立する方向の石を反転する。"},
    {"id": "destroy_01", "name": "破壊神", "type": "DESTROY_ONE_STONE", "cost": 10, "desc": "盤上の石を1つ選び、破壊する。"},
    {"id": "bomb_01", "name": "時限爆弾", "type": "TIME_BOMB", "cost": 13, "desc": "このカードで置いた石は3ターン後に爆発し、周囲9マスの石を破壊する。反転されると爆弾は解除され通常石になる。"},
    {"id": "udr_01", "name": "究極反転龍", "type": "ULTIMATE_REVERSE_DRAGON", "cost": 30, "desc": "次に置く石を龍化。配置ターン即時＋自ターン開始時、周囲8マスの相手石を自分色に反転（反転数はチャージ対象）。持続5ターン（配置ターン含め最大6回発動）で消滅。"},
    {"id": "breeding_01", "name": "繁殖の意志", "type": "BREEDING_WILL", "cost": 16, "desc": "次に置く石を儀式石化。配置ターン即時＋自ターン開始時、周囲8マスの空きマスに石を1個生成。生成石で挟める場合は通常反転（反転数はチャージ対象）。持続3ターン（配置ターン含め最大4回生成）で儀式石は破壊。"},
    {"id": "hyperactive_01", "name": "多動の意志", "type": "HYPERACTIVE_WILL", "cost": 8, "desc": "次に置く石を多動石化。両者のターン開始時に、周囲8マスの空きへランダムに1マス移動し、移動後に挟める場合は通常反転。"},
    {"id": "plunder_will", "name": "吸収の意志", "type": "PLUNDER_WILL", "cost": 4, "desc": "次の反転数だけ相手の布石を奪う。"},    {"id": "work_01", "name": "出稼ぎの意志", "type": "WORK_WILL", "cost": 9, "desc": "次の配置をアンカーにして、その石がある限り自ターン開始時に1,2,4,8,16の順でチャージを得る（最大30）。石が相手に取られるか破壊されると効果は終了する。" },    {"id": "double_01", "name": "二連投石", "type": "DOUBLE_PLACE", "cost": 27, "desc": "このターン、石を2回置ける。"},
    {"id": "gold_stone", "name": "金の意志", "type": "GOLD_STONE", "cost": 6, "desc": "次の反転で得る布石が4倍。使用後その石は消滅する。"},
    {"id": "silver_stone", "name": "銀の意志", "type": "SILVER_STONE", "cost": 3, "desc": "次の反転で得る布石が3倍。使用後その石は消滅する。"},
    {"id": "steal_card_01", "name": "略奪の意志", "type": "STEAL_CARD", "cost": 7, "desc": "反転させた枚数だけ相手のカードを奪う。"},
    {"id": "udg_01", "name": "究極破壊神", "type": "ULTIMATE_DESTROY_GOD", "cost": 25, "desc": "次に置く石を究極破壊神化。配置ターン即時＋自ターン開始時、周囲8マスの敵石を破壊。持続3ターン（配置ターン含め最大4回）。"}
  ]
};

