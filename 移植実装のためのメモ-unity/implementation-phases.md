# Unity 移植 実装フェーズ

この文書は、Unity/C# 版の実装順を固定するための作業分解です。正本は `scope.md` と `source-of-truth-map.md` に従う。

## Phase 0: Project Foundation

- Unity project を作成する。
- `GameCore` assembly を Unity API 非依存にする。
- `UnityPresentation` assembly を View / Animation / Audio 用に分ける。
- `Data` assembly に catalog / constants / asset map / save data を置く。
- `cards/catalog.json` を読み込む importer を用意する。
- `GameCore` から `MonoBehaviour`, `GameObject`, `Transform`, `Coroutine`, `Time.deltaTime`, `UnityEngine.Random` を参照しないことを確認する。

完了条件:

- `GameCore` の単体テストが Unity scene なしで実行できる。
- `cards/catalog.json` 87件、有効81件、`enabled:false` 6件を読み込める。

## Phase 1: Pure Reversi Core

- `MatchState`, `BoardState`, `CellState`, `StoneState`, `PlayerState` を実装する。
- ベース盤面サイズ `4..10` を実装する。
- 標準 `8x8`、偶数サイズ、`7x7`、その他奇数サイズの初期配置を実装する。
- 合法手判定、配置、通常反転、パス、終局、勝敗判定を実装する。
- 数字マスを無効化した通常リバーシ進行を実装する。

完了条件:

- リバーシモードでカード・デッキ・手札・布石・数字マス・特殊石・カード由来効果が無効になる。
- 黒=人間、白=CPU のリバーシモードが終局できる。

## Phase 2: Command and Presentation Pipeline

- `GameCommand` を実装する。
- `MatchState + GameCommand + DeterministicRng + Catalog/Constants -> MatchResult` の処理形にする。
- `PresentationEvent` を実装する。
- Unity の board / hand / result view は `PresentationEvent[]` を順番に再生する。
- アニメーション完了でゲーム結果を変えない。

完了条件:

- UI と CPU が同じ `GameCommand` 経路で着手できる。
- GameCore が Animator / Audio / Particle を直接触らない。

## Phase 3: Deck, Hand, Charge

- デフォルトデッキを、有効カード ID から重複なし30種で生成する。
- 黒白のデフォルトデッキ内容は共通、山札順は別シャッフルにする。
- 初期手札0枚、手札上限5枚、5枚時の通常ドロー失敗を実装する。
- 布石、カード cost 支払い、捨て札、手札破壊を実装する。
- `enabled:false` 6件を通常山札から除外する。

完了条件:

- 固定 seed でデッキ内容と draw が再現できる。
- 手札/山札/捨て札/布石が GameCore の正本として保持される。

## Phase 4: Immediate Cards

優先して実装する即時解決カード:

- `TREASURE_BOX`
- `CORNER_TRIBUTE`
- `RIBO_WILL`
- `EQUALITY_WILL`
- `REINFORCEMENT_WILL`
- `REBUILD_WILL`
- `REVEAL_HAND_WILL`
- `EXECUTION_WILL`
- `SUPPLY_WILL`
- `LOSS_WILL`
- `SALVATION_WILL`
- `FATE_WILL`

即時副作用と後続配置を併せ持つカード:

- `GLUTTONOUS_WILL`: 使用時に残り手札を破壊し、次配置で悪食石化する。
- `TIME_STOP_GOD`: 通常プレイでは手札に入った時点で即時破壊される。配置型として残った場合だけ時間停石 marker を扱う。

完了条件:

- 使用条件、cost、手札更新、布石更新、盤面更新、`PresentationEvent` が一致する。
- `TREASURE_BOX` は deterministic RNG がない場合に成功扱いにしない。
- 即時副作用と次配置 pending / marker を同じ処理で混ぜず、canonical state に分けて残す。

## Phase 5: Pending Selection Cards

- `PendingSelection` を canonical state に保持する。
- pending selection registry 33種類を実装する。
- `continue_turn`, `end_turn`, `multi_stage`, `hand_overlay` を区別する。
- `dispatchKey` と target resolver を `turn-sequence-contract.md` の表に合わせる。
- `HEAVEN_BLESSING` と `CONDEMN_WILL` は hand / candidate overlay として扱う。

完了条件:

- 対象候補が最低必要数に満たないカードは使用不可になる。
- CPU も pending selection を経由して対象を選ぶ。

## Phase 6: Placement, Markers, Special Stones

- 次配置 pending / armed state を実装する。
- `PENDING_TYPE_TO_EFFECT_KEY` 相当の visual map を実装する。
- 特殊石は配置直後から最終見た目を出す。
- 持続ターン、反転回避、破壊回避、復活、救済神、凍結、封鎖、種を実装する。
- `BoardOps.runEffectBlock()` 相当の effect block を実装する。

完了条件:

- 破壊+穴化、救済神、spawn、destroy の順序が `turn-sequence-contract.md` と一致する。
- `effectBlockId` は表示メタデータとして扱われ、ゲーム結果の正本にならない。

## Phase 7: Advanced Board Effects

- 盤面拡張、盤面拡張神を実装する。
- 盤面縮小、盤面縮小神を実装する。
- 隕石、マステレポート、穴化、外側フレーム表現を実装する。
- 浮力、重力、超浮力、超重力、超引力、強風、テレポート、入替を実装する。

完了条件:

- 盤面形状、穴、拡張セル、移動経路破壊、対象選択段階が一致する。

## Phase 8: CPU

- CPU Lv1-Lv6 の基本方針を実装する。
- 標準 `8x8` 以外では、`8x8` 専用の policy-table / ONNX / pending 対象選択経路を使わず、安全な通常判断へ切り替える。
- Lv6 は共有 profile 方針と fallback 方針を明示する。
- CPU 発話を実装する場合は固定文方式にする。

完了条件:

- CPU 対戦が固定 seed でクラッシュせず終局する。
- CPU が GameCore 状態を直接破壊しない。

## Phase 9: Animation, Audio, Result

- `asset-map.md` の visual / sound / animation 対応を実装する。
- 専用演出 profile を汎用演出に潰さない。
- CPU 対戦リザルトで観測石獲得とローカル所持数更新を実装する。
- ランキング送信、ランキング表示、ガチャ消費導線は実装しない。

完了条件:

- `test-scenarios.md` のシナリオを通せる。
- `parity-checklist.md` の完了判定を満たす。
