# ネット対戦・特殊石大量局面 最適化完了報告

## 結論

CPU経路を対象外とし、ネット対戦のcanonical state、PRNG、event順、public payload、演出phase・時間・音、Single Visual Writer、再接続契約を変えずにPhase 0～8を完了した。`late-special-20` の全timing gateは採用run 1/2の両方でPASSし、決定的operation-count条件もすべて達成した。

- 実装開始commit: `8b8d15a5ff19aa44e1eee116913ac09ef6d6a132`
- baseline commit: `62b170a1289a4a2fffca49d84dc58fd2e0fee948`
- 実装終了commit: `e07f8db58`（cross-platform NOANIM runnerを含む）
- runtime: Node `v24.12.0` / Windows x64 / Chromium（各reportにversion保存）
- fixture seed: baseline-light `101`、late-dense `202`、late-special-20 `303`

## Task commits

1. `62b170a12` test: add late special-stone performance fixtures
2. `80b65a9ac` perf: capture network special-stone baseline
3. `40ae4581f` perf: add shared marker context index
4. `9a8fad627` perf: linearize card protection context
5. `a820116b9` perf: add compiled flip context
6. `efae2fff8` perf: reuse compiled context in move generation
7. `aba0e6f1c` perf: reuse per-render board projection
8. `6e1fce695` perf: index presentation event lookups
9. `01af8239c` perf: reuse publish viewer projections
10. `5a4f7e758` perf: reuse accepted publish artifacts
11. `7cbd20925` test: characterize publish persistence ordering
12. `e87c90476` perf: persist accepted publish once
13. `31e8af332` test: characterize network snapshot clone ownership
14. `4932ade66` perf: avoid network snapshot clone on render
15. `5c66b9039` perf: batch special-stone playback phase work
16. `1beee0d59` perf: index presentation effect blocks
17. `f3f2be991` perf: add final benchmark comparison CLI
18. `e07f8db58` test: make noanim jest cross-platform

## 決定的operation counts

| late-special-20 1回 | before | after run 1 | after run 2 | 判定 |
| --- | ---: | ---: | ---: | --- |
| canonical marker scan | 16 | 1 | 1 | PASS |
| marker entry visit | 320 | 20 | 20 | PASS |
| nested full marker scan | 12 | 0 | 0 | PASS |
| flip context compile / getLegalMoves | 12 | 1 | 1 | PASS |
| protection context / render | 1 | 1 | 1 | PASS |
| legal move generation / render | 1 | 1 | 1 | PASS |
| presentation event index / mapping | 0 | 1 | 1 | PASS |
| viewer projection black/white/spectator | 1/1/1 | 1/1/1 | 1/1/1 | PASS |
| accepted publish room persist | 2 | 1 | 1 | PASS |
| readonly render snapshot full clone | 1 | 0 | 0 | PASS |

## Timing結果

環境ノイズを減らすため、baselineはwarmup 25 / 120反復 / publish 40反復、最終採用runは設計書の再測定規定に従いwarmup 25 / 500反復 / publish 160反復とした。単位はms。

| late-special-20 | before median / p95 | run 1 median / p95 | run 2 median / p95 | run 1 / 2 ratio | 基準 |
| --- | ---: | ---: | ---: | ---: | --- |
| protection context | 0.0265 / 0.0607 | 0.0045 / 0.0109 | 0.0061 / 0.0097 | 17.0% / 23.0% | <= 50% PASS |
| legal moves | 0.0340 / 0.0711 | 0.0124 / 0.0210 | 0.0200 / 0.0383 | 36.5% / 58.8% | <= 70% PASS |
| board projection | 0.2000 / 0.4000 | 0.1000 / 0.3000 | 0.1000 / 0.2000 | 50.0% / 50.0% | <= 75% PASS |
| publish preparation | 2.1599 / 2.8687 | 1.5846 / 2.3862 | 1.6516 / 2.2833 | 73.4% / 76.5% | <= 80% PASS |
| client apply + render preparation | 0.4000 / 0.6000 | 0.3000 / 0.5000 | 0.3000 / 0.5000 | 75.0% / 75.0% | <= 80% PASS |

baseline-light p95は対象5計測すべてで両runともbaseline比105%以下。最も大きい値はrun 2 publish preparationの100.6%だった。

## 外面・network parity

| 項目 | before | after run 1 | after run 2 | 判定 |
| --- | ---: | ---: | ---: | --- |
| payload bytes black | 43,383 | 43,383 | 43,383 | exact |
| payload bytes white | 43,383 | 43,383 | 43,383 | exact |
| payload bytes spectator | 43,405 | 43,405 | 43,405 | exact |
| playback event / phase / duration | 38 / 9 / 12,400ms | 38 / 9 / 12,400ms | 38 / 9 / 12,400ms | exact |
| canonical hash | `fnv1a32:2dc9e591` | 同左 | 同左 | exact |
| event digest | `fnv1a32:7ece743a` | 同左 | 同左 | exact |
| playback digest | `fnv1a32:8b758173` | 同左 | 同左 | exact |

12,400msは仕様上固定のアニメーション時間であり短縮していない。削減対象はその前後の計算、projection、clone、persist、DOM/layout作業だけである。

## 自動検証

- focused performance/parity bundle: 8 suites / 34 tests PASS
- Phase 7 normal timing: 5 suites / 46 tests PASS
- Phase 7 NOANIM PowerShell equivalent: 5 suites / 46 tests PASS
- `npm run typecheck`: PASS
- `npm run build:ts`: PASS
- `npm run check:window`: PASS
- `npm run test:network:parity`: 34 suites / 519 tests PASS
- `npm run checkall`: mirror同期後 PASS
- `npm run build:browser`: PASS、root browser bundle/cachebuster再生成済み
- `npm run worker:prepare`: 824 mirror files verified
- `npm run match:check`: create/join/rejoin/stream bootstrap/publish/leave PASS

## Browser / network E2E と目視

`test/e2e/network-special-stone-late-game.e2e.test.ts` を通常animationで実行しPASS（1 test、約17.5秒のscenario）。黒・白・観測者の3つの独立browser contextで次を確認した。

- late-special-20 journalの38 event / 9 phase / playback digestとsound列がbaseline一致。
- 再生中はbase盤面が表示され、最終盤面は先行表示されない。
- backlog再生中はprocessing/playback lock、drain後は解除。
- 最終盤面、charge、marker type/timerが3者一致。
- 黒/白は相手手札を隠蔽し、仕様どおり観測者は両手札を閲覧。
- 再接続後も最終状態一致、同一visualSeqの二重再生なし。
- console error / page error 0。

最終画面: [E2E screenshot](2026-07-11-network-special-stone-e2e.png)。設定パネルを閉じた状態で目視し、盤面・HUDの重なり、特殊石画像・timer表示、手札表示に新規の遮蔽や崩れは認めなかった。

## 初回失敗と再試行

- `npm run test:jest:noanim` は当初POSIX形式の `NOANIM=1` がWindows PowerShellで解釈されず失敗。cross-platform Node runnerへ修正後、同package commandのfocused 46 testsはPASS。修正前に試した全Jest相当は10分でtimeoutしたため、対象surfaceをfocused実行した。
- 120反復run 2は、publish 80.9%、次の再試行ではbaseline-light client p95 116.7%、次ではlegal median 71.2%と失敗箇所が移動した。operation count/parityは一定だったため、基準を緩和せず500/160反復へ増やし、採用2runは全PASS。失敗reportも保存した。
- `checkall` 初回は直前browser build後のWorker mirror未同期で失敗。`worker:prepare` 後の再実行はPASSし、runbook順序を修正した。
- 新規E2Eは、readonly snapshot versionをDOM表示と誤認した判定、遅延生成dispatcher/timelineへのprobe、token取得、retained-base fixture設定、観測者手札仕様の期待を順次修正した。製品コードの失敗ではなくE2E fixture/harnessの初期設定問題で、最終2回は同一testがPASSした。
- network parityはPASS後に既存のJest open-handle警告を出したが、test失敗やtimeoutはなかった。

## Residual risk

- サブミリ秒browser計測はChromium timer量子化とOS負荷の影響を受ける。決定的operation countを主証拠とし、timingは500反復で安定化した。
- E2Eのlate-special journal投入はdebug-only test fixtureで、normal gameにfixture設定やperf instrumentationは残していない。通常create/join/rejoin/stream契約は`match:check`とnetwork parityで別途検証済み。
- 固定12,400msの演出時間は仕様どおり残るため、プレイヤーが感じる最短待機時間そのものはゼロにはならない。

## Rollback points

ロールバックはdestructive resetではなく、依存を確認して次のtask commitを逆順に明示revertする。最小の緊急rollbackは該当phaseだけを対象にする。

`e07f8db58`, `f3f2be991`, `1beee0d59`, `5c66b9039`, `4932ade66`, `31e8af332`, `e87c90476`, `7cbd20925`, `5a4f7e758`, `01af8239c`, `6e1fce695`, `aba0e6f1c`, `efae2fff8`, `a820116b9`, `9a8fad627`, `40ae4581f`, `80b65a9ac`, `62b170a12`。

## 証拠ファイル

- `2026-07-11-network-special-stone-baseline.json` / `.md`
- `2026-07-11-network-special-stone-final-run1.json` / `.md`
- `2026-07-11-network-special-stone-final-run2.json` / `.md`
- `2026-07-11-network-special-stone-final.json` / `.md`
- `2026-07-11-network-special-stone-comparison.md`
