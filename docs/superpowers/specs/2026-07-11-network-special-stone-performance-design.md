---
status: implemented
owner: repository-maintainers
scope: network-special-stone-performance
created: 2026-07-11
---

# ネット対戦・特殊石大量局面の外面不変パフォーマンス設計

## 1. 文書の役割

**対象:** 特殊石が複数存在する局面、および終盤のネット対戦で発生する計算停止、描画停止、通信待ち、演出キュー滞留を、プレイヤーから見える挙動を変えずに軽量化する。

**文書の役割:** 守る不変条件、原因モデル、目標アーキテクチャ、計測方法、最終完了条件を定義した実装済み設計書である。実行結果は `docs/perf/2026-07-11-network-special-stone-completion-report.md` を参照する。

**仕様正本:** プレイヤー向け挙動は `01-rulebook.md`、内部境界は `docs/architecture-contracts.md`、作業規約は root と各ディレクトリの `AGENTS.md` に従う。本設計はこれらを置き換えない。

**正本更新方針:** 本件は内部最適化であり、`01-rulebook.md`、`正本/*.md`、`docs/HUMAN-DEV-GUIDE.md` を変更しない。いずれかの変更が必要になった時点で、本計画を停止して別の仕様変更として扱う。

## 2. 問題定義

### 2.1 観測されている症状

- 盤面上の特殊石が増えるほど、操作後から次の入力可能状態までが長くなる。
- 終盤のネット対戦でも同じ症状が発生するため、CPU探索は本設計の原因・対象に含めない。
- 重さには、JavaScriptの実行時間、Worker応答時間、スナップショットの複製・転送時間、DOM更新時間、仕様上必要な演出時間が混在する。
- 仕様上必要な演出時間は残す必要がある一方、その前後の停止、フレーム落ち、バックログ増加は削減できる。

### 2.2 現行実装から確認できる主要因

#### A. 特殊石コンテキストの重複走査

`game/logic/cards-internal/protection-context.ts` は特殊石一覧から保護状態を構築する。永久保護石の判定中に `isFrozenCellForCard()` を呼び、`game/logic/cards/markers.ts` の同関数が再度特殊石一覧を構築するため、特殊石数を `M` とすると主要部分が実質 `O(M²)` になる。

このコンテキストはルール解決だけでなく、合法手、盤面ヒント、差分描画でも生成される。1回の描画でも `ui/diff-renderer/projector.ts`、`shared/board-hint-projection.ts`、`game/move-generator.ts` を通じて重複生成される余地がある。

#### B. 合法手候補ごとのSet再構築

`game/logic/core.ts` の `getLegalMoves()` は空きマスごとに `getFlipsWithContext()` を呼ぶ。`getFlipsWithContext()` は呼び出しごとに保護石、永久保護石、封鎖マスの `Set` を作るため、同一合法手探索内で同じ変換を繰り返す。

#### C. 描画投影の重複計算

`ui/board-renderer.ts` は選択対象を計算し、続く `ui/diff-renderer/projector.ts` はカードコンテキストとヒント投影を再計算する。ヒント投影はさらに合法手用コンテキストを構築する。差分DOM更新が少なくても、その前段の投影は毎回実行される。

#### D. 演出イベントの反復検索

`game/turn/presentation-helpers.ts` と `game/turn/pipeline_ui_adapter.ts` には、特殊石または状態ごとに同じ `presentationEvents` を `find` / `some` する経路がある。特殊石数を `M`、イベント数を `E` とすると `O(ME)` になり得る。

#### E. Workerでの同一スナップショット多重処理

ネット対戦のaccepted publishでは、同じcanonical snapshotに対して以下が発生する。

- `applyTurnSafe()` 用の状態複製;
- authoritative hash計算;
- 黒、白、観戦者向けprojectionとprojected hash計算;
- presentation journal用の3 viewer snapshot生成;
- publish応答とSSE用のviewer payload生成;
- SSE resume bufferへのviewer payload複製;
- Durable Object room全体の複製と保存。

`workers/match-worker.ts`、`workers/match-worker-broadcast-controller.ts`、`utils/match-authority/projection.ts`、`utils/match-authority/presentation-journal.ts` の境界をまたいで同値データが再生成される。

#### F. クライアントでのスナップショット多重clone

`ui/network/snapshot.ts` は受信時に現在状態、受信状態、authority保持状態、visual store用状態を複製する。`ui/network/visual-state-store.ts` は保存時に加えて取得時にも全体をcloneする。特殊石markerや付随状態が増えるほど、受信・描画のmain-thread停止が増える。

#### G. 省略禁止の演出バックログ

ネット対戦ではaccepted presentation frameを順序どおり再生する。`game/turn/turn-start/marker-phase.ts` は特殊石を安定順で1体ずつ解決し、`ui/animation-engine.ts` はphaseを昇順で待機しながら処理する。

この順序、phase、演出時間を変えることは本設計の範囲外である。ただし各phase内の重複DOM read/write、演出開始前の計算停止、演出後の重複renderを減らすことで、キューが実時間より遅く消化される状態を防ぐ。

## 3. 目標

1. 特殊石コンテキスト生成を、特殊石数に対して線形にする。
2. 同一合法手探索内で保護・封鎖Setを1回だけ構築する。
3. 1回の盤面renderでカードコンテキスト、合法手、選択対象、marker投影を1回ずつだけ生成する。
4. 1回のturn/presentation変換でイベント検索indexを1回だけ生成する。
5. 1回のaccepted publishでviewer projectionをviewerごとに1回だけ生成し、同じ値を応答、journal、SSEへ再利用する。
6. Durable Object保存回数とroom全体clone回数を、authority・resume保証を保ったまま削減する。
7. クライアント受信時の全snapshot clone回数を削減し、render-only経路はreadonly参照を使う。
8. 演出順・時間を維持したまま、同一phase内のDOM read/writeと一時要素生成をまとめる。
9. 重い再現局面を自動生成し、改善前後を同じ条件で再計測できるようにする。

## 4. 非目標

- CPUレベル、CPU探索、CPU思考時間、CPU手選択を変更しない。
- 特殊石を同時処理しない。
- presentation frame、`events[]`、効果音、台詞、アニメーションを省略しない。
- phase gap、animation duration、入力ロック時間の意味を短縮しない。
- 最新snapshotへ演出を飛ばして追いつく方式へ変更しない。
- カード仕様、コスト、持続ターン、乱数選択、対象優先度を変更しない。
- Worker snapshot authorityをクライアントへ移さない。
- 公開HTTP/SSE payloadのフィールド、redaction、hash、version、operationId、reconnect意味を変更しない。
- `dist/`、`worker-public/`、`public/module-registry.js` をsourceとして編集しない。
- 既存全体リファクタ計画と同じcheckoutで並行実装しない。

## 5. 外面挙動不変契約

### 5.1 ゲーム結果

同一の初期 `gameState`、`cardState`、action、seed、依存入力に対して、改善前後で以下を一致させる。

- actionのaccept/reject結果;
- 最終 `gameState` と `cardState`;
- marker配列の要素、順序、`createdSeq`、ID;
- `events[]` の要素、payload、順序;
- presentation eventsとplayback eventsの要素、phase、順序;
- 乱数消費順と最終PRNG state;
- charge、hand、deck、discard、pending selection、turn count;
- pass、game over、result判定。

比較ではtimestampなど明示的な非決定値だけを正規化する。marker順、event順、serialized payload順、hash入力は正規化してはならない。

### 5.2 ネットワーク

- Workerとlocal serverのaccept/reject、status code、error codeを一致させる。
- `stateVersion`、`visualSeq`、operation dedupe、seat redactionを一致させる。
- publish response、SSE snapshot、presentation journal responseのJSON shapeと値を維持する。
- reconnect、SSE resume、spectator、self-publish、stream/response raceの結果を維持する。
- 保存回数を統合する場合、accepted stateとresume bufferが同一永続化単位で復元できることを故障注入テストで証明する。

### 5.3 画面・演出

- diff rendererをSingle Visual Writerとして維持する。
- animation名、duration、phase、開始順、完了順、sound cueを一致させる。
- legal hint、target highlight、特殊石画像、timer、tag、busy表示を一致させる。
- playback中の盤面先行同期を発生させない。
- 入力可能になる論理条件を変えない。

### 5.4 性能のために許容する内部差

- 一時的な`Map` / `Set` / readonly projection objectの追加;
- 同一operation内の計算結果再利用;
- 非公開内部APIの追加;
- dev/test時だけのdeep freeze、counter、performance mark;
- Durable Object内部保存の組み立て順変更。ただし公開結果と復旧結果が同一であることが必要。

## 6. 目標アーキテクチャ

### 6.1 Operation-local Marker Context

canonical marker配列を1回走査し、同じ配列順を保った以下の読み取り専用contextを作る。

```ts
type MarkerContextIndex = {
  markers: readonly Marker[];
  specials: readonly Marker[];
  manifests: readonly Marker[];
  bombs: readonly Marker[];
  blocking: readonly Marker[];
  byCell: ReadonlyMap<string, readonly Marker[]>;
  frozenCellKeys: ReadonlySet<string>;
};
```

- indexはoperation、turn phase、render単位の短命オブジェクトとする。
- canonical stateへ保存しない。
- state mutationをまたいで再利用しない。
- marker配列の順序を変えない。
- 既存 `createMarkerCellIndex()` を拡張または共通内部builderへ委譲し、別実装を増やさない。

### 6.2 Compiled Flip Context

公開 `FlipContext` の配列形式は維持し、合法手探索の入口で以下を1回だけ構築する。

```ts
type CompiledFlipContext = FlipContext & {
  protectedKeys: ReadonlySet<string> | null;
  permaProtectedKeys: ReadonlySet<string> | null;
  blockedKeys: ReadonlySet<string> | null;
};
```

`getFlipsWithContext()` は既存配列contextとcompiled contextの両方を受けられるようにし、単独呼び出し互換を保つ。`getLegalMoves()` と `hasLegalMove()` は1回compileしたcontextを全候補へ渡す。

### 6.3 Per-render Board Projection

`renderBoard()` の開始時に、同一snapshot/versionに対する以下を1度だけ作る。

- viewer/current player context;
- pending selectionとselectable targets;
- card protection context;
- legal move set;
- marker maps;
- board hint projection。

`board-renderer` と `diff-renderer/projector` は同じprojectionを読む。render終了後に破棄し、canonical gameplay stateにしない。

### 6.4 Presentation Event Index

順序付きevent配列そのものは保持し、検索専用に以下のindexを構築する。

- `type`;
- `type + row + col`;
- `special + scenario + row + col`;
- `actionId` / `effectBlockId`。

検索結果が複数ある場合は元配列indexの昇順を維持する。indexはevent生成や並べ替えに使用せず、既存の`find` / `some`相当の読み取りだけに使う。

### 6.5 Publish-local Viewer Artifacts

accepted publishごとに以下を1つの短命artifactへ集約する。

```ts
type PublishViewerArtifacts = {
  canonicalHash: string | null;
  projectedSnapshots: {
    black: PublicSnapshot;
    white: PublicSnapshot;
    spectator: PublicSnapshot;
  };
  snapshotPayloads: {
    black: SnapshotPayload;
    white: SnapshotPayload;
    spectator: SnapshotPayload;
  };
};
```

- projectionとprojected hashはviewerごとに1回だけ行う。
- journal、response、SSEは同じ値をdeep-cloneせず読み取る。所有権を渡す境界だけで必要最小限cloneする。
- 公開JSON shapeは変えない。
- artifactをroom stateやcanonical snapshotへ保存しない。

### 6.6 Single-persist Accepted Publish

accepted state、presentation journal、authority log、SSE resume bufferを送信前に組み立て、1回のDurable Object storage transactionで保存する。保存成功後にresponse/SSE送信へ進む。

現行の故障時意味を変えないことを優先し、1回保存へ統合できない場合は、room全体cloneの再利用だけを完了させ、保存回数統合は未完として報告する。成功したように見せるfallbackは禁止する。

### 6.7 Client Snapshot Ownership

- inbound JSONはcanonical inspection後に1回だけ所有copyへ変換する。
- mutable global stateへ適用するcopy、canonical store、visual storeの責任を明示する。
- 既存のcloneを返す公開getterは互換のため残せる。
- board renderer専用にreadonly `peekRenderSnapshot()` 相当を追加し、通常renderではcloneしない。
- dev/testではreadonly snapshotをdeep freezeし、rendererがmutationすると失敗させる。
- frame commit時だけvisual snapshotを更新し、getterごとのcloneを避ける。

### 6.8 Playback Phase Work Batch

異なるphaseは従来どおり直列にする。同一phase内だけで以下を共有する。

- layout rect read cache;
- transient overlay container / fragment;
- cell lookup;
- final board refresh request。

animation durationとawait境界は変更しない。

## 7. 計測設計

### 7.1 再現fixture

計測scriptはseed固定で最低3種類を作る。

1. `baseline-light`: 8x8、特殊石0～2、序盤相当。
2. `late-dense`: 8x8、48～56 occupied、特殊石4。
3. `late-special-20`: 8x8、48～56 occupied、特殊石・bomb・status合計20。turn-startで移動、破壊、timer、保護、復活のうち複数が発生するが、同じseedで決定的に再現できる構成。

fixtureは実在しないmarker組合せを作らず、既存state factoryまたはテストhelperを使う。作れない組合せは無理に混在させず、複数fixtureへ分割する。

### 7.2 計測点

- `buildCardProtectionContext`;
- `Core.getLegalMoves`;
- `buildCurrentCellState` / board projection;
- turn-start rule resolution;
- presentation mapping;
- Worker/local publish apply、projection、hash、journal、persist準備;
- serialized publish/SSE payload bytes;
- client JSON intake、snapshot apply、visual commit、render preparation;
- playback event count、phase count、engine busy time、純粋なanimation duration合計。

通常playではcounterとperformance markを無効にし、`?perf=1` またはtest dependency injection時だけ有効にする。

### 7.3 測定手順

- warmup 20回以上;
- measured iteration 100回以上。ただしWorker integrationは30回以上;
- 同一process、同一fixture、同一seedでbefore/afterを測る;
- median、p95、min、max、iteration数、Node/Chromium versionを保存する;
- GC、初回module load、build時間をhot-path測定から分離する;
- timingだけでなく、marker scan回数、context compile回数、snapshot clone回数、projection回数、save回数を記録する。

## 8. 性能完了基準

タイミングは環境差があるためCIの単独fail条件にしない。完了には、決定的なoperation-count条件と、同一環境のbefore/after timing条件の両方を必要とする。

### 8.1 決定的条件

`late-special-20` 1回あたり:

- protection contextはcanonical marker配列を定数回だけ走査し、markerごとの全一覧再走査が0回;
- `getLegalMoves()`内のflip context compileは1回;
- 1回のboard renderでcard protection context生成は1回以下、legal move生成は1回以下;
- 1回のpresentation mappingでevent index生成は1回以下;
- accepted publishのviewer projectionはblack/white/spectator各1回以下;
- accepted publishの通常成功経路でroom全体persistは1回。統合を見送る場合は設計上の理由と残存計測を最終報告に記載し、この項目を未完とする;
- normal render pathのreadonly visual snapshot取得でfull snapshot cloneは0回;
- event数、phase数、animation duration、payload shapeはbaselineと一致。

### 8.2 Timing条件

同一machineでbefore/afterを2回ずつ取得し、両after runで以下を満たす。

- `late-special-20` protection context medianがbaselineの50%以下;
- `late-special-20` legal move生成medianがbaselineの70%以下;
- board projection medianがbaselineの75%以下;
- accepted publishのrule完了からpayload準備完了までのmedianがbaselineの80%以下;
- client snapshot apply + render preparation medianがbaselineの80%以下;
- `baseline-light` の各p95がbaselineより5%を超えて悪化しない;
- playbackの仕様上のduration合計はbaselineと一致し、その前後のCPU busy timeだけが減る。

環境ノイズで判定不能な場合、iterationを増やして再測定する。基準を下げて通すことは禁止する。改善対象が全体時間の支配要因でないと判明した場合は、計測証拠と新しい支配要因を設計へ追記し、ユーザー判断を得てから基準を変更する。

## 9. 検証戦略

### 9.1 Characterization

- pre/postのcanonical state、events、presentation events、playback digestを同一fixtureで比較する。
- public snapshotはviewer別に比較し、hidden hand / trap redactionも含める。
- seed stateとrandom call countを比較する。
- animation eventはphase、duration、targets、sound cueを比較する。

### 9.2 Focused tests

新規または拡張する主なテスト:

- `test/game.protection-context.performance-contract.test.ts`;
- `test/game.core.compiled-flip-context.test.ts`;
- `test/ui.board-render-projection.test.ts`;
- `test/game.turn-presentation-event-index.test.ts`;
- `test/utils.match-authority.publish-artifacts.test.ts`;
- `test/workers.match-worker.publish-persistence.test.ts`;
- `test/ui.network-visual-state-store-readonly.test.ts`;
- `test/network.special-stone-late-game-parity.test.ts`;
- 既存 `test/game.turn-start-marker-order.test.ts`;
- 既存 `test/ui.network-snapshot.single-writer-baseline.test.ts`;
- 既存 `test/ui.network-client.visual-catchup.test.ts`。

### 9.3 Required bundles

- focused Jest;
- `npm run typecheck`;
- `npm run build:ts`;
- `npm run check:window`;
- `npm run test:network:parity`;
- `npm run checkall`;
- browser root変更後の `npm run build:browser`;
- Worker deploy surface変更後の `npm run worker:prepare`;
- ネット対戦2クライアントの最小E2E;
- `late-special-20` のbefore/after benchmark report。

## 10. 停止条件

以下のいずれかが発生したら、そのtaskを完了扱いにせず停止する。

- canonical state、marker順、events順、seed消費が変わる;
- animation phase、duration、sound cue、入力ロック意味が変わる;
- HTTP/SSE payload shape、hash、redaction、versionが変わる;
- reconnectまたはSSE resumeが復元できない;
- Single Visual Writerを迂回する必要が出る;
- cacheのinvalidaton条件をcanonical stateへ保存しないと成立しない;
- browser rendererがreadonly snapshotをmutationしていることが判明する;
- Workerとlocal serverで異なる最適化が必要になる;
- baseline fixtureが非決定的、または実在しないstateを使っている;
- unrelated dirty fileと変更範囲が重なる;
- focused testまたはparity testが失敗する;
- timing改善のために演出省略・短縮が必要になる。

## 11. ロールバック設計

- 各taskを独立commitにする。
- core、render、network server、network client、playbackを同一commitに混ぜない。
- 公開facadeを維持し、内部最適化をtask単位でrevertできるようにする。
- cache/index導入taskでは、旧アルゴリズムをproduction fallbackとして残さない。characterization test内のoracleとしてのみ保持できる。
- 保存統合taskは故障注入テストに失敗した場合、直前commitを明示的にrevertし、二重保存を維持する。
- generated/mirrorはsourceを戻して再生成する。手修正しない。

## 12. 全体完了条件

本プログラムは次をすべて満たした時だけ完了する。

1. 実装計画の全phaseが完了し、各phase completion evidenceがある。
2. 外面挙動不変契約の比較が全fixture、全viewerで一致する。
3. 決定的なoperation-count条件をすべて満たす。
4. 同一環境before/after計測がTiming条件を満たす。
5. focused tests、typecheck、build、checkall、network parityが成功する。
6. browser bundleとWorker mirrorを正本sourceから再生成し、意図した差分だけである。
7. 2クライアントのネット対戦で、特殊石順、演出順、入力ロック、最終盤面、再接続を確認する。
8. `docs/perf/` にbaseline、final、比較レポートを保存する。
9. 未解決のfallback、TODO、計測用normal-play global、二重authorityが残っていない。
10. `git status --short` がcleanで、全task-owned diffがcommit済みである。

アニメーション仕様時間が残るため、表示上の総待ち時間がゼロになることは完了条件ではない。完了とは、同じ演出を同じ時間・順序で見せながら、計算停止、通信待ち、フレーム落ち、バックログ増加を定量的に削減した状態を指す。
