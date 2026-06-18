# Special Stone Registry Unification Design

## 目的

特殊石の定義を `shared/special-stone-registry.ts` に集約し、カード type、盤面 marker type、効果ごとの対象判定を辞書ベースで派生させる。

現在は `SpecialStoneRegistry` に分類の中心がある一方で、`cards/card-interaction-effects.ts` の `specialStoneTag()`、`game/logic/cards/targets.ts` の誘惑・捕獲対象、`game/logic/cards/will_hunter_king.ts` の見た目優先判定、`game/logic/cards/utils.ts` / `markers.ts` の helper がそれぞれ似た判定を持っている。これを「特殊石とは何か」を見る場所と「用途ごとの対象範囲」を見る場所に整理する。

## 正本にする特殊石カード一覧

次のカード一覧を、カードから特殊石 marker が生まれる正本として扱う。

| カード | cardId | cardType | 盤面 marker type |
| --- | --- | --- | --- |
| 弱い意志 | `hard_01` | `PROTECTED_NEXT_STONE` | `PROTECTED` |
| 強い意志 | `perma_01` | `PERMA_PROTECT_NEXT_STONE` | `PERMA_PROTECTED`、昇格後 `ABSOLUTE_PROTECTED` |
| 狙撃の意志 | `sniper_01` | `SNIPER_WILL` | `SNIPER` |
| 幽霊の意志 | `ghost_01` | `GHOST_WILL` | `GHOST` |
| 避ける意志 | `afterimage_will_01` | `AFTERIMAGE_WILL` | `AFTERIMAGE_WILL` |
| 罠の意志 | `trap_01` | `TRAP_WILL` | `TRAP` |
| 時限爆弾 | `bomb_01` | `TIME_BOMB` | `TIME_BOMB` |
| 時間停石 | `time_stop_god_01` | `TIME_STOP_GOD` | `TIME_STOP` |
| 復活の意志 | `regen_01` | `REGEN_WILL` | `REGEN` |
| 究極反転龍 | `udr_01` | `ULTIMATE_REVERSE_DRAGON` | `DRAGON` |
| 繁殖の意志 | `breeding_01` | `BREEDING_WILL` | `BREEDING` |
| 増殖の意志 | `proliferation_01` | `PROLIFERATION_WILL` | `PROLIFERATION` |
| 多動の意志 | `hyperactive_01` | `HYPERACTIVE_WILL` | `HYPERACTIVE` |
| 極悪多動魔 | `extreme_hyperactive_01` | `EXTREME_HYPERACTIVE_WILL` | `EXTREME_HYPERACTIVE` |
| 逃げる意志 | `escape_01` | `ESCAPE_WILL` | `ESCAPE_HYPERACTIVE` |
| ロボット掃除機 | `robot_vacuum_01` | `ROBOT_VACUUM_WILL` | `ROBOT_VACUUM` |
| 悪食の意志 | `gluttonous_will_01` | `GLUTTONOUS_WILL` | `GLUTTONOUS` |
| 意志狩りの王 | `will_hunter_king_01` | `WILL_HUNTER_KING` | `WILL_HUNTER_KING` |
| 出稼ぎの意志 | `work_01` | `WORK_WILL` | `WORK` |
| 救済神 | `stone_salvation_god_01` | `STONE_SALVATION_GOD` | `STONE_SALVATION_GOD` |
| 破壊龍 | `destroy_dragon_01` | `DESTROY_DRAGON_WILL` | `DESTROY_DRAGON` |
| 落雷 | `lightning_01` | `LIGHTNING_WILL` | `LIGHTNING` |
| 究極破壊神 | `udg_01` | `ULTIMATE_DESTROY_GOD` | `ULTIMATE_DESTROY_GOD` |
| 究極多動神 | `ultimate_hyperactive_01` | `ULTIMATE_HYPERACTIVE_GOD` | `ULTIMATE_HYPERACTIVE` |
| 因果抹消神 | `meteor_god_01` | `METEOR_GOD` | `METEOR_GOD` |

`ABSOLUTE_PROTECTED` は独立カードではなく `PERMA_PROTECT_NEXT_STONE` 由来の昇格 marker type として扱う。

## 用語

- `special_stone_body`: 盤面の石そのものが特殊石になっている状態。弱い石、強い石、幽体、残像、復活、龍、多動、救済神など。
- `special_stone_effect`: 広義の特殊石扱い。`special_stone_body` に加え、罠と時限爆弾を含む。
- `stone_status`: 既存の石に重なる継続状態。`GUARD` と `LIVING_WILL`。
- `manifest_stone`: 顕現石。`THEORY_INCARNATION`、`BOARD_EXECUTOR`、`OBSERVER_WILL`。
- `board_marker`: 盤面マーカー。`BLOCKADE`、`METEOR_HOLE`、`FREEZE`、`SEED`。
- `placement_effect`: 配置解決中に完結する効果。`CROSS_BOMB`、`X_BOMB`、`GOLD`、`SILVER`、`RAINBOW`、`HYPERACTIVE` with `instantPlacementOnly`。

`special_stone_body` と `special_stone_effect` を分ける。誘惑や意志狩りの王のような効果は広義、捕獲や持続延長のような効果は用途別の制約を持つ。

## 辞書設計

`shared/special-stone-registry.ts` に次の2種類の辞書を追加する。

### Card Definition

カード type から marker type への正本。

```ts
type SpecialStoneCardDefinition = {
  cardId: string;
  cardNameJa: string;
  cardType: string;
  markerType: string;
  promotedMarkerType?: string;
};
```

### Stone Effect Rule

marker type から効果対象判定へ派生する正本。

```ts
type StoneEffectRule = {
  markerType: string;
  category:
    | 'special_stone_body'
    | 'trap'
    | 'bomb'
    | 'stone_status'
    | 'manifest_stone'
    | 'board_marker'
    | 'placement_effect';
  countsAsSpecialStone: boolean;
  temptTargetable: boolean;
  captureTargetable: boolean;
  lossWillRevertible: boolean;
  willHunterPriority: boolean;
  durationAffectable: boolean;
  theorySpawnCandidate: boolean;
  normalVisual: boolean;
  blocksTempt: boolean;
};
```

既存の `classifySpecialStoneRuleClass()` は互換 API として残し、内部では `StoneEffectRule.category` から返す。

## 効果ごとの対象範囲

### 誘惑の意志

今回の仕様変更対象。辞書の `temptTargetable` を使う。

対象に含める:

- `special_stone_body`
- `TRAP`
- `TIME_BOMB`
- `LIVING_WILL`

対象外:

- `GUARD`
- `ABSOLUTE_PROTECTED`
- 顕現石
- 盤面マーカー
- 配置時効果

`GUARD` は `stone_status` だが完全保護なので `blocksTempt: true` とし、誘惑対象にしない。`LIVING_WILL` は `stone_status` だが誘惑対象に含める。

### 捕獲の意志

今回の初回実装では挙動を変えない。`captureTargetable` を新設して、現行の捕獲可能な特殊石本体だけを true にする。罠、時限爆弾、`LIVING_WILL` を捕獲対象に広げるかは別の仕様判断に分ける。

`01-rulebook.md` の `CAPTURE_WILL` 文言は、対象を「`TEMPT_WILL` と同じ」と書かない形へ直す。誘惑だけ対象を広げるため、捕獲は `captureTargetable` に基づく別の用途別判定として固定する。

### 意志の喪失

既存挙動を維持する。`lossWillRevertible` は `special_stone_body`、`TRAP`、`TIME_BOMB` を true にし、`ABSOLUTE_PROTECTED`、`GUARD`、`LIVING_WILL`、顕現石、盤面マーカー、配置時効果は false にする。

### 意志狩りの王

画像や CSS ではなく `willHunterPriority` と `normalVisual` で判定する。特殊見た目の特殊石、爆弾、顕在化している対象を優先し、通常石として隠れている `TRAP` は優先対象にしない。

### 理論の化身

`theorySpawnCandidate` を使う。特殊石カード由来の marker type を候補にし、`TRAP` と `TIME_BOMB` は既存仕様どおり除外する。

## 変更対象

- `01-rulebook.md`: 誘惑の意志、捕獲の意志、特殊石分類の記述を更新する。
- `正本/カード仕様正本.md`: 誘惑の意志、捕獲の意志の行と分類記述を更新する。
- `shared/special-stone-registry.ts`: 正本辞書と用途別 predicate を追加する。
- `game/logic/cards/utils.ts`: 既存 helper を registry 由来へ寄せる。
- `game/logic/cards/markers.ts`: 既存 helper を registry 由来へ寄せる。
- `game/logic/cards/targets.ts`: 誘惑対象を `isTemptTargetableStoneEffect()` へ寄せる。
- `game/logic/card-resolution/ownership.ts`: `applyTemptWill()` の再検証を同じ predicate へ寄せる。
- `game/logic/cards/will_hunter_king.ts`: 意志狩り優先判定を registry 由来へ寄せる。
- `game/logic/card-resolution/special-stone-marker-factory.ts`: cardType から marker type への対応を辞書から読む。
- `cards/card-interaction-effects.ts`: `specialStoneTag()` の対象を registry ベースで検証できるようにテストで固定する。初回実装では runtime 生成化しない。

## テスト方針

先に registry と対象選択の focused tests を更新する。

- `test/shared.special-stone-registry.test.ts`
  - 25カードの cardType -> markerType 対応を固定する。
  - `temptTargetable`、`captureTargetable`、`lossWillRevertible`、`willHunterPriority` の代表値を固定する。
- `test/game.special-stone-visual-rule.test.ts`
  - `TEMPT_WILL` が `TRAP`、`TIME_BOMB`、`LIVING_WILL` を対象に含めることを確認する。
  - `TEMPT_WILL` が `GUARD`、`ABSOLUTE_PROTECTED`、顕現石、盤面マーカー、配置時効果を対象外にすることを確認する。
- `test/game.capture-will.test.ts`
  - `CAPTURE_WILL` が罠、時限爆弾、`LIVING_WILL` を捕獲対象にしないことを確認する。
- `test/game.will-hunter-king.test.ts`
  - 既存の特殊石優先挙動が辞書化後も変わらないことを確認する。
- `test/game.loss-will.test.ts`
  - 意志の喪失の対象範囲が変わらないことを確認する。

## 実行順

1. 仕様正本を更新し、`TEMPT_WILL` と `CAPTURE_WILL` の対象文言を分離する。
2. registry の characterization tests を追加する。
3. registry に辞書と用途別 predicate を追加する。
4. `utils.ts` / `markers.ts` を registry 由来へ寄せる。
5. 誘惑対象の selector と適用時再検証を差し替える。
6. 意志狩りの王と marker factory の局所判定を差し替える。
7. focused tests、`npm run typecheck`、必要に応じて `npm run worker:prepare` を実行する。

## リスク

- 誘惑対象を広げるため、これは純粋な挙動保存リファクタではない。仕様更新とテスト更新を先に行う。
- `cards/card-interaction-effects.ts` と generated catalog 周辺には既存の未コミット変更がある。実装時は既存変更の所有者を確認し、今回の差分と混ぜない。
- `worker-public/` と `public/module-registry.js` は生成・mirror 面なので、source を更新した後に既存スクリプトで同期する。
- `captureTargetable` は初回実装で誘惑と同じにしない。捕獲対象を広げる場合は、捕獲後に手札へ戻すカード ID の仕様が必要になる。

## 完了判定

- 特殊石カード 25件の cardType -> markerType 対応が registry test で固定されている。
- 誘惑の意志が `TRAP`、`TIME_BOMB`、`LIVING_WILL` を対象にでき、`GUARD` と `ABSOLUTE_PROTECTED` は対象外になっている。
- 意志狩りの王の特殊石優先が画像パスや CSS ではなく registry predicate で決まっている。
- 意志の喪失、理論の化身、捕獲の意志の既存対象範囲が意図せず変わっていない。
- `shared/special-stone-registry.ts` が特殊石定義の正本になり、ローカル hard-coded 分類が減っている。
