# Unity 移植 Source of Truth Map

Unity/C# 版は、既存 root 実装を正本として移植する。`worker-public/`、`dist/`、生成済み mirror は正本にしない。

## 優先順位

グローバルな優先順位:

1. `01-rulebook.md`
2. `docs/architecture-contracts.md`
3. root 実装
4. 生成物ではない補助 docs

カード名、type、cost、説明、enabled は局所正本として `cards/catalog.json` を優先する。矛盾した場合は、まず `01-rulebook.md` と `cards/catalog.json` を確認する。仕様変更が必要な場合は、Unity 側だけで判断せず、正本の更新方針を決めてから実装する。

## 対応表

| 領域 | JS 版の正本 | Unity 側の想定 |
| --- | --- | --- |
| ゲーム仕様 | `01-rulebook.md` | `GameRules` / rules docs |
| アーキテクチャ境界 | `docs/architecture-contracts.md` | GameCore と UnityPresentation の分離 |
| 盤面サイズ/初期配置/数字マス | `01-rulebook.md` section 3 | `BoardSetupService` |
| デフォルトデッキ | `01-rulebook.md` section 4, `cards/catalog.json` | `DeckFactory` |
| 初期手札/手札上限/通常ドロー | `01-rulebook.md` section 4 | `HandManager` |
| カード一覧 | `cards/catalog.json` | `CardCatalog` / importer |
| カード表示文 / 補助タグ | `cards/catalog.json`, `cards/card-interaction-effects.ts` | Card detail UI |
| カード使用前チェック | `game/logic/cards-internal/card-usage-prechecks.ts`, `game/logic/cards-internal/hand-manager.ts` | `CardUsageValidator` |
| カード効果 | `game/logic/cards.ts`, `game/logic/cards-internal/*`, `game/card-effects/*` | `CardEffectResolver` |
| 対象選択 | `game/logic/cards-internal/pending-selection-registry.ts` | `PendingSelectionRegistry` |
| ターン進行 | `game/turn/*`, `game/turn-manager.ts`, `game/move-executor.ts` | `TurnPipeline` |
| 盤面操作 | `game/logic/board_ops.ts` | `BoardOps` |
| 所有者/色正規化 | `utils/owner-helpers.ts`, `shared/player-encoding.ts` | `PlayerCodec` / `OwnerNormalizer` |
| 表示イベント | `game/turn/pipeline_ui_adapter.ts`, `shared/presentation-effect-profiles.ts` | `PresentationEvent` |
| 演出再生 | `ui/animation-engine.ts` | `AnimationPlayback` |
| 特殊石見た目 | `game/visual-effects-map.runtime.js` | Prefab / Sprite / Material map |
| CPU 判断 | `game/cpu-decision.ts`, `game/cpu-turn-handler.ts`, `game/ai/*` | `CpuDecisionEngine` |
| CPU 共有 profile / Lv6 方針 | `constants/cpu-lv6-shared-profile.ts`, `game/ai/*`, `01-rulebook.md` section 14 | `CpuPolicyProfile` |
| CPU 発話 | `game/ai/commentary-data.ts`, `01-rulebook.md` section 14.6 | `CpuCommentaryCatalog` |
| 定数 | `constants/*`, `shared-constants.ts` | `GameConstants` |
| 画面/音/演出仕様 | `01-rulebook.md` section 12+ | Unity scene / prefab / audio map |
| リバーシモード | `01-rulebook.md` section 12.13 | カード系ルールを無効にする local CPU mode |
| リザルト/観測石 | `01-rulebook.md` section 12.16, `ui/result-overlay.ts`, `ui/storage/gacha-progress.ts` | `ResultPresenter` / local currency store |

## 初期移植で正本にしないもの

| 対象 | 理由 |
| --- | --- |
| `worker-public/` | mirror。root から生成される deploy surface。 |
| `dist/` | 生成物。 |
| `public/module-registry.js` | generator 由来。 |
| network Worker 専用処理 | 初期 Unity 移植ではオンライン対戦を実装しないため。 |
| `ui/network/*`, `workers/*`, `utils/match-authority.ts` の通信処理 | オンライン対戦を実装しないため。ただし将来のコマンド/状態分離の参考にする。 |
| `ui/gacha/*` | ガチャを実装しないため。 |
| デッキ構築 UI / deck code 入出力 | デッキ作成機能を実装しないため。 |
| 共有ランキング / ローカルランキング送信 | ランキングを実装しないため。 |
| 観測ガチャの消費/排出/所持済み処理 | ガチャを実装しないため。CPU リザルトの観測石獲得表示とは分ける。 |
| ストーリー UI / story deck / story progression | ストーリーを実装しないため。ルール説明やチュートリアル相当の確認導線は別途実装対象。 |
| training/selfplay 長時間実行結果 | 初期移植の正本ではなく、CPU 調整時の参考。 |

## Unity 側で再定義してよいもの

- 画面遷移の見た目
- Prefab 構成
- Animator Controller 構成
- Particle / SE 実装
- 入力デバイスごとの操作導線
- 内部 C# class 名

ただし、ゲーム結果、カード効果、ターン順、対象選択条件、表示イベント順序は JS 版と一致させる。

## 正本更新が必要な場合

Unity 移植中に JS 実装と docs の矛盾を見つけた場合は、次の順で扱う。

1. `01-rulebook.md` と `cards/catalog.json` の記述を確認する。
2. root 実装が正本 docs と違う場合、Unity 側で独自判断せず、どちらを採用するかを記録する。
3. カード名、コスト、説明、enabled の矛盾は `cards/catalog.json` を正とする。
4. ゲーム結果や表示タイミングの矛盾は `01-rulebook.md` を先に更新対象として扱う。
5. Unity メモは、正本の差分を置き換える場所ではなく、移植実装の参照地図として更新する。
