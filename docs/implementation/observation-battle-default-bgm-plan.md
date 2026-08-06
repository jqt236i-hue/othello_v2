# Observation Battle default BGM implementation plan

- Status: completed / deployed on 2026-08-06
- Date: 2026-08-06
- Design: `docs/implementation/observation-battle-default-bgm-design.md`
- Execution mode: source-first, focused verification, generated mirror, public deploy

## Phase 1 — Move and verify the source asset

### Work

1. Move the supplied `Observation Battle.mp3` into `assets/audio/bgm/Observation Battle.mp3`.
2. Verify the destination bytes, file size, BPM tag, channel/sample metadata, and duration.
3. Confirm the source path is no longer present after the requested move.

### Verification / done condition

`ffprobe` reports `TBPM=135` and a duration consistent with `112 * 60 / 135`; the destination exists and the original source path is absent.

## Phase 2 — Wire the default and document the loop

### Files

- `sound-engine.ts`
- `test/sound-engine.default-bgm.test.ts`
- `01-rulebook.md`
- `正本/効果音対応表.md`

### Work

1. Append `Observation Battle` to the playlist with `loopEnd: 112 * 60 / 135` and leave `loopStart` at zero.
2. Set `currentTrackIndex` to the appended entry.
3. Update focused expectations for the eight-track playlist and assert the new asset exists and has the expected loop formula.
4. Update both player-visible sound specifications with the 135 BPM, 112-beat loop contract.

### Verification / done condition

The focused sound-engine suite passes, `git diff --check` passes, and no existing track metadata or volume contract changes unexpectedly.

## Phase 3 — Generate and verify delivery surfaces

### Work

1. Run the browser build required for root browser-visible source changes.
2. Run the smallest asset-delivery smoke check and the Worker mirror preparation/verification.
3. Inspect generated diffs and preserve unrelated pre-existing Pixi/generated changes without staging them.

### Verification / done condition

The new MP3 is present byte-for-byte in `worker-public/assets/audio/bgm/Observation Battle.mp3`; the browser build and asset-delivery/mirror checks pass.

## Phase 4 — Deploy and verify publicly

### Work

1. Run `npm run worker:deploy`, which regenerates the Worker mirror, runs the bundle smoke check, and publishes the configured Worker.
2. Request the public default page and the new MP3 from the configured URL.
3. Confirm the deployed response succeeds and the served asset length/hash matches the local generated asset.

### Verification / done condition

Cloudflare deployment succeeds and the public Worker serves the new asset successfully; the deployed HTML/runtime contains the new default track path.

Result: deployed as Worker version `25201337-70eb-4022-8543-81b29094db2e` at `https://card.reversi-0.workers.dev`. The public MP3 was verified at `200 audio/mpeg` with 1,994,013 bytes and a matching SHA-256.

## Completion checklist

- [x] Asset moved to the canonical BGM directory and source path cleared.
- [x] 135 BPM / 112-beat loop metadata is wired and documented.
- [x] Focused sound test passes.
- [x] Browser build and asset-delivery verification pass.
- [x] Worker mirror is generated and verified.
- [x] Public deployment succeeds and serves the new asset.
- [x] Final diff/status review is complete.
- [x] Task-owned source/spec/test/assets/design/plan files are committed; overlapping pre-existing Pixi/generated work remains uncommitted and is preserved.

## Self-review

The plan follows the reviewed design, keeps root source ahead of generated output, orders asset movement before source references, and includes both browser and Worker delivery checks. It does not add a new test fixture or a second loop implementation; the existing sound-engine fallback behavior is exercised by the current test suite. No plan defect was found before execution.
