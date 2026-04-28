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
const pngjs_1 = require("pngjs");
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
function checkImage(filePath) {
    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(new pngjs_1.PNG())
            .on('parsed', function () {
            const { width, height, data } = this;
            // check a 2px border for any transparent pixels
            const checkCoords = [];
            for (let x = 0; x < width; x++) {
                for (let y of [0, 1, height - 2, height - 1])
                    checkCoords.push([x, y]);
            }
            for (let y = 0; y < height; y++) {
                for (let x of [0, 1, width - 2, width - 1])
                    checkCoords.push([x, y]);
            }
            let transparentCount = 0;
            for (const [x, y] of checkCoords) {
                const idx = (width * y + x) << 2;
                const alpha = data[idx + 3];
                if (alpha < 255)
                    transparentCount++;
            }
            resolve({ file: filePath, width, height, transparentBorderPixels: transparentCount });
        })
            .on('error', reject);
    });
}
(async function () {
    const stonesDir = path.join(__dirname, '..', 'assets', 'images', 'stones');
    const files = ['normal_stone-black.png', 'normal_stone-white.png'];
    for (const f of files) {
        const p = path.join(stonesDir, f);
        if (!fs.existsSync(p)) {
            console.log(`MISSING: ${p}`);
            continue;
        }
        try {
            const r = await checkImage(p);
            console.log(JSON.stringify(r));
        }
        catch (e) {
            console.error('ERR', p, e.message);
        }
    }
})();
//# sourceMappingURL=check_stone_alpha.js.map