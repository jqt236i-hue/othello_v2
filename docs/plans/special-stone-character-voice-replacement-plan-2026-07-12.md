# 特殊石・顕現石キャラクターボイス全面置換 実装計画

- 作成日: 2026-07-12
- 状態: Reviewed implementation plan
- 設計正本: `docs/superpowers/specs/2026-07-12-special-stone-character-voice-redesign.md`
- 人格設定参照: `assets/特殊石のキャラ設定メモ/全特殊石・顕現石キャラクター設定.md`

## 0. 文書の役割

この計画は、最新キャラクター設定を基に、罠・爆弾を除く特殊石26種のゲーム内吹き出しと顕現石3種の特殊カード固有セリフを全面置換する実装手順である。実装モデルは設計書を仕様判断の正本とし、本文書の順序で正本、台本、root source、テスト、生成物を更新する。

非目標は、ゲームルール変更、UIデザイン刷新、音声追加、顕現石の盤上吹き出し追加、routine能力発動ごとの発話追加である。

## 1. 開始前確認

### 作業

1. `git status --short` を実行し、既存変更を分類する。
2. 次の正本と現行実装を再読する。
   - `01-rulebook.md`
   - `docs/architecture-contracts.md`
   - `assets/特殊石のキャラ設定メモ/全特殊石・顕現石キャラクター設定.md`
   - `special-stone-speech-draft.md`
   - `game/turn/turn_pipeline_phase_helpers.ts`
   - `game/turn/presentation-helpers.ts`
   - `game/turn/pipeline-ui/passive-event-playback.ts`
   - `shared/special-card-registry.ts`
3. `node -e` またはfocused inspectionで現行 `SPECIAL_STONE_BUBBLE_SPEECH` の石種・シナリオ一覧を保存し、置換後比較に使う。
4. 旧セリフが存在するactive sourceを `rg` で列挙する。最低限、労働石固定文、顕現石3文、`GENERIC_LIVING_WILL_RESTORED_LINES`、`placeLines`、`lostLine` を確認する。

### 完了条件

- 作業ツリーの安全性が確認されている。
- 旧文が存在するactive sourceとテストが一覧化されている。
- generated/mirrorをsourceとして編集しないことが確認されている。

## 2. プレイヤー表示仕様と台本を先に確定する

### 2.1 `01-rulebook.md`

特殊石吹き出し節を設計書どおり更新する。

- 労働石の旧文固定・既存文維持要件を削除する。
- 対象を特殊石26種、除外を罠・爆弾系と明記する。
- 標準シナリオ `place` / `destroy` / `duration_end` / `normal_revert` / `living_will_restored` のプレイヤー向け意味を書く。
- 専用シナリオに時間停神、屍石感染・復活、労働収入を追加する。
- routine能力発動では話さないこと、専用発話と破壊発話を重ねないことを書く。
- 顕現石は特殊カード固有セリフだけを持ち、盤上の配置・終了吹き出しを追加しないことを維持する。
- 理論の化身、盤界の執行者、盤理の観測者の新しい固定固有セリフを、各カード節と特殊カード演出節の両方へ反映する。

### 2.2 `正本/演出正本.md`

- 顕現石3種の固有セリフだけを新文へ更新する。
- 暗転、立ち絵、背景、BGM、効果、短期サマリー、終了2秒演出の順序や時間は変更しない。

### 2.3 `special-stone-speech-draft.md`

既存内容を最新台本へ全面改稿する。

- 冒頭に役割、参照したキャラクター設定、除外対象、候補数、長さ制約を書く。
- 特殊石26種を設定メモと同じ日本語表示名順で並べる。
- 各石に設計書のシナリオ行列どおり候補文を記載する。
- 全26種へ `place` / `destroy` / `living_will_restored` を各5文用意する。
- 行列で必要な `duration_end` / `normal_revert` / 専用シナリオを各5文用意する。
- 労働収入はstep 1～5の固定文を用意する。
- 顕現石3種は固定固有セリフと `quoteLines` の意図した改行を記載する。
- 絶対保護石、継承多動石、罠、爆弾、石状態、配置時効果のセリフを含めない。
- 既存文は「いっぱい食べる俺が好き」を明示採用する場合を除き再利用しない。

### 執筆チェック

各石について次を目視チェックする。

- 一人称が設定メモと一致する。
- 語尾・丁寧さ・速度感が一致する。
- `destroy` は未練を匂わせ、説明文になっていない。
- 専用発動文は現在の効果へ反応している。
- 他石と同じ比喩や締めを連発していない。
- 34文字を超えず改行がない。

### 検証

```powershell
git diff --check
rg -n "絶対保護石|継承多動石|罠石|時限爆弾|十字爆弾|クロス爆弾" special-stone-speech-draft.md
```

除外名は冒頭の「除外対象」記述以外のセリフ見出し・本文に存在しないことを確認する。

### 完了条件

- プレイヤー表示仕様が新しい対象・優先順位・顕現固定文を定めている。
- 台本だけを読めば、実装者が全候補を転記できる。
- 設定メモ、rulebook、演出正本、台本の人格と顕現固定文が一致する。

### コミット

この仕様・台本単位を、実装とは分けたtask-owned commitにする。

## 3. 特殊石セリフカタログを全面置換する

### 対象

- `game/turn/turn_pipeline_phase_helpers.ts`
- `test/game.turn-pipeline-phase-helpers.special-stone-speech.test.ts`

### 作業

1. `SPECIAL_STONE_BUBBLE_SCENARIO_KEYS` を設計書の標準・専用シナリオへ更新する。
   - 追加: `normal_revert`、`time_stop_deity_triggered`、`zombie_infection`、`zombie_revived`、`work_income`
   - 削除: active sourceで利用されない `inherit_selected` / `inherit_applied`
2. `GENERIC_LIVING_WILL_RESTORED_LINES` を削除する。
3. `SPECIAL_STONE_BUBBLE_SPEECH` を台本と一致する内容へ全面置換する。
4. 特殊石26種をすべて登録する。
5. 各石に `place` / `destroy` / `living_will_restored` を登録し、行列に従って他シナリオを追加する。
6. `WORK` を標準シナリオ形式へ移行する。`incomeLinesByStep` は構造化マップとして保持する。
7. `WORK_PLACE_LINES` / `WORK_LOST_LINE` の互換exportがactive callerに必要か確認する。
   - active callerを後工程で汎用経路へ移した後、不要なら削除する。
   - 一時的に残す場合も新カタログから導出し、旧文字列を複製しない。
8. `getSpecialStoneBubbleSpeechLines(...)` は標準keyを直接解決し、旧 `placeLines` / `lostLine` 特例を最終状態から除く。
9. `resolveWorkIncomeLine(...)` は新しいstep文だけを返す。カタログ欠損時に古い人格の固定文へ戻さない。

### テスト

既存の全文一致テストを新台本へ更新するだけでなく、次の構造契約を追加する。

- 対象26種のexact set
- 除外対象が `null`
- シナリオ行列の候補数
- 各候補が文字列、trim後非空、改行なし、34文字以下
- 全候補の完全一致重複なし
- 全26種に固有 `living_will_restored` があり、配列参照も共有していない
- 労働収入step 1～5が存在する
- 執行者・観測者はこのカタログ対象ではない
- 「いっぱい食べる俺が好き」の採否が台本どおり

### 検証

```powershell
npm run test:jest -- --runTestsByPath test\game.turn-pipeline-phase-helpers.special-stone-speech.test.ts
```

### 完了条件

- カタログが特殊石26種と必要シナリオを完全に表現する。
- 古い汎用復活文と旧形式の本文特例がない。
- 台本とランタイムカタログの文言が石種・シナリオ単位で一致する。

## 4. 発話ルーティングを全26種へ完全化する

### 対象

- `game/turn/presentation-helpers.ts`
- 必要な場合のみ `game/turn/turn_pipeline_phases.ts`
- 必要な場合のみ `game/turn/phase-presentation-finalizer.ts`
- `game/turn/turn-start/post-processing.ts`
- 関連focused tests

### 4.1 配置

- `SPECIAL_STONE_PLACEMENT_EFFECT_SPECS` に `zombiePlaced -> ZOMBIE` を追加する。
- 既存の `protected`、`timeStopDeityPlaced` を含む26種の配置flagを照合する。
- 理論の化身・混沌召喚から直接生成される特殊石は、既存 `STATUS_APPLIED` / spawn metadataから `place` を1回出す。
- 屍石感染で生まれた個体は同phaseの `place` を出さず、感染元の `zombie_infection` だけを出す。

### 4.2 終了分類

- `STATUS_REMOVED` とsnapshot差分を次の順で分類する。
  1. `living_will_restored`
  2. 石固有復活・置換（増殖、復活石、屍石）
  3. 専用消滅（逃亡爆発、犠牲無効化、時間停止発動）
  4. `duration_end`
  5. `normal_revert`
  6. `destroy`
- `no_candidates_revert` は `normal_revert` とする。playback側の通常石化phase維持判定にも同じ意味を渡す。
- 残像石は既存reasonが通常石化を明示する場合だけ `normal_revert` とする。
- `anchor_expired` / `duration_end` は `duration_end` とする。
- 悪食石の飢餓消滅は `destroy` とする。

### 4.3 専用シナリオ

- 時間停神: deferred phase eventの `markerType: TIME_STOP_DEITY` を `time_stop_deity_triggered` へ解決する。
- 屍石感染: `cause: ZOMBIE` / `reason: zombie_infection` のCHANGEと、感染元 `sourceRow` / `sourceCol` を使って感染元へ1回発話する。
- 屍石復活: `reason: regen_triggered` かつpresentation上のspecialが `ZOMBIE` の場合に `zombie_revived` を出す。
- 復活石: 同じreasonでspecialが `REGEN` の場合だけ `regen_triggered` を出す。
- 既存の増殖、犠牲、幽体、逃亡、意志狩り専用シナリオを維持する。

### 4.4 生きる意志

- 復活元のspecial typeで `living_will_restored` を解決する。
- 共通文へフォールバックしない。
- 同じ個体の `destroy` / `duration_end` / `normal_revert` を抑止する。

### 4.5 労働石

- `LEGACY_SPECIAL_STONE_BUBBLE_TYPES.WORK` による配置・終了除外を解消する。
- 配置、破壊、持続切れ、生きる意志復活は `SPECIAL_STONE_BUBBLE` へ統一する。
- `WORK_INCOME` と収入stepは専用presentationを維持する。
- `WORK_REMOVED` の過去event読み取り互換は残してよいが、新規イベント生成では使わない。
- `turn_pipeline_phases.ts` の `FALLBACK_WORK_BUBBLE_SPEECH` から旧文を削除し、カタログ欠損時は発話を省略またはdev/testで検知する。

### テスト

更新・追加対象の中心:

- `test/game.special-stone-bubble-rollout.test.ts`
- `test/game.proliferation-will.test.ts`
- `test/game.sacrifice-will.test.ts`
- `test/game.time-stop-deity.test.ts`
- `test/game.zombie-will.test.ts`
- `test/game.theory-incarnation.test.ts`
- `test/game.pipeline-ui-adapter.living-will-revive.test.ts`
- `test/game.will-hunter-king.test.ts`

最低限のケース:

- 弱い石、究極反転龍、復活石、時間停神、屍石の配置
- 時限付き石の期限終了
- 多動系の `no_candidates_revert -> normal_revert`
- 屍石感染は感染元だけ1回
- 屍石復活は `zombie_revived` だけ
- 復活石復活は `regen_triggered` だけ
- 生きる意志は個別文だけで破壊文なし
- 労働石の配置・破壊・期限切れ・収入
- 理論/混沌生成個体の配置発話順
- trackerによる同一scenario二重発話抑止

### 検証

```powershell
npm run test:jest -- --runTestsByPath `
  test\game.special-stone-bubble-rollout.test.ts `
  test\game.proliferation-will.test.ts `
  test\game.sacrifice-will.test.ts `
  test\game.time-stop-deity.test.ts `
  test\game.zombie-will.test.ts `
  test\game.theory-incarnation.test.ts `
  test\game.pipeline-ui-adapter.living-will-revive.test.ts `
  test\game.will-hunter-king.test.ts
```

### 完了条件

- 設計書の全シナリオが既存reason/eventから決定論的に発火する。
- 専用シナリオと終了文が二重表示されない。
- 新しい正規状態、DOM依存、network client依存がgame層へ入っていない。

## 5. playback互換と旧フォールバックを整理する

### 対象

- `game/turn/pipeline-ui/passive-event-playback.ts`
- `game/turn/pipeline-ui/playback-after-state.ts`
- `game/turn/pipeline_ui_adapter.ts`
- `ui/animation-feedback-events.ts`（変更不要であることを先に確認）
- `test/game.pipeline-ui-adapter.draw.test.ts`
- `test/ui.animation-engine.observer-bubble.test.ts`
- `test/ui.animation-special-stone-phase-batching.test.ts`

### 作業

- `normal_revert` を通常石化phase保持対象へ追加する。
- `destroy` / `duration_end` / `normal_revert` / `escape_exploded` の生きる意志抑止を揃える。
- `SPECIAL_STONE_BUBBLE` payloadの `special` / `scenario` / `reason` / `text` をそのまま `observer_bubble` targetへ渡す。
- `pipeline_ui_adapter.ts` の `DEFAULT_WORK_LOST_BUBBLE_TEXT` など旧人格の固定本文を削除する。
- 過去の `WORK_BUBBLE` / `OBSERVER_BUBBLE` fixtureを読み取る互換は維持する。
- UIの3秒表示、700msフェード、位置、クリック非阻害、`textContent` 描画は変更しない。

### 検証

```powershell
npm run test:jest -- --runTestsByPath `
  test\game.pipeline-ui-adapter.draw.test.ts `
  test\game.pipeline-ui-adapter.living-will-revive.test.ts `
  test\ui.animation-engine.observer-bubble.test.ts `
  test\ui.animation-special-stone-phase-batching.test.ts
```

### 完了条件

- 新旧presentation eventの読み取り互換を保つ。
- 新規生成イベントは新カタログ本文だけを表示する。
- UIとSingle Visual Writerに変更がない。

## 6. 顕現石の固定固有セリフを置換する

### 対象

- `shared/special-card-registry.ts`
- `test/shared.special-card-registry.test.ts`
- `test/game.pipeline-ui-adapter.sound-cue.test.ts`
- `test/ui.animation-feedback-events.sound-keys.test.ts`

### 作業

- 台本で確定した3体の `quote` / `quoteLines` を反映する。
- `quoteLines.join('')` が、意図した句読点・空白を除き `quote` と同じ全文になることを確認する。
- 執行者の固定文には「俺様」、観測者の固定文には「ぞよ」を含める。
- カードID、markerType、画像、背景、BGM、cinematicKeyは変更しない。

### 検証

```powershell
npm run test:jest -- --runTestsByPath `
  test\shared.special-card-registry.test.ts `
  test\game.pipeline-ui-adapter.sound-cue.test.ts `
  test\ui.animation-feedback-events.sound-keys.test.ts
```

### 完了条件

- 3体の固有セリフが台本・rulebook・演出正本・registryで一致する。
- 暗転演出と文字送りの既存contractが維持される。
- 顕現石の盤上終了文は追加されていない。

## 7. 旧文・対象漏れ・重複を監査する

### 作業

1. 変更前に保存した旧セリフ一覧とactive sourceを比較する。
2. 明示再採用した「いっぱい食べる俺が好き」以外の旧本文が、active source・rulebook・演出正本・台本に残っていないことを確認する。
3. `GENERIC_LIVING_WILL_RESTORED_LINES`、`FALLBACK_WORK_BUBBLE_SPEECH` の旧本文、`DEFAULT_WORK_LOST_BUBBLE_TEXT` がないことを確認する。
4. カタログのexact target setが26種、manifest registryが3種であることを確認する。
5. 罠・爆弾が発話カタログに含まれないことを確認する。

### 代表コマンド

```powershell
rg -n "GENERIC_LIVING_WILL_RESTORED_LINES|FALLBACK_WORK_BUBBLE_SPEECH|DEFAULT_WORK_LOST_BUBBLE_TEXT|placeLines|lostLine" game test
rg -n "TRAP_REVEAL|TRAP|TIME_BOMB|CROSS_BOMB|X_BOMB" game/turn/turn_pipeline_phase_helpers.ts
```

`placeLines` / `lostLine` は他機能の無関係な一致を目視分類し、特殊石セリフ旧形式だけが消えていることを確認する。

### 完了条件

- 旧人格文の残存、対象漏れ、重複候補がない。
- 除外対象に発話がない。

## 8. 型・focused回帰・cross-runtime検証

### 8.1 型とheadless境界

```powershell
npm run typecheck
npm run check:window
```

### 8.2 focused bundle

前工程のfocused testsに加え、presentation・network contractをまとめて実行する。

```powershell
npm run test:jest -- --runTestsByPath `
  test\game.turn-pipeline-phase-helpers.special-stone-speech.test.ts `
  test\game.special-stone-bubble-rollout.test.ts `
  test\game.pipeline-ui-adapter.draw.test.ts `
  test\game.pipeline-ui-adapter.living-will-revive.test.ts `
  test\game.pipeline-ui-adapter.sound-cue.test.ts `
  test\game.proliferation-will.test.ts `
  test\game.sacrifice-will.test.ts `
  test\game.time-stop-deity.test.ts `
  test\game.zombie-will.test.ts `
  test\game.theory-incarnation.test.ts `
  test\game.will-hunter-king.test.ts `
  test\shared.special-card-registry.test.ts `
  test\ui.animation-engine.observer-bubble.test.ts `
  test\ui.animation-feedback-events.sound-keys.test.ts `
  test\ui.animation-special-stone-phase-batching.test.ts `
  test\network.playback-event-assembly.contract.test.ts
```

### 8.3 ネットワークparity

```powershell
npm run test:network:parity
```

### 完了条件

- headless、presentation、playback、networkの各層で新しい本文とscenarioが通る。
- authority/client間で本文の再抽選や順序差がない。

## 9. browser生成と実機表示

### 9.1 browser build

rootの表示文言ソースを変更するため、focused tests通過後に実行する。

```powershell
npm run build:browser
```

### 9.2 Worker mirror

```powershell
npm run worker:prepare
```

`worker-public/` は直接編集しない。`worker:dev` / `worker:deploy` は今回の検証目的では実行せず、`worker:prepare` 単独でmirrorを同期・検証する。

### 9.3 ブラウザ確認

最小のdebug scenarioまたは既存E2E fixtureで次を確認する。

- 短文が添付画像相当の石近傍位置へ表示される。
- 34文字上限の最長候補が最大幅内で自然に折り返す。
- 盤端・狭幅でviewport外へ大きくはみ出さない。
- 約3秒後にフェードアウトする。
- 吹き出し表示中もクリック操作を妨げない。
- 生きる意志復活で破壊文が重ならない。
- 時間停神、屍石感染、屍石復活で専用文が1回だけ出る。
- 顕現石3種の暗転固有セリフ、一文字送り、固定改行が正しい。
- 顕現終了時に文言が出ない。

必要なら最小のPlaywright/Jest E2Eを追加する。スクリーンショットは代表的な短文、最長文、顕現固定文を各1枚残す。

### 完了条件

- browser bundle/cachebusterとWorker mirrorがroot sourceに一致する。
- デスクトップと狭幅で可読性・位置・順序・操作性を確認できる。

## 10. 最終差分・コミット

### 作業

1. `git status --short` でtask-owned fileと生成物を分類する。
2. `git diff --check` を実行する。
3. 次の差分を個別に確認する。
   - player-visible specと台本
   - speech catalogとpresentation routing
   - manifest registry
   - tests
   - `build:browser` / `worker:prepare` による生成・mirror差分
4. 無関係な変更をstageしない。
5. 実装・テスト・生成物が一体なら1commit、仕様台本を先行commit済みなら実装完了commitを分ける。
6. 最終報告に、変更対象29体、除外対象、実行コマンドと結果、browser実機確認内容、commit ID、残存する無関係dirty fileを記載する。

### 完了条件

- 設計書の完了条件を全て満たす。
- 変更が検証済みcommitとして保存される。
- 作業ツリーの残存変更が明確に報告される。

## 11. 完了チェックリスト

- [ ] 設定メモの特殊石26種が全て新しい吹き出し台本を持つ（Step 2、3）
- [ ] 顕現石3種が新しい固定固有セリフを持つ（Step 2、6）
- [ ] 罠・爆弾系を含めていない（Step 2、3、7）
- [ ] 執行者が性別不詳の俺様口調、観測者が性別不詳の「～ぞよ」口調である（Step 2、6）
- [ ] 全候補が人格固有で重複なし、長さ制約内である（Step 2、3、7）
- [ ] 汎用の生きる意志復活文がなく、26種それぞれの復活文がある（Step 3、4）
- [ ] 時間停神と屍石の専用発話がある（Step 3、4）
- [ ] 労働石の旧形式・旧フォールバック本文が残らない（Step 3、4、5、7）
- [ ] 専用シナリオと破壊・終了文が二重表示されない（Step 4、5）
- [ ] routine能力で毎ターン3秒発話を追加していない（Step 4）
- [ ] 顕現石の配置・終了吹き出しを追加していない（Step 2、6、9）
- [ ] presentation/playback typeとcanonical stateを変更していない（Step 4、5、8）
- [ ] focused tests、typecheck、network parityが通る（Step 8）
- [ ] `npm run build:browser` と `npm run worker:prepare` が通る（Step 9）
- [ ] デスクトップ・狭幅・顕現演出を実機確認した（Step 9）
- [ ] 最終diffを確認し、task-owned filesだけをcommitした（Step 10）

## 12. Self-review

初稿では「文字列置換」を中心に工程化していたが、設計レビューで、労働石の旧イベント形式、複製フォールバック、共通復活文、時間停神・屍石の発話漏れが残ると判明した。そのためStep 3～5を分け、カタログ、発火分類、playback互換をそれぞれ客観的に完了判定できる形へ修正した。

また、台本を実装と同時に作ると仕様レビュー前にコードへ転記されるため、Step 2でrulebook・演出正本・全台本を先に確定し、仕様単位でcommitする順序へ変更した。顕現終了文禁止、routine発話抑制、生成物のsource-first順序も各工程へ明記した。

最終確認では、設計書の29体、除外、人格、一意性、シナリオ優先、ネットワーク権威、Single Visual Writer、browser生成、Worker mirror、実機確認、最終commitの全条件がplan stepとチェックリストへ対応している。実装モデルが現在の会話を参照せず実行でき、通常の設計判断を新たに行う必要はない。
