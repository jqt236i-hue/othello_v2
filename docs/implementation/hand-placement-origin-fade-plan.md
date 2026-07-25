# 手置き演出の手札起点・透明度フェード 実装計画

## 1. 文書の役割

この計画は `docs/implementation/hand-placement-origin-fade-design.md` のレビュー済み設計を実装し、石配置の手が手札付近からフェード付きで出入りする状態まで完了させるための実行手順である。

## 2. 実装手順

### Step 1: プレイヤー向け仕様を更新する

- 状態: completed
- 対象: `01-rulebook.md`、`正本/演出正本.md`
- 依存: レビュー済み設計
- 成果: 配置者の手札付近を起点・退避点とし、接近フェードイン、退避フェードアウトを行う表示仕様を記録する。
- 検証: 該当節の相互整合、`git diff --check`
- Done: 両正本が同じプレイヤー可視挙動を述べ、内部実装詳細へ依存していない。

### Step 2: 手札geometry起点とopacity keyframeを実装する

- 状態: completed
- 対象: `ui/animation-utils.ts`
- 依存: Step 1
- 成果: 表示カード群→手札コンテナ→現行盤面端の順で起点を解決し、接近・退避keyframeへ透明度を追加する。
- 検証: source inspection、focused Jest
- Done: 上下slotの見た目中心が手札付近に一致し、接近0→1、退避1→0、既存接触時刻とcleanupが維持される。

### Step 3: 回帰テストを追加・更新する

- 状態: completed
- 対象: `test/ui.animation-utils.hand-fallback.test.ts`
- 依存: Step 2
- 成果: 実カード群中心の上下別起点、透明度keyframe、既存phase時間と終了状態を固定する。
- 検証: `npx jest --runInBand --runTestsByPath test/ui.animation-utils.hand-fallback.test.ts`
- Done: 新旧の関連assertionがすべて通り、テスト弱体化やskipがない。

### Step 4: browser成果物を生成し、広げた検証を行う

- 状態: completed
- 対象: root sourceから既存scriptが生成するbrowser出力
- 依存: Step 3
- 成果: 表示変更をbrowser配布経路へ反映する。
- 検証: `npm run typecheck`、`npm run build:browser`、必要に応じてfocused browser/visual check
- Done: typecheckとbrowser buildが成功し、生成物がroot sourceと一致する。

### Step 5: 最終レビューとコミット

- 状態: completed
- 対象: 全タスク所有差分
- 依存: Step 4
- 成果: 意図した正本・実装・テスト・生成物だけを安全にコミットする。
- 検証: `git diff --check`、関連diff、`git status --short`
- Done: pre-existingの `worker-public/` 差分をstageせず、タスク固有差分だけがcoherent commitになっている。

## 3. 完了チェックリスト

- [x] 設計の全完了条件を満たす
- [x] `01-rulebook.md` と `正本/演出正本.md` を更新する
- [x] canonical TypeScript sourceを先に変更する
- [x] 上下slotの手札起点と透明度フェードをfocused testで証明する
- [x] 既存phase時間・接触callback・cleanupを維持する
- [x] typecheckとbrowser buildを成功させる
- [x] `git diff --check` と最終status/diffを確認する
- [x] pre-existing `worker-public/` 差分をコミットへ混入させない
- [x] タスク固有差分をコミットする

## 4. Self-review

- 設計の要件を、仕様→正本source→実装→focused test→browser生成→commitの依存順に並べた。
- player-visible sourceを生成物より先に更新し、root TypeScriptを正本として編集する順序を明示した。
- 手札が空の場合のfallback、上側回転補正、opacity liveness guardはStep 2とStep 3のDone条件へ含めた。
- Worker/network契約は変わらないためparityやmirror再生成を必須化せず、表示変更に必要なbrowser buildへ絞った。
- 最終statusに既に存在する `worker-public/` 差分が残ることを前提に、stage対象からの除外を明示した。
