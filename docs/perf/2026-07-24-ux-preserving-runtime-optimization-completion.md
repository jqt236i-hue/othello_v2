# UX維持ランタイム最適化 完了レポート

- 総合判定: **PASS**
- candidate commit: `1dd8448dabb1a9bff832a3156ce5b9ed0cbe7973`
- candidate profile: `standard`
- candidate eligible: `true`
- comparison: `pass`
- deviceValidated: `false`
- generatedAt: `2026-07-23T17:19:15.355Z`

## 標準5サンプル比較

- sample count: `5`
- suite verdict: `pass`

| metric | baseline median | candidate median | delta |
| --- | ---: | ---: | ---: |
| board ready ms | 2075 | 1889.7 | -185.3 |
| boot encoded body bytes | 25568317 | 22313193 | -3255124 bytes (-12.73%) |

## 遅延feature p95

| feature | lane | first open p95 ms | stylesheet ready p95 ms | max CLS | Long Task total |
| --- | --- | ---: | ---: | ---: | ---: |
| profile | vite | 47.2 | 9.3 | 0 | 0 |
| profile | classic | 38.4 | 8.8 | 0 | 0 |
| rules-help | vite | 55.6 | 10.2 | 0 | 0 |
| rules-help | classic | 61.1 | 12.2 | 0 | 0 |
| deck-builder | vite | 101 | 22.1 | 0 | 0 |
| deck-builder | classic | 91.6 | 61.5 | 0 | 0 |
| network | vite | 66.2 | 14.1 | 0 | 0 |
| network | classic | 84 | 13.3 | 0 | 0 |
| result | vite | n/a | 7.6 | n/a | n/a |
| result | classic | n/a | 5.1 | n/a | n/a |

## 対局中フレーム安定性

- Long Task total: `0`
- 50ms RAF stall total: `0`
- RAF p95 ms: `16.8`
- all ticker idle: `true`

## Traceability

| optimization | kind | required captures | verdict |
| --- | --- | ---: | --- |
| `special-stone-demand-loading` | core | 10 | pass |
| `lock-only-hint-paint` | core | 2 | pass |
| `logical-image-deduplication` | core | 3 | pass |
| `help-image-lazy-loading` | core | 6 | pass |
| `dom-compat-stylesheet-lazy-loading` | core | 8 | pass |
| `lossless-webp-admission` | core | 2 | pass |
| `feature-result` | feature | 3 | pass |
| `feature-profile` | feature | 3 | pass |
| `feature-rules-help` | feature | 7 | pass |
| `feature-deck-builder` | feature | 3 | pass |
| `feature-network` | feature | 5 | pass |

## Identity / compatibility

- candidate artifact identity: pass
- baseline artifact identity: pass
- profile-role: pass
- fixture-digest: pass
- scenario-digest: pass
- capture-policy-digest: pass
- browser-version: pass
- os: pass
- gpu: pass
- viewport: pass
- dpr: pass

## Blocking failures

- なし

## 最終検証

- `checkall` / `typecheck` / `build:ts` / `build:vite`: pass
- 全Jest: 975 suites / 6902 tests pass
- network parity: 34 suites / 529 tests pass
- optimized assets: 12 font subset/full WOFF2 pairs、13 opaque backgrounds、3 optimized UI imagesを検証し、admission 1件をpass
- Pixi playback: 12 reports / 208 scenarios pass
- Pixi runtime fallback: explicit failure経路のVite/classicでstyled DOM fallback、64 cells、canvas 0、phase settlementをpass
- cross-platform: Chromium / Firefox / WebKit × desktop / touch mobile × Pixi / DOMの12 probes pass
- optional feature: gacha / cosmetic / leaderboard / commentary / CPU / ONNXの初回request、reopen、failure retryをpass
- asset delivery、Vite/classic UI control smoke: page / console / resource error 0でpass
- opponent-action quick: 5 scenarios × 5 valid samples、invalid 0、sync p95最大11.6ms、RAF p95最大16.8ms、app-attributed Long Task overlap 0
- Worker mirror: 922 files pass

物理Android/iPhone診断は任意範囲として未実施であり、`deviceValidated=false` のままです。desktop標準計測はhardware acceleration有効のANGLE D3D11 / NVIDIA GeForce RTX 2070で取得しました。

## 検出・是正履歴

- 最初の全体`checkall`でDOM compatibility特殊石preparationの3-module import cycleを検出し、headless正本mapへの一方向依存へ修正後にpassしました。
- 最初の全Jestは14 suites / 69 testsがfailしました。旧JSDOM fixtureのCSS/image readiness不足、移動前CSS正本を読むtest、deck-builder fragmentへ残った共有active ruleを是正し、975 suites / 6902 testsをpassしました。
- 最初のoptimized asset gateはCinzel subsetに現行runtimeで使う`Å`、`É`、`•`がなくfailしました。正規generatorで12書体を更新し、corpus不足0と17,937,216 bytes削減を確認しました。
- optional feature smokeの初回buildはWindowsの一時file-map競合（OS error 1224）で失敗しました。clean statusと変更なしを確認した同一commitの再試行は全checkをpassしました。
- completion rendererがencoded bodyのdeltaを単位なしの`-0.1`と表示する不整合を検出し、byte差と百分率の併記へ修正して回帰testを追加しました。raw計測値と合否判定に誤りはありませんでした。
