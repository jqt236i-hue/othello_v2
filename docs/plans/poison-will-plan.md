# 「毒殺の意志」実装計画

## 完了条件

- 仕様正本、カードカタログ、画面文言に ID・コスト・対象・持続・防御相互作用が一致して記載される。
- 人間・CPU・ネットワーク対戦で対象を選択でき、合法性とコスト消費が既存カード規約に従う。
- 毒マス 10 ターン、毒状態 5 ターン、付与ターン非減算、致死時の通常破壊、完全保護・不可侵無効が headless テストで確認できる。
- 毒マスと毒状態が移動・反転・破壊・セル除去で正しい所属を保つ。
- ブラウザで紫の毒マス、紫がかった石、右下三角マーカーと残りターンが描画される。
- Worker/local/browser/headless のネットワーク契約と生成 mirror が一致する。
- focused Jest、型検査、境界検査、browser build、network parity が成功する。
- タスク所有差分だけをレビュー・コミットする。

## 実装順序

1. 仕様とカタログ
   - `01-rulebook.md` と関連 `正本/` の未定値を確定する。
   - `cards/catalog.json` とカード表示コピーを追加し、catalog を生成する。
2. canonical rules
   - marker registry と selector に `POISON_CELL` / `POISONED` を追加する。
   - 毒接触同期、付与、ターン減算、致死、解除、マス消滅を headless に実装する。
   - 移動・交換・破壊時に石状態と盤面マーカーが正しい対象へ残るよう既存 marker 操作を拡張する。
3. action flow と CPU
   - pending-selection registry、UI selection bridge、action payload、pre-placement resolver を追加する。
   - CPU 選択ハンドラーと評価を追加する。
4. turn/network parity
   - 通常ターン・選択だけで終了するターン・パスへ同じ poison turn-end hook を接続する。
   - action schema、Worker preload、ローカル/Worker authority 経路を揃える。
5. presentation
   - projector、diff equality、DOM patcher、marker renderer、CSS、status playback を追加する。
   - ルールヘルプと AI コメントを更新する。
6. verification
   - focused rules/UI/network tests を追加または更新する。
   - `npm run typecheck`、focused Jest、`npm run check:window`、`npm run build:browser`、`npm run test:network:parity`、`npm run worker:prepare` を必要な順で実行する。
   - `git diff --check`、関連 diff、最終 `git status --short` を確認する。
7. completion
   - 独立レビューの指摘を反映し、タスク所有ファイルだけを stage・commit する。

## 検証シナリオ

- 空きマス・敵石・味方石・特殊石のあるマスを選べる。
- 手札詳細の「使用」が有効になり、共通の使用可能判定から対象選択へ進める。
- 完全保護石と不可侵顕現は毒にならない。
- 毒状態へ完全保護を後付けすると即座に解除される。
- 付与直後は 5 のまま、その後の各完了ターンで 4、3、2、1、致死へ進む。
- 毒状態を再度毒マスへ接触させても残りターンをリセットしない。
- 反転・移動では毒状態が石に追従し、毒マスは元セルに残る。
- 破壊回避が発動でき、試行済み毒は解除される。毒マス上に残れば再付与される。
- 通常破壊では毒マスが残り、メテオ等のセル除去では毒マスも消える。
- 10 ターン目は毒致死処理後に毒マスが消える。
- パス、CPU、Worker publish/reconnect 後も同じ残りターンになる。
- UI に毒マス、石 tint、三角形、残りターンが出る。
