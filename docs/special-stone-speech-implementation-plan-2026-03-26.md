# 特殊石吹き出し発話 implementation plan

作成日: 2026-03-26
対象: game / shared / ui / test / docs / worker-public
状態: Draft
一次情報:
- `01-rulebook.md`
- `shared/special-stone-registry.js`
- `game/turn/turn_pipeline_phase_helpers.js`
- `game/turn/turn_pipeline_phases.js`
- `game/turn/pipeline_ui_adapter.js`

## 0. この文書の位置づけ

- この文書は、特殊石の吹き出し発話を既存の `observer_bubble` 経路へ安全に拡張するための implementation plan である。
- 一次仕様は `01-rulebook.md` とし、本文書は **対象範囲 / event hook / 文言 authoring 単位 / 実装順 / 完了条件 / 検証束** だけを定める。
- 既存の `盤理の観測者石` と `労働石` のセリフはユーザー本人が決めたため、本文書では **その文言を一切変更しない** ことを hard requirement とする。

## 0.1 今回固定する要求

- `盤理の観測者石` と `労働石` の既存セリフは変更しない。
- `絶対保護石` は通常の「登場 / 破壊 / 持続切れ」対象に含めず、**進化した瞬間だけ** 喋らせる。
- 以下は吹き出し対象から除外する。
  - `罠石`
  - `時限爆弾`
  - `守る石`
  - `十字爆弾`
  - `クロス爆弾`
  - `金石`
  - `銀石`
  - `水晶石`
  - `虹石`
- `凍結マス` / `封鎖マス` / `流星穴` はマス状態寄りなので今回の吹き出し対象に含めない。
- 文言は「シチュエーション × 5パターン」を基本単位にする。
- `悪食石` の登場セリフ 5 パターンのうち 1 つは **「いっぱい食べる俺が好き」** を固定採用する。

## 0.2 追加で必要な特殊シチュエーション

- `時間停石`: 時間停止が発動した瞬間
- `復活石`: 復活が発動した瞬間
- `幽体石`: 効果対象になったのに受けなかった瞬間
- `継承多動石`: 自分の石を選択した瞬間
- `継承多動石`: 通常石が継承多動石になった瞬間
- `逃亡石`: 移動先が無くなって爆発した瞬間
- `絶対保護石`: `強い石` から進化した瞬間

## 0.3 非目標

- `盤理の観測者石` / `労働石` の既存セリフ修正
- 除外対象への吹き出し追加
- `observer_bubble` UI の作り直し
- ルールそのものの変更
- sound key や effect log の別設計

---

## 1. 検証済みの事実

### 1.1 既存の吹き出し表示経路はすでに共通化できる形になっている

- 既存の `盤理の観測者石` / `労働石` のセリフ定義は `game/turn/turn_pipeline_phase_helpers.js` に集約されている。
  - 根拠: `game/turn/turn_pipeline_phase_helpers.js:13-35`
- `game/turn/turn_pipeline_phases.js` は `OBSERVER_BUBBLE` / `WORK_BUBBLE` presentation event を出し、UI 側はそれを `observer_bubble` playback event へ流している。
  - 根拠: `game/turn/turn_pipeline_phases.js:288-345`
  - 根拠: `game/turn/pipeline_ui_adapter.js:1146-1225`
- 直近の準備リファクタで、`turn_pipeline_phase_helpers.js` に `SPECIAL_STONE_BUBBLE_SPEECH` と `getSpecialStoneBubbleSpeech(...)` が追加され、`turn_pipeline_phases.js` 側も共通 `emitSpeechBubblePresentation(...)` を持つ形へ整理済み。
  - 根拠: `game/turn/turn_pipeline_phase_helpers.js:13-44,138-153`
  - 根拠: `game/turn/turn_pipeline_phases.js:288-345`

### 1.2 観測石 / 労働石の既存文言はそのまま保存すべきである

- 既存セリフは `SPECIAL_STONE_BUBBLE_SPEECH.OBSERVER` と `SPECIAL_STONE_BUBBLE_SPEECH.WORK` に格納されている。
  - 根拠: `game/turn/turn_pipeline_phase_helpers.js:13-44`
- 以後の実装では、この 2 種については lookup を使っても **中身を書き換えない**。

### 1.3 特殊石の寿命イベントは `STATUS_APPLIED` / `STATUS_REMOVED` に寄せられている

- `revertSpecialStoneAt(...)` は `STATUS_REMOVED` を emit し、`meta.special` と `reason` を積んでいる。
  - 根拠: `game/logic/board_ops.js:1197-1273`
- `pipeline_ui_adapter.js` はすでに `status_removed` の `duration_end` 系を識別して phase を組み立てている。
  - 根拠: `game/turn/pipeline_ui_adapter.js:1666-1719`

### 1.4 強い石 → 絶対保護石の進化は既存 presentation event で拾える

- `PERMA_PROTECTED` は所有者ターン開始時に進捗を進め、閾値到達で `ABSOLUTE_PROTECTED` へ変化し、`STATUS_APPLIED` / `reason: strong_will_promoted` を emit している。
  - 根拠: `game/logic/cards-internal/effect-timing.js:124-156`
- UI / sound 側もこの `strong_will_promoted` を既存の進化イベントとして扱っている。
  - 根拠: `game/turn/pipeline_ui_adapter.js:2207-2218`

### 1.5 時間停石の「時間停止発動」は既存 raw event で拾える

- `processTimeStopEffectsAtTurnStartAnchor(...)` は残りターン 0 到達時に通常石化し、`triggered` を返す。
  - 根拠: `game/logic/cards.js:795-832`
- `turn_pipeline_phases.js` はそれを `time_stop_triggered` raw event にしている。
  - 根拠: `game/turn/turn_pipeline_phases.js:1111-1119`

### 1.6 復活石の「復活した瞬間」は既存 reason で拾える

- `REGEN` は発動時に `BoardOps.changeAt(..., 'REGEN', 'regen_triggered')` を呼び、使い切り時は `STATUS_REMOVED` / `reason: regen_consumed` を emit している。
  - 根拠: `game/logic/cards/regen.js:221-299`

### 1.7 幽体石の「対象になったのに受けない瞬間」は既存 reason で拾える

- `BoardOps.destroyAt(...)` と `BoardOps.changeAt(...)` は `GHOST` により無効化されると `blockedByGhost: true` / `reason: ghost_protected` を返し、presentation event にも `meta.blockedByGhost` を乗せている。
  - 根拠: `game/logic/board_ops.js:944-960`
  - 根拠: `game/logic/board_ops.js:1148-1164`

### 1.8 継承多動石は「選択」と「継承成立」を分けて扱える

- 対象選択確定時に `hyperactive_inherit_selected` raw event が出る。
  - 根拠: `game/turn/turn_pipeline_phases.js:2086-2094`
- 実際の継承処理は `applyHyperactiveInheritWill(...)` が `INHERITED_HYPERACTIVE` marker を追加して完了する。
  - 根拠: `game/logic/cards.js:3628-3653`

### 1.9 逃亡石の爆発は既存 destroy reason で拾える

- `ESCAPE_HYPERACTIVE` は移動候補が無い場合 `escape_no_candidates_explosion` reason で爆発する。
  - 根拠: `game/logic/cards/hyperactive.js:951-973`
  - 根拠: `test/game.pipeline-ui-adapter.destroy-batch.test.js:85-89`

---

## 2. 今回の発話対象

### 2.1 既存文言を保持したまま使う特殊石

- `盤理の観測者石`
- `労働石`

### 2.2 今回新規に性格と文言を付ける特殊石

- `弱い石`
- `強い石`
- `究極反転龍`
- `繁殖石`
- `増殖石`
- `究極破壊神`
- `破壊龍`
- `狙撃石`
- `落雷石`
- `多動石`
- `極悪多動魔`
- `逃亡石`
- `ロボット掃除機石`
- `悪食石`
- `究極多動神`
- `継承多動石`
- `復活石`
- `時間停石`
- `幽体石`
- `残像石`
- `意志狩りの王`

### 2.3 一般ロールアウトから外し、個別タイミングだけ喋らせる特殊石

- `絶対保護石`
  - 進化タイミング (`strong_will_promoted`) のみ

### 2.4 吹き出し対象外

- `罠石`
- `時限爆弾`
- `守る石`
- `十字爆弾`
- `クロス爆弾`
- `金石`
- `銀石`
- `水晶石`
- `虹石`
- `凍結マス`
- `封鎖マス`
- `流星穴`

---

## 3. authoring 単位

### 3.1 基本単位

- 文言は **`特殊石 × シチュエーション × 5パターン`** を 1 セットとする。
- ただし、実際のゲームルールに `duration_end` が存在しない石へ fake な持続切れ台詞は作らない。
- その石に本当に存在する lifecycle / special trigger にだけ台詞を持たせる。

### 3.2 標準シチュエーション

- `place`
- `destroy`
- `duration_end`

### 3.3 追加シチュエーション

- `time_stop_triggered`
- `regen_triggered`
- `ghost_protected`
- `inherit_selected`
- `inherit_applied`
- `escape_exploded`
- `absolute_protected_promoted`

### 3.4 stone ごとの特記事項

- `強い石`
  - `duration_end` ではなく `absolute_protected_promoted` を主シナリオにする。
- `絶対保護石`
  - `absolute_protected_promoted` の 5 パターンのみを持つ。
- `時間停石`
  - `place` / `destroy` / `duration_end` に加えて `time_stop_triggered` を持つ。
- `復活石`
  - `place` / `destroy` / `duration_end` に加えて `regen_triggered` を持つ。
- `幽体石`
  - `place` / `destroy` / `duration_end` に加えて `ghost_protected` を持つ。
- `継承多動石`
  - `inherit_selected` と `inherit_applied` を別シナリオで持つ。
- `逃亡石`
  - `destroy` とは別に `escape_exploded` を持つ。
- `悪食石`
  - `place` の 5 パターンのうち 1 つは **「いっぱい食べる俺が好き」** を固定採用する。

---

## 4. 実装方針

### Phase 1: 仕様更新

- `01-rulebook.md` に対象・除外・特殊シチュエーションを明記する。
- とくに以下を先に固定する。
  - `観測石` / `労働石` の既存文言は変更しない
  - `絶対保護石` は進化時のみ
  - `duration_end` が存在しない石へは fake シナリオを足さない

### Phase 2: 文言カタログ追加

- `game/turn/turn_pipeline_phase_helpers.js` に新規 speech catalog を追加する。
- 既存 `SPECIAL_STONE_BUBBLE_SPEECH.OBSERVER` / `.WORK` は immutable 扱いにする。
- 新規対象は `specialType -> scenario -> 5 lines` で引ける形にする。
- 追加シチュエーションは別 key として持つ。

### Phase 3: presentation event 契約の拡張

- `観測石` / `労働石` の既存 `OBSERVER_BUBBLE` / `WORK_BUBBLE` はそのまま維持する。
- それ以外は新規の汎用 presentation event（仮称 `SPECIAL_STONE_BUBBLE`）を追加する。
- payload には最低でも以下を持たせる。
  - `special`
  - `scenario`
  - `player`
  - `row`
  - `col`
  - `text`
  - `meta.reason`

### Phase 4: generic lifecycle hook

- `turn_pipeline_phases.js` で placement 直後の `effects.*Placed` を見て、新規 speech 対象 stone の登場台詞を出す。
- `STATUS_REMOVED` を読み、`destroy` と `duration_end` を切り分けて汎用 bubble を生成する。
- 同一セル・同一 phase の二重発火を抑止する。
- `観測石` / `労働石` は既存優先順位を維持し、新しい汎用 hook と干渉させない。

### Phase 5: 追加シチュエーション hook

- `strong_will_promoted` -> `絶対保護石` 進化台詞
- `time_stop_triggered` -> `時間停石` 発動台詞
- `regen_triggered` -> `復活石` 復活台詞
- `ghost_protected` -> `幽体石` 無効化台詞
- `hyperactive_inherit_selected` -> `継承多動石` 選択台詞
- `applyHyperactiveInheritWill(...)` 完了時 -> `継承多動石` 継承成立台詞
- `escape_no_candidates_explosion` -> `逃亡石` 爆発台詞

### Phase 6: playback / UI 接続

- `pipeline_ui_adapter.js` に `SPECIAL_STONE_BUBBLE` の mapping を追加する。
- 出力先は既存の `observer_bubble` playback event を使い、UI 追加はしない。
- `ui/animation-engine.js` 側は既存 bubble 表示のままで動く前提とする。

### Phase 7: test / mirror / verify

- 既存 Observer / Work 回帰を先に固定する。
- 追加対象については placement / destroy / duration_end / special trigger の代表ケースを test 化する。
- root 側修正後、必要なら `npm run worker:prepare` で `worker-public/` を同期する。

---

## 5. 代表的な実装ポイント

- `game/turn/turn_pipeline_phase_helpers.js`
  - speech catalog
  - scenario lookup helper
- `game/turn/turn_pipeline_phases.js`
  - generic bubble emission
  - raw event / presentation event bridge
- `game/turn/pipeline_ui_adapter.js`
  - `SPECIAL_STONE_BUBBLE` -> `observer_bubble`
- `game/logic/cards-internal/effect-timing.js`
  - `strong_will_promoted` / placed flags まわりの既存 event を汎用 bubble 対象へ結びつけるか確認
- `game/logic/cards/regen.js`
  - `regen_triggered` / `regen_consumed`
- `game/logic/board_ops.js`
  - `ghost_protected` の presentation payload 利用
- `game/logic/cards.js`
  - `processTimeStopEffectsAtTurnStartAnchor(...)`
  - `applyHyperactiveInheritWill(...)`
- `game/logic/cards/hyperactive.js`
  - `escape_no_candidates_explosion`

---

## 6. 完了条件

- `01-rulebook.md` に新しい吹き出し仕様が書かれている。
- `観測石` / `労働石` の既存文言が変更されていない。
- `絶対保護石` は進化時だけ喋る。
- 除外対象 9 種に吹き出し追加が入っていない。
- `時間停石` / `復活石` / `幽体石` / `継承多動石` / `逃亡石` の追加シチュエーションに台詞が付いている。
- `悪食石` の登場セリフに **「いっぱい食べる俺が好き」** が含まれている。
- playback 順序と既存 bubble 表示が崩れていない。
- 必要な test / `worker:prepare` の結果が報告できる。

## 7. 検証束

```powershell
npm run test:jest -- --runTestsByPath `
  test\game.observer-will.test.js `
  test\game.duration-end-revert.test.js `
  test\game.ghost-will.test.js `
  test\game.hyperactive-inherit-will.test.js `
  test\game.time-stop-god.test.js `
  test\game.regen.consume-visual.test.js `
  test\game.pipeline-ui-adapter.draw.test.js `
  test\game.pipeline-ui-adapter.special-revert-phase.test.js `
  test\game.pipeline-ui-adapter.sound-cue.test.js `
  test\game.pipeline-ui-adapter.destroy-batch.test.js `
  test\game.pipeline-ui-adapter.regen-status-removed.test.js `
  test\ui.animation-engine.observer-bubble.test.js
```

- root 側変更が `worker-public/` に波及したら `npm run worker:prepare`

