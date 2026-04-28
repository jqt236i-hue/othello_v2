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
const runtime = __importStar(require("../ui/background-skin/runtime.js"));
describe('background skin runtime', () => {
    function createStyle() {
        const values = {};
        return {
            values,
            setProperty(name, value) { values[name] = value; },
            removeProperty(name) { delete values[name]; },
            set backgroundImage(value) { values.backgroundImage = value; },
            get backgroundImage() { return values.backgroundImage; },
            set backgroundPosition(value) { values.backgroundPosition = value; },
            get backgroundPosition() { return values.backgroundPosition; },
            set backgroundRepeat(value) { values.backgroundRepeat = value; },
            get backgroundRepeat() { return values.backgroundRepeat; },
            set backgroundSize(value) { values.backgroundSize = value; },
            get backgroundSize() { return values.backgroundSize; }
        };
    }
    test('applies selected background at its natural size without cropping', () => {
        const bodyStyle = createStyle();
        const attrs = {};
        const rootRef = {
            document: {
                body: {
                    style: bodyStyle,
                    setAttribute(name, value) { attrs[name] = value; }
                },
                documentElement: {
                    setAttribute(name, value) { attrs[`root:${name}`] = value; }
                }
            },
            BackgroundSkinCatalogModule: {
                getBackgroundSkinDefinition() {
                    return {
                        id: 'observation-desk',
                        imagePath: 'assets/images/background-skin/観測の机.png'
                    };
                }
            }
        };
        const applied = runtime.applyBackgroundSkin(rootRef, 'observation-desk');
        expect(applied.id).toBe('observation-desk');
        expect(attrs['data-background-skin-id']).toBe('observation-desk');
        expect(bodyStyle.values.backgroundImage).toBe('var(--selected-background-skin)');
        expect(bodyStyle.values.backgroundPosition).toBe('center center');
        expect(bodyStyle.values.backgroundRepeat).toBe('no-repeat');
        expect(bodyStyle.values.backgroundSize).toBe('auto');
    });
});
//# sourceMappingURL=ui.background-skin-runtime.test.js.map