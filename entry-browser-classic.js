// ===== Classic browser runtime entry =====
// Loads modules in original index.html order via module-registry

// _require / __require aliases (used by dist modules internally)
window._require = window.require;
window.__require = window.require;
var _require = window.require;

var gameState;
var cardState;
var boardConfig;
var prng;
var deckSpec;
var __uiImpl_turn_manager = {};

// dist/ui/layout-stage
try {
  var _mod1 = require("./dist/ui/layout-stage");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/layout-stage: " + e.message);
}

// dist/is-env-capable
try {
  var _mod2 = require("./dist/is-env-capable");
} catch (e) {
  console.warn("[boot] skip " + "dist/is-env-capable: " + e.message);
}

// dist/constants/difficulty-constants
try {
  var _mod3 = require("./dist/constants/difficulty-constants");
} catch (e) {
  console.warn("[boot] skip " + "dist/constants/difficulty-constants: " + e.message);
}

// dist/constants/ui-element-cache
try {
  var _mod4 = require("./dist/constants/ui-element-cache");
} catch (e) {
  console.warn("[boot] skip " + "dist/constants/ui-element-cache: " + e.message);
}

// dist/constants/animation-constants
try {
  var _mod5 = require("./dist/constants/animation-constants");
} catch (e) {
  console.warn("[boot] skip " + "dist/constants/animation-constants: " + e.message);
}

// dist/cards/catalog
try {
  var _mod6 = require("./dist/cards/catalog");
} catch (e) {
  console.warn("[boot] skip " + "dist/cards/catalog: " + e.message);
}

// dist/shared-constants
try {
  var _mod7 = require("./dist/shared-constants");
} catch (e) {
  console.warn("[boot] skip " + "dist/shared-constants: " + e.message);
}

// dist/shared/shared-board-utils
try {
  var _mod8 = require("./dist/shared/shared-board-utils");
} catch (e) {
  console.warn("[boot] skip " + "dist/shared/shared-board-utils: " + e.message);
}

// dist/shared/deck-spec
try {
  var _mod9 = require("./dist/shared/deck-spec");
} catch (e) {
  console.warn("[boot] skip " + "dist/shared/deck-spec: " + e.message);
}

// dist/shared/deck-codec
try {
  var _mod10 = require("./dist/shared/deck-codec");
} catch (e) {
  console.warn("[boot] skip " + "dist/shared/deck-codec: " + e.message);
}

// dist/shared/destroy-outcome-contract
try {
  var _mod11 = require("./dist/shared/destroy-outcome-contract");
} catch (e) {
  console.warn("[boot] skip " + "dist/shared/destroy-outcome-contract: " + e.message);
}

// dist/shared/special-stone-registry
try {
  var _mod12 = require("./dist/shared/special-stone-registry");
} catch (e) {
  console.warn("[boot] skip " + "dist/shared/special-stone-registry: " + e.message);
}

// dist/shared/stone-status-snapshot
try {
  var _mod13 = require("./dist/shared/stone-status-snapshot");
} catch (e) {
  console.warn("[boot] skip " + "dist/shared/stone-status-snapshot: " + e.message);
}

// dist/shared/shared-board-utils
try {
  var _mod14 = require("./dist/shared/shared-board-utils");
} catch (e) {
  console.warn("[boot] skip " + "dist/shared/shared-board-utils: " + e.message);
}

// dist/game/logic/markers_adapter
try {
  var _mod15 = require("./dist/game/logic/markers_adapter");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/markers_adapter: " + e.message);
}

// dist/game/logic/cards-internal/random-source
try {
  var _mod16 = require("./dist/game/logic/cards-internal/random-source");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards-internal/random-source: " + e.message);
}

// dist/game/logic/cards-internal/state-factory
try {
  var _mod17 = require("./dist/game/logic/cards-internal/state-factory");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards-internal/state-factory: " + e.message);
}

// dist/game/logic/cards-internal/module-resolver
try {
  var _mod18 = require("./dist/game/logic/cards-internal/module-resolver");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards-internal/module-resolver: " + e.message);
}

// dist/game/logic/cards-internal/presentation-helpers
try {
  var _mod19 = require("./dist/game/logic/cards-internal/presentation-helpers");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards-internal/presentation-helpers: " + e.message);
}

// dist/game/logic/board_ops
try {
  var _mod20 = require("./dist/game/logic/board_ops");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/board_ops: " + e.message);
}

// dist/utils/owner-helpers
try {
  var _mod21 = require("./dist/utils/owner-helpers");
} catch (e) {
  console.warn("[boot] skip " + "dist/utils/owner-helpers: " + e.message);
}

// dist/game/logic/core
try {
  var _mod22 = require("./dist/game/logic/core");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/core: " + e.message);
}

// dist/game/logic/cards/defs
try {
  var _mod23 = require("./dist/game/logic/cards/defs");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/defs: " + e.message);
}

// dist/game/logic/cards/costs
try {
  var _mod24 = require("./dist/game/logic/cards/costs");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/costs: " + e.message);
}

// dist/game/logic/cards/utils
try {
  var _mod25 = require("./dist/game/logic/cards/utils");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/utils: " + e.message);
}

// dist/game/logic/cards/targets
try {
  var _mod26 = require("./dist/game/logic/cards/targets");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/targets: " + e.message);
}

// dist/game/logic/cards/selectors
try {
  var _mod27 = require("./dist/game/logic/cards/selectors");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/selectors: " + e.message);
}

// dist/game/logic/cards/flips
try {
  var _mod28 = require("./dist/game/logic/cards/flips");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/flips: " + e.message);
}

// dist/game/logic/cards/chain
try {
  var _mod29 = require("./dist/game/logic/cards/chain");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/chain: " + e.message);
}

// dist/game/logic/cards/regen
try {
  var _mod30 = require("./dist/game/logic/cards/regen");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/regen: " + e.message);
}

// dist/game/logic/cards/time_bomb
try {
  var _mod31 = require("./dist/game/logic/cards/time_bomb");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/time_bomb: " + e.message);
}

// dist/game/logic/cards/breeding
try {
  var _mod32 = require("./dist/game/logic/cards/breeding");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/breeding: " + e.message);
}

// dist/game/logic/cards/hyperactive
try {
  var _mod33 = require("./dist/game/logic/cards/hyperactive");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/hyperactive: " + e.message);
}

// dist/game/logic/cards/udg
try {
  var _mod34 = require("./dist/game/logic/cards/udg");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/udg: " + e.message);
}

// dist/game/logic/cards/sniper
try {
  var _mod35 = require("./dist/game/logic/cards/sniper");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/sniper: " + e.message);
}

// dist/game/logic/cards/lightning
try {
  var _mod36 = require("./dist/game/logic/cards/lightning");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/lightning: " + e.message);
}

// dist/game/logic/cards/destroy_dragon
try {
  var _mod37 = require("./dist/game/logic/cards/destroy_dragon");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/destroy_dragon: " + e.message);
}

// dist/game/logic/cards/will_hunter_king
try {
  var _mod38 = require("./dist/game/logic/cards/will_hunter_king");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/will_hunter_king: " + e.message);
}

// dist/game/logic/cards/work_will
try {
  var _mod39 = require("./dist/game/logic/cards/work_will");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/work_will: " + e.message);
}

// dist/game/logic/cards/expansion
try {
  var _mod40 = require("./dist/game/logic/cards/expansion");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/expansion: " + e.message);
}

// dist/game/logic/cards/markers
try {
  var _mod41 = require("./dist/game/logic/cards/markers");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/markers: " + e.message);
}

// dist/game/logic/cards/living_will
try {
  var _mod42 = require("./dist/game/logic/cards/living_will");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/living_will: " + e.message);
}

// dist/game/logic/cards/movement
try {
  var _mod43 = require("./dist/game/logic/cards/movement");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/movement: " + e.message);
}

// dist/game/logic/cards/teleport
try {
  var _mod44 = require("./dist/game/logic/cards/teleport");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/teleport: " + e.message);
}

// dist/game/logic/cards/clone
try {
  var _mod45 = require("./dist/game/logic/cards/clone");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/clone: " + e.message);
}

// dist/game/logic/cards/meteor
try {
  var _mod46 = require("./dist/game/logic/cards/meteor");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/meteor: " + e.message);
}

// dist/game/logic/cards/shrink
try {
  var _mod47 = require("./dist/game/logic/cards/shrink");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/shrink: " + e.message);
}

// dist/game/logic/effects/dragon
try {
  var _mod48 = require("./dist/game/logic/effects/dragon");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/effects/dragon: " + e.message);
}

// dist/game/logic/effects/swap_with_enemy
try {
  var _mod49 = require("./dist/game/logic/effects/swap_with_enemy");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/effects/swap_with_enemy: " + e.message);
}

// dist/game/logic/effects/destroy_one_stone
try {
  var _mod50 = require("./dist/game/logic/effects/destroy_one_stone");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/effects/destroy_one_stone: " + e.message);
}

// dist/game/cards/effects/ownership
try {
  var _mod51 = require("./dist/game/cards/effects/ownership");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/cards/effects/ownership: " + e.message);
}

// dist/game/cards/effects/board-expansion-apply
try {
  var _mod52 = require("./dist/game/cards/effects/board-expansion-apply");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/cards/effects/board-expansion-apply: " + e.message);
}

// dist/game/cards/effects/status-cells
try {
  var _mod53 = require("./dist/game/cards/effects/status-cells");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/cards/effects/status-cells: " + e.message);
}

// dist/game/cards/effects/hand-effects
try {
  var _mod54 = require("./dist/game/cards/effects/hand-effects");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/cards/effects/hand-effects: " + e.message);
}

// dist/game/cards/effects/position-swap
try {
  var _mod55 = require("./dist/game/cards/effects/position-swap");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/cards/effects/position-swap: " + e.message);
}

// dist/game/logic/cards-internal/card-usage-prechecks
try {
  var _mod56 = require("./dist/game/logic/cards-internal/card-usage-prechecks");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards-internal/card-usage-prechecks: " + e.message);
}

// dist/game/logic/cards-internal/selector-orchestrator
try {
  var _mod57 = require("./dist/game/logic/cards-internal/selector-orchestrator");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards-internal/selector-orchestrator: " + e.message);
}

// dist/game/logic/cards-internal/hand-manager
try {
  var _mod58 = require("./dist/game/logic/cards-internal/hand-manager");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards-internal/hand-manager: " + e.message);
}

// dist/game/logic/cards-internal/effect-timing
try {
  var _mod59 = require("./dist/game/logic/cards-internal/effect-timing");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards-internal/effect-timing: " + e.message);
}

// dist/game/logic/cards-internal/pending-state-manager
try {
  var _mod60 = require("./dist/game/logic/cards-internal/pending-state-manager");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards-internal/pending-state-manager: " + e.message);
}

// dist/game/turn/pending-coordinator
try {
  var _mod61 = require("./dist/game/turn/pending-coordinator");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/turn/pending-coordinator: " + e.message);
}

// dist/game/logic/cards-internal/charge-ledger
try {
  var _mod62 = require("./dist/game/logic/cards-internal/charge-ledger");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards-internal/charge-ledger: " + e.message);
}

// dist/game/logic/cards
try {
  var _mod63 = require("./dist/game/logic/cards");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards: " + e.message);
}

// dist/game/logic/presentation
try {
  var _mod64 = require("./dist/game/logic/presentation");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/presentation: " + e.message);
}

// dist/game/logic/position-weights
try {
  var _mod65 = require("./dist/game/logic/position-weights");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/position-weights: " + e.message);
}

// dist/game/schema/prng
try {
  var _mod66 = require("./dist/game/schema/prng");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/schema/prng: " + e.message);
}

// dist/game/schema/action_manager
try {
  var _mod67 = require("./dist/game/schema/action_manager");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/schema/action_manager: " + e.message);
}

// dist/game-events
try {
  var _mod68 = require("./dist/game-events");
} catch (e) {
  console.warn("[boot] skip " + "dist/game-events: " + e.message);
}

// dist/game/game-core-logic
try {
  var _mod69 = require("./dist/game/game-core-logic");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/game-core-logic: " + e.message);
}

// dist/game/move-generator
try {
  var _mod70 = require("./dist/game/move-generator");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/move-generator: " + e.message);
}

// dist/card-system
try {
  var _mod71 = require("./dist/card-system");
} catch (e) {
  console.warn("[boot] skip " + "dist/card-system: " + e.message);
}

// dist/ui/storage/action-log
try {
  var _mod72 = require("./dist/ui/storage/action-log");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/storage/action-log: " + e.message);
}

// dist/shared/commentary-context-helpers
try {
  var _mod73 = require("./dist/shared/commentary-context-helpers");
} catch (e) {
  console.warn("[boot] skip " + "dist/shared/commentary-context-helpers: " + e.message);
}

// dist/shared/commentary-runtime-helpers
try {
  var _mod74 = require("./dist/shared/commentary-runtime-helpers");
} catch (e) {
  console.warn("[boot] skip " + "dist/shared/commentary-runtime-helpers: " + e.message);
}

// dist/shared/playback-event-helpers
try {
  var _mod75 = require("./dist/shared/playback-event-helpers");
} catch (e) {
  console.warn("[boot] skip " + "dist/shared/playback-event-helpers: " + e.message);
}

// dist/ui/commentary-broker
try {
  var _mod76 = require("./dist/ui/commentary-broker");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/commentary-broker: " + e.message);
}

// dist/ui/bootstrap
try {
  var _mod77 = require("./dist/ui/bootstrap");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/bootstrap: " + e.message);
}

// dist/ui/bootstrap/init-dom
try {
  var _mod78 = require("./dist/ui/bootstrap/init-dom");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/bootstrap/init-dom: " + e.message);
}

// dist/ui/bootstrap/init-events
try {
  var _mod79 = require("./dist/ui/bootstrap/init-events");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/bootstrap/init-events: " + e.message);
}

// dist/ui/bootstrap/init-game
try {
  var _mod80 = require("./dist/ui/bootstrap/init-game");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/bootstrap/init-game: " + e.message);
}

// dist/ui/bootstrap/init-network
try {
  var _mod81 = require("./dist/ui/bootstrap/init-network");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/bootstrap/init-network: " + e.message);
}

// dist/ui/marker-bridge
try {
  var _mod82 = require("./dist/ui/marker-bridge");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/marker-bridge: " + e.message);
}

// dist/ui
try {
  var _mod83 = require("./dist/ui");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui: " + e.message);
}

// dist/ui/animation-resolver
try {
  var _mod84 = require("./dist/ui/animation-resolver");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/animation-resolver: " + e.message);
}

// dist/ui/animation-shared
try {
  var _mod85 = require("./dist/ui/animation-shared");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/animation-shared: " + e.message);
}

// dist/ui/animation-helpers
try {
  var _mod86 = require("./dist/ui/animation-helpers");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/animation-helpers: " + e.message);
}

// dist/ui/playback-runtime
try {
  var _mod87 = require("./dist/ui/playback-runtime");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/playback-runtime: " + e.message);
}

// dist/ui/playback-state-manager
try {
  var _mod88 = require("./dist/ui/playback-state-manager");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/playback-state-manager: " + e.message);
}

// dist/ui/board-update-dispatch
try {
  var _mod89 = require("./dist/ui/board-update-dispatch");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/board-update-dispatch: " + e.message);
}

// dist/ui/board-update-sync-runtime
try {
  var _mod90 = require("./dist/ui/board-update-sync-runtime");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/board-update-sync-runtime: " + e.message);
}

// dist/ui/diff-renderer
try {
  var _mod91 = require("./dist/ui/diff-renderer");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/diff-renderer: " + e.message);
}

// dist/ui/board-renderer
try {
  var _mod92 = require("./dist/ui/board-renderer");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/board-renderer: " + e.message);
}

// dist/ui/status-display
try {
  var _mod93 = require("./dist/ui/status-display");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/status-display: " + e.message);
}

// dist/ui/animation-utils
try {
  var _mod94 = require("./dist/ui/animation-utils");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/animation-utils: " + e.message);
}

// dist/ui/stone-visuals
try {
  var _mod95 = require("./dist/ui/stone-visuals");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/stone-visuals: " + e.message);
}

// dist/ui/animation-constants
try {
  var _mod96 = require("./dist/ui/animation-constants");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/animation-constants: " + e.message);
}

// dist/ui/animation-engine
try {
  var _mod97 = require("./dist/ui/animation-engine");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/animation-engine: " + e.message);
}

// dist/ui/playback-engine
try {
  var _mod98 = require("./dist/ui/playback-engine");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/playback-engine: " + e.message);
}

// dist/ui/move-executor-visuals
try {
  var _mod99 = require("./dist/ui/move-executor-visuals");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/move-executor-visuals: " + e.message);
}

// dist/ui/visual-effects-map
try {
  var _mod100 = require("./dist/ui/visual-effects-map");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/visual-effects-map: " + e.message);
}

// dist/shared/gacha-helpers
try {
  var _mod101 = require("./dist/shared/gacha-helpers");
} catch (e) {
  console.warn("[boot] skip " + "dist/shared/gacha-helpers: " + e.message);
}

// dist/shared/observation-gacha-catalog-shared
try {
  var _mod102 = require("./dist/shared/observation-gacha-catalog-shared");
} catch (e) {
  console.warn("[boot] skip " + "dist/shared/observation-gacha-catalog-shared: " + e.message);
}

// dist/shared/observation-gacha-catalog.generated
try {
  var _mod103 = require("./dist/shared/observation-gacha-catalog.generated");
} catch (e) {
  console.warn("[boot] skip " + "dist/shared/observation-gacha-catalog.generated: " + e.message);
}

// dist/shared/gacha-hand-catalog-shared
try {
  var _mod104 = require("./dist/shared/gacha-hand-catalog-shared");
} catch (e) {
  console.warn("[boot] skip " + "dist/shared/gacha-hand-catalog-shared: " + e.message);
}

// dist/shared/gacha-hand-catalog.generated
try {
  var _mod105 = require("./dist/shared/gacha-hand-catalog.generated");
} catch (e) {
  console.warn("[boot] skip " + "dist/shared/gacha-hand-catalog.generated: " + e.message);
}

// dist/ui/storage/gacha-progress
try {
  var _mod106 = require("./dist/ui/storage/gacha-progress");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/storage/gacha-progress: " + e.message);
}

// dist/ui/gacha/gacha-events
try {
  var _mod107 = require("./dist/ui/gacha/gacha-events");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/gacha/gacha-events: " + e.message);
}

// dist/ui/gacha/catalog-access
try {
  var _mod108 = require("./dist/ui/gacha/catalog-access");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/gacha/catalog-access: " + e.message);
}

// dist/ui/placement-sound-selection
try {
  var _mod109 = require("./dist/ui/placement-sound-selection");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/placement-sound-selection: " + e.message);
}

// dist/ui/gacha/gacha-transaction
try {
  var _mod110 = require("./dist/ui/gacha/gacha-transaction");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/gacha/gacha-transaction: " + e.message);
}

// dist/ui/gacha/gacha-item-visuals
try {
  var _mod111 = require("./dist/ui/gacha/gacha-item-visuals");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/gacha/gacha-item-visuals: " + e.message);
}

// dist/ui/gacha/gacha-overlay-view
try {
  var _mod112 = require("./dist/ui/gacha/gacha-overlay-view");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/gacha/gacha-overlay-view: " + e.message);
}

// dist/ui/gacha/gacha-overlay-controller
try {
  var _mod113 = require("./dist/ui/gacha/gacha-overlay-controller");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/gacha/gacha-overlay-controller: " + e.message);
}

// dist/ui/gacha/gacha-reveal-stage
try {
  var _mod114 = require("./dist/ui/gacha/gacha-reveal-stage");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/gacha/gacha-reveal-stage: " + e.message);
}

// dist/ui/sound-engine-access
try {
  var _mod115 = require("./dist/ui/sound-engine-access");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/sound-engine-access: " + e.message);
}

// dist/ui/gacha/gacha-reveal-audio
try {
  var _mod116 = require("./dist/ui/gacha/gacha-reveal-audio");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/gacha/gacha-reveal-audio: " + e.message);
}

// dist/ui/gacha-reveal-player
try {
  var _mod117 = require("./dist/ui/gacha-reveal-player");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/gacha-reveal-player: " + e.message);
}

// dist/ui/leaderboard-client
try {
  var _mod118 = require("./dist/ui/leaderboard-client");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/leaderboard-client: " + e.message);
}

// dist/ui/result-overlay
try {
  var _mod119 = require("./dist/ui/result-overlay");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/result-overlay: " + e.message);
}

// dist/shared/network-action-schema
try {
  var _mod120 = require("./dist/shared/network-action-schema");
} catch (e) {
  console.warn("[boot] skip " + "dist/shared/network-action-schema: " + e.message);
}

// dist/ui/network/commentary
try {
  var _mod121 = require("./dist/ui/network/commentary");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/network/commentary: " + e.message);
}

// dist/ui/network/command-payload
try {
  var _mod122 = require("./dist/ui/network/command-payload");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/network/command-payload: " + e.message);
}

// dist/ui/network/publish-request
try {
  var _mod123 = require("./dist/ui/network/publish-request");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/network/publish-request: " + e.message);
}

// dist/ui/network/action-bridge
try {
  var _mod124 = require("./dist/ui/network/action-bridge");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/network/action-bridge: " + e.message);
}

// dist/ui/network/apply-coordinator
try {
  var _mod125 = require("./dist/ui/network/apply-coordinator");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/network/apply-coordinator: " + e.message);
}

// dist/ui/network/reconnect-controller
try {
  var _mod126 = require("./dist/ui/network/reconnect-controller");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/network/reconnect-controller: " + e.message);
}

// dist/ui/network/publish-tracker
try {
  var _mod127 = require("./dist/ui/network/publish-tracker");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/network/publish-tracker: " + e.message);
}

// dist/ui/network/snapshot-runtime
try {
  var _mod128 = require("./dist/ui/network/snapshot-runtime");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/network/snapshot-runtime: " + e.message);
}

// dist/ui/network/snapshot-canonical
try {
  var _mod129 = require("./dist/ui/network/snapshot-canonical");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/network/snapshot-canonical: " + e.message);
}

// dist/ui/network/snapshot-presentation
try {
  var _mod130 = require("./dist/ui/network/snapshot-presentation");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/network/snapshot-presentation: " + e.message);
}

// dist/ui/network/snapshot
try {
  var _mod131 = require("./dist/ui/network/snapshot");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/network/snapshot: " + e.message);
}

// dist/ui/network/session-seat
try {
  var _mod132 = require("./dist/ui/network/session-seat");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/network/session-seat: " + e.message);
}

// dist/ui/network/session-lifecycle
try {
  var _mod133 = require("./dist/ui/network/session-lifecycle");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/network/session-lifecycle: " + e.message);
}

// dist/ui/network-client
try {
  var _mod134 = require("./dist/ui/network-client");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/network-client: " + e.message);
}

// dist/sound-engine
try {
  var _mod135 = require("./dist/sound-engine");
  if (_mod135) Object.assign(window, _mod135);
  if (_mod135 && _mod135.default) window.SoundEngine = _mod135.default;
} catch (e) {
  console.warn("[boot] skip " + "dist/sound-engine: " + e.message);
}

// dist/cards/card-renderer
try {
  var _mod136 = require("./dist/cards/card-renderer");
} catch (e) {
  console.warn("[boot] skip " + "dist/cards/card-renderer: " + e.message);
}

// dist/cards/card-interaction-effects
try {
  var _mod137 = require("./dist/cards/card-interaction-effects");
} catch (e) {
  console.warn("[boot] skip " + "dist/cards/card-interaction-effects: " + e.message);
}

// dist/cards/card-interaction
try {
  var _mod138 = require("./dist/cards/card-interaction");
} catch (e) {
  console.warn("[boot] skip " + "dist/cards/card-interaction: " + e.message);
}

// dist/ui/storage/deck-presets
try {
  var _mod139 = require("./dist/ui/storage/deck-presets");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/storage/deck-presets: " + e.message);
}

// dist/ui/deck-builder-state
try {
  var _mod140 = require("./dist/ui/deck-builder-state");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/deck-builder-state: " + e.message);
}

// dist/ui/deck-builder-renderer
try {
  var _mod141 = require("./dist/ui/deck-builder-renderer");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/deck-builder-renderer: " + e.message);
}

// dist/ui/deck-builder-controller
try {
  var _mod142 = require("./dist/ui/deck-builder-controller");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/deck-builder-controller: " + e.message);
}

// dist/game/timers
try {
  var _mod143 = require("./dist/game/timers");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/timers: " + e.message);
}

// dist/game/auto
try {
  var _mod144 = require("./dist/game/auto");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/auto: " + e.message);
}

// dist/game/visual-effects-map
try {
  var _mod145 = require("./dist/game/visual-effects-map");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/visual-effects-map: " + e.message);
}

// dist/game/log-messages
try {
  var _mod146 = require("./dist/game/log-messages");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/log-messages: " + e.message);
}

// dist/game/turn/turn_pipeline_phase_helpers
try {
  var _mod147 = require("./dist/game/turn/turn_pipeline_phase_helpers");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/turn/turn_pipeline_phase_helpers: " + e.message);
}

// dist/game/turn/turn_pipeline_phases
try {
  var _mod148 = require("./dist/game/turn/turn_pipeline_phases");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/turn/turn_pipeline_phases: " + e.message);
}

// dist/game/turn/turn_pipeline
try {
  var _mod149 = require("./dist/game/turn/turn_pipeline");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/turn/turn_pipeline: " + e.message);
}

// dist/game/turn/pipeline_ui_adapter
try {
  var _mod150 = require("./dist/game/turn/pipeline_ui_adapter");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/turn/pipeline_ui_adapter: " + e.message);
}

// dist/game/controller-events
try {
  var _mod151 = require("./dist/game/controller-events");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/controller-events: " + e.message);
}

// dist/game/move-executor-visuals
try {
  var _mod152 = require("./dist/game/move-executor-visuals");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/move-executor-visuals: " + e.message);
}

// dist/game/special-effects/helpers
try {
  var _mod153 = require("./dist/game/special-effects/helpers");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/special-effects/helpers: " + e.message);
}

// dist/game/special-effects/bombs
try {
  var _mod154 = require("./dist/game/special-effects/bombs");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/special-effects/bombs: " + e.message);
}

// dist/game/special-effects/dragons
try {
  var _mod155 = require("./dist/game/special-effects/dragons");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/special-effects/dragons: " + e.message);
}

// dist/game/special-effects/breeding
try {
  var _mod156 = require("./dist/game/special-effects/breeding");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/special-effects/breeding: " + e.message);
}

// dist/game/special-effects/hyperactive
try {
  var _mod157 = require("./dist/game/special-effects/hyperactive");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/special-effects/hyperactive: " + e.message);
}

// dist/game/special-effects/udg
try {
  var _mod158 = require("./dist/game/special-effects/udg");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/special-effects/udg: " + e.message);
}

// dist/game/special-effects/protections
try {
  var _mod159 = require("./dist/game/special-effects/protections");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/special-effects/protections: " + e.message);
}

// dist/game/special-effects-handler
try {
  var _mod160 = require("./dist/game/special-effects-handler");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/special-effects-handler: " + e.message);
}

// dist/game/card-effects/helpers
try {
  var _mod161 = require("./dist/game/card-effects/helpers");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/helpers: " + e.message);
}

// dist/game/card-effects/selection-flow
try {
  var _mod162 = require("./dist/game/card-effects/selection-flow");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/selection-flow: " + e.message);
}

// dist/game/card-effects/placement
try {
  var _mod163 = require("./dist/game/card-effects/placement");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/placement: " + e.message);
}

// dist/game/card-effects/destroy
try {
  var _mod164 = require("./dist/game/card-effects/destroy");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/destroy: " + e.message);
}

// dist/game/card-effects/strong-wind
try {
  var _mod165 = require("./dist/game/card-effects/strong-wind");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/strong-wind: " + e.message);
}

// dist/game/card-effects/teleport
try {
  var _mod166 = require("./dist/game/card-effects/teleport");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/teleport: " + e.message);
}

// dist/game/card-effects/tempt
try {
  var _mod167 = require("./dist/game/card-effects/tempt");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/tempt: " + e.message);
}

// dist/game/card-effects/capture
try {
  var _mod168 = require("./dist/game/card-effects/capture");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/capture: " + e.message);
}

// dist/game/card-effects/time-bomb
try {
  var _mod169 = require("./dist/game/card-effects/time-bomb");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/time-bomb: " + e.message);
}

// dist/game/network-turn-handoff
try {
  var _mod170 = require("./dist/game/network-turn-handoff");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/network-turn-handoff: " + e.message);
}

// dist/game/card-effects/trap
try {
  var _mod171 = require("./dist/game/card-effects/trap");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/trap: " + e.message);
}

// dist/game/card-effects/guard
try {
  var _mod172 = require("./dist/game/card-effects/guard");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/guard: " + e.message);
}

// dist/game/card-effects/living-will
try {
  var _mod173 = require("./dist/game/card-effects/living-will");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/living-will: " + e.message);
}

// dist/game/card-effects/hyperactive-inherit
try {
  var _mod174 = require("./dist/game/card-effects/hyperactive-inherit");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/hyperactive-inherit: " + e.message);
}

// dist/game/card-effects/extend-life
try {
  var _mod175 = require("./dist/game/card-effects/extend-life");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/extend-life: " + e.message);
}

// dist/game/card-effects/swap
try {
  var _mod176 = require("./dist/game/card-effects/swap");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/swap: " + e.message);
}

// dist/game/card-effects/position-swap
try {
  var _mod177 = require("./dist/game/card-effects/position-swap");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/position-swap: " + e.message);
}

// dist/game/card-effects/board-expansion
try {
  var _mod178 = require("./dist/game/card-effects/board-expansion");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/board-expansion: " + e.message);
}

// dist/game/card-effects/board-shrink
try {
  var _mod179 = require("./dist/game/card-effects/board-shrink");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/board-shrink: " + e.message);
}

// dist/game/card-effects/blockade
try {
  var _mod180 = require("./dist/game/card-effects/blockade");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/blockade: " + e.message);
}

// dist/game/card-effects/meteor
try {
  var _mod181 = require("./dist/game/card-effects/meteor");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/meteor: " + e.message);
}

// dist/game/card-effects/freeze
try {
  var _mod182 = require("./dist/game/card-effects/freeze");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/freeze: " + e.message);
}

// dist/game/card-effects/seed
try {
  var _mod183 = require("./dist/game/card-effects/seed");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/seed: " + e.message);
}

// dist/game/card-effects/clone
try {
  var _mod184 = require("./dist/game/card-effects/clone");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/clone: " + e.message);
}

// dist/game/card-effects-applier
try {
  var _mod185 = require("./dist/game/card-effects-applier");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects-applier: " + e.message);
}

// dist/constants/cpu-lv6-shared-profile
try {
  var _mod186 = require("./dist/constants/cpu-lv6-shared-profile");
} catch (e) {
  console.warn("[boot] skip " + "dist/constants/cpu-lv6-shared-profile: " + e.message);
}

// dist/shared/cpu-lv6-runtime-capability
try {
  var _mod187 = require("./dist/shared/cpu-lv6-runtime-capability");
} catch (e) {
  console.warn("[boot] skip " + "dist/shared/cpu-lv6-runtime-capability: " + e.message);
}

// dist/game/ai/level-system
try {
  var _mod188 = require("./dist/game/ai/level-system");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/ai/level-system: " + e.message);
}

// dist/game/ai/policy-onnx-runtime
try {
  var _mod189 = require("./dist/game/ai/policy-onnx-runtime");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/ai/policy-onnx-runtime: " + e.message);
}

// dist/game/ai/policy-table-runtime
try {
  var _mod190 = require("./dist/game/ai/policy-table-runtime");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/ai/policy-table-runtime: " + e.message);
}

// dist/data/dialogue/fixed-commentary-data
try {
  var _mod191 = require("./dist/data/dialogue/fixed-commentary-data");
} catch (e) {
  console.warn("[boot] skip " + "dist/data/dialogue/fixed-commentary-data: " + e.message);
}

// dist/game/ai/fixed-commentary-engine
try {
  var _mod192 = require("./dist/game/ai/fixed-commentary-engine");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/ai/fixed-commentary-engine: " + e.message);
}

// dist/game/ai/cpu-commentary-runtime
try {
  var _mod193 = require("./dist/game/ai/cpu-commentary-runtime");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/ai/cpu-commentary-runtime: " + e.message);
}

// dist/game/cpu-decision-board-utils
try {
  var _mod194 = require("./dist/game/cpu-decision-board-utils");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/cpu-decision-board-utils: " + e.message);
}

// dist/game/cpu-decision
try {
  var _mod195 = require("./dist/game/cpu-decision");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/cpu-decision: " + e.message);
}

// dist/game/pass-handler
try {
  var _mod196 = require("./dist/game/pass-handler");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/pass-handler: " + e.message);
}

// dist/game/move-executor
try {
  var _mod197 = require("./dist/game/move-executor");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/move-executor: " + e.message);
}

// dist/game/turn-manager
try {
  var _mod198 = require("./dist/game/turn-manager");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/turn-manager: " + e.message);
}

// dist/game/cpu-turn-handler
try {
  var _mod199 = require("./dist/game/cpu-turn-handler");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/cpu-turn-handler: " + e.message);
}

// dist/game/game-controller-slim
try {
  var _mod200 = require("./dist/game/game-controller-slim");
} catch (e) {
  console.warn("[boot] skip " + "dist/game/game-controller-slim: " + e.message);
}

// dist/ui/tutorial/tutorial-state
try {
  var _mod201 = require("./dist/ui/tutorial/tutorial-state");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/tutorial/tutorial-state: " + e.message);
}

// dist/ui/tutorial/tutorial-storage
try {
  var _mod202 = require("./dist/ui/tutorial/tutorial-storage");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/tutorial/tutorial-storage: " + e.message);
}

// dist/ui/tutorial/tutorial-steps
try {
  var _mod203 = require("./dist/ui/tutorial/tutorial-steps");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/tutorial/tutorial-steps: " + e.message);
}

// dist/ui/tutorial/typewriter
try {
  var _mod204 = require("./dist/ui/tutorial/typewriter");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/tutorial/typewriter: " + e.message);
}

// dist/ui/tutorial/tutorial-overlay
try {
  var _mod205 = require("./dist/ui/tutorial/tutorial-overlay");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/tutorial/tutorial-overlay: " + e.message);
}

// dist/ui/tutorial/tutorial-action-wait
try {
  var _mod206 = require("./dist/ui/tutorial/tutorial-action-wait");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/tutorial/tutorial-action-wait: " + e.message);
}

// dist/ui/tutorial/tutorial-runtime
try {
  var _mod207 = require("./dist/ui/tutorial/tutorial-runtime");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/tutorial/tutorial-runtime: " + e.message);
}

// dist/ui/tutorial/tutorial-scenario-duel
try {
  var _mod208 = require("./dist/ui/tutorial/tutorial-scenario-duel");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/tutorial/tutorial-scenario-duel: " + e.message);
}

// dist/ui/tutorial/tutorial-controller
try {
  var _mod209 = require("./dist/ui/tutorial/tutorial-controller");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/tutorial/tutorial-controller: " + e.message);
}

// dist/ui/story/story-state
try {
  var _mod210 = require("./dist/ui/story/story-state");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/story/story-state: " + e.message);
}

// dist/ui/story/story-steps
try {
  var _mod211 = require("./dist/ui/story/story-steps");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/story/story-steps: " + e.message);
}

// dist/ui/story/story-encounter
try {
  var _mod212 = require("./dist/ui/story/story-encounter");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/story/story-encounter: " + e.message);
}

// dist/ui/story/story-controller
try {
  var _mod213 = require("./dist/ui/story/story-controller");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/story/story-controller: " + e.message);
}

// dist/ui/story/story-battle-ui
try {
  var _mod214 = require("./dist/ui/story/story-battle-ui");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/story/story-battle-ui: " + e.message);
}

// dist/ui/handlers/auto
try {
  var _mod215 = require("./dist/ui/handlers/auto");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/handlers/auto: " + e.message);
}

// dist/ui/handlers/smart
try {
  var _mod216 = require("./dist/ui/handlers/smart");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/handlers/smart: " + e.message);
}

// dist/ui/handlers/sound
try {
  var _mod217 = require("./dist/ui/handlers/sound");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/handlers/sound: " + e.message);
}

// dist/ui/handlers/rules-help
try {
  var _mod218 = require("./dist/ui/handlers/rules-help");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/handlers/rules-help: " + e.message);
}

// dist/ui/handlers/gacha
try {
  var _mod219 = require("./dist/ui/handlers/gacha");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/handlers/gacha: " + e.message);
}

// dist/ui/cosmetics/catalog-shared
try {
  var _mod220 = require("./dist/ui/cosmetics/catalog-shared");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/cosmetics/catalog-shared: " + e.message);
}

// dist/ui/background-skin/catalog
try {
  var _mod221 = require("./dist/ui/background-skin/catalog");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/background-skin/catalog: " + e.message);
}

// dist/ui/background-skin/selection
try {
  var _mod222 = require("./dist/ui/background-skin/selection");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/background-skin/selection: " + e.message);
}

// dist/ui/background-skin/runtime
try {
  var _mod223 = require("./dist/ui/background-skin/runtime");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/background-skin/runtime: " + e.message);
}

// dist/ui/background-skin/controller
try {
  var _mod224 = require("./dist/ui/background-skin/controller");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/background-skin/controller: " + e.message);
}

// dist/ui/hand-skin/catalog
try {
  var _mod225 = require("./dist/ui/hand-skin/catalog");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/hand-skin/catalog: " + e.message);
}

// dist/ui/hand-skin/selection
try {
  var _mod226 = require("./dist/ui/hand-skin/selection");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/hand-skin/selection: " + e.message);
}

// dist/ui/hand-skin/runtime
try {
  var _mod227 = require("./dist/ui/hand-skin/runtime");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/hand-skin/runtime: " + e.message);
}

// dist/ui/hand-skin/controller
try {
  var _mod228 = require("./dist/ui/hand-skin/controller");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/hand-skin/controller: " + e.message);
}

// dist/ui/handlers/hand-skin
try {
  var _mod229 = require("./dist/ui/handlers/hand-skin");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/handlers/hand-skin: " + e.message);
}

// dist/ui/handlers/story
try {
  var _mod230 = require("./dist/ui/handlers/story");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/handlers/story: " + e.message);
}

// dist/ui/handlers/tutorial
try {
  var _mod231 = require("./dist/ui/handlers/tutorial");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/handlers/tutorial: " + e.message);
}

// dist/ui/handlers/cpu-policy
try {
  var _mod232 = require("./dist/ui/handlers/cpu-policy");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/handlers/cpu-policy: " + e.message);
}

// dist/ui/handlers/deck-builder
try {
  var _mod233 = require("./dist/ui/handlers/deck-builder");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/handlers/deck-builder: " + e.message);
}

// dist/ui/handlers/match-mode
try {
  var _mod234 = require("./dist/ui/handlers/match-mode");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/handlers/match-mode: " + e.message);
}

// dist/ui/handlers/debug
try {
  var _mod235 = require("./dist/ui/handlers/debug");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/handlers/debug: " + e.message);
}

// dist/ui/handlers/init
try {
  var _mod236 = require("./dist/ui/handlers/init");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/handlers/init: " + e.message);
}

// dist/ui/presentation-handler
try {
  var _mod237 = require("./dist/ui/presentation-handler");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/presentation-handler: " + e.message);
}

// dist/ui/event-handlers
try {
  var _mod238 = require("./dist/ui/event-handlers");
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/event-handlers: " + e.message);
}

// ===== Global contract restoration =====
if (typeof window.CoreLogic !== "undefined") window.CoreLogic = window.CoreLogic;
if (typeof window.CardLogic !== "undefined") window.CardLogic = window.CardLogic;
if (typeof window.CardSystem !== "undefined") window.CardSystem = window.CardSystem;

// ===== Browser runtime shims =====
window.getElement = function(k) {
  var m = {board:"board",boardFrame:"board-frame",deckBlack:"deck-black",deckWhite:"deck-white",handBlack:"hand-black",handWhite:"hand-white",chargeBlack:"charge-black",chargeWhite:"charge-white",log:"log",handLayer:"handLayer",heldStone:"heldStone",cardFxLayer:"card-fx-layer",handImage:"handImage",cpuCharacterImg:"cpu-character-img",cpuLevelLabel:"cpu-level-label"};
  return m[k] ? document.getElementById(m[k]) : null;
};
window.initializeElementCache = function() {};
window.clearElementCache = function() {};