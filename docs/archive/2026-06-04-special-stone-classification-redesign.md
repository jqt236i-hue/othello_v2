# 特殊石分類再設計 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:**  
特殊石の内部分類をプレイヤー認識に寄せつつ、顕現石・状態付与・盤面マーカー・即時配置効果を混同しない単一の分類基盤へ整理する。理論の化身で使う「芽生える特殊石」候補も、この分類基盤から安全に抽出できるようにする。

**Architecture:**  
`shared/special-stone-registry.ts` を分類の正本にし、既存の `isTrueSpecialStone` / `isManifestStoneType` / 絶対保護 / 顕現石不可侵 / UIタグ / カード効果ターゲット判定が同じ分類情報を参照する形に寄せる。ゲームロジックは headless のまま、UI は分類結果だけを受け取って表示する。

**Tech Stack:**  
TypeScript / JavaScript, Jest, existing browser build, worker mirror via `npm run worker:prepare`.

**Execution Status:**  
2026-06-04 実施済み。分類trait helper、意志の喪失の対象判定、UI/カード説明、ルールブック、生成カタログ、worker mirrorを更新した。理論の化身本体は未実装のまま、芽生え候補helperだけ追加した。

---

## Player-Facing Classification

### 特殊石に含める

プレイヤー向けの「特殊石」は、基本的に「次に置く石を特定性質の石にする」または「通常石ではない状態で盤面に残る石」を指す。ただし顕現石は別格なので特殊石には含めない。

- `PROTECTED`
- `PERMA_PROTECTED`
- `ABSOLUTE_PROTECTED`
- `REGEN`
- `GHOST`
- `AFTERIMAGE_WILL`
- `HYPERACTIVE`
- `EXTREME_HYPERACTIVE`
- `ESCAPE_HYPERACTIVE`
- `ULTIMATE_HYPERACTIVE`
- `WORK`
- `BREEDING`
- `PROLIFERATION`
- `SNIPER`
- `LIGHTNING`
- `DESTROY_DRAGON`
- `DRAGON`
- `ULTIMATE_DESTROY_GOD`
- `ROBOT_VACUUM`
- `GLUTTONOUS`
- `STONE_SALVATION_GOD`
- `TIME_STOP`
- `WILL_HUNTER_KING`
- `TRAP`
- `TIME_BOMB`

### 特殊石に含めない

- 顕現石: `THEORY_INCARNATION`, `BOARD_EXECUTOR`, `OBSERVER_WILL`
- 状態付与: `LIVING_WILL`, `GUARD`
- 盤面マーカー: `FREEZE`, `BLOCKADE`, `SEED`, `METEOR_HOLE`
- 即時/配置効果: `GOLD`, `SILVER`, `RAINBOW`, `CROSS_BOMB`, `X_BOMB`
- 削除予定: `INHERITED_HYPERACTIVE`

### 例外方針

- `TRAP` はプレイヤー分類では特殊石だが、理論の化身の芽生え候補からは除外する。
- `TIME_BOMB` は内部では爆弾系として扱いやすいが、プレイヤー分類では特殊石に含める。ただし理論の化身の芽生え候補からは除外する。
- `LIVING_WILL` は生きる意志による状態付与なので、特殊石ではなく「石ステータス」として扱う。
- `ABSOLUTE_PROTECTED` は特殊石に含めるが、絶対保護なので意志の喪失では通常石に戻らない。
- 顕現石は特殊石より上位の不可侵カテゴリとして扱い、カード効果・状態付与・破壊・奪取・通常化の対象にしない。

---

## Target Design

### 1. 分類レジストリを単一化する

- [ ] `shared/special-stone-registry.ts` に分類メタデータを追加する。

推奨フィールド:

```ts
type StoneEffectCategory =
  | 'special_stone'
  | 'manifest_stone'
  | 'stone_status'
  | 'board_marker'
  | 'placement_effect'
  | 'trap'
  | 'bomb';

type StoneEffectTraits = {
  category: StoneEffectCategory;
  countsAsSpecialStone: boolean;
  targetableAsSpecialStone: boolean;
  revertibleByLossWill: boolean;
  spawnableByTheoryIncarnation: boolean;
  inviolable: boolean;
};
```

重要な意味:

- `countsAsSpecialStone`: UIや説明上「特殊石」と見なす。
- `targetableAsSpecialStone`: 悪食・意志の喪失など「特殊石を対象にする」カードの候補に入る。
- `revertibleByLossWill`: 意志の喪失で通常石へ戻せる候補に入る。基本は特殊石なら true だが、`ABSOLUTE_PROTECTED` は false。
- `spawnableByTheoryIncarnation`: 理論の化身で数字マスから芽生えてよい候補。
- `inviolable`: 顕現石など、カード効果・状態付与を共通で拒否する。

### 2. 既存helperを新レジストリへ寄せる

- [ ] `isTrueSpecialStone(type)` は `countsAsSpecialStone === true` を返すようにする。
- [ ] `isManifestStoneType(type)` は `category === 'manifest_stone'` または `inviolable === true` を返す形に寄せる。
- [ ] `isSpecialStoneType(type)` のような曖昧なhelperが複数ある場合、意味別に次へ整理する。
  - `countsAsSpecialStone(type)`
  - `isTargetableSpecialStone(type)`
  - `isManifestStoneType(type)`
  - `isStoneStatusType(type)`
  - `isBoardMarkerType(type)`
  - `isTheoryIncarnationSpawnCandidate(type)`

### 3. カード効果の対象判定を分類名で読む形に変える

- [ ] 意志の喪失は `isTargetableSpecialStone` / `revertibleByLossWill` を使い、`ABSOLUTE_PROTECTED` には効かないようにする。
- [ ] 悪食など特殊石を参照する効果は `isTargetableSpecialStone` を使う。
- [ ] 再構築・奪取・破壊・状態付与は、既存の顕現石不可侵guardを最初に通す。
- [ ] `TRAP` / `TIME_BOMB` を特殊石対象に含めるかどうかがカードごとに異なる場合は、カード側に例外条件を置く。分類レジストリ側を抽象化しすぎない。

### 4. UI表示を分類レジストリへ寄せる

- [ ] 長押し/詳細表示の「特殊石」タグは `countsAsSpecialStone` を使う。
- [ ] 顕現石は「顕現石」タグを使い、特殊石タグと併記しない。
- [ ] `LIVING_WILL` / `GUARD` は「状態」または既存の状態表示へ寄せ、特殊石タグを出さない。
- [ ] `TIME_BOMB` / `TRAP` は必要に応じて個別タグを維持しつつ、特殊石として扱う表示にする。

### 5. 理論の化身用の候補抽出を先に用意する

- [ ] 理論の化身本体はまだ実装しない場合でも、`getTheoryIncarnationSpawnCandidates()` のような純粋関数を追加する。
- [ ] 候補は `spawnableByTheoryIncarnation === true` のみ。
- [ ] `TRAP` と `TIME_BOMB` は明示的に `false`。
- [ ] 顕現石、盤面マーカー、状態付与、即時配置効果はすべて `false`。
- [ ] 候補のコスト参照はカードcatalogや既存コスト定義と重複させず、既存のカード定義から引けるようにする。

---

## Implementation Tasks

### Phase 0: 現状調査

- [ ] `git status --short` で既存dirty treeを分類する。
- [ ] `rg -n "isTrueSpecialStone|isSpecialStone|SPECIAL_STONE|Manifest|THEORY_INCARNATION|OBSERVER_WILL|BOARD_EXECUTOR|TIME_BOMB|TRAP|LIVING_WILL|GUARD"` を実行し、分類判定の散在箇所を洗い出す。
- [ ] `shared/special-stone-registry.ts` の既存API利用箇所を一覧化する。

### Phase 1: Characterization Tests

- [ ] `test/shared.special-stone-registry.test.ts` に分類テストを追加する。
- [ ] 特殊石に含める一覧が `countsAsSpecialStone === true` になることを確認する。
- [ ] 顕現石3種が `inviolable === true` かつ `countsAsSpecialStone === false` になることを確認する。
- [ ] `LIVING_WILL` / `GUARD` が特殊石ではなく状態付与に分類されることを確認する。
- [ ] `TRAP` / `TIME_BOMB` が特殊石だが、理論の化身の芽生え候補ではないことを確認する。
- [ ] `ABSOLUTE_PROTECTED` が特殊石だが、意志の喪失では通常石に戻らないことを確認する。
- [ ] `INHERITED_HYPERACTIVE` が削除済みであることを前提にする。まだ残っている場合は、この計画の実装前に削除作業の完了を待つ。

### Phase 2: Registry Refactor

- [ ] `shared/special-stone-registry.ts` に `StoneEffectTraits` の正本mapを追加する。
- [ ] 既存exportsとの互換を保ったまま、新helperを追加する。
- [ ] 既存helperを新helperの薄いラッパーに変える。
- [ ] 既存の絶対保護/顕現石不可侵判定が弱くならないことを確認する。

### Phase 3: Game Logic Migration

- [ ] カード効果の特殊石対象判定を `isTargetableSpecialStone` へ寄せる。
- [ ] 意志の喪失の通常石化判定を `revertibleByLossWill` に寄せ、`ABSOLUTE_PROTECTED` を除外する。
- [ ] 悪食・再構築・奪取・破壊系が顕現石を対象にしないことをテストで固定する。
- [ ] `TIME_BOMB` は特殊石として対象候補に入り得るが、必要なカードでは爆弾例外として個別判定する。

### Phase 4: UI Migration

- [ ] 石詳細/カード詳細/タグ表示が新分類helperを使うようにする。
- [ ] 顕現石は「顕現石」として表示され、特殊石扱いのUIに混ざらないことを確認する。
- [ ] `GHOST` / `AFTERIMAGE_WILL` / `REGEN` が特殊石表示になることを確認する。
- [ ] `LIVING_WILL` は状態付与表示のまま、特殊石表示にならないことを確認する。

### Phase 5: Theory Incarnation Preparation

- [ ] `getTheoryIncarnationSpawnCandidates()` を追加する。
- [ ] 候補に `GHOST` / `AFTERIMAGE_WILL` / `REGEN` が含まれることを確認する。
- [ ] 候補から `TRAP` / `TIME_BOMB` / 顕現石 / 状態付与 / 盤面マーカー / 即時配置効果が除外されることを確認する。
- [ ] 理論の化身本体はこの計画では実装しない。候補抽出の土台だけ作る。

### Phase 6: Docs

- [ ] `01-rulebook.md` の特殊石/顕現石/状態付与の説明を更新する。
- [ ] 必要なら `正本/` の特殊カードまたは石分類メモを更新する。
- [ ] `docs/architecture-contracts.md` は、分類helperが共有境界として増える場合のみ更新する。

### Phase 7: Verification

- [ ] `npm run test:jest -- --runTestsByPath test/shared.special-stone-registry.test.ts --runInBand`
- [ ] 影響カードのfocused Jestを実行する。
- [ ] `npm run build:browser`
- [ ] 必要に応じて `npm run test:network:parity`
- [ ] root-to-worker mirror影響があれば `npm run worker:prepare`
- [ ] 最後に `git status --short` と関連diffを確認する。

---

## Risks

- `特殊石` という言葉が既存実装では「一部の特殊な石」程度に使われている可能性があるため、単純置換するとカード効果範囲が変わりすぎる。
- `TIME_BOMB` は特殊石扱いに寄せるが、爆弾固有処理も持つため、分類を1軸にまとめると壊れやすい。分類はtrait制にして、カード側の例外を残す。
- `TRAP` も特殊石扱いだが、理論の化身では除外する。これもtraitで明示する。
- 顕現石は特殊石から外す。既存の「特殊石除去」系が顕現石に効かないことを改めてテストで固定する。
- `INHERITED_HYPERACTIVE` の削除作業と競合しやすい。削除完了前にこの計画を実装する場合は、先に削除差分を取り込むか、実装を待つ。

---

## Success Criteria

- 特殊石一覧がプレイヤー認識と一致している。
- 顕現石は特殊石ではなく、不可侵カテゴリとして扱われる。
- `LIVING_WILL` は特殊石ではなく状態付与として扱われる。
- `GHOST` / `AFTERIMAGE_WILL` / `REGEN` は特殊石として扱われる。
- `TIME_BOMB` / `TRAP` は特殊石だが、理論の化身の芽生え候補から外れる。
- `ABSOLUTE_PROTECTED` は特殊石として扱われるが、意志の喪失では通常石に戻らない。
- 既存カード効果の対象範囲がテストで説明できる状態になる。
- 将来の理論の化身実装で、特殊石候補抽出を新たに手書きしなくて済む。
