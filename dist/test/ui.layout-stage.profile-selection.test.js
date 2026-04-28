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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vm = __importStar(require("vm"));
const filePath = path.resolve(__dirname, '..', 'ui', 'layout-stage.js');
const source = fs.readFileSync(filePath, 'utf8');
function createMockRoot(initialAttributes = {}) {
    const attributes = { ...initialAttributes };
    const classes = new Set();
    const styles = {};
    return {
        classList: {
            add(...tokens) {
                tokens.forEach((token) => classes.add(token));
            },
            toggle(token, force) {
                const shouldAdd = force === undefined ? !classes.has(token) : !!force;
                if (shouldAdd) {
                    classes.add(token);
                }
                else {
                    classes.delete(token);
                }
            },
            contains(token) {
                return classes.has(token);
            }
        },
        setAttribute(name, value) {
            attributes[name] = String(value);
        },
        getAttribute(name) {
            return Object.prototype.hasOwnProperty.call(attributes, name) ? attributes[name] : null;
        },
        style: {
            setProperty(name, value) {
                styles[name] = String(value);
            },
            getPropertyValue(name) {
                return styles[name] || '';
            }
        }
    };
}
function runLayoutStage({ width, height, screenHeight = 1080, availHeight = 1040, media = {}, userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', maxTouchPoints = 0, simAspect = null, touchStart = false }) {
    const root = createMockRoot(simAspect ? { 'data-sim-aspect': simAspect } : {});
    const document = {
        documentElement: root,
        readyState: 'complete',
        addEventListener: jest.fn()
    };
    const window = {
        document,
        innerWidth: width,
        innerHeight: height,
        devicePixelRatio: 1,
        screen: {
            height: screenHeight,
            availHeight
        },
        matchMedia: jest.fn((query) => ({ matches: !!media[query] })),
        addEventListener: jest.fn(),
        requestAnimationFrame: jest.fn((callback) => {
            callback();
            return 1;
        }),
        cancelAnimationFrame: jest.fn()
    };
    if (touchStart) {
        window.ontouchstart = jest.fn();
    }
    const navigator = {
        userAgent,
        maxTouchPoints
    };
    const context = {
        window,
        document,
        navigator,
        console,
        setTimeout,
        clearTimeout,
        Promise
    };
    context.globalThis = context;
    vm.runInNewContext(source, context, { filename: filePath });
    return root;
}
describe('layout-stage profile selection', () => {
    test('keeps wide layout for fine-pointer desktop windows near tablet aspect ratios', () => {
        const root = runLayoutStage({
            width: 1366,
            height: 900,
            media: {
                '(pointer: fine)': true,
                '(hover: hover)': true
            }
        });
        expect(root.getAttribute('data-layout-profile')).toBe('layout-profile-16x9');
        expect(root.classList.contains('layout-profile-16x9')).toBe(true);
        expect(root.style.getPropertyValue('--layout-base-width')).toBe('1920');
        expect(root.style.getPropertyValue('--layout-base-height')).toBe('1080');
    });
    test('keeps tablet layout for touch-first landscape tablets', () => {
        const root = runLayoutStage({
            width: 1366,
            height: 900,
            media: {
                '(pointer: coarse)': true,
                '(any-pointer: coarse)': true
            },
            maxTouchPoints: 5,
            touchStart: true
        });
        expect(root.getAttribute('data-layout-profile')).toBe('layout-profile-tablet-4x3');
        expect(root.classList.contains('layout-profile-tablet-4x3')).toBe(true);
        expect(root.style.getPropertyValue('--layout-base-width')).toBe('1366');
        expect(root.style.getPropertyValue('--layout-base-height')).toBe('960');
    });
    test('allows explicit aspect simulation to force tablet layout on desktop', () => {
        const root = runLayoutStage({
            width: 1916,
            height: 1077,
            media: {
                '(pointer: fine)': true,
                '(hover: hover)': true
            },
            simAspect: '4:3'
        });
        expect(root.getAttribute('data-layout-profile')).toBe('layout-profile-tablet-4x3');
        expect(root.classList.contains('layout-profile-tablet-4x3')).toBe(true);
    });
});
//# sourceMappingURL=ui.layout-stage.profile-selection.test.js.map