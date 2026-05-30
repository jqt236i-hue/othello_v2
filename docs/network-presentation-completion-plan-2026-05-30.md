# ネット対戦演出・効果音 完全 parity 完遂計画 2026-05-30

## 1. 目的

ブラウザ版カードリバーシのネット対戦で、ローカル対戦・CPU対戦で出る演出、効果音、ハイライト、特殊石表示、カード使用表示をすべて同等に再生できる状態へ到達する。

この計画の完了条件は、「代表カードが通る」ではなく、現行 `cards/catalog.json` の全カードと、カード外の共通演出イベントについて、ローカル実行と Worker/net 対戦実行の presentation parity を自動テストと公開実機で確認できること。

## 実行状況 (2026-05-30)

- Phase 0: 完了
  - `npm run typecheck` pass
  - `npm run build:ts` pass
  - `npm run match:check` pass
  - `npm run test:network:parity` pass
- Phase 1: 完了
  - `docs/network-presentation-parity-matrix-2026-05-30.md` を生成
  - `cards/catalog.json` 全88カードを matrix 化
- Phase 3 (Worker publish parity 拡張): 進行
  - `test/workers.match-network-parity-missing-types.test.ts` を追加
  - 既存主要テストで未検出だった 41 type を worker authority smoke で回帰化
  - `test:network:parity` に新規テストを組み込み、30 suite / 397 tests pass
- Phase 7: 完了
  - `npm run worker:prepare` pass
  - root → `worker-public/` mirror 同期を実施

未完了:

- Phase 2 の local oracle（card type 単位の詳細比較データ固定）
- Phase 4 の sound key 単位 parity assertion 強化
- Phase 5 の reconnect / duplicate / ordering 追加網羅
- Phase 8 の公開 URL Chrome + Edge 実機 acceptance 更新

## 2. 対象範囲

対象に含めるもの:

- 全カード種別の `playbackEvents`
- 全 `sound_effect` key
- `card_use_button` などカード使用演出に紐づく効果音
- 置き、反転、破壊、爆発、移動、生成、消滅、通常石化、残ターン終了
- pending 選択、複数段階選択、選択キャンセル、publish 後の確定演出
- 特殊石の見た目、timer、タグ、長押し情報に必要な snapshot 表現
- 自分操作、相手操作、publish response、SSE、reconnect、force sync
- Worker/local server/browser runtime の module 解決と mirror

対象外:

- 新カード追加
- ルール変更
- 長時間 selfplay/training
- 効果音ファイル自体の音質調整
- 演出デザインの刷新

## 3. 正本と契約

優先順:

1. `01-rulebook.md`
2. `docs/architecture-contracts.md`
3. `docs/network-presentation-goal-worklog-2026-05-30.md`
4. `cards/catalog.json`
5. 実装とテスト

守る契約:

- Worker が canonical 結果と presentation replay data を出す。
- `playbackEvents` はネット対戦の正式な再生 I/O として扱う。
- `snapshot` は canonical state、`playbackEvents` は presentation replay であり、片方で片方を雑に代替しない。
- `game/` と `shared/` は headless を維持し、DOM、sound、timer、network client を直接扱わない。
- UI は Single Visual Writer と `events[]` / `playbackEvents` の順序を守る。
- `worker-public/` は mirror とし、root source 変更後に生成・同期する。

## 4. 成果物

必須成果物:

- `docs/network-presentation-parity-matrix-2026-05-30.md`
- 全カードのローカル vs Worker parity 自動テスト
- 全効果音 key のネット再生テスト
- snapshot apply が演出を潰さない regression test
- 公開 URL Chrome + Edge 実機確認 artifact
- 最終作業ログ更新
- coherent commit

任意成果物:

- parity matrix 生成スクリプト
- 公開実機確認の半自動 runner
- network playback debug summary の標準 JSON schema

## 5. 実行フェーズ

### Phase 0: 現状固定

目的:

- 既存修正の土台を崩さず、以後の差分を比較可能にする。

作業:

- `git status --short` が clean であることを確認する。
- 最新 commit hash を記録する。
- `npm run typecheck` を実行する。
- `npm run build:ts` を実行する。
- `npm run match:check` を実行する。
- `npm run test:network:parity` を実行する。

完了条件:

- baseline の通過/失敗が記録されている。
- 失敗がある場合、今回の parity 作業に入る前の既存失敗として分類されている。

### Phase 1: parity matrix 作成

目的:

- 全88カードと共通イベントについて、「何がローカルで出るべきか」を明文化する。

作業:

- `cards/catalog.json` から全カード type/cardId を抽出する。
- `01-rulebook.md` の演出・効果音仕様をカード別に対応付ける。
- `game/turn/pipeline_ui_adapter.ts` と `game/turn/pipeline-ui/*sound-cues*.ts` から sound cue を抽出する。
- `shared/playback-event-helpers.ts` と presentation profile から playback event 種別を抽出する。
- `ui/animation-engine.ts` と `ui/animation-*-events.ts` から UI が消費する event 種別を抽出する。

matrix の列:

- `cardId`
- `type`
- `displayName`
- `trigger`
- `local expected playback types`
- `local expected sound keys`
- `expected highlight`
- `expected movement`
- `expected destroy/spawn/flip`
- `expected special visual`
- `pending selection required`
- `network parity test exists`
- `worker publish test exists`
- `live checked`
- `notes`

完了条件:

- 全カードが matrix に載っている。
- カード外イベントも別表に載っている。
- 「仕様上、演出なし/効果音なし」の項目が空欄ではなく明示されている。

### Phase 2: ローカル playback oracle 作成

目的:

- ローカル実行で出るべき `playbackEvents` と `sound_effect` を機械的に取得できるようにする。

作業:

- headless turn pipeline を同一 seed/同一盤面/同一カードで実行する helper を用意する。
- pending なしカード、pending 1段階カード、pending 多段階カードを同じ形式で実行できるようにする。
- `playbackEvents` から比較に必要な安定フィールドだけを抽出する canonicalizer を用意する。
- 比較対象から runtime 依存の volatile field を除外する。

比較対象:

- `type`
- `phase`
- `targets`
- `meta.cause`
- `meta.reason`
- `meta.moveIntent`
- `meta.spawnIntent`
- `meta.before`
- `meta.after`
- `soundKey`

完了条件:

- 代表カードではなく、matrix の全カードに対して local oracle を生成できる。
- oracle 生成不能なカードは理由が matrix に記録されている。

### Phase 3: Worker publish parity test

目的:

- Worker authority がローカルと同じ再生情報を返すことを保証する。

作業:

- Worker publish を local server/Worker-like runtime で実行する test harness を整える。
- local oracle と Worker publish 結果の `playbackEvents` を比較する。
- pending 選択は operationId と effectId を固定して比較する。
- projection 後の snapshot に特殊石見た目情報が残ることを確認する。
- `sound_effect` が sanitize/projection で落ちないことを確認する。

重点カード:

- `SNIPER_WILL`
- `BREEDING_WILL`
- `ESCAPE_WILL`
- `HYPERACTIVE_WILL`
- `EXTREME_HYPERACTIVE_WILL`
- `INSTANT_HYPERACTIVE_WILL`
- `ULTIMATE_HYPERACTIVE_GOD`
- `STRONG_WIND_WILL`
- `SUPER_ATTRACTION_WILL`
- `CAPTURE_WILL`
- `TEMPT_WILL`
- `CORROSION_WILL`
- `EXTEND_LIFE_WILL`
- `BOARD_SHRINK_GOD`
- `STONE_SALVATION_GOD`

完了条件:

- 全カードの Worker publish parity が pass する。
- 例外は仕様上の非演出カードとして matrix に明記されている。

### Phase 4: snapshot apply / AnimationEngine parity test

目的:

- Worker から正しい `playbackEvents` が届いた後、browser UI がそれを潰さず再生することを保証する。

作業:

- `ui/network/snapshot.ts` の snapshot apply tests を拡張する。
- 最終盤面の先行反映が move/destroy/spawn/flip を潰さないことを確認する。
- source マスが空になる移動イベントで destroy fade が出ないことを確認する。
- `before` / `after` ghost replay が特殊石見た目を保持することを確認する。
- `AnimationEngine` が `sound_effect` を `SoundEngine.playEffectByKey()` に渡すことを全 key で確認する。

完了条件:

- snapshot apply と animation playback の regression test が pass する。
- 自分操作/相手操作のどちらでも同じ event が再生される。

### Phase 5: reconnect / duplicate / ordering test

目的:

- ネットワーク特有の重複・遅延・再接続で演出欠落や二重効果音が起きないことを保証する。

作業:

- publish response 後に同じ operation の SSE が来るケースを確認する。
- SSE 後に publish response が遅れて来るケースを確認する。
- reconnect snapshot が同じ `stateVersion` を再送するケースを確認する。
- より新しい snapshot が来た場合だけ authoritative overwrite されることを確認する。
- playback lock / busy flag / deferred publish release が両クライアントで解除されることを確認する。

完了条件:

- 効果音が二重再生されない。
- 演出が欠けない。
- UI が busy のまま固まらない。
- source/destination の見た目が両クライアントで一致する。

### Phase 6: Worker runtime module audit

目的:

- 公開 Worker だけ module 解決に失敗する再発を防ぐ。

作業:

- `workers/match-worker-runtime-preload.ts` の preload 対象を matrix と照合する。
- `workers/match-worker.ts` の embedded require map と preload map を照合する。
- `shared/module-export-utils.ts` で usable export 判定されることを test に追加する。
- UMD empty export、`__esModule` のみ、default nested export、named export の全パターンを確認する。

完了条件:

- 全 Worker-required module が usable として解決される。
- empty export を成功扱いしない。
- 捕獲系、対象選択系、sound cue assembler 系が公開 Worker 相当で動く。

### Phase 7: mirror / deploy preparation

目的:

- root source と `worker-public/` が一致した deploy 可能状態にする。

作業:

- `npm run build:ts`
- `npm run worker:prepare`
- `git diff -- worker-public public/module-registry.js` を確認する。
- `assets/asset-manifest.json` の `generatedAt` だけの drift で失敗しないことを確認する。

完了条件:

- worker mirror が root source 由来で同期されている。
- 手編集の mirror 差分がない。

### Phase 8: 公開 URL 実機 acceptance

目的:

- 自動テストでは拾えない実ブラウザ差異を Chrome + Edge で確認する。

環境:

- 公開 URL: `https://card.reversi-0.workers.dev/`
- Chrome: host
- Edge: guest
- 2 independent browser sessions

確認項目:

- room create
- room join
- host 操作の演出が guest に出る
- guest 操作の演出が host に出る
- publish response と SSE の重複で二重効果音にならない
- reconnect 後に特殊石見た目が維持される
- matrix の `live checked` 対象カードがすべて pass

最低 live card set:

- 狙撃の意志
- 繁殖の意志
- 逃げる意志
- 多動の意志
- 瞬間多動
- 極悪多動魔
- 究極多動神
- 強風の意志
- 超引力
- 捕獲の意志
- 誘惑の意志
- 腐食の意志
- 延命の意志
- 盤面縮小神
- 救済神
- 爆発系
- 盤面拡張系

完了条件:

- Chrome/Edge の両視点で PASS。
- console error / network 500 / 409 異常がない、または既知の expected case として説明できる。
- artifact に summary、screenshots、console、network、playback summary が残っている。

## 6. 推奨テストコマンド

基本:

```powershell
npm run typecheck
npm run build:ts
npm run match:check
npm run test:network:parity
```

focused:

```powershell
npx jest --runInBand --runTestsByPath test/shared.module-export-utils.test.ts
npx jest --runInBand --runTestsByPath test/game.cards-internal.module-resolver.test.ts
npx jest --runInBand --runTestsByPath test/workers.match-card-selector-preload.test.ts
npx jest --runInBand --runTestsByPath test/workers.match-pending-effect-id.test.ts
npx jest --runInBand --runTestsByPath test/workers.match-publish-sanitize.test.ts
npx jest --runInBand --runTestsByPath test/workers.match-publish-idempotency.test.ts
npx jest --runInBand --runTestsByPath test/network.playback-event-assembly.contract.test.ts
npx jest --runInBand --runTestsByPath test/game.pipeline-ui-adapter.sound-cue.test.ts
npx jest --runInBand --runTestsByPath test/ui.network-client.sound-dedupe.test.ts
npx jest --runInBand --runTestsByPath test/ui.network-snapshot.move-source-empty.test.ts
npx jest --runInBand --runTestsByPath test/ui.network-snapshot.hyperactive-source-empty.test.ts
npx jest --runInBand --runTestsByPath test/ui.animation-engine.move-variants.test.ts
```

mirror:

```powershell
npm run worker:prepare
```

## 7. 完了判定

この計画は、次をすべて満たした時点で完了とする。

- 全カードが parity matrix に記録されている。
- 全カードについてローカル oracle がある、または「演出なし」が明記されている。
- Worker publish parity が全対象で pass している。
- `sound_effect` が全 key でネット再生される。
- snapshot apply が move/destroy/spawn/flip/special visual を潰さない。
- reconnect / duplicate SSE / delayed publish response で欠落・二重再生・busy stuck がない。
- `worker:prepare` 済み。
- 公開 URL の Chrome + Edge 実機確認が pass。
- 最終 deploy version と artifact path が作業ログに追記されている。
- 変更が commit 済み。

## 8. 注意点

- 代表カードだけの PASS を「完全修正」と扱わない。
- Worker と browser で並列実装を増やさない。
- `snapshot` に演出判断を寄せすぎない。
- `playbackEvents` の順序を UI 側で並べ替えない。
- `worker-public/` を source として直接編集しない。
- 一時 artifact は `tmp-*` 配下に置き、必要な summary だけを docs へ残す。
- 失敗を broad catch や silent fallback で隠さない。
