# 手置き演出より石が先に出る回帰の根本修正 実装計画

## 1. 文書の役割

この計画は `docs/implementation/placement-hand-stone-ordering-repair-design.md` のレビュー済み設計を、仕様更新から実ブラウザ検証・コミットまで完了させるための実行手順である。

## 2. 実装手順

### Step 1: 表示仕様と内部契約を明確化する

- 状態: completed
- 対象: `01-rulebook.md`、`正本/演出正本.md`、`docs/architecture-contracts.md`
- 成果: 手の接触前に確定石を先出ししないことと、pending gate が current runtime `cardState` を読むことを固定する。
- 検証: 文書間の整合、`git diff --check`
- Done: プレイヤー可視タイミングと内部 state 参照規則が矛盾なく記述される。

### Step 2: current runtime state の参照と writer handoff を一元化する

- 状態: completed
- 対象: `ui/runtime-state-access.ts`、board renderer、presentation handler、state adapter、DOM compatibility renderer
- 依存: Step 1
- 成果: current browser root object を legacy binding より優先し、playback queue の見落としと drain 前の premature settlement をなくす。
- 検証: focused unit / source contract test
- Done: Pixi と compatibility の両経路が共通 resolver を使い、synthetic writer が final frame を適用せず presentation drain へ譲渡される。

### Step 3: 回帰テストを追加する

- 状態: completed
- 対象: runtime state access と board playback gating の focused test
- 依存: Step 2
- 成果: stale legacy object と current root object が異なる条件を固定する。
- 検証: focused Jest
- Done: current root の presentation queue が必ず待機判定へ渡る。

### Step 4: browser 成果物と実機順序を検証する

- 状態: completed
- 対象: root source から生成する browser output、通常 Pixi 対局
- 依存: Step 3
- 成果: 配布経路でも手→接触時の石→反転の順になる。
- 検証: typecheck、`npm run build:browser`、focused Pixi check、実ブラウザ時系列確認
- Done: クリックから接触前まで確定石が出ず、接触時に石が現れる。

### Step 5: 最終レビューとコミット

- 状態: completed
- 対象: 全タスク所有差分
- 依存: Step 4
- 成果: 意図した仕様・設計・実装・テスト・生成物だけを coherent commit にする。
- 検証: `git diff --check`、関連 diff、`git status --short`
- Done: 検証済み差分がコミットされ、無関係な変更が混入していない。

## 3. 完了チェックリスト

- [x] 根本原因と非採用案を設計に記録した
- [x] プレイヤー可視仕様と内部 ownership 契約を更新した
- [x] current runtime state resolver を実装した
- [x] Pixi / state adapter / DOM compatibility を共通規則へ揃えた
- [x] presentation drain が synthetic writer を premature settle せず譲渡する
- [x] stale legacy state の回帰テストを通した
- [x] typecheck と browser build を通した
- [x] 実ブラウザで表示順を確認した
- [x] 最終 diff をレビューしてコミットした

## 4. Self-review

- 実装順を仕様・契約→共通 resolver→全 board consumer→回帰テスト→browser 実測→commit とし、生成物の先行編集を避けた。
- player-visible timing を実ブラウザで検証する手順を、unit test だけで済ませず独立した Done 条件にした。
- network snapshot parity は payload や authority を変更しないため必須化せず、Single Visual Writer と Pixi playback の focused check を優先した。
- fallback backend だけ同じ誤りを残さないよう、DOM compatibility を明示的な実装対象に含めた。
- 実機再計測で見つかった readiness settlement も同じ実装単位へ含め、state resolver だけで完了扱いにしない計画へ修正した。
- 失敗した検証を test 弱体化で回避せず、blocker として最終レビュー前に止める順序にした。

## 5. 実装後の検証結果

- focused Jest: 6 suites / 93 tests passed
- `npm run typecheck`: passed
- `npm run match:pixijs-board-playback-check`: 12 reports / 208 scenarios passed
- browser build: focused Pixi check 内の `npm run build:vite` と `npm run build:browser` が passed
- 実ブラウザ: 通常 Pixi 対局で、接触前フレームは手のみ・対象マスは空、接触後フレームで石が出現し、その後に反転・確定することを確認
- `git diff --check`: passed
