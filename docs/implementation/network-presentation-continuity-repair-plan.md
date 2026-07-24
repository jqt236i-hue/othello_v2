# ネット対戦の表示連続性 修正 実装計画

- Status: complete
- Date: 2026-07-24
- Design: `docs/implementation/network-presentation-continuity-repair-design.md`

## Phase 0 — 契約固定

- [x] dirty worktreeがないことを確認する。
- [x] ルールブック、ターン進行正本、architecture contract、network authority、Single Visual Writer契約を確認する。
- [x] 本番2クライアントでcanonical一致／visual停止を再現し、traceとdiagnosticsから原因を特定する。
- [x] 全実運用 `stateVersion` mutationをbase／frame／metadataへ分類する。
- [x] 修正設計を作成し、独立レビューを反映する。
- [x] player-visible仕様変更が不要であることを確認する。

Done when: timeout frame欠落、canonical direct playback、journal未収束、session汚染、rebase所有者が1つの設計で説明されている。

## Phase 1 — timeout authorityをpresentation journalへ統合

- [x] Worker timeout controllerへinitial base、viewer artifact、frame append依存を注入する。
- [x] mutation前version／turn／deadlineを保存し、async resolver後に再検証する。
- [x] timeout確定時に `stateVersionFrom → stateVersionTo` のframeを1件追加する。
- [x] 同じoperation ID、frame entry、viewer artifactsを保存とbroadcastで再利用する。
- [x] ローカルserver timeoutを同じ順序とpayloadへ揃える。
- [x] frame append前のbroadcastや成功形保存が起きないことをfocused testで固定する。

Done when: Worker／localのtimeout response、SSE、state、journalが同じvisualSeqとsnapshotAfterを返し、競合した古いtimeoutは適用されない。

## Phase 2 — session-scoped intake／publish／stream

- [x] intake coordinatorへreset可能なdedupe lifecycleとroom guardを追加する。
- [x] session epoch更新時にintake dedupeとpresentation recoveryを切り替える。
- [x] publish requestへ開始時epoch／room／seat identity guardを追加し、各await後の遅着応答を破棄する。
- [x] session boundaryで新publish chainを開始し、旧chainはguard付きで自然終了させる。
- [x] EventSourceへ作成時epoch／room／source identity guardを追加する。
- [x] room A退出後のroom B `visualSeq = 1` と、旧publish／旧stream遅着をfocused testで固定する。

Done when: 旧sessionのdedupe、応答、event、recoveryが新sessionのcanonical／visual stateを変更できない。

## Phase 3 — canonical playbackをstrict timelineへ限定

- [x] intake frameをshared frame contractでnormalizeし、snapshotAfterとroom／version連続性を検証する。
- [x] canonical network sourceは有効frameがない限りsnapshot direct playbackへ入れない。
- [x] `snapshot.ts` のforce recoveryを含む迂回経路にも同じframe必須条件を適用する。
- [x] `snapshot-playback.ts` はvisualSeqなしeventをstrict network playbackとして生成しない。
- [x] shadow/no-op presentationだけをlegacy direct経路に残す。
- [x] malformed frame、enqueue 0、frameなしplayback、frameなしversion jumpをcontinuity recoveryへ送る。

Done when: server canonical playbackの唯一のstrict writerがpresentation timelineであり、旧 `strict_network_visual_seq_required` 経路が通常運用から消える。

## Phase 4 — atomic visual rebaseとjournal fallback

- [x] snapshot／cursor／version／sessionを事前検証する専用rebase transactionを実装する。
- [x] timeline、visual store、`lastVisual*`、visual settlement trackerを同じcursorへ同期する。
- [x] active／paused settlement中はin-place更新せず、dispose/cancel後のfull state rebaseへ昇格する。
- [x] rebase後に4所有者とrender snapshotの収束を検証し、例外や不一致をfalseとして返す。
- [x] presentation recoveryをsession単位の1 Promiseへ集約し、有限retryとepoch guardを付ける。
- [x] journal適用後のpending／version／render収束を確認し、未収束時は `/api/match/state` full rebaseへ落とす。
- [x] direct playback失敗後はeventを再実行せず、lock収束後のfull rebaseだけを行う。
- [x] 復旧失敗時だけ既存reload-required surfaceを表示する。

Done when: `v3 → frameなしv4 → seq2/from-v4/v5` がreloadなしでcanonical／visual／render v5へ収束し、pending frameとbusy lockが残らない。

## Phase 5 — 回帰テスト

- [x] Worker timeout controller unitへframe順序、operation再利用、競合中止を追加する。
- [x] Worker timeout integrationへcursor、frame、journal base、後続frame連続性を追加する。
- [x] local presentation journal integrationへtimeout frameと後続publishを追加する。
- [x] intake coordinatorへsession reset、room mismatch、malformed frame、enqueue拒否、no-frame rebaseを追加する。
- [x] snapshot single-writer testを「canonical direct禁止、shadow directのみ」へ更新する。
- [x] visual catch-up testへ旧本番のversion gapとtracker収束を追加する。
- [x] publish／stream lifecycleへ遅着旧session response/eventを追加する。
- [x] journal HTTP成功・drain 0からfull rebaseするtestを追加する。
- [x] active settlement中rebaseとrecovery中session変更を追加する。

Done when: 旧不具合または独立レビューで見つかったsession／rebase欠陥を戻すとfocused testが失敗する。

## Phase 6 — 静的検証と配信物生成

- [x] focused Jestを小さい単位から実行する。
- [x] `npm run typecheck` と `npm run build:ts` を実行する。
- [x] `npm run check:window` でauthority boundaryを確認する。
- [x] `npm run test:network:parity` を実行する。
- [x] browser-visible root変更後に `npm run build:browser` を実行する。
- [x] `npm run build:vite` と最小Pixi/network browser checkを実行する。
- [x] `git diff --check` とtask-owned diffを確認する。

Done when: Worker／local／browser／headless parityとgenerated browser artifactsが同期し、既知失敗がない。

## Phase 7 — production deployと2クライアント実機検証

- [x] `npm run worker:deploy` でmirror生成、bundle smoke、本番deployを一度に行う。
- [x] 公開APIのcreate／join／state／journal／leave smokeを行い、roomを片付ける。
- [x] 独立した2ブラウザでUIからroom作成／一覧参加を行う。
- [x] 黒白双方のPixi実クリック、非手番拒否、連続frame、canonical hash一致を確認する。
- [x] timeout相当のserver transition後も後続着手でき、visual／render versionが一致することを確認する。
- [x] 一方をreload／再接続し、cursorと未再生frameが正常復旧することを確認する。
- [x] canvas 1枚、DOM fallback非併用、busy lock解放、console／network errorなしを確認する。
- [x] WebGL canvas screenshotを両クライアントから保存・確認する。
- [x] 新たに再現したnetwork不具合があれば同じ設計境界で修正し、focused→parity→deploy→実機を繰り返す。
- [x] 両クライアントを退出させ、公開roomを片付ける。

Done when: 公開環境の2クライアントで対局継続、timeout後続、再接続、表示収束が確認でき、再現可能な未修正不具合がない。

## Phase 8 — 最終監査とcommit

- [x] design／planのstatusと検証結果を更新する。
- [x] `git status --short` と関連diffを再確認する。
- [x] root source、generated browser artifacts、Worker mirrorの由来を確認する。
- [x] task-owned fileだけをstageする。
- [x] 検証済みのcoherent commitを作成する。
- [x] commit後のworking treeと公開deploymentを確認する。

Done when: 修正・テスト・生成物・文書が1つの検証済みcommitになり、公開環境と一致する。

## 完了証跡

- Production: `https://card.reversi-0.workers.dev`、Worker version `ca4ea7cc-630e-423b-9b8a-053d69faabf4`
- Network parity: 34 suites／531 tests passed
- Focused browser checks: Pixi実マウス入力 2 cases passed、2クライアント対局・再接続 1 case passed
- Production API smoke: create／join／rejoin／SSE bootstrap／SSE publish／leave passed
- Production 2-browser check: timeout後の表示収束、再接続、同時再戦、ROUND 1初期局面への双方同期、古い再戦promptの消去を確認
- Browser artifacts: `build:browser`、Vite build、Worker mirror生成・bundle smokeを通してdeploy

## 自己レビュー

- server authority修正を先に行い、clientは欠落を隠すのではなく旧room／不完全payload向けの防御として実装する。
- session境界をpresentation実装より先に固定し、遅着payloadがrebaseやdedupeを横断しないようにする。
- canonical direct playbackを閉じてからrebaseを実装するため、同じeventの部分再生と再実行を避ける。
- rebase成功条件をHTTP、enqueue、drain件数ではなくtimeline／store／state／tracker／renderの収束に置く。
- focused testをauthority、session、playback、recoveryの単位で通してからfull parityと実ブラウザへ進む。
- deploy scriptが`worker:prepare`を内包するため、直前にmirror生成を重複実行しない。
