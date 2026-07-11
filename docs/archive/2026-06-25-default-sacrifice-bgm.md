# Default Sacrifice BGM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `犠牲のテーマ` (`assets/audio/bgm/sacrifice.mp3`) the startup default BGM.

**Architecture:** The sound engine already owns startup BGM state through `currentTrackIndex` and already includes `犠牲のテーマ` in `playlist` with `loopEnd = 40`. The implementation keeps playlist order stable, updates the default index, updates source-of-truth docs and focused expectations, then regenerates browser/worker outputs through existing scripts.

**Tech Stack:** TypeScript, Jest, existing npm build scripts, generated browser registry, worker-public mirror.

---

## File Structure

- Modify `01-rulebook.md`: update BGM spec lines in section 20 so the startup default is `assets/audio/bgm/sacrifice.mp3`.
- Modify `sound-engine.ts`: change `currentTrackIndex` from `0` to `6`.
- Modify `test/sound-engine.default-bgm.test.ts`: update the focused default-track assertion from `c-reversi` to `犠牲のテーマ`.
- Regenerate `dist/sound-engine.js`, `public/module-registry.js`, `public/module-registry.optional.js`, `worker-public/public/module-registry.js`, and `worker-public/public/module-registry.optional.js` with existing scripts.

### Task 1: Default Track Regression

**Files:**
- Modify: `test/sound-engine.default-bgm.test.ts`

- [ ] **Step 1: Update the focused test expectation**

Change the test name and default-track assertions:

```ts
  test('startup default track points to 犠牲のテーマ', () => {
    const soundEngine = loadSoundEngine();

    expect(soundEngine.playlist).toHaveLength(7);
    expect(soundEngine.playlist.map((track) => track.name)).toEqual([
      'c-reversi',
      'c-reversi-2',
      '盤喰いの小鬼戦',
      '幻想即興曲',
      'ノクターン',
      'The Observer’s Tears',
      '犠牲のテーマ'
    ]);
    expect(soundEngine.currentTrackIndex).toBe(6);
    expect(soundEngine.playlist[soundEngine.currentTrackIndex]).toEqual({
      name: '犠牲のテーマ',
      file: 'assets/audio/bgm/sacrifice.mp3',
      loopEnd: 40
    });
```

- [ ] **Step 2: Run the focused test before implementation**

Run: `npm run build:ts && npx jest test/sound-engine.default-bgm.test.ts --runInBand --testNamePattern="startup default track points"`

Expected: FAIL because `currentTrackIndex` is still `0`.

### Task 2: Runtime And Rulebook Default

**Files:**
- Modify: `sound-engine.ts`
- Modify: `01-rulebook.md`

- [ ] **Step 1: Update the runtime default index**

Change:

```ts
    currentTrackIndex: 0,
```

to:

```ts
    currentTrackIndex: 6,
```

- [ ] **Step 2: Update the rulebook default BGM text**

Change the section 20 BGM bullets so they state:

```md
- 起動時の既定BGMは `assets/audio/bgm/sacrifice.mp3`（犠牲のテーマ）を使用する
- `assets/audio/bgm/sacrifice.mp3`（犠牲のテーマ）は `120 BPM`、4拍子、20小節ぶん全体をループし、`loopEnd = 40` とする（ループ時も曲頭へ戻る）
```

Remove the old `起動時の既定BGMにはしない` sentence from the sacrifice bullet.

- [ ] **Step 3: Run the focused test after implementation**

Run: `npm run build:ts && npx jest test/sound-engine.default-bgm.test.ts --runInBand --testNamePattern="startup default track points"`

Expected: PASS.

### Task 3: Generated Output Sync

**Files:**
- Modify: `public/module-registry.js`
- Modify: `public/module-registry.optional.js`
- Modify: `worker-public/public/module-registry.js`
- Modify: `worker-public/public/module-registry.optional.js`

- [ ] **Step 1: Regenerate browser and worker outputs**

Run: `npm run build:browser`

Expected: `public/module-registry.js` and `public/module-registry.optional.js` are updated from `dist`.

Run: `npm run worker:prepare`

Expected: worker assets are checked and `worker-public/public/module-registry.js` plus `worker-public/public/module-registry.optional.js` mirror the generated browser registry.

- [ ] **Step 2: Run focused sync coverage**

Run: `npx jest test/sound-engine.default-bgm.test.ts test/sound-engine.bundle-sync.test.ts --runInBand`

Expected: PASS.

### Task 4: Diff Review And Commit

**Files:**
- Inspect: all modified files

- [ ] **Step 1: Inspect task diffs**

Run: `git diff -- 01-rulebook.md sound-engine.ts test/sound-engine.default-bgm.test.ts public/module-registry.js public/module-registry.optional.js worker-public/public/module-registry.js worker-public/public/module-registry.optional.js`

Expected: only the default BGM source/spec/test/generated changes for this task are selected for staging. Pre-existing unrelated dirty hunks remain unstaged.

- [ ] **Step 2: Stage only task files or hunks**

Run specific `git add` commands for clean files. For files with pre-existing unrelated diffs, stage only the BGM default hunks with an index patch.

- [ ] **Step 3: Commit the implementation**

Run: `git commit -m "Make sacrifice theme the default BGM"`

Expected: commit succeeds if the task diff can be separated from unrelated working-tree changes. If it cannot be separated safely, leave the implementation uncommitted and report the exact files that blocked staging.
