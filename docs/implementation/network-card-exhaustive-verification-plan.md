# ネット対戦カード網羅検証基盤 修正計画

## 文書の役割

本計画は `docs/implementation/network-card-exhaustive-verification-design.md` を実行するための手順である。実装正本、focused test、browser／network verification、生成面、commit の順に進める。

## Step 1 — 証拠と契約を固定する（completed）

- clean worktree、適用 AGENTS、カード／network／Pixi skill、architecture contract を確認する。
- 5件を gameplay defect、stale fixture、false positive、silent skip に分類する。
- 完了条件: 現在値と ownership がファイル・テスト結果で特定されている。

## Step 2 — stale fixture を同期する（completed）

- late-special playback／sound digest を現在の deterministic output へ同期する。
- board-shape fixture に canonical marker classifier を注入する。
- cards API inventory を意図した289キーへ同期する。
- 完了条件: 該当3 focused suite が通る。

## Step 3 — Pixi ghost pool 診断を分離する（completed）

- scene／backend diagnostics に石用とマーカー用の件数を追加する。
- browser checker を分離上限と合計整合性の検査へ変更する。
- focused verification で再現した凍結／種 marker の texture preload 除外を、既存 resolver 境界で修正する。
- scene／backend／evaluator test で正常値と超過を固定する。
- 完了条件: focused test と全 playback scenario matrix が通る。

## Step 4 — endgame smoke の silent skip を除去する（completed）

- 公開 debug false を明示検査する。
- test-only room patch で手札・charge を準備する。
- 通常 `use_card`／`place` publish を使い、各局5枚と全対象9種の実行を終了条件にする。
- 完了条件: 5ゲームが完走し、各 `cards=` が5枚の計画と一致し、集計が対象9種を含む。

## Step 5 — cross-runtime 検証と commit（completed）

- focused Jest、late-special browser E2E、Pixi browser matrix、endgame smoke、network parity、typecheck／browser build を実行する。
- スクリーンショットを確認し、diff／status を監査する。
- design／plan を実行結果へ同期し、タスク所有差分だけを commit する。
- 完了条件: 必須 gate が通り、commit 後の残存差分とリスクを報告できる。

## Self-review

各設計項目を実装 Step と検証 gate に対応付けた。特に Pixi は合計上限緩和だけで終えず分離診断を先に追加し、endgame はログ上カードが空でも成功できない終了条件を設ける。root source を generated output より先に扱い、公開 debug やカード仕様を変更しない順序である。

実行後は、focused verification で追加発見した種／凍結 marker preload 除外と、late-special E2E の重複した旧 sound 順序まで修正対象へ取り込んだ。初回 endgame の6枚目未実行は、各局5枚と全対象9種の二段階 coverage gate へ改めて再実行し、5局すべてで通過した。Pixi 232シナリオ、network parity 561件、late-special E2E、typecheck／build／mirror／window boundary を通し、生成面を root source から同期した。

## 完了チェックリスト

- [x] stale digest、board-shape fixture、API inventory を同期した。
- [x] Pixi ghost pool を石用／marker用に分離し、個別上限と合計整合性を検査した。
- [x] 種／凍結 marker の専用画像と procedural fallback を preload できるようにした。
- [x] endgame smoke が公開 debug false のまま各局5枚・対象9種を通常 publish で使用した。
- [x] focused／browser／network parity／build／mirror gate を通した。
- [x] プレイヤー向け仕様変更がないことを確認した。
