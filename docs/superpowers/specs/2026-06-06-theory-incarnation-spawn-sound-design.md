# 理論の化身 特殊石出現効果音 Design

## Role

This document records the approved design for adding a dedicated sound effect when `理論の化身` spawns a special stone from a theory number cell. The gameplay source of truth remains `01-rulebook.md`.

## Target

Use the provided audio file as the sound effect that starts with the theory roulette and contains the final special-stone appearance chord:

`C:\Users\quarr\Documents\Studio One\Songs\2026-06-06 qt qt\Mixdown\理論の化身のルーレットの開始タイミング.mp3`

## Decision

Copy the file into `assets/audio/sound-effect/理論の化身のルーレットの開始タイミング.mp3` and register a sound key:

`theory_incarnation_spawn`

When playback contains a `theory_incarnation_spawn_roulette` event, add one `sound_effect` playback event with that key at the same phase. The roulette visual timeline is 2.5 seconds and 19 fixed steps so the sound's final chord aligns with special-stone materialization.

## Non-Goals

- Do not replace normal card-effect spawn sounds.
- Do not change the materialize duration beyond starting it after the 2.5 second roulette.
- Do not play this sound for the initial `理論の化身` manifest stone placement.
- Do not add DOM, audio, or timer dependencies to `game/logic` or turn-start authority code.

## Verification

- Add a focused pipeline UI adapter test proving a theory roulette playback event gets `theory_incarnation_spawn` at the same phase.
- Add a sound engine test proving the key maps to the new mp3.
- Run focused Jest, typecheck/build, and worker mirror preparation.
