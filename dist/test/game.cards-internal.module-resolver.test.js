"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const ModuleResolver = __importStar(require("../game/logic/cards-internal/module-resolver.js"));
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
            }
            finally {
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
//# sourceMappingURL=game.cards-internal.module-resolver.test.js.map