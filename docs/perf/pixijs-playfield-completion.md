# PixiJS playfield migration completion evidence

- Result: **PASS**
- Completed phases: Phase 0～10
- Final implementation commit: `dc9c726331aaf69254cfe4cab9d0cd947e85fc36`
- Production URL: <https://card.reversi-0.workers.dev>
- Browser artifact SHA-256: `7936759ec2f5e99879ba17bf4f1ee60b7491b2e6864f61a062ae4f9fc849de0b`
- Worker version: `a52f098f-6b98-45df-bdca-5ea42093efad`
- Deployment: `8a64e218-084c-4458-beef-c1f1489a30ba`, 100% traffic
- Deployed at: 2026-07-18T17:17:18.958877Z
- Recorded at: 2026-07-18

## Outcome

通常の盤面、石、盤面入力、盤面内演出はPixiJS `8.18.1`で描画する。カード、HUD、設定、文字UI、DOM横断演出はDOMに残す。WebGL/Pixi初期化失敗、復旧不能なcontext loss、または正確な`?debug=1&boardRenderer=dom`だけが、同時mountしないDOM compatibility backendを使う。

player-visible behavior、`events[]`の内容と順序、network authority、Single Visual Writerは変更していない。`01-rulebook.md`と`正本/*.md`の更新を要する表示仕様変更は発生しなかった。

## Final ownership and dependency graph

```text
normal boot
  entry-browser / Vite bootstrap
    -> ui/board-renderer.ts
      -> ui/board-visual/state-adapter.ts
      -> ui/board-visual/controller.ts
        -> ui/board-visual/pixi-backend.ts

compatibility selection only
  explicit debug / Pixi init failure / unrecoverable context loss
    -> lazy DOM fallback factory
      -> ui/board-dom-compat/{backend,renderer,playback,input,runtime}.ts

non-board presentation
  ui/presentation/{committed-world-state,manifest-world-effects,
                   stone-info-controller,stone-info-panel}.ts
```

`ui/board-dom-compat/`はdefault Pixi import/caller graphから外れ、module registryにはcontext-loss recovery用として登録されるが通常起動では評価されない。default `#board`はscroll viewport、Pixi canvas、semantic layerだけを持つ。DOM cell、disc、互換animation CSSは`styles-board-dom-compat.css`の`[data-board-renderer="dom"]` scopeへ移し、`#board-expansion-layer`はDOM backend選択後だけ動的生成する。

## Moved inventory

| Former location | Final owner |
| --- | --- |
| `ui/diff-renderer.ts` | `ui/board-dom-compat/renderer.ts` + `ui/board-visual/state-adapter.ts` + `ui/presentation/*` |
| `ui/board-visual/dom-backend.ts` | `ui/board-dom-compat/backend.ts` |
| `ui/board-visual/dom-playback.ts` | `ui/board-dom-compat/playback.ts` |
| `ui/board-visual/dom-runtime.ts` | `ui/board-dom-compat/runtime.ts` |
| `ui/diff-renderer/dom-patcher.ts` | `ui/board-dom-compat/dom-patcher.ts` |
| `ui/diff-renderer/interaction-binder.ts` | `ui/board-dom-compat/input.ts` |
| `ui/diff-renderer/special-marker-renderer.ts` | `ui/board-dom-compat/special-marker-renderer.ts` |
| `ui/diff-renderer/{equality,viewer-context}.ts` | `ui/board-visual/{equality,viewer-context}.ts` |
| `ui/diff-renderer/world-effects.ts` | `ui/presentation/manifest-world-effects.ts` |
| `ui/diff-renderer/stone-info-panel.ts` | `ui/presentation/stone-info-panel.ts` + controller |

## Preserved settlement contracts

- Sparse render modelはexisting/playableとexplicit holeだけを保持し、voidはviewport + overscan/gutter内でmaterializeする。
- network描画は`visual-state-store`を唯一の表示state入力とし、canonical snapshotを直接先送りしない。
- strict-network settlement handleはvisual store commitと`applyCommittedFrame`成功まで保持する。成功後にだけvisual settlement、observer、writer/playback releaseを進める。
- recoveryはcommitted frameを再適用し、authoritative event、sound、logを再生しない。
- Pixi/DOM backendはhost leaseと`data-board-renderer`で排他mountし、入力も同時に有効化しない。

## Verification bundle

| Verification | Result |
| --- | --- |
| `npm run typecheck`, `npm run build:ts`, `npm run build:browser`, `npm run build:vite` | PASS |
| `npm run checkall` | PASS。初回はbuild後のstale Worker mirrorで失敗し、正しい生成順で再実行してPASS |
| `npm run test:jest` | PASS: 937 suites / 6501 tests |
| `npm run test:jest:noanim` | PASS: 937 suites / 6501 tests |
| `npm run test:network:parity` | PASS: 34 suites / 523 tests |
| `npm run compare:browser-lanes` | PASS: 3 samples、visual diff 0 pixels、runtime/fixture digest一致 |
| `npm run match:cross-platform-smoke:vite` | PASS: Chromium / Firefox / WebKit、desktop / touch-mobile、DPR 1 / 2、DOM / Pixi |
| `npm run match:production-delivery-smoke:vite` | PASS: MIME / CSP / cache / resources |
| `npm run match:ui-control-smoke:classic` / `:vite` | PASS |
| `npm run match:pixi-runtime-fallback-check` | PASS: classic / Vite / unsafe-evalの強制asset・runtime failureでDOM fallback |
| `npm run test:visual` | PASS: 3997 diff pixels、threshold 4000 |
| `npm run worker:prepare`, `npm run check:worker-mirror` | PASS: 911 mirrored files |
| selector isolation | PASS: default/Pixi violations 0、明示compatibility entries 49 |
| context recovery E2E | PASS: active phaseのcheckpoint recovery、sound/log重複なし |

Full Jestの途中で、Vite boot contractがDOM-only `forceFullRender`を必須にしていた問題と、旧CSS配置を仮定するsource contract testを検出した。default Pixi graphからDOM-only boot requirementを除去し、compatibility CSS用test surfaceへ修正した後、全suiteを再実行してPASSした。testの削除、skip、threshold緩和は行っていない。

## Production smoke and deployment attempts

| Attempt | Result |
| --- | --- |
| `5943319fe`, Worker `7414975c-d97d-41a4-b9a9-475644acf317` | FAIL: `styles-board-dom-compat.css`がWorker root asset listから漏れ、bootがfail-closed。結果は破棄せず記録し、generatorと回帰testを修正 |
| `ffa1e9b90`, Worker `04561904-932b-4383-8942-68f38b6a10dc` | PARTIAL: bootは復旧したが、Pixi通常経路に空の`#board-expansion-layer`が残ることをDOM inspectionで検出 |
| `dc9c72633`, Worker `a52f098f-6b98-45df-bdca-5ea42093efad` | PASS: final production artifact |

最終production smokeでは次を確認した。

- 通常起動: `boardRenderer=pixi`、canvas 1、DOM cell 0、semantic layer 1、expansion layer 0、boot alertなし。
- 正確なdebug fallback: `boardRenderer=dom`、canvas 0、DOM cell 64、expansion layer 1、boot alertなし。
- DOM fallbackで合法手 `(2,3)` を入力し、CPU応答後にROUND 2、石数3対3、DOM renderer継続、canvas 0を確認。
- `worker:bundle:smoke`でmatch create/join/state/leaveを確認。

## Performance evidence and residual risk

Phase 9のblocking desktop readiness、hardware WebGL、同期apply/lifecycle、cross-browser/mobile-viewport機能gateはPASSしており、`docs/perf/pixijs-playfield-precutover.md`と`docs/perf/pixijs-playfield-cutover.md`に保存されている。

4 lane × 10分のstrict soakは共有workstationでのhistorical-candidate-failのままoptional diagnosticsとして保持する。今回のPhase 10完了判定のために再計測は行わず、failure sampleやthresholdを変更していない。physical Android Chrome、iPhone Safari実機GPU、paint/composite、thermal throttling、battery/power modeは未計測のresidual riskである。Playwright WebKitは機能互換性の証拠であり、Safari実機性能の証拠とは扱わない。
