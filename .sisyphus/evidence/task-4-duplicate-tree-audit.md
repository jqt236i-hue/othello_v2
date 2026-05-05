# Task 4: Duplicate Tree Content Audit

Date: 2026-04-30

## Scope And Method

- Compared each requested suspicious tree to its intended root-side canonical counterpart.
- Listed every file in each suspicious tree with `Get-ChildItem -File -Recurse`.
- Compared file content with SHA-256 hashes using `Get-FileHash`.
- Used `.sisyphus/evidence/task-3-suspicious-tree-references.txt` for reference context: no ordinary external source imports into these nested paths were found; the only live references were wrapper files inside the suspicious trees requiring same-shaped nested output.
- No files were deleted and no references were modified.

Decision key:

- `DELETE`: accidental copy/generated wrapper tree with zero external source refs.
- `KEEP`: documented exception.
- `REPLACE-THEN-DELETE`: references must be updated before removal.

## 1. `game/cards/game/cards/effects`

- Canonical counterpart: `game/cards/effects`
- File count: 58
- Hash comparison summary: 0 same-name matches, 28 same-name diffs, 30 files missing same-name canonical counterpart.
- Decision: `DELETE`
- Rationale: The suspicious tree mirrors the canonical card effects area but contains generated/plain CommonJS wrappers and `// @ts-nocheck` TypeScript copies rather than the typed canonical sources. Same-name `.ts` files all differ from canonical files, and `.js` files have no same-name canonical source counterpart under `game/cards/effects`. Task 3 found no external source imports into this tree; only files inside the suspicious tree refer to nested output paths.

| File | Hash comparison |
| --- | --- |
| `board-expansion-apply.js` | `MISSING_CANON`; suspicious `5F02D1816001` |
| `board-expansion-apply.ts` | `DIFF`; suspicious `741BB0892254`, canonical `C431DC46E1C5` |
| `breeding.js` | `MISSING_CANON`; suspicious `59542D17D01B` |
| `breeding.ts` | `DIFF`; suspicious `498DAD068281`, canonical `D63988364BEB` |
| `chain.js` | `MISSING_CANON`; suspicious `A556DA6352F7` |
| `chain.ts` | `DIFF`; suspicious `072257602A84`, canonical `2F279D9015BC` |
| `clone.js` | `MISSING_CANON`; suspicious `6BCBF18F7DDA` |
| `clone.ts` | `DIFF`; suspicious `CF0C3CA4B597`, canonical `8DBEC431390C` |
| `destroy-dragon.js` | `MISSING_CANON`; suspicious `F810BD2DF6B0` |
| `destroy-dragon.ts` | `DIFF`; suspicious `81ED1CCC917B`, canonical `B6663B0F4651` |
| `destroy-one-stone.js` | `MISSING_CANON`; suspicious `1CAACC6A2BC8` |
| `destroy-one-stone.ts` | `DIFF`; suspicious `70F91CC0E7FD`, canonical `98A1F3B9F6DB` |
| `dragon.js` | `MISSING_CANON`; suspicious `4AF9D6A0ECC3` |
| `dragon.ts` | `DIFF`; suspicious `43301CB425D1`, canonical `14DB5CC91416` |
| `expansion.js` | `MISSING_CANON`; suspicious `13ACE659C686` |
| `expansion.ts` | `DIFF`; suspicious `032261D1AFAF`, canonical `3EF4829F894F` |
| `flips.js` | `MISSING_CANON`; suspicious `70A0754506AD` |
| `flips.ts` | `DIFF`; suspicious `7780E20DB869`, canonical `E1EAA04BCF4B` |
| `hand-effects.js` | `MISSING_CANON`; suspicious `7A8489F296F2` |
| `hand-effects.ts` | `DIFF`; suspicious `96BAD52BFAAD`, canonical `99C64C6B4DBC` |
| `hyperactive.js` | `MISSING_CANON`; suspicious `683D90509C2D` |
| `hyperactive.ts` | `DIFF`; suspicious `E92825C1526D`, canonical `F301837E4DE0` |
| `lightning.js` | `MISSING_CANON`; suspicious `7C109281796D` |
| `lightning.ts` | `DIFF`; suspicious `0D627DDD7836`, canonical `5BA7FAEC20C5` |
| `living-will.js` | `MISSING_CANON`; suspicious `711B1C183F29` |
| `living-will.ts` | `DIFF`; suspicious `83AAF9D50D1A`, canonical `80688A22D6D7` |
| `markers.js` | `MISSING_CANON`; suspicious `18C423887349` |
| `markers.ts` | `DIFF`; suspicious `0D8667F27A9B`, canonical `DC6DD65D348F` |
| `meteor.js` | `MISSING_CANON`; suspicious `791C19F78B40` |
| `meteor.ts` | `DIFF`; suspicious `437129335758`, canonical `0A5E69143AA2` |
| `movement.js` | `MISSING_CANON`; suspicious `C33D70137734` |
| `movement.ts` | `DIFF`; suspicious `398EC48DC9AC`, canonical `5704DBF7194C` |
| `ownership.js` | `MISSING_CANON`; suspicious `0161E223ECFC` |
| `position-swap.js` | `MISSING_CANON`; suspicious `5F6EED297205` |
| `position-swap.ts` | `DIFF`; suspicious `46C3094FCB1B`, canonical `C9D379B2649F` |
| `protect.js` | `MISSING_CANON`; suspicious `6D56DBE186DF` |
| `protect.ts` | `DIFF`; suspicious `0F468C8830ED`, canonical `7E8CEFD1E7F8` |
| `regen.js` | `MISSING_CANON`; suspicious `6A2713211689` |
| `regen.ts` | `DIFF`; suspicious `A168029E40B8`, canonical `D8D2BB691C4B` |
| `shrink.js` | `MISSING_CANON`; suspicious `068D1107A202` |
| `shrink.ts` | `DIFF`; suspicious `910BCE209596`, canonical `D84F4A0B3B0C` |
| `sniper.js` | `MISSING_CANON`; suspicious `CDB4626F281A` |
| `sniper.ts` | `DIFF`; suspicious `3B2CD09588DF`, canonical `116401703A8A` |
| `status-cells.js` | `MISSING_CANON`; suspicious `551A8AC75276` |
| `status-cells.ts` | `DIFF`; suspicious `B1198DA7D1A4`, canonical `9BD5E5D52D1E` |
| `swap-with-enemy.js` | `MISSING_CANON`; suspicious `8B7A45A4F468` |
| `swap-with-enemy.ts` | `DIFF`; suspicious `3351EF5DCC89`, canonical `7BCFFDE6AFA0` |
| `targets.js` | `MISSING_CANON`; suspicious `459040E58C97` |
| `teleport.js` | `MISSING_CANON`; suspicious `30B78344BEAB` |
| `teleport.ts` | `DIFF`; suspicious `C40D9563F9DF`, canonical `6496887BE3DB` |
| `time-bomb.js` | `MISSING_CANON`; suspicious `F85C272BDFFB` |
| `time-bomb.ts` | `DIFF`; suspicious `1490C3F59794`, canonical `C1EC9F9F423A` |
| `trap.js` | `MISSING_CANON`; suspicious `7DFC60732CCD` |
| `trap.ts` | `DIFF`; suspicious `05A7E2E631AC`, canonical `18116F34CEA0` |
| `udg.js` | `MISSING_CANON`; suspicious `E392C0EDB219` |
| `udg.ts` | `DIFF`; suspicious `3660164AB3A9`, canonical `7265FC8216A6` |
| `work-will.js` | `MISSING_CANON`; suspicious `39B798D86CA6` |
| `work-will.ts` | `DIFF`; suspicious `28EF15462F9F`, canonical `8DAC013F52DE` |

## 2. `game/logic/game/logic/cards`

- Canonical counterpart: `game/logic/cards`
- File count: 20
- Hash comparison summary: 0 same-name matches, 20 same-name diffs, 0 missing same-name canonical counterparts.
- Decision: `DELETE`
- Rationale: Every file has a canonical same-name counterpart but all hashes differ because the suspicious files are generated/plain CommonJS or `// @ts-nocheck` copies of the canonical TypeScript/JavaScript sources. Task 3 found no external source imports into this tree; only files inside the suspicious tree refer to nested output paths.

| File | Hash comparison |
| --- | --- |
| `chain.js` | `DIFF`; suspicious `938BDE34061D`, canonical `96C052447DA1` |
| `chain.ts` | `DIFF`; suspicious `01C4402841BA`, canonical `9C9D63CA4182` |
| `clone.js` | `DIFF`; suspicious `7491C37F9B89`, canonical `9A0E633E0865` |
| `clone.ts` | `DIFF`; suspicious `3B9A2F7A7DA1`, canonical `FBAD4E61DBB5` |
| `costs.js` | `DIFF`; suspicious `DEB8416111E5`, canonical `76BCCEFEEB05` |
| `costs.ts` | `DIFF`; suspicious `19167BB6EE39`, canonical `3CC5949C1CFA` |
| `defs.js` | `DIFF`; suspicious `8071CACDF0CB`, canonical `8EB1A53F0BBE` |
| `defs.ts` | `DIFF`; suspicious `1C2BAC955E8E`, canonical `777F2F9201AA` |
| `flips.js` | `DIFF`; suspicious `4E7DB9692B43`, canonical `7144398DB069` |
| `flips.ts` | `DIFF`; suspicious `7B3CD1C63CEB`, canonical `94B5FBAD6ACD` |
| `meteor.js` | `DIFF`; suspicious `56852D1FD7FC`, canonical `49B58D8994EC` |
| `meteor.ts` | `DIFF`; suspicious `64927B002763`, canonical `BDECB18B6178` |
| `movement.js` | `DIFF`; suspicious `0CD98557B64F`, canonical `927DD0270480` |
| `shrink.js` | `DIFF`; suspicious `D976C74CE214`, canonical `DD7A80A44233` |
| `shrink.ts` | `DIFF`; suspicious `38638794A134`, canonical `3C7650A10C94` |
| `targets.js` | `DIFF`; suspicious `6CC67272E339`, canonical `8A2F4DD88E50` |
| `targets.ts` | `DIFF`; suspicious `A66C8878A720`, canonical `20A3FA280DF9` |
| `teleport.js` | `DIFF`; suspicious `507D4C4B5CDD`, canonical `3051813804CA` |
| `teleport.ts` | `DIFF`; suspicious `157C00B04A0C`, canonical `F3B95A9E1E68` |
| `will_hunter_king.js` | `DIFF`; suspicious `691D9C60AE44`, canonical `D9FBCCA89C01` |

## 3. `game/cards/game/logic/cards`

- Canonical counterpart: `game/logic/cards`
- File count: 15
- Hash comparison summary: 0 same-name matches, 15 same-name diffs, 0 missing same-name canonical counterparts.
- Decision: `DELETE`
- Rationale: This is another nested copy of a subset of `game/logic/cards`. All files differ from canonical same-name files, and representative reads show the suspicious `.ts` files are `// @ts-nocheck` generated-style copies while canonical files retain typed source. Task 3 found no external source imports into this tree; only files inside the suspicious tree refer to nested output paths.

| File | Hash comparison |
| --- | --- |
| `chain.js` | `DIFF`; suspicious `348753DCAA62`, canonical `96C052447DA1` |
| `chain.ts` | `DIFF`; suspicious `01C4402841BA`, canonical `9C9D63CA4182` |
| `clone.js` | `DIFF`; suspicious `C003BA07CAD2`, canonical `9A0E633E0865` |
| `clone.ts` | `DIFF`; suspicious `3B9A2F7A7DA1`, canonical `FBAD4E61DBB5` |
| `flips.js` | `DIFF`; suspicious `4E78D7E7CD45`, canonical `7144398DB069` |
| `flips.ts` | `DIFF`; suspicious `7B3CD1C63CEB`, canonical `94B5FBAD6ACD` |
| `meteor.js` | `DIFF`; suspicious `D8EEC5CD080B`, canonical `49B58D8994EC` |
| `meteor.ts` | `DIFF`; suspicious `64927B002763`, canonical `BDECB18B6178` |
| `movement.js` | `DIFF`; suspicious `CDA57A3AD44F`, canonical `927DD0270480` |
| `shrink.js` | `DIFF`; suspicious `8CC91D4F5E30`, canonical `DD7A80A44233` |
| `shrink.ts` | `DIFF`; suspicious `38638794A134`, canonical `3C7650A10C94` |
| `targets.js` | `DIFF`; suspicious `A1D95D945201`, canonical `8A2F4DD88E50` |
| `targets.ts` | `DIFF`; suspicious `A66C8878A720`, canonical `20A3FA280DF9` |
| `teleport.js` | `DIFF`; suspicious `9D9BFBD11972`, canonical `3051813804CA` |
| `teleport.ts` | `DIFF`; suspicious `157C00B04A0C`, canonical `F3B95A9E1E68` |

## 4. `game/cards/game/logic/effects`

- Canonical counterpart: `game/logic/effects`
- File count: 2
- Hash comparison summary: 0 same-name matches, 2 same-name diffs, 0 missing same-name canonical counterparts.
- Decision: `DELETE`
- Rationale: The suspicious tree contains a generated/plain CommonJS `destroy_one_stone` pair that corresponds to the canonical typed source under `game/logic/effects`. Both hashes differ from the canonical files. Task 3 found no external source imports into this tree; only the wrapper file inside the suspicious tree refers to nested output.

| File | Hash comparison |
| --- | --- |
| `destroy_one_stone.js` | `DIFF`; suspicious `1C0096C744A3`, canonical `2F9EBFB4A1EC` |
| `destroy_one_stone.ts` | `DIFF`; suspicious `0683A55D0638`, canonical `E66C5B08DD4D` |

## 5. `game/logic/game/logic/effects`

- Canonical counterpart: `game/logic/effects`
- File count: 2
- Hash comparison summary: 0 same-name matches, 2 same-name diffs, 0 missing same-name canonical counterparts.
- Decision: `DELETE`
- Rationale: The suspicious tree duplicates the same `destroy_one_stone` effect area as a generated/plain CommonJS nested copy. Both files differ from canonical same-name files, and Task 3 found no external source imports into this tree; only the wrapper file inside the suspicious tree refers to nested output.

| File | Hash comparison |
| --- | --- |
| `destroy_one_stone.js` | `DIFF`; suspicious `1DF961E7147D`, canonical `2F9EBFB4A1EC` |
| `destroy_one_stone.ts` | `DIFF`; suspicious `0683A55D0638`, canonical `E66C5B08DD4D` |

## Overall Result

| Suspicious tree | Canonical counterpart | File count | Hash result | Decision |
| --- | --- | ---: | --- | --- |
| `game/cards/game/cards/effects` | `game/cards/effects` | 58 | 28 diffs, 30 missing same-name canonical files | `DELETE` |
| `game/logic/game/logic/cards` | `game/logic/cards` | 20 | 20 diffs | `DELETE` |
| `game/cards/game/logic/cards` | `game/logic/cards` | 15 | 15 diffs | `DELETE` |
| `game/cards/game/logic/effects` | `game/logic/effects` | 2 | 2 diffs | `DELETE` |
| `game/logic/game/logic/effects` | `game/logic/effects` | 2 | 2 diffs | `DELETE` |
