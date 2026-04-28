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
function parseArgs(argv) {
    const args = { alpha: 16, dir: path.join(__dirname, '..', 'assets', 'images', 'stones') };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--alpha')
            args.alpha = Number(argv[++i]);
        else if (a === '--dir')
            args.dir = path.resolve(argv[++i]);
    }
    return args;
}
function readPng(filePath) {
    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(new pngjs_1.PNG())
            .on('parsed', function onParsed() { resolve(this); })
            .on('error', reject);
    });
}
function findOpaqueBounds(png, alphaCutoff) {
    const { width, height, data } = png;
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) << 2;
            const a = data[idx + 3];
            if (a >= alphaCutoff) {
                if (x < minX)
                    minX = x;
                if (y < minY)
                    minY = y;
                if (x > maxX)
                    maxX = x;
                if (y > maxY)
                    maxY = y;
            }
        }
    }
    if (maxX < minX || maxY < minY)
        return null;
    return {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1
    };
}
async function main() {
    const args = parseArgs(process.argv);
    const files = fs.readdirSync(args.dir).filter((n) => n.toLowerCase().endsWith('.png')).sort();
    const rows = [];
    for (const file of files) {
        const full = path.join(args.dir, file);
        const png = await readPng(full);
        const box = findOpaqueBounds(png, args.alpha);
        const occW = box ? box.width : 0;
        const occH = box ? box.height : 0;
        rows.push({
            file,
            canvas: `${png.width}x${png.height}`,
            opaque: `${occW}x${occH}`,
            fillW: png.width ? (occW / png.width).toFixed(4) : '0.0000',
            fillH: png.height ? (occH / png.height).toFixed(4) : '0.0000'
        });
    }
    console.log(`alphaCutoff=${args.alpha}`);
    console.table(rows);
}
main().catch((e) => {
    console.error(e && e.stack ? e.stack : e);
    process.exit(1);
});
//# sourceMappingURL=analyze-stone-margins.js.map