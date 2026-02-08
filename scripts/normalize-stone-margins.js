const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

function parseArgs(argv) {
    const args = {
        dir: path.join(__dirname, '..', 'assets', 'images', 'stones'),
        alpha: 16,
        reference: 'normal_stone-black.png',
        write: false
    };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--dir') args.dir = path.resolve(argv[++i]);
        else if (a === '--alpha') args.alpha = Number(argv[++i]);
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

function findOpaqueBounds(png, alphaCutoff) {
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
    return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function px(data, width, x, y) {
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

    const p00 = px(data, width, x0, y0);
    const p10 = px(data, width, x1, y0);
    const p01 = px(data, width, x0, y1);
    const p11 = px(data, width, x1, y1);

    function premul(p) {
        const a = p[3] / 255;
        return [p[0] * a, p[1] * a, p[2] * a, p[3]];
    }
    const q00 = premul(p00), q10 = premul(p10), q01 = premul(p01), q11 = premul(p11);
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

function normalizeImage(src, srcBox, targetBox) {
    const out = new PNG({ width: src.width, height: src.height });
    out.data.fill(0);

    const scale = Math.min(targetBox.width / srcBox.width, targetBox.height / srcBox.height);
    const destW = Math.max(1, Math.round(srcBox.width * scale));
    const destH = Math.max(1, Math.round(srcBox.height * scale));
    const destX = Math.floor((out.width - destW) / 2);
    const destY = Math.floor((out.height - destH) / 2);

    for (let dy = 0; dy < destH; dy++) {
        for (let dx = 0; dx < destW; dx++) {
            const sx = srcBox.x + (dx + 0.5) * (srcBox.width / destW) - 0.5;
            const sy = srcBox.y + (dy + 0.5) * (srcBox.height / destH) - 0.5;
            const [r, g, b, a] = bilinearPremultiplied(src, sx, sy);
            const oi = ((destY + dy) * out.width + (destX + dx)) << 2;
            out.data[oi] = r;
            out.data[oi + 1] = g;
            out.data[oi + 2] = b;
            out.data[oi + 3] = a;
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
    const refBox = findOpaqueBounds(refPng, args.alpha);
    if (!refBox) throw new Error(`Reference has no opaque pixels with alpha>=${args.alpha}: ${args.reference}`);

    const summary = [];
    for (const file of files) {
        const full = path.join(args.dir, file);
        const png = await readPng(full);
        if (png.width !== refPng.width || png.height !== refPng.height) {
            throw new Error(`Canvas size mismatch: ${file} is ${png.width}x${png.height}, expected ${refPng.width}x${refPng.height}`);
        }
        const box = findOpaqueBounds(png, args.alpha);
        if (!box) {
            summary.push({ file, action: 'skip(no opaque pixels)' });
            continue;
        }
        const out = normalizeImage(png, box, refBox);
        const outBox = findOpaqueBounds(out, args.alpha);
        if (args.write) await writePng(full, out);
        summary.push({
            file,
            from: `${box.width}x${box.height}`,
            to: outBox ? `${outBox.width}x${outBox.height}` : '0x0',
            action: args.write ? 'written' : 'dry-run'
        });
    }

    console.log(`alphaCutoff=${args.alpha}, reference=${args.reference}, write=${args.write}`);
    console.table(summary);
}

main().catch((e) => {
    console.error(e && e.stack ? e.stack : e);
    process.exit(1);
});

