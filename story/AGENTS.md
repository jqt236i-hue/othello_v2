# story/ instructions

`story/` is the bounded context for the novel-style story mode. Keep story implementation here unless a later phase explicitly defines a minimal integration point with the existing game.

## Structure

```text
story/
├── core/       # headless story schema, state, runner, validator
├── content/    # scenarios, asset IDs, battle stages, story deck presets
├── ui/         # story-root rendering, novel UI, story-only audio
├── bridge/     # connection to existing game startup, save, and battle result APIs
└── editor/     # separate story authoring tool
```

## Rules

- `story/core/` must stay headless: no DOM, `window`, `document`, `Audio`, `localStorage`, timers, network, or existing game internals.
- `game/`, `shared/`, and `workers/` must not import from `story/`.
- Existing board rendering, playback, turn flow, move execution, network client, and sound files must not receive story-specific branches.
- Story UI renders only inside the story root and keeps CSS in `story/ui/story.css`.
- Story assets live under `assets/story/`; scenarios refer to asset IDs, not file paths.
- Story battles resolve through `story/bridge/`; `story/core/` only emits a battle request and waits for a result.
- Story battle stages may specify `6x6` or `8x8` board size. Pass that board size into the existing game initialization path and do not create story-only board initialization logic.
- Story battles may specify `protagonistSide`, `enemySide`, `protagonistDeck`, and `enemyDeck`. Use existing deck-codec/deck-spec helpers for decode, normalize, validate, and canonical encode.
- Do not reimplement deckCode parsing in story code. `story/core/` must not decode deckCode directly.
- Story battle deck data must not be stored in `gameState`, `cardState`, network room deck, network snapshots, or worker authority state.
- Initial story battle implementation is local/CPU only; do not connect it to `network-client.ts` or `workers/`.

## Story Battle Decks

Supported deck sources are:

- `default`
- `currentPlayerDeck`
- `deckPreset`
- `deckCode`

Prefer story deck presets for reusable protagonist/enemy decks. Inline deckCode is acceptable for focused fixtures or one-off stages when validator coverage is present.

## Verification

Choose focused checks by blast radius. For early docs and skeleton phases, typecheck is usually enough once TypeScript files exist. For battle bridge work, add focused tests around stage resolution, deck resolution, and `initialDeckSpecByPlayer` construction before touching production boot.
