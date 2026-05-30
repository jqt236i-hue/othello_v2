import * as ModuleExportUtils from '../shared/module-export-utils.js';

describe('module-export-utils', () => {
  test('treats __esModule-only export object as unusable', () => {
    expect(ModuleExportUtils.hasUsableModuleExport({ __esModule: true })).toBe(false);
  });

  test('prefers self-registered global module over empty require result', () => {
    const requireResult = { __esModule: true };
    const selfRegisteredGlobal = { applyCaptureWill: () => true };
    expect(ModuleExportUtils.preferUsableModuleExport(requireResult, selfRegisteredGlobal)).toBe(selfRegisteredGlobal);
  });

  test('keeps direct module export when it is usable', () => {
    const directModule = { applyCaptureWill: () => true };
    const fallbackGlobal = { ignored: true };
    expect(ModuleExportUtils.preferUsableModuleExport(directModule, fallbackGlobal)).toBe(directModule);
  });
});
