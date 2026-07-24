# ネット対戦の表示連続性 修正設計

- Status: reviewed
- Date: 2026-07-24
- Scope: Worker／ローカルサーバーのタイムアウト確定、クライアントの表示ジャーナル連続性、再接続復旧、実機ネット対戦
- Source of truth: `01-rulebook.md`、`正本/ターン進行正本.md`、`docs/architecture-contracts.md`、root `AGENTS.md`

## 1. 結論

ネット対戦で canonical state が進む操作は、初期局面の基準化を除き、必ず同じ `stateVersionFrom → stateVersionTo` を持つ presentation frame として永続化・配信する。

今回確認した表示停止は、120秒タイムアウトだけが canonical `stateVersion` を進めながら presentation journal を進めていなかったことが直接原因である。次の通常操作フレームは欠けた版を始点にするため、クライアントの strict timeline が正しく待機し続け、canonical HUD と盤面表示が乖離した。

修正は二層にする。

1. Worker とローカルサーバーのタイムアウト確定を通常 publish と同じ presentation frame 契約へ統合する。
2. フレームなし、または不正・不連続な presentation payload を受けたクライアントは、演出を推測して直接再生せず、受信済みの権威 snapshot と presentation cursor を一体で表示基準へ再設定する。基準情報が不足する場合は `/api/match/state` を再取得して同じ処理を行う。
3. intake、stream、publish、recoveryをroom/session単位へ分離し、退出後の旧dedupe記録や遅着応答を次の部屋へ持ち越さない。

これにより新規操作では欠落を発生させず、更新直前の旧ルーム、旧サーバー、一時的に不完全な payload に対しても盤面を停止させない。

## 2. 現象と再現証拠

本番 Worker を2つの実ブラウザから操作した結果、次を確認した。

- 両クライアントの canonical `stateVersion` と authoritative hash は一致した。
- 一方のクライアントだけ盤面の `renderStateVersion` が古いまま残った。
- timeline diagnostics は古い `visualVersion` と未処理frameを示した。
- `retryPresentationTimeline()` は paused settlement ではないため何も再開しなかった。
- ページ再読込では `/api/match/state` を基準に復旧した。
- traceには `snapshot_playback_direct_dispatch_failed` が記録されていた。

典型的な版遷移は次のとおりである。

```text
visualSeq 1: stateVersion 2 -> 3
timeout:     stateVersion 3 -> 4  （frameなし）
visualSeq 2: stateVersion 4 -> 5
```

クライアントの表示版は3なので、`stateVersionFrom = 4` のvisualSeq 2を開始できない。これはstrict timelineの誤動作ではなく、サーバー側の連続性違反を検出した正しい停止である。

## 3. 根本原因

### 3.1 サーバー

通常 publish は `utils/match-publish-controller.ts` で次の順序を守る。

1. mutation前のviewer別snapshotを初期表示基準として確保する。
2. `previousStateVersion` を保存する。
3. canonical mutationを確定し、`stateVersion` を進める。
4. viewer別の確定snapshotを生成する。
5. operation、playback、effect log、diagnostics、snapshotAfterを1つのpresentation frameへ追加する。
6. frameを含むroomを保存する。
7. 同じframeをpublish応答とSSEへ配信する。

`workers/match-worker-timeout-controller.ts` と `scripts/local-match-server.ts` のタイムアウト経路は、canonical mutation、保存、SSE配信だけを行い、手順1・2・4・5を通っていない。

### 3.2 クライアント

frameがないpayloadでは `ui/network/snapshot.ts` がlegacy playbackを直接dispatchする。`ui/network/snapshot-playback.ts` はそのeventへ `strictNetworkPlayback: true` を付けるが `visualSeq` を持たせない。

strict presentation handlerは、commit/apply/settleをtimelineだけが所有する契約上、`visualSeq` のないstrict eventを拒否する。さらにdirect dispatchはPromiseの成否確定前にqueueからbatchを除去し、失敗時はtelemetryだけを残す。仮に非strictとして再生してもvisual state storeのframe commitがないため、表示カーソルは進まない。

したがって、legacy direct playbackへ `visualSeq` を足す、strictを解除する、失敗後に同じeventを再試行する、のいずれも正しい修正ではない。

## 4. Authority transition監査

実運用のcanonical `stateVersion` 更新箇所を次のように分類する。

| 経路 | 役割 | presentation契約 |
| --- | --- | --- |
| 2席成立時の初期局面 | 演出開始前の基準snapshot作成 | `visualSeq = 0` のbaseとして扱う |
| 通常publish、カード、パス、再戦reset | server-authoritative操作 | 共通publish controllerがframe化済み |
| 手番タイムアウト | server-authoritative強制パス | 今回frame化する |
| レート対戦room初期化 | 演出開始前の基準snapshot作成 | `visualSeq = 0` のbaseとして扱う |
| レート切断・投了metadata | 対局結果metadata更新 | gameplay `stateVersion` を進めず、盤面playbackなし |
| `scripts/local-match-runtime.ts` | parity用test runtime | deploy serverではない。既存parityの対象として維持 |

初期局面を操作frameにすると、参加前の存在しない盤面から初期盤面への疑似演出が必要になり、join/reloadのbase cursor契約を変えてしまうため行わない。

## 5. Session境界監査

presentationの連続性はroom内だけで意味を持つ。現在のintake coordinatorはsingletonで、`visualSeq` と `operationId:stateVersion` のdedupe集合をsession終了時に消していない。このため、別roomが同じ小さい `visualSeq` から始まると、旧roomの重複として新roomのframeを捨て得る。

さらに、退出前に開始したpublish応答や旧EventSourceのeventが、新session開始後に遅着する場合がある。payloadのroom IDだけでなく、request／stream開始時のsession epochも必要である。同じroomへ再参加した場合はroom IDだけでは区別できない。

修正後は次を守る。

- session activation、stored-session activation、rated activation、leaveでepochを進める。
- epoch更新時にintake dedupe、pending presentation recovery、publish chainを新session用へ切り替える。
- publishはrequest開始時のepoch、room ID、seat identityを保持し、各await後に一致を確認する。
- streamはEventSource作成時のepochとroom IDを保持し、`state.eventSource === source` も満たすeventだけを処理する。
- intake envelopeはroom IDを正規化し、現在roomと一致しないpayloadをcanonical apply前に拒否する。
- 旧sessionのrecovery Promiseはtransport上cancelできなくても、応答適用前のepoch guardで破棄する。

## 6. サーバー修正

### 6.1 共通frame入力

Worker timeout controllerへ次の依存を明示的に注入する。

- `ensureInitialPresentationSnapshots(room)`
- `buildPublishViewerArtifacts(room, options)`
- `appendPresentationFrameForAcceptedPublish(room, options)`

タイムアウト処理はmutation前にbase snapshotを確保し、`previousStateVersion` を保存する。canonical snapshot、turn timer、authoritative hashを確定した後、viewer別artifactを一度生成し、次のframeを追加する。

```text
operationId: timeout_<nextVersion>_<nowMs>
actorSeatKey: timedOutSeatKey
actionType: timeout_pass
stateVersionFrom: previousStateVersion
stateVersionTo: nextVersion
playbackEvents/effectLogs/playbackDiagnostics: forced passの確定結果
snapshotAfterByViewer: 同じ確定roomから生成したviewer別snapshot
createdAt: nowMs
```

frame追加後にroomを保存し、broadcastへ同じ `operationId` と `presentationFrameEntry` を渡す。保存前と配信時で別frameを生成してはいけない。

### 6.2 timeout競合防止

Workerのtimeout resolverは非同期であり、await中にpublishまたはalarmが同じroomを更新し得る。timeout処理開始時に次を保存し、commit直前に再検証する。

- `stateVersion`
- timed-out seat
- current turn seat
- timer deadline

いずれかが変わった場合、古いresolver結果をcommit、frame追加、保存、broadcastしてはいけない。新しいauthority stateを勝たせ、timeout処理は `applied: false` で終了する。

### 6.3 Worker／ローカルparity

ローカルサーバーも同じ順序、operation ID、frame payload、viewer projectionを使用する。root sourceの共通helperを利用し、`worker-public/` は生成手順以外で編集しない。

## 7. クライアント修正

### 7.1 continuity判定

正規化済みintake envelopeについて、単に配列の有無だけでなく、frame contractと現在のvisual cursorを照合する。

```text
failure =
  (playbackEventsあり && 有効なpresentation frameなし)
  || frameのnormalize／snapshotAfter検証失敗
  || unseen frameをenqueueしたのにaccepted=0
  || 先頭unseen frameのvisualSeq/stateVersionFromが現在cursorから不連続
  || frameなしでcanonical/cursor versionだけがvisual versionを追い越した
```

重複配信済みのframeはfailureではない。現在cursor以下のframe、既知 `visualSeq`、同一operation/versionはdedupeとして扱う。

現在のサーバー契約では、canonical結果にplaybackがあるのに有効frameがない状態は正規経路ではない。self-operationの抑止はframe内payloadのpresentation policyで扱い、legacy direct playbackへ戻さない。

### 7.2 安全なrebase transaction

continuity failureを検出したintakeは、canonical snapshot自体は通常のversion guardで適用するが、legacy `playbackEvents` はsnapshot presenterへ渡さない。

canonical適用後、次を専用の同期transactionとして行う。

1. envelopeの `snapshot`、snapshot version、`stateVersion`、cursor stateVersionの完全一致を検証する。
2. room/session epochが現在sessionと一致することを検証する。
3. timelineがplaying、paused、active settlement中でないことを検証する。
4. timeline base cursor、visual state storeのbase snapshot、`lastVisualSeq`／`lastVisualVersion`、visual settlement trackerを同じcursorへ同期する。
5. 各diagnosticsが同じcursorへ収束したことを確認する。
6. board visual controller経由のrefreshを要求する。
7. 既に後続frameがqueue済みならtimeline drainを要求する。
8. recovery traceへsource、version、cursor、破棄したlegacy event数を記録する。

snapshotとcursorを別々に更新してはいけない。カーソルだけ進めると盤面が古いままになり、盤面だけ更新すると後続frameを重複再生する。

現在の `syncVisualCursorForSnapshotNoPlayback()` のように、timeline更新例外を握り潰した後もstoreとstateだけを進め、常にtrueを返す実装は使用しない。既存APIは上記transactionへ置き換える。

active settlement中はin-place rebaseを行わない。settlement handleをtimelineのdispose経由でcancelし、その後にfull authoritative rebaseを行う。部分実行済みのframeを同じeventから再開しない。

### 7.3 journal recoveryとfull fallback

cursorが欠ける、不正、またはsnapshot versionと整合しない場合は、そのpayloadから推測して進めない。短回数の `/api/match/state` 再同期を開始し、presentation journal catch-upを抑止したfull authoritative rebaseを行う。

既存journal gap recoveryは、HTTP 200やframe enqueueを成功条件にしない。journal適用後にtimeline／store／render versionがtarget cursorへ収束した場合だけ成功telemetryを出す。journal取得成功後も `drained = 0` かつ不連続pending frameが残る場合、または `VISUAL_CURSOR_EXPIRED` の場合はfull rebaseへ昇格する。

full rebaseはsession単位の1本のPromiseへ集約する。各await後にepochを確認し、有限retry後にも収束しない場合だけ既存のreload-required surfaceへ委ねる。

再取得にも失敗した場合だけ既存の再接続／reload-required surfaceへ委ねる。async failureを空の`catch`で成功扱いにしない。

### 7.4 direct playbackの扱い

server snapshot由来のcanonical playbackはpresentation timelineだけがstrict writerである。legacy direct dispatchはshadow/no-op presentation用途に限定し、canonical frame欠落の代替経路には使用しない。

すでに開始した演出が失敗した場合、同じeventを自動再実行しない。部分実行済みか判定できないため、権威snapshotへのrebaseだけが安全である。

`snapshot.ts` 自体もcanonical network sourceのframe-less playbackを拒否する。intakeだけで抑止すると、force recoveryなどの迂回経路から同じ不正なstrict direct eventを作れるためである。`snapshot-playback.ts` は `visualSeq` のないeventへ `strictNetworkPlayback: true` を付けない。

## 8. 順序・所有境界

- Server authorityはcanonical result、version、operation ID、viewer projection、presentation frameを所有する。
- Client canonical laneは最新snapshotを即時保持する。
- Client visual laneはframe commitまたは明示的なfull rebaseだけで進む。
- board pixelsとboard-owned playbackは引き続き `ui/board-visual/controller.ts` とactive backendだけが書く。
- recovery refreshは既存のboard visual requestを使い、`renderBoard` の直接fallbackや第二writerを追加しない。
- pending/busy/playback lockはpresentation stateであり、canonical stateへ混入させない。

## 9. 互換性と失敗時動作

- 修正後に作成・更新されるroomではタイムアウトframeがjournalへ残るため、通常はrebase fallbackを使用しない。
- deploy前から存続するroomで既にframe gapがある場合、journalを遡っても欠落frameは生成できない。full rebaseにより最新盤面へ安全に復旧する。
- 同一operationのpublish応答とSSEは既存のoperation/versionおよびvisualSeq dedupeを維持する。
- spectatorも同じvisualSeqを受け、snapshotAfterだけviewer projectionを使う。
- timeout frame保存後にSSEが失敗しても、再接続時のjournal catch-upで復元できる。
- frame追加またはroom保存に失敗した場合、成功形のbroadcastを先に送らない。
- 別roomで `visualSeq = 1` が再利用されても、新sessionの最初のframeとして処理する。
- 旧publish応答、旧stream event、旧recovery結果は、新sessionのstate、dedupe、visual cursorを変更しない。

## 10. 検証

最低限、次を自動検証する。

1. Worker timeoutが `stateVersion 4 → 5` のframeを保存前に1件追加し、broadcastも同じentry／operation IDを使う。
2. ローカルserver timeoutが同じcursor、frame、viewer snapshotを返す。
3. timeout後のpresentation journalがbase snapshotから連続したframe列を返す。
4. frameありpayloadはlegacy playbackを抑止し、strict timelineでcommit/apply/settleする。
5. frameなし＋playbackありpayloadはdirect strict dispatchせず、snapshot/cursorを一体でrebaseする。
6. rebase後に既にqueueされた次frameを処理でき、visual version、visualSeq、render snapshotがcanonicalへ追いつく。
7. 同一publish response／SSEを重複適用・重複再生しない。
8. malformed frame、snapshotAfter欠落、enqueue拒否、frameなしversion jumpをfull rebaseへ送る。
9. active settlement中のrebaseはin-place更新せずcancel/dispose後にfull rebaseする。
10. rebase後にtimeline、visual store、state、visual settlement trackerが同じcursorを示す。
11. journal取得が成功してもdrain後にversion gapが残る場合、成功扱いせずfull rebaseする。
12. timeout resolver中に別mutationがversion／turnを進めた場合、古いtimeoutをcommitしない。
13. room A退出後にroom Bの `visualSeq = 1` を受理し、room Aの遅着publish／streamを拒否する。
14. recovery中にsessionが変わった場合、旧recovery結果を破棄する。
15. reconnect、heartbeat、state sync、journal expiration、観戦投影の既存テストが通る。
16. `npm run test:network:parity` でWorker／ローカル／browser／headless契約が一致する。
17. production deploy後、2実ブラウザで作成、参加、双方の着手、非手番拒否、再読込復帰、timeout相当の強制遷移、後続着手を確認し、canvas screenshotとdiagnosticsを保存する。

## 11. 代替案と不採用理由

- timeout SSEへplayback eventsだけを残す: journal gapが残り、再接続で復元できない。
- client timelineがversion gapを無視して次frameを再生する: `snapshotAfter` の始点が一致せず、演出結果を誤適用する。
- direct strict eventへ仮のvisualSeqを付ける: timelineが持つcommit/apply/settle ownershipを迂回する。
- direct playbackを非strictにする: visual state storeとcursorが進まず、次frameで再停止する。
- rejected Promise後にeventを再queueする: 部分再生済みの場合に演出を二重適用する。
- 欠落frameをclientで合成する: server-authoritativeなplayback、viewer projection、digestを推測することになる。
- 常に最新snapshotへ即時スキップする: 正常なjournal catch-upまで失い、既存の演出順仕様に反する。

## 12. 完了条件

- timeoutを含む全実運用canonical mutation経路にbaseまたはpresentation frameの明示的な分類がある。
- Worker／ローカルserverのtimeout frame契約が一致する。
- legacy frame gapで片側だけ盤面が停止せず、canonical／visual／render versionが収束する。
- sessionをまたぐdedupe、publish、stream、recoveryの汚染がない。
- focused tests、typecheck、build、network parity、browser checksが通る。
- production Workerを再deployし、2クライアント実機検証で新たに再現したネット対戦不具合も同じ基準で修正・再検証する。

## 13. 独立レビュー反映

独立レビューでは、timeout gap以外に次の重大な境界不足が指摘された。

- intake dedupeがsession非依存
- `syncVisualCursorForSnapshotNoPlayback()` が部分成功を成功扱いする
- canonical direct playbackの迂回経路
- malformed／enqueue拒否／no-playback version jumpの見落とし
- journal HTTP成功とvisual収束の混同
- async timeout resolverの競合
- recovery requestの非集約

本設計は、session guard、専用rebase transaction、snapshot controller側のframe必須化、収束検証、timeout optimistic guard、session-scoped recovery Promiseを追加してこれらを反映した。

## 14. 自己レビュー

- strict timelineの待機条件を緩めず、欠落をauthority側で修正するため順序保証を維持できる。
- recoveryはevent再生ではなくsnapshot/cursorの原子的rebaseなので、部分実行や重複配信でも結果を二重適用しない。
- Workerとローカルserverは同じpresentation helperを使い、mirrorへ独自実装を増やさない。
- initial room snapshotとrated metadataを無理に操作frameへ変換せず、既存join/reload契約を維持する。
- session epochとroom IDを両方使うため、別roomだけでなく同じroomへの再参加でも遅着応答を分離できる。
- rebase成功条件を4つのcursor所有者とrender snapshotの収束に置き、HTTP成功やqueue投入だけで成功扱いしない。
- player-visible仕様、カードルール、表示文言は変更しないため、`01-rulebook.md` と `正本/*.md` は更新しない。
- productionで追加の不具合を確認した場合も、canonical authority、visual ordering、Single Visual Writerの境界を崩さず修正する。
