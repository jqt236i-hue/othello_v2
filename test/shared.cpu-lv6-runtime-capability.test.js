const cpuLv6SharedProfile = require('../constants/cpu-lv6-shared-profile');
const CpuLv6RuntimeCapability = require('../shared/cpu-lv6-runtime-capability');

describe('shared cpu lv6 runtime capability', () => {
  test('shared profile keeps policy-table as the primary browser Lv6 path', () => {
    const capability = CpuLv6RuntimeCapability.resolveCpuLv6BrowserRuntimeCapability(cpuLv6SharedProfile);

    expect(capability.primaryMoveSource).toBe('policy-table');
    expect(capability.primaryCardSource).toBe('policy-table');
    expect(capability.usesPolicyTableLookaheadMoveDecision).toBe(true);
    expect(capability.usesPolicyTableCoreCardDecision).toBe(true);
    expect(capability.shouldLoadPrimaryOnnxRuntime).toBe(false);
    expect(capability.hasAuxiliaryTargetHead).toBe(true);
    expect(capability.hasAuxiliaryValueHead).toBe(true);
  });

  test('forcePrimaryOnnx only changes primary-load gating and keeps guard overrides explicit', () => {
    const capability = CpuLv6RuntimeCapability.resolveCpuLv6BrowserRuntimeCapability(cpuLv6SharedProfile, {
      forcePrimaryOnnx: true,
      guardOverrides: { cardBudgetMs: 33 },
      legacyPendingSelectionBudgetMs: 77
    });

    expect(capability.shouldLoadPrimaryOnnxRuntime).toBe(true);
    expect(capability.onnxRuntimeGuard.moveBudgetMs).toBe(120);
    expect(capability.onnxRuntimeGuard.cardBudgetMs).toBe(33);
    expect(capability.onnxRuntimeGuard.pendingSelectionBudgetMs).toBe(77);
  });

  test('lookahead caps resolve by white ui, white headless, and black branches', () => {
    expect(
      CpuLv6RuntimeCapability.resolveCpuLv6LookaheadTimeCaps(cpuLv6SharedProfile, {
        playerKey: 'white',
        isBrowserUi: true
      })
    ).toEqual(cpuLv6SharedProfile.browser.lookaheadTimeCaps.whiteUi);

    expect(
      CpuLv6RuntimeCapability.resolveCpuLv6LookaheadTimeCaps(cpuLv6SharedProfile, {
        playerKey: 'white',
        isBrowserUi: false
      })
    ).toEqual(cpuLv6SharedProfile.browser.lookaheadTimeCaps.whiteHeadless);

    expect(
      CpuLv6RuntimeCapability.resolveCpuLv6LookaheadTimeCaps(cpuLv6SharedProfile, {
        playerKey: 'black',
        isBrowserUi: true
      })
    ).toEqual(cpuLv6SharedProfile.browser.lookaheadTimeCaps.black);
  });

  test('standard-board compatibility helper only accepts 8x8 boards', () => {
    expect(
      CpuLv6RuntimeCapability.isStandardBoardCpuPolicyCompatible(
        Array.from({ length: 8 }, () => Array(8).fill(0))
      )
    ).toBe(true);
    expect(
      CpuLv6RuntimeCapability.isStandardBoardCpuPolicyCompatible(
        Array.from({ length: 7 }, () => Array(9).fill(0))
      )
    ).toBe(false);
  });
});
