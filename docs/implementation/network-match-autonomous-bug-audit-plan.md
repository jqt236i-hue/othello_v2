# ネット対戦 自律バグ監査・修正 実装計画

## 文書の役割

本計画は `docs/implementation/network-match-autonomous-bug-audit-design.md` を実行するための作業手順である。正本、共有 authority、adapter、browser、生成面の順序を守る。

## Step 1 — baseline と監査 inventory を固定する（completed）

- 結果: clean status、適用 AGENTS、architecture contract、全 network surface、package scripts を確認する。
- 対象: repository instructions、`docs/architecture-contracts.md`、network inventory script、`package.json`。
- 依存: なし。
- 検証: `git status --short`、`npm run build:ts`、stale build 切り分け後の parity focused case。
- 完了条件: build 前後の初期失敗が分類され、以後の baseline が正本 build に固定される。

## Step 2 — automated contract suite を広く実行する（completed）

- 結果: parity 束と、それに含まれない intake／session／stream／journal／timeout／spectator／rating／room／board suite の失敗一覧を得る。
- 対象: `test/` の network／match／worker／authority 関連 suite。
- 依存: Step 1。
- 検証: `npm run test:network:parity`、`npm run test:match:parity`、broad focused Jest、必要な `--detectOpenHandles`。
- 完了条件: 各失敗が deterministic defect、flaky、stale artifact、environment のいずれかに分類される。

## Step 3 — 静的 authority・concurrency・privacy 監査を行う（completed）

- 結果: テスト未到達の契約違反候補を列挙し、再現可能性を確認する。
- 対象: shared command schema、authority helpers、Worker/local adapter、browser publish/intake/session、SSE、journal、timeout、projection、board contract。
- 依存: Step 1。Step 2 と結果を相互参照する。
- 検証: inventory script、focused `rg`、`npm run check:window`、`npm run check:dependency-boundaries`、source inspection。
- 完了条件: high-risk 候補が再現 test へ落ちるか、既存 guard で安全と証明される。

## Step 4 — 発見した不具合を正本順に修正する（completed）

- 結果: 再現した全 defect を root cause で修正する。
- 対象: 発見結果に応じ、shared／utils → Worker/local → UI network → visual の順。
- 依存: Step 2–3 の再現証拠。
- 検証: 各 defect の最小回帰 test と隣接 focused test。
- 完了条件: 修正前に再現し、修正後に通り、reject／retry／recovery の副作用がない。

## Step 5 — cross-runtime と delivery を検証する（completed）

- 結果: root source と Worker/local/browser/headless、生成 mirror が一致する。
- 対象: 全 task-owned source、browser registry/bundle、`worker-public/` mirror、Worker bundle。
- 依存: Step 4。
- 検証: focused Jest、両 parity 束、`npm run typecheck`、`npm run build:browser`、`npm run match:check`、`npm run worker:prepare`、`npm run check:worker-mirror`、`npm run worker:bundle:smoke`。
- 完了条件: 必須 gate が全て通り、初回失敗と再試行結果が説明できる。

## Step 6 — 最終同期・diff 監査・commit（completed）

- 結果: design／plan／実装／検証証拠が一致し、タスク所有差分だけを commit する。
- 対象: 本 design/plan、task-owned source/test/generated files。
- 依存: Step 5。
- 検証: `git diff --check`、relevant `git diff`、`git status --short`、commit 後 status。
- 完了条件: unintended diff がなく、commit が作成され、残存リスクが報告可能。

## 完了チェックリスト

- [x] 全 surface の automated／static 監査を完了した。
- [x] 再現した全製品不具合を修正した。
- [x] duplicate operation、old session、projection privacy、journal gap、timeout/AUTO failure を確認した。
- [x] focused／parity／typecheck／build／smoke／mirror／bundle gate を通した。
- [x] プレイヤー仕様変更の有無を確認し、必要時だけ正本を同期した。
- [x] design と plan を最終状態へ更新した。
- [x] relevant diff と status を確認し、タスク所有差分だけを commit した。

## Self-review

設計の全完了条件を各 Step に割り当て、canonical source を generated output より先に扱う順序へ修正した。初期の stale `dist` 偽陽性と open-handle 警告を Step 1–2 で明示的に再評価し、再試行通過だけで defect を閉じない条件を追加した。現時点で実装対象を決め打ちしていないのは、再現証拠なしの大規模変更を避けるためであり、発見後は Step 4 から自律的に完了まで進める。

実行後は、製品不具合2件を共有 command／turn pipeline で修正し、構造共通化後に陳腐化した3件の test fixture／source assertion／digest を現行契約へ同期した。214スイートの広域群、network／match parity、実サーバー smoke、browser build、Worker mirror／bundle を完走し、Step 6 で差分監査とタスク所有ファイルの commit まで完了した。
