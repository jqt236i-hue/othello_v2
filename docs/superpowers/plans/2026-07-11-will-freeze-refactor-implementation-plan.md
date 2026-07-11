---
status: active
owner: repository-maintainers
scope: will-freeze-refactor-and-card-implementation
created: 2026-07-11
updated: 2026-07-11
---

# 「意志の凍結」事前リファクタリング・カード実装計画

## 1. 文書の役割

**対象:** 新カード「意志の凍結」（コスト11）を、既存の特殊石分類、凍結セル、turn pipeline、Single Visual Writer、Worker/local/headless parityを維持して実装する。その前提として、特殊石対象収集と凍結セル付与の責務を局所的に分離する。

**文書の役割:** 仕様確定からリファクタリング、headless実装、CPU/UI統合、生成物同期、実機検証、コミットまでを依存順に実行できるアクティブ計画である。

**Source of truth:** プレイヤー可視仕様は `01-rulebook.md` と `正本/カード仕様正本.md`、共通保護・特殊石分類は `正本/共通ルール正本.md`、内部境界は `docs/architecture-contracts.md` と各 `AGENTS.md` に従う。本計画だけをゲーム仕様の正本にしない。

**Non-goals:** 即時カード全体のdispatcher再設計、marker互換層の全面撤去、特殊石レジストリ全体の再統合、新しい凍結状態モデルの導入、public network schema変更、長時間selfplay・学習は対象外とする。

## 2. 予定する完成仕様

ユーザーが明示した確定入力は、表示名、コスト11、「盤面にいる特殊石を全て凍結状態にする」「意志の喪失の凍結版」という効果骨格である。次表のそれ以外は、既存ルールから導いた**実装既定値**であり、Phase 1で正本へ反映して初めて仕様確定とする。既存正本と衝突する、またはプレイヤー体験を materially 変える別解が見つかった場合は実装せず、最小の判断事項だけをユーザーへ確認する。

| 項目 | 決定 |
| --- | --- |
| 表示名 | 意志の凍結 |
| 内部type | `MASS_FREEZE_WILL` |
| コスト | 11 |
| 表示タイプ | `特殊`を第一候補とし、正本更新時に確定 |
| 解決方式 | 対象選択なしの即時効果 |
| 基本効果 | 盤面上の対象特殊石が存在するセルを、敵味方を問わずすべて5ターン凍結 |
| 対象分類 | 特殊石本体、罠石、時限爆弾。弱い石・強い石・幽体石・残像石・復活石などを含む |
| 対象外 | 通常石、石状態、盤面マーカー、配置時効果、不可侵の顕現石 |
| 隠し罠と使用可否 | 相手の非公開罠だけではカードを使用可能にしない。公開対象または自分に見える対象が1つ以上必要 |
| 隠し罠と解決 | カードが合法に使用された後のcanonical全体解決では相手の隠し罠も凍結する |
| 隠し罠の公開範囲 | 公開`FREEZE`により凍結セルの位置は全viewerへ見えるが、元の`TRAP` type・owner-only metadataは従来どおり非公開 |
| 完全保護 | 既存「凍結の意志」と同じセル効果として、完全保護中の特殊石があるセルも対象 |
| 既存凍結 | すでに有効な`FREEZE`があるセルは対象外。残りターンを延長・上書きしない |
| 重複 | 同一セルに対象markerが複数あっても`FREEZE`は1個だけ付与 |
| 持続所有者 | 全`FREEZE` markerのownerはカード使用者。使用者ターン開始時に減算 |
| 凍結中の挙動 | 既存`FREEZE`と完全に同じ。反転・破壊・移動を防ぎ、反転経路を遮断し、同セルの対象ライフサイクルを停止 |
| 使用条件 | 新たに凍結できる対象セルが1つ以上ある場合のみ使用可能 |
| 手札破壊 | なし。「意志の喪失」から引き継ぐのは全体対象範囲であり、追加コストではない |
| 音 | 対象数にかかわらず凍結確定音は1回。セルごとに重ねて鳴らさない |
| 表示 | 各対象セルへ既存の氷overlayと残りターンを表示。新しいboard writerを追加しない |

カード短文の初期案:

> 盤面上のすべての特殊石を5ターン凍結する。凍結中の石は反転・破壊・移動されず、持続ターンも減少しない。

## 3. 実行状態

| Phase | 状態 | 依存 | 主な完了証拠 |
| --- | --- | --- | --- |
| 0. 実行準備とbaseline | pending | なし | clean/説明済みworktree、focused baseline PASS |
| 1. 仕様正本の確定 | pending | Phase 0 | rulebook・正本diff、docs検証 PASS |
| 2. 特殊石対象収集の分離 | pending | Phase 1 | collector parity、LOSS_WILL回帰 PASS |
| 3. 凍結セル付与primitiveの分離 | pending | Phase 2 | FREEZE_WILL回帰、primitive tests PASS |
| 4. 「意志の凍結」headless実装 | pending | Phase 3 | 使用可否・一括解決・turn tests PASS |
| 5. カタログ・UI・演出統合 | pending | Phase 4 | catalog生成、UI focused、browser build PASS |
| 6. CPU・network/runtime parity | pending | Phase 4～5 | CPU focused、network parity、worker mirror検証 PASS |
| 7. 総合検証・実機確認・完了 | pending | Phase 1～6 | 全verification bundle、最終diff、完了commit |

既存の別アクティブ実装計画と同じphysical checkoutでimplementation phaseを並行実行しない。本計画のPhase 1以降へ入る前に、他taskが完了または停止し、既存dirty fileが整理済みであることを確認する。2026-07-11の自己レビュー時点では、`worker-public/*`、`docs/perf/*`、`test/e2e/network-special-stone-late-game.e2e.test.ts`に別taskと見られる変更があるため、Phase 0 gateは未達である。

## 4. 共通制約

- 各Phase開始・終了時に`git status --short`を実行する。
- unrelatedまたは説明不能なdirty fileがある場合、Phase 1以降を開始しない。今回確認済みの`worker-public/*`、`docs/perf/*`、network special-stone E2Eの既存差分は本計画へ混ぜない。
- branch、tag、worktreeを作らない。必要ならユーザーの明示指示を得る。
- root TypeScriptと`cards/catalog.json`を先に編集する。`dist/`、`public/module-registry.js`、`worker-public/`、生成catalogをsourceとして手編集しない。
- core logicはheadlessかつ決定的に保つ。DOM、sound、timer、network client、UI globalを`game/`、`shared/`へ入れない。
- canonical state変更とpresentationはordered `events[]`で接続し、Single Visual Writerを維持する。
- marker配列の既存順序をsortしない。対象セルの重複排除は最初に現れた座標順を維持する。
- 既存テストを削除、skip、弱体化して通さない。
- 各coherent unitはfocused verification後にtask-owned filesだけをcommitする。Phase 4～6は例外なく1つのunitとして扱い、既存dirty fileをstageしない。
- artworkが存在しない場合、カード画像の完成を偽装しない。Phase 5のrelease gateとして明示的に止める。
- `cards/catalog.json`、`src/types/card.ts`、CPUの明示profile、commentary、生成catalogは閉集合契約を持つ。新type追加後にいずれかだけを未更新でcommitしない。
- Phase 4～6は1つのfeature landing unitとして扱う。途中でfocused testを実行しても、catalog/type/profile/runtime parityの閉集合が通るまでcommitしない。

## 5. File map

| 責務 | 主な変更候補 | 主な検証候補 |
| --- | --- | --- |
| 仕様 | `01-rulebook.md`, `正本/カード仕様正本.md`, 必要時`正本/共通ルール正本.md`, `正本/効果音対応表.md` | `git diff --check`, Markdown inspection |
| 特殊石分類・対象収集 | Reuse: `shared/special-stone-registry.ts`; Modify: `game/logic/cards-internal/effect-target-counts.ts` | `test/shared.special-stone-registry.test.ts`, `test/game.cards.effect-target-counts-module.test.ts`, `test/game.loss-will.test.ts` |
| 凍結付与 | `game/logic/card-resolution/status-cells.ts`, `game/logic/cards.ts` | `test/game.freeze-will.test.ts`, 新規mass-freeze focused test |
| 使用可否・即時解決 | `game/logic/cards-internal/card-usage-prechecks.ts`, `game/logic/cards-internal/hand-manager.ts`, `game/logic/cards-internal/context-builders.ts`, `game/cards/effect-resolver.ts`, `game/cards/card-usage-validation-stage.ts`, `game/turn/card-usage/immediate-effects.ts` | 新規card-use/turn pipeline focused test |
| 型・カタログ閉集合 | `src/types/card.ts`, `cards/catalog.json`, generated catalog群, `shared-constants.ts`は参照のみ | `test/cards.catalog.test.ts`, `test/cards.pending-selection-contract.test.ts`, `test/match-runtime-parity.test.ts` |
| カタログ・詳細UI | `cards/card-interaction-effects.ts`, effect tags、rules/help/deck detail既存経路 | catalog/UI detail focused tests |
| 演出・音・ログ | `game/turn/pipeline-ui/*`, `ui/animation-status-events.ts`, sound cue mapping | pipeline UI adapter、sound cue、animation focused tests |
| CPU・commentary | `game/ai/cpu-policy-card-type-flags.ts`, `game/ai/cpu-policy-card-use-decision.ts`, `game/ai/cpu-policy-card-profiles.ts`, 必要時`game/ai/cpu-policy-card-taxonomy.ts`, `game/ai/commentary-data.ts`, 必要なcontext/count投影 | CPU policy/profile/commentary closed-world tests |
| Network/Worker | canonical snapshot既存経路、`workers/`は必要時のみ。生成mirrorは`npm run worker:prepare` | `npm run test:network:parity` |
| Browser生成 | `public/module-registry.js`, `index.html`は`npm run build:browser`出力 | browser build freshness、small UI smoke |

新規runtime moduleを追加する設計へ変更した場合は、`entry-browser.js`、`workers/match-worker-runtime-preload.ts`、worker preload testsを必ずFile mapへ追加する。本計画の既定設計では、既存`effect-target-counts.ts`と`status-cells.ts`へ責務を収め、新しいpreload対象moduleを増やさない。

実装時に責務の所在が変わっている場合、同じauthorityを持つ現行sourceを探し、このFile mapを先に更新する。

---

## Phase 0 — 実行準備とbaselineを固定する

### Task 0.1: checkout安全性を確保する

**Actions:**

1. `git status --short`を取得する。
2. 既存dirty fileを本計画、別task、生成物、unknownへ分類する。
3. 別taskのdirty fileが残る場合、ユーザーの整理または明示承認なしに仕様正本更新を含む本計画作業を開始しない。
4. 別のアクティブ実装taskが同じcheckoutで動いていないことを確認する。

**Completion:** 本計画の変更だけを安全にstage・commitできる。

### Task 0.2: baselineを取得する

**Commands:**

- `npm run check:window`
- `npm run typecheck`
- `npx jest test/game.loss-will.test.ts test/game.freeze-will.test.ts --runInBand`
- `npx jest test/game.cards.effect-target-counts-module.test.ts test/shared.special-stone-registry.test.ts --runInBand`
- `npx jest test/cards.catalog.test.ts test/cards.pending-selection-contract.test.ts test/game.cpu-policy-card-profiles.test.ts test/cpu.commentary-runtime.test.ts --runInBand`

コマンド名が現行`package.json`と異なる場合は最小の同等checkへ置き換え、計画書へ実行結果と置換理由を追記する。

**Completion:** 既存LOSS_WILL、FREEZE_WILL、特殊石分類のbaselineがPASSする。既存失敗があれば本計画の変更と混同しないよう記録し、原則停止する。

**Phase 0 gate:** checkoutが安全でbaselineが説明可能。

---

## Phase 1 — プレイヤー可視仕様を正本で確定する

### Task 1.1: rulebookへカード仕様を追加する

**Files:**

- Modify: `01-rulebook.md`
- Modify: `正本/カード仕様正本.md`
- Modify if needed: `正本/共通ルール正本.md`
- Modify if needed: `正本/効果音対応表.md`

**Requirements:**

- 本計画2節の全項目を曖昧さなく記載する。
- 「石を凍結」ではなく、既存モデルに合わせて「対象特殊石が存在するセルへ`FREEZE`を付与」と解釈できる文面にする。
- 完全保護、顕現石、罠、爆弾、既存凍結、対象0、持続owner、手札破壊なしを明記する。
- 全体凍結時の音は1回、氷overlayは各セルに出ることを明記する。

**Verification:**

- `git diff --check`
- 参照見出し、カード名、コスト、持続ターンのfocused検索
- Markdown tableと箇条書きのsource inspection

**Commit:** 仕様正本だけをcommitする。例: `意志の凍結の仕様を定義`

**Phase 1 gate:** 実装判断を正本外へ残さない。

---

## Phase 2 — 特殊石対象収集をカード固有除去処理から分離する

### Task 2.1: 共通のpure target collectorを作る

**Preferred design:**

```ts
collectSpecialStoneEffectTargets(cardState): {
  markers: Marker[];
  cells: Array<{ row: number; col: number; markers: Marker[] }>;
}
```

**Requirements:**

- 分類authorityは`shared/special-stone-registry.ts`のtraitsを使う。
- 特殊石本体、trap、bombを含み、stone status、board marker、placement effect、manifest stoneを除外する。
- `row`/`col`が有効なmarkerだけをセル対象へ含める。
- 同一セルを最初の出現順で重複排除する。
- 入力marker objectと配列をmutate・sortしない。
- 完全保護や既存凍結の除外はcollectorへ埋め込まず、カード固有policyに残す。

実装先は既存`effect-target-counts.ts`を既定とする。分類データは`shared/special-stone-registry.ts`から読むが、今回必要なtraitsがすでに存在する限りregistry自体は変更しない。`shared/`へgame state走査を移さず、新しいBrowser/Worker preload moduleも増やさない。

### Task 2.2: LOSS_WILLを新collectorへ委譲する

**Requirements:**

- `collectLossWillRemovals()`の公開戻り値とmarker順を維持する。
- 完全保護、不可侵、Living Will復元、爆弾重複除外を変えない。
- `canLossWillRevertMarker()`はLOSS_WILL固有policyとして維持する。

**Tests:**

- classification matrix
- trap/bomb inclusion
- stone status/board marker/placement/manifest exclusion
- duplicate cell grouping
- invalid coordinate behavior
- existing LOSS_WILL suite

**Verification:**

- `npx jest test/game.cards.effect-target-counts-module.test.ts test/game.loss-will.test.ts test/shared.special-stone-registry.test.ts --runInBand`
- `npm run typecheck`
- `npm run check:window`

**Commit:** collector分離とLOSS_WILL委譲を1つのbehavior-preserving commitにする。例: `特殊石効果の対象収集を共通化`

**Phase 2 gate:** LOSS_WILLの外面・events・対象順がbaselineと一致する。

---

## Phase 3 — 凍結セル付与を単一選択pendingから分離する

### Task 3.1: 検証と更新を分離したFREEZE付与primitiveを作る

**Preferred design:**

```ts
applyStatusCellMarker(cardState, {
  row,
  col,
  owner,
  markerType: 'FREEZE',
  remainingOwnerTurns: 5,
  reason
}, deps)
```

**Primitive responsibilities:**

- 同じtypeの既存board markerを必要に応じて除去または拒否する。
- canonical markerを1つ付与する。
- `STATUS_APPLIED`を1件発行する。
- 成否と座標を返す。

**Primitive non-responsibilities:**

- pending type/stage検証
- target選択可能性検証
- pending解除
- UI、sound、network publish

一括付与側は、依存関数、全座標、重複、既存block marker、board shapeを**1件もmutateする前に全件検証**する。検証通過後は途中で通常のvalidation failureを返さず、同じmarker snapshotを前提に全件適用する。予期しない例外をcatchして部分成功結果へ変換しない。既存`addMarker()`のmarkerId/createdSeq採番を迂回する直接配列代入もしない。

### Task 3.2: 既存FREEZE_WILLをprimitiveへ委譲する

`applyFreezeWill()`は従来どおりpendingとtargetを検証し、primitiveを1回呼び、成功後にpendingを1回解除する。

**Tests:**

- primitive単体でFREEZEが1つ付く
- deps不足/不正座標の失敗が成功形にならない
- FREEZE_WILLのpending、invalid target、event、owner、5ターンが不変
- 既存凍結、種、穴、封鎖の対象可否が不変

**Verification:**

- `npx jest test/game.freeze-will.test.ts --runInBand`
- status-cell moduleの新規focused test
- `npm run typecheck`
- `npm run check:window`

**Commit:** behavior-preserving refactorだけをcommitする。例: `凍結セル付与を選択処理から分離`

**Phase 3 gate:** 既存「凍結の意志」のcanonical resultとpresentation eventがbaseline一致。

---

## Phase 4 — 「意志の凍結」をheadlessで実装する

### Task 4.1: 対象セルqueryと使用可否を実装する

**API候補:**

- `collectMassFreezeWillTargets(cardState, gameState, playerKey)`
- `getMassFreezeWillTargetCount(cardState, gameState, playerKey)`

実装上は、情報秘匿を守るため次の2つを区別する。

- **Usability targets:** 公開対象と使用者自身が知る対象。相手のhidden trapは除外し、秘密情報だけでカードの有効/無効表示が変わらないようにする。
- **Resolution targets:** server/headless canonical state上の全対象。カード使用が合法に成立した後は相手hidden trapも含める。

**Filtering order:**

1. Phase 2の特殊石effect targetを取得
2. 不可侵セルを除外
3. 現在有効な`FREEZE`があるセルを除外
4. 盤面形状外・消滅セルを除外
5. 座標順を維持したまま一意セル化

完全保護は除外しない。usability targetが0ならcard usage precheckを失敗させ、手札・布石・pendingを変更しない。network clientのviewer投影から失われた相手罠を推測したり、client-authored availability flagをauthorityにしたりしない。

### Task 4.2: 一括解決moduleを実装する

**Preferred location:** 既存`game/logic/card-resolution/status-cells.ts`。Phase 3で分離したprimitiveと同じmoduleに`applyMassFreezeWill()`を置き、Browser/Worker preload対象を増やさない。責務が既存moduleへ収まらない具体的証拠が出た場合だけ別module化し、その場合は`entry-browser.js`とWorker runtime preloadを同じtaskで更新する。

**Requirements:**

- pending typeが`MASS_FREEZE_WILL`であることを検証する。
- query結果を解決直前に再取得する。
- 全対象へPhase 3のprimitiveを適用する。
- 全markerのownerを使用者、`remainingOwnerTurns`を5にする。
- 各セルの`STATUS_APPLIED`順はcollector順とする。
- 完了後にpendingを1回だけ解除する。
- `{ applied, frozenCount, targets }`を返す。
- 部分成功をsuccessとして偽装しない。事前query済み対象で予期しない失敗が起きた場合は明示的に失敗させる。
- 全件事前検証後にだけmutationを開始し、通常のinvalid targetで途中停止しない。

### Task 4.3: card-use pipelineへ接続する

**Requirements:**

- target selection registryへ登録しない。
- 通常のcard consumptionと布石支払い後、即時効果として解決する。
- `mass_freeze_will_resolved`要約eventを1件追加する。
- 手札破壊を呼ばない。
- 通常どおり石配置へ進める。手番を強制終了しない。
- `game/logic/cards.ts`のpublic facade、effect target count factory、context builder、usage validation、usable-hand列挙の全経路へ同じqueryを注入し、UI/CPU/Workerで使用可否を重複実装しない。

### Task 4.4: focused rule testsを追加する

**Mandatory cases:**

- 敵味方の特殊石本体を全て凍結
- protected/perma-protected/ghost/afterimage/regenを包含
- hidden trapとTIME_BOMBを包含
- 相手hidden trapだけの局面では秘密情報を理由に使用可能にならない
- 別の公開対象によって合法使用された場合、canonical解決では相手hidden trapも凍結
- GUARD併存セルも凍結
- stone status、board marker、placement effect、manifest stoneを除外
- 同一セル複数markerを1セルとして処理
- 既存FREEZEを延長しない
- 対象が既存凍結だけなら使用不可
- 対象0なら使用不可かつ無消費
- 全FREEZE ownerが使用者
- 使用者ターン開始だけで減算
- 凍結中は対象markerのライフサイクルが停止し、解凍後に再開
- ordered eventsと`frozenCount`が一致
- 手札を破壊しない

**Verification:**

- 新規`test/game.mass-freeze-will.test.ts`
- card usage/precheck/turn pipelineの最小関連suite
- `npx jest test/game.freeze-will.test.ts test/game.loss-will.test.ts test/game.mass-freeze-will.test.ts --runInBand`
- `npm run typecheck`
- `npm run check:window`

**Commit:** この時点ではcommitしない。新typeはcatalog、`CardType`、CPU profile、commentaryと閉集合であり、Phase 5～6完了前のcommitはrepository-wide contractを壊す。focused test結果を保持してfeature landing unitを継続する。

**Phase 4 gate:** Node/headlessでカード使用から5ターン凍結まで完結し、既存2カードの回帰がない。

---

## Phase 5 — カタログ、カード詳細、演出、音を統合する

### Task 5.1: catalog sourceと生成物を更新する

**Files/Actions:**

- `cards/catalog.json`へ`MASS_FREEZE_WILL`、コスト11、確定説明文を追加
- `src/types/card.ts`の`CardType`へ同typeを追加
- `npm run generate:catalog`
- artworkファイルを既存命名規則で配置
- `npm run generate:card-art-map`

生成された`cards/catalog.ts`、`cards/catalog.js`、`cards/catalog.generated.js`、card art mapはスクリプト出力だけを採用する。

カード画像生成スクリプトはcatalog内の全カードに対応画像を要求し、欠落時に失敗する。したがって、artwork配置前に`npm run generate:card-art-map`を成功扱いにしない。ファイル番号は空き番号を調査して決め、計画書の推測で固定しない。

**Artwork gate:** 対応画像が未提供なら、既存画像の流用や無断placeholderでrelease completeにしない。ロジック作業は保持できるが、Phase 5と最終完了はblockedとして報告する。

### Task 5.2: UI説明とタグを追加する

**Requirements:**

- quick text、詳細文、5ターンタグを追加する。
- 対象選択promptやpending selection actionは追加しない。
- 「特殊石」の用語highlight/popoverを既存仕組みで使う。
- 通常カードの五角形frameと表示タイプ規則に従う。
- `game/ai/commentary-data.ts`はcatalog fallbackだけに任せず、カード固有summaryが必要か確認してclosed-world commentary testを通す。

### Task 5.3: 複数セル演出を既存events経路で再生する

**Requirements:**

- 各`STATUS_APPLIED`から既存の氷overlayを反映する。
- 同一phase内で全対象を反映し、対象数に比例した長い直列待機を作らない。
- freeze確定sound cueは要約eventから1回だけ発行する。
- board全再描画や第二のDOM writerを追加しない。
- 戦況表示は`意志の凍結: N個を凍結`相当の1件にまとめる。

**Tests:**

- catalog definition
- detail text/tags
- pipeline UI adapter phase ordering
- sound cue exactly once
- multiple freeze overlays/timers
- normal playでdebug副作用なし

**Verification:**

- 最小のcatalog/UI/pipeline/sound focused Jest
- `npx jest test/cards.catalog.test.ts test/cards.pending-selection-contract.test.ts test/cards.card-art-map.generate.test.ts --runInBand`
- `npm run generate:catalog`再実行後にdiffなし
- `npm run generate:card-art-map`再実行後にdiffなし
- `npm run build:browser`
- browser build freshness check

**Commit:** まだcommitしない。Phase 6のCPU explicit profileとruntime parityを同じfeature landing unitへ揃える。

**Phase 5 gate:** カードが一覧・手札・詳細・対局画面に正しい名称、コスト、説明、画像、演出で表示される。

---

## Phase 6 — CPU判断とnetwork/runtime parityを完成させる

### Task 6.1: CPU card typeと評価contextを追加する

**Required inputs:**

- 自分の新規凍結対象セル数
- 相手の新規凍結対象セル数
- trap/bombを含む対象内訳
- 既存凍結済みを除いた値

`cpu-policy-card-profiles.ts`のbase score、usage style、move plan profile、`cpu-policy-card-type-flags.ts`の明示flag、必要なtaxonomyをすべて更新する。catalog全typeを列挙するclosed-world testsを先に確認し、fallback scoreだけで通ったように見せない。

**Baseline policy:**

- 相手対象が0で自分対象だけの局面では原則使用しない。
- 相手対象が自分対象を明確に上回るほど評価を上げる。
- 相手の期限付き・起動型特殊石や爆弾を止める価値を加点する。
- 自分の期限付き特殊石を保護し、持続減少も止める利点は小さな加点に留め、無条件使用にしない。
- コスト11と通常配置機会を既存score体系で差し引く。
- Lv別policyやrandom call orderを不必要に変えない。

**Tests:**

- opponent advantageで候補評価上昇
- own-onlyでは抑制
- already frozenを二重評価しない
- target0はusable cardsへ出ない
- deterministic seedで同一判断
- catalog全typeのbase score / usage style / move plan profile coverage
- commentary label / summary coverage

### Task 6.2: snapshot・Worker・local parityを確認する

新しいcanonical fieldやclient-authored availability flagは追加せず、既存`FREEZE` markerだけをsnapshotへ載せる。カードtype、ordered events、marker owner/timerがWorker/local/headlessで一致することを確認する。hidden trapが凍結された後は、公開`FREEZE` markerと氷overlayは全viewerへ見せる一方、元の`TRAP` marker、type、owner-only metadataは相手とspectatorのprojectionから除外し続ける。

**Verification:**

- CPU focused Jest
- `npx jest test/game.cpu-policy-card-profiles.test.ts test/game.cpu-policy-core.test.ts test/cpu.commentary-runtime.test.ts --runInBand`
- `npm run test:network:parity`
- `npm run test:match:parity`
- `npx jest test/match-runtime-parity.test.ts test/workers.match-worker-preload.test.ts --runInBand`
- `npx jest test/workers.match-trap-visibility.test.ts --runInBand`
- 必要なWorker/local focused contract tests
- standalone mirror検証として`npm run worker:prepare`
- `git diff --check`

`worker:prepare`前に既存`worker-public`差分が本計画外なら停止し、上書きしない。

**Commit:** Phase 4～6のheadless、type/catalog、artwork、UI/presentation、CPUを、全closed-world/focused checks通過後に1つのfeature commitとしてcommitする。例: `意志の凍結を実装`。mirror生成物は本計画に必要で既存差分と安全に分離できる場合だけ、検証後の独立commitにする。

**Phase 6 gate:** CPUがカードを合法かつ決定的に扱い、network authority間にstate/event差がない。

---

## Phase 7 — 総合検証、実機確認、完了処理

### Task 7.1: verification bundleを実行する

**Required:**

1. `git status --short`
2. `npm run check:window`
3. `npm run typecheck`
4. focused LOSS_WILL / FREEZE_WILL / MASS_FREEZE_WILL suites
5. focused catalog / UI / sound / CPU suites
6. `npm run test:network:parity`
7. `npm run build:browser`
8. `node scripts/check-browser-build-up-to-date.js`
9. `npm run worker:prepare`（Phase 6の安全条件を満たす場合）
10. `npm run test:match:parity`
11. catalog/type/CPU/commentary closed-world tests
12. `git diff --check`

Focusedで十分に保証できないcross-runtime失敗が見つかった場合だけ、`npm run test:jest`または`npm run checkall`へ拡大する。失敗をskipせず、初回失敗とretry結果を両方記録する。

### Task 7.2: 実機ゲームで最小シナリオを確認する

**Scenario:**

1. 黒白双方に複数の特殊石、罠、爆弾を用意する。
2. 一部へ完全保護、一部へ既存凍結を付ける。
3. 「意志の凍結」を使用する。
4. 新規対象だけに氷overlayと残り5が同時表示されることを確認する。
5. 音が1回、ログが1件、操作lockが正常解除されることを確認する。
6. 反転、破壊、移動、反転経路遮断を確認する。
7. 使用者ターン開始でだけ凍結が減り、特殊石タイマーが停止・再開することを確認する。
8. network matchでも相手画面と再接続snapshotが一致する最小ケースを確認する。

可能なら既存Playwright/Jest E2Eの最小シナリオとして自動化する。新しい大規模visual baselineは必要性がある場合だけ追加する。

### Task 7.3: 最終diffとコミットを確認する

- `git status --short`でtask-owned/unrelatedを再分類する。
- `git diff --stat`と対象pathのdiffを読む。
- source、生成物、mirrorの関係を確認する。
- 未commitのtask-owned diffがあれば、検証済みの coherent unitとしてcommitする。
- unrelated dirty fileはstageせず、最終報告に列挙する。

**Final completion criteria:**

- Phase 1の仕様が正本化されている。
- 2つの事前リファクタリングがbehavior-preserving test付きで完了している。
- 新カードがheadless、browser、CPU、Worker/local networkで使用できる。
- catalog、説明、タグ、画像、音、氷overlay、ログが完成している。
- 対象分類、完全保護、既存凍結、対象0、持続減算が仕様一致している。
- required verificationがPASSしている。
- task-owned diffがすべてcommit済みである。
- 生成物やmirrorをsourceとして手編集していない。

## 6. Stop conditions

次の場合は成功扱いにせず、該当Phaseで停止してユーザーへ報告する。

- 正本間で対象範囲、完全保護、凍結持続の解釈が衝突する。
- unrelated dirty fileとtask-owned生成物を安全に分離できない。
- artworkがなく、完成カードとしての表示を保証できない。
- 既存FREEZEのprimitive分離でcanonical event順が変わる。
- Worker/local/headlessでmarker owner、timer、event順が一致しない。
- hidden trapだけで相手のカード使用可否表示が変わる、または凍結後のviewer snapshotへ元`TRAP` metadataが漏れる。
- 複数overlay再生に第二のboard writerが必要になる。
- verification失敗の解消にテスト弱体化や成功形fallbackが必要になる。

## 7. 推奨コミット列

1. `意志の凍結の仕様を定義`
2. `特殊石効果の対象収集を共通化`
3. `凍結セル付与を選択処理から分離`
4. `意志の凍結を実装`（Phase 4～6の閉集合を1commit）
5. 必要時のみ生成mirrorまたは最終verification調整の独立commit

各commitはその時点でbuild可能かつfocused tests PASSとし、壊れた中間状態をcommitしない。
