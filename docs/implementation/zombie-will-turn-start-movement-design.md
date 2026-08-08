# ゾンビの意志 ターン開始移動・感染間隔変更 実装設計

## 文書の役割

- 対象: `ZOMBIE_WILL` / `ZOMBIE` のターン開始移動と感染間隔変更
- プレイヤー向け一次情報: `01-rulebook.md`
- カード仕様の一次情報: `正本/カード仕様正本.md`
- ターン順・演出の一次情報: `正本/ターン進行正本.md`、`正本/演出正本.md`
- 内部構造の一次情報: `docs/architecture-contracts.md`
- 非対象: ゾンビの復活回数、感染対象の条件、噛みつき演出の新規デザイン、ネットワーク action/schema の追加

## 問題と期待結果

ゾンビの意志は、所有者ターン開始時に多動の意志と同じ候補規則で隣接1マスのランダム移動を先に解決する。感染間隔は3回ごとから4回ごとへ変更する。

移動先は canonical board topology 上の、8方向にある有効な空きマスに限定する。候補がない場合は乱数を消費せず、屍石を現在位置に残したまま感染カウント処理へ進む。感染成立時の source は移動後の位置とし、移動イベントと感染イベントの順序を canonical presentation event の順序にも反映する。

## スコープ

- `ZOMBIE_INFECTION_INTERVAL` を3から4へ変更
- `ZOMBIE` の所有者ターン開始移動を canonical headless logic に追加
- 多動の意志がすでに使っている board shape、blocked-cell、BoardOps.moveAt、決定的PRNGの経路を再利用
- 移動後位置からの感染、移動先がない場合の非移動、同一ターンに生成されたゾンビを処理しない既存契約の維持
- `MOVE` presentation event、ターン開始 raw event、ログ・効果音・Pixi/DOM互換の既存移動表示経路への接続
- 01-rulebook、カード正本、ターン進行正本、演出正本、カードカタログ・ヘルプ文言、focused tests、生成物と Worker mirror の同期

## 非ゴール

- 感染対象を敵通常石以外へ広げること
- 屍石の復活可能回数、意志の喪失、反転・破壊ライフサイクルの変更
- 移動後の通常反転や捕食を追加すること。ゾンビ移動は移動だけで、噛みつき以外の盤面効果は発生しない
- 専用のネットワーク command、snapshot schema、PRNG schema の追加
- `worker-public/` や `public/module-registry.js` の手編集

## 前提と仕様判断

1. 「自ターン開始」はゾンビ所有者のターン開始だけを指す。相手ターン開始では移動も感染カウント減算も行わない既存条件を維持する。
2. 1回の所有者ターン開始内では、`移動 → 感染カウント更新・感染判定` の順に処理する。感染元座標、噛みつき演出の発射元、感染 `CHANGE` event の `sourceRow/sourceCol` は移動後座標を使う。
3. 移動候補は多動の意志と同じ `getNeighborEmptyCandidates` の順序とする。候補がある場合だけ canonical PRNG を1回消費し、候補がない場合は乱数を消費しない。
4. 移動先には通常石・特殊石・爆弾・blocked cellを選ばない。移動元が凍結されている場合は既存のターン開始ゲートで処理自体を止める。最終的な移動可否は既存の `BoardOps.moveAt` にも通し、移動失敗時は移動結果を出さず感染処理を現在位置から続ける。
5. 既存のゾンビ感染コアは感染・カウント・マーカー生成を担い、移動の topology/BoardOps 実装は多動モジュールの小さな再利用可能な helper に置く。ゾンビモジュールから多動モジュールを直接 require せず、`CardLogic` の境界で移動関数を依存注入して循環依存を避ける。
6. 移動の表示は `BoardOps.moveAt` が出す標準 `MOVE` event を正本とする。`meta.moveIntent = hyperactive_move` と新しい `zombie_move` cause/reason を付け、既存の多動移動の single visual writer / sound cue 経路を再利用する。raw event は互換 fallback とログ用に `zombie_moved_start` を追加する。

## 現在の構造と再利用

- 候補列挙: `game/logic/cards/hyperactive.ts` の `getNeighborEmptyCandidates`
- 盤面 shape/blocked 判定: `CardHyperactiveBoardShape` と `CardLogic.isBlockedCell`
- 移動 mutation/marker移送/presentation: `BoardOps.moveAt`
- 感染カウント・敵通常石判定・感染マーカー生成: `game/logic/cards/zombie_will.ts`
- player/Worker/headless の入口: `game/logic/cards.ts` と `game/turn/turn-start/special-stone-phase.ts`
- 表示・音: `game/turn/pipeline_ui_adapter.ts`、`game/turn/pipeline-ui/*`、`ui/animation-*`、`game/special-effects/hyperactive.ts`

## 採用しない案

### ゾンビモジュール内に移動処理を複製する

候補列挙、board shape、blocked cell、marker移送、移動 presentation の実装が多動と二重化し、盤面拡張・凍結・Worker mirrorで差分が生まれるため採用しない。

### 既存の多動本体を `ZOMBIE` として呼び出す

多動本体は候補なしで通常石化し、移動後に反転を解決する。ゾンビは候補なしでその場に残り、移動後の噛みつきだけを行うため、そのまま流用すると結果が異なる。移動だけを担う helper を再利用する。

### raw eventだけで移動表示を実装する

canonical presentation event と raw event の二重実装になり、Pixi/DOM/network playback の順序保証を弱める。盤面移動は `MOVE` event、raw event は fallback/ログに限定する。

## データと制御フロー

1. ターン開始 anchor lane が所有者の `ZOMBIE` marker を処理する。
2. `CardLogic.processZombieEffectsAtTurnStartAnchor` が、移動 helperへ同じ cardState/gameState/player/anchor/PRNGを渡す。
3. helperが移動に成功したら、移動先へ marker と石を移し、`MOVE(cause=ZOMBIE, reason=zombie_move)` を発行する。
4. ゾンビ感染コアを移動先座標で実行する。カウントが1以上残る場合は移動だけで終了し、4回目なら移動後位置に隣接する敵通常石を選んで `CHANGE/STATUS_APPLIED` を発行する。
5. ターン開始 phase は `zombie_moved_start`、必要なら `zombie_infected_start` をこの順で raw event に追加する。同じターン開始中に感染で生まれた marker は固定 anchor 集合へ追加しない既存契約を維持する。
6. UI adapter は標準 `MOVE`/`CHANGE` の順序を playbackへ変換する。通常経路は既存多動相当の移動音・滑らかな1マス移動を使用し、感染時だけ既存ゾンビ噛みつき音・軌道を続けて再生する。

## 失敗時・互換性

- 移動候補なし: PRNGを消費せず、`moved`を返さず、カウント処理は現在位置で継続する。
- `BoardOps.moveAt` が拒否: 盤面とmarkerを移動させず、感染処理は元座標で継続する。
- 感染候補なし: 既存どおりカウントを4へ戻し、噛みつきeventは出さない。
- 旧snapshotで `turnsUntilInfection` が欠損または不正: 既存同様に4として正規化する。
- 旧raw eventや旧presentation event: 新しい `zombie_moved_start` がなくても既存再生を壊さない。新規移動は標準 `MOVE` が正本であり、Worker/local/headlessで同じ結果を生成する。

## 検証方針

- カタログ・quick/detail help・rulebookの4回/移動文言同期
- 4回目の所有者ターン開始で感染し、1回目・2回目・3回目は感染しない
- 所有者ターン開始ごとに1マス移動する
- 移動後座標から噛みつき、`MOVE` が `CHANGE` より先に並ぶ
- 移動先がない場合に石・カウント・乱数消費が壊れない
- focused Jest、typecheck、browser build、Worker mirror/parity checks

## 完了条件

- canonical root sourceと正本・表示文言が一致している
- focused testsが新仕様を固定している
- browser registry、TypeScript build、Worker mirrorが既存生成手順で更新されている
- 最終diffのコードレビューで、移動順序・PRNG・no-destination・single visual writer・mirror漏れに未解決の指摘がない

## Self-review

- [x] 移動と感染の順序を明示した
- [x] 候補なし時の「移動しない」と感染カウント継続を分離した
- [x] 多動の既存候補・移動経路を再利用し、ゾンビ専用の盤面移動実装を増やしていない
- [x] root sourceを先に変更し、生成物とWorker mirrorは既存scriptで同期する方針にした
- [x] UIはcanonical `MOVE`を消費し、raw eventを盤面描画のauthorityにしない方針にした
