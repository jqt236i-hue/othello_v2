# ネット対戦演出・効果音 parity matrix 2026-05-30

- generatedAt: 2026-05-30T10:36:18.371Z
- source: `cards/catalog.json` (88 cards)
- baseline: `npm run typecheck` / `npm run build:ts` / `npm run match:check` / `npm run test:network:parity` = pass (2026-05-30)
- auto-covered: 88
- needs-targeted-test: 0

## 判定ルール

- `auto-covered`: 既存ネット系主要テストファイルに card type 文字列参照がある
- `needs-targeted-test`: 主要テスト参照が未検出（本 matrix 上で個別 parity シナリオ追加対象）
- `pendingSelection`: `pending-selection-registry.ts` で対象選択系として扱われるもの

## Matrix

| cardId | type | pendingSelection | playbackContract | workerPublishSanitize | workerPublishIdempotency | workerPendingEffect | missingTypeSmoke | status |
|---|---|---:|---:|---:|---:|---:|---:|---|
| chest_01 | TREASURE_BOX |  |  |  |  |  | Y | auto-covered |
| free_01 | FREE_PLACEMENT |  | Y | Y |  |  |  | auto-covered |
| last_resort_01 | LAST_RESORT |  |  |  |  |  | Y | auto-covered |
| sniper_01 | SNIPER_WILL |  | Y | Y | Y |  |  | auto-covered |
| hard_01 | PROTECTED_NEXT_STONE |  |  |  |  |  | Y | auto-covered |
| ghost_01 | GHOST_WILL |  |  |  |  |  | Y | auto-covered |
| afterimage_will_01 | AFTERIMAGE_WILL |  |  |  |  |  | Y | auto-covered |
| swap_01 | SWAP_WITH_ENEMY | Y | Y |  |  | Y |  | auto-covered |
| position_swap_01 | POSITION_SWAP_WILL | Y | Y |  |  | Y |  | auto-covered |
| perma_01 | PERMA_PROTECT_NEXT_STONE |  |  |  |  |  | Y | auto-covered |
| strong_wind_01 | STRONG_WIND_WILL | Y | Y |  |  |  |  | auto-covered |
| super_buoyancy_01 | SUPER_BUOYANCY_WILL | Y | Y |  |  |  |  | auto-covered |
| buoyancy_01 | BUOYANCY_WILL | Y | Y |  |  |  |  | auto-covered |
| super_gravity_01 | SUPER_GRAVITY_WILL | Y | Y |  |  |  |  | auto-covered |
| super_attraction_01 | SUPER_ATTRACTION_WILL | Y | Y |  |  |  |  | auto-covered |
| gravity_01 | GRAVITY_WILL | Y | Y |  |  |  |  | auto-covered |
| trap_01 | TRAP_WILL | Y | Y |  |  |  |  | auto-covered |
| tempt_01 | TEMPT_WILL | Y | Y |  |  | Y |  | auto-covered |
| capture_01 | CAPTURE_WILL | Y | Y |  |  | Y |  | auto-covered |
| double_chain_01 | DOUBLE_CHAIN_WILL |  |  |  |  |  | Y | auto-covered |
| triple_chain_01 | TRIPLE_CHAIN_WILL |  |  |  |  |  | Y | auto-covered |
| quad_chain_01 | QUAD_CHAIN_WILL |  |  |  |  |  | Y | auto-covered |
| infinite_chain_01 | INFINITE_CHAIN_WILL |  |  |  |  |  | Y | auto-covered |
| taboo_reverse_01 | TABOO_REVERSE_WILL |  |  |  |  |  | Y | auto-covered |
| regen_01 | REGEN_WILL |  |  |  |  |  | Y | auto-covered |
| destroy_01 | DESTROY_ONE_STONE | Y | Y |  |  | Y |  | auto-covered |
| bomb_01 | TIME_BOMB | Y | Y |  |  | Y |  | auto-covered |
| time_stop_god_01 | TIME_STOP_GOD |  |  |  |  |  | Y | auto-covered |
| udr_01 | ULTIMATE_REVERSE_DRAGON |  | Y |  |  | Y |  | auto-covered |
| breeding_01 | BREEDING_WILL |  |  | Y |  |  |  | auto-covered |
| proliferation_01 | PROLIFERATION_WILL |  |  |  |  |  | Y | auto-covered |
| clone_01 | CLONE_WILL | Y | Y |  |  |  |  | auto-covered |
| seed_01 | SEED_WILL | Y | Y |  |  | Y |  | auto-covered |
| teleport_01 | TELEPORT_WILL | Y | Y |  |  |  |  | auto-covered |
| cell_teleport_01 | CELL_TELEPORT_WILL | Y | Y |  |  |  |  | auto-covered |
| cross_bomb_01 | CROSS_BOMB |  |  |  |  |  | Y | auto-covered |
| x_bomb_01 | X_BOMB |  |  |  |  |  | Y | auto-covered |
| hyperactive_01 | HYPERACTIVE_WILL |  |  |  |  |  | Y | auto-covered |
| extreme_hyperactive_01 | EXTREME_HYPERACTIVE_WILL |  |  |  | Y |  |  | auto-covered |
| escape_01 | ESCAPE_WILL |  |  |  |  |  | Y | auto-covered |
| robot_vacuum_01 | ROBOT_VACUUM_WILL |  |  |  |  |  | Y | auto-covered |
| gluttonous_will_01 | GLUTTONOUS_WILL |  |  |  | Y |  |  | auto-covered |
| will_hunter_king_01 | WILL_HUNTER_KING |  | Y |  | Y |  |  | auto-covered |
| instant_hyperactive_01 | INSTANT_HYPERACTIVE_WILL |  |  |  |  |  | Y | auto-covered |
| rebuild_01 | REBUILD_WILL |  |  |  |  |  | Y | auto-covered |
| supply_01 | SUPPLY_WILL |  |  |  |  |  | Y | auto-covered |
| plunder_will | PLUNDER_WILL |  |  | Y |  |  |  | auto-covered |
| corner_tribute_01 | CORNER_TRIBUTE |  |  |  |  |  | Y | auto-covered |
| work_01 | WORK_WILL |  |  |  |  |  | Y | auto-covered |
| ribo_01 | RIBO_WILL |  |  |  |  |  | Y | auto-covered |
| loss_will_01 | LOSS_WILL |  |  |  |  |  | Y | auto-covered |
| double_01 | DOUBLE_PLACE |  |  |  |  |  | Y | auto-covered |
| triple_01 | TRIPLE_PLACE |  |  |  |  |  | Y | auto-covered |
| quad_01 | QUAD_PLACE |  |  |  |  |  | Y | auto-covered |
| infinite_01 | INFINITE_PLACE |  |  |  |  |  | Y | auto-covered |
| heaven_01 | HEAVEN_BLESSING | Y | Y |  |  | Y |  | auto-covered |
| reveal_hand_01 | REVEAL_HAND_WILL |  |  |  |  |  | Y | auto-covered |
| condemn_01 | CONDEMN_WILL | Y | Y | Y |  | Y |  | auto-covered |
| execution_01 | EXECUTION_WILL |  |  |  |  |  | Y | auto-covered |
| gold_stone | GOLD_STONE |  |  |  |  |  | Y | auto-covered |
| rainbow_stone | RAINBOW_STONE |  |  | Y |  |  |  | auto-covered |
| silver_stone | SILVER_STONE |  |  |  |  |  | Y | auto-covered |
| crystal_stone | CRYSTAL_STONE |  |  |  |  |  | Y | auto-covered |
| extend_life_01 | EXTEND_LIFE_WILL | Y | Y |  |  | Y |  | auto-covered |
| extend_life_god_01 | EXTEND_LIFE_GOD | Y | Y |  |  |  |  | auto-covered |
| corrosion_01 | CORROSION_WILL | Y | Y |  |  | Y |  | auto-covered |
| guard_01 | GUARD_WILL | Y | Y |  |  |  |  | auto-covered |
| guardian_god_01 | GUARDIAN_GOD | Y | Y | Y |  |  |  | auto-covered |
| stone_salvation_god_01 | STONE_SALVATION_GOD |  | Y |  |  |  |  | auto-covered |
| destroy_dragon_01 | DESTROY_DRAGON_WILL |  |  |  | Y |  |  | auto-covered |
| lightning_01 | LIGHTNING_WILL |  |  |  | Y |  |  | auto-covered |
| udg_01 | ULTIMATE_DESTROY_GOD |  | Y |  |  |  |  | auto-covered |
| ultimate_hyperactive_01 | ULTIMATE_HYPERACTIVE_GOD |  |  |  | Y |  |  | auto-covered |
| board_expand_01 | BOARD_EXPANSION_WILL | Y | Y |  |  | Y |  | auto-covered |
| board_expand_god_01 | BOARD_EXPANSION_GOD | Y | Y |  |  | Y |  | auto-covered |
| board_shrink_01 | BOARD_SHRINK_WILL | Y | Y |  |  | Y |  | auto-covered |
| board_shrink_god_01 | BOARD_SHRINK_GOD | Y | Y |  |  |  |  | auto-covered |
| blockade_01 | BLOCKADE_WILL | Y | Y |  |  | Y |  | auto-covered |
| meteor_01 | METEOR_WILL | Y | Y |  |  | Y |  | auto-covered |
| freeze_01 | FREEZE_WILL | Y | Y |  |  | Y |  | auto-covered |
| salvation_01 | SALVATION_WILL |  |  |  |  |  | Y | auto-covered |
| living_will_01 | LIVING_WILL | Y | Y |  |  | Y |  | auto-covered |
| reinforcement_01 | REINFORCEMENT_WILL |  |  |  |  |  | Y | auto-covered |
| equality_will_01 | EQUALITY_WILL |  |  |  |  |  | Y | auto-covered |
| fate_will_01 | FATE_WILL |  |  |  |  |  | Y | auto-covered |

## Sound Key Coverage (2026-05-30)

- source: `sound-engine.ts` `effectSoundFiles` = 39 keys
- test: `test/ui.animation-feedback-events.sound-keys.test.ts`
  - registered effect keys -> `SoundEngine.playEffectByKey()` forwarding pass
  - single-event duplicate key dedupe pass
- aggregate run: `npm run test:network:parity` pass（34 suites / 411 tests）

## Live Acceptance Coverage (2026-05-30)

- artifact: `tmp-live-check-1780093685466-deployed-special-proof/summary.json`
  - scenario pass: 繁殖の意志 / 逃げる意志
- artifact: `tmp-live-check-1780093862929-deployed-remaining-proof/summary.json`
  - scenario pass: 狙撃の意志 / 強風の意志 / 捕獲の意志
- artifact: `tmp-live-check-1780094071565-deployed-super-attraction-proof/summary.json`
  - scenario pass: 超引力
- artifact: `tmp-live-check-1780094402998-deployed-hyperactive-proof/summary.json`
  - scenario pass: 多動の意志
- all listed artifacts: `passed: true`
