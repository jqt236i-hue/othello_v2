# 64カード バグ根絶・合理的リファクタ・Playwright検証 実行設計・計画・手順書

作成日: 2026-03-14
対象: cards / game / ui / cpu / shared / test / tests / scripts / worker-public / docs
状態: 計画確定前

## 0. この文書の位置づけ

- この文書は、64種類すべてのカードについて、仕様差・実装差・UI差・演出差・CPU差・browser差を有限の工程で潰し切るための master runbook である。
- 一次仕様は 01-rulebook.md、カード定義の一次情報は cards/catalog.json とする。
- 挙動や見え方を変える修正に入る場合は、必ず 01-rulebook.md を先に更新する。
- この文書は「絶対に未知の不具合が 0 であること」を数学的に証明する計画ではない。ここでいう「根絶」は、明示した閉じた検証範囲の中で、既知不具合と再現可能な不具合を 0 にし、64カードすべてを定義済みの完了条件で通し切る運用上の完了を意味する。

## 0.1 根絶の運用定義

この runbook における「完遂」は、次の全条件を満たした時だけ成立する。

1. 64カードすべてがカード別完了チェックを満たしている。
2. Sev0 / Sev1 / Sev2 の未解決不具合が 0 件である。
3. 64カードのうち、選択型・継続型・移動型・破壊型・手札型・拡張型・乱数型の各系統で browser 実機相当の Playwright 検証が green である。
4. 合理的リファクタの対象として定義した横断重複が、未着手ではなく「解消済み」または「今回は非対象として明示済み」のどちらかになっている。
5. root を正本とした worker-public 同期と代表回帰が完了している。
6. 変更で挙動が変わった箇所は 01-rulebook.md に反映済みで、変わっていない箇所は「内部整理のみ」と明示できる。

## 0.2 この runbook の終了点

- フェーズ 0 から 6 までを完了し、最後の「全体終了条件」をすべて満たした時点で終了とする。
- 追加の「次に直せるところ」が残っていても、全体終了条件を満たしたらこの runbook は閉じる。
- 終了後の改善案は別 runbook に切り出す。今回の文書に「次に進めるなら」を無限に足し続けない。

## 0.3 完了扱いにしない条件

- 64カードのうち 1 枚でもカード別完了チェックが未完了。
- Playwright か Jest のどちらかで赤が残っている。
- browser だけ通らない、headless だけ通らない、worker-public だけ壊れる、のいずれかが未解決。
- 既知の再現手順付き不具合が backlog に残っている。
- 仕様変更を伴ったのに 01-rulebook.md を更新していない。
- worker-public を root と独立に手修正したまま同期根拠がない。

## 1. 目的

- 64カードすべてについて、仕様・logic・UI・演出・CPU・browser 実機相当を同じ完成基準でそろえる。
- バグ修正と同時に、横断重複や責務漏れを合理的に整理し、同じ不具合が別カードへ再発しにくい構造へ寄せる。
- Jest と Playwright と実践デバッグの 3 系統を接続し、「修正したが browser だけ壊れた」を防ぐ。
- 完了判定を明文化し、終わる時に本当に終われる計画にする。

## 2. 非目標

- 新カードの追加
- カードバランス調整そのもの
- 見た目を大きく変える UI リデザイン
- AI の全面再学習
- worker-public 構造の全面再設計
- 数学的な無欠陥証明

## 3. 前提と制約

- game/ は ui/ に直接依存しない。
- ui/ は game/ の公開 API / events / DI のみを使う。
- cpu/ は読み取り専用で DOM/UI/音/タイマーを直接触らない。
- root を正本にし、worker-public は npm run worker:prepare で同期する。
- pending target の generic chooser は game/turn-handlers/pending-target-selector.js に寄せ、async ONNX / rerank は game/cpu-decision.js に寄せる。
- browser 読み込み順は index と module preload の契約を壊さない。
- 実践デバッグでは ?debug=1 と Playwright を積極利用するが、通常時副作用を増やさない。

## 4. 既知の高危険テーマ

- marker の寿命と解除順
- 乱数カードの再現性と replay 一致
- stale playback lock による hand click / selection dead state
- expansion cell と main board の境界差
- pending target と UI selection のズレ
- browser と headless の分岐増殖

## 5. 64カードの作業割当

### Wave 1: 入口・pending・基本配置

- TREASURE_BOX
- FREE_PLACEMENT
- LAST_RESORT
- SNIPER_WILL
- PROTECTED_NEXT_STONE
- SWAP_WITH_ENEMY
- POSITION_SWAP_WILL

### Wave 2: 保護・移動・選択型変換

- PERMA_PROTECT_NEXT_STONE
- STRONG_WIND_WILL
- SUPER_BUOYANCY_WILL
- SUPER_GRAVITY_WILL
- TRAP_WILL
- TEMPT_WILL
- CHAIN_WILL
- TABOO_REVERSE_WILL

### Wave 3: 継続・生成・複製

- REGEN_WILL
- DESTROY_ONE_STONE
- TIME_BOMB
- ULTIMATE_REVERSE_DRAGON
- BREEDING_WILL
- CLONE_WILL
- TELEPORT_WILL

### Wave 4: 爆弾・多動・移動特殊

- CELL_TELEPORT_WILL
- CROSS_BOMB
- X_BOMB
- HYPERACTIVE_WILL
- HYPERACTIVE_INHERIT_WILL
- EXTREME_HYPERACTIVE_WILL
- ESCAPE_WILL
- ROBOT_VACUUM_WILL

### Wave 5: 捕食・手札・布石移送

- GLUTTONOUS_WILL
- WILL_HUNTER_KING
- INSTANT_HYPERACTIVE_WILL
- REBUILD_WILL

### Wave 6: 収入・債務・手札公開・倍率石

- WORK_WILL
- RIBO_WILL
- LOSS_WILL
- DOUBLE_PLACE
- HEAVEN_BLESSING
- CONDEMN_WILL
- GOLD_STONE
- RAINBOW_STONE

### Wave 7: 持続ターン操作・守護・破壊継続

- SILVER_STONE
- CRYSTAL_STONE
- EXTEND_LIFE_WILL
- CORROSION_WILL
- GUARD_WILL
- GUARDIAN_GOD
- DESTROY_DRAGON_WILL
- LIGHTNING_WILL

### Wave 8: 盤面変形・永続阻害・終盤特殊

- ULTIMATE_DESTROY_GOD
- ULTIMATE_HYPERACTIVE_GOD
- BOARD_EXPANSION_WILL
- BOARD_EXPANSION_GOD
- BLOCKADE_WILL
- METEOR_WILL
- FREEZE_WILL
- OBSERVER_WILL

## 6. カード別完了チェック

各カードは、該当する項目をすべて満たした時のみ done とする。

### 6.1 全カード共通

- spec: 01-rulebook.md と cards/catalog.json と実装が矛盾しない。
- logic: use/apply/path が再現テストで通る。
- regression: 既存関連テストと代表回帰が通る。
- browser: worker-public 同期後も browser 実機相当で壊れない。

### 6.2 選択型カードに追加

- pendingEffectByPlayer の生成、継続、cancel、完了が通る。
- UI の legal target 表示と実選択先が一致する。
- CPU pending target 選択と人間操作が同じ target 規則を使う。

### 6.3 継続型・寿命型カードに追加

- turn start / owner start / opponent start のどこで減算されるかがテストで固定されている。
- freeze / loss / tempt / destroy / swap などの横断作用で marker cleanup が壊れない。

### 6.4 移動型・生成型カードに追加

- stoneId / marker 位置同期が崩れない。
- expansion cell と main board の両方で通る。
- presentation event の順序が UI 期待と一致する。

### 6.5 乱数型カードに追加

- seed 固定時の再現性テストがある。
- replay / browser 実行で結果が食い違わない。

### 6.6 Playwright 必須条件

- そのカードを含む browser シナリオが 1 本以上 green。
- UI 由来不具合を直したカードは、修正前に再現した操作が Playwright で再発しない。

## 7. フェーズ計画

## Phase 0: Baseline 固定

### 目的

- 現状の安全網、browser 検証経路、debug 経路を固定する。

### 作業

1. card 基盤と pending 基盤の代表 Jest を green にする。
2. Playwright 依存の browser スクリプトが現環境で起動できることを確認する。
3. worker-public 同期経路を確認する。
4. 64カードの bug ledger と wave 割当を固定する。

### 代表コマンド

```powershell
npx jest --runInBand test/cards.catalog.test.js test/index.card-module-scripts.test.js test/game.pending-target-selector.test.js test/game.cards.card-used-presentation.test.js
npx jest --runInBand test/game.cpu-policy-core.test.js test/cpu.decision.refactor.test.js
npx jest --runInBand test/e2e/card_effects.e2e.test.js
npm run worker:prepare
```

### 終了条件

- baseline の Jest が green。
- Playwright を使う既存 E2E が最低 1 本 green。
- 64カードの割当と優先度がこの文書で確定している。

## Phase 1: 欠陥台帳と再現資産を閉じる

### 目的

- 「どこが危ないか」を曖昧にしない。
- 64カードすべてに、再現条件と不足検証を紐づける。

### 作業

1. 各カードについて、現行テスト、未検証点、想定 root cause を 1 行ずつ ledger 化する。
2. 高危険カードは再現 seed / board / hand / charge / pending state を固定する。
3. browser でしか出ない不具合は Playwright 再現ケースへ落とす。

### 成果物

- 64カード ledger
- 高危険カードの再現 seed 一覧
- Playwright シナリオ案一覧

### 終了条件

- 64カードすべてに「既存根拠」「不足」「想定原因」が 1 行以上ある。
- 高危険カードに再現手順がある。

## Phase 2: 安全網拡張

### 目的

- バグ修正より先に、再発防止と refactor 安全網を足す。

### 作業

1. 高危険カードの不足 Jest を追加する。
2. stale playback lock、marker lifecycle、random determinism、expansion boundary の横断 helper を先に固める。
3. Playwright で次の family smoke を用意する。

### Playwright family smoke

- hand / pending / cancel 系
- placement / free placement / two-place 系
- move / teleport / swap 系
- destroy / bomb / blocker 系
- timed marker / turn-start 系
- expansion / hole / freeze / blockade 系

### 推奨コマンド

```powershell
npx jest --runInBand test/game.pending-target-selector.test.js test/cpu.turn-handler.pending.test.js test/game.cards.pending-state-manager-module.test.js
npx jest --runInBand test/game.cards.effect-timing-module.test.js test/game.cards.markers-duration-module.test.js test/game.hyperactive.playback.test.js
npx jest --runInBand test/e2e/card_effects.e2e.test.js test/e2e/special_effects.e2e.test.js test/e2e/reset_click.e2e.test.js
```

### 終了条件

- 高危険カードの不足テストが先に追加され、修正前に赤か未実装差分を確認できる。
- family smoke の Playwright 導線が揃っている。

## Phase 3: バグ修正 Wave 実行

### 目的

- 64カードを wave 単位で潰し、1 wave ごとに完了判定を出す。

### 実行順

1. 高危険カード優先
2. 同じ root cause を共有するカードは同 wave で直す
3. 修正と refactor は混ぜるが、1 commit 相当の差分では root cause を 1 系統に絞る

### 優先修正カード

- PROTECTED_NEXT_STONE
- WORK_WILL
- HEAVEN_BLESSING
- CONDEMN_WILL
- ULTIMATE_REVERSE_DRAGON
- TIME_BOMB
- FREEZE_WILL
- LAST_RESORT

### 1カードごとの実行手順

1. spec と catalog と既存実装を照合する。
2. 再現テストまたは Playwright 再現を先に置く。
3. root cause を責務境界と契約を揃える形で修正する。
4. そのカードの targeted Jest を通す。
5. 該当 family の Playwright smoke を通す。
6. 既知の横断回帰を通す。
7. ledger を更新して open bug を閉じる。

### wave 終了条件

- wave 内 8カードがすべてカード別完了チェックを満たす。
- wave 専用の open bug が 0 件。
- wave 関連 Playwright が green。

## Phase 4: 合理的リファクタ

### 目的

- バグ修正だけで散らばった重複や分岐を、挙動維持で整理する。

### 対象

- pending / selection state 管理の重複
- marker lifespan / cleanup の重複
- random source 注入の重複
- movement / marker follow / expansion helper の重複
- presentation event 構築の重複
- cards.js に残る巨大 switch の局所委譲余地

### 原則

- 公開入口は維持し、内部だけを整理する。
- game から ui へ依存を増やさない。
- cards/ に効果 logic を戻さない。
- browser load order を壊さない。

### 終了条件

- 重複領域ごとに「解消済み」か「今回は非対象」のどちらかが明記されている。
- refactor 後も targeted Jest / Playwright / worker sync が green。

## Phase 5: Playwright 検証フェーズ

### 目的

- headless Jest では見えない UI / 演出 / browser 実行差を潰す。

### 自動 Playwright 検証

#### A. E2E Jest + Playwright

```powershell
npx jest --runInBand test/e2e/card_effects.e2e.test.js test/e2e/special_effects.e2e.test.js test/e2e/multi_turn_progression.e2e.test.js test/e2e/reset_click.e2e.test.js
```

#### B. 実機相当 match runner

```powershell
node scripts/run-ui-level-match.js --black 6 --white 6 --timeout-ms 180000 --out data/runs/card-bug-final-level-match.json
```

#### C. visual regression

```powershell
npm run test:visual
```

### 実践 Playwright デバッグ

1. npm run serve で root を起動する。
2. ?debug=1 付き URL を使う。
3. 再現 seed、console、network、snapshot、screenshot を同時に取る。
4. 1回で直らない場合は board / hand / charge / pending effect を最小再現に落とす。
5. fix 後、同じ Playwright 操作を再実行する。

### Playwright で最低限見る項目

- 手札 click が stale playback lock で死なない
- target selection highlight と実 selectable が一致する
- move / teleport / swap の着地点表示が実 state と一致する
- destroy / bomb / hole / freeze の表示順が仕様と一致する
- turn-start 自動効果のログと盤面変化が一致する

### 終了条件

- family smoke 全 green。
- 高危険カードの browser 再現ケースがすべて再発しない。
- visual regression が green。

## Phase 6: 最終回帰・同期・完了判定

### 目的

- code / browser / worker-public / docs の状態をそろえて閉じる。

### 最終回帰マトリクス

```powershell
npx jest --runInBand test/cards.catalog.test.js test/index.card-module-scripts.test.js test/game.pending-target-selector.test.js test/game.cards.card-used-presentation.test.js
npx jest --runInBand test/game.cpu-policy-core.test.js test/cpu.turn-handler.pending.test.js test/cpu.decision.refactor.test.js test/selfplay.runner.test.js
npx jest --runInBand test/e2e/card_effects.e2e.test.js test/e2e/special_effects.e2e.test.js test/e2e/multi_turn_progression.e2e.test.js test/e2e/reset_click.e2e.test.js
npm run test:visual
npm run worker:prepare
```

### 同期条件

- root 側だけを正本として編集した。
- worker-public は npm run worker:prepare で同期した。
- browser と headless の差が未解決で残っていない。

### 文書条件

- 仕様変更が入ったカードは 01-rulebook.md を更新済み。
- 仕様変更が無いカードは「内部整理のみ」と記録済み。
- 64カード ledger が closed 状態になっている。

### 全体終了条件

- 64カードすべて done。
- Sev0 / Sev1 / Sev2 open bug 0。
- 最終回帰マトリクス green。
- Playwright family smoke green。
- worker-public 同期済み。
- 01-rulebook.md 更新有無を説明できる。

## 8. 実践デバッグ手順

### 8.1 再現テンプレート

- card type
- player
- seed
- board snapshot
- hand snapshot
- charge
- pendingEffectByPlayer
- markers
- browser query
- console / network / screenshot

### 8.2 1件のバグを閉じる手順

1. browser で再現する。
2. DebugActions または直呼び出しで最小化する。
3. Jest で最小 failing test に落とす。
4. root cause を修正する。
5. Jest を green にする。
6. Playwright で元の再現手順を再実行する。
7. ledger を close する。

### 8.3 直す時の優先順位

1. state corruption
2. spec mismatch
3. browser only bug
4. CPU / pending mismatch
5. presentation / animation mismatch
6. refactor-only cleanup

## 9. 推奨成果物

- 64カード bug ledger
- 高危険カード再現集
- Playwright family smoke 一覧
- final regression 実行ログ
- worker prepare 実行ログ

## 10. 最後の判断基準

- 終わりを曖昧にしない。全体終了条件を満たしたら、この runbook は閉じる。
- 追加で直したいことが出ても、それは次の計画に切り出す。
- 「全カードの根絶」は、今回定義した closed-world 条件を全通過した時だけ名乗る。

