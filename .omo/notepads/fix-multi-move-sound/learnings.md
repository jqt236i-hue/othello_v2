# Learnings - fix-multi-move-sound

## Task 1: sound-engine.ts filename
- `ultimate_anchor_move` key maps to actual file on disk
- File on disk includes "意志狩りの王" in its name

## Task 2: pipeline_ui_adapter.ts classifications
- `_isHyperactiveMoveTarget()` controls which cards trigger `hyperactive_move` sound
- `_isUltimateAnchorMoveTarget()` controls which cards trigger `ultimate_anchor_move` sound
- Fallback paths handle edge cases where `move` type playback events are absent
- DESTROY_EVADE path is separate from WILL_HUNTER_KING cause path
