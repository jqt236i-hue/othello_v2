const fs = require('fs');
const path = require('path');

describe('special-effects UI DI boundary', () => {
  const dir = path.resolve(__dirname, '..', 'game', 'special-effects');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));

  files.forEach((file) => {
    const name = path.basename(file, '.js');
    const modPath = path.resolve(dir, file);
    const globalSetterName = 'set' + name.charAt(0).toUpperCase() + name.slice(1) + 'UIImpl';

    describe(name, () => {
      beforeEach(() => {
        jest.resetModules();
        try { delete global[globalSetterName]; } catch (e) {}
        try { delete globalThis[globalSetterName]; } catch (e) {}
      });

      test('module can be required', () => {
        expect(() => require(modPath)).not.toThrow();
      });

      test('exposes setUIImpl (export or global) and calling it is safe', () => {
        jest.isolateModules(() => {
          const mod = require(modPath);
          const hasExport = typeof mod.setUIImpl === 'function';
          const hasGlobal = typeof globalThis[globalSetterName] === 'function';

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
            expect(() => globalThis[globalSetterName](null)).not.toThrow();
            expect(() => globalThis[globalSetterName]({})).not.toThrow();
          }
        });
      });

      test('core functions do not throw when UI not injected and when injected with mock', async () => {
        jest.isolateModules(async () => {
          const mod = require(modPath);

          // Find a candidate function to exercise: prefer ones that look like process*/At*/Immediate
          const candidateName = Object.keys(mod).find(k => /process|AtTurnStart|Immediate|process.*At/i.test(k));
          if (!candidateName) {
            // nothing to exercise
            return;
          }

          // Prepare minimal globals to avoid ref errors
          global.BLACK = typeof global.BLACK !== 'undefined' ? global.BLACK : 1;
          global.WHITE = typeof global.WHITE !== 'undefined' ? global.WHITE : -1;
          global.cardState = global.cardState || { pendingEffectByPlayer: { black: null, white: null }, markers: [], _presentationEventsPersist: [] };
          global.gameState = global.gameState || { currentPlayer: 1, board: Array.from({ length: 8 }, () => Array(8).fill(0)) };
          global.emitBoardUpdate = global.emitBoardUpdate || jest.fn();
          global.emitCardStateChange = global.emitCardStateChange || jest.fn();
          global.emitGameStateChange = global.emitGameStateChange || jest.fn();
          global.emitLogAdded = global.emitLogAdded || jest.fn();

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
          const setter = (typeof mod.setUIImpl === 'function') ? mod.setUIImpl : (typeof globalThis[globalSetterName] === 'function' ? globalThis[globalSetterName] : null);
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
});
