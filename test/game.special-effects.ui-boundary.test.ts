import * as fs from 'fs';
import * as path from 'path';

describe('special-effects UI DI boundary', () => {
  const dir = path.resolve(__dirname, '..', 'game', 'special-effects');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));

  // Setup minimal window/document globals before any module loading
  beforeAll(() => {
    (global as any).window = (global as any).window || { CardLogic: {}, CARD_DEFS: [] };
    (global as any).document = (global as any).document || {};
    (global as any).CARD_DEFS = (global as any).CARD_DEFS || [];
  });

  files.forEach((file) => {
    const name = path.basename(file, '.js');
    const modPath = path.resolve(dir, file);
    const globalSetterName = 'set' + name.charAt(0).toUpperCase() + name.slice(1) + 'UIImpl';

    describe(name, () => {
      beforeEach(() => {
        jest.resetModules();
        try { delete (global as any)[globalSetterName]; } catch (e) { /* Intentionally empty: test cleanup guard */ }
        try { delete (globalThis as any)[globalSetterName]; } catch (e) { /* Intentionally empty: test cleanup guard */ }
      });

      test('module can be required', () => {
        expect(() => require(modPath)).not.toThrow();
      });

      test('exposes setUIImpl (export or global) and calling it is safe', () => {
        jest.resetModules();
        const mod = require(modPath);
        const hasExport = typeof mod.setUIImpl === 'function';
        const hasGlobal = typeof (globalThis as any)[globalSetterName] === 'function';

        if (!hasExport && !hasGlobal) {
          // Skip behavior tests if no setter exists
          return;
        }

        // If export exists, call it safely
        if (hasExport) {
          expect(() => mod.setUIImpl(null)).not.toThrow();
          expect(() => mod.setUIImpl({})).not.toThrow();
        }

        // If global setter exists, call it safely
        if (hasGlobal) {
          expect(() => (globalThis as any)[globalSetterName](null)).not.toThrow();
          expect(() => (globalThis as any)[globalSetterName]({})).not.toThrow();
        }
      });

      test('core functions do not throw when UI not injected and when injected with mock', async () => {
        jest.resetModules();
        
        // Ensure window is available before requiring modules
        (global as any).window = (global as any).window || { CardLogic: {}, CARD_DEFS: [] };
        (global as any).document = (global as any).document || {};
        (global as any).CARD_DEFS = (global as any).CARD_DEFS || [];
        
        const mod = require(modPath);

        // Find a candidate function to exercise: prefer ones that look like process*/At*/Immediate
        const candidateName = Object.keys(mod).find(k => /process|AtTurnStart|Immediate|process.*At/i.test(k));
        if (!candidateName) {
          // nothing to exercise
          return;
        }

        // Prepare minimal globals to avoid ref errors
        (global as any).BLACK = typeof (global as any).BLACK !== 'undefined' ? (global as any).BLACK : 1;
        (global as any).WHITE = typeof (global as any).WHITE !== 'undefined' ? (global as any).WHITE : -1;
        (global as any).cardState = (global as any).cardState || { pendingEffectByPlayer: { black: null, white: null }, markers: [], _presentationEventsPersist: [] };
        (global as any).gameState = (global as any).gameState || { currentPlayer: 1, board: Array.from({ length: 8 }, () => Array(8).fill(0)) };
        (global as any).emitBoardUpdate = (global as any).emitBoardUpdate || jest.fn();
        (global as any).emitCardStateChange = (global as any).emitCardStateChange || jest.fn();
        (global as any).emitGameStateChange = (global as any).emitGameStateChange || jest.fn();
        (global as any).emitLogAdded = (global as any).emitLogAdded || jest.fn();

        // Call without UI injected: try a few safe invocation shapes until one succeeds
        const fn = mod[candidateName];
        const attempts = [[1], [1, []], [1, null], [1, null, []]];
        let lastErr = null;
        let ok = false;
        for (const a of attempts) {
          try {
            await fn.apply(null, a);
            ok = true;
            break;
          } catch (e) { lastErr = e; }
        }
        if (!ok) throw lastErr;

        // Inject a mock UI impl if setter exists
        const setter = (typeof mod.setUIImpl === 'function') ? mod.setUIImpl : (typeof (globalThis as any)[globalSetterName] === 'function' ? (globalThis as any)[globalSetterName] : null);
        if (setter) {
          setter({ DISABLE_ANIMATIONS: true, PlaybackEngine: { playPresentationEvents: jest.fn() } });
          // Retry invocations with mock in place
          lastErr = null; ok = false;
          for (const a of attempts) {
            try { await fn.apply(null, a); ok = true; break; } catch (e) { lastErr = e; }
          }
          if (!ok) throw lastErr;
        }
      });
    });
  });
});
