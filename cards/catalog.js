// Auto-loaded card catalog for browser usage.
// Source of truth: `cards/catalog.json`
// Keep in sync with SharedConstants/CARD_DEFS.

window.CardCatalog = {
  "version": 1,
  "cards": [
    {
      "id": "free_01",
      "name": "自由の意志",
      "type": "FREE_PLACEMENT",
      "cost": 2,
      "desc": "反転0でも空きマスに置ける。"
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
      "cost": 5,
      "desc": "次に置く石を相手石1つと入れ替えて置ける。"
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
      "cost": 12,
      "desc": "次に置く石は以後ずっと反転されない。"
    },
    {
      "id": "strong_wind_01",
      "name": "強風の意志",
      "type": "STRONG_WIND_WILL",
      "cost": 11,
      "desc": "盤面の石1つを選び、進める上下左右のいずれかへランダムに端まで飛ばす。"
    },
    {
      "id": "inherit_01",
      "name": "意志の継承",
      "type": "INHERIT_WILL",
      "cost": 14,
      "desc": "自分の通常石1つを強い意志にする。"
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
      "desc": "この手で起きた通常反転を起点に、追加反転を1方向だけ行う。"
    },
    {
      "id": "regen_01",
      "name": "復活の意志",
      "type": "REGEN_WILL",
      "cost": 15,
      "desc": "次に置く石は1回だけ再生。反転されたら元色に戻り、そこから挟める列を反転する。"
    },
    {
      "id": "destroy_01",
      "name": "破壊神",
      "type": "DESTROY_ONE_STONE",
      "cost": 10,
      "desc": "盤上の石1つを破壊する。"
    },
    {
      "id": "bomb_01",
      "name": "時限爆弾",
      "type": "TIME_BOMB",
      "cost": 13,
      "desc": "次に置く石を時限爆弾化。3ターン後に周囲9マスを破壊。反転されると解除。"
    },
    {
      "id": "udr_01",
      "name": "究極反転龍",
      "type": "ULTIMATE_REVERSE_DRAGON",
      "cost": 30,
      "desc": "次に置く石を龍化。置いた時と自ターン開始時に周囲8マスを反転。5ターン持続。"
    },
    {
      "id": "breeding_01",
      "name": "繁殖の意志",
      "type": "BREEDING_WILL",
      "cost": 16,
      "desc": "次に置く石を繁殖化。置いた時と自ターン開始時に周囲へ1石生成し、挟めば反転。3ターン持続。"
    },
    {
      "id": "cross_bomb_01",
      "name": "十字爆弾",
      "type": "CROSS_BOMB",
      "cost": 18,
      "desc": "次に置く石を十字爆弾化。通常反転後に即起爆し、中心と縦横1マスの石を破壊する。"
    },
    {
      "id": "hyperactive_01",
      "name": "多動の意志",
      "type": "HYPERACTIVE_WILL",
      "cost": 8,
      "desc": "次に置く石を多動化。両者のターン開始時に周囲の空きへ1マス移動し、挟めば反転。"
    },
    {
      "id": "sell_01",
      "name": "売却の意志",
      "type": "SELL_CARD_WILL",
      "cost": 8,
      "desc": "使用後、手札から1枚を売却し、そのカードのコスト分だけ布石を得る。"
    },
    {
      "id": "plunder_will",
      "name": "吸収の意志",
      "type": "PLUNDER_WILL",
      "cost": 4,
      "desc": "次の反転枚数だけ相手の布石を奪う。"
    },
    {
      "id": "work_01",
      "name": "出稼ぎの意志",
      "type": "WORK_WILL",
      "cost": 9,
      "desc": "次の配置石をアンカー化。自ターン開始時に1→2→4→8→16の順でチャージ獲得（最大30）。失うと終了。"
    },
    {
      "id": "double_01",
      "name": "二連投石",
      "type": "DOUBLE_PLACE",
      "cost": 27,
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
      "name": "略奪の意志",
      "type": "STEAL_CARD",
      "cost": 7,
      "desc": "反転枚数ぶん相手のカードを奪う。"
    },
    {
      "id": "udg_01",
      "name": "究極破壊神",
      "type": "ULTIMATE_DESTROY_GOD",
      "cost": 25,
      "desc": "次に置く石を破壊神化。置いた時と自ターン開始時に周囲8マスの敵石を破壊。3ターン持続。"
    }
  ]
};
