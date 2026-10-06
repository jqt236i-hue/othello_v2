# カード・通信の保守参照

カード変更や通信調査で、関連実装と検証先を見つけるための索引です。ゲーム仕様は [01-rulebook.md](../01-rulebook.md)、内部契約は [architecture-contracts.md](architecture-contracts.md) が正本です。この資料は必須の作業順序や全項目の実行を定めません。

## カードの調査先

| 関心事 | 調査の入口 | 関連する契約・知識 |
| --- | --- | --- |
| ID・表示名・コスト・有効化 | `cards/catalog.json`, `src/types/card.ts`, `shared/deck-spec.ts` | 保存デッキ・snapshot が使う ID と画面の表示名は別。無効化と ID 削除では互換性への影響が異なる。 |
| 説明・タグ・画像 | `ui/handlers/rules-help.ts`, `cards/card-interaction-effects.ts`, `cards/card-last-used-panel-copy.ts` | 日本語名が画像ファイル名や生成される画像対応表にも使われる。 |
| カード使用の各段階 | `game/cards/effect-resolver.ts`, `game/cards/card-usage-validation-stage.ts`, `game/cards/card-usage-consumption-stage.ts`, `game/cards/card-usage-pending-stage.ts` | 設計資料 §7.1。呼び出し元から即時効果と presentation の担当も追える。 |
| 効果・対象判定 | `game/logic/cards.ts`, `game/cards/target-resolver.ts` | 設計資料 §6.5–6.6、§10。保護・回避・復活によって低水準操作の成否と最終結果が異なる場合がある。 |
| 盤面形状・穴・拡張 | `shared/board/state-kernel.ts`, `shared/board/topology.ts` | 設計資料 §6.1.1。 |
| 対象選択・複数段階・ターン移行 | `game/logic/cards-internal/pending-selection-registry.ts`, `game/turn/pending-coordinator.ts` | 設計資料 §6.3、§7.2.1–7.2.2。 |
| カード使用後の対象選択の開始（ブラウザ） | `cards/card-interaction.ts` の `_ensureBoardPendingSelectionAfterCardUse` | pending の正本は headless 側。UI は pipeline の結果にある pending へ ID を同期するだけで、カード種別から対象選択を作り直さない（犠牲の意志で無効化された使用が復活しないように）。 |
| CPU・AUTO | `game/cpu-decision.ts`, `game/cpu-network-command-planner.ts`, `utils/match-auto-command.ts` | 設計資料 §4.5、§8.4.1、§8.6。人間向け対象判定との共有箇所を追える。 |
| CPUのデッキ | `shared/cpu-opponent-decks.ts`（正本）, `shared/cpu-opponent-startup-options.ts`, `scripts/cpu-deck-editor.ts`, `tools/cpu-deck-editor/index.html` | ルールブック「CPUの固有デッキ」。内容は `npm run cpu-decks:editor` で編集し、テストは中身ではなく正本との一致を確かめる。 |
| 特殊石・進化 | `shared/special-stone-registry-factory.ts`, `shared/special-stone-registry-static.ts`, `game/logic/cards-internal/progression.ts` | 設計資料 §6.2.1、§10。 |
| 演出・音・盤面描画 | `ui/presentation/dispatcher.ts`, `ui/animation-feedback-events.ts`, `ui/board-visual/effect-branch-inventory.ts` | 設計資料 §7.3。盤面内の演出と手札・HUD からの演出で所有者が異なる。 |

ID・type・日本語名の検索だけでは、イベント名、pending type、音のキー、marker、旧名の互換参照を見落とすことがあります。呼び出し元と登録先を辿ると、表示・CPU・通信への影響を確認できます。catalog の version と保存形式の互換性は、それぞれの利用側で判断する事項です。

## 通信の調査先

| 関心事 | 調査の入口 | 設計資料 |
| --- | --- | --- |
| 操作の検証・重複処理・確定 | `shared/network-action-schema.ts`, `utils/match-publish-controller.ts`, `utils/match-command-runtime.ts` | §8.3–8.4.1 |
| クライアントの送信・再送 | `ui/network/publish-flow.ts`, `ui/network/publish-tracker.ts` | §7.2、§8.3、§8.5 |
| response・SSE・再同期の受け入れ | `ui/network/intake-envelope.ts`, `ui/network/intake-coordinator.ts`, `ui/network/snapshot-canonical.ts` | §6.4、§7.2、§8.5 |
| セッション・再接続 | `ui/network/session-lifecycle.ts`, `ui/network/session-seat.ts`, `ui/network/reconnect-controller.ts`, `ui/network/stream-session.ts` | §7.2、§8.4 |
| SSE と replay | `utils/match-stream-preparation-controller.ts`, `utils/match-authority.ts` | §8.4 |
| pending の識別・送信 | `utils/match-authority/pending-selection.ts`, `ui/network/selection-signal-bridge.ts` | §6.3、§7.2.1 |
| 黒・白・観戦者への公開範囲 | `utils/match-authority/projection.ts`, `utils/match-authority/hand-projection.ts`, `utils/match-authority/board-contract.ts` | §6.1.1、§8.2、§8.7–8.8 |
| 演出 journal・再生・回復 | `shared/network-presentation-frame.ts`, `utils/match-authority/presentation-journal.ts`, `ui/network/presentation-timeline.ts`, `ui/network/visual-state-store.ts`, `ui/network/visual-settlement.ts` | §6.4、§7.3、§8.4 |
| Worker 起動・配信 | `workers/match-worker-runtime-preload.ts`, `scripts/prepare-worker-assets.ts` | §5.2、§11 |

## 検証先の候補

検証範囲の判断は [AGENTS.md](../AGENTS.md#work-rules)、契約別の入口は設計資料 §12 を参照します。コマンドの実行内容は [package.json](../package.json) が正本です。

- カードの追加・名前変更では `test/cards.catalog.test.ts`、`test/cards.generate.test.ts`、`test/cards.card-art-map.generate.test.ts`、`test/cards.pending-selection-contract.test.ts` が関連参照や登録の確認先です。
- 通信は `test:match:parity` / `test:network:parity` に加えて、変更した機能の個別テストが調査先です。parity のスクリプトだけではすべての intake・session・timeline テストを実行しません。
- Pixi は `match:pixijs-board-playback-check`、`match:pixi-runtime-fallback-check`、`match:cross-platform-smoke:vite` が再生・fallback・配信の確認先です。
- `generate:catalog`、`generate:card-art-map`、`generate:asset-manifest` は別々の生成元を扱います。catalog とカード画像の生成は、Worker mirror の同期とは別に行われます。
- `match:check` はビルド済み `dist` を利用します。`check:generated-network-surface` は生成された marker の確認であり、Worker preload や実行 bundle の確認を代替しません。後者は `worker:prepare`、`worker:bundle:smoke` が入口です。

実ブラウザ調査の候補は、着手後の次入力、カード選択中の二重入力と reset、CPU への手番移行、盤面拡張後の hit test、演出中断からの回復、送信応答と SSE の順序逆転、再接続、観戦者への公開内容です。症状と変更箇所に関係するものを選べます。
