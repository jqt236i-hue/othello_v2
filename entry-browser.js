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
  if (_mod1) Object.assign(window, _mod1);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/layout-stage: " + e.message);
}

// dist/is-env-capable
try {
  var _mod2 = require("./dist/is-env-capable");
  if (_mod2) Object.assign(window, _mod2);
} catch (e) {
  console.warn("[boot] skip " + "dist/is-env-capable: " + e.message);
}

// dist/constants/difficulty-constants
try {
  var _mod3 = require("./dist/constants/difficulty-constants");
  if (_mod3) Object.assign(window, _mod3);
} catch (e) {
  console.warn("[boot] skip " + "dist/constants/difficulty-constants: " + e.message);
}

// dist/constants/ui-element-cache
try {
  var _mod4 = require("./dist/constants/ui-element-cache");
  if (_mod4) Object.assign(window, _mod4);
} catch (e) {
  console.warn("[boot] skip " + "dist/constants/ui-element-cache: " + e.message);
}

// dist/constants/animation-constants
try {
  var _mod5 = require("./dist/constants/animation-constants");
  if (_mod5) Object.assign(window, _mod5);
} catch (e) {
  console.warn("[boot] skip " + "dist/constants/animation-constants: " + e.message);
}

// dist/cards/catalog
try {
  var _mod6 = require("./dist/cards/catalog");
  if (_mod6) {
    Object.assign(window, _mod6);
    window.CardCatalog = _mod6;
  }
} catch (e) {
  console.warn("[boot] skip " + "dist/cards/catalog: " + e.message);
}

// dist/shared-constants
try {
  var _mod7 = require("./dist/shared-constants");
  if (_mod7) Object.assign(window, _mod7);
} catch (e) {
  console.warn("[boot] skip " + "dist/shared-constants: " + e.message);
}

// dist/shared/shared-board-utils
try {
  var _mod8 = require("./dist/shared/shared-board-utils");
  if (_mod8) Object.assign(window, _mod8);
} catch (e) {
  console.warn("[boot] skip " + "dist/shared/shared-board-utils: " + e.message);
}

// dist/shared/deck-spec
try {
  var _mod9 = require("./dist/shared/deck-spec");
  if (_mod9) Object.assign(window, _mod9);
} catch (e) {
  console.warn("[boot] skip " + "dist/shared/deck-spec: " + e.message);
}

// dist/shared/deck-codec
try {
  var _mod10 = require("./dist/shared/deck-codec");
  if (_mod10) Object.assign(window, _mod10);
} catch (e) {
  console.warn("[boot] skip " + "dist/shared/deck-codec: " + e.message);
}

// dist/shared/destroy-outcome-contract
try {
  var _mod11 = require("./dist/shared/destroy-outcome-contract");
  if (_mod11) Object.assign(window, _mod11);
} catch (e) {
  console.warn("[boot] skip " + "dist/shared/destroy-outcome-contract: " + e.message);
}

// dist/shared/special-stone-registry
try {
  var _mod12 = require("./dist/shared/special-stone-registry");
  if (_mod12) Object.assign(window, _mod12);
} catch (e) {
  console.warn("[boot] skip " + "dist/shared/special-stone-registry: " + e.message);
}

// dist/shared/stone-status-snapshot
try {
  var _mod13 = require("./dist/shared/stone-status-snapshot");
  if (_mod13) Object.assign(window, _mod13);
} catch (e) {
  console.warn("[boot] skip " + "dist/shared/stone-status-snapshot: " + e.message);
}

// dist/shared/shared-board-utils
try {
  var _mod14 = require("./dist/shared/shared-board-utils");
  if (_mod14) Object.assign(window, _mod14);
} catch (e) {
  console.warn("[boot] skip " + "dist/shared/shared-board-utils: " + e.message);
}

// dist/game/logic/markers_adapter
try {
  var _mod15 = require("./dist/game/logic/markers_adapter");
  if (_mod15) Object.assign(window, _mod15);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/markers_adapter: " + e.message);
}

// dist/game/logic/cards-internal/random-source
try {
  var _mod16 = require("./dist/game/logic/cards-internal/random-source");
  if (_mod16) Object.assign(window, _mod16);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards-internal/random-source: " + e.message);
}

// dist/game/logic/cards-internal/state-factory
try {
  var _mod17 = require("./dist/game/logic/cards-internal/state-factory");
  if (_mod17) Object.assign(window, _mod17);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards-internal/state-factory: " + e.message);
}

// dist/game/logic/cards-internal/module-resolver
try {
  var _mod18 = require("./dist/game/logic/cards-internal/module-resolver");
  if (_mod18) Object.assign(window, _mod18);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards-internal/module-resolver: " + e.message);
}

// dist/game/logic/cards-internal/presentation-helpers
try {
  var _mod19 = require("./dist/game/logic/cards-internal/presentation-helpers");
  if (_mod19) Object.assign(window, _mod19);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards-internal/presentation-helpers: " + e.message);
}

// dist/game/logic/board_ops
try {
  var _mod20 = require("./dist/game/logic/board_ops");
  if (_mod20) Object.assign(window, _mod20);
  if (_mod20) window.BoardOps = _mod20;
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/board_ops: " + e.message);
}

// dist/utils/owner-helpers
try {
  var _mod21 = require("./dist/utils/owner-helpers");
  if (_mod21) Object.assign(window, _mod21);
} catch (e) {
  console.warn("[boot] skip " + "dist/utils/owner-helpers: " + e.message);
}

// dist/game/logic/core
try {
  var _mod22 = require("./dist/game/logic/core");
  if (_mod22) Object.assign(window, _mod22);
  window.CoreLogic = _mod22;
  window.Core = _mod22;
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/core: " + e.message);
}

// dist/game/logic/cards/defs
try {
  var _mod23 = require("./dist/game/logic/cards/defs");
  if (_mod23) Object.assign(window, _mod23);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/defs: " + e.message);
}

// dist/game/logic/cards/costs
try {
  var _mod24 = require("./dist/game/logic/cards/costs");
  if (_mod24) Object.assign(window, _mod24);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/costs: " + e.message);
}

// dist/game/logic/cards/utils
try {
  var _mod25 = require("./dist/game/logic/cards/utils");
  if (_mod25) Object.assign(window, _mod25);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/utils: " + e.message);
}

// dist/game/logic/cards/targets
try {
  var _mod26 = require("./dist/game/logic/cards/targets");
  if (_mod26) Object.assign(window, _mod26);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/targets: " + e.message);
}

// dist/game/logic/cards/selectors
try {
  var _mod27 = require("./dist/game/logic/cards/selectors");
  if (_mod27) Object.assign(window, _mod27);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/selectors: " + e.message);
}

// dist/game/logic/cards/flips
try {
  var _mod28 = require("./dist/game/logic/cards/flips");
  if (_mod28) Object.assign(window, _mod28);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/flips: " + e.message);
}

// dist/game/logic/cards/chain
try {
  var _mod29 = require("./dist/game/logic/cards/chain");
  if (_mod29) Object.assign(window, _mod29);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/chain: " + e.message);
}

// dist/game/logic/cards/regen
try {
  var _mod30 = require("./dist/game/logic/cards/regen");
  if (_mod30) Object.assign(window, _mod30);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/regen: " + e.message);
}

// dist/game/logic/cards/time_bomb
try {
  var _mod31 = require("./dist/game/logic/cards/time_bomb");
  if (_mod31) Object.assign(window, _mod31);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/time_bomb: " + e.message);
}

// dist/game/logic/cards/breeding
try {
  var _mod32 = require("./dist/game/logic/cards/breeding");
  if (_mod32) Object.assign(window, _mod32);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/breeding: " + e.message);
}

// dist/game/logic/cards/hyperactive
try {
  var _mod33 = require("./dist/game/logic/cards/hyperactive");
  if (_mod33) Object.assign(window, _mod33);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/hyperactive: " + e.message);
}

// dist/game/logic/cards/udg
try {
  var _mod34 = require("./dist/game/logic/cards/udg");
  if (_mod34) Object.assign(window, _mod34);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/udg: " + e.message);
}

// dist/game/logic/cards/sniper
try {
  var _mod35 = require("./dist/game/logic/cards/sniper");
  if (_mod35) Object.assign(window, _mod35);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/sniper: " + e.message);
}

// dist/game/logic/cards/lightning
try {
  var _mod36 = require("./dist/game/logic/cards/lightning");
  if (_mod36) Object.assign(window, _mod36);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/lightning: " + e.message);
}

// dist/game/logic/cards/destroy_dragon
try {
  var _mod37 = require("./dist/game/logic/cards/destroy_dragon");
  if (_mod37) Object.assign(window, _mod37);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/destroy_dragon: " + e.message);
}

// dist/game/logic/cards/will_hunter_king
try {
  var _mod38 = require("./dist/game/logic/cards/will_hunter_king");
  if (_mod38) Object.assign(window, _mod38);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/will_hunter_king: " + e.message);
}

// dist/game/logic/cards/work_will
try {
  var _mod39 = require("./dist/game/logic/cards/work_will");
  if (_mod39) Object.assign(window, _mod39);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/work_will: " + e.message);
}

// dist/game/logic/cards/expansion
try {
  var _mod40 = require("./dist/game/logic/cards/expansion");
  if (_mod40) Object.assign(window, _mod40);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/expansion: " + e.message);
}

// dist/game/logic/cards/markers
try {
  var _mod41 = require("./dist/game/logic/cards/markers");
  if (_mod41) Object.assign(window, _mod41);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/markers: " + e.message);
}

// dist/game/logic/cards/living_will
try {
  var _mod42 = require("./dist/game/logic/cards/living_will");
  if (_mod42) Object.assign(window, _mod42);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/living_will: " + e.message);
}

// dist/game/logic/cards/movement
try {
  var _mod43 = require("./dist/game/logic/cards/movement");
  if (_mod43) Object.assign(window, _mod43);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/movement: " + e.message);
}

// dist/game/logic/cards/teleport
try {
  var _mod44 = require("./dist/game/logic/cards/teleport");
  if (_mod44) Object.assign(window, _mod44);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/teleport: " + e.message);
}

// dist/game/logic/cards/clone
try {
  var _mod45 = require("./dist/game/logic/cards/clone");
  if (_mod45) Object.assign(window, _mod45);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/clone: " + e.message);
}

// dist/game/logic/cards/meteor
try {
  var _mod46 = require("./dist/game/logic/cards/meteor");
  if (_mod46) Object.assign(window, _mod46);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/meteor: " + e.message);
}

// dist/game/logic/cards/shrink
try {
  var _mod47 = require("./dist/game/logic/cards/shrink");
  if (_mod47) Object.assign(window, _mod47);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards/shrink: " + e.message);
}

// dist/game/logic/effects/dragon
try {
  var _mod48 = require("./dist/game/logic/effects/dragon");
  if (_mod48) Object.assign(window, _mod48);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/effects/dragon: " + e.message);
}

// dist/game/logic/effects/swap_with_enemy
try {
  var _mod49 = require("./dist/game/logic/effects/swap_with_enemy");
  if (_mod49) Object.assign(window, _mod49);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/effects/swap_with_enemy: " + e.message);
}

// dist/game/logic/effects/destroy_one_stone
try {
  var _mod50 = require("./dist/game/logic/effects/destroy_one_stone");
  if (_mod50) Object.assign(window, _mod50);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/effects/destroy_one_stone: " + e.message);
}

// dist/game/cards/effects/ownership
try {
  var _mod51 = require("./dist/game/cards/effects/ownership");
  if (_mod51) Object.assign(window, _mod51);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/cards/effects/ownership: " + e.message);
}

// dist/game/cards/effects/board-expansion-apply
try {
  var _mod52 = require("./dist/game/cards/effects/board-expansion-apply");
  if (_mod52) Object.assign(window, _mod52);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/cards/effects/board-expansion-apply: " + e.message);
}

// dist/game/cards/effects/status-cells
try {
  var _mod53 = require("./dist/game/cards/effects/status-cells");
  if (_mod53) Object.assign(window, _mod53);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/cards/effects/status-cells: " + e.message);
}

// dist/game/cards/effects/hand-effects
try {
  var _mod54 = require("./dist/game/cards/effects/hand-effects");
  if (_mod54) Object.assign(window, _mod54);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/cards/effects/hand-effects: " + e.message);
}

// dist/game/cards/effects/position-swap
try {
  var _mod55 = require("./dist/game/cards/effects/position-swap");
  if (_mod55) Object.assign(window, _mod55);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/cards/effects/position-swap: " + e.message);
}

// dist/game/logic/cards-internal/card-usage-prechecks
try {
  var _mod56 = require("./dist/game/logic/cards-internal/card-usage-prechecks");
  if (_mod56) Object.assign(window, _mod56);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards-internal/card-usage-prechecks: " + e.message);
}

// dist/game/logic/cards-internal/selector-orchestrator
try {
  var _mod57 = require("./dist/game/logic/cards-internal/selector-orchestrator");
  if (_mod57) Object.assign(window, _mod57);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards-internal/selector-orchestrator: " + e.message);
}

// dist/game/logic/cards-internal/hand-manager
try {
  var _mod58 = require("./dist/game/logic/cards-internal/hand-manager");
  if (_mod58) Object.assign(window, _mod58);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards-internal/hand-manager: " + e.message);
}

// dist/game/logic/cards-internal/effect-timing
try {
  var _mod59 = require("./dist/game/logic/cards-internal/effect-timing");
  if (_mod59) Object.assign(window, _mod59);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards-internal/effect-timing: " + e.message);
}

// dist/game/logic/cards-internal/pending-state-manager
try {
  var _mod60 = require("./dist/game/logic/cards-internal/pending-state-manager");
  if (_mod60) Object.assign(window, _mod60);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards-internal/pending-state-manager: " + e.message);
}

// dist/game/turn/pending-coordinator
try {
  var _mod61 = require("./dist/game/turn/pending-coordinator");
  if (_mod61) Object.assign(window, _mod61);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/turn/pending-coordinator: " + e.message);
}

// dist/game/logic/cards-internal/charge-ledger
try {
  var _mod62 = require("./dist/game/logic/cards-internal/charge-ledger");
  if (_mod62) Object.assign(window, _mod62);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards-internal/charge-ledger: " + e.message);
}

// dist/game/logic/cards
try {
  var _mod63 = require("./dist/game/logic/cards");
  if (_mod63) Object.assign(window, _mod63);
  window.CardLogic = _mod63;
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/cards: " + e.message);
}

// dist/game/logic/presentation
try {
  var _mod64 = require("./dist/game/logic/presentation");
  if (_mod64) Object.assign(window, _mod64);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/presentation: " + e.message);
}

// dist/game/logic/position-weights
try {
  var _mod65 = require("./dist/game/logic/position-weights");
  if (_mod65) Object.assign(window, _mod65);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/logic/position-weights: " + e.message);
}

// dist/game/schema/prng
try {
  var _mod66 = require("./dist/game/schema/prng");
  if (_mod66) Object.assign(window, _mod66);
  window.SeededPRNG = _mod66;
} catch (e) {
  console.warn("[boot] skip " + "dist/game/schema/prng: " + e.message);
}

// dist/game/schema/action_manager
try {
  var _mod67 = require("./dist/game/schema/action_manager");
  if (_mod67) Object.assign(window, _mod67);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/schema/action_manager: " + e.message);
}

// dist/game-events
try {
  var _mod68 = require("./dist/game-events");
  if (_mod68) Object.assign(window, _mod68);
  window.GameEvents = _mod68;
} catch (e) {
  console.warn("[boot] skip " + "dist/game-events: " + e.message);
}

// dist/game/game-core-logic
try {
  var _mod69 = require("./dist/game/game-core-logic");
  if (_mod69) Object.assign(window, _mod69);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/game-core-logic: " + e.message);
}

// dist/game/move-generator
try {
  var _mod70 = require("./dist/game/move-generator");
  if (_mod70) Object.assign(window, _mod70);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/move-generator: " + e.message);
}

// dist/card-system
try {
  var _mod71 = require("./dist/card-system");
  if (_mod71) Object.assign(window, _mod71);
} catch (e) {
  console.warn("[boot] skip " + "dist/card-system: " + e.message);
}

// dist/ui/storage/action-log
try {
  var _mod72 = require("./dist/ui/storage/action-log");
  if (_mod72) Object.assign(window, _mod72);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/storage/action-log: " + e.message);
}

// dist/shared/commentary-context-helpers
try {
  var _mod73 = require("./dist/shared/commentary-context-helpers");
  if (_mod73) Object.assign(window, _mod73);
} catch (e) {
  console.warn("[boot] skip " + "dist/shared/commentary-context-helpers: " + e.message);
}

// dist/shared/commentary-runtime-helpers
try {
  var _mod74 = require("./dist/shared/commentary-runtime-helpers");
  if (_mod74) Object.assign(window, _mod74);
} catch (e) {
  console.warn("[boot] skip " + "dist/shared/commentary-runtime-helpers: " + e.message);
}

// dist/shared/playback-event-helpers
try {
  var _mod75 = require("./dist/shared/playback-event-helpers");
  if (_mod75) Object.assign(window, _mod75);
} catch (e) {
  console.warn("[boot] skip " + "dist/shared/playback-event-helpers: " + e.message);
}

// dist/ui/commentary-broker
try {
  var _mod76 = require("./dist/ui/commentary-broker");
  if (_mod76) Object.assign(window, _mod76);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/commentary-broker: " + e.message);
}

// dist/ui/bootstrap
try {
  var _mod77 = require("./dist/ui/bootstrap");
  if (_mod77) Object.assign(window, _mod77);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/bootstrap: " + e.message);
}

// dist/ui/bootstrap/init-dom
try {
  var _mod78 = require("./dist/ui/bootstrap/init-dom");
  if (_mod78) Object.assign(window, _mod78);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/bootstrap/init-dom: " + e.message);
}

// dist/ui/bootstrap/init-events
try {
  var _mod79 = require("./dist/ui/bootstrap/init-events");
  if (_mod79) Object.assign(window, _mod79);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/bootstrap/init-events: " + e.message);
}

// dist/ui/bootstrap/init-game
try {
  var _mod80 = require("./dist/ui/bootstrap/init-game");
  if (_mod80) Object.assign(window, _mod80);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/bootstrap/init-game: " + e.message);
}

// dist/ui/bootstrap/init-network
try {
  var _mod81 = require("./dist/ui/bootstrap/init-network");
  if (_mod81) Object.assign(window, _mod81);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/bootstrap/init-network: " + e.message);
}

// dist/ui/marker-bridge
try {
  var _mod82 = require("./dist/ui/marker-bridge");
  if (_mod82) Object.assign(window, _mod82);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/marker-bridge: " + e.message);
}

// dist/ui
try {
  var _mod83 = require("./dist/ui");
  if (_mod83) Object.assign(window, _mod83);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui: " + e.message);
}

// dist/ui/animation-resolver
try {
  var _mod84 = require("./dist/ui/animation-resolver");
  if (_mod84) Object.assign(window, _mod84);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/animation-resolver: " + e.message);
}

// dist/ui/animation-shared
try {
  var _mod85 = require("./dist/ui/animation-shared");
  if (_mod85) Object.assign(window, _mod85);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/animation-shared: " + e.message);
}

// dist/ui/animation-helpers
try {
  var _mod86 = require("./dist/ui/animation-helpers");
  if (_mod86) Object.assign(window, _mod86);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/animation-helpers: " + e.message);
}

// dist/ui/playback-runtime
try {
  var _mod87 = require("./dist/ui/playback-runtime");
  if (_mod87) Object.assign(window, _mod87);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/playback-runtime: " + e.message);
}

// dist/ui/playback-state-manager
try {
  var _mod88 = require("./dist/ui/playback-state-manager");
  if (_mod88) Object.assign(window, _mod88);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/playback-state-manager: " + e.message);
}

// dist/ui/board-update-dispatch
try {
  var _mod89 = require("./dist/ui/board-update-dispatch");
  if (_mod89) Object.assign(window, _mod89);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/board-update-dispatch: " + e.message);
}

// dist/ui/board-update-sync-runtime
try {
  var _mod90 = require("./dist/ui/board-update-sync-runtime");
  if (_mod90) Object.assign(window, _mod90);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/board-update-sync-runtime: " + e.message);
}

// dist/ui/diff-renderer
try {
  var _mod91 = require("./dist/ui/diff-renderer");
  if (_mod91) Object.assign(window, _mod91);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/diff-renderer: " + e.message);
}

// dist/ui/board-renderer
try {
  var _mod92 = require("./dist/ui/board-renderer");
  if (_mod92) Object.assign(window, _mod92);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/board-renderer: " + e.message);
}

// dist/ui/status-display
try {
  var _mod93 = require("./dist/ui/status-display");
  if (_mod93) Object.assign(window, _mod93);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/status-display: " + e.message);
}

// dist/ui/animation-utils
try {
  var _mod94 = require("./dist/ui/animation-utils");
  if (_mod94) Object.assign(window, _mod94);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/animation-utils: " + e.message);
}

// dist/ui/stone-visuals
try {
  var _mod95 = require("./dist/ui/stone-visuals");
  if (_mod95) Object.assign(window, _mod95);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/stone-visuals: " + e.message);
}

// dist/ui/animation-constants
try {
  var _mod96 = require("./dist/ui/animation-constants");
  if (_mod96) Object.assign(window, _mod96);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/animation-constants: " + e.message);
}

// dist/ui/animation-engine
try {
  var _mod97 = require("./dist/ui/animation-engine");
  if (_mod97) Object.assign(window, _mod97);
  if (_mod97) window.AnimationEngine = _mod97;
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/animation-engine: " + e.message);
}

// dist/ui/playback-engine
try {
  var _mod98 = require("./dist/ui/playback-engine");
  if (_mod98) Object.assign(window, _mod98);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/playback-engine: " + e.message);
}

// dist/ui/move-executor-visuals
try {
  var _mod99 = require("./dist/ui/move-executor-visuals");
  if (_mod99) Object.assign(window, _mod99);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/move-executor-visuals: " + e.message);
}

// dist/ui/visual-effects-map
try {
  var _mod100 = require("./dist/ui/visual-effects-map");
  if (_mod100) Object.assign(window, _mod100);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/visual-effects-map: " + e.message);
}

// dist/shared/gacha-helpers
try {
  var _mod101 = require("./dist/shared/gacha-helpers");
  if (_mod101) Object.assign(window, _mod101);
  if (_mod101) window.GachaHelpersModule = _mod101;
  if (_mod101) window.GachaHelpersModule = _mod101;
} catch (e) {
  console.warn("[boot] skip " + "dist/shared/gacha-helpers: " + e.message);
}

// dist/shared/observation-gacha-catalog-shared
try {
  var _mod102 = require("./dist/shared/observation-gacha-catalog-shared");
  if (_mod102) Object.assign(window, _mod102);
  if (_mod102) window.ObservationGachaCatalogSharedModule = _mod102;
} catch (e) {
  console.warn("[boot] skip " + "dist/shared/observation-gacha-catalog-shared: " + e.message);
}

// dist/shared/observation-gacha-catalog.generated
try {
  var _mod103 = require("./dist/shared/observation-gacha-catalog.generated");
  if (_mod103) Object.assign(window, _mod103);
  if (_mod103) window.ObservationGachaCatalogModule = _mod103;
} catch (e) {
  console.warn("[boot] skip " + "dist/shared/observation-gacha-catalog.generated: " + e.message);
}

// dist/shared/gacha-hand-catalog-shared
try {
  var _mod104 = require("./dist/shared/gacha-hand-catalog-shared");
  if (_mod104) Object.assign(window, _mod104);
  if (_mod104) window.GachaHandCatalogSharedModule = _mod104;
} catch (e) {
  console.warn("[boot] skip " + "dist/shared/gacha-hand-catalog-shared: " + e.message);
}

// dist/shared/gacha-hand-catalog.generated
try {
  var _mod105 = require("./dist/shared/gacha-hand-catalog.generated");
  if (_mod105) Object.assign(window, _mod105);
  if (_mod105) window.GachaHandCatalogModule = _mod105;
} catch (e) {
  console.warn("[boot] skip " + "dist/shared/gacha-hand-catalog.generated: " + e.message);
}

// dist/ui/storage/gacha-progress
try {
  var _mod106 = require("./dist/ui/storage/gacha-progress");
  if (_mod106) Object.assign(window, _mod106);
  if (_mod106) window.GachaProgressStorageModule = _mod106;
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/storage/gacha-progress: " + e.message);
}

// dist/ui/gacha/gacha-events
try {
  var _mod107 = require("./dist/ui/gacha/gacha-events");
  if (_mod107) Object.assign(window, _mod107);
  if (_mod107) window.GachaEventsModule = _mod107;
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/gacha/gacha-events: " + e.message);
}

// dist/ui/gacha/catalog-access
try {
  var _mod108 = require("./dist/ui/gacha/catalog-access");
  if (_mod108) Object.assign(window, _mod108);
  if (_mod108) window.ObservationGachaCatalogAccessModule = _mod108;
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/gacha/catalog-access: " + e.message);
}

// dist/ui/placement-sound-selection
try {
  var _mod109 = require("./dist/ui/placement-sound-selection");
  if (_mod109) Object.assign(window, _mod109);
  if (_mod109) window.PlacementSoundSelectionModule = _mod109;
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/placement-sound-selection: " + e.message);
}

// dist/ui/gacha/gacha-transaction
try {
  var _mod110 = require("./dist/ui/gacha/gacha-transaction");
  if (_mod110) {
    Object.assign(window, _mod110);
    window.GachaTransactionModule = _mod110;
  }
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/gacha/gacha-transaction: " + e.message);
}

// dist/ui/gacha/gacha-item-visuals
try {
  var _mod111 = require("./dist/ui/gacha/gacha-item-visuals");
  if (_mod111) Object.assign(window, _mod111);
  if (_mod111) window.GachaItemVisualsModule = _mod111;
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/gacha/gacha-item-visuals: " + e.message);
}

// dist/ui/gacha/gacha-overlay-view
try {
  var _mod112 = require("./dist/ui/gacha/gacha-overlay-view");
  if (_mod112) {
    Object.assign(window, _mod112);
    window.GachaOverlayViewModule = _mod112;
  }
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/gacha/gacha-overlay-view: " + e.message);
}

// dist/ui/gacha/gacha-overlay-controller
try {
  var _mod113 = require("./dist/ui/gacha/gacha-overlay-controller");
  if (_mod113) {
    Object.assign(window, _mod113);
    window.GachaOverlayControllerModule = _mod113;
  }
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/gacha/gacha-overlay-controller: " + e.message);
}

// dist/ui/gacha/gacha-reveal-stage
try {
  var _mod114 = require("./dist/ui/gacha/gacha-reveal-stage");
  if (_mod114) Object.assign(window, _mod114);
  if (_mod114) window.GachaRevealStageModule = _mod114;
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/gacha/gacha-reveal-stage: " + e.message);
}

// dist/ui/sound-engine-access
try {
  var _mod115 = require("./dist/ui/sound-engine-access");
  if (_mod115) Object.assign(window, _mod115);
  if (_mod115) window.SoundEngineAccessModule = _mod115;
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/sound-engine-access: " + e.message);
}

// dist/ui/gacha/gacha-reveal-audio
try {
  var _mod116 = require("./dist/ui/gacha/gacha-reveal-audio");
  if (_mod116) Object.assign(window, _mod116);
  if (_mod116) window.GachaRevealAudioModule = _mod116;
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/gacha/gacha-reveal-audio: " + e.message);
}

// dist/ui/gacha-reveal-player
try {
  var _mod117 = require("./dist/ui/gacha-reveal-player");
  if (_mod117) Object.assign(window, _mod117);
  if (_mod117) window.GachaRevealPlayerModule = _mod117;
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/gacha-reveal-player: " + e.message);
}

// dist/ui/leaderboard-client
try {
  var _mod118 = require("./dist/ui/leaderboard-client");
  if (_mod118) Object.assign(window, _mod118);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/leaderboard-client: " + e.message);
}

// dist/ui/result-overlay
try {
  var _mod119 = require("./dist/ui/result-overlay");
  if (_mod119) Object.assign(window, _mod119);
  if (_mod119) window.ResultOverlayModule = _mod119;
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/result-overlay: " + e.message);
}

// dist/shared/network-action-schema
try {
  var _mod120 = require("./dist/shared/network-action-schema");
  if (_mod120) Object.assign(window, _mod120);
  if (_mod120) window.NetworkActionSchemaModule = _mod120;
} catch (e) {
  console.warn("[boot] skip " + "dist/shared/network-action-schema: " + e.message);
}

// dist/ui/network/commentary
try {
  var _mod121 = require("./dist/ui/network/commentary");
  if (_mod121) Object.assign(window, _mod121);
  if (_mod121) window.NetworkCommentaryModule = _mod121;
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/network/commentary: " + e.message);
}

// dist/ui/network/command-payload
try {
  var _mod122 = require("./dist/ui/network/command-payload");
  if (_mod122) Object.assign(window, _mod122);
  if (_mod122) window.NetworkCommandPayloadModule = _mod122;
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/network/command-payload: " + e.message);
}

// dist/ui/network/publish-request
try {
  var _mod123 = require("./dist/ui/network/publish-request");
  if (_mod123) Object.assign(window, _mod123);
  if (_mod123) window.NetworkPublishRequestModule = _mod123;
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/network/publish-request: " + e.message);
}

// dist/ui/network/action-bridge
try {
  var _mod124 = require("./dist/ui/network/action-bridge");
  if (_mod124) Object.assign(window, _mod124);
  if (_mod124) window.NetworkActionBridgeModule = _mod124;
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/network/action-bridge: " + e.message);
}

// dist/ui/network/apply-coordinator
try {
  var _mod125 = require("./dist/ui/network/apply-coordinator");
  if (_mod125) Object.assign(window, _mod125);
  if (_mod125) window.NetworkApplyCoordinatorModule = _mod125;
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/network/apply-coordinator: " + e.message);
}

// dist/ui/network/reconnect-controller
try {
  var _mod126 = require("./dist/ui/network/reconnect-controller");
  if (_mod126) Object.assign(window, _mod126);
  if (_mod126) window.NetworkReconnectControllerModule = _mod126;
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/network/reconnect-controller: " + e.message);
}

// dist/ui/network/publish-tracker
try {
  var _mod127 = require("./dist/ui/network/publish-tracker");
  if (_mod127) Object.assign(window, _mod127);
  if (_mod127) window.NetworkPublishTrackerModule = _mod127;
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/network/publish-tracker: " + e.message);
}

// dist/ui/network/snapshot-runtime
try {
  var _mod128 = require("./dist/ui/network/snapshot-runtime");
  if (_mod128) Object.assign(window, _mod128);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/network/snapshot-runtime: " + e.message);
}

// dist/ui/network/snapshot-canonical
try {
  var _mod129 = require("./dist/ui/network/snapshot-canonical");
  if (_mod129) Object.assign(window, _mod129);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/network/snapshot-canonical: " + e.message);
}

// dist/ui/network/snapshot-presentation
try {
  var _mod130 = require("./dist/ui/network/snapshot-presentation");
  if (_mod130) Object.assign(window, _mod130);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/network/snapshot-presentation: " + e.message);
}

// dist/ui/network/snapshot
try {
  var _mod131 = require("./dist/ui/network/snapshot");
  if (_mod131) Object.assign(window, _mod131);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/network/snapshot: " + e.message);
}

// dist/ui/network/session-seat
try {
  var _mod132 = require("./dist/ui/network/session-seat");
  if (_mod132) Object.assign(window, _mod132);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/network/session-seat: " + e.message);
}

// dist/ui/network/session-lifecycle
try {
  var _mod133 = require("./dist/ui/network/session-lifecycle");
  if (_mod133) Object.assign(window, _mod133);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/network/session-lifecycle: " + e.message);
}

// dist/ui/network-client
try {
  var _mod134 = require("./dist/ui/network-client");
  if (_mod134) Object.assign(window, _mod134);
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
  if (_mod136) Object.assign(window, _mod136);
  if (_mod136) window.HandAnimationUtilsModule = _mod136;
} catch (e) {
  console.warn("[boot] skip " + "dist/cards/card-renderer: " + e.message);
}

// dist/cards/card-interaction-effects
try {
  var _mod137 = require("./dist/cards/card-interaction-effects");
  if (_mod137) Object.assign(window, _mod137);
} catch (e) {
  console.warn("[boot] skip " + "dist/cards/card-interaction-effects: " + e.message);
}

// dist/cards/card-interaction
try {
  var _mod138 = require("./dist/cards/card-interaction");
  if (_mod138) Object.assign(window, _mod138);
} catch (e) {
  console.warn("[boot] skip " + "dist/cards/card-interaction: " + e.message);
}

// dist/ui/storage/deck-presets
try {
  var _mod139 = require("./dist/ui/storage/deck-presets");
  if (_mod139) Object.assign(window, _mod139);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/storage/deck-presets: " + e.message);
}

// dist/ui/deck-builder-state
try {
  var _mod140 = require("./dist/ui/deck-builder-state");
  if (_mod140) Object.assign(window, _mod140);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/deck-builder-state: " + e.message);
}

// dist/ui/deck-builder-renderer
try {
  var _mod141 = require("./dist/ui/deck-builder-renderer");
  if (_mod141) Object.assign(window, _mod141);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/deck-builder-renderer: " + e.message);
}

// dist/ui/deck-builder-controller
try {
  var _mod142 = require("./dist/ui/deck-builder-controller");
  if (_mod142) {
    Object.assign(window, _mod142);
    window.DeckBuilderControllerModule = _mod142;
  }
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/deck-builder-controller: " + e.message);
}

// dist/game/timers
try {
  var _mod143 = require("./dist/game/timers");
  if (_mod143) Object.assign(window, _mod143);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/timers: " + e.message);
}

// dist/game/auto
try {
  var _mod144 = require("./dist/game/auto");
  if (_mod144) Object.assign(window, _mod144);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/auto: " + e.message);
}

// dist/game/visual-effects-map
try {
  var _mod145 = require("./dist/game/visual-effects-map");
  if (_mod145) Object.assign(window, _mod145);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/visual-effects-map: " + e.message);
}

// dist/game/log-messages
try {
  var _mod146 = require("./dist/game/log-messages");
  if (_mod146) Object.assign(window, _mod146);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/log-messages: " + e.message);
}

// dist/game/turn/turn_pipeline_phase_helpers
try {
  var _mod147 = require("./dist/game/turn/turn_pipeline_phase_helpers");
  if (_mod147) Object.assign(window, _mod147);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/turn/turn_pipeline_phase_helpers: " + e.message);
}

// dist/game/turn/turn_pipeline_phases
try {
  var _mod148 = require("./dist/game/turn/turn_pipeline_phases");
  if (_mod148) Object.assign(window, _mod148);
  window.TurnPipelinePhases = _mod148;
} catch (e) {
  console.warn("[boot] skip " + "dist/game/turn/turn_pipeline_phases: " + e.message);
}

// dist/game/turn/turn_pipeline
try {
  var _mod149 = require("./dist/game/turn/turn_pipeline");
  if (_mod149) Object.assign(window, _mod149);
  window.TurnPipeline = _mod149;
} catch (e) {
  console.warn("[boot] skip " + "dist/game/turn/turn_pipeline: " + e.message);
}

// dist/game/turn/pipeline_ui_adapter
try {
  var _mod150 = require("./dist/game/turn/pipeline_ui_adapter");
  if (_mod150) Object.assign(window, _mod150);
  window.TurnPipelineUIAdapter = _mod150;
} catch (e) {
  console.warn("[boot] skip " + "dist/game/turn/pipeline_ui_adapter: " + e.message);
}

// dist/game/controller-events
try {
  var _mod151 = require("./dist/game/controller-events");
  if (_mod151) Object.assign(window, _mod151);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/controller-events: " + e.message);
}

// dist/game/move-executor-visuals
try {
  var _mod152 = require("./dist/game/move-executor-visuals");
  if (_mod152) Object.assign(window, _mod152);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/move-executor-visuals: " + e.message);
}

// dist/game/special-effects/helpers
try {
  var _mod153 = require("./dist/game/special-effects/helpers");
  if (_mod153) Object.assign(window, _mod153);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/special-effects/helpers: " + e.message);
}

// dist/game/special-effects/bombs
try {
  var _mod154 = require("./dist/game/special-effects/bombs");
  if (_mod154) Object.assign(window, _mod154);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/special-effects/bombs: " + e.message);
}

// dist/game/special-effects/dragons
try {
  var _mod155 = require("./dist/game/special-effects/dragons");
  if (_mod155) Object.assign(window, _mod155);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/special-effects/dragons: " + e.message);
}

// dist/game/special-effects/breeding
try {
  var _mod156 = require("./dist/game/special-effects/breeding");
  if (_mod156) Object.assign(window, _mod156);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/special-effects/breeding: " + e.message);
}

// dist/game/special-effects/hyperactive
try {
  var _mod157 = require("./dist/game/special-effects/hyperactive");
  if (_mod157) Object.assign(window, _mod157);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/special-effects/hyperactive: " + e.message);
}

// dist/game/special-effects/udg
try {
  var _mod158 = require("./dist/game/special-effects/udg");
  if (_mod158) Object.assign(window, _mod158);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/special-effects/udg: " + e.message);
}

// dist/game/special-effects/protections
try {
  var _mod159 = require("./dist/game/special-effects/protections");
  if (_mod159) Object.assign(window, _mod159);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/special-effects/protections: " + e.message);
}

// dist/game/special-effects-handler
try {
  var _mod160 = require("./dist/game/special-effects-handler");
  if (_mod160) Object.assign(window, _mod160);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/special-effects-handler: " + e.message);
}

// dist/game/card-effects/helpers
try {
  var _mod161 = require("./dist/game/card-effects/helpers");
  if (_mod161) Object.assign(window, _mod161);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/helpers: " + e.message);
}

// dist/game/card-effects/selection-flow
try {
  var _mod162 = require("./dist/game/card-effects/selection-flow");
  if (_mod162) Object.assign(window, _mod162);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/selection-flow: " + e.message);
}

// dist/game/card-effects/placement
try {
  var _mod163 = require("./dist/game/card-effects/placement");
  if (_mod163) Object.assign(window, _mod163);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/placement: " + e.message);
}

// dist/game/card-effects/destroy
try {
  var _mod164 = require("./dist/game/card-effects/destroy");
  if (_mod164) Object.assign(window, _mod164);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/destroy: " + e.message);
}

// dist/game/card-effects/strong-wind
try {
  var _mod165 = require("./dist/game/card-effects/strong-wind");
  if (_mod165) Object.assign(window, _mod165);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/strong-wind: " + e.message);
}

// dist/game/card-effects/teleport
try {
  var _mod166 = require("./dist/game/card-effects/teleport");
  if (_mod166) Object.assign(window, _mod166);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/teleport: " + e.message);
}

// dist/game/card-effects/tempt
try {
  var _mod167 = require("./dist/game/card-effects/tempt");
  if (_mod167) Object.assign(window, _mod167);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/tempt: " + e.message);
}

// dist/game/card-effects/capture
try {
  var _mod168 = require("./dist/game/card-effects/capture");
  if (_mod168) Object.assign(window, _mod168);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/capture: " + e.message);
}

// dist/game/card-effects/time-bomb
try {
  var _mod169 = require("./dist/game/card-effects/time-bomb");
  if (_mod169) Object.assign(window, _mod169);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/time-bomb: " + e.message);
}

// dist/game/network-turn-handoff
try {
  var _mod170 = require("./dist/game/network-turn-handoff");
  if (_mod170) Object.assign(window, _mod170);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/network-turn-handoff: " + e.message);
}

// dist/game/card-effects/trap
try {
  var _mod171 = require("./dist/game/card-effects/trap");
  if (_mod171) Object.assign(window, _mod171);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/trap: " + e.message);
}

// dist/game/card-effects/guard
try {
  var _mod172 = require("./dist/game/card-effects/guard");
  if (_mod172) Object.assign(window, _mod172);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/guard: " + e.message);
}

// dist/game/card-effects/living-will
try {
  var _mod173 = require("./dist/game/card-effects/living-will");
  if (_mod173) Object.assign(window, _mod173);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/living-will: " + e.message);
}

// dist/game/card-effects/hyperactive-inherit
try {
  var _mod174 = require("./dist/game/card-effects/hyperactive-inherit");
  if (_mod174) Object.assign(window, _mod174);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/hyperactive-inherit: " + e.message);
}

// dist/game/card-effects/extend-life
try {
  var _mod175 = require("./dist/game/card-effects/extend-life");
  if (_mod175) Object.assign(window, _mod175);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/extend-life: " + e.message);
}

// dist/game/card-effects/swap
try {
  var _mod176 = require("./dist/game/card-effects/swap");
  if (_mod176) Object.assign(window, _mod176);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/swap: " + e.message);
}

// dist/game/card-effects/position-swap
try {
  var _mod177 = require("./dist/game/card-effects/position-swap");
  if (_mod177) Object.assign(window, _mod177);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/position-swap: " + e.message);
}

// dist/game/card-effects/board-expansion
try {
  var _mod178 = require("./dist/game/card-effects/board-expansion");
  if (_mod178) Object.assign(window, _mod178);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/board-expansion: " + e.message);
}

// dist/game/card-effects/board-shrink
try {
  var _mod179 = require("./dist/game/card-effects/board-shrink");
  if (_mod179) Object.assign(window, _mod179);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/board-shrink: " + e.message);
}

// dist/game/card-effects/blockade
try {
  var _mod180 = require("./dist/game/card-effects/blockade");
  if (_mod180) Object.assign(window, _mod180);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/blockade: " + e.message);
}

// dist/game/card-effects/meteor
try {
  var _mod181 = require("./dist/game/card-effects/meteor");
  if (_mod181) Object.assign(window, _mod181);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/meteor: " + e.message);
}

// dist/game/card-effects/freeze
try {
  var _mod182 = require("./dist/game/card-effects/freeze");
  if (_mod182) Object.assign(window, _mod182);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/freeze: " + e.message);
}

// dist/game/card-effects/seed
try {
  var _mod183 = require("./dist/game/card-effects/seed");
  if (_mod183) Object.assign(window, _mod183);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/seed: " + e.message);
}

// dist/game/card-effects/clone
try {
  var _mod184 = require("./dist/game/card-effects/clone");
  if (_mod184) Object.assign(window, _mod184);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects/clone: " + e.message);
}

// dist/game/card-effects-applier
try {
  var _mod185 = require("./dist/game/card-effects-applier");
  if (_mod185) Object.assign(window, _mod185);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/card-effects-applier: " + e.message);
}

// dist/constants/cpu-lv6-shared-profile
try {
  var _mod186 = require("./dist/constants/cpu-lv6-shared-profile");
  if (_mod186) Object.assign(window, _mod186);
} catch (e) {
  console.warn("[boot] skip " + "dist/constants/cpu-lv6-shared-profile: " + e.message);
}

// dist/shared/cpu-lv6-runtime-capability
try {
  var _mod187 = require("./dist/shared/cpu-lv6-runtime-capability");
  if (_mod187) Object.assign(window, _mod187);
} catch (e) {
  console.warn("[boot] skip " + "dist/shared/cpu-lv6-runtime-capability: " + e.message);
}

// dist/game/ai/level-system
try {
  var _mod188 = require("./dist/game/ai/level-system");
  if (_mod188) Object.assign(window, _mod188);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/ai/level-system: " + e.message);
}

// dist/game/ai/policy-onnx-runtime
try {
  var _mod189 = require("./dist/game/ai/policy-onnx-runtime");
  if (_mod189) Object.assign(window, _mod189);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/ai/policy-onnx-runtime: " + e.message);
}

// dist/game/ai/policy-table-runtime
// Node-only table runtime depends on zlib; keep browser boot lazy and let CPU code feature-detect it.

// dist/data/dialogue/fixed-commentary-data
try {
  var _mod191 = require("./dist/data/dialogue/fixed-commentary-data");
  if (_mod191) Object.assign(window, _mod191);
} catch (e) {
  console.warn("[boot] skip " + "dist/data/dialogue/fixed-commentary-data: " + e.message);
}

// dist/game/ai/fixed-commentary-engine
try {
  var _mod192 = require("./dist/game/ai/fixed-commentary-engine");
  if (_mod192) Object.assign(window, _mod192);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/ai/fixed-commentary-engine: " + e.message);
}

// dist/game/ai/cpu-commentary-runtime
try {
  var _mod193 = require("./dist/game/ai/cpu-commentary-runtime");
  if (_mod193) Object.assign(window, _mod193);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/ai/cpu-commentary-runtime: " + e.message);
}

// dist/game/cpu-decision-board-utils
try {
  var _mod194 = require("./dist/game/cpu-decision-board-utils");
  if (_mod194) Object.assign(window, _mod194);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/cpu-decision-board-utils: " + e.message);
}

// dist/game/cpu-decision
try {
  var _mod195 = require("./dist/game/cpu-decision");
  if (_mod195) Object.assign(window, _mod195);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/cpu-decision: " + e.message);
}

// dist/game/pass-handler
try {
  var _mod196 = require("./dist/game/pass-handler");
  if (_mod196) Object.assign(window, _mod196);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/pass-handler: " + e.message);
}

// dist/game/move-executor
try {
  var _mod197 = require("./dist/game/move-executor");
  if (_mod197) Object.assign(window, _mod197);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/move-executor: " + e.message);
}

// dist/game/turn-manager
try {
  var _mod198 = require("./dist/game/turn-manager");
  if (_mod198) Object.assign(window, _mod198);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/turn-manager: " + e.message);
}

// dist/game/cpu-turn-handler
try {
  var _mod199 = require("./dist/game/cpu-turn-handler");
  if (_mod199) Object.assign(window, _mod199);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/cpu-turn-handler: " + e.message);
}

// dist/game/game-controller-slim
try {
  var _mod200 = require("./dist/game/game-controller-slim");
  if (_mod200) Object.assign(window, _mod200);
} catch (e) {
  console.warn("[boot] skip " + "dist/game/game-controller-slim: " + e.message);
}


// dist/ui/handlers/auto
try {
  var _mod215 = require("./dist/ui/handlers/auto");
  if (_mod215) Object.assign(window, _mod215);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/handlers/auto: " + e.message);
}

// dist/ui/handlers/smart
try {
  var _mod216 = require("./dist/ui/handlers/smart");
  if (_mod216) Object.assign(window, _mod216);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/handlers/smart: " + e.message);
}

// dist/ui/handlers/sound
try {
  var _mod217 = require("./dist/ui/handlers/sound");
  if (_mod217) Object.assign(window, _mod217);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/handlers/sound: " + e.message);
}

// dist/ui/handlers/rules-help
try {
  var _mod218 = require("./dist/ui/handlers/rules-help");
  if (_mod218) Object.assign(window, _mod218);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/handlers/rules-help: " + e.message);
}

// dist/ui/handlers/gacha
try {
  var _mod219 = require("./dist/ui/handlers/gacha");
  if (_mod219) Object.assign(window, _mod219);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/handlers/gacha: " + e.message);
}

// dist/ui/cosmetics/catalog-shared
try {
  var _mod220 = require("./dist/ui/cosmetics/catalog-shared");
  if (_mod220) {
    Object.assign(window, _mod220);
    window.CosmeticCatalogSharedModule = _mod220;
  }
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/cosmetics/catalog-shared: " + e.message);
}

// dist/ui/background-skin/catalog
try {
  var _mod221 = require("./dist/ui/background-skin/catalog");
  if (_mod221) Object.assign(window, _mod221);
  if (_mod221) window.BackgroundSkinCatalogModule = _mod221;
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/background-skin/catalog: " + e.message);
}

// dist/ui/background-skin/selection
try {
  var _mod222 = require("./dist/ui/background-skin/selection");
  if (_mod222) Object.assign(window, _mod222);
  if (_mod222) window.BackgroundSkinSelectionModule = _mod222;
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/background-skin/selection: " + e.message);
}

// dist/ui/background-skin/runtime
try {
  var _mod223 = require("./dist/ui/background-skin/runtime");
  if (_mod223) Object.assign(window, _mod223);
  if (_mod223) window.BackgroundSkinRuntimeModule = _mod223;
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/background-skin/runtime: " + e.message);
}

// dist/ui/background-skin/controller
try {
  var _mod224 = require("./dist/ui/background-skin/controller");
  if (_mod224) Object.assign(window, _mod224);
  if (_mod224) window.BackgroundSkinControllerModule = _mod224;
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/background-skin/controller: " + e.message);
}

// dist/ui/hand-skin/catalog
try {
  var _mod225 = require("./dist/ui/hand-skin/catalog");
  if (_mod225) {
    Object.assign(window, _mod225);
    window.HandSkinCatalogModule = _mod225;
  }
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/hand-skin/catalog: " + e.message);
}

// dist/ui/hand-skin/selection
try {
  var _mod226 = require("./dist/ui/hand-skin/selection");
  if (_mod226) {
    Object.assign(window, _mod226);
    window.HandSkinSelectionModule = _mod226;
  }
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/hand-skin/selection: " + e.message);
}

// dist/ui/hand-skin/runtime
try {
  var _mod227 = require("./dist/ui/hand-skin/runtime");
  if (_mod227) {
    Object.assign(window, _mod227);
    window.HandSkinRuntimeModule = _mod227;
  }
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/hand-skin/runtime: " + e.message);
}

// dist/ui/hand-skin/controller
try {
  var _mod228 = require("./dist/ui/hand-skin/controller");
  if (_mod228) {
    Object.assign(window, _mod228);
    window.HandSkinControllerModule = _mod228;
  }
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/hand-skin/controller: " + e.message);
}

// dist/ui/handlers/hand-skin
try {
  var _mod229 = require("./dist/ui/handlers/hand-skin");
  if (_mod229) Object.assign(window, _mod229);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/handlers/hand-skin: " + e.message);
}


// dist/ui/handlers/cpu-policy
try {
  var _mod232 = require("./dist/ui/handlers/cpu-policy");
  if (_mod232) Object.assign(window, _mod232);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/handlers/cpu-policy: " + e.message);
}

// dist/ui/handlers/deck-builder
try {
  var _mod233 = require("./dist/ui/handlers/deck-builder");
  if (_mod233) Object.assign(window, _mod233);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/handlers/deck-builder: " + e.message);
}

// dist/ui/handlers/match-mode
try {
  var _mod234 = require("./dist/ui/handlers/match-mode");
  if (_mod234) Object.assign(window, _mod234);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/handlers/match-mode: " + e.message);
}

// dist/ui/handlers/debug
try {
  var _mod235 = require("./dist/ui/handlers/debug");
  if (_mod235) Object.assign(window, _mod235);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/handlers/debug: " + e.message);
}

// dist/ui/handlers/init
try {
  var _mod236 = require("./dist/ui/handlers/init");
  if (_mod236) Object.assign(window, _mod236);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/handlers/init: " + e.message);
}

// dist/ui/presentation-handler
try {
  var _mod237 = require("./dist/ui/presentation-handler");
  if (_mod237) Object.assign(window, _mod237);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/presentation-handler: " + e.message);
}

// dist/ui/event-handlers
try {
  var _mod238 = require("./dist/ui/event-handlers");
  if (_mod238) Object.assign(window, _mod238);
} catch (e) {
  console.warn("[boot] skip " + "dist/ui/event-handlers: " + e.message);
}

// ===== Global contract restoration =====
// window.CoreLogic, window.CardLogic, window.SeededPRNG are already set above
if (typeof window.CardSystem !== "undefined") window.CardSystem = window.CardSystem;

// ===== Namespace globals for module resolution =====
// Cards & catalogs
try { window.CardCatalog = window.CardCatalog || require("./dist/cards/catalog"); } catch (e) {}
try { window.DeckBuilderControllerModule = window.DeckBuilderControllerModule || require("./dist/ui/deck-builder-controller"); } catch (e) {}
// Gacha system
try { window.GachaHelpersModule = window.GachaHelpersModule || require("./dist/shared/gacha-helpers"); } catch (e) {}
try { window.ObservationGachaCatalogSharedModule = window.ObservationGachaCatalogSharedModule || require("./dist/shared/observation-gacha-catalog-shared"); } catch (e) {}
try { window.ObservationGachaCatalogModule = window.ObservationGachaCatalogModule || require("./dist/shared/observation-gacha-catalog.generated"); } catch (e) {}
try { window.GachaProgressStorageModule = window.GachaProgressStorageModule || require("./dist/ui/storage/gacha-progress"); } catch (e) {}
try { window.GachaEventsModule = window.GachaEventsModule || require("./dist/ui/gacha/gacha-events"); } catch (e) {}
try { window.GachaTransactionModule = window.GachaTransactionModule || require("./dist/ui/gacha/gacha-transaction"); } catch (e) {}
try { window.GachaOverlayViewModule = window.GachaOverlayViewModule || require("./dist/ui/gacha/gacha-overlay-view"); } catch (e) {}
try { window.GachaOverlayControllerModule = window.GachaOverlayControllerModule || require("./dist/ui/gacha/gacha-overlay-controller"); } catch (e) {}
try { window.GachaItemVisualsModule = window.GachaItemVisualsModule || require("./dist/ui/gacha/gacha-item-visuals"); } catch (e) {}
try { window.GachaRevealStageModule = window.GachaRevealStageModule || require("./dist/ui/gacha/gacha-reveal-stage"); } catch (e) {}
try { window.GachaRevealAudioModule = window.GachaRevealAudioModule || require("./dist/ui/gacha/gacha-reveal-audio"); } catch (e) {}
try { window.GachaRevealPlayerModule = window.GachaRevealPlayerModule || require("./dist/ui/gacha/gacha-reveal-player"); } catch (e) {}
// Hand skin
try { window.HandSkinCatalogModule = window.HandSkinCatalogModule || require("./dist/ui/hand-skin/catalog"); } catch (e) {}
try { window.HandSkinSelectionModule = window.HandSkinSelectionModule || require("./dist/ui/hand-skin/selection"); } catch (e) {}
try { window.HandSkinRuntimeModule = window.HandSkinRuntimeModule || require("./dist/ui/hand-skin/runtime"); } catch (e) {}
try { window.HandSkinControllerModule = window.HandSkinControllerModule || require("./dist/ui/hand-skin/controller"); } catch (e) {}
// Background skin
try { window.BackgroundSkinCatalogModule = window.BackgroundSkinCatalogModule || require("./dist/ui/background-skin/catalog"); } catch (e) {}
try { window.BackgroundSkinSelectionModule = window.BackgroundSkinSelectionModule || require("./dist/ui/background-skin/selection"); } catch (e) {}
try { window.BackgroundSkinRuntimeModule = window.BackgroundSkinRuntimeModule || require("./dist/ui/background-skin/runtime"); } catch (e) {}
try { window.BackgroundSkinControllerModule = window.BackgroundSkinControllerModule || require("./dist/ui/background-skin/controller"); } catch (e) {}
// Cosmetic
try { window.CosmeticCatalogSharedModule = window.CosmeticCatalogSharedModule || require("./dist/ui/cosmetics/catalog-shared"); } catch (e) {}
try { window.GachaHandCatalogSharedModule = window.GachaHandCatalogSharedModule || require("./dist/shared/gacha-hand-catalog-shared"); } catch (e) {}
try { window.GachaHandCatalogModule = window.GachaHandCatalogModule || require("./dist/shared/gacha-hand-catalog.generated"); } catch (e) {}
// Sound & presentation
try { window.PlacementSoundSelectionModule = window.PlacementSoundSelectionModule || require("./dist/ui/placement-sound-selection"); } catch (e) {}
try { window.SoundEngineAccessModule = window.SoundEngineAccessModule || require("./dist/ui/sound-engine-access"); } catch (e) {}
try { window.AnimationUtils = window.AnimationUtils || require("./dist/ui/animation-utils"); } catch (e) {}
try { window.ResultOverlayModule = window.ResultOverlayModule || require("./dist/ui/result-overlay"); } catch (e) {}
// Core game namespace objects
try { window.BoardOps = window.BoardOps || require("./dist/game/logic/board_ops"); } catch (e) {}
try { window.AnimationEngine = window.AnimationEngine || require("./dist/ui/animation-engine"); } catch (e) {}
// Network modules
try { window.NetworkCommentaryModule = window.NetworkCommentaryModule || require("./dist/ui/network/commentary"); } catch (e) {}
try { window.NetworkCommandPayloadModule = window.NetworkCommandPayloadModule || require("./dist/ui/network/command-payload"); } catch (e) {}
try { window.NetworkActionBridgeModule = window.NetworkActionBridgeModule || require("./dist/ui/network/action-bridge"); } catch (e) {}
try { window.NetworkApplyCoordinatorModule = window.NetworkApplyCoordinatorModule || require("./dist/ui/network/apply-coordinator"); } catch (e) {}
try { window.NetworkPublishTrackerModule = window.NetworkPublishTrackerModule || require("./dist/ui/network/publish-tracker"); } catch (e) {}
try { window.NetworkPublishRequestModule = window.NetworkPublishRequestModule || require("./dist/ui/network/publish-request"); } catch (e) {}
try { window.NetworkSnapshotModule = window.NetworkSnapshotModule || require("./dist/ui/network/snapshot"); } catch (e) {}
try { window.NetworkSnapshotRuntimeModule = window.NetworkSnapshotRuntimeModule || require("./dist/ui/network/snapshot-runtime"); } catch (e) {}
try { window.NetworkSnapshotCanonicalModule = window.NetworkSnapshotCanonicalModule || require("./dist/ui/network/snapshot-canonical"); } catch (e) {}
try { window.NetworkSnapshotPresentationModule = window.NetworkSnapshotPresentationModule || require("./dist/ui/network/snapshot-presentation"); } catch (e) {}
try { window.NetworkSessionSeatModule = window.NetworkSessionSeatModule || require("./dist/ui/network/session-seat"); } catch (e) {}
try { window.NetworkSessionLifecycleModule = window.NetworkSessionLifecycleModule || require("./dist/ui/network/session-lifecycle"); } catch (e) {}
try { window.NetworkReconnectControllerModule = window.NetworkReconnectControllerModule || require("./dist/ui/network/reconnect-controller"); } catch (e) {}
// Catalog access for gacha
try { window.ObservationGachaCatalogAccessModule = window.ObservationGachaCatalogAccessModule || require("./dist/ui/gacha/catalog-access"); } catch (e) {}
// Card rendering & interaction
try { window.HandAnimationUtilsModule = window.HandAnimationUtilsModule || require("./dist/cards/card-renderer"); } catch (e) {}

// ===== Direct namespace assignments from module variables =====
// These MUST be set because code uses globalThis.ModuleName to look up modules.
// Object.assign(window, _mod) spreads individual properties but doesn't create the namespace.
if (typeof _mod20 !== "undefined" && _mod20) window.BoardOps = _mod20;
if (typeof _mod97 !== "undefined" && _mod97) window.AnimationEngine = _mod97;
if (typeof _mod101 !== "undefined" && _mod101) window.GachaHelpersModule = _mod101;
if (typeof _mod102 !== "undefined" && _mod102) window.ObservationGachaCatalogSharedModule = _mod102;
if (typeof _mod103 !== "undefined" && _mod103) window.ObservationGachaCatalogModule = _mod103;
if (typeof _mod104 !== "undefined" && _mod104) window.GachaHandCatalogSharedModule = _mod104;
if (typeof _mod105 !== "undefined" && _mod105) window.GachaHandCatalogModule = _mod105;
if (typeof _mod106 !== "undefined" && _mod106) window.GachaProgressStorageModule = _mod106;
if (typeof _mod107 !== "undefined" && _mod107) window.GachaEventsModule = _mod107;
if (typeof _mod108 !== "undefined" && _mod108) window.ObservationGachaCatalogAccessModule = _mod108;
if (typeof _mod109 !== "undefined" && _mod109) window.PlacementSoundSelectionModule = _mod109;
if (typeof _mod111 !== "undefined" && _mod111) window.GachaItemVisualsModule = _mod111;
if (typeof _mod114 !== "undefined" && _mod114) window.GachaRevealStageModule = _mod114;
if (typeof _mod115 !== "undefined" && _mod115) window.SoundEngineAccessModule = _mod115;
if (typeof _mod116 !== "undefined" && _mod116) window.GachaRevealAudioModule = _mod116;
if (typeof _mod117 !== "undefined" && _mod117) window.GachaRevealPlayerModule = _mod117;
if (typeof _mod119 !== "undefined" && _mod119) window.ResultOverlayModule = _mod119;
if (typeof _mod121 !== "undefined" && _mod121) window.NetworkCommentaryModule = _mod121;
if (typeof _mod122 !== "undefined" && _mod122) window.NetworkCommandPayloadModule = _mod122;
if (typeof _mod123 !== "undefined" && _mod123) window.NetworkPublishRequestModule = _mod123;
if (typeof _mod124 !== "undefined" && _mod124) window.NetworkActionBridgeModule = _mod124;
if (typeof _mod125 !== "undefined" && _mod125) window.NetworkApplyCoordinatorModule = _mod125;
if (typeof _mod126 !== "undefined" && _mod126) window.NetworkReconnectControllerModule = _mod126;
if (typeof _mod127 !== "undefined" && _mod127) window.NetworkPublishTrackerModule = _mod127;
if (typeof _mod128 !== "undefined" && _mod128) window.NetworkSnapshotRuntimeModule = _mod128;
if (typeof _mod129 !== "undefined" && _mod129) window.NetworkSnapshotCanonicalModule = _mod129;
if (typeof _mod130 !== "undefined" && _mod130) window.NetworkSnapshotPresentationModule = _mod130;
if (typeof _mod131 !== "undefined" && _mod131) window.NetworkSnapshotModule = _mod131;
if (typeof _mod132 !== "undefined" && _mod132) window.NetworkSessionSeatModule = _mod132;
if (typeof _mod133 !== "undefined" && _mod133) window.NetworkSessionLifecycleModule = _mod133;
if (typeof _mod220 !== "undefined" && _mod220) window.CosmeticCatalogSharedModule = _mod220;
if (typeof _mod221 !== "undefined" && _mod221) window.BackgroundSkinCatalogModule = _mod221;
if (typeof _mod222 !== "undefined" && _mod222) window.BackgroundSkinSelectionModule = _mod222;
if (typeof _mod223 !== "undefined" && _mod223) window.BackgroundSkinRuntimeModule = _mod223;
if (typeof _mod224 !== "undefined" && _mod224) window.BackgroundSkinControllerModule = _mod224;
if (typeof _mod94 !== "undefined" && _mod94) window.AnimationUtils = _mod94;
if (typeof _mod136 !== "undefined" && _mod136) window.HandAnimationUtilsModule = _mod136;

try {
  window.setTimeout(function() {
    try {
      Object.defineProperty(window, "cpuSmartness", {
        configurable: false,
        enumerable: false,
        get: function() { return undefined; },
        set: function() {}
      });
    } catch (e) {}
  }, 500);
} catch (e) {}

// ===== Browser runtime shims =====
window.getElement = function(k) {
  var m = {board:"board",boardFrame:"board-frame",deckBlack:"deck-black",deckWhite:"deck-white",handBlack:"hand-black",handWhite:"hand-white",chargeBlack:"charge-black",chargeWhite:"charge-white",log:"log",handLayer:"handLayer",heldStone:"heldStone",cardFxLayer:"card-fx-layer",handImage:"handImage",cpuCharacterImg:"cpu-character-img",cpuLevelLabel:"cpu-level-label"};
  return m[k] ? document.getElementById(m[k]) : null;
};
window.initializeElementCache = function() {};
window.clearElementCache = function() {};
