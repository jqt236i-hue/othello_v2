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
      "desc_ja": "使用時に布石を1〜3ランダムで獲得する。"
    },
    {
      "id": "free_01",
      "name_ja": "自由の意志",
      "type": "FREE_PLACEMENT",
      "cost": 2,
      "desc_ja": "反転0でも空きマスに置ける。"
    },
    {
      "id": "hard_01",
      "name_ja": "弱い意志",
      "type": "PROTECTED_NEXT_STONE",
      "cost": 1,
      "desc_ja": "次に置く石は次の相手ターン中だけ反転されない。"
    },
    {
      "id": "swap_01",
      "name_ja": "交換の意志",
      "type": "SWAP_WITH_ENEMY",
      "cost": 5,
      "desc_ja": "次に置く石を相手石1つと入れ替えて置ける。"
    },
    {
      "id": "sacrifice_01",
      "name_ja": "生贄の意志",
      "type": "SACRIFICE_WILL",
      "cost": 5,
      "desc_ja": "自分の石を最大3個まで破壊し、1個につき布石+5。"
    },
    {
      "id": "perma_01",
      "name_ja": "強い意志",
      "type": "PERMA_PROTECT_NEXT_STONE",
      "cost": 12,
      "desc_ja": "次に置く石は以後ずっと反転されない。"
    },
    {
      "id": "strong_wind_01",
      "name_ja": "強風の意志",
      "type": "STRONG_WIND_WILL",
      "cost": 9,
      "desc_ja": "盤面の石1つを選び、最も長く進める上下左右方向へ飛ばす（同距離はランダム）。移動したマス数ぶん布石を得る。"
    },
    {
      "id": "inherit_01",
      "name_ja": "意志の継承",
      "type": "INHERIT_WILL",
      "cost": 12,
      "desc_ja": "自分の通常石1つを強い意志にする。"
    },
    {
      "id": "trap_01",
      "name_ja": "罠の意志",
      "type": "TRAP_WILL",
      "cost": 14,
      "desc_ja": "自分の石1つを罠石化。次の相手ターン中に反転されると相手の布石全没収+手札3枚没収。"
    },
    {
      "id": "tempt_01",
      "name_ja": "誘惑の意志",
      "type": "TEMPT_WILL",
      "cost": 20,
      "desc_ja": "相手の特殊石1つを自分の石にする（残りターン等は維持）。対象が無いと使えない。"
    },
    {
      "id": "chain_01",
      "name_ja": "連鎖の意志",
      "type": "CHAIN_WILL",
      "cost": 22,
      "desc_ja": "この手で起きた通常反転を起点に、追加反転を最大2回まで行う。"
    },
    {
      "id": "regen_01",
      "name_ja": "復活の意志",
      "type": "REGEN_WILL",
      "cost": 15,
      "desc_ja": "次に置く石は1回だけ再生。反転されたら元色に戻り、そこから挟める列を反転する。"
    },
    {
      "id": "destroy_01",
      "name_ja": "破壊神",
      "type": "DESTROY_ONE_STONE",
      "cost": 10,
      "desc_ja": "盤上の石1つを破壊する。"
    },
    {
      "id": "bomb_01",
      "name_ja": "時限爆弾",
      "type": "TIME_BOMB",
      "cost": 13,
      "desc_ja": "盤面上の自分の石1つを時限爆弾化。3ターン後に周囲9マスを破壊。反転されると解除。"
    },
    {
      "id": "udr_01",
      "name_ja": "究極反転龍",
      "type": "ULTIMATE_REVERSE_DRAGON",
      "cost": 30,
      "desc_ja": "次に置く石を龍化。置いた時と自ターン開始時に周囲8マスを反転。5ターン持続。"
    },
    {
      "id": "breeding_01",
      "name_ja": "繁殖の意志",
      "type": "BREEDING_WILL",
      "cost": 16,
      "desc_ja": "次に置く石を繁殖化。置いた時と自ターン開始時に周囲8マスへランダム1個生成。以後は前回生成石の周囲へ拡散。挟めば反転。生成石が反転された場合は親石起点に戻る。3ターン持続。"
    },
    {
      "id": "cross_bomb_01",
      "name_ja": "十字爆弾",
      "type": "CROSS_BOMB",
      "cost": 18,
      "desc_ja": "次に置く石を十字爆弾化。通常反転後に即起爆し、中心と縦横1マスの石を破壊する。"
    },
    {
      "id": "hyperactive_01",
      "name_ja": "多動の意志",
      "type": "HYPERACTIVE_WILL",
      "cost": 8,
      "desc_ja": "次に置く石を多動化。両者のターン開始時に周囲の空きへ1マス移動し、挟めば反転。"
    },
    {
      "id": "sell_01",
      "name_ja": "売却の意志",
      "type": "SELL_CARD_WILL",
      "cost": 8,
      "desc_ja": "使用後、手札から1枚を売却し、そのカードのコスト分だけ布石を得る。"
    },
    {
      "id": "plunder_will",
      "name_ja": "吸収の意志",
      "type": "PLUNDER_WILL",
      "cost": 4,
      "desc_ja": "次の反転枚数だけ相手の布石を奪う。"
    },
    {
      "id": "work_01",
      "name_ja": "出稼ぎの意志",
      "type": "WORK_WILL",
      "cost": 11,
      "desc_ja": "次の配置石をアンカー化。自ターン開始時に1→2→4→8→16の順でチャージ獲得（最大30）。失うと終了。"
    },
    {
      "id": "double_01",
      "name_ja": "二連投石",
      "type": "DOUBLE_PLACE",
      "cost": 24,
      "desc_ja": "このターンは石を2回置ける。"
    },
    {
      "id": "heaven_01",
      "name_ja": "天の恵み",
      "type": "HEAVEN_BLESSING",
      "cost": 3,
      "desc_ja": "ランダムな候補5枚から1枚を選んで獲得する。"
    },
    {
      "id": "condemn_01",
      "name_ja": "断罪の意志",
      "type": "CONDEMN_WILL",
      "cost": 6,
      "desc_ja": "相手手札を公開し、1枚選んで破壊する。"
    },
    {
      "id": "gold_stone",
      "name_ja": "金の意志",
      "type": "GOLD_STONE",
      "cost": 6,
      "desc_ja": "次の反転で得る布石を4倍にする。使用後その石は消滅。"
    },
    {
      "id": "silver_stone",
      "name_ja": "銀の意志",
      "type": "SILVER_STONE",
      "cost": 3,
      "desc_ja": "次の反転で得る布石を3倍にする。使用後その石は消滅。"
    },
    {
      "id": "steal_card_01",
      "name_ja": "略奪の意志",
      "type": "STEAL_CARD",
      "cost": 7,
      "desc_ja": "反転枚数ぶん相手の手札を奪う。手札上限超過分は自分のデッキに入る。"
    },
    {
      "id": "guard_01",
      "name_ja": "守る意志",
      "type": "GUARD_WILL",
      "cost": 7,
      "desc_ja": "自分の石1つに完全保護を付与する。3ターン持続。"
    },
    {
      "id": "udg_01",
      "name_ja": "究極破壊神",
      "type": "ULTIMATE_DESTROY_GOD",
      "cost": 25,
      "desc_ja": "次に置く石を破壊神化。置いた時と自ターン開始時に周囲8マスの敵石を破壊。5ターン持続。"
    },
    {
      "id": "ultimate_hyperactive_01",
      "name_ja": "究極多動神",
      "type": "ULTIMATE_HYPERACTIVE_GOD",
      "cost": 28,
      "desc_ja": "次に置く石を究極多動神化。両者ターン開始時に1マス移動を2回行い、着地隣接の敵石を最大2マス吹き飛ばす。成功1回ごとに布石+2。"
    }
  ]
};
