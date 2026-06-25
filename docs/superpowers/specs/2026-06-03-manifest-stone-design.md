# 顕現石 Design

## Goal

特殊カードで出現する石を、既存の「特殊石」ではなく「顕現石」として扱う。プレイヤー表示、内部 marker kind、対象判定、不可侵、ネットワーク投影、UI 情報表示を分離し、今後の特殊カード追加時に同じ仕組みを使える状態にする。

## Confirmed Terminology

- プレイヤー表示名: `顕現石`
- 内部 marker kind: `manifestStone`
- 顕現石 type:
  - `THEORY_INCARNATION`
  - `BOARD_EXECUTOR`
  - `OBSERVER_WILL`
- 特殊カード cardId:
  - `theory_incarnation_01`
  - `board_executor_01`
  - `observer_will_01`
- 既存の「特殊石」は、通常カード効果で作られる従来の盤面能力石を指す。

## Current Problem

現在の準備実装では、3つの特殊カード用 marker metadata が `shared/special-stone-registry.ts` に混在し、`OBSERVER_WILL` も `kind: 'specialStone'` として生成される。そのため、見た目や不可侵は動かせても、誘惑、捕獲、意志の喪失、延命、腐食、CPU の特殊石評価、ヘルプ表示などが「特殊石」として解釈する余地が残る。

このままだと、ユーザー方針である「特殊カードは不可侵」「特殊カード由来の石は特殊石ではない」を実装で保証しづらい。

## Decision

顕現石は `manifestStone` という別 marker kind にする。新規生成は必ず `manifestStone` で書き込み、既存セーブやネットワーク途中状態のために、旧 `kind: 'specialStone'` かつ type が顕現石 type の marker は読み取り時だけ顕現石として扱う。

既存の `specialStone` は維持する。通常特殊石の target helper は顕現石を含めない。表示、不可侵、行動ロック、観測者の手札公開、持続切れ、リボ払いなど、顕現石固有に必要な処理だけが顕現石 helper を読む。

## Architecture

新しく `shared/manifest-stone-registry.ts` を作る。ここを顕現石 metadata の単一ソースにし、カード ID、marker type、表示名、持続ターン、不可侵、visual effect key、画像パス、legacy 判定をまとめる。

`shared/special-stone-registry.ts` からは顕現石 metadata を段階的に外す。`getSpecialCardMarkerMetadata` は `ManifestStoneRegistry` へ委譲し、不可侵判定は `isInviolableStoneEffect` / `isInviolableManifestStoneType` で扱う。ただし `classifySpecialStoneRuleClass('OBSERVER_WILL')` は `true_special_stone` ではなく、顕現石判定側で扱う。

`game/logic/markers_adapter.ts` と `game/logic/cards/markers.ts` に `MARKER_KINDS.MANIFEST_STONE = 'manifestStone'` を追加する。`isManifestStoneMarker(marker)` は次の両方を true にする。

```ts
marker.kind === 'manifestStone'
marker.kind === 'specialStone' && isManifestStoneType(marker.data?.type)
```

一方で `isSpecialStoneMarker(marker)` は、顕現石 type を除外する。これにより、通常特殊石対象効果へ顕現石が混ざらない。

## Data Contract

新規 marker:

```ts
{
  id: number,
  row: number,
  col: number,
  kind: 'manifestStone',
  owner: 'black' | 'white',
  createdSeq: number,
  data: {
    type: 'OBSERVER_WILL',
    remainingOwnerTurns: 5,
    inviolable: true,
    sourceType: 'OBSERVER_WILL',
    visualEffectKey: 'observerWillStone'
  }
}
```

旧互換 marker:

```ts
{
  kind: 'specialStone',
  data: { type: 'OBSERVER_WILL' }
}
```

旧互換 marker は読み取り時に顕現石として扱う。新規保存、Worker snapshot、headless result は `manifestStone` を出す。

## Behavior Boundaries

- 顕現石は通常反転、破壊、移動、位置入替、テレポート、穴化、状態付与、誘惑、捕獲、意志の喪失、延命、腐食、悪食、再構築、破棄、天の恵み、カード奪取の対象外にする。
- 顕現石は不可侵判定に通す。
- `THEORY_INCARNATION` は owner のカード使用と石配置をロックする。
- `BOARD_EXECUTOR` は両者のカード使用をロックする。
- `OBSERVER_WILL` は配置中、owner だけが相手手札を常時見られる。
- `OBSERVER_WILL` の持続切れ、リボ払い、生きる意志による復活は、marker kind が `manifestStone` でも同じ動作にする。
- 顕現石は「特殊石」target helper に含めないが、石移動、位置交換、盤面縮小など「通常石・特殊石・爆弾を問わず石を対象にする」効果は、不可侵 helper で拒否する。

## UI Contract

- 石情報タグは `顕現石` と表示し、`特殊石` は表示しない。
- `OBSERVER_WILL` などの顕現石は `不可侵` と `残りNT` を表示する。
- カード詳細本文も「観測石」から「顕現石」またはカード固有名「観測顕現石」に寄せる。
- ルールヘルプには「顕現石: 特殊カードから出現する不可侵の石。特殊石対象効果には含まれない。」を追加する。

## Migration Strategy

実装は dual-read / single-write にする。

1. `ManifestStoneRegistry` と `MARKER_KINDS.MANIFEST_STONE` を追加する。
2. 新規 `OBSERVER_WILL` 生成を `manifestStone` に変える。
3. 読み取り helper は `manifestStone` と legacy `specialStone + 顕現石 type` の両方を読む。
4. 通常特殊石 helper は legacy 顕現石を除外する。
5. UI、Worker、CPU、テストを新 helper に接続する。
6. `worker:prepare` で mirror を同期する。

この順序なら、既存の観測者バグ修正や特殊カード不可侵実装を壊さずに呼び名と分類を移行できる。

## Refactoring Scope

実装とセットで行うべきリファクタリングは次の範囲に限定する。

- `SPECIAL_CARD_MARKER_METADATA` を `shared/manifest-stone-registry.ts` へ移す。
- 不可侵判定の責務を「顕現石の不可侵」と「通常特殊石の効果特性」に分ける。
- `getSpecialMarkers` と `getManifestMarkers` を分離する。
- target resolver 側では「特殊石本体」と「顕現石」を混ぜない。
- 表示用 helper は `specialStone` という名前を残してもよいが、顕現石表示に必要な wrapper を追加する。

全面的なファイル分割や命名総入れ替えはこの変更の外に置く。`specialStone` は従来概念として残すため、全置換はしない。

## Alternatives Considered

### A. `specialStone` のまま表示だけ `顕現石` にする

実装量は少ないが、対象効果や CPU 評価に混入し続ける。不可侵方針を helper 側で毎回例外処理する必要があり、将来カード追加時に漏れやすい。

### B. `manifestStone` を追加し、旧データだけ互換読みする

推奨。分類と表示が明確になり、通常特殊石対象効果から切り離せる。既存 snapshot 互換も維持できる。

### C. `specialStone` を完全廃止して全 marker taxonomy を再設計する

理想形に近いが、爆弾、石状態、盤面マーカー、特殊石本体、配置時効果まで広範囲に触れる。今回の目的に対してリスクが大きい。

## Acceptance Criteria

- `OBSERVER_WILL` の次置き marker は `kind: 'manifestStone'` で作られる。
- legacy `kind: 'specialStone'` + `type: 'OBSERVER_WILL'` でも観測、不可侵、持続切れ、リボ払いが動く。
- 誘惑、捕獲、意志の喪失、延命、腐食の通常特殊石対象に顕現石が含まれない。
- 石情報 UI は `顕現石` を表示し、同じ marker に `特殊石` は表示しない。
- `OBSERVER_WILL` 配置中の手札公開、不可侵タグ、リボ払い UI は回帰しない。
- `worker-public/` は `npm run worker:prepare` で同期される。

## Self Review

- Completeness scan: no incomplete sections remain.
- Consistency: player term is `顕現石`; internal kind is `manifestStone`; marker type remains existing uppercase type.
- Scope: this is one cohesive refactor around special-card-created stones, not a full marker taxonomy rewrite.
- Ambiguity resolved: 顕現石 is not a subtype of 特殊石 for target rules, but shared visual/status code may render both through common presentation helpers.
