// Auto-generated from cards/catalog.json - do not edit directly.
// Use: node scripts/generate-catalog.js to regenerate.
window.CardCatalog = {
  "version": 1,
  "notes": "Source of truth for card display name (ja) <-> code/type. Keep this in sync with SharedConstants/CARD_DEFS.",
  "cards": [
    {
      "id": "chest_01",
      "name_ja": "宝箱",
      "type": "TREASURE_BOX",
      "cost": 0,
      "desc_ja": "使用時に布石を1〜3ランダムで獲得する。",
      "display_type_ja": "採掘"
    },
    {
      "id": "free_01",
      "name_ja": "自由の意志",
      "type": "FREE_PLACEMENT",
      "cost": 14,
      "desc_ja": "反転0でも空きマスに置ける。",
      "display_type_ja": "禁忌"
    },
    {
      "id": "last_resort_01",
      "name_ja": "最後の切り札",
      "type": "LAST_RESORT",
      "cost": 9,
      "desc_ja": "石数負けかつ合法手0の時に使用可能、空きマスに石を3個配置できる。",
      "display_type_ja": "禁忌"
    },
    {
      "id": "sniper_01",
      "name_ja": "狙撃の意志",
      "type": "SNIPER_WILL",
      "cost": 23,
      "desc_ja": "次に置く石を狙撃石化。空きマスに自由配置でき、配置時と自ターン開始時に最も近い敵石を1つ破壊する。5ターン持続。",
      "display_type_ja": "戦闘"
    },
    {
      "id": "hard_01",
      "name_ja": "弱い意志",
      "type": "PROTECTED_NEXT_STONE",
      "cost": 1,
      "desc_ja": "次に置く石は次の相手ターン中だけ反転されない。",
      "display_type_ja": "守護"
    },
    {
      "id": "ghost_01",
      "name_ja": "幽霊の意志",
      "type": "GHOST_WILL",
      "cost": 5,
      "desc_ja": "次に置く石を幽体化する。5ターンの間、反転・破壊の対象にはなるがその石自身は受けない。交換の意志の対象外で、入替や他の効果は通常どおり受ける。",
      "display_type_ja": "守護"
    },
    {
      "id": "afterimage_will_01",
      "name_ja": "避ける意志",
      "type": "AFTERIMAGE_WILL",
      "cost": 8,
      "desc_ja": "次に置く石は反転または破壊されたとき3回まで復活する、復活後挟める列があれば反転させる。",
      "display_type_ja": "守護"
    },
    {
      "id": "swap_01",
      "name_ja": "交換の意志",
      "type": "SWAP_WITH_ENEMY",
      "cost": 17,
      "desc_ja": "相手通常石1つ選んで自分の通常石に交換する。(反転可能)",
      "display_type_ja": "執行"
    },
    {
      "id": "position_swap_01",
      "name_ja": "入替の意志",
      "type": "POSITION_SWAP_WILL",
      "cost": 13,
      "desc_ja": "盤面上の石2つを選び、位置を入れ替える。通常石・特殊石・爆弾を問わず対象にできる。",
      "display_type_ja": "執行"
    },
    {
      "id": "perma_01",
      "name_ja": "強い意志",
      "type": "PERMA_PROTECT_NEXT_STONE",
      "cost": 15,
      "desc_ja": "次に置く石はずっと反転されない。10ターン経過すると最強の意志に進化して絶対保護を得る。",
      "display_type_ja": "守護"
    },
    {
      "id": "strong_wind_01",
      "name_ja": "強風の意志",
      "type": "STRONG_WIND_WILL",
      "cost": 9,
      "desc_ja": "選択した石を左右どちらかに端まで移動させる。",
      "display_type_ja": "執行"
    },
    {
      "id": "super_buoyancy_01",
      "name_ja": "超浮力",
      "type": "SUPER_BUOYANCY_WILL",
      "cost": 31,
      "desc_ja": "盤面の石1つを選び、上方向へ限界まで移動させる。進行方向上の石は衝突時にすべて破壊して進む。",
      "display_type_ja": "殲滅"
    },
    {
      "id": "buoyancy_01",
      "name_ja": "浮力",
      "type": "BUOYANCY_WILL",
      "cost": 9,
      "desc_ja": "石1つ選び上方向の端まで移動させる",
      "display_type_ja": "執行"
    },
    {
      "id": "super_gravity_01",
      "name_ja": "超重力",
      "type": "SUPER_GRAVITY_WILL",
      "cost": 31,
      "desc_ja": "盤面の石1つを選び、下方向へ限界まで移動させる。進行方向上の石は衝突時にすべて破壊して進む。",
      "display_type_ja": "殲滅"
    },
    {
      "id": "super_attraction_01",
      "name_ja": "超引力",
      "type": "SUPER_ATTRACTION_WILL",
      "cost": 40,
      "desc_ja": "盤面の石1つを選び、盤面上の別マスまで最短経路で引き寄せる。経路上と指定マス上の石はすべて破壊する。",
      "display_type_ja": "殲滅"
    },
    {
      "id": "gravity_01",
      "name_ja": "重力",
      "type": "GRAVITY_WILL",
      "cost": 9,
      "desc_ja": "石1つ選び下方向の端まで移動させる。",
      "display_type_ja": "執行"
    },
    {
      "id": "trap_01",
      "name_ja": "罠の意志",
      "type": "TRAP_WILL",
      "cost": 4,
      "desc_ja": "自分の石1つを罠石化してターン終了。次の相手ターン中に反転されると相手の布石を最大10奪う+手札全破壊。",
      "display_type_ja": "特殊"
    },
    {
      "id": "tempt_01",
      "name_ja": "誘惑の意志",
      "type": "TEMPT_WILL",
      "cost": 23,
      "desc_ja": "相手の特殊石本体を1つ選んで自分の色に変える。",
      "display_type_ja": "執行"
    },
    {
      "id": "capture_01",
      "name_ja": "捕獲の意志",
      "type": "CAPTURE_WILL",
      "cost": 20,
      "desc_ja": "盤面上の敵の特殊石本体を1つ捕獲して自分の手札に加える。対象が無いと使えない。",
      "display_type_ja": "執行"
    },
    {
      "id": "double_chain_01",
      "name_ja": "二連鎖の意志",
      "type": "DOUBLE_CHAIN_WILL",
      "cost": 22,
      "desc_ja": "反転後新たに挟める列ができた場合、1列追加反転する。使用後、三連鎖の意志が手札に加わる。",
      "display_type_ja": "禁忌"
    },
    {
      "id": "triple_chain_01",
      "name_ja": "三連鎖の意志",
      "type": "TRIPLE_CHAIN_WILL",
      "cost": 22,
      "desc_ja": "反転後新たに挟める列ができた場合、2列追加反転する。使用後、四連鎖の意志が手札に加わる。",
      "enabled": false,
      "display_type_ja": "禁忌"
    },
    {
      "id": "quad_chain_01",
      "name_ja": "四連鎖の意志",
      "type": "QUAD_CHAIN_WILL",
      "cost": 22,
      "desc_ja": "反転後新たに挟める列ができた場合、3列追加反転する。使用後、無限連鎖の意志が手札に加わる。",
      "enabled": false,
      "display_type_ja": "禁忌"
    },
    {
      "id": "infinite_chain_01",
      "name_ja": "無限連鎖の意志",
      "type": "INFINITE_CHAIN_WILL",
      "cost": 50,
      "desc_ja": "反転後新たに挟める列ができた場合、可能な限り追加反転する。",
      "enabled": false,
      "display_type_ja": "禁忌"
    },
    {
      "id": "taboo_reverse_01",
      "name_ja": "禁忌の反転",
      "type": "TABOO_REVERSE_WILL",
      "cost": 44,
      "desc_ja": "次に置く石は挟めなくても反転可能。最も反転枚数が多い列1方向のみ。",
      "display_type_ja": "禁忌"
    },
    {
      "id": "regen_01",
      "name_ja": "復活の意志",
      "type": "REGEN_WILL",
      "cost": 12,
      "desc_ja": "次に置く石は復活可能回数3を持つ。反転または破壊されるたびに1回消費して元色に戻り、そこから挟める列を反転する。",
      "display_type_ja": "守護"
    },
    {
      "id": "destroy_01",
      "name_ja": "破壊の意志",
      "type": "DESTROY_ONE_STONE",
      "cost": 19,
      "desc_ja": "盤上の石1つを破壊する。",
      "display_type_ja": "執行"
    },
    {
      "id": "bomb_01",
      "name_ja": "時限爆弾",
      "type": "TIME_BOMB",
      "cost": 13,
      "desc_ja": "盤面上の自分の石1つを時限爆弾化。3ターン後にそのマスと周囲1マス（3x3）を爆破。反転されると解除。",
      "display_type_ja": "殲滅"
    },
    {
      "id": "time_stop_god_01",
      "name_ja": "時間停石",
      "type": "TIME_STOP_GOD",
      "cost": 0,
      "desc_ja": "手札に入った時点で即時破壊され、通常プレイでは使用しない。デバッグ等で手札に残った場合のみ、5ターン後時間停止を発動し2連続行動できる。",
      "display_type_ja": "禁忌"
    },
    {
      "id": "udr_01",
      "name_ja": "究極反転龍",
      "type": "ULTIMATE_REVERSE_DRAGON",
      "cost": 30,
      "desc_ja": "空きマス自由配置可。置いた石が龍化し、配置時に周囲1マスを反転。自ターン開始時はランダムな空きマスへ移動してから周囲1マスを反転（5ターン）。",
      "display_type_ja": "戦闘"
    },
    {
      "id": "breeding_01",
      "name_ja": "繁殖の意志",
      "type": "BREEDING_WILL",
      "cost": 16,
      "desc_ja": "次に置く石を繁殖化。配置時+自ターン開始時周囲に石を1個生成。(5ターン)",
      "display_type_ja": "守護"
    },
    {
      "id": "proliferation_01",
      "name_ja": "増殖の意志",
      "type": "PROLIFERATION_WILL",
      "cost": 4,
      "desc_ja": "次に置く石を増殖石化。破壊される時、最も近い空きへ1個増殖して破壊を防ぐ。空きが無ければ破壊される。10ターン後や反転時は通常石に戻る。",
      "display_type_ja": "繁栄"
    },
    {
      "id": "clone_01",
      "name_ja": "複製の意志",
      "type": "CLONE_WILL",
      "cost": 16,
      "desc_ja": "盤面上の自分の石1つを選び、周囲8マスの空きからランダム1マスへ同じ石を複製する。生成では反転しない。特殊石は残り持続ターンなどを引き継ぐ。周囲に空きがない石は対象外。",
      "display_type_ja": "繁栄"
    },
    {
      "id": "seed_01",
      "name_ja": "種まきの意志",
      "type": "SEED_WILL",
      "cost": 7,
      "desc_ja": "空きマス1つに種をまく。種マスは通常どおり配置でき、石が置かれると種は消える。所有者ターン開始時だけ減算し、5回目で空いたままなら同色の通常石が1個芽生える。芽生えでは反転しない。",
      "display_type_ja": "繁栄"
    },
    {
      "id": "teleport_01",
      "name_ja": "テレポート",
      "type": "TELEPORT_WILL",
      "cost": 10,
      "desc_ja": "盤面上の石1つを選び、ランダムな空きマスへテレポートさせる。対象は敵味方・通常石・特殊石を問わない。",
      "display_type_ja": "執行"
    },
    {
      "id": "cell_teleport_01",
      "name_ja": "マステレポート",
      "type": "CELL_TELEPORT_WILL",
      "cost": 18,
      "desc_ja": "マスを1つ選び、盤面外側へランダムテレポートさせ、元マスを穴化。",
      "display_type_ja": "執行"
    },
    {
      "id": "cross_bomb_01",
      "name_ja": "十字爆弾",
      "type": "CROSS_BOMB",
      "cost": 18,
      "desc_ja": "次に置く石へ十字爆弾の配置時効果を付ける。通常反転後に即起爆し、その石を起点に縦横2マス（中心含む十字）の石を爆破する。",
      "display_type_ja": "殲滅"
    },
    {
      "id": "x_bomb_01",
      "name_ja": "クロス爆弾",
      "type": "X_BOMB",
      "cost": 18,
      "desc_ja": "次に置く石へクロス爆弾の配置時効果を付ける。通常反転後に即起爆し、その石を起点に斜め2マス（中心含むX字）の石を爆破する。",
      "display_type_ja": "殲滅"
    },
    {
      "id": "hyperactive_01",
      "name_ja": "多動の意志",
      "type": "HYPERACTIVE_WILL",
      "cost": 8,
      "desc_ja": "次に置く石を多動化。両者ターン開始時に1マス移動、反転回避を1回持つ。",
      "display_type_ja": "戦闘"
    },
    {
      "id": "hyperactive_inherit_01",
      "name_ja": "多動の継承",
      "type": "HYPERACTIVE_INHERIT_WILL",
      "cost": 11,
      "desc_ja": "自分の石1つに多動を継承。10ターンの間、両者ターン開始時に1マス移動し、反転・破壊を各1回回避する。",
      "display_type_ja": "特殊"
    },
    {
      "id": "extreme_hyperactive_01",
      "name_ja": "極悪多動魔",
      "type": "EXTREME_HYPERACTIVE_WILL",
      "cost": 35,
      "desc_ja": "次に置く石を極悪多動魔化。両者ターン開始時に周囲へ移動し、近くの石を押しのける。反転3回・破壊1回を回避し、ターン制限なし。",
      "display_type_ja": "戦闘"
    },
    {
      "id": "escape_01",
      "name_ja": "逃げる意志",
      "type": "ESCAPE_WILL",
      "cost": 7,
      "desc_ja": "次に置く石を逃亡石化。毎ターン1マス逃げるように移動し、移動できるマスがなくなると爆発。反転回避を1回持つ。",
      "display_type_ja": "殲滅"
    },
    {
      "id": "robot_vacuum_01",
      "name_ja": "ロボット掃除機",
      "type": "ROBOT_VACUUM_WILL",
      "cost": 17,
      "desc_ja": "次に置く石は毎ターン1マス移動し、周囲の敵石を1個吸い込む。吸い込むと持続ターンが1増える。",
      "display_type_ja": "戦闘"
    },
    {
      "id": "gluttonous_will_01",
      "name_ja": "悪食の意志",
      "type": "GLUTTONOUS_WILL",
      "cost": 29,
      "desc_ja": "使用後、残り手札をすべて破壊し、次に置く石を悪食石化。両者ターン開始時に敵石方向へ1マス移動し、隣接敵石へは優先して進入しながら捕食する。隣接敵石が無い場合は近づくように移動し、2連続で捕食できなければ飢えて消滅する。反転保護を持つ特殊石。",
      "display_type_ja": "戦闘"
    },
    {
      "id": "will_hunter_king_01",
      "name_ja": "意志狩りの王",
      "type": "WILL_HUNTER_KING",
      "cost": 33,
      "desc_ja": "次に置く石を意志狩り化。自ターン開始時、敵石を1つ破壊してそのマスへ移動する。敵の特殊石を優先して狙う。",
      "display_type_ja": "戦闘"
    },
    {
      "id": "instant_hyperactive_01",
      "name_ja": "瞬間多動",
      "type": "INSTANT_HYPERACTIVE_WILL",
      "cost": 2,
      "desc_ja": "次に置く石へ瞬間多動の配置時効果を付ける。配置直後にランダム1マス移動を3回行い、各移動後に挟めば反転。最後に通常石へ戻る。",
      "display_type_ja": "戦闘"
    },
    {
      "id": "rebuild_01",
      "name_ja": "再構築の意志",
      "type": "REBUILD_WILL",
      "cost": 0,
      "desc_ja": "手札をすべて破壊し、新たに3枚ドローする。",
      "display_type_ja": "観測"
    },
    {
      "id": "supply_01",
      "name_ja": "補給の意志",
      "type": "SUPPLY_WILL",
      "cost": 1,
      "desc_ja": "山札から2枚ドローする。",
      "display_type_ja": "観測"
    },
    {
      "id": "plunder_will",
      "name_ja": "吸収の意志",
      "type": "PLUNDER_WILL",
      "cost": 4,
      "desc_ja": "次の反転枚数だけ相手の布石を吸収する。",
      "display_type_ja": "採掘"
    },
    {
      "id": "corner_tribute_01",
      "name_ja": "角の代償",
      "type": "CORNER_TRIBUTE",
      "cost": 0,
      "desc_ja": "相手が角に4個以上石を置いている時だけ使用可能。相手の布石を最大20奪う。",
      "display_type_ja": "採掘"
    },
    {
      "id": "work_01",
      "name_ja": "出稼ぎの意志",
      "type": "WORK_WILL",
      "cost": 11,
      "desc_ja": "次の配置石をアンカー化。自ターン開始時に1→2→4→8→16の順でチャージ獲得（最大99）。失うと終了。",
      "display_type_ja": "採掘"
    },
    {
      "id": "ribo_01",
      "name_ja": "リボ払いの意志",
      "type": "RIBO_WILL",
      "cost": 0,
      "desc_ja": "布石を30得る。その後9ターンの間4返済。足りない場合は自石4個を消滅させる。",
      "display_type_ja": "採掘"
    },
    {
      "id": "loss_will_01",
      "name_ja": "意志の喪失",
      "type": "LOSS_WILL",
      "cost": 15,
      "desc_ja": "盤面上の特殊石本体をすべて通常石に戻し、爆弾は解除する。敵味方を問わず、色は変わらない。",
      "display_type_ja": "執行"
    },
    {
      "id": "double_01",
      "name_ja": "二連投石",
      "type": "DOUBLE_PLACE",
      "cost": 24,
      "desc_ja": "使用ターンだけ石を2連続で置ける。使用後、三連投石が手札に加わる。",
      "display_type_ja": "禁忌"
    },
    {
      "id": "triple_01",
      "name_ja": "三連投石",
      "type": "TRIPLE_PLACE",
      "cost": 24,
      "desc_ja": "使用ターンだけ石を3連続で置ける。使用後、四連投石が手札に加わる。",
      "enabled": false,
      "display_type_ja": "禁忌"
    },
    {
      "id": "quad_01",
      "name_ja": "四連投石",
      "type": "QUAD_PLACE",
      "cost": 24,
      "desc_ja": "使用ターンだけ石を4連続で置ける。使用後、無限投石が手札に加わる。",
      "enabled": false,
      "display_type_ja": "禁忌"
    },
    {
      "id": "infinite_01",
      "name_ja": "無限投石",
      "type": "INFINITE_PLACE",
      "cost": 50,
      "desc_ja": "使用ターンだけ合法手がなくなるまで石を連続で置ける。置けなくなった時点で終了する。",
      "enabled": false,
      "display_type_ja": "禁忌"
    },
    {
      "id": "heaven_01",
      "name_ja": "天の恵み",
      "type": "HEAVEN_BLESSING",
      "cost": 3,
      "desc_ja": "ランダムな候補5枚から1枚を選んで獲得する。",
      "display_type_ja": "観測"
    },
    {
      "id": "reveal_hand_01",
      "name_ja": "観測の意志",
      "type": "REVEAL_HAND_WILL",
      "cost": 2,
      "desc_ja": "現在の相手手札をすべて表にする。使用後に相手が引いたカードは表にならない。",
      "display_type_ja": "観測"
    },
    {
      "id": "condemn_01",
      "name_ja": "断罪の意志",
      "type": "CONDEMN_WILL",
      "cost": 8,
      "desc_ja": "相手手札を公開し、1枚選んで破壊する。",
      "display_type_ja": "執行"
    },
    {
      "id": "execution_01",
      "name_ja": "執行の意志",
      "type": "EXECUTION_WILL",
      "cost": 2,
      "desc_ja": "直前の相手ターンで自分の石が破壊されていた場合に使用可能。相手手札をランダムで最大3枚破壊する。",
      "display_type_ja": "執行"
    },
    {
      "id": "gold_stone",
      "name_ja": "金の意志",
      "type": "GOLD_STONE",
      "cost": 6,
      "desc_ja": "次の配置石へ1回だけ反転布石4倍の配置時効果を付ける。効果解決後その石は消滅する。",
      "display_type_ja": "採掘"
    },
    {
      "id": "rainbow_stone",
      "name_ja": "虹の意志",
      "type": "RAINBOW_STONE",
      "cost": 10,
      "desc_ja": "次の配置石へ1回だけ反転布石6倍の配置時効果を付ける。効果解決後その石は消滅する。",
      "display_type_ja": "採掘"
    },
    {
      "id": "silver_stone",
      "name_ja": "銀の意志",
      "type": "SILVER_STONE",
      "cost": 3,
      "desc_ja": "次の配置石へ1回だけ反転布石3倍の配置時効果を付ける。効果解決後その石は消滅する。",
      "display_type_ja": "採掘"
    },
    {
      "id": "crystal_stone",
      "name_ja": "演算の意志",
      "type": "CRYSTAL_STONE",
      "cost": 6,
      "desc_ja": "次に得る数字マスの布石を2倍にする。数字マス以外では何も起こらない。",
      "display_type_ja": "採掘"
    },
    {
      "id": "theory_incarnation",
      "name_ja": "理論の化身",
      "type": "THEORY_INCARNATION",
      "cost": 21,
      "desc_ja": "次に置く石を理論の化身にする。盤面にいる間、その所有者の数字マス布石を2倍にする。10ターン持続。",
      "display_type_ja": "特殊石"
    },
    {
      "id": "extend_life_01",
      "name_ja": "延命の意志",
      "type": "EXTEND_LIFE_WILL",
      "cost": 4,
      "desc_ja": "盤面上の自分の特殊石本体または石状態1つを選び、その持続ターンを2倍にする。",
      "display_type_ja": "守護"
    },
    {
      "id": "extend_life_god_01",
      "name_ja": "延命神",
      "type": "EXTEND_LIFE_GOD",
      "cost": 10,
      "desc_ja": "盤面上の自分の特殊石本体または石状態1つを選び、その持続ターンを4倍にする。",
      "display_type_ja": "守護"
    },
    {
      "id": "corrosion_01",
      "name_ja": "腐食の意志",
      "type": "CORROSION_WILL",
      "cost": 2,
      "desc_ja": "盤面上の特殊石本体または石状態1つを選び、その持続ターンを半減させる。対象がない場合は使用不可。",
      "display_type_ja": "執行"
    },
    {
      "id": "guard_01",
      "name_ja": "守る意志",
      "type": "GUARD_WILL",
      "cost": 2,
      "desc_ja": "自分の石1つに完全保護を付与する。3ターン持続。",
      "display_type_ja": "守護"
    },
    {
      "id": "guardian_god_01",
      "name_ja": "守護神",
      "type": "GUARDIAN_GOD",
      "cost": 10,
      "desc_ja": "自分の石1つに完全保護を付与する。10ターン持続。",
      "display_type_ja": "守護"
    },
    {
      "id": "stone_salvation_god_01",
      "name_ja": "救済神",
      "type": "STONE_SALVATION_GOD",
      "cost": 20,
      "desc_ja": "次に置く石を救済神化。10ターンの間、破壊された石を救済神の持ち主の通常石として空きマスに復活させる。救済神自身は復活しない。",
      "display_type_ja": "繁栄"
    },
    {
      "id": "destroy_dragon_01",
      "name_ja": "破壊龍",
      "type": "DESTROY_DRAGON_WILL",
      "cost": 7,
      "desc_ja": "次に置く石を破壊龍化。配置時と自ターン開始時に周囲1マス（8方向）の敵石をランダム1個だけ破壊する。3ターン持続。反転保護を持つ特殊石。",
      "display_type_ja": "戦闘"
    },
    {
      "id": "lightning_01",
      "name_ja": "落雷",
      "type": "LIGHTNING_WILL",
      "cost": 26,
      "desc_ja": "次に置く石を落雷石化。配置ターン即時と自ターン開始時に盤面上のランダムな敵石を1個破壊する。5ターン持続。反転保護を持つ特殊石。",
      "display_type_ja": "戦闘"
    },
    {
      "id": "udg_01",
      "name_ja": "究極破壊神",
      "type": "ULTIMATE_DESTROY_GOD",
      "cost": 25,
      "desc_ja": "次に置く石を究極破壊神化。空きマスに自由配置でき、配置時と自ターン開始時に周囲1マスの敵石を破壊する。5ターン持続。",
      "display_type_ja": "戦闘"
    },
    {
      "id": "ultimate_hyperactive_01",
      "name_ja": "究極多動神",
      "type": "ULTIMATE_HYPERACTIVE_GOD",
      "cost": 28,
      "desc_ja": "次に置く石を究極多動神化。10ターンの間、両者ターン開始時に直線移動を2回行う。移動後に挟めば反転し、反転3回・破壊1回を回避する。",
      "display_type_ja": "戦闘"
    },
    {
      "id": "board_expand_01",
      "name_ja": "盤面拡張",
      "type": "BOARD_EXPANSION_WILL",
      "cost": 19,
      "desc_ja": "盤面の左右どちらか外側に1マスを追加する。追加位置は左右端マスから選ぶ。1対局で1回のみ使用可能。",
      "display_type_ja": "禁忌"
    },
    {
      "id": "board_expand_god_01",
      "name_ja": "盤面拡張神",
      "type": "BOARD_EXPANSION_GOD",
      "cost": 27,
      "desc_ja": "初期8x8の角マスから拡張可能な角を最大2つ選び、その外側3〜6マス（各角3マスずつ、直交2方向+斜め）に拡張セルを追加する。",
      "display_type_ja": "禁忌"
    },
    {
      "id": "board_shrink_01",
      "name_ja": "盤面縮小",
      "type": "BOARD_SHRINK_WILL",
      "cost": 19,
      "desc_ja": "外周の連続した3マスを選び、穴マス化して盤面を縮小する。盤面拡張マスも対象にできるが、絶対保護石のあるマスは穴化されない。",
      "display_type_ja": "禁忌"
    },
    {
      "id": "board_shrink_god_01",
      "name_ja": "盤面縮小神",
      "type": "BOARD_SHRINK_GOD",
      "cost": 27,
      "desc_ja": "現在の盤面外周の角を1つ選び、その角から伸びる辺1列を選ぶ。盤面拡張マスを含め、選んだ辺1列を同時に穴化するが、絶対保護石のあるマスは残る。",
      "display_type_ja": "禁忌"
    },
    {
      "id": "blockade_01",
      "name_ja": "封鎖の意志",
      "type": "BLOCKADE_WILL",
      "cost": 1,
      "desc_ja": "盤面の空きマス1つを封鎖し、3ターンの間は両者とも配置・移動で入れない。",
      "display_type_ja": "特殊"
    },
    {
      "id": "meteor_01",
      "name_ja": "隕石",
      "type": "METEOR_WILL",
      "cost": 21,
      "desc_ja": "盤面上のマスを1つ選び、石ごとマスを破壊して穴にする。穴は永続し、誰も配置できず反転経路も遮断する。守る意志・守護神の完全保護も貫通する。",
      "display_type_ja": "執行"
    },
    {
      "id": "freeze_01",
      "name_ja": "凍結の意志",
      "type": "FREEZE_WILL",
      "cost": 5,
      "desc_ja": "盤面上のマスを1つ選び、5ターン凍結する。凍結マスとその石は反転・破壊されず、凍結中は特殊石の持続ターンが減らない。",
      "display_type_ja": "特殊"
    },
    {
      "id": "observer_01",
      "name_ja": "盤理の観測者",
      "type": "OBSERVER_WILL",
      "cost": 1,
      "desc_ja": "次に置く石を観測者石化。所有者ターン開始時に30%で発動し、布石を1〜5獲得。5ターン持続。",
      "display_type_ja": "採掘"
    },
    {
      "id": "salvation_01",
      "name_ja": "救済の意志",
      "type": "SALVATION_WILL",
      "cost": 10,
      "desc_ja": "直前の相手ターンで破壊された全ての石を救済し、自分の通常石として空きマスにランダム配置。",
      "display_type_ja": "繁栄"
    },
    {
      "id": "living_will_01",
      "name_ja": "生きる意志",
      "type": "LIVING_WILL",
      "cost": 20,
      "desc_ja": "自分の石1つに生きる意志を付与。失われる時に1回だけ、付与時点の石状態で復活する。元マスが使えない時は別の空きマスへ復活。",
      "display_type_ja": "繁栄"
    },
    {
      "id": "reinforcement_01",
      "name_ja": "増援の意志",
      "type": "REINFORCEMENT_WILL",
      "cost": 6,
      "desc_ja": "既存石の近くの空きマスに、自分の通常石を1個ランダム配置(反転可)",
      "display_type_ja": "繁栄"
    },
    {
      "id": "support_troops_01",
      "name_ja": "援軍の意志",
      "type": "SUPPORT_TROOPS_WILL",
      "cost": 14,
      "desc_ja": "既存石の近くの空きマスに、自分の通常石を3個ランダム配置(反転可)",
      "display_type_ja": "繁栄"
    },
    {
      "id": "equality_will_01",
      "name_ja": "平等の意志",
      "type": "EQUALITY_WILL",
      "cost": 8,
      "desc_ja": "空きマスに3個石をランダム配置、石数が10個以上負けているときに使用可能。",
      "display_type_ja": "繁栄"
    },
    {
      "id": "fate_will_01",
      "name_ja": "運命の意志",
      "type": "FATE_WILL",
      "cost": 50,
      "desc_ja": "次の相手のターンを自分が操作できる。",
      "display_type_ja": "禁忌"
    }
  ]
};
