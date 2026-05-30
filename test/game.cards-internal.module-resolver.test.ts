import * as ModuleResolver from '../game/logic/cards-internal/module-resolver.js';

describe('module-resolver', () => {
  describe('resolveModule', () => {
    test('resolves from readLocal when valid', () => {
      const local = { foo: 'bar' };
      const result = ModuleResolver.resolveModule({
        readLocal: () => local,
        isValid: (v) => v && v.foo === 'bar'
      });
      expect(result).toBe(local);
    });

    test('falls back to requireFn when readLocal returns invalid', () => {
      const required = { baz: 'qux' };
      const result = ModuleResolver.resolveModule({
        readLocal: () => null,
        requirePath: './my-module',
        requireFn: (path) => {
          expect(path).toBe('./my-module');
          return required;
        },
        isValid: (v) => v && typeof v === 'object'
      });
      expect(result).toBe(required);
    });

    test('falls back to globalName when local and require fail', () => {
      global.MyTestModule = { hello: 'world' };
      try {
        const result = ModuleResolver.resolveModule({
          readLocal: () => null,
          requirePath: './nonexistent',
          requireFn: () => { throw new Error('not found'); },
          globalName: 'MyTestModule',
          isValid: (v) => v && v.hello === 'world'
        });
        expect(result).toEqual({ hello: 'world' });
      } finally {
        delete global.MyTestModule;
      }
    });

    test('returns null when all sources fail and required is false', () => {
      const result = ModuleResolver.resolveModule({
        readLocal: () => null,
        requireFn: () => null,
        isValid: () => false,
        required: false
      });
      expect(result).toBeNull();
    });

    test('throws when required is true and module cannot be resolved', () => {
      expect(() => ModuleResolver.resolveModule({
        readLocal: () => null,
        requireFn: () => null,
        isValid: () => false,
        required: true,
        label: 'ImportantModule'
      })).toThrow('ImportantModule not loaded');
    });

    test('uses default truthy isValid when not provided', () => {
      const result = ModuleResolver.resolveModule({
        readLocal: () => ({ value: 1 })
      });
      expect(result).toEqual({ value: 1 });
    });

    test('default validation rejects __esModule-only require result and falls back to global', () => {
      global.MyUmdModule = { applyCaptureWill: () => true };
      try {
        const result = ModuleResolver.resolveModule({
          requirePath: './umd-module',
          requireFn: () => ({ __esModule: true }),
          globalName: 'MyUmdModule'
        });
        expect(result).toBe(global.MyUmdModule);
      } finally {
        delete global.MyUmdModule;
      }
    });

    test('skips readLocal when not a function', () => {
      const result = ModuleResolver.resolveModule({
        readLocal: 'not-a-function',
        requirePath: './mod',
        requireFn: () => ({ value: 2 }),
        isValid: (v) => v && typeof v === 'object'
      });
      expect(result).toEqual({ value: 2 });
    });

    test('uses label in error message from globalName', () => {
      expect(() => ModuleResolver.resolveModule({
        globalName: 'MissingGlobal',
        required: true
      })).toThrow('MissingGlobal not loaded');
    });

    test('uses label in error message from requirePath', () => {
      expect(() => ModuleResolver.resolveModule({
        requirePath: './missing',
        requireFn: () => { throw new Error('fail'); },
        required: true
      })).toThrow('./missing not loaded');
    });

    test('handles readLocal throwing an exception', () => {
      const result = ModuleResolver.resolveModule({
        readLocal: () => { throw new Error('boom'); },
        requirePath: './fallback',
        requireFn: () => ({ recovered: true }),
        isValid: (v) => v && typeof v === 'object'
      });
      expect(result).toEqual({ recovered: true });
    });

    test('handles requireFn throwing an exception', () => {
      const result = ModuleResolver.resolveModule({
        requirePath: './bad',
        requireFn: () => { throw new Error('bad'); },
        isValid: () => false,
        required: false
      });
      expect(result).toBeNull();
    });
  });
});
