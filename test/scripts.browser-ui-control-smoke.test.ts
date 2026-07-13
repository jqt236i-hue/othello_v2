const {
  REQUIRED_UI_CONTROL_SMOKE_TARGETS,
  evaluateUiControlSmokeSample
} = require('../scripts/browser-ui-control-smoke');

function passingControls() {
  return REQUIRED_UI_CONTROL_SMOKE_TARGETS.reduce((acc: any, target: any) => {
    acc[target.name] = {
      selector: target.selector,
      present: true,
      visible: true,
      enabled: true,
      clicked: true,
      opened: true,
      beforeState: target.stateAttribute ? 'false' : null,
      afterState: target.stateAttribute ? 'true' : null
    };
    return acc;
  }, {});
}

describe('browser UI control smoke evaluation', () => {
  test('rejects startup-visible controls that are missing, unusable, or fail to open', () => {
    const controls = passingControls();
    controls.debug.present = false;
    controls.handSkin.opened = false;
    controls.gacha.visible = false;
    controls.leaderboard.enabled = false;
    controls.network.clicked = false;

    const result = evaluateUiControlSmokeSample({
      controls,
      startupScriptSignals: [
        'http://127.0.0.1/public/module-registry.js',
        'http://127.0.0.1/public/module-registry.optional.js'
      ],
      postInteractionScriptSignals: [
        'http://127.0.0.1/node_modules/onnxruntime-web/dist/ort.min.js'
      ],
      pageErrors: ['TypeError: setupDebugControls is not a function'],
      consoleErrors: ['failed to lazy load cosmetic group'],
      resourceErrors: ['404 http://127.0.0.1/assets/missing.png']
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('debug control #debugModeBtn is missing');
    expect(result.errors).toContain('handSkin control #handSkinBtn did not open #handSkinPanel');
    expect(result.errors).toContain('gacha control #gachaOpenBtn is not visible');
    expect(result.errors).toContain('leaderboard control #leaderboardOpenBtn is disabled');
    expect(result.errors).toContain('network control #modeNetworkBtn was not clicked');
    expect(result.errors).toContain('optional registry was loaded before user interaction');
    expect(result.errors).toContain('ONNX runtime was loaded during UI control smoke');
    expect(result.errors).toContain('page error: TypeError: setupDebugControls is not a function');
    expect(result.errors).toContain('console error: failed to lazy load cosmetic group');
    expect(result.errors).toContain('resource error: 404 http://127.0.0.1/assets/missing.png');
  });

  test('accepts required shells that stay interactive while lazy bodies load after click', () => {
    const result = evaluateUiControlSmokeSample({
      controls: passingControls(),
      startupScriptSignals: [
        'http://127.0.0.1/public/runtime.js',
        'http://127.0.0.1/public/module-registry.js',
        'http://127.0.0.1/entry-browser.js'
      ],
      postInteractionScriptSignals: [
        'http://127.0.0.1/public/module-registry.optional.js'
      ],
      pageErrors: [],
      consoleErrors: []
    });

    expect(result).toEqual({ ok: true, errors: [] });
  });
});
