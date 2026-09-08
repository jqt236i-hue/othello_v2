# 特殊石キャラクター三面図

白背景版28枚。1枚につき左から **正面・側面・背面**。

特殊石・顕現石の元画像に描かれたキャラクター23種類を25枚にまとめた。幽体石と意志狩りの王は本体の配色が異なるため黒白別。時計・罠・ツルハシの物体資料3枚も添付する。三方向の外観資料であり、厳密な寸法図ではない。

オセロ石の台座・円形背景・風景を除去。白は画像の背景色として残っているため、**透過PNGではない**。当初依頼の完全な背景透過は未対応。

## 画像一覧

| 名前 | 画像 | 対応 |
| --- | --- | --- |
| 狙撃石 | [三面図](三面図/sna.png) | 黒白共通 |
| 幽体石・黒 | [三面図](三面図/GHOST_WILL-black.png) | 色違い個別 |
| 幽体石・白 | [三面図](三面図/GHOST_WILL-white.png) | 色違い個別 |
| 屍石 | [三面図](三面図/ZOMBIE.png) | 黒白共通 |
| 破壊龍 | [三面図](三面図/DESTROY_DRAGON.png) | 黒白共通 |
| 意志狩りの王・黒 | [三面図](三面図/WILL_HUNTER_KING-black.png) | 色違い個別 |
| 意志狩りの王・白 | [三面図](三面図/WILL_HUNTER_KING-white.png) | 色違い個別 |
| 極悪多動魔 | [三面図](三面図/EXTREME_HYPERACTIVE_WILL.png) | 黒白共通 |
| 悪食石 | [三面図](三面図/GLUTTONOUS_WILL.png) | 黒白共通 |
| ロボット掃除機石 | [三面図](三面図/ROBOT_VACUUM_WILL.png) | 黒白共通 |
| 時間停神 | [三面図](三面図/TIME_STOP_DEITY.png) | 黒白共通 |
| 因果抹消神石 | [三面図](三面図/METEOR_GOD.png) | 黒白共通 |
| 救済神 | [三面図](三面図/STONE_SALVATION_GOD.png) | 黒白共通 |
| 究極多動神 | [三面図](三面図/ULTIMATE_HYPERACTIVE_GOD.png) | 黒白共通 |
| 盤界の執行者 | [三面図](三面図/board_executor.png) | 黒白共通 |
| 理論の化身 | [三面図](三面図/theory_incarnation.png) | 黒白共通 |
| 盤理の観測者 | [三面図](三面図/OBSERVER_WILL.png) | 黒白共通 |
| 繁殖石 | [三面図](三面図/BREEDING_WILL.png) | 黒白共通 |
| 犠牲石 | [三面図](三面図/SACRIFICE_WILL.png) | 黒白共通 |
| 多動石 | [三面図](三面図/HYPERACTIVE_WILL.png) | 黒白共通 |
| 逃亡石 | [三面図](三面図/ESCAPE_WILL.png) | 黒白共通 |
| 究極反転龍 | [三面図](三面図/ultimate_reverse_dragon.png) | 黒白共通 |
| 究極破壊神 | [三面図](三面図/ULTIMATE_DESTROY_GOD.png) | 黒白共通 |
| 究極労働神 | [三面図](三面図/ULTIMATE_WORK_GOD.png) | 黒白共通 |
| 増殖石 | [三面図](三面図/PROLIFERATION_WILL.png) | 黒白共通 |
| 時間停石 | [三面図](三面図/TIME_STOP.png) | 物体資料 |
| 罠石 | [三面図](三面図/trap_stone.png) | 物体資料 |
| 労働石 | [三面図](三面図/work_stone.png) | 物体資料 |

## 元画像の扱い

`../images/special-stones/` 直下の78ファイル（黒白をまとめた41種類）を照合。26種類に28枚の三面図を作成し、残る15種類は下表の理由でキャラクター三面図を作っていない。全ファイルの対応は [元画像対応表.json](元画像対応表.json) に記録した。

| 元画像 | 内容と扱い |
| --- | --- |
| protected_next_stone / gold_stone / silver.stone / rainbow_stone | 無地または材質だけの石。石を取り除くとキャラクターが残らない。 |
| perma_protect_next_stone / ZAN | 「強」「残」の文字表現。人物や生物の元絵がない。 |
| regen_stone | ハート記号。人物や生物の元絵がない。 |
| fire-will / water-will / grass-will / rakurai / SHINRA_BANSHO_GOD | 炎・水・草・雷の属性図案。独自の人物や怪物へ変更していない。 |
| TIME_BOMB / CROSS_BOMB / X_BOMB | 警告・斜線・十字の盤面マーク。爆弾キャラクターへ変更していない。 |

キャラクター設定メモに人物の説明があっても、その説明だけから元画像にない人物を新規デザインすることはしていない。CPU専用の肖像や手のスキンは今回の特殊石資料の対象外。

## 再現と補完

元画像の顔・体格・配色・衣装・特徴を参照し、背面・側面と隠れた下半身を最小限の推定で補完した。幽体などの霊体には脚を追加していない。線画のキャラクターは線画のまま。顕現石3体は `../images/special-cards/characters/` の大きい元画像も参照した。

単一方向の小さい元画像からの画像生成なので、背面、衣服の継ぎ目、装備の細部は推定を含む。元デザインとの完全一致や、三方向の厳密な立体整合性を保証する資料ではない。

内蔵画像生成を使用。生成・修正の指示は [生成指示.json](生成指示.json)。屍石は斜めになった側面を修正済み。

## 検証

生成結果を目視し、3方向の存在、元画像の特徴、オセロ台座と風景の除去、見切れを確認。保存PNG全28件の読み込み・寸法・ファイルハッシュを [画像検証.json](画像検証.json) に記録。

この資料はゲームから参照していない。ゲーム実装・既存アセット・通常配信は変更していない。

## 初期試作

このフォルダ直下の `SACRIFICE_WILL-black-three-views.png`、`SACRIFICE_WILL-black-three-views-alpha.png`、`sna-three-views.png` は、透過指示が市松模様として描かれた初期試作。完成版は必ず `三面図/` を使う。
