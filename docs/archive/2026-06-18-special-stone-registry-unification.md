# Special Stone Registry Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move special-stone card and marker definitions into `shared/special-stone-registry.ts`, then drive temptation targeting and related helpers from that registry.

**Architecture:** `shared/special-stone-registry.ts` becomes the source of truth for cardType -> markerType mappings and marker effect traits. Existing game modules keep their public helper names, but delegate classification and target predicates to the registry. Behavior changes are limited to `TEMPT_WILL`, which will target traps, time bombs, and `LIVING_WILL` while still excluding `GUARD`, `ABSOLUTE_PROTECTED`, manifest stones, board markers, and placement effects.

**Tech Stack:** TypeScript, CommonJS-compatible browser modules, Jest tests, existing npm scripts.

---

## File Structure

- Modify: `01-rulebook.md`
  - Update special-stone classification, `TEMPT_WILL` text, and `CAPTURE_WILL` target wording before behavior changes.
- Modify: `正本/カード仕様正本.md`
  - Keep temptation and capture behavior notes aligned with `01-rulebook.md`.
- Modify: `shared/special-stone-registry.ts`
  - Add canonical card definitions, marker rules, and purpose-specific predicates.
- Modify: `game/logic/cards/utils.ts`
  - Delegate marker classification and temptation helper logic to the registry.
- Modify: `game/logic/cards/markers.ts`
  - Keep marker helper behavior aligned with `utils.ts` and the registry.
- Modify: `game/logic/cards/targets.ts`
  - Use the registry-backed temptation predicate for `getTemptWillTargets()`.
- Modify: `game/logic/card-resolution/ownership.ts`
  - Use the same predicate in `applyTemptWill()`.
- Modify: `game/logic/cards/will_hunter_king.ts`
  - Use registry-backed `willHunterPriority` instead of visual-image inference.
- Modify: `game/logic/card-resolution/special-stone-marker-factory.ts`
  - Use registry card definitions for cardType -> markerType mapping.
- Test: `test/shared.special-stone-registry.test.ts`
  - Lock down canonical mappings and traits.
- Test: `test/game.special-stone-visual-rule.test.ts`
  - Lock down `TEMPT_WILL` target behavior.
- Test: `test/game.will-hunter-king.test.ts`
  - Keep will-hunter priority behavior stable.
- Test: `test/game.capture-will.test.ts`
  - Keep capture-will behavior stable after temptation is expanded.
- Test: `test/game.loss-will.test.ts`
  - Keep loss-will behavior stable.

---

### Task 1: Update Player-Facing Specs

**Files:**
- Modify: `01-rulebook.md:264`
- Modify: `01-rulebook.md:474`
- Modify: `01-rulebook.md:485`
- Modify: `正本/カード仕様正本.md:35`
- Modify: `正本/カード仕様正本.md:36`

- [ ] **Step 1: Update `01-rulebook.md` special-stone classification**

Do not replace the whole `### 6.8 特殊石分類` section. That section currently also contains the `顕現石` rules and special-card presentation rules, and those must be preserved.

Replace only the opening `特殊石` classification bullet and adjust the existing `石状態` / `爆弾` / `隠し罠` / `盤面マーカー` / `配置時効果` bullets. The following is the logical classification content, not an instruction to move or delete the existing `顕現石` / presentation bullets that are currently interleaved in this section:

```markdown
- `特殊石本体` は、通常石ではなく、盤面に残って次ターン以降も能力主体として生きる石を指す。`弱い石（PROTECTED）`、`強い石（PERMA_PROTECTED）`、`絶対保護石（ABSOLUTE_PROTECTED）`、`幽体石（GHOST）`、`残像石（AFTERIMAGE_WILL）`、`復活石（REGEN）`、`狙撃石（SNIPER）`、`龍系`、`多動系`、`意志狩りの王（WILL_HUNTER_KING）`、`救済神（STONE_SALVATION_GOD）` などを含める。
- `特殊石扱い` は、特殊石本体に加えて、`罠石（TRAP）` と `時限爆弾（TIME_BOMB）` を含む効果対象用の分類とする。
- `石状態` は、石に重なる継続状態を指す。完全保護（GUARD）、生きる意志（LIVING_WILL）などが含まれる。幽体石・残像石・復活石は石状態ではなく特殊石本体として扱う。
- `誘惑可能な石効果` は、相手の特殊石本体、罠石、時限爆弾、生きる意志（LIVING_WILL）を指す。完全保護（GUARD）、絶対保護石（ABSOLUTE_PROTECTED）、顕現石、盤面マーカー、配置時効果は含めない。
- `爆弾` は `TIME_BOMB` のような爆発予約。内部処理では爆弾系として扱うが、特殊石扱いには含める。
- `隠し罠` は `TRAP_WILL` のような反応予約。内部処理では罠系として扱うが、特殊石扱いには含める。
- `盤面マーカー` は `BLOCKADE` / `METEOR_HOLE` / `FREEZE` / `SEED` のようなマス効果。
- `配置時効果` は、次に置く石に1回だけ効果を付けるものを指す。`瞬間多動` / `十字爆弾` / `クロス爆弾` / `金` / `銀` / `虹` が含まれる。
- `配置時効果` は配置解決中に完結し、特殊石の持続ターン管理、ターン開始ライフサイクル、誘惑、捕獲、延命、腐食、意志の喪失の対象に含めない。
- `意志の喪失（LOSS_WILL）` は、特殊石本体、罠石、時限爆弾を通常石へ戻す。`ABSOLUTE_PROTECTED` は特殊石本体だが絶対保護により通常石化しない。顕現石、石状態、盤面マーカー、配置時効果は対象外。
```

Keep the existing `顕現石` bullets and all special-card display / background / panel bullets in the section.

- [ ] **Step 2: Update `01-rulebook.md` `TEMPT_WILL` section**

Change the `TEMPT_WILL` bullets to:

```markdown
- 相手の誘惑可能な石効果を1つ選んで自分側へ変える。
- 誘惑可能な石効果には、相手の特殊石本体、罠石（TRAP）、時限爆弾（TIME_BOMB）、生きる意志（LIVING_WILL）を含める。
- `弱い石（PROTECTED）` と `強い石（PERMA_PROTECTED）` は特殊石本体として対象に含まれる。
- 付帯状態（残ターン等）は維持する。
- この色変更は反転枚数に加算しない。
- 完全保護（GUARD）中の石は対象外。
- `絶対保護石（ABSOLUTE_PROTECTED）` は特殊石本体だが、絶対保護で対象効果を受けない。
- 顕現石、盤面マーカー、配置時効果は対象外。
- 幽体（GHOST）にも通常どおり成立する。
```

- [ ] **Step 3: Update `01-rulebook.md` `CAPTURE_WILL` section**

Change the `CAPTURE_WILL` bullets so capture no longer says its target is "same as `TEMPT_WILL`":

```markdown
- 相手の捕獲可能な特殊石本体1つを捕獲し、盤面から除去して自分の手札に加える。
- 捕獲可能な特殊石本体には、`弱い石（PROTECTED）`、`強い石（PERMA_PROTECTED）`、`幽体石（GHOST）` などを含める。
- 罠石（TRAP）、時限爆弾（TIME_BOMB）、生きる意志（LIVING_WILL）は捕獲対象外。
- 完全保護中の石は対象外。
- `絶対保護石（ABSOLUTE_PROTECTED）` は特殊石本体だが、絶対保護で対象効果を受けない。
- 顕現石、盤面マーカー、配置時効果は対象外。
- 幽体（GHOST）にも通常どおり成立し、捕獲すると `ghost_01` として手札に加わる。
- 捕獲した特殊石は、元になったカードとして手札に戻る。
```

- [ ] **Step 4: Update `正本/カード仕様正本.md`**

Replace the `誘惑の意志` and `捕獲の意志` rows with:

```markdown
| 誘惑の意志 | 執行 | 34 | 通常 | 相手の誘惑可能な石効果1つを選び、自分側へ変える。誘惑可能な石効果には、特殊石本体、罠石、時限爆弾、生きる意志を含める。完全保護中の石、絶対保護石、顕現石、盤面マーカー、配置時効果は対象外。弱い石・強い石・幽体石は対象に含まれる。残りターンなどの付帯状態は維持する。この色変更は反転枚数に数えない。 |
| 捕獲の意志 | 執行 | 20 | 通常 | 相手の捕獲可能な特殊石本体1つを盤面から取り除き、元カードとして自分の手札に加える。弱い石・強い石・幽体石は対象に含まれる。罠石、時限爆弾、生きる意志、完全保護中の石、絶対保護石、顕現石、盤面マーカー、配置時効果は対象外。幽体石にも通常どおり成立し、捕獲すると幽霊の意志として手札に加わる。 |
```

- [ ] **Step 5: Review spec diff**

Run:

```powershell
git diff -- 01-rulebook.md 正本/カード仕様正本.md
```

Expected: only special-stone classification, `TEMPT_WILL`, and `CAPTURE_WILL` wording changed. `CAPTURE_WILL` behavior stays the same; only the wording is decoupled from `TEMPT_WILL`.

- [ ] **Step 6: Commit spec update**

Run:

```powershell
git add -- 01-rulebook.md 正本/カード仕様正本.md
git commit -m "docs: define shared special stone targets"
```

Expected: commit succeeds and unrelated dirty files remain unstaged.

---

### Task 2: Add Registry Characterization Tests

**Files:**
- Modify: `test/shared.special-stone-registry.test.ts`

- [ ] **Step 1: Add canonical card mapping tests**

Append this test inside the existing `describe('special stone registry rule classification', () => { ... })` block:

```ts
  test('exposes canonical special-stone card mappings', () => {
    const expected = [
      ['hard_01', 'PROTECTED_NEXT_STONE', 'PROTECTED'],
      ['perma_01', 'PERMA_PROTECT_NEXT_STONE', 'PERMA_PROTECTED'],
      ['sniper_01', 'SNIPER_WILL', 'SNIPER'],
      ['ghost_01', 'GHOST_WILL', 'GHOST'],
      ['afterimage_will_01', 'AFTERIMAGE_WILL', 'AFTERIMAGE_WILL'],
      ['trap_01', 'TRAP_WILL', 'TRAP'],
      ['bomb_01', 'TIME_BOMB', 'TIME_BOMB'],
      ['time_stop_god_01', 'TIME_STOP_GOD', 'TIME_STOP'],
      ['regen_01', 'REGEN_WILL', 'REGEN'],
      ['udr_01', 'ULTIMATE_REVERSE_DRAGON', 'DRAGON'],
      ['breeding_01', 'BREEDING_WILL', 'BREEDING'],
      ['proliferation_01', 'PROLIFERATION_WILL', 'PROLIFERATION'],
      ['hyperactive_01', 'HYPERACTIVE_WILL', 'HYPERACTIVE'],
      ['extreme_hyperactive_01', 'EXTREME_HYPERACTIVE_WILL', 'EXTREME_HYPERACTIVE'],
      ['escape_01', 'ESCAPE_WILL', 'ESCAPE_HYPERACTIVE'],
      ['robot_vacuum_01', 'ROBOT_VACUUM_WILL', 'ROBOT_VACUUM'],
      ['gluttonous_will_01', 'GLUTTONOUS_WILL', 'GLUTTONOUS'],
      ['will_hunter_king_01', 'WILL_HUNTER_KING', 'WILL_HUNTER_KING'],
      ['work_01', 'WORK_WILL', 'WORK'],
      ['stone_salvation_god_01', 'STONE_SALVATION_GOD', 'STONE_SALVATION_GOD'],
      ['destroy_dragon_01', 'DESTROY_DRAGON_WILL', 'DESTROY_DRAGON'],
      ['lightning_01', 'LIGHTNING_WILL', 'LIGHTNING'],
      ['udg_01', 'ULTIMATE_DESTROY_GOD', 'ULTIMATE_DESTROY_GOD'],
      ['ultimate_hyperactive_01', 'ULTIMATE_HYPERACTIVE_GOD', 'ULTIMATE_HYPERACTIVE'],
      ['meteor_god_01', 'METEOR_GOD', 'METEOR_GOD']
    ];

    for (const [cardId, cardType, markerType] of expected) {
      expect(SpecialStoneRegistry.getSpecialStoneCardDefinition(cardType)).toEqual(
        expect.objectContaining({ cardId, cardType, markerType })
      );
      expect(SpecialStoneRegistry.getMarkerTypeForSpecialStoneCard(cardType)).toBe(markerType);
    }

    expect(SpecialStoneRegistry.getSpecialStoneCardDefinition('PERMA_PROTECT_NEXT_STONE')).toEqual(
      expect.objectContaining({ promotedMarkerType: 'ABSOLUTE_PROTECTED' })
    );
  });
```

- [ ] **Step 2: Add purpose-specific predicate tests**

Append this test in the same `describe` block:

```ts
  test('exposes purpose-specific special-stone targeting traits', () => {
    for (const type of ['PROTECTED', 'PERMA_PROTECTED', 'GHOST', 'AFTERIMAGE_WILL', 'REGEN', 'WILL_HUNTER_KING']) {
      expect(SpecialStoneRegistry.isTemptTargetableStoneEffect(type)).toBe(true);
      expect(SpecialStoneRegistry.isCaptureTargetableStoneEffect(type)).toBe(true);
      expect(SpecialStoneRegistry.canLossWillRevert(type)).toBe(true);
    }

    expect(SpecialStoneRegistry.isTemptTargetableStoneEffect('TRAP')).toBe(true);
    expect(SpecialStoneRegistry.isTemptTargetableStoneEffect('TIME_BOMB')).toBe(true);
    expect(SpecialStoneRegistry.isTemptTargetableStoneEffect('LIVING_WILL')).toBe(true);
    expect(SpecialStoneRegistry.canLossWillRevert('TRAP')).toBe(true);
    expect(SpecialStoneRegistry.canLossWillRevert('TIME_BOMB')).toBe(true);

    expect(SpecialStoneRegistry.isCaptureTargetableStoneEffect('TRAP')).toBe(false);
    expect(SpecialStoneRegistry.isCaptureTargetableStoneEffect('TIME_BOMB')).toBe(false);
    expect(SpecialStoneRegistry.isCaptureTargetableStoneEffect('LIVING_WILL')).toBe(false);
    expect(SpecialStoneRegistry.canLossWillRevert('LIVING_WILL')).toBe(false);

    expect(SpecialStoneRegistry.isTemptTargetableStoneEffect('GUARD')).toBe(false);
    expect(SpecialStoneRegistry.blocksTempt('GUARD')).toBe(true);
    expect(SpecialStoneRegistry.canLossWillRevert('GUARD')).toBe(false);
    expect(SpecialStoneRegistry.isTemptTargetableStoneEffect('ABSOLUTE_PROTECTED')).toBe(false);
    expect(SpecialStoneRegistry.blocksTempt('ABSOLUTE_PROTECTED')).toBe(true);
    expect(SpecialStoneRegistry.canLossWillRevert('ABSOLUTE_PROTECTED')).toBe(false);

    for (const type of ['THEORY_INCARNATION', 'BOARD_EXECUTOR', 'OBSERVER_WILL', 'BLOCKADE', 'FREEZE', 'SEED', 'GOLD', 'SILVER', 'RAINBOW']) {
      expect(SpecialStoneRegistry.isTemptTargetableStoneEffect(type)).toBe(false);
    }
  });
```

- [ ] **Step 3: Run registry test and confirm it fails**

Run:

```powershell
npx jest test/shared.special-stone-registry.test.ts --runInBand
```

Expected: FAIL because `getSpecialStoneCardDefinition`, `getMarkerTypeForSpecialStoneCard`, `isTemptTargetableStoneEffect`, `isCaptureTargetableStoneEffect`, and `blocksTempt` are not exported yet.

- [ ] **Step 4: Commit failing characterization tests only if using checkpoint commits for red tests**

If the active implementation workflow allows red-test commits, run:

```powershell
git add -- test/shared.special-stone-registry.test.ts
git commit -m "test: characterize special stone registry mappings"
```

If red-test commits are not desired, keep this test unstaged until Task 3 passes.

---

### Task 3: Implement Registry Source of Truth

**Files:**
- Modify: `shared/special-stone-registry.ts`
- Test: `test/shared.special-stone-registry.test.ts`

- [ ] **Step 1: Add interfaces near existing `StoneEffectTraits`**

Insert this after the existing `StoneEffectTraits` interface:

```ts
    type StoneEffectCategory =
        | 'special_stone_body'
        | 'trap'
        | 'bomb'
        | 'stone_status'
        | 'manifest_stone'
        | 'board_marker'
        | 'placement_effect';

    interface SpecialStoneCardDefinition {
        cardId: string;
        cardNameJa: string;
        cardType: string;
        markerType: string;
        promotedMarkerType?: string;
    }

    interface StoneEffectRule {
        markerType: string;
        category: StoneEffectCategory;
        countsAsSpecialStone: boolean;
        temptTargetable: boolean;
        captureTargetable: boolean;
        lossWillRevertible: boolean;
        willHunterPriority: boolean;
        durationAffectable: boolean;
        theorySpawnCandidate: boolean;
        normalVisual: boolean;
        blocksTempt: boolean;
    }
```

- [ ] **Step 2: Add canonical card definitions after `SPECIAL_STONE_REGISTRY`**

Add:

```ts
    const SPECIAL_STONE_CARD_DEFINITIONS: Readonly<Record<string, Readonly<SpecialStoneCardDefinition>>> = Object.freeze({
        PROTECTED_NEXT_STONE: Object.freeze({ cardId: 'hard_01', cardNameJa: '弱い意志', cardType: 'PROTECTED_NEXT_STONE', markerType: 'PROTECTED' }),
        PERMA_PROTECT_NEXT_STONE: Object.freeze({ cardId: 'perma_01', cardNameJa: '強い意志', cardType: 'PERMA_PROTECT_NEXT_STONE', markerType: 'PERMA_PROTECTED', promotedMarkerType: 'ABSOLUTE_PROTECTED' }),
        SNIPER_WILL: Object.freeze({ cardId: 'sniper_01', cardNameJa: '狙撃の意志', cardType: 'SNIPER_WILL', markerType: 'SNIPER' }),
        GHOST_WILL: Object.freeze({ cardId: 'ghost_01', cardNameJa: '幽霊の意志', cardType: 'GHOST_WILL', markerType: 'GHOST' }),
        AFTERIMAGE_WILL: Object.freeze({ cardId: 'afterimage_will_01', cardNameJa: '避ける意志', cardType: 'AFTERIMAGE_WILL', markerType: 'AFTERIMAGE_WILL' }),
        TRAP_WILL: Object.freeze({ cardId: 'trap_01', cardNameJa: '罠の意志', cardType: 'TRAP_WILL', markerType: 'TRAP' }),
        TIME_BOMB: Object.freeze({ cardId: 'bomb_01', cardNameJa: '時限爆弾', cardType: 'TIME_BOMB', markerType: 'TIME_BOMB' }),
        TIME_STOP_GOD: Object.freeze({ cardId: 'time_stop_god_01', cardNameJa: '時間停石', cardType: 'TIME_STOP_GOD', markerType: 'TIME_STOP' }),
        REGEN_WILL: Object.freeze({ cardId: 'regen_01', cardNameJa: '復活の意志', cardType: 'REGEN_WILL', markerType: 'REGEN' }),
        ULTIMATE_REVERSE_DRAGON: Object.freeze({ cardId: 'udr_01', cardNameJa: '究極反転龍', cardType: 'ULTIMATE_REVERSE_DRAGON', markerType: 'DRAGON' }),
        BREEDING_WILL: Object.freeze({ cardId: 'breeding_01', cardNameJa: '繁殖の意志', cardType: 'BREEDING_WILL', markerType: 'BREEDING' }),
        PROLIFERATION_WILL: Object.freeze({ cardId: 'proliferation_01', cardNameJa: '増殖の意志', cardType: 'PROLIFERATION_WILL', markerType: 'PROLIFERATION' }),
        HYPERACTIVE_WILL: Object.freeze({ cardId: 'hyperactive_01', cardNameJa: '多動の意志', cardType: 'HYPERACTIVE_WILL', markerType: 'HYPERACTIVE' }),
        EXTREME_HYPERACTIVE_WILL: Object.freeze({ cardId: 'extreme_hyperactive_01', cardNameJa: '極悪多動魔', cardType: 'EXTREME_HYPERACTIVE_WILL', markerType: 'EXTREME_HYPERACTIVE' }),
        ESCAPE_WILL: Object.freeze({ cardId: 'escape_01', cardNameJa: '逃げる意志', cardType: 'ESCAPE_WILL', markerType: 'ESCAPE_HYPERACTIVE' }),
        ROBOT_VACUUM_WILL: Object.freeze({ cardId: 'robot_vacuum_01', cardNameJa: 'ロボット掃除機', cardType: 'ROBOT_VACUUM_WILL', markerType: 'ROBOT_VACUUM' }),
        GLUTTONOUS_WILL: Object.freeze({ cardId: 'gluttonous_will_01', cardNameJa: '悪食の意志', cardType: 'GLUTTONOUS_WILL', markerType: 'GLUTTONOUS' }),
        WILL_HUNTER_KING: Object.freeze({ cardId: 'will_hunter_king_01', cardNameJa: '意志狩りの王', cardType: 'WILL_HUNTER_KING', markerType: 'WILL_HUNTER_KING' }),
        WORK_WILL: Object.freeze({ cardId: 'work_01', cardNameJa: '出稼ぎの意志', cardType: 'WORK_WILL', markerType: 'WORK' }),
        STONE_SALVATION_GOD: Object.freeze({ cardId: 'stone_salvation_god_01', cardNameJa: '救済神', cardType: 'STONE_SALVATION_GOD', markerType: 'STONE_SALVATION_GOD' }),
        DESTROY_DRAGON_WILL: Object.freeze({ cardId: 'destroy_dragon_01', cardNameJa: '破壊龍', cardType: 'DESTROY_DRAGON_WILL', markerType: 'DESTROY_DRAGON' }),
        LIGHTNING_WILL: Object.freeze({ cardId: 'lightning_01', cardNameJa: '落雷', cardType: 'LIGHTNING_WILL', markerType: 'LIGHTNING' }),
        ULTIMATE_DESTROY_GOD: Object.freeze({ cardId: 'udg_01', cardNameJa: '究極破壊神', cardType: 'ULTIMATE_DESTROY_GOD', markerType: 'ULTIMATE_DESTROY_GOD' }),
        ULTIMATE_HYPERACTIVE_GOD: Object.freeze({ cardId: 'ultimate_hyperactive_01', cardNameJa: '究極多動神', cardType: 'ULTIMATE_HYPERACTIVE_GOD', markerType: 'ULTIMATE_HYPERACTIVE' }),
        METEOR_GOD: Object.freeze({ cardId: 'meteor_god_01', cardNameJa: '因果抹消神', cardType: 'METEOR_GOD', markerType: 'METEOR_GOD' })
    });
```

- [ ] **Step 3: Add marker rule builder functions**

Add this after the existing category sets:

```ts
    function makeStoneEffectRule(markerType: string, overrides: Partial<StoneEffectRule>): Readonly<StoneEffectRule> {
        const category = overrides.category || 'special_stone_body';
        const countsAsSpecialStone = overrides.countsAsSpecialStone !== undefined
            ? overrides.countsAsSpecialStone
            : (category === 'special_stone_body' || category === 'trap' || category === 'bomb');
        return Object.freeze({
            markerType,
            category,
            countsAsSpecialStone,
            temptTargetable: overrides.temptTargetable !== undefined ? overrides.temptTargetable : countsAsSpecialStone,
            captureTargetable: overrides.captureTargetable !== undefined ? overrides.captureTargetable : category === 'special_stone_body',
            lossWillRevertible: overrides.lossWillRevertible !== undefined ? overrides.lossWillRevertible : countsAsSpecialStone,
            willHunterPriority: overrides.willHunterPriority !== undefined ? overrides.willHunterPriority : countsAsSpecialStone,
            durationAffectable: overrides.durationAffectable !== undefined ? overrides.durationAffectable : category === 'special_stone_body' || category === 'stone_status',
            theorySpawnCandidate: overrides.theorySpawnCandidate !== undefined ? overrides.theorySpawnCandidate : category === 'special_stone_body',
            normalVisual: overrides.normalVisual !== undefined ? overrides.normalVisual : false,
            blocksTempt: overrides.blocksTempt === true
        });
    }
```

- [ ] **Step 4: Add `STONE_EFFECT_RULES`**

Add the map after `makeStoneEffectRule`:

```ts
    const STONE_EFFECT_RULES: Readonly<Record<string, Readonly<StoneEffectRule>>> = Object.freeze({
        PROTECTED: makeStoneEffectRule('PROTECTED', {}),
        PERMA_PROTECTED: makeStoneEffectRule('PERMA_PROTECTED', {}),
        ABSOLUTE_PROTECTED: makeStoneEffectRule('ABSOLUTE_PROTECTED', {
            temptTargetable: false,
            captureTargetable: false,
            lossWillRevertible: false,
            blocksTempt: true
        }),
        SNIPER: makeStoneEffectRule('SNIPER', {}),
        GHOST: makeStoneEffectRule('GHOST', {}),
        AFTERIMAGE_WILL: makeStoneEffectRule('AFTERIMAGE_WILL', {}),
        TRAP: makeStoneEffectRule('TRAP', {
            category: 'trap',
            captureTargetable: false,
            theorySpawnCandidate: false,
            normalVisual: true,
            willHunterPriority: false
        }),
        TIME_BOMB: makeStoneEffectRule('TIME_BOMB', {
            category: 'bomb',
            captureTargetable: false,
            theorySpawnCandidate: false
        }),
        TIME_STOP: makeStoneEffectRule('TIME_STOP', {}),
        REGEN: makeStoneEffectRule('REGEN', {}),
        DRAGON: makeStoneEffectRule('DRAGON', {}),
        BREEDING: makeStoneEffectRule('BREEDING', {}),
        PROLIFERATION: makeStoneEffectRule('PROLIFERATION', {}),
        HYPERACTIVE: makeStoneEffectRule('HYPERACTIVE', {}),
        EXTREME_HYPERACTIVE: makeStoneEffectRule('EXTREME_HYPERACTIVE', {}),
        ESCAPE_HYPERACTIVE: makeStoneEffectRule('ESCAPE_HYPERACTIVE', {}),
        ROBOT_VACUUM: makeStoneEffectRule('ROBOT_VACUUM', {}),
        GLUTTONOUS: makeStoneEffectRule('GLUTTONOUS', {}),
        WILL_HUNTER_KING: makeStoneEffectRule('WILL_HUNTER_KING', {}),
        WORK: makeStoneEffectRule('WORK', {}),
        STONE_SALVATION_GOD: makeStoneEffectRule('STONE_SALVATION_GOD', {}),
        DESTROY_DRAGON: makeStoneEffectRule('DESTROY_DRAGON', {}),
        LIGHTNING: makeStoneEffectRule('LIGHTNING', {}),
        ULTIMATE_DESTROY_GOD: makeStoneEffectRule('ULTIMATE_DESTROY_GOD', {}),
        ULTIMATE_HYPERACTIVE: makeStoneEffectRule('ULTIMATE_HYPERACTIVE', {}),
        METEOR_GOD: makeStoneEffectRule('METEOR_GOD', {}),
        GUARD: makeStoneEffectRule('GUARD', {
            category: 'stone_status',
            countsAsSpecialStone: false,
            temptTargetable: false,
            captureTargetable: false,
            lossWillRevertible: false,
            theorySpawnCandidate: false,
            normalVisual: true,
            willHunterPriority: false,
            blocksTempt: true
        }),
        LIVING_WILL: makeStoneEffectRule('LIVING_WILL', {
            category: 'stone_status',
            countsAsSpecialStone: false,
            temptTargetable: true,
            captureTargetable: false,
            lossWillRevertible: false,
            theorySpawnCandidate: false,
            normalVisual: true,
            willHunterPriority: false
        }),
        BLOCKADE: makeStoneEffectRule('BLOCKADE', { category: 'board_marker', countsAsSpecialStone: false, temptTargetable: false, captureTargetable: false, lossWillRevertible: false, willHunterPriority: false, durationAffectable: false, theorySpawnCandidate: false, normalVisual: true }),
        METEOR_HOLE: makeStoneEffectRule('METEOR_HOLE', { category: 'board_marker', countsAsSpecialStone: false, temptTargetable: false, captureTargetable: false, lossWillRevertible: false, willHunterPriority: false, durationAffectable: false, theorySpawnCandidate: false, normalVisual: true }),
        FREEZE: makeStoneEffectRule('FREEZE', { category: 'board_marker', countsAsSpecialStone: false, temptTargetable: false, captureTargetable: false, lossWillRevertible: false, willHunterPriority: false, durationAffectable: false, theorySpawnCandidate: false, normalVisual: true }),
        SEED: makeStoneEffectRule('SEED', { category: 'board_marker', countsAsSpecialStone: false, temptTargetable: false, captureTargetable: false, lossWillRevertible: false, willHunterPriority: false, durationAffectable: false, theorySpawnCandidate: false, normalVisual: true }),
        CROSS_BOMB: makeStoneEffectRule('CROSS_BOMB', { category: 'placement_effect', countsAsSpecialStone: false, temptTargetable: false, captureTargetable: false, lossWillRevertible: false, willHunterPriority: false, durationAffectable: false, theorySpawnCandidate: false }),
        X_BOMB: makeStoneEffectRule('X_BOMB', { category: 'placement_effect', countsAsSpecialStone: false, temptTargetable: false, captureTargetable: false, lossWillRevertible: false, willHunterPriority: false, durationAffectable: false, theorySpawnCandidate: false }),
        GOLD: makeStoneEffectRule('GOLD', { category: 'placement_effect', countsAsSpecialStone: false, temptTargetable: false, captureTargetable: false, lossWillRevertible: false, willHunterPriority: false, durationAffectable: false, theorySpawnCandidate: false }),
        SILVER: makeStoneEffectRule('SILVER', { category: 'placement_effect', countsAsSpecialStone: false, temptTargetable: false, captureTargetable: false, lossWillRevertible: false, willHunterPriority: false, durationAffectable: false, theorySpawnCandidate: false }),
        RAINBOW: makeStoneEffectRule('RAINBOW', { category: 'placement_effect', countsAsSpecialStone: false, temptTargetable: false, captureTargetable: false, lossWillRevertible: false, willHunterPriority: false, durationAffectable: false, theorySpawnCandidate: false })
    });
```

- [ ] **Step 5: Add registry accessors and predicates**

Add these functions before `classifySpecialStoneRuleClass`:

```ts
    function getSpecialStoneCardDefinition(rawCardType: unknown): Readonly<SpecialStoneCardDefinition> | null {
        const cardType = normalizeSpecialStoneType(rawCardType);
        if (!cardType) return null;
        return SPECIAL_STONE_CARD_DEFINITIONS[cardType] || null;
    }

    function getMarkerTypeForSpecialStoneCard(rawCardType: unknown): string | null {
        const def = getSpecialStoneCardDefinition(rawCardType);
        return def ? def.markerType : null;
    }

    function getStoneEffectRule(rawType: unknown, markerData?: any): Readonly<StoneEffectRule> | null {
        const type = normalizeSpecialStoneType(rawType);
        if (!type) return null;
        if (type === 'HYPERACTIVE' && markerData && markerData.instantPlacementOnly) {
            return STONE_EFFECT_RULES.HYPERACTIVE
                ? makeStoneEffectRule('HYPERACTIVE', { category: 'placement_effect', countsAsSpecialStone: false, temptTargetable: false, captureTargetable: false, lossWillRevertible: false, willHunterPriority: false, durationAffectable: false, theorySpawnCandidate: false })
                : null;
        }
        return STONE_EFFECT_RULES[type] || null;
    }

    function isTemptTargetableStoneEffect(rawType: unknown, markerData?: any): boolean {
        const rule = getStoneEffectRule(rawType, markerData);
        return !!(rule && rule.temptTargetable);
    }

    function isCaptureTargetableStoneEffect(rawType: unknown, markerData?: any): boolean {
        const rule = getStoneEffectRule(rawType, markerData);
        return !!(rule && rule.captureTargetable);
    }

    function isWillHunterPriorityTarget(rawType: unknown, markerData?: any): boolean {
        const rule = getStoneEffectRule(rawType, markerData);
        return !!(rule && rule.willHunterPriority && !rule.normalVisual);
    }

    function isNormalVisualStoneEffect(rawType: unknown, markerData?: any): boolean {
        const rule = getStoneEffectRule(rawType, markerData);
        return !!(rule && rule.normalVisual);
    }

    function blocksTempt(rawType: unknown, markerData?: any): boolean {
        const rule = getStoneEffectRule(rawType, markerData);
        return !!(rule && rule.blocksTempt);
    }
```

- [ ] **Step 6: Rewire existing trait functions**

Change `classifySpecialStoneRuleClass()`, `getStoneEffectTraits()`, `countsAsSpecialStone()`, `canLossWillRevert()`, `isTheoryIncarnationSpawnCandidate()`, and `isDurationAffectableMarker()` to read `getStoneEffectRule()`. Preserve the current return strings by mapping:

```ts
    function ruleCategoryToLegacyRuleClass(category: StoneEffectCategory): SpecialStoneRuleClass {
        if (category === 'special_stone_body') return 'true_special_stone';
        return category;
    }
```

Then use:

```ts
    function classifySpecialStoneRuleClass(rawType: unknown, markerData?: any): SpecialStoneRuleClass | null {
        const type = normalizeSpecialStoneType(rawType);
        const data = (markerData && typeof markerData === 'object') ? markerData : null;
        if (!type) return null;
        const manifestStoneRegistry = getManifestStoneRegistryModule();
        if (manifestStoneRegistry && typeof manifestStoneRegistry.isManifestStoneType === 'function' && manifestStoneRegistry.isManifestStoneType(type)) {
            return 'manifest_stone';
        }
        if (INVIOLABLE_MANIFEST_STONE_TYPES.has(type)) {
            return 'manifest_stone';
        }
        const rule = getStoneEffectRule(type, data);
        return rule ? ruleCategoryToLegacyRuleClass(rule.category) : 'true_special_stone';
    }
```

Preserve `getStoneEffectTraits()` as the legacy compatibility shape. Do not redefine `isTargetableSpecialStone()` to mean temptation or capture targetability:

```ts
    function getStoneEffectTraits(rawType: unknown, markerData?: any): Readonly<StoneEffectTraits> | null {
        const type = normalizeSpecialStoneType(rawType);
        const data = (markerData && typeof markerData === 'object') ? markerData : null;
        if (!type) return null;
        const category = classifySpecialStoneRuleClass(type, data);
        if (!category) return null;
        const rule = getStoneEffectRule(type, data);
        const countsAsSpecialStone = rule ? rule.countsAsSpecialStone : category === 'true_special_stone';
        const inviolable = category === 'manifest_stone' || INVIOLABLE_MANIFEST_STONE_TYPES.has(type);
        const targetableAsSpecialStone = countsAsSpecialStone && !inviolable;
        return Object.freeze({
            category,
            countsAsSpecialStone,
            targetableAsSpecialStone,
            revertibleByLossWill: rule ? rule.lossWillRevertible : targetableAsSpecialStone && type !== 'ABSOLUTE_PROTECTED',
            spawnableByTheoryIncarnation: rule ? rule.theorySpawnCandidate : category === 'true_special_stone' && !THEORY_INCARNATION_SPAWN_EXCLUDED_TYPES.has(type),
            inviolable
        });
    }
```

Use the new `isTemptTargetableStoneEffect()` and `isCaptureTargetableStoneEffect()` for card targeting. Keep `isTargetableSpecialStone()` as legacy broad targetability to avoid breaking unrelated callers.

- [ ] **Step 7: Export new registry values**

Add these entries to the returned object:

```ts
        SPECIAL_STONE_CARD_DEFINITIONS,
        STONE_EFFECT_RULES,
        getSpecialStoneCardDefinition,
        getMarkerTypeForSpecialStoneCard,
        getStoneEffectRule,
        isTemptTargetableStoneEffect,
        isCaptureTargetableStoneEffect,
        isWillHunterPriorityTarget,
        isNormalVisualStoneEffect,
        blocksTempt,
```

- [ ] **Step 8: Run registry tests**

Run:

```powershell
npx jest test/shared.special-stone-registry.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 9: Commit registry changes**

Run:

```powershell
git add -- shared/special-stone-registry.ts test/shared.special-stone-registry.test.ts
git commit -m "refactor: centralize special stone registry"
```

Expected: commit succeeds.

---

### Task 4: Delegate Card Marker Helpers to Registry

**Files:**
- Modify: `game/logic/cards/utils.ts`
- Modify: `game/logic/cards/markers.ts`
- Test: `test/shared.special-stone-registry.test.ts`
- Test: `test/game.special-stone-visual-rule.test.ts`

- [ ] **Step 1: Update `isNormalVisualSpecialMarker()` in both helper files**

In both `game/logic/cards/utils.ts` and `game/logic/cards/markers.ts`, replace local type lists with:

```ts
function isNormalVisualSpecialMarker(marker: any): boolean {
    const type = String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
    if (SpecialStoneRegistry && typeof SpecialStoneRegistry.isNormalVisualStoneEffect === 'function') {
        return SpecialStoneRegistry.isNormalVisualStoneEffect(type, marker && marker.data);
    }
    return type === 'BLOCKADE' || type === 'METEOR_HOLE' || type === 'LIVING_WILL' || type === 'TRAP';
}
```

- [ ] **Step 2: Add targetable marker wrappers**

In both helper files, add:

```ts
function isTemptTargetableMarker(marker: any): boolean {
    if (!marker || !marker.data) return false;
    const type = String(marker.data.type || '').toUpperCase();
    if (SpecialStoneRegistry && typeof SpecialStoneRegistry.isTemptTargetableStoneEffect === 'function') {
        return SpecialStoneRegistry.isTemptTargetableStoneEffect(type, marker.data);
    }
    if (type === 'GUARD' || type === 'ABSOLUTE_PROTECTED') return false;
    const ruleClass = getMarkerRuleClass(marker);
    return ruleClass === 'true_special_stone' || ruleClass === 'trap' || ruleClass === 'bomb' || type === 'LIVING_WILL';
}

function isCaptureTargetableMarker(marker: any): boolean {
    if (!marker || !marker.data) return false;
    const type = String(marker.data.type || '').toUpperCase();
    if (SpecialStoneRegistry && typeof SpecialStoneRegistry.isCaptureTargetableStoneEffect === 'function') {
        return SpecialStoneRegistry.isCaptureTargetableStoneEffect(type, marker.data);
    }
    if (type === 'GUARD' || type === 'ABSOLUTE_PROTECTED') return false;
    const ruleClass = getMarkerRuleClass(marker);
    return ruleClass === 'true_special_stone';
}
```

Export `isTemptTargetableMarker` and `isCaptureTargetableMarker` from both files. Capture remains behaviorally unchanged, but the predicate must exist so capture does not inherit the broader temptation target set later.

- [ ] **Step 3: Add `blocksTemptAt()` wrappers**

In both helper files, add:

```ts
function blocksTemptAt(cardState: any, row: number, col: number): boolean {
    const markers = getMarkers(cardState);
    return markers.some((marker: any) => {
        if (!marker || marker.row !== row || marker.col !== col || !marker.data) return false;
        const type = String(marker.data.type || '').toUpperCase();
        if (SpecialStoneRegistry && typeof SpecialStoneRegistry.blocksTempt === 'function') {
            return SpecialStoneRegistry.blocksTempt(type, marker.data);
        }
        return type === 'GUARD' || type === 'ABSOLUTE_PROTECTED';
    });
}
```

Export `blocksTemptAt` from both files.

- [ ] **Step 4: Run helper-focused tests**

Run:

```powershell
npx jest test/shared.special-stone-registry.test.ts test/game.special-stone-visual-rule.test.ts --runInBand
```

Expected: PASS for existing behavior; new temptation behavior tests are added in Task 5.

- [ ] **Step 5: Commit helper delegation**

Run:

```powershell
git add -- game/logic/cards/utils.ts game/logic/cards/markers.ts
git commit -m "refactor: delegate stone marker traits to registry"
```

Expected: commit succeeds.

---

### Task 5: Change Temptation Targets to Registry Predicate

**Files:**
- Modify: `test/game.special-stone-visual-rule.test.ts`
- Modify: `game/logic/cards/targets.ts`
- Modify: `game/logic/card-resolution/ownership.ts`

- [ ] **Step 1: Add failing temptation target test**

Append this test in `test/game.special-stone-visual-rule.test.ts`:

```ts
  test('TEMPT_WILL は罠・時限爆弾・生きる意志を対象にでき、完全保護は対象外にする', () => {
    const cardState = createCardState();
    const gameState = createGameState();
    gameState.board[2][1] = Shared.WHITE;
    gameState.board[2][2] = Shared.WHITE;
    gameState.board[2][3] = Shared.WHITE;
    gameState.board[2][4] = Shared.WHITE;
    cardState.pendingEffectByPlayer.black = { type: 'TEMPT_WILL', stage: 'selectTarget', cardId: 'tempt_01' };
    cardState.markers.push(
      { id: 31, kind: 'specialStone', row: 2, col: 1, owner: 'white', data: { type: 'TRAP', hidden: true } },
      { id: 32, kind: 'specialStone', row: 2, col: 2, owner: 'white', data: { type: 'TIME_BOMB', category: 'bomb', remainingOwnerTurns: 3 } },
      { id: 33, kind: 'specialStone', row: 2, col: 3, owner: 'white', data: { type: 'LIVING_WILL', remainingOwnerTurns: 1 } },
      { id: 34, kind: 'specialStone', row: 2, col: 4, owner: 'white', data: { type: 'GUARD', remainingOwnerTurns: 3 } }
    );

    expect(CardLogic.getTemptWillTargets(cardState, gameState, 'black')).toEqual([
      { row: 2, col: 1 },
      { row: 2, col: 2 },
      { row: 2, col: 3 }
    ]);
  });
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```powershell
npx jest test/game.special-stone-visual-rule.test.ts -t "TEMPT_WILL は罠・時限爆弾・生きる意志" --runInBand
```

Expected: FAIL because current `getTemptWillTargets()` excludes trap, bomb, and `LIVING_WILL`.

- [ ] **Step 3: Update `getTemptWillTargets()`**

In `game/logic/cards/targets.ts`, replace the true-special-only filtering block with a marker-entry based predicate:

```ts
        const markerEntry = CardUtils && typeof CardUtils.getSpecialMarkerAt === 'function'
            ? CardUtils.getSpecialMarkerAt(cardState, r, c)
            : null;
        const marker = markerEntry && markerEntry.marker ? markerEntry.marker : markerEntry;
        const fallbackMarker = marker || (cardState.markers || []).find((m: any) => m && m.kind === 'specialStone' && m.row === r && m.col === c);
        if (!fallbackMarker) return;
        const isTemptTargetable = CardUtils && typeof CardUtils.isTemptTargetableMarker === 'function'
            ? CardUtils.isTemptTargetableMarker(fallbackMarker)
            : (() => {
                const type = String(fallbackMarker && fallbackMarker.data && fallbackMarker.data.type ? fallbackMarker.data.type : '').toUpperCase();
                if (type === 'GUARD' || type === 'ABSOLUTE_PROTECTED') return false;
                const ruleClass = CardUtils && typeof CardUtils.getMarkerRuleClass === 'function'
                    ? CardUtils.getMarkerRuleClass(fallbackMarker)
                    : null;
                return ruleClass === 'true_special_stone' || ruleClass === 'trap' || ruleClass === 'bomb' || type === 'LIVING_WILL';
            })();
        if (!isTemptTargetable) return;
        if (CardUtils && typeof CardUtils.blocksTemptAt === 'function' && CardUtils.blocksTemptAt(cardState, r, c)) return;
        const markerOwner = fallbackMarker.owner || (typeof CardUtils.getSpecialOwnerAt === 'function' ? CardUtils.getSpecialOwnerAt(cardState, r, c) : null);
        if (markerOwner !== opponentKey) return;
        if (getCellValue(gameState, r, c) === P_EMPTY) return;
        res.push({ row: r, col: c });
```

Keep the existing `isGuarded()` and `isAbsoluteProtected()` checks until `blocksTemptAt()` is verified across both helper modules.

- [ ] **Step 4: Update `applyTemptWill()` validation**

In `game/logic/card-resolution/ownership.ts`, add `isTemptTargetableMarker` and `blocksTemptAt` to the dependency reads and required dependency guard, then replace the `isOpponentTrueSpecial` / `isOpponentGhost` check with:

```ts
    const isTemptTargetableMarker = deps && deps.isTemptTargetableMarker;
    const blocksTemptAt = deps && deps.blocksTemptAt;
    if (typeof isTemptTargetableMarker !== 'function' || typeof blocksTemptAt !== 'function') {
        return { applied: false, reason: 'deps_missing' };
    }
    if (blocksTemptAt(cardState, row, col)) {
        return { applied: false, reason: 'guarded' };
    }
    const markersAtCell = getSpecialMarkers(cardState).filter((m: any) => m && m.row === row && m.col === col);
    const targetMarker = markersAtCell.find((m: any) => {
        if (!m || m.owner !== opponentKey || !m.data) return false;
        if (!isTemptTargetableMarker(m)) return false;
        return true;
    }) || null;
    if (!targetMarker) {
        const hasOwnTargetable = markersAtCell.some((m: any) => m && m.owner !== opponentKey && isTemptTargetableMarker(m));
        return { applied: false, reason: hasOwnTargetable ? 'not_opponent_special' : 'not_special' };
    }
```

Ensure `createOwnershipResolution()` dependency wiring in `game/logic/cards.ts` passes `isTemptTargetableMarker` from `CardMarkers` or `CardUtils`.

- [ ] **Step 5: Run temptation focused tests**

Run:

```powershell
npx jest test/game.special-stone-visual-rule.test.ts test/game.guard-will.test.ts test/game.ghost-will.test.ts --runInBand
```

Expected: PASS. `GUARD` and `ABSOLUTE_PROTECTED` remain excluded.

- [ ] **Step 6: Commit temptation behavior change**

Run:

```powershell
git add -- test/game.special-stone-visual-rule.test.ts game/logic/cards/targets.ts game/logic/card-resolution/ownership.ts game/logic/cards.ts
git commit -m "feat: use registry for temptation targets"
```

Expected: commit succeeds.

---

### Task 6: Keep Capture and Loss Will Behavior Stable

**Files:**
- Modify: `test/game.capture-will.test.ts`
- Modify: `test/game.loss-will.test.ts`
- Modify: `game/logic/cards/targets.ts`
- Modify: `game/logic/cards-internal/effect-target-counts.ts`

- [ ] **Step 1: Add capture stability test**

Add this test to `test/game.capture-will.test.ts`:

```ts
  test('CAPTURE_WILL は罠・時限爆弾・生きる意志を初回共通化では捕獲対象にしない', () => {
    const prng = { shuffle: (arr: any[]) => arr, random: () => 0 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY)),
      currentPlayer: Shared.BLACK
    };
    gameState.board[1][1] = Shared.WHITE;
    gameState.board[1][2] = Shared.WHITE;
    gameState.board[1][3] = Shared.WHITE;
    cardState.markers.push(
      { id: 41, kind: 'specialStone', row: 1, col: 1, owner: 'white', data: { type: 'TRAP', hidden: true } },
      { id: 42, kind: 'specialStone', row: 1, col: 2, owner: 'white', data: { type: 'TIME_BOMB', category: 'bomb' } },
      { id: 43, kind: 'specialStone', row: 1, col: 3, owner: 'white', data: { type: 'LIVING_WILL' } }
    );

    expect(CardLogic.getCaptureWillTargets(cardState, gameState, 'black')).toEqual([]);
  });
```

- [ ] **Step 2: Add loss-will stability test**

Add this test to `test/game.loss-will.test.ts`:

```ts
  test('LOSS_WILL keeps removing traps and bombs but not living will or guard', () => {
    const prng = { shuffle: (arr: any[]) => arr, random: () => 0 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY)),
      currentPlayer: Shared.BLACK
    };
    cardState.pendingEffectByPlayer.black = { type: 'LOSS_WILL', stage: null, cardId: 'loss_will_01' };
    cardState.markers.push(
      { id: 51, kind: 'specialStone', row: 2, col: 1, owner: 'white', data: { type: 'TRAP', hidden: true } },
      { id: 52, kind: 'specialStone', row: 2, col: 2, owner: 'white', data: { type: 'TIME_BOMB', category: 'bomb' } },
      { id: 53, kind: 'specialStone', row: 2, col: 3, owner: 'white', data: { type: 'LIVING_WILL' } },
      { id: 54, kind: 'specialStone', row: 2, col: 4, owner: 'white', data: { type: 'GUARD' } }
    );

    const res = CardLogic.applyLossWill(cardState, gameState, 'black');
    expect(res.removed.map((entry: any) => entry.type).sort()).toEqual(['TIME_BOMB', 'TRAP']);
    expect(cardState.markers.some((m: any) => m.data && m.data.type === 'LIVING_WILL')).toBe(true);
    expect(cardState.markers.some((m: any) => m.data && m.data.type === 'GUARD')).toBe(true);
  });
```

- [ ] **Step 3: Wire capture selection to the capture predicate**

Change `getCaptureMarkerAt()` in `game/logic/cards/targets.ts` to gate the selected marker through `isCaptureTargetableMarker()`:

```ts
        const marker = markerEntry && markerEntry.marker ? markerEntry.marker : markerEntry;
        if (CardUtils && typeof CardUtils.isCaptureTargetableMarker === 'function') {
            return CardUtils.isCaptureTargetableMarker(marker) ? markerEntry : null;
        }
```

This is not conditional on test failure. The point is to prevent `CAPTURE_WILL` from accidentally inheriting the broader `TEMPT_WILL` target set. Keep `applyCaptureWill()` behavior unchanged unless a focused test exposes a mismatch between selector and resolver.

- [ ] **Step 4: Run stability tests**

Run:

```powershell
npx jest test/game.capture-will.test.ts test/game.loss-will.test.ts --runInBand
```

Expected: PASS after registry predicates are wired.

- [ ] **Step 5: Commit capture/loss stability**

Run:

```powershell
git add -- test/game.capture-will.test.ts test/game.loss-will.test.ts game/logic/cards/targets.ts game/logic/cards-internal/effect-target-counts.ts
git commit -m "test: preserve capture and loss special targeting"
```

Expected: commit succeeds. If `game/logic/cards-internal/effect-target-counts.ts` did not need a change, leave it unstaged.

---

### Task 7: Move Will Hunter Priority to Registry

**Files:**
- Modify: `game/logic/cards/will_hunter_king.ts`
- Modify: `test/game.will-hunter-king.test.ts`

- [ ] **Step 1: Add registry-priority test**

In `test/game.will-hunter-king.test.ts`, add a case that verifies visible priority still excludes hidden trap and includes time bomb:

```ts
  test('特殊石優先は registry の willHunterPriority を使い hidden trap を優先しない', () => {
    const { cardState, gameState } = createState(0);
    gameState.board[3][3] = Shared.BLACK;
    gameState.board[3][4] = Shared.WHITE;
    gameState.board[3][5] = Shared.WHITE;
    cardState.markers.push(
      {
        id: 9101,
        kind: 'specialStone',
        row: 3,
        col: 3,
        owner: 'black',
        data: { type: 'WILL_HUNTER_KING', remainingOwnerTurns: 8, flipEvadeRemaining: 2, destroyEvadeRemaining: 2 }
      },
      {
        id: 9102,
        kind: 'specialStone',
        row: 3,
        col: 4,
        owner: 'white',
        data: { type: 'TRAP', hidden: true }
      },
      {
        id: 9103,
        kind: 'specialStone',
        row: 3,
        col: 5,
        owner: 'white',
        data: { type: 'TIME_BOMB', category: 'bomb' }
      }
    );

    const out = CardIogic.processWillHunterKingEffectsAtTurnStartAnchor(cardState, gameState, 'black', 3, 3, createPrng(0));
    expect(out.destroyed).toEqual([expect.objectContaining({ row: 3, col: 5, destroyedSpecial: true })]);
  });
```

- [ ] **Step 2: Update `hasVisibleNonNormalStoneAt()`**

In `game/logic/cards/will_hunter_king.ts`, resolve `SpecialStoneRegistry` beside `CardUtilsModule` and replace `hasVisibleNonNormalStoneAt()` with:

```ts
function hasVisibleNonNormalStoneAt(cardState: any, row: number, col: number): boolean {
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    return markers.some((marker: any) => {
        if (!marker || marker.row !== row || marker.col !== col || !marker.data) return false;
        const type = String(marker.data.type || '').toUpperCase();
        if (SpecialStoneRegistry && typeof SpecialStoneRegistry.isWillHunterPriorityTarget === 'function') {
            return SpecialStoneRegistry.isWillHunterPriorityTarget(type, marker.data);
        }
        if (CardUtilsModule && typeof CardUtilsModule.isNonNormalStoneVisualAt === 'function') {
            return CardUtilsModule.isNonNormalStoneVisualAt(cardState, row, col);
        }
        return marker.kind === 'specialStone' && type !== 'TRAP';
    });
}
```

- [ ] **Step 3: Run will-hunter focused tests**

Run:

```powershell
npx jest test/game.will-hunter-king.test.ts test/game.manifest-random-target-exclusion.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 4: Commit will-hunter registry use**

Run:

```powershell
git add -- game/logic/cards/will_hunter_king.ts test/game.will-hunter-king.test.ts
git commit -m "refactor: use registry for will hunter priority"
```

Expected: commit succeeds.

---

### Task 8: Use Registry for Marker Factory Mapping

**Files:**
- Modify: `game/logic/card-resolution/special-stone-marker-factory.ts`
- Test: `test/game.special-stone-marker-factory.test.ts`
- Test: `test/shared.special-stone-registry.test.ts`

- [ ] **Step 1: Add factory/registry parity test**

Add this test to `test/game.special-stone-marker-factory.test.ts`:

```ts
test('special-stone marker factory follows registry card mappings', () => {
  const registry = require('../shared/special-stone-registry.js');
  const expectedTypes = [
    'PROTECTED_NEXT_STONE',
    'PERMA_PROTECT_NEXT_STONE',
    'GHOST_WILL',
    'AFTERIMAGE_WILL',
    'REGEN_WILL',
    'BREEDING_WILL',
    'PROLIFERATION_WILL',
    'ULTIMATE_REVERSE_DRAGON',
    'SNIPER_WILL',
    'DESTROY_DRAGON_WILL',
    'LIGHTNING_WILL',
    'TIME_STOP_GOD',
    'WILL_HUNTER_KING',
    'HYPERACTIVE_WILL',
    'EXTREME_HYPERACTIVE_WILL',
    'ESCAPE_WILL',
    'ROBOT_VACUUM_WILL',
    'GLUTTONOUS_WILL',
    'ULTIMATE_HYPERACTIVE_GOD',
    'WORK_WILL'
  ];

  for (const cardType of expectedTypes) {
    const markerData = SpecialStoneMarkerFactory.buildMarkerDataForCardType(cardType, {
      constants: {},
      SpecialStoneRegistry: registry
    });
    expect(markerData).toEqual(expect.objectContaining({
      type: registry.getMarkerTypeForSpecialStoneCard(cardType)
    }));
  }
});
```

- [ ] **Step 2: Update marker factory**

At the top of `special-stone-marker-factory.ts`, read the marker type once:

```ts
function readRegistryMarkerType(cardType: string, deps: any): string | null {
    const registry = deps && deps.SpecialStoneRegistry;
    return registry && typeof registry.getMarkerTypeForSpecialStoneCard === 'function'
        ? registry.getMarkerTypeForSpecialStoneCard(cardType)
        : null;
}
```

For each switch case, replace hard-coded `type` values with `readRegistryMarkerType(type, deps) || '<current literal>'`. Example:

```ts
        case 'GHOST_WILL':
            return {
                type: readRegistryMarkerType(type, deps) || 'GHOST',
                remainingOwnerTurns: readPositiveInt(constants.GHOST_WILL_TURNS, FALLBACK_TURNS.GHOST_WILL)
            };
```

Repeat for every supported special-stone card in the factory.

- [ ] **Step 3: Run factory tests**

Run:

```powershell
npx jest test/game.special-stone-marker-factory.test.ts test/shared.special-stone-registry.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 4: Commit marker factory mapping**

Run:

```powershell
git add -- game/logic/card-resolution/special-stone-marker-factory.ts test/game.special-stone-marker-factory.test.ts
git commit -m "refactor: derive marker factory types from registry"
```

Expected: commit succeeds.

---

### Task 9: Final Validation and Generated Surface Sync

**Files:**
- Inspect: `public/module-registry.js`
- Inspect: `worker-public/*`

- [ ] **Step 1: Run focused special-stone tests**

Run:

```powershell
npx jest test/shared.special-stone-registry.test.ts test/game.special-stone-visual-rule.test.ts test/game.capture-will.test.ts test/game.loss-will.test.ts test/game.will-hunter-king.test.ts test/game.special-stone-marker-factory.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run TypeScript build**

Run:

```powershell
npm run build:ts
```

Expected: PASS.

- [ ] **Step 4: Prepare worker mirror if build output changes browser-served files**

Run:

```powershell
npm run worker:prepare
```

Expected: PASS. Review any `worker-public/*` changes and confirm they mirror root source/build output.

- [ ] **Step 5: Inspect final diff**

Run:

```powershell
git status --short
git diff --stat
git diff --check
```

Expected: only files intentionally changed by this registry unification remain unstaged or staged. `git diff --check` reports no whitespace errors.

- [ ] **Step 6: Commit final generated sync if needed**

If `worker:prepare` or build commands updated generated or mirror files required by this task, stage only those files:

```powershell
git add -- public/module-registry.js worker-public/cards/catalog.generated.js worker-public/cards/catalog.js worker-public/cards/catalog.json worker-public/index.html worker-public/public/module-registry.js
git commit -m "build: sync special stone registry surfaces"
```

Expected: commit succeeds only if generated/mirror files were intentionally produced by this task.

---

## Self-Review

- Spec coverage: The plan updates player-facing rules, adds the canonical registry, rewires helper predicates, changes `TEMPT_WILL`, preserves capture/loss behavior, moves will-hunter priority to registry, and validates generated surfaces.
- Placeholder scan: The plan contains concrete files, commands, snippets, expected outcomes, and commit points.
- Type consistency: New API names are used consistently: `getSpecialStoneCardDefinition`, `getMarkerTypeForSpecialStoneCard`, `getStoneEffectRule`, `isTemptTargetableStoneEffect`, `isCaptureTargetableStoneEffect`, `isWillHunterPriorityTarget`, `isNormalVisualStoneEffect`, and `blocksTempt`.
