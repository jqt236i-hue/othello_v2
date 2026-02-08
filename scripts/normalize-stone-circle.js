const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

function parseArgs(argv) {
    const args = {
        dir: path.join(__dirname, '..', 'assets', 'images', 'stones'),
        alpha: 16,
        quantile: 0.98,
        reference: 'normal_stone-black.png',
        write: false
    };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--dir') args.dir = path.resolve(argv[++i]);
        else if (a === '--alpha') args.alpha = Number(argv[++i]);
        else if (a === '--quantile') args.quantile = Number(argv[++i]);
        else if (a === '--reference') args.reference = argv[++i];
        else if (a === '--write') args.write = true;
    }
    return args;
}

function readPng(filePath) {
    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(new PNG())
            .on('parsed', function onParsed() { resolve(this); })
            .on('error', reject);
    });
}

function writePng(filePath, png) {
    return new Promise((resolve, reject) => {
        const stream = fs.createWriteStream(filePath);
        stream.on('finish', resolve);
        stream.on('error', reject);
        png.pack().pipe(stream);
    });
}

function getCircleStats(png, alphaCutoff, quantile) {
    const { width, height, data } = png;
    const cx = (width - 1) / 2;
    const cy = (height - 1) / 2;
    const dist = [];
    let sumA = 0;
    let sumX = 0;
    let sumY = 0;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) << 2;
            const a = data[i + 3];
            if (a >= alphaCutoff) {
                const dx = x - cx;
                const dy = y - cy;
                dist.push(Math.sqrt(dx * dx + dy * dy));
                sumA += a;
                sumX += x * a;
                sumY += y * a;
            }
        }
    }
    if (!dist.length) {
        return { radius: 0, centerX: cx, centerY: cy };
    }
    dist.sort((a, b) => a - b);
    const q = Math.max(0, Math.min(1, quantile));
    const idx = Math.min(dist.length - 1, Math.floor((dist.length - 1) * q));
    const radius = dist[idx];
    return {
        radius,
        centerX: sumX / sumA,
        centerY: sumY / sumA
    };
}

function getPixel(data, width, x, y) {
    const i = (y * width + x) << 2;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

function bilinearPremultiplied(src, sx, sy) {
    const { width, height, data } = src;
    const x0 = Math.max(0, Math.min(width - 1, Math.floor(sx)));
    const y0 = Math.max(0, Math.min(height - 1, Math.floor(sy)));
    const x1 = Math.max(0, Math.min(width - 1, x0 + 1));
    const y1 = Math.max(0, Math.min(height - 1, y0 + 1));
    const tx = Math.max(0, Math.min(1, sx - x0));
    const ty = Math.max(0, Math.min(1, sy - y0));

    const p00 = getPixel(data, width, x0, y0);
    const p10 = getPixel(data, width, x1, y0);
    const p01 = getPixel(data, width, x0, y1);
    const p11 = getPixel(data, width, x1, y1);

    function premul(p) {
        const a = p[3] / 255;
        return [p[0] * a, p[1] * a, p[2] * a, p[3]];
    }
    const q00 = premul(p00);
    const q10 = premul(p10);
    const q01 = premul(p01);
    const q11 = premul(p11);
    function mix(a, b, t) { return a + (b - a) * t; }
    function mix2(v00, v10, v01, v11) {
        const r0 = mix(v00, v10, tx);
        const r1 = mix(v01, v11, tx);
        return mix(r0, r1, ty);
    }

    const a = mix2(q00[3], q10[3], q01[3], q11[3]);
    const rp = mix2(q00[0], q10[0], q01[0], q11[0]);
    const gp = mix2(q00[1], q10[1], q01[1], q11[1]);
    const bp = mix2(q00[2], q10[2], q01[2], q11[2]);

    if (a <= 0.0001) return [0, 0, 0, 0];
    const alpha = Math.max(0, Math.min(255, Math.round(a)));
    const r = Math.max(0, Math.min(255, Math.round(rp / (a / 255))));
    const g = Math.max(0, Math.min(255, Math.round(gp / (a / 255))));
    const b = Math.max(0, Math.min(255, Math.round(bp / (a / 255))));
    return [r, g, b, alpha];
}

function normalizeToReferenceCircle(src, scale, srcCenterX, srcCenterY) {
    const out = new PNG({ width: src.width, height: src.height });
    out.data.fill(0);
    const cx = (src.width - 1) / 2;
    const cy = (src.height - 1) / 2;

    for (let y = 0; y < out.height; y++) {
        for (let x = 0; x < out.width; x++) {
            const sx = (x - cx) / scale + srcCenterX;
            const sy = (y - cy) / scale + srcCenterY;
            if (sx < 0 || sy < 0 || sx > src.width - 1 || sy > src.height - 1) continue;
            const [r, g, b, a] = bilinearPremultiplied(src, sx, sy);
            const i = (y * out.width + x) << 2;
            out.data[i] = r;
            out.data[i + 1] = g;
            out.data[i + 2] = b;
            out.data[i + 3] = a;
        }
    }
    return out;
}

async function main() {
    const args = parseArgs(process.argv);
    const files = fs.readdirSync(args.dir).filter((n) => n.toLowerCase().endsWith('.png')).sort();
    if (!files.length) throw new Error(`No PNG files found: ${args.dir}`);

    const refPath = path.join(args.dir, args.reference);
    if (!fs.existsSync(refPath)) throw new Error(`Reference file not found: ${refPath}`);
    const refPng = await readPng(refPath);
    const refStats = getCircleStats(refPng, args.alpha, args.quantile);
    if (refStats.radius <= 0) throw new Error(`Reference radius is 0: ${args.reference}`);

    const summary = [];
    for (const file of files) {
        const full = path.join(args.dir, file);
        const png = await readPng(full);
        if (png.width !== refPng.width || png.height !== refPng.height) {
            throw new Error(`Canvas size mismatch: ${file} is ${png.width}x${png.height}, expected ${refPng.width}x${refPng.height}`);
        }
        const s = getCircleStats(png, args.alpha, args.quantile);
        if (s.radius <= 0) {
            summary.push({ file, action: 'skip(no opaque pixels)' });
            continue;
        }

        const scale = refStats.radius / s.radius;
        const out = normalizeToReferenceCircle(png, scale, s.centerX, s.centerY);
        const after = getCircleStats(out, args.alpha, args.quantile);
        if (args.write) await writePng(full, out);

        summary.push({
            file,
            fromDiameter: (s.radius * 2).toFixed(2),
            toDiameter: (after.radius * 2).toFixed(2),
            scale: scale.toFixed(4),
            action: args.write ? 'written' : 'dry-run'
        });
    }

    console.log(`alphaCutoff=${args.alpha}, quantile=${args.quantile}, reference=${args.reference}, write=${args.write}`);
    console.table(summary);
}

main().catch((e) => {
    console.error(e && e.stack ? e.stack : e);
    process.exit(1);
});

