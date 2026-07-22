# 盤面事象監査の根本修正 実装計画

## 文書の役割

- 役割: [設計書](board-event-audit-remediation-design.md) に基づき、正本ソース修正から全検証・生成物同期・コミットまで進める実装手順
- 対象: board visual model/controller、関連テスト、Pixi画像基準、browser生成物、Worker mirror
- 非目標: プレイヤー向けカード仕様、turn/event ordering、network authority、CPU戦略の変更

## Step 1: 設計と契約を固定

- outcome: 既存仕様、Single Visual Writer、生成物の正本関係を保った修正境界を確定する。
- components: `01-rulebook.md`、`正本/*.md`、`docs/architecture-contracts.md` 7.3、本設計書
- dependency: なし
- verification: 根拠箇所、非目標、failure/recovery、完了条件の自己レビュー
- done: 仕様変更を含まないことと、controller が再適用を所有することが明文化されている。

## Step 2: 正本ソースの根因を修正

- outcome: 拡張マスの繁殖生成石へ芽 marker が届き、invalidate 後の同一フレームが backend へ再適用される。
- components: `ui/board-visual/model-builder.ts`、`ui/board-visual/controller.ts`
- dependency: Step 1
- verification: source inspection、focused typecheck/Jest
- done: base/expansion owner resolver、owner一致条件、一回限り invalidation、失敗時保留が実装されている。

## Step 3: 回帰テストと陳腐化テストを修復

- outcome: 新しい不具合を直接固定し、既存テストが現在の公開契約を元の目的どおり検証する。
- components: board visual/controller/DOM tests、CPU/card/API/CSS/Vite/isolation inventory tests
- dependency: Step 2
- verification: 変更対象をまとめた focused Jest、`npm run typecheck`
- done: production validation を弱めず、既知の10失敗がfocused実行で全て成功する。

## Step 4: 画像基準と配布物を正規生成

- outcome: 意図済みの石 marker 表示を画像基準へ反映し、root browser source と Worker mirror を一致させる。
- components: `tests/visual-regression/baselines/pixijs-playfield-dom/`、browser artifacts、`worker-public/`
- dependency: Step 3
- verification: baseline capture、代表画像目視、Pixi static check、`npm run worker:prepare`、worker mirror check
- done: classic/Vite pixel/semantic parity が通り、mirror の missing/unexpected/content mismatch がない。

## Step 5: 横断検証

- outcome: 盤面、カード、CPU、network、browser、fallback を含む変更範囲全体の安全性を確認する。
- components: repository全体
- dependency: Step 3, Step 4
- verification: `npm run checkall`、`npm run test:network:parity`、`npm run test:jest`、Pixi playback/fallback、board input E2E、`git diff --check`
- done: 全必須チェック成功、代表スクリーンショットに重大な視覚差異がなく、unrelated diff がない。

## Step 6: 差分監査とコミット

- outcome: 検証済み task-owned diff を小さく説明可能なコミットへまとめる。
- components: 実装、テスト、文書、正規生成物
- dependency: Step 5
- verification: `git status --short`、staged diff、commit後status
- done: unrelated 変更を含まず、作業ツリーが意図どおりである。

## Self-review

- 正本ソースと回帰テストを生成物より先に直し、古い root source を mirror へ再同期しない順序にした。
- focused 検証で fixture の誤りと実装不具合を分離した後、全 Jest で未知の相互作用も確認する。
- baseline 更新は pixel budget を広げず、同じ deterministic fixture を再撮影して static check を通す。
- playback、fallback、input E2E を残し、静的モデルだけでは見えない canvas／WebGL／DOM復旧を実ブラウザで確認する。
- 仕様変更がないため rulebook/正本編集を工程に含めず、既存の表示要求を実装と検証資産へ一致させる。

## 完了チェックリスト

- [ ] 設計書と計画書の自己レビュー完了
- [ ] 拡張マスの繁殖芽表示を修正
- [ ] controller invalidation の再適用保証を実装
- [ ] 直接回帰テストと既知 stale test を修復
- [ ] focused Jest と typecheck 成功
- [ ] Pixi画像基準を正規再生成し static check 成功
- [ ] browser artifacts と Worker mirror を正規再生成
- [ ] network、playback、fallback、input E2E 成功
- [ ] 全 Jest、checkall、diff check 成功
- [ ] task-owned 変更だけをコミット

