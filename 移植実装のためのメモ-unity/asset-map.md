# Unity 移植 Asset Map

この文書は、JS 版の visual / animation / sound 参照を Unity 側 asset に対応させるための作業表です。Unity Asset 欄の `移植時に割当` は、Unity project 作成時に Prefab / Sprite / AudioClip / Animator 名を決める欄であり、JS 版正本の未確定を意味しません。

## 正本

- 石画像: `game/visual-effects-map.runtime.js`, `01-rulebook.md` section 12
- 専用演出 profile: `shared/presentation-effect-profiles.ts`
- 再生実装: `ui/animation-engine.ts`, `game/turn/pipeline_ui_adapter.ts`
- 音声仕様: `01-rulebook.md` section 12.15

## 基本画像

| 用途 | JS 側参照 | Unity Asset | 備考 |
| --- | --- | --- | --- |
| 黒通常石 | `assets/images/stones/normal_stone-black.png` | 移植時に割当 | 通常石 |
| 白通常石 | `assets/images/stones/normal_stone-white.png` | 移植時に割当 | 通常石 |
| 穴マス | `assets/images/other/aaa.png` | 移植時に割当 | 隕石など通常の穴 |
| 凍結 overlay | `assets/images/other/ICE.png` | 移植時に割当 | 半透明 overlay、残りターン表示 |
| 勇者の手 | `assets/images/hand-skin/勇者の手.png` | 移植時に割当 | 初期所持 hand skin |
| CPU Lv1/Lv2 手 | `assets/images/hand-skin/lv1-2.png` | 移植時に割当 | CPU 固定手画像 |
| CPU Lv3/Lv5 手 | `assets/images/hand-skin/lv3-5.png` | 移植時に割当 | CPU 固定手画像 |
| CPU Lv4 手 | `assets/images/hand-skin/lv4.png` | 移植時に割当 | CPU 固定手画像 |
| CPU Lv6 手 | `assets/images/hand-skin/lv6.png` | 移植時に割当 | CPU 固定手画像 |

## 盤面石 Visual Key

この表は、狭義の特殊石だけでなく、爆弾・配置時効果石・隠し罠のように盤面石として専用見た目または専用 key を使うものも含む。`PENDING_TYPE_TO_EFFECT_KEY` の完全対応に加えて、`ABSOLUTE_PROTECTED` や `CRYSTAL_STONE` のような marker-only / 補足 visual 参照も載せている。`01-rulebook.md` の「特殊石」定義とは一致しないため、分類判断は rulebook を優先する。

| card / marker | visual key | JS image reference | Unity Asset | 備考 |
| --- | --- | --- | --- | --- |
| `PROTECTED_NEXT_STONE` / `PROTECTED` | protectedStoneTemporary | `protected_next_stone.png` | 移植時に割当 | 一時保護 |
| `PERMA_PROTECT_NEXT_STONE` / `PERMA_PROTECTED` | protectedStone | `perma_protect_next_stone-*.png` | 移植時に割当 | 永続反転保護 |
| `ABSOLUTE_PROTECTED` | absoluteProtectedStone | `absolute_protect_next_stone-*.png` | 移植時に割当 | 強い意志の進化後 |
| `ULTIMATE_REVERSE_DRAGON` / `DRAGON` | ultimateDragon | `ultimate_reverse_dragon-*.png` | 移植時に割当 | 龍 |
| `BREEDING_WILL` / `BREEDING` | breedingStone | `BREEDING_WILL-*.png` | 移植時に割当 | spawn 系 |
| `PROLIFERATION_WILL` / `PROLIFERATION` | proliferationStone | `PROLIFERATION_WILL-*.png` | 移植時に割当 | 増殖 |
| `THEORY_INCARNATION` | theoryIncarnationStone | `theory_incarnation-*.png` | 移植時に割当 | 数字マス倍率を持つ特殊石 |
| `ULTIMATE_DESTROY_GOD` | ultimateDestroyGod | `ULTIMATE_DESTROY_GOD-*.png` | 移植時に割当 | 雷破壊 profile |
| `STONE_SALVATION_GOD` | stoneSalvationGod | `STONE_SALVATION_GOD-*.png` | 移植時に割当 | 救済神 |
| `SNIPER_WILL` / `SNIPER` | sniperStone | `sna-*.png` | 移植時に割当 | 狙撃弾演出 |
| `LIGHTNING_WILL` / `LIGHTNING` | lightningStone | `rakurai-*.png` | 移植時に割当 | 落雷演出 |
| `OBSERVER_WILL` / `OBSERVER` | observerStone | `OBSERVER_WILL-*.png` | 移植時に割当 | 吹き出し |
| `GHOST_WILL` / `GHOST` | ghostStone | `GHOST_WILL-*.png` | 移植時に割当 | 幽霊 |
| `AFTERIMAGE_WILL` | afterimageStone | `ZAN-*.png` | 移植時に割当 | 残像 |
| `WILL_HUNTER_KING` | willHunterKingStone | `WILL_HUNTER_KING-*.png` | 移植時に割当 | 斬撃 profile |
| `DESTROY_DRAGON_WILL` / `DESTROY_DRAGON` | destroyDragonStone | `DESTROY_DRAGON-*.png` | 移植時に割当 | ブレス profile |
| `HYPERACTIVE_WILL` / `HYPERACTIVE` | hyperactiveStone | `HYPERACTIVE_WILL-*.png` | 移植時に割当 | 多動 |
| `HYPERACTIVE_INHERIT_WILL` / `INHERITED_HYPERACTIVE` | hyperactiveStone | `HYPERACTIVE_WILL-*.png` | 移植時に割当 | 継承多動 |
| `INSTANT_HYPERACTIVE_WILL` | hyperactiveStone | `HYPERACTIVE_WILL-*.png` | 移植時に割当 | 瞬間多動 |
| `ESCAPE_WILL` / `ESCAPE_HYPERACTIVE` | escapeHyperactiveStone | `ESCAPE_WILL-*.png` | 移植時に割当 | 爆発 batch destroy |
| `EXTREME_HYPERACTIVE_WILL` | extremeHyperactiveStone | `EXTREME_HYPERACTIVE_WILL-*.png` | 移植時に割当 | 極悪多動魔 |
| `ROBOT_VACUUM_WILL` / `ROBOT_VACUUM` | robotVacuumStone | `ROBOT_VACUUM_WILL-*.png` | 移植時に割当 | 吸い込み profile |
| `GLUTTONOUS_WILL` / `GLUTTONOUS` | gluttonousStone | `GLUTTONOUS_WILL-*.png` | 移植時に割当 | 捕食+移動同一フェーズ |
| `ULTIMATE_HYPERACTIVE_GOD` | ultimateHyperactiveGod | `ULTIMATE_HYPERACTIVE_GOD-*.png` | 移植時に割当 | 究極多動 |
| `REGEN_WILL` / `REGEN` | regenStone | `regen_stone-*.png` | 移植時に割当 | 復活 |
| `WORK_WILL` | workStone | `work_stone-*.png` | 移植時に割当 | charge bubble |
| `TIME_BOMB` | timeBombStone | `TIME_BOMB-*.png` | 移植時に割当 | batch destroy |
| `TIME_STOP_GOD` / `TIME_STOP` | timeStopStone | `TIME_STOP-*.png` | 移植時に割当 | 通常プレイでは入手時破壊 |
| `X_BOMB` | xBombStone | `CROSS_BOMB-*.png` | 移植時に割当 | 斜め爆弾。現行JS実装での対応に合わせる |
| `CROSS_BOMB` | crossBombStone | `X_BOMB-*.png` | 移植時に割当 | 十字爆弾。現行JS実装での対応に合わせる |
| `TRAP_WILL` | trapStone | `trap_stone-*.png` | 移植時に割当 | 通常石として隠れている罠は特殊石一覧に含めない |
| `GOLD_STONE` | goldStone | `gold_stone.png` | 移植時に割当 | 布石倍率 |
| `SILVER_STONE` | silverStone | `silver.stone.png` | 移植時に割当 | 布石倍率 |
| `RAINBOW_STONE` | rainbowStone | `rainbow_stone.png` | 移植時に割当 | 布石倍率 |
| `CRYSTAL_STONE` | （pending/special への直接マップなし） | `crystal_stone.png` | 移植時に割当 | 現行仕様では石見た目を変更せず、数字マス倍率効果のみ |

## 専用 Animation Profile

| profile | cause / reason | Unity Animation | 備考 |
| --- | --- | --- | --- |
| sniperShot | `SNIPER_WILL` / `sniper_shot` | 移植時に割当 | 狙撃石から対象へ小球を飛ばして破壊 |
| lightningDestroyed | `LIGHTNING_WILL` / `lightning_destroyed` | 移植時に割当 | 対象マスへ落雷 |
| destroyDragonBreath | `DESTROY_DRAGON_WILL`, `DESTROY_DRAGON` / `destroy_dragon_breath` | 移植時に割当 | 発動元から対象へブレス |
| udgDestroyed | `ULTIMATE_DESTROY_GOD` / `udg_destroyed` | 移植時に割当 | 対象マスへ雷 |
| robotVacuumSuck | `ROBOT_VACUUM` / `robot_vacuum_suck` | 移植時に割当 | 吸い込み破壊 |
| gluttonousEat | `GLUTTONOUS_WILL` / `gluttonous_eat` | 移植時に割当 | 捕食破壊と進入移動を同一フェーズ |
| willHunterKingSlash | `WILL_HUNTER_KING` / `will_hunter_king_slash` | 移植時に割当 | 斬撃 |

## Spawn Highlight Profile

| spawnIntent | cause | reasonPrefix | Unity Animation | 備考 |
| --- | --- | --- | --- | --- |
| breeding_spawn | `BREEDING` | `breeding_spawn` | 移植時に割当 | 繁殖 |
| normal_spawn | `EQUALITY_WILL` | `equality_will_spawn` | 移植時に割当 | 平等 |
| normal_spawn | `REINFORCEMENT_WILL` | `reinforcement_will_spawn` | 移植時に割当 | 増援 |
| salvation_spawn | `SALVATION_WILL` | `salvation_spawn` | 移植時に割当 | 救済の意志 |
| salvation_spawn | `STONE_SALVATION_GOD` | `stone_salvation_god_revive` | 移植時に割当 | 救済神 |
| normal_spawn | `SEED_WILL` | `seed_sprout` | 移植時に割当 | 種の芽生え |
| clone_spawn | `CLONE_WILL` | `clone_spawn` | 移植時に割当 | 複製 |
| proliferation_spawn | `PROLIFERATION_WILL` | `proliferation_spawn` | 移植時に割当 | 増殖 |

## Sound Keys

ここでは初期移植で独自対応が必要な cue を優先して列挙する。完全な cue 一覧は `game/turn/pipeline-ui/sound-cues.ts`, `game/turn/pipeline-ui/core-sound-cues.ts`, `game/turn/pipeline-ui/destroy-sound-cues.ts`, `01-rulebook.md` section 12.15 を参照する。

| key | JS file / rulebook reference | Unity AudioClip | 備考 |
| --- | --- | --- | --- |
| `stone_place` | `assets/audio/sound-effect-skin/default.mp3` | 移植時に割当 | SE 音量に対して 0.75 倍 |
| `card_use_button` | `カード使用ボタンを押したタイミング.mp3` | 移植時に割当 | 宝箱でもカード使用 phase で再生し、その直後に `treasure_gain` を続ける |
| `hand_card_select` | `手札のカードを選択したタイミング.mp3` | 移植時に割当 | 基本再生倍率からさらに 0.5 倍 |
| `card_effect_flip` | `カード効果で石が反転したタイミング.mp3` | 移植時に割当 | 龍/連鎖/復活/交換/誘惑など |
| `hand_remove` | pipeline playback event | 移植時に割当 | 手札破壊 fade out |
| `treasure_gain` | pipeline cue | 移植時に割当 | 宝箱の布石獲得。天の恵みの確定音でも使う |
| `breeding_spawn` | pipeline cue | 移植時に割当 | spawn 系 |
| `seed_sprout` | pipeline cue | 移植時に割当 | 種の芽生え |
| `clone_spawn` | pipeline cue | 移植時に割当 | clone/proliferation 系 |
| `robot_vacuum_suck` | pipeline cue | 移植時に割当 | 吸い込み |
| `gluttonous_eat` | pipeline cue | 移植時に割当 | 捕食 |
| `sniper_shot` | pipeline cue | 移植時に割当 | 狙撃 |
| `destroy_dragon_breath` | pipeline cue | 移植時に割当 | ブレス |

## BGM

| 用途 | JS path | Unity AudioClip | 備考 |
| --- | --- | --- | --- |
| 既定 BGM | `assets/audio/bgm/The Observer’s Tears.mp3` | 移植時に割当 | 115 BPM、112拍ぶん loop |
| BGM 候補 | `assets/audio/bgm/c-reversi.mp3` | 移植時に割当 | 選択一覧 |
| BGM 候補 | `assets/audio/bgm/c-reversi-2.mp3` | 移植時に割当 | 選択一覧 |
| BGM 候補 | `assets/audio/bgm/盤喰いの小鬼戦.mp3` | 移植時に割当 | `loopStart = 1.655` |
| BGM 候補 | `assets/audio/bgm/幻想即興曲.mp3` | 移植時に割当 | 選択一覧 |
| BGM 候補 | `assets/audio/bgm/ノクターン.mp3` | 移植時に割当 | 選択一覧 |
