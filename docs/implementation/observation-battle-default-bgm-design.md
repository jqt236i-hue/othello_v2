# Observation Battle default BGM design

- Status: completed / deployed on 2026-08-06
- Date: 2026-08-06
- Request: make the supplied `Observation Battle.mp3` the game's startup BGM, place it under the repository assets, preserve a clean loop at 135 BPM, and deploy the result.
- Sources: `AGENTS.md`, `01-rulebook.md` §12.15, `正本/効果音対応表.md`, `sound-engine.ts`, the existing BGM tests, and the configured Worker deployment path.

## Desired outcome

The supplied MP3 is shipped from `assets/audio/bgm/Observation Battle.mp3`, appears in the BGM picker, and is selected by default on first startup. Its loop is defined as the complete 112-beat phrase at 135 BPM: `loopStart = 0` and `loopEnd = 112 * 60 / 135` seconds (approximately `49.777777778`). Existing BGM choices, indices, volume defaults, and special/result BGM behavior remain unchanged.

## Scope and non-goals

In scope:

- move the user-supplied source file into the canonical `assets/audio/bgm/` directory;
- append the track to the existing playlist and point `currentTrackIndex` at it;
- document the BPM and loop contract in the player-visible sound specification;
- update focused playlist/loop coverage;
- regenerate browser and Worker delivery surfaces through the existing build and mirror commands;
- deploy the generated Worker/static asset surface and verify the public asset response.

Non-goals:

- removing or renaming existing BGM tracks;
- changing BGM or master-volume defaults;
- adding another audio playback implementation or a second loop clock;
- re-encoding the supplied MP3 unless technical verification proves it is required.

## Repository evidence and chosen design

`sound-engine.ts` is the canonical BGM owner. It already supports explicit loop windows through an AudioBuffer source when Web Audio is available and through the HTML Audio fallback otherwise. The new track will use that existing path instead of adding a parallel player. It will be appended after the existing seven tracks so saved or test-controlled numeric track selections retain their meaning; only the startup index changes from `6` to `7`.

The source file reports `TBPM=135` and a duration of approximately `49.777771` seconds. That is the encoded form of 112 beats at 135 BPM (`49.777777778` seconds); the engine already clamps an explicit loop end to the decoded buffer duration when encoder padding makes the mathematical value a few samples longer. The full phrase is therefore used as one deterministic loop window without an offline crossfade or another lossy encode.

The rulebook and the sound correspondence table will name the new default and its loop formula. The ordinary BGM is not part of the integrity manifest's selected special-asset list, so no hand-written manifest entry is needed; `worker:prepare` mirrors the complete `assets` directory and remains the source for the deploy copy.

## Compatibility, failure, and rollback

- If Web Audio decoding is unavailable, the existing HTML Audio fallback still receives the same explicit loop metadata.
- If the asset is missing in a generated surface, focused asset delivery and Worker mirror checks must fail before deployment is considered complete.
- The old `sacrifice.mp3` track remains selectable and its existing `loopEnd = 40` contract is untouched.
- Rollback is a source-only reversal of the new playlist entry/default index and regenerated mirror; no user data or network state is changed.

## Verification and completion conditions

- `ffprobe` confirms the shipped source still carries BPM 135 and the expected phrase duration.
- The focused sound-engine test passes with the new default track, asset existence, and loop metadata.
- Browser build/generation succeeds; asset delivery and Worker mirror checks pass.
- `npm run worker:deploy` succeeds and the public Worker serves the new MP3 with a successful response.
- Final status/diff contain only task-owned changes plus clearly preserved pre-existing work.

Deployment evidence: Worker version `25201337-70eb-4022-8543-81b29094db2e` at `https://card.reversi-0.workers.dev`. The public MP3 returned `200 audio/mpeg`, 1,994,013 bytes, and SHA-256 `35859183a93671d8198febb008b4d0d5a9b6eb034db8824c0e2da5c5ef073d60`, matching the local asset.

## Self-review

The design was checked against the current source and generated-surface rules. Appending rather than inserting preserves existing track indices; using the existing explicit loop machinery avoids a second playback path; and the formula is grounded in the source file's BPM tag and duration. The only material residual risk is the pre-existing dirty Pixi/generated worktree, which will not be staged or reverted and may remain visible in the final status.
