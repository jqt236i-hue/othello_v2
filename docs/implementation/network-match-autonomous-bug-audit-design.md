# ネット対戦 自律バグ監査・修正設計

## 文書の役割

この文書は、2026-07-31 に依頼されたネット対戦の自律監査と、監査中に再現した不具合を最後まで修正するための実装設計である。プレイヤー向け仕様の正本は `01-rulebook.md`、内部契約の正本は `docs/architecture-contracts.md` であり、この文書はそれらを変更しない。プレイヤー向け挙動を変更する必要が判明した場合だけ、実装より先に該当正本を更新する。

## 1. 問題と期待結果

ネット対戦は Worker、ローカル権威サーバー、ブラウザクライアント、headless ゲーム処理、生成済み Worker 配信面をまたぐ。個別の正常系だけでは、再送、SSE と publish response の競合、再接続、viewer 別投影、pending 選択、AUTO、timeout、表示ジャーナルの境界不具合を見落とせる。

期待結果は次のとおり。

- 定義した全ネットワーク面を、既存テスト、追加の focused test、静的契約監査、必要な smoke で確認する。
- 再現できた製品不具合は、共有権威または所有境界の正本で修正し、Worker／ローカル／ブラウザ／headless を一致させる。
- 偽陽性、環境不調、既知の前提不足は製品不具合と混同せず、再現証拠を残す。
- 検証・生成・mirror 確認まで完了し、タスク所有差分だけをコミットする。

## 2. スコープ

対象は `command`、`publish`、`intake`、`session`、`stream`、`pending`、`presentation`、`visual`、`timeout`、`auto`、`projection`、`board`、`identity`、`spectator`、`rating`、`room`、`worker-runtime`、`delivery` である。

重点シナリオは以下とする。

- 同一 seat／同一 `operationId` の再送が同じ受理結果を返し、版と状態を二重更新しない。
- actor／viewer／room ID／session epoch／seat identity が各 async 境界後も一致する。
- `stateVersion` が同じでも投影 hash が異なる authority state は再同期される。
- black／white／spectator の snapshot、frame、SSE、journal は独立して投影され、秘密値を漏らさない。
- `pendingEffectId`、カード種別、stage、target が authority の pending instance と一致する。
- AUTO と timeout は private canonical snapshot と authority PRNG から再計画し、失敗時は状態を変更しない。
- `visualSeq` と `stateVersionFrom` → `stateVersionTo` が連続し、gap や失敗は journal または `/state` rebase へ明示的に移る。
- `boardContractVersion` と topology が全 runtime で厳密に一致する。

## 3. 非対象と認可境界

- production への deploy、実ルームの永続データ変更、レーティング補正は、明示依頼がないため行わない。
- 長時間 selfplay／training は行わない。
- unrelated な UI、カード仕様、性能最適化は、再現したネット対戦不具合の根本修正に必要な場合だけ扱う。
- 「全て」はこの監査で再現または契約違反として発見できた不具合を指し、未観測の将来不具合が存在しないことまでは主張しない。

## 4. 現在の構造と所有境界

- `shared/network-action-schema.ts` と `utils/match-command-runtime.ts` が command schema と canonical command execution を所有する。
- `utils/match-publish-controller.ts` と `utils/match-authority/*` が idempotency、projection、snapshot、journal、board contract を所有する。
- `workers/match-worker.ts` と `scripts/local-match-server.ts` は transport／storage adapter であり、独自のゲーム規則を持たない。
- `ui/network/intake-envelope.ts` と `ui/network/intake-coordinator.ts` が response／SSE／state／journal／heartbeat の単一 intake を所有する。
- `ui/network/presentation-timeline.ts`、`visual-state-store.ts`、`visual-settlement.ts` が visual lane の順序と settlement を所有する。
- `worker-public/` と `dist/` は生成面であり、root TypeScript が正本である。

## 5. 初期証拠と監査上の注意

最初の `npm run test:network:parity` は 120 秒上限で中断した。上限を延ばした再実行では 561 件中 560 件が通過し、`gluttonous_will_01` の Worker parity だけが失敗した。ただし `workers/match-worker.mjs` が build なしで既存 `dist/workers/match-worker.js` を読むため、`npm run build:ts` 後の同一 focused case は通過した。これは現時点では正本の製品不具合ではなく stale build による偽陽性として扱い、build 済み状態で全検証を再実行する。

Jest は parity 実行後に open handle 警告も出した。これは失敗 case の子プロセス／タイマー残存か製品側リソース解放漏れかを focused 実行と `--detectOpenHandles` で切り分ける。

## 6. 選択設計

監査と修正を次の順序で進める。

1. 正本から TypeScript build を作り、stale artifact を除外した baseline を取る。
2. 既存 parity 束に加え、session、intake、journal、stream、timeout、spectator、rating、board contract の全 focused suite を実行する。
3. 静的に、adapter 内の重複 mutation、unguarded `await`、秘密値の public payload 混入、viewer payload の使い回し、version／hash の arrival-order 判定、非 authority randomness、未解放 stream／timer を検索する。
4. 各失敗を最小ケースで再現し、authority transition を actor、viewer、room、epoch、seat、`operationId`、base／next version、board contract、pending ID、PRNG、`visualSeq`、projection lane まで記録する。
5. 修正は shared schema／authority／command runtime → Worker と local adapter → browser intake/session → visual recovery の正本順で行う。
6. 不足していた failure mode にだけ durable regression test を追加し、既存 coverage と重複させない。
7. focused、parity、typecheck/build、match smoke、mirror、bundle smoke を順に通す。

この方式を、Worker または browser だけへ局所 patch する方式より採用する。局所 patch は authority drift、viewer projection の混線、再送時の二重更新を温存するためである。

## 6.1 監査で確定した不具合と修正

### timeout 後に選択カードが残留する

Worker／ローカルの command 実行を `utils/match-command-runtime.ts` へ統合した際、旧 adapter が timeout 成功後に行っていた `selectedCardId`、`selectedCardOwnerKey`、`pendingEffectByPlayer` の後始末が共通 executor へ移されていなかった。結果として、120秒の期限切れで手番・版・表示フレームは進む一方、期限切れ側の選択カードだけが canonical snapshot に残った。

修正は `applyPreparedMatchCommandExecution` の成功 path に限定し、`pass` かつ `reason === "timeout"` または `timeoutPass === true` の場合だけ行う。選択カードは owner が期限切れ seat と一致するときだけ消し、相手 seat の選択状態は変更しない。pending は旧 controller と同じく期限切れ seat を明示的に `null` へ戻す。Worker とローカルに同じ処理を再追加せず、両者が必ず通る共有 command executor を単一正本とした。

### timeout 理由が raw pass event から欠落する

`applyPassCompletion` は reason を event に保持できる API だったが、pass stage の呼び出し側が `action.reason` を渡していなかった。timeout controller は canonical action に `reason: "timeout"` を付けていたため、呼び出しを接続して raw event／effect-log consumer が理由を失わないようにした。これは既存の timeout 表示仕様を変えるものではなく、既に action／journal に存在する理由を event lane でも一貫させる修正である。

## 6.2 製品不具合ではなかった失敗

- build 前の Worker カード parity 失敗は、`workers/match-worker.mjs` が stale `dist` を読んだためであり、正本 build 後に解消した。
- カスタムデッキ timeout test は、共通 executor が fail-closed になった後も current turn-start marker を除いた不正な部分 `cardState` を注入していた。現行契約どおり current turn は開始済みとした最小 state に直し、post-action の baseline 再構築という本来の検証目的を維持した。
- sub-placement の source test は Worker／ローカル内の旧 inline 判定を探していた。共有 executor の skip／reconcile 判定と、両 adapter の capability 注入を検査する形へ移した。
- late-special fixture の固定 playback digest は、直前の「森羅万象神」実装で deterministic output が変わったのに未更新だった。control playback との同値性を維持したまま、複数回同じ値になる新 digest へ同期した。
- 通常 parity の終了時警告は、同一561件を `--detectOpenHandles` で再実行すると handle が一件も検出されなかった。SSE 単体も検出なしであり、1秒の終了警告閾値を超えるテスト束の teardown 遅延と分類した。

## 7. Failure・security・concurrency

- schema、canonical snapshot、planner、frame、settlement dependency が欠ける場合は success-shaped fallback を返さない。
- rejection は canonical state、version、PRNG、journal cursor を変更しない。
- player token、recovery code、seat token、private hash を snapshot、SSE、journal、diagnostics、ログへ出さない。
- session replacement／leave 後の Promise、EventSource、retry、heartbeat は新 session を変更しない。
- timeout の async work 後は version、seat、turn owner、deadline を再検証する。
- strict frame の部分 replay はせず、authoritative rebase へ移る。

## 8. 検証戦略

- baseline: `npm run build:ts` 後の `npm run test:network:parity` と `npm run test:match:parity`。
- broad focused: test 名が network、match、worker、stream、reconnect、snapshot、presentation、timeout、spectator、rating、room、authority に該当する Jest suite。
- static: `npm run check:window`、`npm run check:dependency-boundaries`、関連 `rg` 監査。
- cross-runtime: `npm run test:network:parity`、`npm run test:match:parity`、`npm run match:check`。
- delivery: `npm run typecheck`、`npm run build:browser`、`npm run worker:prepare`、`npm run check:worker-mirror`、`npm run worker:bundle:smoke`。
- resource leak: focused `--detectOpenHandles` と、必要なら最小二クライアント／SSE scenario。

## 9. リスクと対策

- 広い test pattern が非ネット系を巻き込む可能性があるため、失敗を domain ごとに focused 再実行する。
- build／mirror は大きな生成差分を作り得るため、source test 後にだけ実行し、status と relevant diff を再確認する。
- flaky な timer／browser test は初回失敗を記録し、再試行通過だけで修正済みと扱わない。
- プレイヤー向け仕様の曖昧さが判明した場合は、実装を推測せず正本の矛盾として停止する。

## 10. 完了条件

- 定義した surface の既存 suite と静的監査が完了している。
- 再現した各製品不具合に root-cause 修正と回帰証拠がある。
- Worker／local／browser／headless の該当契約が一致する。
- stale session、duplicate operation、journal gap、失敗 path が収束または明示 reject する。
- focused／parity／build／smoke／mirror／bundle の必要な検証が通過する。
- design と plan が最終実装に同期し、タスク所有差分だけがコミットされる。
- 残存リスクと未実行の外部操作が明記される。

## 11. Self-review

初稿を、`docs/architecture-contracts.md` の §6.3–6.4、§7.2–7.3、§8、§11 とネットワーク skill の停止条件に照合した。初期失敗を製品不具合として断定しない切り分け、viewer 別投影、equal-version hash divergence、board contract、resource leak、deployment 非認可を明示するよう改訂した。実装対象を先に決め打ちせず、再現証拠を gate にするため、プレイヤー仕様の意図を勝手に変更しない設計になっている。

実装後の再レビューでは、timeout cleanup を controller へ戻す案を退け、同期 command の単一所有者へ配置したこと、cleanup を成功した timeout pass と同一 owner に限定したこと、別 seat の選択状態と reject path を変えないことを確認した。`01-rulebook.md` と `正本/` の既存「120秒で自動パス」仕様を復元する修正であり、プレイヤー向け仕様変更はないため正本文書は変更していない。
