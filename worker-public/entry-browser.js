// ===== Classic browser runtime entry =====
// Loads modules in original index.html order via module-registry

if (!window.__CARD_REVERSI_BROWSER_LANE__) window.__CARD_REVERSI_BROWSER_LANE__ = "classic";
if (typeof document !== "undefined" && document && document.documentElement) {
  document.documentElement.setAttribute("data-browser-lane", window.__CARD_REVERSI_BROWSER_LANE__);
}

// _require / __require aliases (used by dist modules internally)
window._require = window.require;
window.__require = window.require;
var _require = window.require;

function normalizeBootModuleKey(moduleKey) {
  var normalized = String(moduleKey || "").trim().replace(/\\/g, "/");
  normalized = normalized.replace(/^\.\//, "");
  if (normalized.indexOf("dist/") === 0) normalized = normalized.slice(5);
  normalized = normalized.replace(/\.js$/, "");
  return normalized;
}

function formatBootModuleName(moduleKey) {
  return String(moduleKey || "").trim().replace(/^\.\//, "").replace(/\.js$/, "");
}

function listHasBootModuleKey(list, normalizedKey) {
  if (!Array.isArray(list)) return false;
  return list.indexOf(normalizedKey) >= 0 || list.indexOf("dist/" + normalizedKey) >= 0;
}

function getBootModuleClass(moduleKey) {
  var meta = window.__CARD_REVERSI_BOOT_MODULES__ || {};
  var normalized = normalizeBootModuleKey(moduleKey);
  if (listHasBootModuleKey(meta.required, normalized)) return "required";
  if (listHasBootModuleKey(meta.optional, normalized)) return "optional";
  var optionalPrefixes = Array.isArray(meta.optionalPrefixes) ? meta.optionalPrefixes : [];
  for (var i = 0; i < optionalPrefixes.length; i += 1) {
    var prefix = normalizeBootModuleKey(optionalPrefixes[i]);
    if (!prefix) continue;
    if (normalized === prefix.replace(/\/$/, "") || normalized.indexOf(prefix) === 0) return "optional";
  }
  return "required";
}

function getBootModuleErrorMessage(moduleKey, error) {
  return "[boot] required module failed: " + formatBootModuleName(moduleKey) + ": " + (error && error.message ? error.message : error);
}

function handleBootModuleError(moduleKey, error, options) {
  var opts = options || {};
  var bootClass = opts.bootClass || getBootModuleClass(moduleKey);
  if (bootClass === "optional") {
    if (opts.quietOptional !== true) {
      console.warn("[boot] skip " + formatBootModuleName(moduleKey) + ": " + (error && error.message ? error.message : error));
    }
    return null;
  }
  var err = new Error(getBootModuleErrorMessage(moduleKey, error));
  try {
    err.cause = error;
  } catch (_ignore) {
    err.originalError = error;
  }
  throw err;
}

function requireBootModule(moduleKey, options) {
  try {
    return require(moduleKey);
  } catch (e) {
    return handleBootModuleError(moduleKey, e, options);
  }
}

function requireBootNamespace(globalName, modulePath, options) {
  var opts = options || {};
  var bootClass = opts.optional === true ? "optional" : getBootModuleClass(modulePath);
  try {
    window[globalName] = window[globalName] || require(modulePath);
    return window[globalName];
  } catch (e) {
    var message = "[boot] " + (bootClass === "optional" ? "skip optional" : "required") + " namespace " + globalName + " <- " + modulePath + ": " + (e && e.message ? e.message : e);
    if (bootClass === "optional") {
      if (opts.quietOptional !== true) console.warn(message);
      return null;
    }
    console.error(message);
    throw e;
  }
}

function assignBootModuleGlobals(moduleExports, globalNames) {
  if (!moduleExports || !Array.isArray(globalNames)) return;
  for (var i = 0; i < globalNames.length; i += 1) {
    window[globalNames[i]] = moduleExports;
  }
}

function assignBootModuleDefaultGlobals(moduleExports, globalNames) {
  if (!moduleExports || !Array.isArray(globalNames) || !moduleExports.default) return;
  for (var i = 0; i < globalNames.length; i += 1) {
    window[globalNames[i]] = moduleExports.default;
  }
}

function applyBootModuleEntry(moduleExports, entry) {
  if (!moduleExports || !entry) return null;
  if (entry.assignWindow !== false) Object.assign(window, moduleExports);
  assignBootModuleGlobals(moduleExports, entry.globalNames);
  assignBootModuleDefaultGlobals(moduleExports, entry.defaultGlobalNames);
  if (entry.initDebugCardSearch === true && typeof moduleExports.initDebugCardSearch === "function") {
    window.debugCardSearchController = moduleExports.initDebugCardSearch();
  }
  if (entry.initUIBootstrap === true && typeof moduleExports.initializeUIBootstrapRuntime === "function") {
    moduleExports.initializeUIBootstrapRuntime(window);
  }
  if (entry.initNetworkMatchClient === true && typeof moduleExports.initializeNetworkMatchClientRuntime === "function") {
    moduleExports.initializeNetworkMatchClientRuntime(window);
  }
  if (entry.initCardInteraction === true && typeof moduleExports.initializeCardInteractionRuntime === "function") {
    moduleExports.initializeCardInteractionRuntime(window);
  }
  return moduleExports;
}

function isOptionalBootEntry(entry) {
  if (!entry || !entry.moduleKey) return false;
  return entry.bootClass === "optional" || getBootModuleClass(entry.moduleKey) === "optional";
}

function runBootLoadEntries(entries) {
  for (var i = 0; i < entries.length; i += 1) {
    var entry = entries[i];
    if (isOptionalBootEntry(entry)) {
      entry.moduleExports = null;
      continue;
    }
    var moduleExports = requireBootModule(entry.moduleKey, entry.bootClass ? { bootClass: entry.bootClass } : undefined);
    applyBootModuleEntry(moduleExports, entry);
    entry.moduleExports = moduleExports;
  }
}

function restoreOptionalBootEntries(entries) {
  var restored = 0;
  for (var i = 0; i < entries.length; i += 1) {
    var entry = entries[i];
    if (!isOptionalBootEntry(entry) || entry.moduleExports) continue;
    var moduleExports = requireBootModule(entry.moduleKey, { bootClass: "optional" });
    if (!moduleExports) continue;
    applyBootModuleEntry(moduleExports, entry);
    entry.moduleExports = moduleExports;
    restored += 1;
  }
  return restored;
}

function assignBootLateGlobals(entries) {
  for (var i = 0; i < entries.length; i += 1) {
    var entry = entries[i];
    assignBootModuleGlobals(entry.moduleExports, entry.lateGlobalNames);
  }
}

var gameState;
var cardState;
var boardConfig;
var prng;
var deckSpec;
var __uiImpl_turn_manager = {};

var BOOT_LOAD_ENTRIES = [
  { moduleKey: "./dist/ui/layout-stage" },
  { moduleKey: "./dist/is-env-capable" },
  { moduleKey: "./dist/constants/difficulty-constants" },
  { moduleKey: "./dist/constants/ui-element-cache" },
  { moduleKey: "./dist/constants/animation-constants" },
  { moduleKey: "./dist/cards/catalog", globalNames: ["CardCatalog"] },
  { moduleKey: "./dist/shared-constants" },
  { moduleKey: "./dist/shared/board/dimensions", globalNames: ["BoardDimensions"] },
  { moduleKey: "./dist/shared/board/configuration", globalNames: ["BoardConfiguration"] },
  { moduleKey: "./dist/shared/board/initial-layout", globalNames: ["InitialBoardLayout"] },
  { moduleKey: "./dist/shared/board/expansion-descriptors", globalNames: ["BoardExpansionDescriptors"] },
  { moduleKey: "./dist/shared/board/shape-metadata", globalNames: ["BoardShapeMetadata"] },
  { moduleKey: "./dist/shared/board/cell-access", globalNames: ["BoardCellAccess"] },
  { moduleKey: "./dist/shared/board/corners", globalNames: ["BoardCorners"] },
  { moduleKey: "./dist/shared/board/edge-runs", globalNames: ["BoardEdgeRuns"] },
  { moduleKey: "./dist/shared/board/risk-cells", globalNames: ["BoardRiskCells"] },
  { moduleKey: "./dist/shared/board/shape-iteration", globalNames: ["BoardShapeIteration"] },
  { moduleKey: "./dist/shared/board/legal-moves", globalNames: ["BoardLegalMoves"] },
  { moduleKey: "./dist/shared/board/control-counts", globalNames: ["BoardControlCounts"] },
  { moduleKey: "./dist/shared/board/canonical-encoding", globalNames: ["CanonicalBoardEncoding"] },
  { moduleKey: "./dist/shared/board/notation", globalNames: ["BoardNotation"] },
  { moduleKey: "./dist/shared/board/padded-coordinates", globalNames: ["PaddedBoardCoordinates"] },
  { moduleKey: "./dist/shared/shared-board-utils" },
  { moduleKey: "./dist/shared/deck-spec" },
  { moduleKey: "./dist/shared/deck-codec" },
  { moduleKey: "./dist/shared/destroy-outcome-contract" },
  { moduleKey: "./dist/shared/manifest-stone-registry", globalNames: ["ManifestStoneRegistry"] },
  { moduleKey: "./dist/shared/special-stone-registry", globalNames: ["SpecialStoneRegistry"] },
  { moduleKey: "./dist/shared/stone-status-snapshot", globalNames: ["StoneStatusSnapshot"] },
  { moduleKey: "./dist/shared/shared-board-utils" },
  { moduleKey: "./dist/game/logic/markers_adapter" },
  { moduleKey: "./dist/game/logic/cards-internal/random-source" },
  { moduleKey: "./dist/game/logic/cards-internal/state-factory" },
  { moduleKey: "./dist/game/logic/cards-internal/module-resolver" },
  { moduleKey: "./dist/game/logic/cards-internal/presentation-helpers" },
  { moduleKey: "./dist/game/logic/cards-internal/board-configuration" },
  { moduleKey: "./dist/game/logic/cards-internal/generated-spawn-flip-resolver" },
  { moduleKey: "./dist/game/logic/board_ops", globalNames: ["BoardOps"], lateGlobalNames: ["BoardOps"] },
  { moduleKey: "./dist/shared/network-contract", globalNames: ["NetworkContract"], lateGlobalNames: ["NetworkContract"] },
  { moduleKey: "./dist/shared/player-seat-contract", globalNames: ["PlayerSeatContract"], lateGlobalNames: ["PlayerSeatContract"] },
  { moduleKey: "./dist/utils/owner-helpers" },
  { moduleKey: "./dist/game/logic/core", globalNames: ["CoreLogic", "Core"] },
  { moduleKey: "./dist/game/logic/cards/defs" },
  { moduleKey: "./dist/game/logic/cards/costs" },
  { moduleKey: "./dist/game/logic/cards/utils" },
  { moduleKey: "./dist/game/logic/cards/targets" },
  { moduleKey: "./dist/game/logic/cards/selectors" },
  { moduleKey: "./dist/game/logic/cards/flips" },
  { moduleKey: "./dist/game/logic/cards/chain" },
  { moduleKey: "./dist/game/logic/cards/regen" },
  { moduleKey: "./dist/game/logic/cards/time_bomb" },
  { moduleKey: "./dist/game/logic/cards/breeding" },
  { moduleKey: "./dist/game/logic/cards/hyperactive" },
  { moduleKey: "./dist/game/logic/cards/udg" },
  { moduleKey: "./dist/game/logic/cards/sniper" },
  { moduleKey: "./dist/game/logic/cards/lightning" },
  { moduleKey: "./dist/game/logic/cards/destroy_dragon" },
  { moduleKey: "./dist/game/logic/cards/will_hunter_king" },
  { moduleKey: "./dist/game/logic/cards/work_will" },
  { moduleKey: "./dist/game/logic/cards/expansion" },
  { moduleKey: "./dist/game/logic/cards/markers" },
  { moduleKey: "./dist/game/logic/cards/living_will" },
  { moduleKey: "./dist/game/logic/cards/movement" },
  { moduleKey: "./dist/game/logic/cards/teleport" },
  { moduleKey: "./dist/game/logic/cards/clone" },
  { moduleKey: "./dist/game/logic/cards/meteor" },
  { moduleKey: "./dist/game/logic/cards/shrink" },
  { moduleKey: "./dist/game/logic/effects/dragon" },
  { moduleKey: "./dist/game/logic/effects/swap_with_enemy" },
  { moduleKey: "./dist/game/logic/effects/destroy_one_stone" },
  { moduleKey: "./dist/game/cards/effects/ownership" },
  { moduleKey: "./dist/game/cards/effects/board-expansion-apply" },
  { moduleKey: "./dist/game/cards/effects/status-cells" },
  { moduleKey: "./dist/game/cards/effects/hand-effects" },
  { moduleKey: "./dist/game/cards/effects/position-swap" },
  { moduleKey: "./dist/game/logic/cards-internal/card-usage-prechecks" },
  { moduleKey: "./dist/game/logic/cards-internal/selector-orchestrator" },
  { moduleKey: "./dist/game/logic/cards-internal/hand-manager" },
  { moduleKey: "./dist/game/logic/cards-internal/effect-timing" },
  { moduleKey: "./dist/game/logic/cards-internal/pending-state-manager" },
  { moduleKey: "./dist/game/turn/pending-coordinator" },
  { moduleKey: "./dist/game/logic/cards-internal/charge-ledger" },
  { moduleKey: "./dist/game/logic/cards", globalNames: ["CardLogic"] },
  { moduleKey: "./dist/game/logic/presentation" },
  { moduleKey: "./dist/game/logic/position-weights" },
  { moduleKey: "./dist/game/schema/prng", globalNames: ["SeededPRNG"] },
  { moduleKey: "./dist/game/schema/action_manager" },
  { moduleKey: "./dist/game-events", globalNames: ["GameEvents"] },
  { moduleKey: "./dist/game/game-core-logic" },
  { moduleKey: "./dist/game/move-generator" },
  { moduleKey: "./dist/card-system" },
  { moduleKey: "./dist/ui/storage/action-log" },
  { moduleKey: "./dist/shared/commentary-context-helpers" },
  { moduleKey: "./dist/shared/commentary-runtime-helpers" },
  { moduleKey: "./dist/shared/playback-event-helpers" },
  { moduleKey: "./dist/ui/commentary-broker" },
  { moduleKey: "./dist/ui/bootstrap", initUIBootstrap: true },
  { moduleKey: "./dist/ui/bootstrap/lazy-runtime-loader", globalNames: ["LazyRuntimeLoaderModule"] },
  { moduleKey: "./dist/ui/bootstrap/init-dom" },
  { moduleKey: "./dist/ui/bootstrap/init-events" },
  { moduleKey: "./dist/ui/bootstrap/init-game" },
  { moduleKey: "./dist/ui/bootstrap/init-network" },
  { moduleKey: "./dist/ui/marker-bridge" },
  { moduleKey: "./dist/ui" },
  { moduleKey: "./dist/ui/animation-resolver" },
  { moduleKey: "./dist/ui/animation-shared" },
  { moduleKey: "./dist/ui/animation-helpers" },
  { moduleKey: "./dist/ui/playback-runtime" },
  { moduleKey: "./dist/ui/playback-state-manager" },
  { moduleKey: "./dist/ui/board-update-dispatch" },
  { moduleKey: "./dist/ui/board-update-sync-runtime" },
  { moduleKey: "./dist/ui/diff-renderer" },
  { moduleKey: "./dist/ui/board-renderer" },
  { moduleKey: "./dist/ui/status-display" },
  { moduleKey: "./dist/ui/animation-utils", lateGlobalNames: ["AnimationUtils"] },
  { moduleKey: "./dist/ui/stone-visuals" },
  { moduleKey: "./dist/ui/animation-constants" },
  { moduleKey: "./dist/ui/animation-engine", globalNames: ["AnimationEngine"], lateGlobalNames: ["AnimationEngine"] },
  { moduleKey: "./dist/ui/playback-engine" },
  { moduleKey: "./dist/ui/move-executor-visuals" },
  { moduleKey: "./dist/ui/visual-effects-map" },
  { moduleKey: "./dist/shared/gacha-helpers", globalNames: ["GachaHelpersModule"], lateGlobalNames: ["GachaHelpersModule"] },
  { moduleKey: "./dist/shared/observation-gacha-catalog-shared", globalNames: ["ObservationGachaCatalogSharedModule"], lateGlobalNames: ["ObservationGachaCatalogSharedModule"] },
  { moduleKey: "./dist/shared/observation-gacha-catalog.generated", globalNames: ["ObservationGachaCatalogModule"], lateGlobalNames: ["ObservationGachaCatalogModule"] },
  { moduleKey: "./dist/shared/gacha-hand-catalog-shared", globalNames: ["GachaHandCatalogSharedModule"], lateGlobalNames: ["GachaHandCatalogSharedModule"] },
  { moduleKey: "./dist/shared/gacha-hand-catalog.generated", globalNames: ["GachaHandCatalogModule"], lateGlobalNames: ["GachaHandCatalogModule"] },
  { moduleKey: "./dist/ui/storage/gacha-progress", globalNames: ["GachaProgressStorageModule"], lateGlobalNames: ["GachaProgressStorageModule"] },
  { moduleKey: "./dist/ui/gacha/gacha-events", globalNames: ["GachaEventsModule"], lateGlobalNames: ["GachaEventsModule"] },
  { moduleKey: "./dist/ui/gacha/catalog-access", globalNames: ["ObservationGachaCatalogAccessModule"], lateGlobalNames: ["ObservationGachaCatalogAccessModule"] },
  { moduleKey: "./dist/ui/placement-sound-selection", globalNames: ["PlacementSoundSelectionModule"], lateGlobalNames: ["PlacementSoundSelectionModule"] },
  { moduleKey: "./dist/ui/gacha/gacha-transaction", globalNames: ["GachaTransactionModule"] },
  { moduleKey: "./dist/ui/gacha/gacha-item-visuals", globalNames: ["GachaItemVisualsModule"], lateGlobalNames: ["GachaItemVisualsModule"] },
  { moduleKey: "./dist/ui/gacha/gacha-overlay-view", globalNames: ["GachaOverlayViewModule"] },
  { moduleKey: "./dist/ui/gacha/gacha-overlay-controller", globalNames: ["GachaOverlayControllerModule"] },
  { moduleKey: "./dist/ui/gacha/gacha-reveal-stage", globalNames: ["GachaRevealStageModule"], lateGlobalNames: ["GachaRevealStageModule"] },
  { moduleKey: "./dist/ui/sound-engine-access", globalNames: ["SoundEngineAccessModule"], lateGlobalNames: ["SoundEngineAccessModule"] },
  { moduleKey: "./dist/ui/gacha/gacha-reveal-audio", globalNames: ["GachaRevealAudioModule"], lateGlobalNames: ["GachaRevealAudioModule"] },
  { moduleKey: "./dist/ui/gacha-reveal-player", globalNames: ["GachaRevealPlayerModule"], lateGlobalNames: ["GachaRevealPlayerModule"] },
  { moduleKey: "./dist/ui/leaderboard-client" },
  { moduleKey: "./dist/ui/result-overlay", globalNames: ["ResultOverlayModule"], lateGlobalNames: ["ResultOverlayModule"] },
  { moduleKey: "./dist/shared/network-action-schema", globalNames: ["NetworkActionSchemaModule"] },
  { moduleKey: "./dist/ui/network/commentary", globalNames: ["NetworkCommentaryModule"], lateGlobalNames: ["NetworkCommentaryModule"] },
  { moduleKey: "./dist/ui/network/command-payload", globalNames: ["NetworkCommandPayloadModule"], lateGlobalNames: ["NetworkCommandPayloadModule"] },
  { moduleKey: "./dist/ui/network/publish-request", globalNames: ["NetworkPublishRequestModule"], lateGlobalNames: ["NetworkPublishRequestModule"] },
  { moduleKey: "./dist/ui/network/action-bridge", globalNames: ["NetworkActionBridgeModule"], lateGlobalNames: ["NetworkActionBridgeModule"] },
  { moduleKey: "./dist/ui/network/apply-coordinator", globalNames: ["NetworkApplyCoordinatorModule"], lateGlobalNames: ["NetworkApplyCoordinatorModule"] },
  { moduleKey: "./dist/ui/network/reconnect-controller", globalNames: ["NetworkReconnectControllerModule"], lateGlobalNames: ["NetworkReconnectControllerModule"] },
  { moduleKey: "./dist/ui/network/publish-tracker", globalNames: ["NetworkPublishTrackerModule"], lateGlobalNames: ["NetworkPublishTrackerModule"] },
  { moduleKey: "./dist/ui/network/snapshot-runtime", lateGlobalNames: ["NetworkSnapshotRuntimeModule"] },
  { moduleKey: "./dist/ui/network/snapshot-canonical", lateGlobalNames: ["NetworkSnapshotCanonicalModule"] },
  { moduleKey: "./dist/ui/network/snapshot-presentation", lateGlobalNames: ["NetworkSnapshotPresentationModule"] },
  { moduleKey: "./dist/ui/network/snapshot", lateGlobalNames: ["NetworkSnapshotModule"] },
  { moduleKey: "./dist/ui/network/session-seat", lateGlobalNames: ["NetworkSessionSeatModule"] },
  { moduleKey: "./dist/ui/network/session-lifecycle", lateGlobalNames: ["NetworkSessionLifecycleModule"] },
  { moduleKey: "./dist/ui/network-client", initNetworkMatchClient: true },
  { moduleKey: "./dist/sound-engine", defaultGlobalNames: ["SoundEngine"] },
  { moduleKey: "./dist/cards/card-renderer", globalNames: ["HandAnimationUtilsModule"], lateGlobalNames: ["HandAnimationUtilsModule"] },
  { moduleKey: "./dist/cards/card-interaction-effects" },
  { moduleKey: "./dist/cards/card-interaction", initCardInteraction: true },
  { moduleKey: "./dist/ui/debug-card-search", globalNames: ["DebugCardSearchModule"], initDebugCardSearch: true },
  { moduleKey: "./dist/ui/storage/deck-presets" },
  { moduleKey: "./dist/ui/deck-builder-state" },
  { moduleKey: "./dist/ui/deck-builder-renderer" },
  { moduleKey: "./dist/ui/deck-builder-controller", globalNames: ["DeckBuilderControllerModule"] },
  { moduleKey: "./dist/game/timers" },
  { moduleKey: "./dist/game/auto" },
  { moduleKey: "./dist/game/visual-effects-map", globalNames: ["GameVisualEffectsMap"] },
  { moduleKey: "./dist/game/log-messages" },
  { moduleKey: "./dist/game/turn/turn_pipeline_phase_helpers" },
  { moduleKey: "./dist/game/turn/turn_pipeline_phases", globalNames: ["TurnPipelinePhases"] },
  { moduleKey: "./dist/game/turn/turn_pipeline", globalNames: ["TurnPipeline"] },
  { moduleKey: "./dist/game/turn/pipeline_ui_adapter", globalNames: ["TurnPipelineUIAdapter"] },
  { moduleKey: "./dist/game/controller-events" },
  { moduleKey: "./dist/game/move-executor-visuals" },
  { moduleKey: "./dist/game/special-effects/helpers" },
  { moduleKey: "./dist/game/special-effects/bombs" },
  { moduleKey: "./dist/game/special-effects/dragons" },
  { moduleKey: "./dist/game/special-effects/breeding" },
  { moduleKey: "./dist/game/special-effects/hyperactive" },
  { moduleKey: "./dist/game/special-effects/udg" },
  { moduleKey: "./dist/game/special-effects/protections" },
  { moduleKey: "./dist/game/special-effects-handler" },
  { moduleKey: "./dist/game/card-effects/helpers" },
  { moduleKey: "./dist/game/card-effects/selection-flow" },
  { moduleKey: "./dist/game/card-effects/placement" },
  { moduleKey: "./dist/game/card-effects/destroy" },
  { moduleKey: "./dist/game/card-effects/strong-wind" },
  { moduleKey: "./dist/game/card-effects/teleport" },
  { moduleKey: "./dist/game/card-effects/tempt" },
  { moduleKey: "./dist/game/card-effects/capture" },
  { moduleKey: "./dist/game/card-effects/time-bomb" },
  { moduleKey: "./dist/game/network-turn-handoff", globalNames: ["NetworkTurnHandoff"] },
  { moduleKey: "./dist/game/card-effects/trap" },
  { moduleKey: "./dist/game/card-effects/guard" },
  { moduleKey: "./dist/game/card-effects/living-will" },
  { moduleKey: "./dist/game/card-effects/hyperactive-inherit" },
  { moduleKey: "./dist/game/card-effects/extend-life" },
  { moduleKey: "./dist/game/card-effects/swap" },
  { moduleKey: "./dist/game/card-effects/position-swap" },
  { moduleKey: "./dist/game/card-effects/board-expansion" },
  { moduleKey: "./dist/game/card-effects/board-shrink" },
  { moduleKey: "./dist/game/card-effects/blockade" },
  { moduleKey: "./dist/game/card-effects/poison" },
  { moduleKey: "./dist/game/card-effects/meteor" },
  { moduleKey: "./dist/game/card-effects/causal-replay" },
  { moduleKey: "./dist/game/card-effects/freeze" },
  { moduleKey: "./dist/game/card-effects/seed" },
  { moduleKey: "./dist/game/card-effects/clone" },
  { moduleKey: "./dist/game/card-effects/reverse-will" },
  { moduleKey: "./dist/game/card-effects-applier" },
  { moduleKey: "./dist/constants/cpu-lv6-shared-profile" },
  { moduleKey: "./dist/shared/cpu-lv6-runtime-capability" },
  { moduleKey: "./dist/game/ai/level-system" },
  { moduleKey: "./dist/game/ai/policy-onnx-runtime" },
  { moduleKey: "./dist/game/ai/commentary-data" },
  { moduleKey: "./dist/game/ai/fixed-commentary-engine" },
  { moduleKey: "./dist/game/ai/cpu-commentary-runtime" },
  { moduleKey: "./dist/game/cpu-decision-board-utils" },
  { moduleKey: "./dist/game/cpu-decision" },
  { moduleKey: "./dist/game/pass-handler" },
  { moduleKey: "./dist/game/move-executor" },
  { moduleKey: "./dist/game/turn-manager" },
  { moduleKey: "./dist/game/cpu-turn-handler" },
  { moduleKey: "./dist/game/game-controller-slim" },
  { moduleKey: "./dist/ui/handlers/auto" },
  { moduleKey: "./dist/ui/handlers/smart" },
  { moduleKey: "./dist/ui/handlers/sound" },
  { moduleKey: "./dist/ui/handlers/rules-help" },
  { moduleKey: "./dist/ui/handlers/gacha" },
  { moduleKey: "./dist/ui/cosmetics/catalog-shared", globalNames: ["CosmeticCatalogSharedModule"], lateGlobalNames: ["CosmeticCatalogSharedModule"] },
  { moduleKey: "./dist/ui/background-skin/catalog", globalNames: ["BackgroundSkinCatalogModule"], lateGlobalNames: ["BackgroundSkinCatalogModule"] },
  { moduleKey: "./dist/ui/background-skin/selection", globalNames: ["BackgroundSkinSelectionModule"], lateGlobalNames: ["BackgroundSkinSelectionModule"] },
  { moduleKey: "./dist/ui/background-skin/runtime", globalNames: ["BackgroundSkinRuntimeModule"], lateGlobalNames: ["BackgroundSkinRuntimeModule"] },
  { moduleKey: "./dist/ui/background-skin/controller", globalNames: ["BackgroundSkinControllerModule"], lateGlobalNames: ["BackgroundSkinControllerModule"] },
  { moduleKey: "./dist/ui/hand-skin/catalog", globalNames: ["HandSkinCatalogModule"] },
  { moduleKey: "./dist/ui/hand-skin/selection", globalNames: ["HandSkinSelectionModule"] },
  { moduleKey: "./dist/ui/hand-skin/runtime", globalNames: ["HandSkinRuntimeModule"] },
  { moduleKey: "./dist/ui/hand-skin/controller", globalNames: ["HandSkinControllerModule"] },
  { moduleKey: "./dist/ui/handlers/hand-skin" },
  { moduleKey: "./dist/ui/handlers/cpu-policy" },
  { moduleKey: "./dist/ui/handlers/deck-builder" },
  { moduleKey: "./dist/ui/handlers/match-mode" },
  { moduleKey: "./dist/ui/handlers/debug" },
  { moduleKey: "./dist/ui/handlers/init" },
  { moduleKey: "./dist/ui/presentation-handler" },
  { moduleKey: "./dist/ui/event-handlers" }
];

runBootLoadEntries(BOOT_LOAD_ENTRIES);
window.__restoreCardReversiOptionalBootEntries = function() {
  var restored = restoreOptionalBootEntries(BOOT_LOAD_ENTRIES);
  assignBootLateGlobals(BOOT_LOAD_ENTRIES);
  return restored;
};

// ===== Namespace globals for module resolution =====
// Cards & catalogs
requireBootNamespace("CardCatalog", "./dist/cards/catalog");
requireBootNamespace("DeckBuilderControllerModule", "./dist/ui/deck-builder-controller");
// Gacha system
requireBootNamespace("GachaHelpersModule", "./dist/shared/gacha-helpers", { quietOptional: true });
requireBootNamespace("ObservationGachaCatalogSharedModule", "./dist/shared/observation-gacha-catalog-shared", { quietOptional: true });
requireBootNamespace("ObservationGachaCatalogModule", "./dist/shared/observation-gacha-catalog.generated", { quietOptional: true });
requireBootNamespace("GachaProgressStorageModule", "./dist/ui/storage/gacha-progress", { quietOptional: true });
requireBootNamespace("GachaEventsModule", "./dist/ui/gacha/gacha-events", { quietOptional: true });
requireBootNamespace("GachaTransactionModule", "./dist/ui/gacha/gacha-transaction", { quietOptional: true });
requireBootNamespace("GachaOverlayViewModule", "./dist/ui/gacha/gacha-overlay-view", { quietOptional: true });
requireBootNamespace("GachaOverlayControllerModule", "./dist/ui/gacha/gacha-overlay-controller", { quietOptional: true });
requireBootNamespace("GachaItemVisualsModule", "./dist/ui/gacha/gacha-item-visuals", { quietOptional: true });
requireBootNamespace("GachaRevealStageModule", "./dist/ui/gacha/gacha-reveal-stage", { quietOptional: true });
requireBootNamespace("GachaRevealAudioModule", "./dist/ui/gacha/gacha-reveal-audio", { quietOptional: true });
requireBootNamespace("GachaRevealPlayerModule", "./dist/ui/gacha/gacha-reveal-player");
// Hand skin
requireBootNamespace("HandSkinCatalogModule", "./dist/ui/hand-skin/catalog", { quietOptional: true });
requireBootNamespace("HandSkinSelectionModule", "./dist/ui/hand-skin/selection", { quietOptional: true });
requireBootNamespace("HandSkinRuntimeModule", "./dist/ui/hand-skin/runtime", { quietOptional: true });
requireBootNamespace("HandSkinControllerModule", "./dist/ui/hand-skin/controller", { quietOptional: true });
// Background skin
requireBootNamespace("BackgroundSkinCatalogModule", "./dist/ui/background-skin/catalog", { quietOptional: true });
requireBootNamespace("BackgroundSkinSelectionModule", "./dist/ui/background-skin/selection", { quietOptional: true });
requireBootNamespace("BackgroundSkinRuntimeModule", "./dist/ui/background-skin/runtime", { quietOptional: true });
requireBootNamespace("BackgroundSkinControllerModule", "./dist/ui/background-skin/controller", { quietOptional: true });
// Cosmetic
requireBootNamespace("CosmeticCatalogSharedModule", "./dist/ui/cosmetics/catalog-shared", { quietOptional: true });
requireBootNamespace("GachaHandCatalogSharedModule", "./dist/shared/gacha-hand-catalog-shared", { quietOptional: true });
requireBootNamespace("GachaHandCatalogModule", "./dist/shared/gacha-hand-catalog.generated", { quietOptional: true });
// Sound & presentation
requireBootNamespace("PlacementSoundSelectionModule", "./dist/ui/placement-sound-selection");
requireBootNamespace("SoundEngineAccessModule", "./dist/ui/sound-engine-access");
requireBootNamespace("AnimationUtils", "./dist/ui/animation-utils");
requireBootNamespace("ResultOverlayModule", "./dist/ui/result-overlay");
// Core game namespace objects
requireBootNamespace("BoardOps", "./dist/game/logic/board_ops");
requireBootNamespace("AnimationEngine", "./dist/ui/animation-engine");
// Network modules
requireBootNamespace("NetworkCommentaryModule", "./dist/ui/network/commentary");
requireBootNamespace("NetworkCommandPayloadModule", "./dist/ui/network/command-payload");
requireBootNamespace("NetworkActionBridgeModule", "./dist/ui/network/action-bridge");
requireBootNamespace("NetworkApplyCoordinatorModule", "./dist/ui/network/apply-coordinator");
requireBootNamespace("NetworkPublishTrackerModule", "./dist/ui/network/publish-tracker");
requireBootNamespace("NetworkPublishRequestModule", "./dist/ui/network/publish-request");
requireBootNamespace("NetworkSnapshotModule", "./dist/ui/network/snapshot");
requireBootNamespace("NetworkSnapshotRuntimeModule", "./dist/ui/network/snapshot-runtime");
requireBootNamespace("NetworkSnapshotCanonicalModule", "./dist/ui/network/snapshot-canonical");
requireBootNamespace("NetworkSnapshotPresentationModule", "./dist/ui/network/snapshot-presentation");
requireBootNamespace("NetworkSessionSeatModule", "./dist/ui/network/session-seat");
requireBootNamespace("NetworkSessionLifecycleModule", "./dist/ui/network/session-lifecycle");
requireBootNamespace("NetworkReconnectControllerModule", "./dist/ui/network/reconnect-controller");
// Catalog access for gacha
requireBootNamespace("ObservationGachaCatalogAccessModule", "./dist/ui/gacha/catalog-access", { quietOptional: true });
// Card rendering & interaction
requireBootNamespace("HandAnimationUtilsModule", "./dist/cards/card-renderer");

// ===== Direct namespace assignments from boot table =====
// These MUST be set because code uses globalThis.ModuleName to look up modules.
// Object.assign(window, moduleExports) spreads properties but does not create namespaces.
assignBootLateGlobals(BOOT_LOAD_ENTRIES);

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
