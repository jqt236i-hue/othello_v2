// Auto-loaded card catalog for browser usage.
// Source of truth: `cards/catalog.json`
// Keep in sync with SharedConstants/CARD_DEFS.

window.CardCatalog = {
  "version": 1,
  "cards": [
    {
      "id": "chest_01",
      "name": "宝箱",
      "type": "TREASURE_BOX",
      "cost": 0,
      "desc": "使用時に布石を1〜3ランダムで獲得する。"
    },
    {
      "id": "free_01",
      "name": "自由の意志",
      "type": "FREE_PLACEMENT",
      "cost": 16,
      "desc": "反転0でも空きマスに置ける。"
    },
    {
      "id": "last_resort_01",
      "name": "最後の切り札",
      "type": "LAST_RESORT",
      "cost": 12,
      "desc": "通常の合法手がない時だけ使用可能。空きマスに自由配置で2回置ける（固定2回）。"
    },
    {
      "id": "sniper_01",
      "name": "狙撃の意志",
      "type": "SNIPER_WILL",
      "cost": 23,
      "desc": "次に置く石は空きマスならどこでも配置でき、狙撃石化。狙撃石は配置ターン即時と自ターン開始時に最も近い敵石を1つ破壊する（同距離はランダム）。5ターン持続。"
    },
    {
      "id": "hard_01",
      "name": "弱い意志",
      "type": "PROTECTED_NEXT_STONE",
      "cost": 1,
      "desc": "次に置く石は次の相手ターン中だけ反転されない。"
    },
    {
      "id": "swap_01",
      "name": "交換の意志",
      "type": "SWAP_WITH_ENEMY",
      "cost": 17,
      "desc": "相手の通常石1つを自分色に交換し、その位置で挟める相手石を反転する。"
    },
    {
      "id": "position_swap_01",
      "name": "入替の意志",
      "type": "POSITION_SWAP_WILL",
      "cost": 13,
      "desc": "盤面上の石2つを選び、位置を入れ替える。通常石・特殊石・爆弾を問わず対象にできる。"
    },
    {
      "id": "sacrifice_01",
      "name": "生贄の意志",
      "type": "SACRIFICE_WILL",
      "cost": 5,
      "desc": "自分の石を最大3個まで破壊し、1個につき布石+5。"
    },
    {
      "id": "perma_01",
      "name": "強い意志",
      "type": "PERMA_PROTECT_NEXT_STONE",
      "cost": 15,
      "desc": "次に置く石は以後ずっと反転されない。"
    },
    {
      "id": "strong_wind_01",
      "name": "強風の意志",
      "type": "STRONG_WIND_WILL",
      "cost": 9,
      "desc": "盤面の石1つを選び、最も長く進める上下左右方向へ飛ばす（同距離はランダム）。"
    },
    {
      "id": "super_buoyancy_01",
      "name": "超浮力",
      "type": "SUPER_BUOYANCY_WILL",
      "cost": 14,
      "desc": "盤面の石1つを選び、上方向へ限界まで移動させる。進行方向上の石は衝突時にすべて破壊して進む。"
    },
    {
      "id": "super_gravity_01",
      "name": "超重力",
      "type": "SUPER_GRAVITY_WILL",
      "cost": 14,
      "desc": "盤面の石1つを選び、下方向へ限界まで移動させる。進行方向上の石は衝突時にすべて破壊して進む。"
    },
    {
      "id": "trap_01",
      "name": "罠の意志",
      "type": "TRAP_WILL",
      "cost": 4,
      "desc": "自分の石1つを罠石化。次の相手ターン中に反転されると相手の布石全没収+手札全破壊。"
    },
    {
      "id": "tempt_01",
      "name": "誘惑の意志",
      "type": "TEMPT_WILL",
      "cost": 20,
      "desc": "相手の特殊石1つを自分の石にする（残りターン等は維持）。対象が無いと使えない。"
    },
    {
      "id": "chain_01",
      "name": "連鎖の意志",
      "type": "CHAIN_WILL",
      "cost": 22,
      "desc": "この手で起きた通常反転を起点に、追加反転を最大2回まで行う。"
    },
    {
      "id": "taboo_reverse_01",
      "name": "禁忌の反転",
      "type": "TABOO_REVERSE_WILL",
      "cost": 44,
      "desc": "次に置く石は挟めなくても反転可能。最も反転枚数が多い列1方向のみ。"
    },
    {
      "id": "regen_01",
      "name": "復活の意志",
      "type": "REGEN_WILL",
      "cost": 12,
      "desc": "次に置く石は1回だけ再生。反転されたら元色に戻り、そこから挟める列を反転する。"
    },
    {
      "id": "destroy_01",
      "name": "破壊神",
      "type": "DESTROY_ONE_STONE",
      "cost": 19,
      "desc": "盤上の石1つを破壊する。"
    },
    {
      "id": "bomb_01",
      "name": "時限爆弾",
      "type": "TIME_BOMB",
      "cost": 13,
      "desc": "盤面上の自分の石1つを時限爆弾化。3ターン後にそのマスと周囲1マス（3x3）を爆破。反転されると解除。"
    },
    {
      "id": "udr_01",
      "name": "究極反転龍",
      "type": "ULTIMATE_REVERSE_DRAGON",
      "cost": 30,
      "desc": "次に置く石を龍化。置いた時と自ターン開始時に周囲1マス（8方向）を反転。5ターン持続。反転保護を持つ特殊石。"
    },
    {
      "id": "breeding_01",
      "name": "繁殖の意志",
      "type": "BREEDING_WILL",
      "cost": 16,
      "desc": "次に置く石を繁殖化。置いた時と自ターン開始時に周囲8マスへランダム1個生成。以後は前回生成石の周囲へ拡散。挟めば反転。生成石が反転された場合は親石起点に戻る。3ターン持続。"
    },
    {
      "id": "clone_01",
      "name": "複製の意志",
      "type": "CLONE_WILL",
      "cost": 16,
      "desc": "盤面上の自分の石1つを選び、周囲8マスの空きからランダム1マスへ同じ石を複製する。生成では反転しない。特殊石は残り持続ターンなどを引き継ぐ。周囲に空きがない石は対象外。"
    },
    {
      "id": "split_01",
      "name": "分裂の意志",
      "type": "SPLIT_WILL",
      "cost": 12,
      "desc": "盤面上の自分の石1つを選び、周囲8マスの空きからランダム1マスへ同じ石を分裂生成する。生成では反転しない。特殊石の残り持続ターンは元石・生成石とも半分になる。周囲に空きがない石は対象外。"
    },
    {
      "id": "teleport_01",
      "name": "テレポート",
      "type": "TELEPORT_WILL",
      "cost": 10,
      "desc": "盤面上の石1つを選び、ランダムな空きマスへテレポートさせる。対象は敵味方・通常石・特殊石を問わない。"
    },
    {
      "id": "cell_teleport_01",
      "name": "マステレポート",
      "type": "CELL_TELEPORT_WILL",
      "cost": 23,
      "desc": "盤面上の石があるマス1つを選び、盤面拡張・盤面拡張神で追加できる外側マスのどこかへランダムにテレポートさせる。移動元のマスは穴になる。対象は敵味方・通常石・特殊石を問わない。"
    },
    {
      "id": "cross_bomb_01",
      "name": "十字爆弾",
      "type": "CROSS_BOMB",
      "cost": 18,
      "desc": "次に置く石を十字爆弾化。通常反転後に即起爆し、その石を起点に縦横2マス（中心含む十字）の石を爆破する。"
    },
    {
      "id": "x_bomb_01",
      "name": "クロス爆弾",
      "type": "X_BOMB",
      "cost": 18,
      "desc": "次に置く石をクロス爆弾化。通常反転後に即起爆し、その石を起点に斜め2マス（中心含むX字）の石を爆破する。"
    },
    {
      "id": "hyperactive_01",
      "name": "多動の意志",
      "type": "HYPERACTIVE_WILL",
      "cost": 8,
      "desc": "次に置く石を多動化。両者のターン開始時に周囲の空きへ1マス移動し、挟めば反転。反転対象時は1回だけマス移動で回避する。"
    },
    {
      "id": "hyperactive_inherit_01",
      "name": "多動の継承",
      "type": "HYPERACTIVE_INHERIT_WILL",
      "cost": 11,
      "desc": "盤面上の自分の石1つに多動状態を付与する。通常石・特殊石を問わず選択でき、他の状態とも併用可能。両者ターン開始時に1マス移動し、移動後に挟めば反転。反転対象時は1回だけマス移動で回避する。持続は10ターン（所有者ターン開始時のみ減算）。"
    },
    {
      "id": "extreme_hyperactive_01",
      "name": "極悪多動魔",
      "type": "EXTREME_HYPERACTIVE_WILL",
      "cost": 35,
      "desc": "次に置く石を極悪多動魔化。ターン制限なしの多動状態となり、両者ターン開始時に周囲8マス（空き・占有）からランダム1マス移動。占有マスを選んだ場合はその石を1マス退避させてから進入する。移動後に挟めば反転し、隣接1マス（周囲8マス）の石を敵味方問わず遠ざかるように1マス退避させる。退避先が無い石はその場に残る。反転対象時は1回だけマス移動で回避する。"
    },
    {
      "id": "escape_01",
      "name": "逃げる意志",
      "type": "ESCAPE_WILL",
      "cost": 7,
      "desc": "次に置く石を逃亡石化。毎ターン1マス逃げるように移動し、反転対象時は1回回避。移動できるマスがなくなると爆発。"
    },
    {
      "id": "robot_vacuum_01",
      "name": "ロボット掃除機",
      "type": "ROBOT_VACUUM_WILL",
      "cost": 17,
      "desc": "次に置く石は毎ターン1マス移動し、周囲の敵石を1個吸い込む。移動先は周囲8マスの空きから敵石に近づく候補を優先（同優先度はランダム）、空きが無いと消滅。吸い込み後も反転しない。吸い込み成功ごとに持続ターン+1（基本5ターン、所有者ターン開始時のみ減算）。守る意志の完全保護中は吸い込めない。"
    },
    {
      "id": "gluttonous_will_01",
      "name": "悪食の意志",
      "type": "GLUTTONOUS_WILL",
      "cost": 29,
      "desc": "使用後、残り手札をすべて破壊し、次に置く石を悪食石化。両者ターン開始時に敵石方向へ1マス移動し、隣接敵石へは優先して進入しながら捕食する。隣接敵石が無い場合は近づくように移動し、2連続で捕食できなければ飢えて消滅する。反転保護を持つ特殊石。"
    },
    {
      "id": "instant_hyperactive_01",
      "name": "瞬間多動",
      "type": "INSTANT_HYPERACTIVE_WILL",
      "cost": 2,
      "desc": "次に置く石を瞬間多動石化。配置直後にランダム1マス移動を3回行い、各移動後に挟めば反転。最後に消滅する。"
    },
    {
      "id": "sell_01",
      "name": "売却の意志",
      "type": "SELL_CARD_WILL",
      "cost": 8,
      "desc": "使用後、手札から1枚を売却し、そのカードのコスト分だけ布石を得る。"
    },
    {
      "id": "rebuild_01",
      "name": "再構築の意志",
      "type": "REBUILD_WILL",
      "cost": 0,
      "desc": "手札をすべて破壊し、新たに3枚ドローする。"
    },
    {
      "id": "supply_01",
      "name": "補給の意志",
      "type": "SUPPLY_WILL",
      "cost": 1,
      "desc": "山札から2枚ドローする。"
    },
    {
      "id": "plunder_will",
      "name": "吸収の意志",
      "type": "PLUNDER_WILL",
      "cost": 4,
      "desc": "次の反転枚数だけ相手の布石を吸収する。"
    },
    {
      "id": "work_01",
      "name": "出稼ぎの意志",
      "type": "WORK_WILL",
      "cost": 11,
      "desc": "次の配置石をアンカー化。自ターン開始時に1→2→4→8→16の順でチャージ獲得（最大99）。失うと終了。"
    },
    {
      "id": "ribo_01",
      "name": "リボ払いの意志",
      "type": "RIBO_WILL",
      "cost": 0,
      "desc": "18手経過後に使用可。布石を30得る。次の自ターン開始から9回、毎回4返済。足りない回は自石2個をランダム破壊。"
    },
    {
      "id": "loss_will_01",
      "name": "意志の喪失",
      "type": "LOSS_WILL",
      "cost": 11,
      "desc": "盤面上の特殊石をすべて通常石に戻す。敵味方を問わず、色は変わらない。"
    },
    {
      "id": "double_01",
      "name": "二連投石",
      "type": "DOUBLE_PLACE",
      "cost": 24,
      "desc": "このターンは石を2回置ける。"
    },
    {
      "id": "heaven_01",
      "name": "天の恵み",
      "type": "HEAVEN_BLESSING",
      "cost": 3,
      "desc": "ランダムな候補5枚から1枚を選んで獲得する。"
    },
    {
      "id": "condemn_01",
      "name": "断罪の意志",
      "type": "CONDEMN_WILL",
      "cost": 6,
      "desc": "相手手札を公開し、1枚選んで破壊する。"
    },
    {
      "id": "gold_stone",
      "name": "金の意志",
      "type": "GOLD_STONE",
      "cost": 6,
      "desc": "次の反転で得る布石を4倍にする。使用後その石は消滅。"
    },
    {
      "id": "silver_stone",
      "name": "銀の意志",
      "type": "SILVER_STONE",
      "cost": 3,
      "desc": "次の反転で得る布石を3倍にする。使用後その石は消滅。"
    },
    {
      "id": "steal_card_01",
      "name": "転売の意志",
      "type": "STEAL_CARD",
      "cost": 7,
      "desc": "この手の反転枚数ぶん相手手札からカードを奪って売却する。売却したカード1枚につき布石を2獲得。"
    },
    {
      "id": "extend_life_01",
      "name": "延命の意志",
      "type": "EXTEND_LIFE_WILL",
      "cost": 2,
      "desc": "盤面上の自分の特殊石1つを選び、その持続ターン(remainingOwnerTurns)を2倍にする。"
    },
    {
      "id": "corrosion_01",
      "name": "腐食の意志",
      "type": "CORROSION_WILL",
      "cost": 2,
      "desc": "盤面上の特殊石1つを選び、その持続ターン(remainingOwnerTurns)を半減させる。対象がない場合は使用不可。"
    },
    {
      "id": "guard_01",
      "name": "守る意志",
      "type": "GUARD_WILL",
      "cost": 2,
      "desc": "自分の石1つに完全保護を付与する。3ターン持続。"
    },
    {
      "id": "guardian_god_01",
      "name": "守護神",
      "type": "GUARDIAN_GOD",
      "cost": 10,
      "desc": "自分の石1つに完全保護を付与する。10ターン持続。"
    },
    {
      "id": "destroy_dragon_01",
      "name": "破壊龍",
      "type": "DESTROY_DRAGON_WILL",
      "cost": 15,
      "desc": "次に置く石を破壊龍化。配置時と自ターン開始時に周囲1マス（8方向）の敵石をランダム1個だけ破壊する。3ターン持続。反転保護を持つ特殊石。"
    },
    {
      "id": "lightning_01",
      "name": "落雷",
      "type": "LIGHTNING_WILL",
      "cost": 26,
      "desc": "次に置く石を落雷石化。配置ターン即時と自ターン開始時に盤面上のランダムな敵石を1個破壊する。5ターン持続。反転保護を持つ特殊石。"
    },
    {
      "id": "udg_01",
      "name": "究極破壊神",
      "type": "ULTIMATE_DESTROY_GOD",
      "cost": 25,
      "desc": "次に置く石を破壊神化。置いた時と自ターン開始時に周囲1マス（8方向）の敵石を破壊。5ターン持続。"
    },
    {
      "id": "ultimate_hyperactive_01",
      "name": "究極多動神",
      "type": "ULTIMATE_HYPERACTIVE_GOD",
      "cost": 28,
      "desc": "次に置く石を究極多動神化。両者ターン開始時に直線1〜5マス移動を2回行い、2マス以上は途中の石を飛び越える。移動後に挟めば反転。反転対象時はマス移動で回避し、最大5回まで。移動先が無いと消滅。特殊石として扱われ、10ターン後は自己消滅する。"
    },
    {
      "id": "board_expand_01",
      "name": "盤面拡張",
      "type": "BOARD_EXPANSION_WILL",
      "cost": 19,
      "desc": "盤面の左右どちらか外側に1マスを追加する。追加位置は左右端マスから選ぶ。1対局で1回のみ使用可能。"
    },
    {
      "id": "board_expand_god_01",
      "name": "盤面拡張神",
      "type": "BOARD_EXPANSION_GOD",
      "cost": 27,
      "desc": "初期8x8の角マスを2つ選び、その外側6マス（各角3マスずつ、直交2方向+斜め）に拡張セルを同時追加する。"
    },
    {
      "id": "blockade_01",
      "name": "封鎖の意志",
      "type": "BLOCKADE_WILL",
      "cost": 1,
      "desc": "盤面の空きマス1つを封鎖し、3ターンの間は両者とも配置・移動で入れない。"
    },
    {
      "id": "meteor_01",
      "name": "隕石",
      "type": "METEOR_WILL",
      "cost": 21,
      "desc": "盤面上のマスを1つ選び、石ごとマスを破壊して穴にする。穴は永続し、誰も配置できず反転経路も遮断する。守る意志・守護神の完全保護も貫通する。"
    },
    {
      "id": "observer_01",
      "name": "盤理の観測者",
      "type": "OBSERVER_WILL",
      "cost": 1,
      "desc": "次に置く石を観測者石化。所有者ターン開始時に30%で発動し、布石を1〜5獲得。5ターン持続。"
    }
  ]
};
