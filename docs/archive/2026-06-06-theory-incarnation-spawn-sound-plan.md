# Theory Incarnation Spawn Sound Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Play a dedicated roulette-start sound effect when `理論の化身` spawns a special stone from a theory number cell.

**Architecture:** Keep the canonical theory spawn result headless. The existing playback mapper already converts theory spawn metadata into `theory_incarnation_spawn_roulette`; the sound cue planner should attach a `sound_effect` cue with key `theory_incarnation_spawn` to that playback phase. `SoundEngine` maps that key to the copied mp3 under `assets/audio/sound-effect/`. The roulette animation uses a MIDI-aligned 2.5 second / 19 step fixed timeline.

**Tech Stack:** TypeScript, Jest, existing pipeline UI adapter sound cue system, existing SoundEngine effect sound registry.

---

### Task 1: RED Tests

**Files:**
- Modify: `test/game.pipeline-ui-adapter.sound-cue.test.ts`
- Modify: `test/sound-engine.default-bgm.test.ts`

- [ ] **Step 1: Add theory spawn cue test**

Add a test that calls `adapter.appendSoundEffectPlaybackEvents` with a base event:

```ts
{
  type: 'theory_incarnation_spawn_roulette',
  phase: 7,
  targets: [{ row: 2, col: 3, cause: 'THEORY_INCARNATION', reason: 'theory_incarnation_spawn' }]
}
```

Assert the result contains:

```ts
expect.objectContaining({
  type: 'sound_effect',
  phase: 7,
  targets: [expect.objectContaining({ soundKey: 'theory_incarnation_spawn' })]
})
```

- [ ] **Step 2: Add sound registry test**

In `test/sound-engine.default-bgm.test.ts`, assert:

```ts
expect(soundEngine.effectSoundFiles.theory_incarnation_spawn).toBe('理論の化身のルーレットの開始タイミング.mp3');
expect(soundEngine.getEffectFilePath('theory_incarnation_spawn')).toBe('assets/audio/sound-effect/理論の化身のルーレットの開始タイミング.mp3');
```

- [ ] **Step 3: Run RED tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/game.pipeline-ui-adapter.sound-cue.test.ts test/sound-engine.default-bgm.test.ts
```

Expected before implementation: FAIL because `theory_incarnation_spawn` is not registered and no cue is emitted.

### Task 2: Implementation

**Files:**
- Create/copy: `assets/audio/sound-effect/理論の化身のルーレットの開始タイミング.mp3`
- Modify: `sound-engine.ts`
- Modify: `game/turn/pipeline-ui/core-sound-cues.ts`
- Modify: `01-rulebook.md`
- Modify: `正本/効果音対応表.md`

- [ ] **Step 1: Copy asset**

Copy:

```powershell
Copy-Item -LiteralPath 'C:\Users\quarr\Documents\Studio One\Songs\2026-06-06 qt qt\Mixdown\理論の化身のルーレットの開始タイミング.mp3' -Destination 'assets\audio\sound-effect\理論の化身のルーレットの開始タイミング.mp3'
```

- [ ] **Step 2: Register SoundEngine key**

In `sound-engine.ts`, add:

```ts
theory_incarnation_spawn: '理論の化身のルーレットの開始タイミング.mp3',
```

to `effectSoundFiles`.

- [ ] **Step 3: Emit playback sound cue**

In `game/turn/pipeline-ui/core-sound-cues.ts`, detect base events with `type === 'theory_incarnation_spawn_roulette'` and push `theory_incarnation_spawn` at the matching phase.

- [ ] **Step 4: Update specifications**

Update `01-rulebook.md` and `正本/効果音対応表.md` to document that the theory number cell special-stone appearance uses `theory_incarnation_spawn`.

### Task 3: GREEN Verification And Mirrors

**Files:**
- Generated/mirror: `dist/*`, `public/module-registry.js`, `worker-public/*`

- [ ] **Step 1: Run focused GREEN tests**

```powershell
npx jest --runInBand --runTestsByPath test/game.pipeline-ui-adapter.sound-cue.test.ts test/sound-engine.default-bgm.test.ts test/game.pipeline-ui-adapter.spawn.test.ts test/ui.theory-incarnation-animation.test.ts
```

- [ ] **Step 2: Run build checks**

```powershell
npm run typecheck
npm run build:ts
```

- [ ] **Step 3: Prepare worker mirror**

```powershell
npm run worker:prepare
```

Restore unrelated dated asset-manifest churn if no actual asset list change is required outside the new mp3.

- [ ] **Step 4: Commit**

Stage only intentional source, tests, copied asset, generated runtime/mirror files, and docs. Commit:

```powershell
git commit -m "Add theory spawn sound effect"
```
