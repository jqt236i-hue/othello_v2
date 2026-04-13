---
name: 'card-description-surface-workflow'
description: 'カードのぱっと見説明と詳細説明を、rulebook / shared resolver / カード詳細 / カード図鑑 / overlay / tests / worker-public 同期まで漏れなく通すワークフロー。Use when changing quick effect text, detailed effect text, dedupe behavior between quick and detail, card detail panel copy, rules-help card encyclopedia copy, or shared card description resolver in this card-othello repository.'
argument-hint: 'どのカードの簡易説明 / 詳細説明をどう変えるか。文言だけか、重複除外や fallback も触るか、rulebook 更新が要るかを書く'
---

# Card Description Surface Workflow

このスキルは、カードの簡易説明と詳細説明を変える時に、仕様、shared resolver、カード詳細、カード図鑑、overlay、tests、mirror 同期まで漏れなく通す手順です。

## When to Use

- `カード詳細` のぱっと見説明、`詳細` を押した後の本文、`カード図鑑` の `簡易説明` / `詳細効果` を変更する時
- `cards/card-interaction-effects.js` の `quickCardEffectByType` / `detailCardEffectByType` / fallback / 重複除外を直す時
- `簡易説明` と `詳細効果` の重複除外ルールや placeholder fallback を直す時
- `cards/card-interaction.js` と `ui/handlers/rules-help.js` の説明表示経路をそろえる時

## Do Not Use

- カード効果そのもの、pending target、CPU、presentation まで仕様変更するなら `card-effect-integration-workflow`
- cost 変更だけなら `card-cost-adjustment-workflow`
- 文言変更ではなく責務整理が主目的なら `safe-rational-refactor`

## Read First

- `01-rulebook.md`
- `.github/copilot-instructions.md`
- `AGENTS.md`
- `cards.instructions.md`
- `ui.instructions.md`

## Primary Files

- `cards/card-interaction-effects.js`
- `cards/card-interaction.js`
- `ui/handlers/rules-help.js`
- 必要時だけ `cards/catalog.json`, `cards/catalog.js`, `cards/catalog.generated.js`
- `test/ui.rules-help-panel.test.js`
- `test/ui.card-detail-effect-tags.test.js`
- 影響カードごとの surface test

## Specification Anchors

- `01-rulebook.md` の `詳細` 本文は要約文の繰り返しを避ける契約を先に確認する
- `カード図鑑` は `簡易説明` と `詳細効果` を分け、`詳細効果` は重複文を除外し、重複しか残らないなら出さない
- 要約文は対象 / 起点 / 範囲 / ターン数を不用意に落とさない

## Common Traps

- `cards/catalog.json` の `desc` だけ直して、実際に UI で使う `quickCardEffectByType` / `detailCardEffectByType` を見落とすこと
- `cards/card-interaction.js` や `ui/handlers/rules-help.js` に局所の重複除外ロジックを足して shared resolver を迂回すること
- placeholder 文言や generic fallback を変えたのに、未定義カードの表示を確認しないこと
- `カード詳細` だけ直して `カード図鑑` や overlay 側の説明経路を確認しないこと
- `worker-public/` を先に直して root 正本の更新を忘れること

## Decision Gate

1. まず今回が文言変更だけか、表示契約の変更かを分ける。
2. 表示契約が変わるなら `01-rulebook.md` を先に更新する。
3. そのカードが explicit map (`quickCardEffectByType` / `detailCardEffectByType`) で管理されるべきか、catalog `desc` fallback で足りるかを決める。
4. surface ごとの差が必要なら、shared resolver の返り値は共通のままにして、UI 側では長さ制御や表示ラベルだけを変える。

## Procedure

1. 対象カードと影響 surface を固定する。少なくとも `カード詳細`, `詳細` タブ, `カード図鑑`, overlay のどこに出るかを列挙する。
2. `01-rulebook.md` の説明表示契約と矛盾しないかを確認し、必要なら先に更新する。文言差し替えだけで仕様変更が無いなら更新不要理由を残す。
3. shared resolver の正本を `cards/card-interaction-effects.js` に寄せる。`quickCardEffectByType`, `detailCardEffectByType`, `fallbackQuickCardEffect`, `fallbackDetailCardEffect`, `resolveNonDuplicateDetailText`, `resolveCardDescriptionTexts` のどこで直すべきかを先に決める。
4. `cards/card-interaction.js` は表示 model と adapter の責務だけに留める。surface 固有の長さ制御や placeholder 文言を入れる時も、shared resolver を迂回しない。
5. `ui/handlers/rules-help.js` は `カード図鑑` 側の adapter としてそろえる。`簡易説明` と `詳細効果` の分離、重複除外、shared helper が無い test stub での fallback を確認する。
6. catalog `desc` を正本にするカードでは、先頭文 fallback が UI で不自然にならないか確認する。`生成専用。` などの曖昧な先頭文になるなら explicit map 追加を検討する。
7. 対象 test を追加・更新する。最低限 `test/ui.rules-help-panel.test.js` と `test/ui.card-detail-effect-tags.test.js` を見て、必要なら対象カードの surface test を追加する。
8. root 正本に変更が入った後で、mirror が必要なら `npm run worker:prepare` を実行する。

## Validation Bundle

- `test/ui.rules-help-panel.test.js`
- `test/ui.card-detail-effect-tags.test.js`
- 影響カード名 / `cardId` / helper 名での残り参照検索
- 必要時だけ `npm run worker:prepare`

## Completion Checklist

- shared resolver と surface adapter の責務が逆流していない
- `カード詳細` と `カード図鑑` の両方で説明文がそろっている
- `詳細` / `詳細効果` から重複文が除外され、重複しか残らない時は非表示になる
- placeholder fallback と explicit map のどちらを採ったか説明できる
- 実行した test / search / `worker:prepare` と `01-rulebook.md` 更新有無を報告した