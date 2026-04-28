import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface Args {
    alpha: number;
    dir: string;
}

interface PngData {
    width: number;
    height: number;
    data: Buffer;
}

interface RowResult {
    file: string;
    canvas: string;
    opaque: string;
    fillW: string;
    fillH: string;
}

function parseArgs(argv: string[]): Args {
    const args: Args = { alpha: 16, dir: path.join(__dirname, '..', 'assets', 'images', 'stones') };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--alpha') args.alpha = Number(argv[++i]);
        else if (a === '--dir') args.dir = path.resolve(argv[++i]);
    }
    return args;
}

function readPng(filePath: string): Promise<PngData> {
    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(new PNG())
            .on('parsed', function onParsed(this: any) { resolve(this); })
            .on('error', reject);
    });
}

interface Bounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

function findOpaqueBounds(png: PngData, alphaCutoff: number): Bounds | null {
    const { width, height, data } = png;
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) << 2;
            const a = data[idx + 3];
            if (a >= alphaCutoff) {
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }
    }
    if (maxX < minX || maxY < minY) return null;
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
    const rows: RowResult[] = [];
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

main().catch((e: any) => {
    console.error(e && e.stack ? e.stack : e);
    process.exit(1);
});
