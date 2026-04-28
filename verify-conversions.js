const fs = require('fs');

const files = [
  'src/engine/selfplay-runner.js',
  'ui/animation-engine.js',
  'ui/handlers/match-mode.js',
  'scripts/generate-selfplay-data.js',
  'ui/result-overlay.js',
  'scripts/benchmark-policy-adoption.js',
  'ui/story/story-steps.js',
  'ui/board-renderer.js',
  'game/ai/policy-onnx-runtime.js',
  'ui/bootstrap.js',
  'ui/deck-builder-controller.js',
  'scripts/benchmark-selfplay-policy.js',
  'ui.js',
  'scripts/load-training-profile.js',
  'scripts/benchmark-policy-onnx-gate.js',
  'ui/network/snapshot.js',
  'ui/status-display.js',
  'ui/tutorial/tutorial-steps.js',
  'scripts/monitor-selfplay-training-run.js',
  'sound-engine.js',
  'ui/handlers/debug.js',
  'game/ai/policy-table-runtime.js',
  'game/turn/turn_pipeline_phase_helpers.js',
  'ui/handlers/cpu-policy.js',
  'game/cards/effect-resolver.js',
  'ui/handlers/rules-help.js',
  'ui/presentation-handler.js',
  'ui/playback-state-manager.js',
  'ui/tutorial/tutorial-controller.js',
  'ui/move-executor-visuals.js',
  'ui/story/story-controller.js',
  'game/cpu-decision-board-utils.js',
  'game/debug/debug-actions.js',
  'game/special-effects/hyperactive.js',
  'game/special-effects/dragons.js',
  'game/schema/action_manager.js',
  'game/move-generator.js',
  'game/pass-handler.js',
  'game/network-turn-handoff.js',
  'game/move-executor.js',
  'game/visual-effects-map.js',
  'cards/card-interaction-effects.js',
  'utils/owner-helpers.js',
  'game/turn-handlers/pending-target-selector.js'
];

let ok = 0, fail = 0;
files.forEach(f => {
  const tsPath = f.replace('.js', '.ts');
  const jsContent = fs.readFileSync(f, 'utf8');
  const tsContent = fs.readFileSync(tsPath, 'utf8');
  const jsIsWrapper = jsContent.includes('module.exports = require');
  const tsHasNocheck = tsContent.includes('@ts-nocheck');
  if (jsIsWrapper && tsHasNocheck) {
    ok++;
  } else {
    fail++;
    console.log('FAIL:', f, '- wrapper:', jsIsWrapper, 'nocheck:', tsHasNocheck);
  }
});
console.log('Results: ' + ok + ' OK, ' + fail + ' FAILED out of ' + files.length);
