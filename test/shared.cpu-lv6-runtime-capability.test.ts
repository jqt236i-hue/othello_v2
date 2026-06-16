import * as cpuLv6SharedProfile from '../constants/cpu-lv6-shared-profile.js';
import * as CpuLv6RuntimeCapability from '../shared/cpu-lv6-runtime-capability.js';

describe('shared cpu lv6 runtime capability', () => {
  function profileWithModes(moveDecisionMode?: string, cardDecisionMode?: string): any {
    return {
      browser: {
        moveDecisionMode,
        cardDecisionMode
      }
    };
  }

  test('shared ONNX decision helper is move-only', () => {
    expect(
      CpuLv6RuntimeCapability.shouldUseCpuLv6OnnxMoveDecision(
        profileWithModes('policy-table-lookahead', 'policy-table-core')
      )
    ).toBe(false);

    expect(
      CpuLv6RuntimeCapability.shouldUseCpuLv6OnnxMoveDecision(
        profileWithModes('onnx', 'onnx')
      )
    ).toBe(true);

    expect(
      CpuLv6RuntimeCapability.shouldUseCpuLv6OnnxMoveDecision(
        profileWithModes('hybrid', 'hybrid')
      )
    ).toBe(true);

    expect(
      CpuLv6RuntimeCapability.shouldUseCpuLv6OnnxMoveDecision(profileWithModes())
    ).toBe(true);
  });

  test('shared profile uses ONNX as the primary browser Lv6 move path and keeps card decisions on policy table', () => {
    const capability = CpuLv6RuntimeCapability.resolveCpuLv6BrowserRuntimeCapability(cpuLv6SharedProfile);

    expect(capability.primaryMoveSource).toBe('onnx');
    expect(capability.primaryCardSource).toBe('policy-table');
    expect(capability.usesOnnxMoveDecision).toBe(true);
    expect(capability.usesPolicyTableLookaheadMoveDecision).toBe(false);
    expect(capability.usesPolicyTableCoreCardDecision).toBe(true);
    expect(capability.shouldLoadPrimaryOnnxRuntime).toBe(true);
    expect(capability.hasAuxiliaryTargetHead).toBe(true);
    expect(capability.hasAuxiliaryValueHead).toBe(true);
  });

  test('forcePrimaryOnnx only changes primary-load gating and keeps guard overrides explicit', () => {
    const capability = CpuLv6RuntimeCapability.resolveCpuLv6BrowserRuntimeCapability(cpuLv6SharedProfile, {
      forcePrimaryOnnx: true,
      guardOverrides: { moveBudgetMs: 99 },
      legacyPendingSelectionBudgetMs: 77
    });

    expect(capability.shouldLoadPrimaryOnnxRuntime).toBe(true);
    expect(capability.onnxRuntimeGuard.moveBudgetMs).toBe(99);
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

  test('shared helper exposes teacher profile and lookahead weights from the shared profile', () => {
    expect(CpuLv6RuntimeCapability.resolveCpuLv6TeacherProfile(cpuLv6SharedProfile)).toBe(cpuLv6SharedProfile.teacher);
    expect(CpuLv6RuntimeCapability.resolveCpuLv6LookaheadWeights(cpuLv6SharedProfile)).toEqual(cpuLv6SharedProfile.browser.lookaheadWeights);
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
