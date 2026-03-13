---
name: card-effect-integration-workflow
description: 'カードの追加、削除、仕様変更を、catalog 生成から logic, pending target, CPU, presentation, worker-public 同期まで漏れなく通すワークフロー。Use when adding, removing, or editing card definitions, cards/catalog.json, cards/catalog.generated.js, game/card-effects/*, pending target handling, card removal references, or related card integration tests in this card-othello repository.'
argument-hint: 'どのカードをどう変えたいか。add, remove, edit, catalog, effect, pending target, CPU, presentation のどれが絡むかも書く'
---

# Card Effect Integration Workflow

このスキルは、このリポジトリでカードの追加、削除、仕様変更を end-to-end で安全に通すための実務手順です。

## When to Use

- 新カードを追加したい
- 既存カードを削除したい
- 既存カードの効果や対象選択を変えたい
- `cards/catalog.json` と runtime の挙動がずれる
- pending target, CPU, presentation のどこかだけ取りこぼしている
- destroy 系や selection 系カードで UI と logic が食い違う

## Default Stance

- 挙動変更なら `01-rulebook.md` を先に更新する
- catalog 生成は任意ではなく、カード変更の一部として扱う
- 削除は catalog から消す前に `cardId` / `type` / 表示名の参照検索を先に行う
- generic な target 選択は `game/turn-handlers/pending-target-selector.js` に寄せる
- async ONNX や rerank の都合は `game/cpu-decision.js` 側に寄せる
- UI への見せ方は pipeline / presentation / playback 経路で通し、直接 DOM を増やさない
- root を正本にし、`worker-public/` は必要時に prepare で揃える

## Repo-specific Facts

- card 定義の入口は `cards/catalog.json`
- 生成物は `cards/catalog.generated.js` で、runtime 側の参照は `cards/catalog.js`
- logic 入口は `game/logic/cards.js`
- effect 本体は `game/card-effects/*.js`
- pending target の共通入口は `game/turn-handlers/pending-target-selector.js`
- UI 反映の橋渡しは `game/turn/pipeline_ui_adapter.js`
- presentation 側は `ui/presentation-handler.js` と `ui/playback-engine.js`
- `shared/deck-spec.js` と `shared/story-deck-spec.js` は catalog 由来の card 一覧を前提にしている
- `ui/handlers/rules-help.js` と `docs/Card_Strategy_Full_Catalog.md` は card 一覧や説明の残骸が残りやすい
- cards internal を増やす時は browser load order と `test/index.card-module-scripts.test.js` も影響する

## Procedure

1. 先にルールを読む
   - `01-rulebook.md` を一次情報として確認する
   - `AGENTS.md` と `.github/copilot-instructions.md` を確認する
   - `cards/`, `game/`, `ui/`, `constants/` に効く instruction を確認する
   - repo memory の card / pending target / destroy 系メモを確認する

2. 変更の種類を分類する
   - card 追加か
   - card 削除か
   - catalog 定義だけの変更か
   - effect logic の変更か
   - pending target を伴う変更か
   - destroy / special marker を伴う変更か
   - CPU / presentation / playback まで波及する変更か

3. 読む順を固定する
   - 削除や rename に近い変更なら、対象の `cardId` / `type` / 表示名を全文検索する
   - `cards/catalog.json` / `cards/catalog.generated.js` / `cards/catalog.js` の関係を確認する
   - `game/logic/cards.js` の apply / use / pending state を確認する
   - 対象の `game/card-effects/*.js` を確認する
   - `game/turn-handlers/pending-target-selector.js` と `game/turn/pipeline_ui_adapter.js` を確認する
   - `game/cpu-decision.js` と `game/ai/cpu-policy-core.js` を確認する
   - `cards/card-interaction.js`, `ui/presentation-handler.js`, `ui/playback-engine.js` を確認する
   - 削除時は `shared/deck-spec.js`, `shared/story-deck-spec.js`, `ui/handlers/rules-help.js`, `test/`, `docs/` への残り参照を確認する
   - 必要なら `worker-public/` mirror と index script order を確認する

4. 小さく編集する
   - catalog 変更後は生成物まで揃える
   - card 削除時は catalog から消すだけで終わらせず、残り参照を削除または置換する
   - pending target の generic ranking を effect module 側へ散らさない
   - destroy 系では `destroyAt()` より前に特殊 marker を消さない
   - presentation event を emit し忘れない
   - UI 都合の分岐を `game/logic/cards.js` に増やしすぎない

5. 波及を確認する
   - 削除した `cardId` / `type` を deck spec, story deck, rules help, docs, test がまだ前提にしていないか
   - CPU のカード選択や pending target rerank がズレていないか
   - pipeline adapter 経由で next state が UI に届いているか
   - browser load order が必要な変更か
   - `worker-public/` mirror に prepare が必要か

6. 検証する
   - `npm run generate:catalog`
   - `npx jest test/cards.generate.test.js test/cards.catalog.test.js --runInBand`
   - `npx jest test/game.pending-target-selector.test.js --runInBand`
   - cardId 削除や有効カード集合の変更時は `npx jest test/shared.deck-codec.test.js test/story-deck-lab.page.test.js --runInBand` を追加する
   - 対象カードの unit test を回す
   - `npm run test:jest:changed`
   - HTML / mirror まで触った場合は `npm run worker:prepare` を追加する

7. 最後に報告を固定する
   - root cause が catalog / logic / pending target / CPU / presentation のどこだったかを書く
   - 生成物と `worker-public/` を同期したかを書く
   - 実行した test と結果を書く
   - `01-rulebook.md` を更新したか必ず書く
   - 最後に専門用語を避けた短い説明を付ける

## Branching Guide

- catalog は直したのに runtime が古い
  - `cards/catalog.generated.js` の更新と `cards/catalog.js` の参照を先に確認する

- card を消したのにどこかがまだ壊れる
   - `cardId` / `type` / 表示名を `test/`, `shared/deck-spec.js`, `shared/story-deck-spec.js`, `ui/handlers/rules-help.js`, `docs/` で再検索する

- 対象選択だけ壊れる
  - `pending-target-selector.js` と `game/cpu-decision.js` の責務境界を先に見る

- destroy 系だけ挙動が変
  - marker を消す順と `destroyAt()` 周りを先に確認する

- logic は合っているのに表示だけ違う
  - `pipeline_ui_adapter.js` と `ui/presentation-handler.js` の event 連携を見る

- browser だけ読み込みが壊れる
  - cards internal の preload 順と `test/index.card-module-scripts.test.js` を確認する

## Guardrails

- `cards/catalog.json` を変えたら生成物を揃える
- card 削除前に `cardId` / `type` / 表示名の参照を全文検索する
- generic な target ranking を `pending-target-selector.js` から外へ散らさない
- `destroyAt()` より前に特殊 marker を消さない
- presentation event を emit し忘れて logic だけ成功させない
- root 変更後に必要な `worker-public/` prepare を忘れない

## Stop And Clarify Only If

- カード仕様そのものを変える必要があるが、期待する新挙動が曖昧
- card を無効化したいだけなのか、物理的に削除したいのかが曖昧
- 新しいカード種別や catalog 形式変更が必要
- 既存の未コミット変更と同じ card 関連ファイルで衝突している

## Good Prompts

- 新カードを追加したいので、catalog 生成から pending target と presentation まで漏れなく通して
- 既存カードを削除したいので、catalog と生成物だけでなく deck/test/docs の残り参照まで安全に片付けて
- 既存カードの destroy 挙動だけ壊れているので、marker の保持を含めて安全に直して
- 対象選択カードで CPU だけ変な候補を選ぶので、pending-target-selector と cpu-decision の境界を守って修正して
- catalog は更新済みなのに browser 側が古いので、生成物と load order を含めて整えて