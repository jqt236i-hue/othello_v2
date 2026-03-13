# Lv6 Champion 手修正強化計画書

作成日: 2026-03-12
対象: game / worker-public / constants / ui / scripts / test
状態: 計画書

## 0. この文書の位置づけ

- この文書は、4 ループ目で昇格した現行 `Lv6` champion を当面の固定土台として保持し、再学習や ONNX 重み更新より先に、決定層と評価手順の手修正で一段強くするための設計と実行順序を固定する。
- 一次仕様は引き続き `01-rulebook.md` とする。
- この文書は挙動変更の宣言ではなく、`browser` 実戦互換を守ったまま判断品質を底上げするための作業計画である。
- 置き手優先やカード使用抑制のように挙動が変わる修正を実際に入れる場合は、対象コミット前に `01-rulebook.md` の更新要否を判定する。
- 研究線の成果物を本番昇格線へ直接混ぜない方針は維持する。

## 1. 結論

当面の実装順は次の通りとする。

1. 置き手判断の hard filter と危険手除外を補強する
2. カード使用判断の抑制規則と charge 余力判定を補強する
3. pending target 選択の損失回避規則を補強する
4. `browser` 側共有プロファイルと ONNX fallback 条件を必要最小限だけ調整する
5. `challenger` 扱いで比較し、quick / quality / browser / ONNX の順で採否を決める

この順序にする理由は次の通りである。

- 置き手判断は `Lv6` の勝敗に最も直接効く。
- カード使用と pending target は、置き手の後に効くが、誤ると一手で損失が大きい。
- 共有プロファイルは効果が広い一方で副作用も広いため、判断規則の補強後に最小差分で触る方が安全である。
- 現行学習ループは候補モデル依存が強いため、まず champion を別名 `challenger` で比較可能な形に保ち、土台そのものを直接汚さない。

## 2. 現状ベースライン

### 2.1 土台として固定するもの

- 現行の比較基準は「4 ループ目で昇格した champion」とする。
- 学習ループ側では `production_v3` の guide を昇格済み champion に固定して判定を安定化させるため、手修正の良否判定は学習中候補ではなく固定基準相手で見る。
- モデル重み、ONNX 成果物、学習済み policy-table を最初の段階では編集対象にしない。

### 2.2 手修正の主対象

- `game/cpu-decision.js`
  - `filterMovesByLv6PlacementPriority`
  - `getMoveOpponentSpecialFlipProfile`
  - `scorePendingTargetByType`
- `worker-public/game/cpu-decision.js`
  - source 側と同じ規則を維持するための同期先
- `game/ai/cpu-policy-core.js`
  - `scoreCardUseDecision`
- `constants/cpu-lv6-shared-profile.js`
  - `lookaheadTimeCaps`
  - `onnxRuntimeGuard`
- `ui/handlers/cpu-policy.js`
  - `browser` 側 ONNX 読み込み条件と fallback 経路

### 2.3 触らない対象

- `game/logic/cards.js`
  - 一次ゲームロジック本体であり、今回の強化目的に対して影響範囲が広すぎる。
- ONNX runtime の内部実装
  - 今回は挙動調整ではなく利用条件の調整に留める。
- 研究線 profile と学習スクリプト本体
  - 今回の目的は「今ある champion を一旦強くする」であり、学習基盤の刷新ではない。
- `browser` 専用の片側修正
  - `worker-public` だけを先に直す近道は許容しない。

## 3. 進め方の原則

- champion は直接上書きせず、常に比較可能な `challenger` として扱う。
- `game` 側を正本にし、`worker-public` は各フェーズ終端で同期確認する。
- `browser` 実戦で使えない強化は採用しない。
- 「必ず」「最優先」のような要求は score bonus ではなく hard filter で実装する。
- ONNX unavailable / timeout / runtime guard 超過時の fallback を壊さない。
- 新しい外部依存は追加しない。
- 修正は小さく分け、1 コミットで 1 種類の判断改善だけを入れる。
- 修正前後で同条件の比較結果を残す。

## 4. 全体ロードマップ

### 4.1 フェーズ順

#### Phase 0: ベースライン固定

- champion と比較用 `challenger` の成果物配置方針を決める。
- 代表テストと benchmark 実行条件を固定する。
- 既知の弱点ケースをテストまたは hardcase として固定する。

#### Phase 1: 置き手判断の補強

- `corner`、相手特殊石除去、`edge` の絶対優先を確認し、必要なら危険手除外を追加する。
- score 補正で足りない箇所は hard filter 化する。

#### Phase 2: カード使用と pending target の補強

- `scoreCardUseDecision` の抑制規則を見直す。
- `scorePendingTargetByType` で特殊石や時限石の損失を避ける。

#### Phase 3: 共有プロファイルと runtime guard の調整

- Phase 1 と 2 の結果を前提に、`browser` の探索時間上限、fallback、ONNX 読み込み条件を必要最小限で調整する。

#### Phase 4: 比較・採否・切り戻し運用の固定

- `challenger` と champion を quick / quality / browser / ONNX で比較する。
- 採用条件と据え置き条件を固定し、切り戻しを手順化する。

### 4.2 マイルストーン

#### M0: 比較基準固定

- champion と `challenger` の区別が明文化されている
- 代表テストと benchmark 条件が固定されている

#### M1: 置き手判断補強完了

- 角・特殊石除去・辺の hard priority が期待通りに働く
- 危険手回避の regressions がない

#### M2: カード判断補強完了

- 通常石への誤使用や高価値石の無駄消費が減っている
- pending target の自己損失が減っている

#### M3: `browser` 実戦互換付き比較完了

- `browser` と headless で判断差が残っていない
- fallback と latency guard が維持されている

## 5. ワークストリーム A: 置き手判断の補強

### 5.1 目標

- `Lv6` が角、相手特殊石除去、辺の優先規則を取りこぼさないようにする。
- 数字マスや一時的な評価値に引っ張られて危険手を選ぶ事例を減らす。

### 5.2 対象

- `game/cpu-decision.js`
- `worker-public/game/cpu-decision.js`

### 5.3 小コミット計画

#### A1: 既知弱点ケースの固定

- `corner` を渡す危険手
- 相手特殊石除去を逃す手
- `edge` を捨てて内側を取る手

#### A2: hard filter 規則の追加または調整

- `filterMovesByLv6PlacementPriority` に閉じて判断する。
- score bonus に頼っている規則を必要なら候補絞り込みへ上げる。

#### A3: 特殊石除去価値の調整

- `getMoveOpponentSpecialFlipProfile` で対象特殊石の危険度と残りターン価値を整理する。
- 盤面 blocker は特殊石除去と混同しない。

#### A4: `worker-public` 同期確認

- source 側と同じ入力で同じ優先規則が走ることを確認する。

### 5.4 受け入れ基準

- 角、相手特殊石除去、辺の順序が崩れない。
- 数字マスは hard final priority に戻らない。
- `browser` 側ミラーとの差分が残らない。

### 5.5 優先テスト

- `npx jest test/cpu.decision.refactor.test.js --runInBand`
- `Lv6` move priority 関連の既存 CPU テスト

## 6. ワークストリーム B: カード使用判断の補強

### 6.1 目標

- 置き手の価値より明確に損なカード使用を抑制する。
- `charge` 余力と盤面緊急度に見合わない高コスト使用を減らす。

### 6.2 対象

- `game/ai/cpu-policy-core.js`
- 必要に応じて `game/cpu-decision.js` の wrapper 部分

### 6.3 小コミット計画

#### B1: 誤使用ケースの固定

- 通常石に向けた複製・分裂の誤使用
- 温存すべき回復・防御札の早出し
- `charge` 枯渇を招く高コスト先切り

#### B2: 抑制規則の整理

- `scoreCardUseDecision` の `reserveGap` と resource tight 判定を点検する。
- 強い禁止は score 低下ではなく不採用条件へ寄せる。

#### B3: `charge` 余力の基準見直し

- `corner` 緊急時、劣勢時、終盤時で最低保持量を分ける。
- 白 `Lv6` 固有の高収益カード判定は局所条件で定義し直す。

### 6.4 受け入れ基準

- 高コストカードの無駄打ちが減る。
- 温存と使用の境界が既存より説明可能になる。
- `browser` fallback 時にも同じ抑制が残る。

### 6.5 優先テスト

- `npx jest test/cpu.decision.refactor.test.js --runInBand`
- card use decision 関連の既存 CPU テスト

## 7. ワークストリーム C: pending target 選択の補強

### 7.1 目標

- `SACRIFICE_WILL`、`CLONE_WILL`、`SPLIT_WILL` などで自傷に近い選択を避ける。
- 一時効果の価値、隣接状況、今後の損失を target 選択へ反映する。

### 7.2 対象

- `game/cpu-decision.js`
- `worker-public/game/cpu-decision.js`

### 7.3 小コミット計画

#### C1: pending type ごとの失敗例固定

- 価値の高い自石を犠牲にする選択
- duration を不利に短縮する分裂対象
- 空き先や隣接先が悪い複製元の選択

#### C2: `scorePendingTargetByType` の調整

- pending type ごとに見るべき指標を明示する。
- source 不在や不適格時の中途半端な続行を止める。

#### C3: card decision 側との整合確認

- 使うと決めた時点の前提と、target 選択側の禁止条件が矛盾しないようにする。

### 7.4 受け入れ基準

- card use 後の target 選択が明確に悪化しない。
- source eligibility の二重管理が壊れていない。
- `browser` 側でも同じ target 規則が使われる。

### 7.5 優先テスト

- `npx jest test/cpu.turn-handler.pending.test.js --runInBand`
- pending target 関連の既存 CPU テスト

## 8. ワークストリーム D: 共有プロファイルと `browser` runtime guard

### 8.1 目標

- Phase 1 から 3 の補強を `browser` 実戦で安定して使えるようにする。
- 推論が遅い、読めない、fallback が暴れる、のどれかが起きる変更を不採用にする。

### 8.2 対象

- `constants/cpu-lv6-shared-profile.js`
- `ui/handlers/cpu-policy.js`

### 8.3 小コミット計画

#### D1: 現行ガードの棚卸し

- `lookaheadTimeCaps`
- `onnxRuntimeGuard`
- `browser` 側 ONNX 読み込み条件

#### D2: 最小差分の調整

- 判断規則を補強しても遅延超過や不要ロードが増えないようにする。
- `ONNX unavailable` と `timeout` の fallback 優先度は維持する。

#### D3: 実機寄り確認

- `?cpuOnnx=1` の強制読み込み系と通常起動の両方で確認する。

### 8.4 受け入れ基準

- `browser` で読み込めない強化は採用しない。
- latency guard 超過時に従来 fallback が残る。
- `worker-public` 側の共有プロファイルと source 側の値がずれない。

### 8.5 優先テスト

- `npx jest test/cpu.lv6-shared-profile.test.js --runInBand`
- `npx jest test/cpu.handler.timing.test.js --runInBand`

## 9. 比較・採否・切り戻し運用

### 9.1 運用原則

- champion 直接上書きは禁止する。
- 修正結果は必ず `challenger` 扱いで比較する。
- 採用しない判断も成功扱いとし、据え置きを許容する。

### 9.2 最小比較フロー

1. 代表 Jest を通す
2. quick 比較を行う
3. quality 比較を行う
4. `browser` 実機相当の ONNX gate を行う
5. 採用時だけ昇格・保存・切り戻し情報更新を行う

### 9.3 比較対象の成果物

- `policy-table`
- `policy-net.onnx`
- 必要なら `policy-card.onnx`
- resolved config と benchmark 出力
- promotion / rollback 用 manifest

### 9.4 関連スクリプト

- `scripts/benchmark-policy-adoption.js`
- `scripts/benchmark-policy-onnx-gate.js`
- `scripts/promote-policy-model.js`
- `scripts/rollback-policy-model.js`

## 10. テストゲート

### 10.1 ベースライン

- `npx jest test/cpu.decision.refactor.test.js --runInBand`
- `npx jest test/cpu.turn-handler.pending.test.js --runInBand`
- `npx jest test/cpu.lv6-shared-profile.test.js --runInBand`
- `npx jest test/cpu.handler.timing.test.js --runInBand`

### 10.2 フェーズ終端の最低ゲート

- Phase 1 終端
  - move priority 代表テスト
- Phase 2 終端
  - card / pending 代表テスト
- Phase 3 終端
  - shared profile / timing 代表テスト
- Phase 4 終端
  - quick / quality / ONNX gate の比較出力確認

### 10.3 比較時の記録項目

- どの champion と何を比べたか
- 対象ケースで何が改善したか
- `browser` 側で fallback したか
- 採用しなかった理由

## 11. 先にやらないこと

- モデル重みの直接編集
- 再学習や再蒸留の前提化
- 研究線 profile の追加
- `cards.js` 本体の整理
- `browser` 片側だけの応急処置
- UI 演出仕様の変更
- 数字マスを hard priority へ戻すこと

## 12. 完了条件

- champion を直接汚さずに `challenger` 比較ができる。
- `game` と `worker-public` の同期が維持される。
- `browser` 実戦互換を壊さない。
- 代表 Jest と比較ログが残る。
- `01-rulebook.md` の更新要否がコミットごとに判断されている。
- 据え置き、採用、切り戻しの 3 パターンが手順として説明できる。
