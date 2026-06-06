# 理論の化身 特殊石出現効果音 Design

## Role

This document records the approved design for adding a dedicated sound effect when `理論の化身` spawns a special stone from a theory number cell. The gameplay source of truth remains `01-rulebook.md`.

## Target

Use the provided audio file as the sound effect for the moment a special stone appears from a theory number cell:

`C:\Users\quarr\Documents\Studio One\Songs\2026-06-06 qt qt\Mixdown\理論の化身で特殊石が出現するタイミング.mp3`

## Decision

Copy the file into `assets/audio/sound-effect/理論の化身で特殊石が出現するタイミング.mp3` and register a new sound key:

`theory_incarnation_spawn`

When playback contains a `theory_incarnation_spawn_roulette` event, add one `sound_effect` playback event with that key at the same phase. This keeps sound playback in the existing UI/pipeline playback path and avoids adding audio dependencies to headless game logic.

## Non-Goals

- Do not replace normal card-effect spawn sounds.
- Do not change the theory spawn roulette timing or materialize timing.
- Do not play this sound for the initial `理論の化身` manifest stone placement.
- Do not add DOM, audio, or timer dependencies to `game/logic` or turn-start authority code.

## Verification

- Add a focused pipeline UI adapter test proving a theory roulette playback event gets `theory_incarnation_spawn` at the same phase.
- Add a sound engine test proving the key maps to the new mp3.
- Run focused Jest, typecheck/build, and worker mirror preparation.
