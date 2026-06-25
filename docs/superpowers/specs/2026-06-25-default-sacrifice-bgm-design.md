# Default Sacrifice BGM Design

## Goal

Make `犠牲のテーマ` the startup default BGM for normal game sessions.

## Chosen Approach

Keep the existing BGM playlist order and change only the startup default track index from `0` to the existing `犠牲のテーマ` entry at index `6`.

This avoids reshuffling the BGM selector, preserves all existing track metadata, and keeps `assets/audio/bgm/sacrifice.mp3` using its current `loopEnd = 40` loop range. Existing player-controlled BGM selection continues to work through the current sound controls.

## Source Of Truth

- Rulebook BGM specification in `01-rulebook.md`
- Runtime startup default in `sound-engine.ts`
- Regression coverage in `test/sound-engine.default-bgm.test.ts`
- Generated browser and worker bundles produced from the root source

## Scope

- Update the rulebook so the startup default BGM is `assets/audio/bgm/sacrifice.mp3`
- Remove the rulebook statement that `犠牲のテーマ` is not the startup default
- Update the runtime default track index to the existing `犠牲のテーマ` playlist entry
- Update focused sound-engine tests that assert the default track
- Regenerate or sync built browser/worker outputs through the existing scripts

## Out Of Scope

- Adding or replacing audio assets
- Changing BGM volume, output scaling, slider limits, or master volume behavior
- Changing result BGM or manifest-stone override BGM behavior
- Reordering the BGM selector
- Changing saved user preferences beyond the startup default used by fresh runtime state

## Verification

1. Run the focused sound-engine test for the default BGM expectation.
2. Run the existing sync/build command needed to update generated browser and worker outputs.
3. Re-run focused tests that cover the default BGM and bundle sync.
4. Inspect `git diff` to confirm only the intended BGM default/spec/generated changes are included.
