# Unity 移植 Card Behavior Contract

この文書は、Unity/C# 版でカード挙動を移植するための契約である。詳細な個別事実は `docs/card-behavior-animation-facts.md` と `cards/catalog.json` を参照する。

## 正本

- カード名、type、cost、説明、enabled: `cards/catalog.json`
- ルール説明: `01-rulebook.md`
- 使用前チェック: `game/logic/cards-internal/card-usage-prechecks.ts`, `game/logic/cards-internal/hand-manager.ts`
- 対象選択: `game/logic/cards-internal/pending-selection-registry.ts`
- 配置時効果: `game/logic/cards-internal/effect-timing.ts`
- 表示イベント: `game/turn/pipeline_ui_adapter.ts`, `shared/presentation-effect-profiles.ts`
- 盤面石見た目 / 配置時 visual key: `game/visual-effects-map.runtime.js`

## 実装分類

| 分類 | 内容 | 例 |
| --- | --- | --- |
| 即時解決 | 使用直後に効果が確定する | 宝箱、角の代償、リボ払い、補給、再構築 |
| 対象選択 | 使用後に盤面/手札/候補から対象を選ぶ | 破壊の意志、封鎖、盤面縮小、天の恵み |
| 次配置効果 | 次に置く石へ marker や特殊効果を付ける | 狙撃の意志、破壊龍、救済神、悪食の意志 |
| 反転後効果 | 通常反転後に派生する | 連鎖、吸収、金/銀/虹の意志 |
| 持続効果 | ターン開始/終了などで継続処理する | 多動、繁殖、救済神、出稼ぎ、観測者 |
| 盤面変形 | 盤面セル自体を変える | 盤面拡張、盤面縮小、隕石、マステレポート |

リバーシモードでは、この文書のカード効果はすべて無効にする。カード catalog は読み込んでもよいが、カード使用、手札、山札、布石、数字マス、特殊石、カード由来ターン開始効果へ接続しない。

## catalog の現状

- 総カード定義: 88 件
- 有効カード: 82 件
- `enabled:false`: 6 件
- `enabled:false` の type: `TRIPLE_CHAIN_WILL`, `QUAD_CHAIN_WILL`, `INFINITE_CHAIN_WILL`, `TRIPLE_PLACE`, `QUAD_PLACE`, `INFINITE_PLACE`
- `display_type_ja`: 採掘 / 禁忌 / 戦闘 / 守護 / 執行 / 殲滅 / 特殊 / 特殊石 / 繁栄 / 観測

`enabled:false` は通常山札に出さないが、二連鎖/二連投石などから続く定義としては実装対象に含める。

## CardEffectResolver の責務

- 使用条件を検証する。
- cost を支払えるか確認する。
- 即時効果を解決する。
- pending selection を作る。
- 次配置用 pending/armed state を作る。
- 盤面、手札、布石、marker を更新する。
- PresentationEvent を生成する。

CardEffectResolver は Unity の UI、Prefab、Audio を直接操作しない。

失敗時は診断できるエラーを返す。cost 不足、対象なし、RNG 未注入、catalog 不整合などを、成功形の silent fallback で隠さない。

## 使用条件

通常の cost 以外に、カードごとの条件を持つ。

例:

| type | 条件 |
| --- | --- |
| `LAST_RESORT` | 石数負けかつ合法手 0 |
| `EQUALITY_WILL` | 石数が 10 個以上負け |
| `REINFORCEMENT_WILL` | 増援配置できる対象が存在 |
| `CORNER_TRIBUTE` | 相手の占有角数が 4 以上 |
| `RIBO_WILL` | `turnIndex >= 19`（18手経過後） |
| `LOSS_WILL` | 完全保護されていない特殊石本体または爆弾が 1 つ以上存在 |
| `SALVATION_WILL` | 直前の相手ターンで救済対象の破壊石が存在 |
| `EXECUTION_WILL` | 直前の相手ターンで自石が破壊され、相手手札が 1 枚以上 |
| `HEAVEN_BLESSING` | 候補カードを 1 枚以上生成できる。候補数は最大 5 |
| `CONDEMN_WILL` | 相手手札から破壊候補を 1 枚以上生成できる |
| `REVEAL_HAND_WILL` | 相手手札が 1 枚以上 |
| pending selection 登録カード | target resolver が最低必要数以上の対象を返す |

## enabled:false の扱い

`cards/catalog.json` に存在しても `enabled:false` のカードは、通常の山札や手札に出さない。

ただし、連鎖や追加配置など、カード効果の連続定義として参照される場合は、定義自体を実装対象に含める。

## 盤面石 / 配置時見た目

狭義の特殊石は、次配置で盤面に出た直後から最終見た目を出す方針を維持する。

ただし、`TRAP_WILL` は例外で、発動/不発で公開される瞬間まで通常石見た目を保つ。`INSTANT_HYPERACTIVE_WILL`, `CROSS_BOMB`, `X_BOMB`, `GOLD_STONE`, `SILVER_STONE`, `RAINBOW_STONE` などは `01-rulebook.md` 上の「特殊石」ではないが、配置時効果として専用 visual key を使う。

Unity 側では以下を対応させる。

| JS 側 | Unity 側 |
| --- | --- |
| pending type | marker / specialType |
| board visual key | Prefab / Sprite / Material |
| presentation profile | Animation profile |

配置時 visual key を持つ pending type の完全一覧:

```text
PROTECTED_NEXT_STONE
PERMA_PROTECT_NEXT_STONE
ULTIMATE_REVERSE_DRAGON
BREEDING_WILL
PROLIFERATION_WILL
ULTIMATE_DESTROY_GOD
STONE_SALVATION_GOD
SNIPER_WILL
LIGHTNING_WILL
OBSERVER_WILL
THEORY_INCARNATION
GHOST_WILL
AFTERIMAGE_WILL
WILL_HUNTER_KING
DESTROY_DRAGON_WILL
ULTIMATE_HYPERACTIVE_GOD
HYPERACTIVE_WILL
HYPERACTIVE_INHERIT_WILL
EXTREME_HYPERACTIVE_WILL
ESCAPE_WILL
ROBOT_VACUUM_WILL
GLUTTONOUS_WILL
INSTANT_HYPERACTIVE_WILL
REGEN_WILL
GOLD_STONE
RAINBOW_STONE
SILVER_STONE
WORK_WILL
TIME_BOMB
TIME_STOP_GOD
CROSS_BOMB
X_BOMB
TRAP_WILL
```

完全な placement-time visual 対応は `game/visual-effects-map.runtime.js` の `PENDING_TYPE_TO_EFFECT_KEY` を正とする。`TRAP_WILL` はこの一覧に含まれるが、見た目公開タイミングは別扱いである。

## 救済神の注意

救済神は「自分の石だけを復活」ではない。

正しい仕様:

- 破壊された石を救済する。
- 救済された石は、救済した救済神の所有者の通常石として空きマスへ復活する。
- 両プレイヤーの救済神がいる場合は、破壊された石の元所有者側を優先する。
- 救済神自身は復活しない。
- 石破壊を伴わない穴化では発動しない。

## カード別実装表の推奨列

移植実装時は、別途カード一覧表をこの列で管理する。

```text
カード名
type
cost
enabled
使用条件
対象選択
即時効果
次配置効果
持続効果
破壊/生成/移動
PresentationEvent
盤面見た目
Unity 実装 class
確認状態
```

## 専用演出を持つ効果

Unity 側で汎用 destroy / spawn だけに潰さない効果:

- `SNIPER_WILL`: 狙撃石から対象へ小球を飛ばしてから破壊。
- `DESTROY_DRAGON_WILL`: 発動元から対象へブレスを表示してから破壊。
- `ULTIMATE_DESTROY_GOD` / `LIGHTNING_WILL`: 対象マスへ雷演出を表示してから破壊。
- `ROBOT_VACUUM_WILL`: 吸い込み破壊と cell clear を専用扱い。
- `GLUTTONOUS_WILL`: 捕食破壊と進入移動を同一フェーズで扱う。
- `WILL_HUNTER_KING`: 斬撃演出。
- spawn 系: `BREEDING`, `EQUALITY_WILL`, `REINFORCEMENT_WILL`, `SALVATION_WILL`, `STONE_SALVATION_GOD`, `SEED_WILL`, `CLONE_WILL`, `PROLIFERATION_WILL`。
- batch destroy 系: `TIME_BOMB`, `CROSS_BOMB`, `X_BOMB`, `ESCAPE_HYPERACTIVE`。
- 移動系: `BUOYANCY_WILL`, `SUPER_BUOYANCY_WILL`, `GRAVITY_WILL`, `SUPER_GRAVITY_WILL`, `SUPER_ATTRACTION_WILL`。
- 吹き出し系: `OBSERVER_WILL`, `WORK_WILL`。

## 初期実装の優先順

1. cost と手札操作だけで閉じるカード
2. 通常配置/反転に関わるカード
3. 対象選択カード
4. 盤面石 marker / visual key を持つカード
5. 破壊/復活/生成/移動を伴うカード
6. 盤面拡張/縮小
7. 複数段階 selection と disabled 連続カード
