# DI 境界（簡易ガイド）

目的
- `game/` が直接 DOM/UI に依存しないことを保証し、ヘッドレス環境でも安全に動作するようにする。

共有 shim
- `shared/ui-bootstrap-shared.js` の役割: UI 実装の登録を一元化し、存在する場合は `ui/bootstrap` に転送する（テスト／ヘッドレス用の分離ポイント）。

ローカル確認コマンド
- `npm run checkall` — 静的チェック（`window.` / `document.` / `require('../ui/bootstrap')` の禁止検出）と shim 転送の確認を実行。
- `npm test` — フルテストスイートを実行（`pretest` に `checkall` を入れるとローカルでの `npm test` が事前に `checkall` を実行して遅くなる点に注意）。

追加テストの場所
- `test/game.ui-boundary.test.js`
- `test/game.special-effects.ui-boundary.test.js`
- `test/ui.bootstrap-shared.*.test.js`

package.json の変更（オプション）
- `"pretest": "npm run checkall"` を追加すると、`npm test` の前に自動でチェックが走る。ローカル実行が遅くなるため、不要なら CI の別ジョブにすることを検討。
- 注: このリポジトリでは CI 上で `checkall` を別ジョブ（`check`）として実行する設定にしています。

影響（短い）
- 低リスクなドキュメント追加と `pretest` の設定。適用後は回帰検出が改善し、達成度は約 +5–10%（現在の改善に対して）となる見込み。

---

（短く・分かりやすくまとめました。必要なら文言の調整や追記を行います。）