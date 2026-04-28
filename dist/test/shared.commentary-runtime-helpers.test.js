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
const helpers = __importStar(require("../shared/commentary-runtime-helpers.js"));
describe('CommentaryRuntimeHelpers', () => {
    test('extracts cardId from playback events and resolves event type', () => {
        const playbackEvents = [
            { type: 'noop' },
            {
                type: 'card_use_animation',
                targets: [{ owner: 'black', cardId: 'swap_01' }]
            }
        ];
        const cardId = helpers.extractCardIdFromPlaybackEvents(playbackEvents);
        const eventType = helpers.resolveCommentaryEventType('use_card', cardId);
        expect(cardId).toBe('swap_01');
        expect(eventType).toBe('card_used');
    });
    test('normalizes player key when building CPU speaker prefix', () => {
        expect(helpers.getCpuSpeakerPrefix(' WHITE ')).toBe('白CPU');
        expect(helpers.getCpuSpeakerPrefix('black')).toBe('黒CPU');
    });
    test('returns 勇者 prefix for hero speaker role', () => {
        expect(helpers.getSpeakerPrefix(' WHITE ', 'hero')).toBe('勇者');
        expect(helpers.getSpeakerPrefix('black', ' HERO ')).toBe('勇者');
    });
    test('resolves commentary runtime from global or require loader', () => {
        const runtime = { requestCommentary: jest.fn() };
        const fromGlobal = helpers.resolveCommentaryRuntimeFromGlobal({
            CpuCommentaryRuntime: runtime
        });
        const fromRequire = helpers.resolveCommentaryRuntimeByRequire(['missing', 'ok'], (moduleId) => {
            if (moduleId === 'ok')
                return runtime;
            throw new Error('not found');
        });
        expect(fromGlobal).toBe(runtime);
        expect(fromRequire).toBe(runtime);
    });
});
//# sourceMappingURL=shared.commentary-runtime-helpers.test.js.map