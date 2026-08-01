# ネット対戦カード網羅検証基盤 修正設計

## 文書の役割

この文書は、ネット対戦で全カードの単体・組み合わせ検証を行った際に判明した、検証基盤側の誤検知と未実行を修正するための実装設計である。プレイヤー向け仕様の正本は `01-rulebook.md`、内部契約の正本は `docs/architecture-contracts.md` であり、本変更はどちらの仕様も変更しない。

対象は root の TypeScript／Jest／browser smoke 正本である。`dist/`、`worker-public/`、生成済み browser artifact は直接編集しない。production deploy、公開ネット対戦へのデバッグ機能追加、カード効果の仕様変更は非対象とする。

## 1. 確定した問題

カード網羅検証ではゲーム処理・ネットワーク authority の不一致は再現しなかったが、以下の5件が検証結果を不正確にしていた。修正後の focused verification では、さらに Pixi の状態マーカー画像 preload 1件を再現した。

1. late-special fixture の playback／sound 固定 digest が、現在の deterministic event 列に追随していない。
2. board-shape access の単体 fixture が必須化された `isBoardMarker` dependency を渡していない。
3. `cardsApi` inventory が、森羅万象神と火・水・草系の意図した public API 追加27件に追随していない。
4. Pixi playback checker が、石ゴースト pool とマーカー専用 ghost pool の合計だけを上限2で検査し、安定した `2 + 1` を leak と誤判定する。
5. endgame smoke が公開デバッグ無効化後も `networkDebugEnabled` を条件にカード処理を丸ごと飛ばし、`cards=` が空でも成功する。
6. Pixi の frame texture 収集が `stone_body` 以外の marker を一律除外し、明示的に対応している凍結マス／種マスの画像と procedural fallback を preload できない。

## 2. 選択設計

### 2.1 固定契約の同期

late-special digest は既に別の deterministic event-index test と実ブラウザ3クライアント検証で一致している現在値へ同期する。API inventory は現在の289キーとソート済みキー集合の SHA-256 へ同期する。board-shape fixture は production と同じ `game/logic/cards/markers.ts#getMarkerRuleClass` を使い、`board_marker` だけを盤面マーカーとして分類する。

### 2.2 Pixi pool 診断の分離

`PixiBoardSceneDiagnostics` に石ゴーストとマーカーゴーストそれぞれの pooled／created／destroyed 件数を追加する。既存の合計フィールドは互換性のため保持し、backend diagnostics にも分離値を透過する。

browser checker は次を独立に検査する。

- 石ゴースト pool は2以下。
- マーカーゴースト pool は1以下。
- 既存の合計値は両分離値の和と一致する。
- active lease は従来どおり settlement 後に0である。

合計上限だけを3へ緩和する案は、片方の pool が単独で増え続ける leak を隠すため採用しない。

### 2.3 endgame smoke のカード準備

公開 create API は `networkDebugEnabled: true` を要求されても false を返す現行 hardening を維持し、smoke でも false を明示確認する。カード準備だけは同一プロセス内の既存 `patchRoomSnapshotForTests` を使い、現在手番 seat の canonical hand と charge をテスト fixture として置き換える。

準備時には state version を進めず、authoritative hash を再計算して smoke 内の client context と同期する。その直後のカード使用と着手は、従来どおり HTTP の通常 `use_card`／`place` publish を通す。各ゲームは終局前に計画した5枚が実際に受理済みであることを検査し、全ゲームの集計では対象9種をすべて使用したことを別途検査する。未実行カードがあれば失敗させる。

これは public debug action を再有効化せず、権威コマンド経路のカード使用を検証するための test-only setup である。

### 2.4 Pixi 状態マーカー画像の preload

frame texture 収集は gameplay 上の `subjectKind` ではなく、表示 resolver が画像資源を返すかどうかを境界にする。marker を収集候補へ残し、凍結マス／種マスは専用画像を、ロード失敗時は既存の procedural fallback を transaction 内で準備する。画像を持たない盤面 marker は resolver が `null` を返すため、不要な texture は生成されない。

## 3. Ownership と安全性

- game/card authority とカード効果は変更しない。
- Worker／local の公開契約は変更しない。
- Pixi の Single Visual Writer、timeline、pool lifecycle は変更せず、診断の観測粒度だけを上げる。
- endgame fixture はローカル CLI プロセスの private room にだけ作用し、公開 API や通常ブラウザから呼び出せる新しい入口を追加しない。
- `worker-public/` と `dist/` は build／prepare でのみ更新する。

## 4. 検証戦略

- 固定契約: 該当3 Jest suite と late-special browser E2E。
- Pixi: scene／backend／browser-check evaluator の focused Jest、Vite playback scenario matrix、スクリーンショット目視。
- endgame: TypeScript build 後の `match:endgame-check`。各ゲームの `cards=` が計画と一致することを出力と終了条件の両方で確認する。
- cross-runtime: `npm run typecheck`、`npm run test:network:parity`、必要な browser build／Vite build。
- 最終: `git diff --check`、関連 diff、status、タスク所有差分のみ commit。

## 5. 完了条件

- 6件すべてに root-cause 修正または正しい固定値同期がある。
- Pixi scenario matrix が石2・マーカー1を leak と誤判定せず、各 pool の超過と合計不整合は検出する。
- endgame smoke が公開デバッグ false のまま各局5枚と対象9種すべてを通常 publish で使用する。
- focused／browser／network parity／build が通る。
- プレイヤー向け仕様変更がなく、`01-rulebook.md` と `正本/` を変更していない。

## 6. Self-review

設計を `docs/architecture-contracts.md` の Single Visual Writer、network authority、root／mirror 契約と照合した。診断値を gameplay state に混ぜず、test-only patch を公開 transport に露出させず、公開 debug hardening を維持している。固定 digest と API inventory は単に失敗を消すのではなく、別の deterministic test・実行結果・現在の export 集合を根拠に更新する。endgame はカード未実行を今後 success-shaped にできない終了条件を持つ。Pixi marker preload は既存 backend transaction と resolver を利用し、別の表示 writer や資源経路を追加していない。

実装後の再レビューでは、Pixi aggregate field を互換維持しつつ内訳を追加したこと、checker が内訳欠落・個別超過・合計不整合を別々に reject することを確認した。endgame の初回実行で、カードを実際に使うと一部局が6枚目より先に終局することが分かったため、重複を含む6枚強制ではなく、各局5枚完遂と全5局で対象9種を被覆する停止条件へ修正した。late-special E2E で残っていた旧 sound 配列も同じ deterministic event 列へ同期した。

## 7. 実行結果

- stale fixture focused: 3スイート、11件通過。
- Pixi focused: 3スイート、85件通過。初回に再現した種／凍結 marker preload 2件も修正後に通過。
- late-special network E2E: 3クライアントのjournal drain／reconnect／収束を1件通過。
- Pixi browser matrix: classic／Vite、Pixi／DOM、normal／reduced-motion／NOANIMの12レポート、232シナリオ、エラー0。種マーカー key frame のスクリーンショットを目視確認。
- network parity: 35スイート、561件通過。
- endgame smoke: 5局完走、各局5枚、対象9種を通常 publish で使用し、公開 debug はfalse。
- `npm run typecheck`、`npm run build:browser`、`npm run worker:prepare`、worker mirror check、`npm run check:window` 通過。
