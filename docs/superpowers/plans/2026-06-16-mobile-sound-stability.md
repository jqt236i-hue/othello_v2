# Mobile Sound Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make browser-version effect sounds stable on mobile by unlocking audio on a real user gesture and playing game SFX through cached Web Audio buffers with the existing HTMLAudio pool as fallback.

**Architecture:** Keep canonical gameplay and playback ordering unchanged. `sound-engine.ts` remains the single audio consumer, but gains a small Web Audio SFX path: explicit unlock, staged effect-buffer warmup, buffer playback, diagnostics, and fallback. UI boot only installs the unlock listener; animation/card/game layers continue calling `SoundEngine.playEffectByKey(key)`.

**Tech Stack:** TypeScript, browser Web Audio API, existing `HTMLAudioElement` fallback, Jest VM-based sound-engine tests, existing TypeScript build.

---

## Current Constraints

- Start by running `git status --short`. The checkout may already contain unrelated changes in `01-rulebook.md`, `cards/card-interaction.ts`, styles, `worker-public/`, deleted `artifacts/`, and `sound-engine.ts`.
- Treat `sound-engine.ts` and `test/sound-engine.default-bgm.test.ts` as related only after inspecting their current diff. At plan time, `sound-engine.ts` had a BGM volume-only dirty change; do not revert it.
- Do not edit `worker-public/` by hand. If implementation changes built browser assets or mirror output, run `npm run worker:prepare` and include generated mirror changes only if they are produced by that script and required by the current task.
- This is a playback infrastructure change, not a rules/card behavior change. Do not change `01-rulebook.md` or `正本/` unless the intended player-visible timing or sound mapping changes.

## File Map

- Modify `sound-engine.ts`
  - Add Web Audio SFX state and helper methods.
  - Add explicit user-gesture unlock API.
  - Add staged critical/all effect buffer priming.
  - Route `playEffectByKey()` through Web Audio first, then HTMLAudio fallback.
  - Add diagnostics for mobile debugging.
- Modify `ui/handlers/init.ts`
  - Install the sound-engine user-gesture unlock listener during boot.
  - Stop doing heavy SFX warmup at page initialization before a gesture.
- Modify `test/sound-engine.default-bgm.test.ts`
  - Extend mocks for `AudioContext` buffer playback.
  - Add focused tests for unlock, buffer decode/cache, Web Audio playback, fallback, diagnostics, and boot behavior.
- Optional generated output after verification
  - `dist/sound-engine.js`, `dist/ui/handlers/init.js`, and `worker-public/*` may change only through existing build/mirror commands.

---

### Task 1: Add Tests For Explicit Audio Unlock

**Files:**
- Modify: `test/sound-engine.default-bgm.test.ts`
- Implementation target: `sound-engine.ts`

- [ ] **Step 1: Inspect existing dirty diff**

Run:

```powershell
git diff -- sound-engine.ts test/sound-engine.default-bgm.test.ts ui/handlers/init.ts
```

Expected: understand any pre-existing edits before adding tests. Do not revert user work.

- [ ] **Step 2: Extend the mock AudioContext with buffer playback assertions**

In `test/sound-engine.default-bgm.test.ts`, update `createMockAudioContext()` so `createBufferSource()` supports `buffer`, `connect`, `start`, `stop`, and records all sources. Keep existing BGM tests passing.

Use this source object shape:

```ts
createBufferSource() {
  const source = {
    buffer: null,
    loop: false,
    loopStart: 0,
    loopEnd: 0,
    connect: jest.fn(),
    disconnect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn()
  };
  sources.push(source);
  return source;
}
```

- [ ] **Step 3: Add failing unlock test**

Add this test near the default BGM tests:

```ts
test('unlockAudio resumes AudioContext and plays a silent buffer once', async () => {
  const { context, sources } = createMockAudioContext();
  context.state = 'suspended';
  context.resume = jest.fn(async () => {
    context.state = 'running';
  });
  const soundEngine = loadSoundEngine();
  soundEngine.ctx = context;

  await expect(soundEngine.unlockAudio()).resolves.toBe(true);

  expect(context.resume).toHaveBeenCalledTimes(1);
  expect(sources).toHaveLength(1);
  expect(sources[0].start).toHaveBeenCalledWith(0);
  expect(soundEngine.isAudioUnlocked()).toBe(true);
});
```

- [ ] **Step 4: Run test to verify it fails**

Run:

```powershell
npm run build:ts
npm run test:jest -- --runTestsByPath test/sound-engine.default-bgm.test.ts -t "unlockAudio resumes AudioContext"
```

Expected: FAIL because `unlockAudio` and `isAudioUnlocked` do not exist yet.

---

### Task 2: Implement Explicit Unlock API

**Files:**
- Modify: `sound-engine.ts`
- Test: `test/sound-engine.default-bgm.test.ts`

- [ ] **Step 1: Add unlock state to `SoundEngine`**

In `sound-engine.ts`, add these properties near the existing sound-engine state:

```ts
    _audioUnlocked: false,
    _audioUnlockPromise: null as Promise<boolean> | null,
```

- [ ] **Step 2: Add silent-buffer unlock helpers**

Add these methods before `_resolveBgmTrack()`:

```ts
    isAudioUnlocked() {
        return this._audioUnlocked === true;
    },

    _createSilentUnlockBuffer(ctx: AudioContext) {
        if (!ctx || typeof ctx.createBuffer !== 'function') return null;
        const sampleRate = Number((ctx as any).sampleRate) || 44100;
        const frameCount = Math.max(1, Math.floor(sampleRate / 1000));
        return ctx.createBuffer(1, frameCount, sampleRate);
    },

    _playSilentUnlockBuffer(ctx: AudioContext) {
        if (!ctx || typeof ctx.createBufferSource !== 'function') return false;
        const buffer = this._createSilentUnlockBuffer(ctx);
        if (!buffer) return false;
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
        return true;
    },

    async unlockAudio() {
        if (this._audioUnlocked === true) return true;
        if (this._audioUnlockPromise) return this._audioUnlockPromise;
        this._audioUnlockPromise = Promise.resolve().then(async () => {
            const ctx = this._ensureAudioContext(false);
            if (!ctx) return false;
            try {
                if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
                    await ctx.resume();
                }
            } catch (e) {
                return false;
            }
            try {
                this._playSilentUnlockBuffer(ctx);
            } catch (e) { /* ignore */ }
            this._audioUnlocked = !ctx.state || ctx.state === 'running';
            return this._audioUnlocked;
        }).finally(() => {
            this._audioUnlockPromise = null;
        });
        return this._audioUnlockPromise;
    },
```

- [ ] **Step 3: Keep `_ensureAudioContext()` from assuming resume succeeded**

Update `_ensureAudioContext(resumeIfSuspended = false)` so it does not mark `_audioUnlocked`. Leave the existing `ctx.resume()` call for BGM compatibility, but make unlock state explicit:

```ts
        if (resumeIfSuspended && this.ctx && this.ctx.state === 'suspended') {
            try { this.ctx.resume(); } catch (e) { /* ignore */ }
        }
```

- [ ] **Step 4: Run focused unlock test**

Run:

```powershell
npm run build:ts
npm run test:jest -- --runTestsByPath test/sound-engine.default-bgm.test.ts -t "unlockAudio resumes AudioContext"
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1-2 if isolated**

Only if no unrelated file would be staged:

```powershell
git add sound-engine.ts test/sound-engine.default-bgm.test.ts
git commit -m "Add explicit audio unlock API"
```

If pre-existing dirty edits in these files cannot be separated, do not commit; report the exact conflict.

---

### Task 3: Add Web Audio Effect Buffer Cache Tests

**Files:**
- Modify: `test/sound-engine.default-bgm.test.ts`
- Implementation target: `sound-engine.ts`

- [ ] **Step 1: Add a successful fetch/decode test**

Add:

```ts
test('playEffectByKey uses cached Web Audio buffers after unlock', async () => {
  const { context, sources, gains } = createMockAudioContext();
  context.state = 'running';
  const decodedBuffer = { duration: 0.25 };
  context.decodeAudioData = jest.fn(async () => decodedBuffer);
  const fetchMock = jest.fn(async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(8)
  }));
  const { MockAudio, instances } = createMockHtmlAudioClass();
  const soundEngine = loadSoundEngine({ Audio: MockAudio, fetch: fetchMock });
  soundEngine.ctx = context;

  await soundEngine.unlockAudio();
  await soundEngine.primeCriticalEffectSounds();
  expect(soundEngine.playEffectByKey('hand_card_select')).toBe(true);
  expect(soundEngine.playEffectByKey('hand_card_select')).toBe(true);

  const effectPath = soundEngine.getEffectFilePath('hand_card_select');
  expect(fetchMock).toHaveBeenCalledWith(effectPath);
  expect(context.decodeAudioData).toHaveBeenCalledTimes(1);
  expect(sources.filter((source) => source.buffer === decodedBuffer)).toHaveLength(2);
  expect(gains.length).toBeGreaterThanOrEqual(2);
  expect(instances.filter((audio) => audio.src === effectPath && audio.play.mock.calls.length > 0)).toHaveLength(0);
});
```

- [ ] **Step 2: Add pending-buffer fallback test**

Add:

```ts
test('playEffectByKey falls back to HTMLAudio while effect buffer is still loading', async () => {
  const { context } = createMockAudioContext();
  context.state = 'running';
  let resolveArrayBuffer;
  const fetchMock = jest.fn(async () => ({
    ok: true,
    arrayBuffer: () => new Promise((resolve) => {
      resolveArrayBuffer = resolve;
    })
  }));
  const { MockAudio, instances } = createMockHtmlAudioClass();
  const soundEngine = loadSoundEngine({ Audio: MockAudio, fetch: fetchMock });
  soundEngine.ctx = context;

  await soundEngine.unlockAudio();
  const loadPromise = soundEngine.primeEffectBuffer('card_use_button');
  expect(soundEngine.playEffectByKey('card_use_button')).toBe(true);

  const effectPath = soundEngine.getEffectFilePath('card_use_button');
  const htmlAudio = instances.find((audio) => audio.src === effectPath);
  expect(htmlAudio.play).toHaveBeenCalledTimes(1);

  resolveArrayBuffer(new ArrayBuffer(8));
  await loadPromise;
});
```

- [ ] **Step 3: Add fetch/decode failure diagnostics test**

Add:

```ts
test('effect buffer load failures are reported in diagnostics and HTMLAudio fallback still plays', async () => {
  const { context } = createMockAudioContext();
  context.state = 'running';
  const fetchMock = jest.fn(async () => ({ ok: false, status: 404 }));
  const { MockAudio, instances } = createMockHtmlAudioClass();
  const soundEngine = loadSoundEngine({ Audio: MockAudio, fetch: fetchMock });
  soundEngine.ctx = context;

  await soundEngine.unlockAudio();
  await expect(soundEngine.primeEffectBuffer('stone_destroy')).resolves.toBe(false);
  expect(soundEngine.playEffectByKey('stone_destroy')).toBe(true);

  const effectPath = soundEngine.getEffectFilePath('stone_destroy');
  expect(instances.find((audio) => audio.src === effectPath).play).toHaveBeenCalledTimes(1);
  expect(soundEngine.getDiagnostics().lastEffectFailures[effectPath]).toMatch(/404/);
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run:

```powershell
npm run build:ts
npm run test:jest -- --runTestsByPath test/sound-engine.default-bgm.test.ts -t "Web Audio buffers|still loading|diagnostics"
```

Expected: FAIL because `primeCriticalEffectSounds`, `primeEffectBuffer`, and diagnostics do not exist.

---

### Task 4: Implement Web Audio Effect Buffer Path

**Files:**
- Modify: `sound-engine.ts`
- Test: `test/sound-engine.default-bgm.test.ts`

- [ ] **Step 1: Add Web Audio SFX state**

Add near effect pool state:

```ts
    _effectBufferCache: {} as Record<string, AudioBuffer>,
    _effectBufferPromises: {} as Record<string, Promise<AudioBuffer | null>>,
    _criticalEffectKeys: ['stone_place', 'hand_card_select', 'card_use_button', 'special_card_use', 'treasure_gain'],
    _lastEffectFailures: {} as Record<string, string>,
```

- [ ] **Step 2: Add buffer capability and diagnostics helpers**

Add before `_canCreateEffectAudioElement()`:

```ts
    _canUseWebAudioEffects() {
        if (typeof fetch !== 'function') return false;
        const ctx = this.ctx || this._ensureAudioContext(false);
        return !!(
            ctx &&
            typeof ctx.createBufferSource === 'function' &&
            typeof ctx.createGain === 'function' &&
            typeof ctx.decodeAudioData === 'function'
        );
    },

    _recordEffectFailure(filePath: string, reason: any) {
        const key = String(filePath || '').trim();
        if (!key) return;
        const message = reason && reason.message ? reason.message : String(reason || 'unknown failure');
        this._lastEffectFailures[key] = message;
    },

    getDiagnostics() {
        const ctx = this.ctx || null;
        return {
            audioUnlocked: this._audioUnlocked === true,
            audioContextState: ctx && ctx.state ? ctx.state : null,
            effectBufferCount: Object.keys(this._effectBufferCache || {}).length,
            pendingEffectBufferCount: Object.keys(this._effectBufferPromises || {}).length,
            htmlEffectPoolCount: Object.keys(this._effectAudioPools || {}).length,
            lastEffectFailures: Object.assign({}, this._lastEffectFailures || {})
        };
    },
```

- [ ] **Step 3: Add `primeEffectBuffer()`**

Add after `getEffectFilePath()`:

```ts
    primeEffectBuffer(effectKey: string, options: any = {}) {
        const key = String(effectKey || '').trim();
        const opts = options && typeof options === 'object' ? options : {};
        const filePath = this.getEffectFilePath(key, opts);
        if (!filePath || !this._canUseWebAudioEffects()) return Promise.resolve(false);
        if (this._effectBufferCache[filePath]) return Promise.resolve(true);
        if (this._effectBufferPromises[filePath]) {
            return this._effectBufferPromises[filePath].then((buffer) => !!buffer);
        }
        const ctx = this.ctx || this._ensureAudioContext(false);
        if (!ctx) return Promise.resolve(false);
        const loadPromise = fetch(filePath)
            .then((response: any) => {
                if (!response || response.ok !== true) {
                    const status = response && response.status ? response.status : 'unknown';
                    throw new Error(`HTTP ${status}`);
                }
                return response.arrayBuffer();
            })
            .then((arrayBuffer: ArrayBuffer) => ctx.decodeAudioData(arrayBuffer))
            .then((buffer: AudioBuffer) => {
                if (buffer) {
                    this._effectBufferCache[filePath] = buffer;
                }
                return buffer || null;
            })
            .catch((error: any) => {
                this._recordEffectFailure(filePath, error);
                return null;
            })
            .finally(() => {
                delete this._effectBufferPromises[filePath];
            });
        this._effectBufferPromises[filePath] = loadPromise;
        return loadPromise.then((buffer) => !!buffer);
    },
```

- [ ] **Step 4: Add critical/all priming helpers**

Add after `primeEffectBuffer()`:

```ts
    primeCriticalEffectSounds() {
        const keys = Array.isArray(this._criticalEffectKeys) ? this._criticalEffectKeys : [];
        return Promise.all(keys.map((key) => this.primeEffectBuffer(key))).then((results) => results.filter(Boolean).length);
    },

    primeRemainingEffectSounds() {
        const critical = new Set(Array.isArray(this._criticalEffectKeys) ? this._criticalEffectKeys : []);
        const keys = Object.keys(this.effectSoundFiles || {}).filter((key) => !critical.has(key));
        let chain = Promise.resolve(0);
        keys.forEach((key) => {
            chain = chain.then((count) => this.primeEffectBuffer(key).then((loaded) => count + (loaded ? 1 : 0)));
        });
        return chain;
    },
```

- [ ] **Step 5: Add Web Audio playback helper**

Add before `playEffectByKey()`:

```ts
    _playEffectBuffer(filePath: string, volume: number) {
        const ctx = this.ctx || this._ensureAudioContext(false);
        const buffer = filePath ? this._effectBufferCache[filePath] : null;
        if (!ctx || !buffer || ctx.state !== 'running') return false;
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gainNode = ctx.createGain();
        if (gainNode.gain && typeof gainNode.gain.setValueAtTime === 'function') {
            gainNode.gain.setValueAtTime(this._clamp01(volume), Number(ctx.currentTime) || 0);
        } else if (gainNode.gain && 'value' in gainNode.gain) {
            gainNode.gain.value = this._clamp01(volume);
        }
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        source.start(0);
        return true;
    },
```

- [ ] **Step 6: Route `playEffectByKey()` through Web Audio first**

In `playEffectByKey()`, replace the block after volume resolution with:

```ts
        if (key === 'special_card_use') {
            this._muteBgmForSpecialCardUse();
        }

        if (this._canUseWebAudioEffects()) {
            if (this._playEffectBuffer(filePath, effectVolume * (this.isMuted ? 0 : 1))) {
                return true;
            }
            if (!this._effectBufferCache[filePath] && !this._effectBufferPromises[filePath]) {
                try { this.primeEffectBuffer(key, opts); } catch (e) { /* ignore */ }
            }
        }

        const audio = this._takeEffectAudio(filePath);
        if (!audio) return false;
        audio.volume = effectVolume * (this.isMuted ? 0 : 1);
        try { audio.currentTime = 0; } catch (e) { /* ignore */ }
        audio.onerror = () => {
            if (!this._missingEffectWarned[filePath]) {
                this._missingEffectWarned[filePath] = true;
                console.warn(`Effect sound not found: ${filePath}`);
            }
        };

        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch((e: any) => {
                this._recordEffectFailure(filePath, e);
                if (!this._missingEffectWarned[filePath]) {
                    this._missingEffectWarned[filePath] = true;
                    console.warn(`Effect sound play failed (${filePath}): ${e && e.message ? e.message : e}`);
                }
            });
        }
        return true;
```

Keep the existing early returns for empty key/filePath and mute.

- [ ] **Step 7: Run focused buffer tests**

Run:

```powershell
npm run build:ts
npm run test:jest -- --runTestsByPath test/sound-engine.default-bgm.test.ts -t "Web Audio buffers|still loading|diagnostics|unlockAudio"
```

Expected: PASS.

- [ ] **Step 8: Commit Task 3-4 if isolated**

```powershell
git add sound-engine.ts test/sound-engine.default-bgm.test.ts
git commit -m "Use Web Audio buffers for effect sounds"
```

Skip commit if unrelated dirty edits in these files cannot be separated.

---

### Task 5: Install Mobile Unlock Listener During UI Boot

**Files:**
- Modify: `sound-engine.ts`
- Modify: `ui/handlers/init.ts`
- Test: `test/sound-engine.default-bgm.test.ts`

- [ ] **Step 1: Add listener installation test**

In `test/sound-engine.default-bgm.test.ts`, add:

```ts
test('installUserGestureUnlock wires one-shot pointer and touch unlock listeners', async () => {
  const listeners = {};
  const doc = {
    addEventListener: jest.fn((type, handler, options) => {
      listeners[type] = { handler, options };
    }),
    removeEventListener: jest.fn()
  };
  const { context } = createMockAudioContext();
  context.state = 'running';
  const soundEngine = loadSoundEngine();
  soundEngine.ctx = context;
  soundEngine.unlockAudio = jest.fn(async () => true);
  soundEngine.primeCriticalEffectSounds = jest.fn(async () => 3);
  soundEngine.primeRemainingEffectSounds = jest.fn(async () => 10);

  expect(soundEngine.installUserGestureUnlock(doc)).toBe(true);
  expect(soundEngine.installUserGestureUnlock(doc)).toBe(false);
  expect(doc.addEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function), expect.objectContaining({ capture: true, passive: true }));
  expect(doc.addEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function), expect.objectContaining({ capture: true, passive: true }));
  expect(doc.addEventListener).toHaveBeenCalledWith('click', expect.any(Function), expect.objectContaining({ capture: true, passive: true }));

  await listeners.pointerdown.handler();

  expect(soundEngine.unlockAudio).toHaveBeenCalledTimes(1);
  expect(soundEngine.primeCriticalEffectSounds).toHaveBeenCalledTimes(1);
  expect(soundEngine.primeRemainingEffectSounds).toHaveBeenCalledTimes(1);
  expect(doc.removeEventListener).toHaveBeenCalledWith('pointerdown', listeners.pointerdown.handler, true);
});
```

- [ ] **Step 2: Run listener test to verify it fails**

Run:

```powershell
npm run build:ts
npm run test:jest -- --runTestsByPath test/sound-engine.default-bgm.test.ts -t "installUserGestureUnlock"
```

Expected: FAIL because `installUserGestureUnlock` does not exist.

- [ ] **Step 3: Implement `installUserGestureUnlock()`**

Add state near unlock properties:

```ts
    _audioUnlockListenersInstalled: false,
```

Add method after `unlockAudio()`:

```ts
    installUserGestureUnlock(doc?: Document | any) {
        const targetDoc = doc || (typeof document !== 'undefined' ? document : null);
        if (!targetDoc || typeof targetDoc.addEventListener !== 'function') return false;
        if (this._audioUnlockListenersInstalled) return false;
        this._audioUnlockListenersInstalled = true;
        const options = { capture: true, passive: true };
        const removeOptions = true;
        const handler = () => {
            try {
                targetDoc.removeEventListener('pointerdown', handler, removeOptions);
                targetDoc.removeEventListener('touchstart', handler, removeOptions);
                targetDoc.removeEventListener('click', handler, removeOptions);
            } catch (e) { /* ignore */ }
            Promise.resolve(this.unlockAudio())
                .then((unlocked) => {
                    if (!unlocked) return;
                    return this.primeCriticalEffectSounds();
                })
                .then(() => this.primeRemainingEffectSounds())
                .catch((e) => {
                    this._recordEffectFailure('__unlock__', e);
                });
        };
        targetDoc.addEventListener('pointerdown', handler, options);
        targetDoc.addEventListener('touchstart', handler, options);
        targetDoc.addEventListener('click', handler, options);
        return true;
    },
```

- [ ] **Step 4: Update UI boot to install unlock listener instead of heavy warmup**

In `ui/handlers/init.ts`, replace:

```ts
  try {
    if (typeof SoundEngine !== 'undefined' && typeof SoundEngine.primeEffectSounds === 'function') {
      SoundEngine.primeEffectSounds();
    }
  } catch (e) { /* ignore */ }
```

with:

```ts
  try {
    if (typeof SoundEngine !== 'undefined' && typeof SoundEngine.installUserGestureUnlock === 'function') {
      SoundEngine.installUserGestureUnlock(typeof document !== 'undefined' ? document : null);
    }
  } catch (e) { /* ignore */ }
```

- [ ] **Step 5: Run listener test**

Run:

```powershell
npm run build:ts
npm run test:jest -- --runTestsByPath test/sound-engine.default-bgm.test.ts -t "installUserGestureUnlock"
```

Expected: PASS.

- [ ] **Step 6: Commit Task 5 if isolated**

```powershell
git add sound-engine.ts ui/handlers/init.ts test/sound-engine.default-bgm.test.ts
git commit -m "Unlock sound effects on first user gesture"
```

---

### Task 6: Preserve Existing HTMLAudio Behavior And Special BGM Muting

**Files:**
- Modify: `test/sound-engine.default-bgm.test.ts`
- Modify: `sound-engine.ts` only if tests reveal regressions

- [ ] **Step 1: Add fallback regression test for no Web Audio/fetch**

Add:

```ts
test('playEffectByKey keeps HTMLAudio fallback when Web Audio effect buffers are unavailable', () => {
  const { MockAudio, instances } = createMockHtmlAudioClass();
  const soundEngine = loadSoundEngine({ Audio: MockAudio, fetch: undefined });

  expect(soundEngine.playEffectByKey('card_effect_flip')).toBe(true);

  const effectPath = soundEngine.getEffectFilePath('card_effect_flip');
  const audio = instances.find((candidate) => candidate.src === effectPath);
  expect(audio).toBeTruthy();
  expect(audio.play).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Add special-card mute regression test for Web Audio path**

Add:

```ts
test('special_card_use still mutes BGM for three seconds when played through Web Audio', async () => {
  jest.useFakeTimers();
  try {
    const { MockAudio, instances } = createMockHtmlAudioClass();
    const { context } = createMockAudioContext();
    context.state = 'running';
    const fetchMock = jest.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8)
    }));
    const soundEngine = loadSoundEngine({ Audio: MockAudio, fetch: fetchMock, setTimeout, clearTimeout });
    soundEngine.ctx = context;
    soundEngine.allowBgmPlay = false;
    soundEngine.loadBgm(0);
    const bgm = instances[0];

    await soundEngine.unlockAudio();
    await soundEngine.primeEffectBuffer('special_card_use');

    expect(soundEngine.playEffectByKey('special_card_use')).toBe(true);
    expect(bgm.volume).toBe(0);

    jest.advanceTimersByTime(3000);
    expect(bgm.volume).toBeCloseTo(0.49875 * 0.364, 6);
  } finally {
    jest.useRealTimers();
  }
});
```

If the current working tree intentionally changed the default BGM volume, update the expected numeric value to match the repository’s current expected value in the same test file.

- [ ] **Step 3: Run fallback and mute tests**

Run:

```powershell
npm run build:ts
npm run test:jest -- --runTestsByPath test/sound-engine.default-bgm.test.ts -t "HTMLAudio fallback|special_card_use still mutes"
```

Expected: PASS.

- [ ] **Step 4: Run full sound-engine test file**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/sound-engine.default-bgm.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 6 if isolated**

```powershell
git add sound-engine.ts test/sound-engine.default-bgm.test.ts
git commit -m "Preserve sound effect fallback behavior"
```

---

### Task 7: Build, Mirror, And Focused Verification

**Files:**
- Generated only through commands if needed: `dist/*`, `public/module-registry.js`, `worker-public/*`

- [ ] **Step 1: Run TypeScript build**

Run:

```powershell
npm run build:ts
```

Expected: PASS. If this updates generated `dist/` files that are intentionally tracked or required by tests, inspect the diff before staging.

- [ ] **Step 2: Run focused Jest tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/sound-engine.default-bgm.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run architecture boundary check**

Run:

```powershell
npm run check:window
```

Expected: PASS. This change must not add DOM/audio dependencies to `game/` or `shared/`.

- [ ] **Step 4: Prepare worker mirror only if browser build artifacts changed**

Run only when the build or source changes require mirror sync:

```powershell
npm run worker:prepare
```

Expected: PASS. Review generated `worker-public/` changes. Do not hand-edit mirror files.

- [ ] **Step 5: Final diff review**

Run:

```powershell
git status --short
git diff -- sound-engine.ts ui/handlers/init.ts test/sound-engine.default-bgm.test.ts
```

Expected: only intended source/test changes plus any required generated mirror/build files are present. Unrelated dirty files remain unstaged.

- [ ] **Step 6: Commit final generated sync if isolated**

Stage only intended files:

```powershell
git add sound-engine.ts ui/handlers/init.ts test/sound-engine.default-bgm.test.ts
```

If `npm run worker:prepare` intentionally updated mirror/generated files for this task:

```powershell
git add public/module-registry.js worker-public
```

Commit:

```powershell
git commit -m "Stabilize mobile sound effect playback"
```

If unrelated dirty files prevent a clean commit, do not commit; report the exact files and ask how to proceed.

---

## Manual Mobile Verification

Use a real iOS Safari or Android Chrome device against a local or deployed build.

- Open the game fresh and do not press the BGM play button first.
- Tap a hand card. Expected: `hand_card_select` plays on the first or second real gesture after page load; diagnostics should show `audioUnlocked: true`.
- Use a normal card. Expected: `card_use_button` plays during the card-use phase.
- Place a stone. Expected: `stone_place` plays with the selected placement sound.
- Trigger a multi-event card effect such as spawn/move/flip. Expected: repeated effects are not randomly dropped.
- Use a special card. Expected: `special_card_use` plays, BGM output mutes for 3 seconds, then manifest BGM timing remains unchanged.
- Background/lock the browser and return. Expected: after one tap, subsequent effects resume. If this fails, add a follow-up task to re-run `unlockAudio()` on `visibilitychange` plus next user gesture.

## Self-Review

- Spec coverage: explicit unlock, Web Audio SFX buffers, staged warmup, fallback, diagnostics, BGM special-card mute preservation, and worker mirror policy are each covered by tasks.
- Placeholder scan: no deferred or incomplete steps remain.
- Type consistency: public API names are `unlockAudio`, `isAudioUnlocked`, `installUserGestureUnlock`, `primeEffectBuffer`, `primeCriticalEffectSounds`, `primeRemainingEffectSounds`, and `getDiagnostics`; tests and implementation steps use the same names.
