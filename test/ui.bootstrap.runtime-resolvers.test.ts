import { createRuntimeResolvers } from '../ui/bootstrap/runtime-resolvers';

describe('bootstrap runtime CPU delay override', () => {
  afterEach(() => {
    delete (globalThis as any).CPU_TURN_DELAY_MS;
  });

  test('normal play does not expose the legacy global override', () => {
    (globalThis as any).CPU_TURN_DELAY_MS = 18;
    const resolvers = createRuntimeResolvers({
      getRegisteredUIGlobals: () => ({}),
      isDebugSessionEnabled: () => false
    });

    expect(resolvers.readExplicitCpuTurnDelayMs()).toBeNull();
  });

  test('debug boundary exposes only a finite override', () => {
    const resolvers = createRuntimeResolvers({
      getRegisteredUIGlobals: () => ({}),
      isDebugSessionEnabled: () => true
    });
    (globalThis as any).CPU_TURN_DELAY_MS = 18.7;
    expect(resolvers.readExplicitCpuTurnDelayMs()).toBe(18.7);

    (globalThis as any).CPU_TURN_DELAY_MS = Number.NaN;
    expect(resolvers.readExplicitCpuTurnDelayMs()).toBeNull();

    (globalThis as any).CPU_TURN_DELAY_MS = null;
    expect(resolvers.readExplicitCpuTurnDelayMs()).toBeNull();
  });
});
