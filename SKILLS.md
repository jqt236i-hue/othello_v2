# SKILLS.md

このファイルは「このカードオセロでよくやる作業」を素早く安全に実行するための、短いレシピ集です。
目的は **AIエージェント/人間が迷わず編集できる状態** を保つことです。

## 0) 迷ったら最初に見る場所

- 仕様（一次情報）: 01-rulebook.md
- 起動順（唯一の入口）: index.html
- UIのDI（依存注入）: ui/bootstrap.js

## 1) 調査の型（読む順番）

1. index.html の `<script>` 順（何がいつロードされるか）
2. ui/bootstrap.js（ゲーム側に何を注入しているか）
3. game/turn/turn_pipeline.js（ターン進行の入口）
4. game/…（ロジック）→ ui/…（描画）

## 2) 変更の型（テンプレ）

### 2.1 ルール変更

- 01-rulebook.md を先に変更
- 影響箇所を全文検索（例: カード type 名 / イベント名）
- 実装を最小差分で更新
- 「代表例 + 境界条件」で動作確認（例: カードが不発のケース）

### 2.2 カード効果（ロジック/演出）変更

- ロジック: game/card-effects/ と game/special-effects/ を優先
- UI演出: ui/animation-* と ui/stone-visuals.js を優先
- UIは game の内部実装に依存しない（公開API/イベント/DIのみ）

### 2.3 UI演出（アニメーション）変更

- まず「単一の描画経路（Single Visual Writer）」があるか確認
- 強制リフロー（`offsetWidth` / `getBoundingClientRect`）は最小化
- 常駐タイマー（setInterval）は極力増やさない（必要なら `?debug=1` 限定）

### 2.4 不要物削除

- 参照検索（ファイル名/シンボル名）
- index.html のロード有無確認
- 削除 → 再検索（参照ゼロ）
- 起動できるか確認

## 3) よく使う検索キーワード

- DI/境界: `__uiImpl_`, `setUIImpl`, `connect(`
- 描画イベント: `emitBoardUpdate`, `PLAYBACK_EVENTS`, `AnimationEngine`
- カード: `CARD_DEFS`, `CARD_TYPE_BY_ID`, `CARD_TYPES`, `CardLogic`
- ターン: `turn_pipeline`, `turn-manager`, `isProcessing`, `isCardAnimating`

## 4) パフォーマンス最適化の当たり所

- index.html の同期スクリプト直列ロード削減（debug系は条件付きロードに）
- UI/ゲームで重複しているマップ・定義の統合（単一ソース化）
- 反転/破壊など多発イベントでの DOM 触り回数削減（バッチ化/イベント駆動）
- ログ出力はホットパスで控えめに（debug時のみ詳細）

## 5) “壊さない”ためのチェック

- `game/` が `ui/` を直接参照していないか
- `window` 公開が増えていないか（必要なら一覧に追記）
- `?debug=1` なしで debug 機能が混ざっていないか
