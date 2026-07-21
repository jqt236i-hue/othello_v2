# 特殊石の所有権変更ライフサイクル統合 実装計画

## 前提

- プレイヤー仕様の正本は `01-rulebook.md` と `正本/カード仕様正本.md`。
- 所有権変更ポリシーの正本は `shared/special-stone-registry.ts`。
- canonical な実変更とマーカー正常化の正本は `game/logic/board_ops.ts`。
- 反転後リアクションの正本は `game/logic/cards.ts` の公開 helper。
- root 実装を先に変更し、browser と `worker-public/` は生成コマンドで同期する。
- 既存の hand-animation/UI/bootstrap/generated 差分は別作業として保持し、本タスクへ混ぜない。

## 実装手順

### 1. プレイヤー仕様と内部契約を固定する

対象ファイル:

- `01-rulebook.md`
- `正本/カード仕様正本.md`
- `docs/architecture-contracts.md`

作業:

- 通常の実反転で特殊石本体・時限爆弾が失効する共通規則を追記する。
- 復活・屍石・生きる意志、罠、毒の反応/保持例外を明記する。
- 意志の反転と禁忌の反転の所有権移譲例外、出稼ぎ石のアンカー喪失優先を明記する。
- 意志の反転は反転枚数・角取得数に含めないことを内部 typed meta 契約へ結び付ける。

依存: なし。

完了判定: コードが参照する全ポリシーと例外が正本上で一意に読める。

### 2. レジストリへ所有権変更ポリシーを追加する

対象ファイル:

- `shared/special-stone-registry.ts`
- `test/shared.special-stone-registry.test.ts`

作業:

- `revert` / `resolve_after_change` / `preserve` を `StoneEffectRule` へ追加する。
- 分類既定値と復活・屍石・罠・生きる意志の上書きを実装する。
- marker data を受け取る公開 getter を追加する。
- 未知の特殊石本体が安全側で `revert` になることをテストする。

依存: 手順1。

完了判定: 固定カード一覧なしに各分類のポリシーを取得できる。

### 3. BoardOps の所有権変更を原子的にする

対象ファイル:

- `game/logic/board_ops.ts`
- `game/logic/card-resolution/ownership.ts`
- `game/turn/action-phase/place-resolution.ts`
- `game/logic/cards.ts`

作業:

- `changeAt` で変更前 visual meta を保存してから `revert` マーカーを削除する。
- 出稼ぎアンカー参照を同時解除する。
- `ownershipChangeMode: 'transfer'` と `countAsFlip: false` を実装し、presentation meta から除く。
- 意志の反転と禁忌の反転だけ transfer mode を指定する。
- reason文字列による増殖石削除と固定種類リストを撤去する。
- `clearHyperactiveAtPositions` を互換 no-op にし、正常化を `changeAt` へ一本化する。

依存: 手順2。

完了判定: `changeAt` 成功だけで盤面色と付随マーカーがポリシーどおり整合し、例外は typed meta でのみ成立する。

### 4. 反転後リアクションを全経路へ接続する

対象ファイル:

- `game/logic/cards.ts`
- `game/logic/effects/dragon.ts`
- `game/logic/effects/swap_with_enemy.ts`
- `game/turn/turn_pipeline_phases.ts`
- `game/turn/immediate-effect-dispatcher.ts`
- `game/turn/turn-start/special-stone-phase.ts`
- `game/turn/action-phase/pre-placement-selection-reverse-stage.ts`
- `game/turn/action-phase/pre-placement-selection-target-effects-stage.ts`
- `game/turn/action-phase/place-resolution.ts`

作業:

- ordered batch queue を持つ `CardLogic.applyPostFlipRevives` を追加する。
- 復活 capture と生きる意志の追加反転を変更後主体色で再投入する。
- 龍の配置直後・ターン開始、敵石入替、反転の意志を共通入口へ接続する。
- 敵石入替は実際に変更できた capture だけを詳細結果・布石へ含める。
- 既存 boolean API と mock fallback を維持する。
- 龍・敵石入替の直接 board fallback は root BoardOps 解決へ置き換える。

依存: 手順3。

完了判定: 同じ特殊石配置に対し、通常配置・龍・入替・反転の意志で同じ復活結果になる。

### 5. 横断回帰試験を追加する

対象ファイル:

- `test/game.special-stone-ownership-change.test.ts`（新規）
- 必要に応じて既存の `game.swap-normal-only.test.ts`、`game.reverse-will.test.ts`、`game.taboo-reverse-will.test.ts`

試験マトリクス:

- BoardOps reason非依存: 犠牲、増殖、狙撃、出稼ぎ、時間停石、時間停神、時限爆弾を削除
- 保持/反応: 毒、罠、復活、屍石、生きる意志
- 二次障害: 反転済み犠牲石がカードを無効化しない、反転済み出稼ぎ石を捕獲対象にできない
- 龍・敵石入替・反転の意志の復活系
- 復活 capture と生きる意志復活起点の追加反転
- 意志の反転/禁忌の反転の移譲、計数差
- 連鎖、繁殖/生成、屍石感染の既存経路が回帰しない

依存: 手順4。

完了判定: 再現ケースと例外を単一の focused test set で固定できる。

### 6. 検証・生成・mirror同期

実行順:

1. 新規/変更 focused Jest
2. 既存カード focused Jest
3. `npm run typecheck`
4. `npm run build:ts`
5. `npm run check:window`
6. `npm run test:network:parity`
7. `npm run build:browser`
8. `npm run worker:prepare`
9. `npm run check:worker-mirror`
10. `git diff --check` と task-owned diff inspection

生成物に別作業差分が含まれる場合は、sourceと本タスク固有の生成差分だけを分離し、別作業の index/style/UI/Vite bundle をstageしない。

依存: 手順5。

完了判定: rootの全検証が通り、mirrorがrootと一致し、タスク所有差分を安全に分離できる。

### 7. コミット

作業:

- `git status --short` と関連 diff を再確認する。
- task-owned filesだけを明示的にstageする。
- 検証済みの1コミットを作成する。
- 分離不能な生成差分がある場合はsource/docs/testsを壊さず、具体的な生成ファイルと理由を報告する。

依存: 手順6。

完了判定: 実装がコミット済み、または既存差分との分離不能という具体的 blocker が報告されている。

## 自己レビュー

- 仕様、分類、canonical mutation、反応、presentation、runtime mirror の順に依存関係を並べた。
- 既存API互換を保ちながら、正常化の権限をBoardOps一か所へ限定した。
- 独立レビューの指摘を反映し、誘惑の計数除外、ordered reaction batch、fallback漏れ、追加経路テストを計画へ加えた。
- 既存の別作業生成差分を前提条件とし、誤stageを防ぐ完了条件を明記した。
- 検証はLevel 2のカードロジックに加え、network/browser/WorkerのLevel 3 parityまで含めた。
