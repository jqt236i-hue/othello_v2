# ネット対戦モード対応 セッション事実報告書 2026-05-30

## 1. 報告対象

この報告書は、2026-05-30 の本セッションで実施したネット対戦モード関連作業について、ローカルリポジトリ上で確認できる事実をまとめたものです。

主な対象は次の作業です。

- `docs/network-presentation-completion-plan-2026-05-30.md` の残フェーズ実行
- Worker runtime module audit の未完扱い解消
- ネット対戦演出・効果音 parity 計画の残りタスク 0 化
- 変更内容のコミット

## 2. 作業前に確認した状態

作業開始時点で、`docs/network-presentation-completion-plan-2026-05-30.md` の実行状況は以下の状態でした。

- Phase 0: 完了
- Phase 1: 完了
- Phase 2: 完了
- Phase 3: 完了
- Phase 4: 完了
- Phase 5: 完了
- Phase 7: 完了
- Phase 8: 完了
- Phase 6: 実行状況欄に完了記録がない状態

作業開始時点の `git status --short` は clean でした。

## 3. このセッションで特定した未完事項

未完扱いとして残っていたのは Phase 6 の Worker runtime module audit でした。

Phase 6 の目的は、公開 Worker だけ module 解決に失敗する再発を防ぐことです。計画書では、主に次の確認が求められていました。

- `workers/match-worker-runtime-preload.ts` の preload 対象確認
- `workers/match-worker.ts` の runtime module 解決経路確認
- `shared/module-export-utils.ts` による usable export 判定確認
- empty export や `__esModule` のみの export を成功扱いしない確認

## 4. 失敗していたテスト

Phase 6 の確認として、以下の focused suite を実行しました。

```powershell
npx jest --runInBand --runTestsByPath test/shared.module-export-utils.test.ts test/game.cards-internal.module-resolver.test.ts test/workers.match-worker-preload.test.ts test/workers.match-worker-card-preload.test.ts test/workers.match-card-selector-preload.test.ts
```

この時点では `test/workers.match-worker-card-preload.test.ts` が失敗しました。

失敗理由は、テストが旧実装の文字列を期待していたためです。具体的には、現行実装では `scope.CardCatalog` や旧形式の `modRecord['module.exports']` 期待が一致しませんでした。

この時点で確認した現行実装の特徴は次の通りです。

- `workers/match-worker-runtime-preload.ts` は `installRuntimeModule(...)` を使って runtime module を登録している
- `workers/match-worker.ts` は `ModuleExportUtils` を require している
- `workers/match-worker.ts` は `unwrapRuntimeModule(...)` を使って `module.exports` / `default` のネストを解決している
- `workers/match-worker.ts` は `ModuleExportUtils.hasUsableModuleExport(...)` と `ModuleExportUtils.preferUsableModuleExport(...)` を使って usable export を判定している

## 5. このセッションで変更したファイル

このセッションで変更したファイルは3つです。

- `test/workers.match-worker-card-preload.test.ts`
- `docs/network-presentation-completion-plan-2026-05-30.md`
- `docs/network-presentation-goal-worklog-2026-05-30.md`

## 6. テスト変更の内容

`test/workers.match-worker-card-preload.test.ts` を、旧実装前提の文字列検査から現行 runtime 契約の検査へ更新しました。

変更前の主な期待値は次の系統でした。

- `scope.CardCatalog`
- `scope.SharedConstants`
- `scope.CardStateManager`
- `modRecord['module.exports']`
- `const resolved = moduleExports || modRecord.default || mod;`
- 旧形式の module map 文字列

変更後は、次の現行契約を検査しています。

- `installRuntimeModule('CardCatalog'...)`
- `installRuntimeModule('SharedConstants'...)`
- `installRuntimeModule('BoardOps'...)`
- `installRuntimeModule('DestroyOneStoneEffects'...)`
- `installRuntimeModule('SwapWithEnemyEffects'...)`
- `installRuntimeModule('CardStatusCellsEffects'...)`
- `installRuntimeModule('CardStateManager'...)`
- `installRuntimeModule('CardEffectResolver'...)`
- `installRuntimeModule('CardTimingProcessor'...)`
- `installRuntimeModule('CardTargetResolver'...)`
- `ModuleExportUtils`
- `unwrapRuntimeModule(value: unknown, depth = 0)`
- `source['module.exports']`
- `source.default`
- `ModuleExportUtils.hasUsableModuleExport(value)`
- `ModuleExportUtils.preferUsableModuleExport(resolved, globalAfterLoad)`
- preload loader map の該当 `require(...)`
- `requiredGlobals` の該当 module と global key

この変更は、ゲームルールやネット対戦の実行ロジックを変更していません。テストが参照する契約を現行実装に合わせた変更です。

## 7. 計画書の更新内容

`docs/network-presentation-completion-plan-2026-05-30.md` に Phase 6 完了を追記しました。

追記した内容は次の通りです。

- `test/workers.match-worker-card-preload.test.ts` を現行 runtime 契約へ更新したこと
- focused suite が pass したこと
- Phase 6 を完了扱いにしたこと
- `残りタスク: 0（計画上の全Phase完了）` を明記したこと

## 8. 作業ログの更新内容

`docs/network-presentation-goal-worklog-2026-05-30.md` に、以下の節を追加しました。

- `## 13. 2026-05-30 追記（Phase 6 完了と残タスク 0 化）`

この節には、以下を記録しました。

- Phase 6 が未完だったこと
- 旧実装前提の回帰テストを現行契約へ更新したこと
- focused suite のコマンド
- focused suite の結果
- `npm run test:network:parity` の結果
- 計画書上の残フェーズがすべて完了扱いになったこと

## 9. 実行した検証

このセッションで、修正後に以下の focused suite を実行しました。

```powershell
npx jest --runInBand --runTestsByPath test/shared.module-export-utils.test.ts test/game.cards-internal.module-resolver.test.ts test/workers.match-worker-preload.test.ts test/workers.match-worker-card-preload.test.ts test/workers.match-card-selector-preload.test.ts
```

結果は以下です。

- Test Suites: 5 passed, 5 total
- Tests: 24 passed, 24 total
- Snapshots: 0 total

続いて、ネット対戦 parity の総合確認として以下を実行しました。

```powershell
npm run test:network:parity
```

結果は以下です。

- Test Suites: 34 passed, 34 total
- Tests: 411 passed, 411 total
- Snapshots: 0 total

## 10. 実機 artifact の扱い

このセッションでは、既存の公開 URL 実機確認 artifact の `summary.json` が計画書に記録済みであることを確認しました。

計画書に記録されている artifact は以下です。

- `tmp-live-check-1780093685466-deployed-special-proof/summary.json`
- `tmp-live-check-1780093862929-deployed-remaining-proof/summary.json`
- `tmp-live-check-1780094071565-deployed-super-attraction-proof/summary.json`
- `tmp-live-check-1780094402998-deployed-hyperactive-proof/summary.json`

計画書上では、これら4件はいずれも `pass` と記録されています。

このセッションでは、新しい Chrome / Edge 実機操作は実施していません。

## 11. コミット

このセッションの変更はコミット済みです。

```text
dda07330f Complete phase 6 worker runtime audit and docs
```

`git show --stat --oneline HEAD` で確認した変更量は以下です。

```text
3 files changed, 62 insertions(+), 21 deletions(-)
```

対象ファイルは以下です。

- `docs/network-presentation-completion-plan-2026-05-30.md`
- `docs/network-presentation-goal-worklog-2026-05-30.md`
- `test/workers.match-worker-card-preload.test.ts`

## 12. 作業後の状態

この報告書作成前の確認では、`git status --short` は clean でした。

この報告書ファイルは、この報告書作成作業で新規追加したものです。

## 13. 事実として言えること

このセッションで事実として言えることは以下です。

- Phase 6 の未完扱いを解消するため、関連テストを現行実装契約に合わせて更新した
- 更新後の focused suite は pass した
- `npm run test:network:parity` は pass した
- 計画書上は Phase 0 から Phase 8 まで完了扱いになった
- 計画書上は `残りタスク: 0` になった
- このセッションの変更は `dda07330f` としてコミット済み

## 14. 事実としては断定しないこと

以下は、この報告書では断定しません。

- 今後ネット対戦で絶対に不具合が発生しないこと
- 全ユーザー環境、全ブラウザ、全通信状況で常に同じ挙動になること
- このセッション内で新規に公開 URL の Chrome / Edge 実機確認を再実行したこと
- このセッション内で `npm run typecheck`、`npm run build:ts`、`npm run match:check` を新規に再実行したこと

## 15. 現時点の判断

確認済みのテスト結果と計画書上の完了状態に基づくと、今回定義されたネット対戦演出・効果音 parity 計画の範囲では、残りタスクは 0 です。

ただし、この判断は上記の自動テスト、既存 artifact、計画書上の記録に基づくものです。未確認事項として記載した範囲までは含みません。
