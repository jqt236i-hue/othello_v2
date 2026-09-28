# ネット対戦演出契約 根本解決 作業報告書 2026-05-30

## 1. このチャットで扱った目的

このチャットでは、ブラウザ版カードリバーシのネット対戦で起きていた以下の問題を、局所修正ではなく、Worker / snapshot / playback / AnimationEngine の契約レベルで直すことを目的に調査・修正・検証を行った。

- ローカルでは正常だが、ネット対戦だけ演出・効果音・ハイライトが欠ける
- 強風系や超引力系が瞬間移動に見える
- 狙撃の意志で赤ハイライト、弾、破壊音が出ない
- 繁殖の意志で紫ハイライトや生成演出が抜ける
- 逃げる意志や躍動系が突然消える、または見え方が崩れる
- 特殊石がネット対戦で通常石の見た目に戻る
- 捕獲系が公開 Worker 上で失敗する
- 公開環境で room create / publish が 500 を返すことがある

最終目標は、公開 URL の Chrome + Edge 2 クライアント実機で、ネット対戦の見え方がローカル同等になることだった。

## 2. このチャットで確認した主な症状

ユーザー報告とこちらの再現調査で、少なくとも次を確認した。

- 狙撃の意志: 無音で石が消えるだけになる
- 繁殖の意志: 紫ハイライトや生成演出が抜ける
- 逃げる意志: 滑らかに動かず突然消えることがある
- 強風の意志: ローカルでは滑らかだがネット対戦では瞬間移動に見える
- 超引力: ネット対戦で使えない、または再生が崩れることがある
- 特殊石表示: ネット対戦だけ通常石の見た目に戻ることがある
- 躍動の意志: 黒側と白側で見え方が違うのではないか、という疑い
- 公開環境: `/api/match/create` や `/api/match/publish` が 500/409 を返すケース

## 3. 調査で確定した根本原因

### 3.1 ネット対戦演出契約の不完全さ

最初に確定したのは、ネット対戦で

- server authoritative snapshot
- playbackEvents
- client snapshot apply
- AnimationEngine playback

の契約が弱く、盤面の最終結果だけは同期される一方で、破壊前・移動前・生成前の視覚状態、効果音、ハイライト、特殊石見た目を全カードで保証できていなかったこと。

要するに、`結果は合っているが再生情報が足りない、または再生順が崩れている` 状態だった。

### 3.2 Worker runtime の module 解決不良

公開 Worker 上では、UMD 由来の module が `__esModule` だけを持つ空 export のような形で解決されるケースがあり、それを「読み込み成功」と誤認していた。

このせいで card-resolution 系の関数が正しく拾えず、捕獲系などが公開 Worker だけ壊れる経路があった。
公開診断では `CardOwnershipEffectsModule.applyCaptureWill is not a function` を確認した。

### 3.3 躍動系の乱数ズレ説

ユーザーから「躍動の意志が黒と白で分裂して見えるので、乱数未確定ではないか」という指摘があった。
このチャット内の最終公開実機検証では、**乱数ズレそのものは再現しなかった**。

最終確認時の結論は次の通り。

- Worker の確定結果は黒白で一致していた
- source マスに石が残る現象は最終的に消えていた
- 両クライアントとも特殊石は 1 個だけ表示された
- `hyperactive_move` も両側で再生された

したがって、このチャットで到達した結論としては、**躍動系の本質は RNG 不一致ではなく network playback の見え方崩れとして扱うのが正確**である。

## 4. このチャットで行った主な修正

### 4.1 playback 契約の強化

ネット対戦で `playbackEvents` を正式な再生 I/O として扱い、Worker / local server / UI adapter / AnimationEngine の契約を強化した。

この流れで、次の観点を重点修正した。

- raw event / presentation event から playback へ落とす経路の欠落補修
- snapshot 適用で最終盤面が先に見えて演出を潰す問題の修正
- `before` / `after` 視覚状態を使った ghost 再生の強化
- sound / highlight / destroy / move / spawn 系の playback 契約固定

関連ファイル:

- [C:\Users\quarr\Desktop\othello_v2\shared\playback-event-helpers.ts](C:\Users\quarr\Desktop\othello_v2\shared\playback-event-helpers.ts)
- [C:\Users\quarr\Desktop\othello_v2\ui\network\snapshot.ts](C:\Users\quarr\Desktop\othello_v2\ui\network\snapshot.ts)
- [C:\Users\quarr\Desktop\othello_v2\ui\animation-engine.ts](C:\Users\quarr\Desktop\othello_v2\ui\animation-engine.ts)
- [C:\Users\quarr\Desktop\othello_v2\game\turn\pipeline_ui_adapter.ts](C:\Users\quarr\Desktop\othello_v2\game\turn\pipeline_ui_adapter.ts)

### 4.2 躍動系 / 逃げる意志 / 強風 / 超引力 / 狙撃 / 繁殖 / 捕獲の個別再生崩れ修正

個別カードに場当たり対応するのではなく、上記契約修正の上で、各カードの playback が欠けないように調整した。

このチャット中に重点的に検証した対象:

- 狙撃の意志
- 繁殖の意志
- 逃げる意志
- 躍動の意志
- 強風
- 超引力
- 捕獲系
- 特殊石見た目維持

### 4.3 hyperactive Worker runtime fallback 修正

以前の反復で、Worker 類似環境で `EMPTY = 0` の扱いが崩れ、逃げる意志などの移動判定が壊れる経路を修正した。

関連:

- [C:\Users\quarr\Desktop\othello_v2\game\logic\cards\hyperactive.ts](C:\Users\quarr\Desktop\othello_v2\game\logic\cards\hyperactive.ts)
- [C:\Users\quarr\Desktop\othello_v2\test\game.hyperactive-runtime-global-fallback.test.ts](C:\Users\quarr\Desktop\othello_v2\test\game.hyperactive-runtime-global-fallback.test.ts)

### 4.4 UMD/empty export 問題を防ぐ module export helper 追加

公開 Worker での module 解決失敗を止めるため、usable export かどうかを明示判定する helper を追加し、resolver と runtime preload で利用するようにした。

追加・修正:

- [C:\Users\quarr\Desktop\othello_v2\shared\module-export-utils.ts](C:\Users\quarr\Desktop\othello_v2\shared\module-export-utils.ts)
- [C:\Users\quarr\Desktop\othello_v2\shared\module-export-utils.js](C:\Users\quarr\Desktop\othello_v2\shared\module-export-utils.js)
- [C:\Users\quarr\Desktop\othello_v2\game\logic\cards-internal\module-resolver.ts](C:\Users\quarr\Desktop\othello_v2\game\logic\cards-internal\module-resolver.ts)
- [C:\Users\quarr\Desktop\othello_v2\workers\match-worker-runtime-preload.ts](C:\Users\quarr\Desktop\othello_v2\workers\match-worker-runtime-preload.ts)
- [C:\Users\quarr\Desktop\othello_v2\workers\match-worker.ts](C:\Users\quarr\Desktop\othello_v2\workers\match-worker.ts)

### 4.5 `worker:prepare` の mirror verify 修正

`assets/asset-manifest.json` の `generatedAt` だけ違うケースで mirror verify が落ち、`npm run worker:prepare` を妨げていたため、その drift は無視できるように修正した。

関連:

- [C:\Users\quarr\Desktop\othello_v2\scripts\prepare-worker-assets.ts](C:\Users\quarr\Desktop\othello_v2\scripts\prepare-worker-assets.ts)
- [C:\Users\quarr\Desktop\othello_v2\test\scripts.prepare-worker-assets.test.ts](C:\Users\quarr\Desktop\othello_v2\test\scripts.prepare-worker-assets.test.ts)

## 5. このチャットで追加・強化した検証

### 5.1 自動テスト

このチャット中に、少なくとも次の系統を使って修正の regression を確認した。

- `npm run typecheck`
- `npm run build:ts`
- `npm run match:check`
- `npm run test:network:parity`
- focused Jest

focused で使った代表例:

- `test/shared.module-export-utils.test.ts`
- `test/game.cards-internal.module-resolver.test.ts`
- `test/scripts.prepare-worker-assets.test.ts`
- `test/workers.match-pending-effect-id.test.ts`
- `test/game.capture-will.test.ts`
- `test/ui.animation-engine.test.ts`
- `test/ui.animation-engine.move-variants.test.ts`
- `test/ui.network-snapshot.hyperactive-source-empty.test.ts`

### 5.2 公開 URL の Chrome + Edge 実機検証

このチャットでは、ローカルだけではなく、公開 URL で Chrome host / Edge guest の 2 クライアント対戦を繰り返し実施した。

対象:

- 狙撃の意志
- 繁殖の意志
- 逃げる意志
- 躍動の意志
- 強風
- 超引力
- 捕獲系
- room create / join / publish / reconnect の健全性

## 6. 実機証跡

このチャットで残した代表 artifact:

- [C:\Users\quarr\Desktop\othello_v2\tmp-live-check-1780093685466-deployed-special-proof](C:\Users\quarr\Desktop\othello_v2\tmp-live-check-1780093685466-deployed-special-proof)
- [C:\Users\quarr\Desktop\othello_v2\tmp-live-check-1780093862929-deployed-remaining-proof](C:\Users\quarr\Desktop\othello_v2\tmp-live-check-1780093862929-deployed-remaining-proof)
- [C:\Users\quarr\Desktop\othello_v2\tmp-live-check-1780094071565-deployed-super-attraction-proof](C:\Users\quarr\Desktop\othello_v2\tmp-live-check-1780094071565-deployed-super-attraction-proof)
- [C:\Users\quarr\Desktop\othello_v2\tmp-live-check-1780094402998-deployed-hyperactive-proof\summary.json](C:\Users\quarr\Desktop\othello_v2\tmp-live-check-1780094402998-deployed-hyperactive-proof\summary.json)

これらには、スクリーンショット、console/network 情報、playback summary が含まれる。

## 7. deploy 状況

このチャットの最終到達点として、公開 deploy 版は以下。

- 公開 URL: [https://card.reversi-0.workers.dev/](https://card.reversi-0.workers.dev/)
- 最終確認 deploy version: `beaa90ba-6842-438a-a1cb-1e1cfea923bf`

この version で、公開実機の最終確認を行った。

## 8. 最終確認結果

公開 URL 実機で最終的に PASS と確認した項目:

- room create
- room join
- 狙撃の意志
- 繁殖の意志
- 逃げる意志
- 躍動の意志
- 強風
- 超引力
- 捕獲系
- 特殊石の見た目維持

躍動の意志については、追加の公開実機確認で次を確認した。

- 黒白で同じ移動先に収束する
- source マスに石が残らない
- 特殊石は 1 個だけ見える
- `hyperactive_move` が両クライアントで鳴る

## 9. このチャットで作成・言及した主な commit

このチャット中の途中段階では、少なくとも次の修正単位が commit として扱われた。

- `df2836d77 Fix hyperactive worker runtime fallback`
- `a3002c82d Skip hyperactive phase gap in playback`

ただし、**最後の Worker module 解決修正一式については commit を切っていない**。

理由:

- 作業ツリーに既存の大きな未整理差分が混在していた
- 特に `workers/match-worker.ts` に今回修正と無関係の差分が多く、安全に分離 staging できる状態ではなかった

したがって、**deploy と実機証明は完了しているが、最後の修正一式は未コミット**である。

## 10. このチャット時点の結論

このチャットで到達した結論は次の通り。

1. ネット対戦だけ演出が壊れていた主因は、`snapshot` と `playbackEvents` の契約不足だった。
2. 公開 Worker だけ壊れる系の一部は、UMD/empty export を誤って有効 module と見なす runtime 解決不良が原因だった。
3. 躍動系の黒白差について、少なくともこのチャットの最終公開実機では RNG 不一致は確認できず、network playback 側の見え方問題として扱うのが正確だった。
4. 公開 URL の Chrome + Edge 2 クライアント実機で、対象 acceptance は通った。

## 11. 参考

このチャットで最後に Goal は完了として更新した。
記録上の使用量は `2,074,046 tokens`、経過は約 `2 時間 34 分`。

## 12. 2026-05-30 補遺（完遂計画実行フェーズ）

`docs/network-presentation-completion-plan-2026-05-30.md` の実行として、次を追加で完了した。

- `test/match-runtime-parity.test.ts` の parity 比較 canonicalizer を拡張し、`soundKeys` と `meta/target` の原因情報を比較対象へ追加
- `test/ui.animation-feedback-events.sound-keys.test.ts` を新規追加し、`sound-engine.ts` 登録の全39 key が `SoundEngine.playEffectByKey()` に到達することを固定
- `test:network:parity` スイートへ `apply-coordinator` / `sound-dedupe` / `pending-presentation-reconcile` を組み込み、重複SSE・順序・busy解放回帰を常時チェック化
- 既存 live artifact（Chrome host + Edge guest）4件の `summary.json` を再確認し、`passed: true` を確認

追加で確認したコマンド結果:

- `npm run typecheck` pass
- `npm run build:ts` pass
- `npx jest --runInBand --runTestsByPath test\\match-runtime-parity.test.ts` pass（6 tests）
- `npx jest --runInBand --runTestsByPath test\\ui.animation-feedback-events.sound-keys.test.ts` pass（2 tests）
- `npm run test:network:parity` pass（34 suites / 411 tests）

## 13. 2026-05-30 追記（Phase 6 完了と残タスク 0 化）

未完だった Phase 6（Worker runtime module audit）について、旧実装前提の回帰テストを現行契約へ更新し、focused suite と network parity 全体を再確認した。

- 更新: `test/workers.match-worker-card-preload.test.ts`
  - `scope.*` / 旧 `module.exports` 期待値を廃止
  - `ModuleExportUtils` / `unwrapRuntimeModule` / preload map / requiredGlobals の現行契約を検証
- focused suite pass:
  - `npx jest --runInBand --runTestsByPath test/shared.module-export-utils.test.ts test/game.cards-internal.module-resolver.test.ts test/workers.match-worker-preload.test.ts test/workers.match-worker-card-preload.test.ts test/workers.match-card-selector-preload.test.ts`
  - 結果: 5 suites / 24 tests 全pass
- 総合確認:
  - `npm run test:network:parity` pass（34 suites / 411 tests）

これにより、`docs/network-presentation-completion-plan-2026-05-30.md` 上の残フェーズはすべて完了扱いとなり、残りタスクは 0。
