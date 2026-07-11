# Remove Hyperactive Inherit Will Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `多動の継承` (`hyperactive_inherit_01` / `HYPERACTIVE_INHERIT_WILL`) and its `INHERITED_HYPERACTIVE` board state completely, including player-facing text.

**Architecture:** Treat this as a card retirement plus state retirement, not a compatibility migration. Root files are source of truth; generated catalog/browser assets and `worker-public/` are refreshed only through existing scripts. Shared multi-card hyperactive behavior remains; only the inherit-specific card, pending flow, status, UI, CPU policy, docs, and tests are removed.

**Tech Stack:** TypeScript/JavaScript browser game, Jest, generated card catalog, Cloudflare Worker mirror.

---

## Document Role

This is an implementation plan, not a gameplay spec. The gameplay source of truth must be changed in `01-rulebook.md` during implementation. Non-goal: preserving old snapshots or replays that contain `INHERITED_HYPERACTIVE`; the product decision is that `多動の継承` is never used again.

## File Map

- `01-rulebook.md`: remove `10.17.5 HYPERACTIVE_INHERIT_WILL（多動の継承）` and all player-facing references to `継承多動` / `多動の継承`.
- `正本/カード仕様正本.md`, `正本/演出正本.md`, `正本/効果音対応表.md`: remove normative references to the retired card/state.
- `cards/catalog.json`: remove the `hyperactive_inherit_01` catalog entry.
- `cards/card-interaction-effects.ts`, `cards/card-interaction-detail-actions.ts`: remove retired detail text, effect tags, and target prompt.
- `game/card-effects/hyperactive-inherit.ts`: delete the retired UI bridge module after removing imports/registrations.
- `game/logic/cards/hyperactive.ts`: remove inherit-specific target collection, pending setup, apply function, raw event, and `INHERITED_HYPERACTIVE` marker handling while preserving other hyperactive cards.
- `game/logic/cards-internal/pending-selection-registry.ts`, `game/turn/action-phase/pre-placement-selection.ts`, `ui/bootstrap.ts`: remove pending dispatch/action plumbing for `hyperactive_inherit`.
- `game/logic/cards-internal/hand-manager.ts`, `game/logic/cards-internal/card-usage-prechecks.ts`, `game/cpu-decision.ts`, `game/cpu-decision-pending-score.ts`, `game/cpu-decision-plan-pressure.ts`, `game/ai/cpu-policy-*.ts`, `game/ai/commentary-data.ts`: remove CPU and usage policy references.
- `shared/evasion-status.ts`, `shared/special-stone-registry.ts`, `game/logic/cards-internal/capture-source.ts`, `game/logic/board_ops.ts`, `game/turn/presentation-helpers.ts`, `game/turn/pipeline-ui/log-mappers.ts`, `game/turn/pipeline-ui/selection-sound-cues.ts`, `game/turn/pipeline-ui/sound-cues.ts`, `ui/animation-engine.ts`, `ui/animation-move-events.ts`, `game/visual-effects-map.runtime.js`: remove `INHERITED_HYPERACTIVE` status/event/presentation support.
- `test/*hyperactive-inherit*`, pending/network/sound/UI tests containing `hyperactive_inherit_01`, `HYPERACTIVE_INHERIT_WILL`, `INHERITED_HYPERACTIVE`, `hyperactiveInheritTarget`, `hyperactive_inherit_selected`, `継承多動`, or `多動の継承`: delete retired-card tests or remove retired fixtures from broader tests.
- Generated/mirror outputs: `cards/catalog.ts`, `cards/catalog.js`, `cards/catalog.generated.js`, `public/module-registry.js`, `worker-public/*` are updated by scripts, not hand-edited first.

---

### Task 1: Preflight and Scope Lock

**Files:**
- Read: `AGENTS.md`
- Read: `cards/AGENTS.md`
- Read: `game/AGENTS.md`
- Read: `game/logic/AGENTS.md`
- Read: `game/logic/cards/AGENTS.md`
- Read: `game/logic/cards-internal/AGENTS.md`
- Read: `game/card-effects/AGENTS.md`
- Read: `game/turn/AGENTS.md`
- Read: `shared/AGENTS.md`
- Read: `ui/AGENTS.md`
- Read: `workers/AGENTS.md`
- Read: `docs/architecture-contracts.md`

- [ ] **Step 1: Capture dirty state**

Run:

```powershell
git status --short
```

Expected: A dirty tree may already exist. Classify existing changes as user/WIP, generated/mirror, related, or unknown before editing. Do not revert or stage unrelated files.

- [ ] **Step 2: Confirm all exact retired identifiers**

Run:

```powershell
rg -n "hyperactive_inherit_01|HYPERACTIVE_INHERIT_WILL|INHERITED_HYPERACTIVE|hyperactiveInheritTarget|hyperactive_inherit|hyperactive_inherit_selected|継承多動|多動の継承" cards game shared ui workers test scripts docs 正本 01-rulebook.md --glob "!worker-public/**" --glob "!dist/**"
```

Expected: Output identifies every root-source reference to remove or update.

- [ ] **Step 3: Confirm common hyperactive references that must remain**

Run:

```powershell
rg -n "HYPERACTIVE_WILL|INSTANT_HYPERACTIVE_WILL|EXTREME_HYPERACTIVE_WILL|ESCAPE_WILL|ULTIMATE_HYPERACTIVE_GOD|多動の意志|瞬間多動|極悪多動魔|逃げる意志|究極多動神" cards game shared ui workers test scripts docs 正本 01-rulebook.md --glob "!worker-public/**" --glob "!dist/**"
```

Expected: These references remain unless a line also specifically names the retired card/state.

---

### Task 2: Add a Retirement Guard Test

**Files:**
- Create or modify: `test/retired-card-references.test.ts`

- [ ] **Step 1: Write the failing test**

Create or update `test/retired-card-references.test.ts` with this complete test. If the file already exists, replace only the `多動の継承` block with the same identifier list and path filters.

```typescript
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');

const RETIRED_HYPERACTIVE_INHERIT_PATTERNS = [
  'hyperactive_inherit_01',
  'HYPERACTIVE_INHERIT_WILL',
  'INHERITED_HYPERACTIVE',
  'hyperactiveInheritTarget',
  'hyperactive_inherit',
  'hyperactive_inherit_selected',
  '継承多動',
  '多動の継承'
];

const SCAN_DIRS = [
  '01-rulebook.md',
  'cards',
  'game',
  'shared',
  'ui',
  'workers',
  'test',
  '正本'
];

const IGNORE_PATH_PARTS = [
  `${path.sep}node_modules${path.sep}`,
  `${path.sep}dist${path.sep}`,
  `${path.sep}worker-public${path.sep}`,
  `${path.sep}docs${path.sep}archive${path.sep}`,
  path.join('docs', 'superpowers', 'plans', '2026-06-04-remove-hyperactive-inherit-will-plan.md')
];

function walk(target: string): string[] {
  const abs = path.join(ROOT, target);
  if (!fs.existsSync(abs)) return [];
  const stat = fs.statSync(abs);
  if (stat.isFile()) return [abs];
  return fs.readdirSync(abs).flatMap((entry) => walk(path.join(target, entry)));
}

function isScannable(file: string): boolean {
  if (IGNORE_PATH_PARTS.some((part) => file.includes(part))) return false;
  return /\.(ts|js|json|md|html|css)$/.test(file);
}

describe('retired card reference guard', () => {
  test('多動の継承 identifiers are removed from active source and specs', () => {
    const hits: string[] = [];
    for (const target of SCAN_DIRS) {
      for (const file of walk(target).filter(isScannable)) {
        const text = fs.readFileSync(file, 'utf8');
        for (const pattern of RETIRED_HYPERACTIVE_INHERIT_PATTERNS) {
          if (text.includes(pattern)) {
            hits.push(`${path.relative(ROOT, file)} contains ${pattern}`);
          }
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/retired-card-references.test.ts
```

Expected: FAIL with hits for current `hyperactive_inherit_01`, `HYPERACTIVE_INHERIT_WILL`, `INHERITED_HYPERACTIVE`, `継承多動`, and `多動の継承` references.

---

### Task 3: Remove Player-Facing Spec and 正本 References

**Files:**
- Modify: `01-rulebook.md`
- Modify: `正本/カード仕様正本.md`
- Modify: `正本/演出正本.md`
- Modify: `正本/効果音対応表.md`

- [ ] **Step 1: Remove the retired card section from the rulebook**

Delete the whole `### 10.17.5 HYPERACTIVE_INHERIT_WILL（多動の継承）` section in `01-rulebook.md`. Keep surrounding sections in order and renumber only if this rulebook already uses manual sequential numbering consistently in the touched range.

- [ ] **Step 2: Remove retired state wording from rulebook lists**

Edit each active rulebook line containing `継承多動` or `多動の継承`:

```text
封鎖マス / 穴マス / 多動系 lists: remove 継承多動石 only.
追加トリガー専用シチュエーション: remove the 継承多動石 clause.
数字UI tab: remove 継承多動の残りターン from the list.
石上カウント / メタタグ: remove 継承多動-specific bullets.
移動音: remove 継承多動石 from the 多動系 examples.
guard_select mapping: remove 多動の継承 from the shared-use parenthetical.
Lv6 CPU policy: remove HYPERACTIVE_INHERIT_WILL and 多動の継承 from examples.
pending selfplay: remove HYPERACTIVE_INHERIT_WILL from the explicit pending examples.
```

- [ ] **Step 3: Remove 正本 references**

Make these exact removals:

```text
正本/カード仕様正本.md: delete the 多動の継承 row.
正本/演出正本.md: remove 多動の継承 from the 滑らかな1マス移動 examples.
正本/効果音対応表.md: remove 多動の継承 from guard_select examples and hyperactive_move examples.
```

- [ ] **Step 4: Run the guard test**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/retired-card-references.test.ts
```

Expected: Still FAIL, but active spec/正本 hits for `多動の継承` and `継承多動` are gone.

---

### Task 4: Remove Catalog and Card Help Surfaces

**Files:**
- Modify: `cards/catalog.json`
- Modify: `cards/card-interaction-effects.ts`
- Modify: `cards/card-interaction-detail-actions.ts`

- [ ] **Step 1: Remove the catalog entry**

Delete this object from `cards/catalog.json`:

```json
{
  "id": "hyperactive_inherit_01",
  "name_ja": "多動の継承",
  "type": "HYPERACTIVE_INHERIT_WILL"
}
```

Preserve valid JSON and the order of the remaining cards.

- [ ] **Step 2: Remove effect summary/detail/tags**

Remove these `HYPERACTIVE_INHERIT_WILL` properties from `cards/card-interaction-effects.ts`:

```typescript
HYPERACTIVE_INHERIT_WILL: '自分の石1つに多動を継承。10ターン、反転・破壊を各1回回避'
HYPERACTIVE_INHERIT_WILL: '対象は自分の通常石・特殊石。\n10ターンの間、両者ターン開始時に周囲の空きへ1マス移動する。\nターン開始移動で空きが無い場合は継承多動状態を解除して通常石に戻る。\n移動後に挟める列があれば反転する。\n反転対象時と破壊対象時に、それぞれ1回だけ空きマスへ移動して回避する。'
HYPERACTIVE_INHERIT_WILL: freezeCardEffectTags([flipEvasionTag(1), destroyEvasionTag(1), durationTurnsTag(10)])
```

- [ ] **Step 3: Remove the selection prompt**

Remove this property from `cards/card-interaction-detail-actions.ts`:

```typescript
HYPERACTIVE_INHERIT_WILL: '多動を継承する自分の石を選んでください'
```

- [ ] **Step 4: Run catalog/help tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/cards.catalog.test.ts test/cards.numeric-effect-tags.test.ts test/ui.card-detail-effect-tags.test.ts
```

Expected: Tests that still expect `HYPERACTIVE_INHERIT_WILL` fail. Remove those retired expectations in the next task.

---

### Task 5: Remove Pending Selection and UI Bridge

**Files:**
- Delete: `game/card-effects/hyperactive-inherit.ts`
- Modify: `game/logic/cards-internal/pending-selection-registry.ts`
- Modify: `game/turn/action-phase/pre-placement-selection.ts`
- Modify: `ui/bootstrap.ts`
- Modify tests that directly target the bridge.

- [ ] **Step 1: Remove pending registry entry**

Delete the `HYPERACTIVE_INHERIT_WILL` entry in `game/logic/cards-internal/pending-selection-registry.ts`, including:

```typescript
dispatchKey: 'hyperactive_inherit'
action: { policyMethod: 'chooseHyperactiveInheritTarget', field: 'hyperactiveInheritTarget' }
```

- [ ] **Step 2: Remove placement selection branch**

Delete the `pending.type === 'HYPERACTIVE_INHERIT_WILL'` branches in `game/turn/action-phase/pre-placement-selection.ts`, including use of `action.hyperactiveInheritTarget` and the raw event `hyperactive_inherit_selected`.

- [ ] **Step 3: Remove UI handler registration**

Remove this mapping from `ui/bootstrap.ts`:

```typescript
hyperactive_inherit: 'handleHyperactiveInheritSelection'
```

Remove any import or dependency wiring for `game/card-effects/hyperactive-inherit.ts`.

- [ ] **Step 4: Delete retired bridge test**

Delete `test/game.card-effects.hyperactive-inherit.test.ts`.

- [ ] **Step 5: Delete bridge module**

Delete `game/card-effects/hyperactive-inherit.ts` only after the references in Steps 1-3 are gone.

- [ ] **Step 6: Run pending/UI tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.pending-selection-flow.test.ts test/turn-manager.retry.test.ts
```

Expected: Failures only where retired fixture entries remain. Remove those retired fixture cases.

---

### Task 6: Remove Canonical Logic and Board State

**Files:**
- Modify: `game/logic/cards/hyperactive.ts`
- Modify: `game/logic/cards-internal/card-usage-prechecks.ts`
- Modify: `game/logic/cards-internal/hand-manager.ts`
- Modify: `game/logic/cards-internal/capture-source.ts`
- Modify: `game/logic/board_ops.ts`
- Modify: `shared/evasion-status.ts`
- Modify: `shared/special-stone-registry.ts`

- [ ] **Step 1: Remove card usage precheck**

Delete the `case 'HYPERACTIVE_INHERIT_WILL'` branch from `game/logic/cards-internal/card-usage-prechecks.ts`.

- [ ] **Step 2: Remove hand-manager target gating**

Delete both `HYPERACTIVE_INHERIT_WILL` checks that call `getHyperactiveInheritTargets` in `game/logic/cards-internal/hand-manager.ts`.

- [ ] **Step 3: Remove canonical inherit helpers**

In `game/logic/cards/hyperactive.ts`, remove inherit-only exports and internals:

```typescript
getHyperactiveInheritTargets
applyHyperactiveInheritWill
resolveHyperactiveInheritSelection
```

Also remove branches that create or inspect:

```typescript
type: 'HYPERACTIVE_INHERIT_WILL'
reason: 'hyperactive_inherit_selected'
type: 'INHERITED_HYPERACTIVE'
```

Keep common movement helpers used by `HYPERACTIVE`, `INSTANT_HYPERACTIVE`, `EXTREME_HYPERACTIVE`, `ESCAPE_HYPERACTIVE`, and `ULTIMATE_HYPERACTIVE`.

- [ ] **Step 4: Remove inherited capture/evasion metadata**

Remove `INHERITED_HYPERACTIVE` from:

```typescript
game/logic/cards-internal/capture-source.ts
shared/evasion-status.ts
shared/special-stone-registry.ts
```

- [ ] **Step 5: Remove board operation status handling**

In `game/logic/board_ops.ts`, remove `INHERITED_HYPERACTIVE` and `HYPERACTIVE_INHERIT_WILL` branches. Preserve handling for ordinary hyperactive, escape, instant, extreme, and ultimate hyperactive states.

- [ ] **Step 6: Delete retired canonical tests**

Delete `test/game.hyperactive-inherit-will.test.ts`.

- [ ] **Step 7: Run canonical tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.hyperactive-will.test.ts test/shared.evasion-status.test.ts test/shared.special-stone-registry.test.ts
```

Expected: Retired inherited cases fail until removed; remaining hyperactive tests pass.

---

### Task 7: Remove CPU Policy and Network Fixtures

**Files:**
- Modify: `game/cpu-decision.ts`
- Modify: `game/cpu-decision-pending-score.ts`
- Modify: `game/cpu-decision-plan-pressure.ts`
- Modify: `game/ai/commentary-data.ts`
- Modify: `game/ai/cpu-policy-card-profiles.ts`
- Modify: `game/ai/cpu-policy-card-type-flags.ts`
- Modify: `game/ai/cpu-policy-core.ts`
- Modify: `test/network.playback-event-assembly.contract.test.ts`
- Modify: `test/workers.match-pending-effect-id.test.ts`
- Modify: `test/workers.match-publish-idempotency.test.ts`

- [ ] **Step 1: Remove CPU target chooser**

Delete the `多動の継承 対象選択` helper in `game/cpu-decision.ts` and every call path that builds:

```typescript
{ hyperactiveInheritTarget: { row: target.row, col: target.col } }
```

- [ ] **Step 2: Remove CPU scoring/profile entries**

Remove every `HYPERACTIVE_INHERIT_WILL` entry from the CPU files listed above. If a list becomes empty or a helper only existed for this card, remove that helper too.

- [ ] **Step 3: Remove pending fixture fields**

In network/pending tests, remove retired fixture cases where:

```typescript
cardId: 'hyperactive_inherit_01'
pendingType: 'HYPERACTIVE_INHERIT_WILL'
actionKey: 'hyperactiveInheritTarget'
```

Keep generic serialization support only if another active card still uses the same field; otherwise remove `hyperactiveInheritTarget` from fixture action builders.

- [ ] **Step 4: Run CPU and network tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.cpu-policy-core.test.ts test/game.cpu-policy-retention-score.test.ts test/network.playback-event-assembly.contract.test.ts test/workers.match-pending-effect-id.test.ts test/workers.match-publish-idempotency.test.ts
```

Expected: No retired-card failures remain.

---

### Task 8: Remove Presentation, Sound, and Animation State Support

**Files:**
- Modify: `game/turn/presentation-helpers.ts`
- Modify: `game/turn/pipeline-ui/log-mappers.ts`
- Modify: `game/turn/pipeline-ui/selection-sound-cues.ts`
- Modify: `game/turn/pipeline-ui/sound-cues.ts`
- Modify: `ui/animation-engine.ts`
- Modify: `ui/animation-move-events.ts`
- Modify: `game/visual-effects-map.runtime.js`
- Modify UI/presentation tests containing retired identifiers.

- [ ] **Step 1: Remove raw event presentation**

Delete branches for:

```typescript
ev.type === 'hyperactive_inherit_selected'
```

from `game/turn/presentation-helpers.ts`.

- [ ] **Step 2: Remove log and sound mappings**

Remove:

```typescript
INHERITED_HYPERACTIVE -> 継承多動石
hyperactive_inherit_selected -> guard_select
```

from `game/turn/pipeline-ui/log-mappers.ts`, `game/turn/pipeline-ui/selection-sound-cues.ts`, and `game/turn/pipeline-ui/sound-cues.ts`.

- [ ] **Step 3: Remove animation cause/status support**

Remove `HYPERACTIVE_INHERIT_WILL` and `INHERITED_HYPERACTIVE` handling from `ui/animation-engine.ts`, `ui/animation-move-events.ts`, and `game/visual-effects-map.runtime.js`.

- [ ] **Step 4: Remove retired UI expectations**

Remove test cases that expect:

```typescript
'inherited_hyperactive_move'
'継承多動石'
'継承多動の残りターン'
```

from UI/presentation tests.

- [ ] **Step 5: Run presentation tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.pipeline-ui-adapter.sound-cue.test.ts test/ui.animation-engine.guard-timer.test.ts test/ui.long-press-info.test.ts test/ui.rules-help-panel.test.ts
```

Expected: Remaining presentation tests pass without retired identifiers.

---

### Task 9: Regenerate Catalog and Browser Assets

**Files:**
- Generated by command: `cards/catalog.ts`
- Generated by command: `cards/catalog.js`
- Generated by command: `cards/catalog.generated.js`
- Generated by command: `public/module-registry.js`
- Generated by command: browser build outputs, if produced by existing scripts.

- [ ] **Step 1: Regenerate card catalog**

Run:

```powershell
npm run generate:catalog
```

Expected: `cards/catalog.ts`, `cards/catalog.js`, and `cards/catalog.generated.js` no longer contain `hyperactive_inherit_01` or `HYPERACTIVE_INHERIT_WILL`.

- [ ] **Step 2: Build browser runtime**

Run:

```powershell
npm run build:browser
```

Expected: Browser-loaded generated assets no longer contain retired identifiers.

- [ ] **Step 3: Run worker mirror sync**

Run:

```powershell
npm run worker:prepare
```

Expected: `worker-public/` mirrors root output and no longer contains retired identifiers except historical docs if the script copies them.

---

### Task 10: Final Search and Verification Bundle

**Files:**
- Verify all touched files.

- [ ] **Step 1: Run retired identifier search**

Run:

```powershell
rg -n "hyperactive_inherit_01|HYPERACTIVE_INHERIT_WILL|INHERITED_HYPERACTIVE|hyperactiveInheritTarget|hyperactive_inherit|hyperactive_inherit_selected|継承多動|多動の継承" . --glob "!node_modules/**" --glob "!dist/**" --glob "!docs/archive/**"
```

Expected: No active-source hits. Hits in this plan file are acceptable until the guard test excludes it. If generated or worker hits remain, rerun Task 9.

- [ ] **Step 2: Run focused test bundle**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/retired-card-references.test.ts test/cards.catalog.test.ts test/cards.numeric-effect-tags.test.ts test/ui.card-detail-effect-tags.test.ts test/game.pending-selection-flow.test.ts test/turn-manager.retry.test.ts test/game.hyperactive-will.test.ts test/shared.evasion-status.test.ts test/shared.special-stone-registry.test.ts test/game.cpu-policy-core.test.ts test/game.cpu-policy-retention-score.test.ts test/network.playback-event-assembly.contract.test.ts test/workers.match-pending-effect-id.test.ts test/workers.match-publish-idempotency.test.ts test/game.pipeline-ui-adapter.sound-cue.test.ts test/ui.animation-engine.guard-timer.test.ts test/ui.long-press-info.test.ts test/ui.rules-help-panel.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run architecture boundary check**

Run:

```powershell
npm run check:window
```

Expected: PASS; removal did not add UI/global dependencies to headless layers.

- [ ] **Step 4: Run broader checks**

Run:

```powershell
npm run typecheck
npm run build:ts
npm run test:network:parity
```

Expected: PASS. If `test:network:parity` fails only due to already-dirty unrelated work, record exact failing test names and diff files before deciding whether to commit.

---

### Task 11: Diff Review, Staging, and Commit

**Files:**
- Stage only files intentionally changed for this retirement.

- [ ] **Step 1: Inspect status**

Run:

```powershell
git status --short
```

Expected: Many unrelated pre-existing changes may still be present. Identify only files changed by this plan.

- [ ] **Step 2: Inspect retired-card diff**

Run targeted diffs for intended files:

```powershell
git diff -- 01-rulebook.md cards game shared ui workers test 正本 public worker-public
```

Expected: Diffs remove only `多動の継承` / `HYPERACTIVE_INHERIT_WILL` / `INHERITED_HYPERACTIVE` behavior and generated fallout. No unrelated behavior is added.

- [ ] **Step 3: Stage only the retirement changes**

Use explicit paths. Do not run `git add -A`.

```powershell
git add 01-rulebook.md cards/catalog.json cards/catalog.ts cards/catalog.js cards/catalog.generated.js cards/card-interaction-effects.ts cards/card-interaction-detail-actions.ts
git add game/card-effects/hyperactive-inherit.ts game/logic/cards/hyperactive.ts game/logic/cards-internal/card-usage-prechecks.ts game/logic/cards-internal/hand-manager.ts game/logic/cards-internal/pending-selection-registry.ts game/logic/cards-internal/capture-source.ts game/logic/board_ops.ts
git add game/cpu-decision.ts game/cpu-decision-pending-score.ts game/cpu-decision-plan-pressure.ts game/ai/commentary-data.ts game/ai/cpu-policy-card-profiles.ts game/ai/cpu-policy-card-type-flags.ts game/ai/cpu-policy-core.ts
git add game/turn/action-phase/pre-placement-selection.ts game/turn/presentation-helpers.ts game/turn/pipeline-ui/log-mappers.ts game/turn/pipeline-ui/selection-sound-cues.ts game/turn/pipeline-ui/sound-cues.ts game/visual-effects-map.runtime.js
git add shared/evasion-status.ts shared/special-stone-registry.ts ui/bootstrap.ts ui/animation-engine.ts ui/animation-move-events.ts
git add test/retired-card-references.test.ts test/cards.numeric-effect-tags.test.ts test/game.pending-selection-flow.test.ts test/turn-manager.retry.test.ts test/shared.evasion-status.test.ts test/shared.special-stone-registry.test.ts test/game.cpu-policy-core.test.ts test/game.cpu-policy-retention-score.test.ts test/network.playback-event-assembly.contract.test.ts test/workers.match-pending-effect-id.test.ts test/workers.match-publish-idempotency.test.ts test/game.pipeline-ui-adapter.sound-cue.test.ts test/ui.animation-engine.guard-timer.test.ts test/ui.long-press-info.test.ts test/ui.rules-help-panel.test.ts
git add 正本/カード仕様正本.md 正本/演出正本.md 正本/効果音対応表.md public/module-registry.js worker-public
git add -u test/game.card-effects.hyperactive-inherit.test.ts test/game.hyperactive-inherit-will.test.ts
```

If any listed path was not touched or does not exist after deletion, omit it from staging.

- [ ] **Step 4: Verify staged diff**

Run:

```powershell
git diff --cached --stat
git diff --cached --check
```

Expected: Only retirement-related files are staged; `git diff --cached --check` reports no whitespace errors.

- [ ] **Step 5: Commit**

Run:

```powershell
git commit -m "remove hyperactive inherit will"
```

Expected: Commit succeeds. Report any unrelated dirty files that remain unstaged.

---

## Self-Review

- Spec coverage: The plan removes the catalog card, behavior, pending flow, CPU policy, presentation/sound/UI text, rulebook/正本 text, tests, generated browser assets, and worker mirror.
- Placeholder scan: No task contains unresolved placeholder wording; commands and exact identifiers are listed.
- Type consistency: The retired identifiers are consistently `hyperactive_inherit_01`, `HYPERACTIVE_INHERIT_WILL`, `INHERITED_HYPERACTIVE`, `hyperactiveInheritTarget`, `hyperactive_inherit`, `hyperactive_inherit_selected`, `継承多動`, and `多動の継承`.
