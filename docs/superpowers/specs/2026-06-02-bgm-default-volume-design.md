# BGM Default Volume Increase Design

## Goal

Raise the startup default BGM volume by about 40% relative to the current default, without changing manual volume controls, track behavior, or persistence semantics.

## Chosen Approach

Update the startup default BGM volume from `0.091` to `0.1274` (`0.091 * 1.4`).

This keeps the existing slider range, BGM play/pause flow, and per-track behavior unchanged. Only the initial value used at startup changes.

## Source Of Truth

- Rulebook text in `01-rulebook.md`
- Runtime default in `sound-engine.ts`
- Regression coverage in `test/sound-engine.default-bgm.test.ts`

## Scope

- Update the player-facing rulebook sentence that documents the startup default BGM slider value
- Update the runtime default BGM volume constant
- Update the test that asserts the startup default BGM volume

## Out Of Scope

- Slider min/max/step changes
- SE volume changes
- BGM playlist or loop metadata changes
- Any saved-setting or user-adjusted volume behavior changes

## Verification

1. Change the regression test expectation first to `0.1274`
2. Run the focused test and confirm it fails for the expected reason
3. Update runtime and rulebook
4. Re-run the focused test and confirm it passes
