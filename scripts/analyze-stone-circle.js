const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

function parseArgs(argv) {
    const args = {
        dir: path.join(__dirname, '..', 'assets', 'images', 'stones'),
        alpha: 16,
        quantile: 0.98
    };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--dir') args.dir = path.resolve(argv[++i]);
        else if (a === '--alpha') args.alpha = Number(argv[++i]);
        else if (a === '--quantile') args.quantile = Number(argv[++i]);
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
        return { radius: 0, diameter: 0, centerX: cx, centerY: cy, offsetX: 0, offsetY: 0, opaquePixels: 0 };
    }
    dist.sort((a, b) => a - b);
    const q = Math.max(0, Math.min(1, quantile));
    const idx = Math.min(dist.length - 1, Math.floor((dist.length - 1) * q));
    const radius = dist[idx];
    const centerX = sumX / sumA;
    const centerY = sumY / sumA;
    return {
        radius,
        diameter: radius * 2,
        centerX,
        centerY,
        offsetX: centerX - cx,
        offsetY: centerY - cy,
        opaquePixels: dist.length
    };
}

async function main() {
    const args = parseArgs(process.argv);
    const files = fs.readdirSync(args.dir).filter((n) => n.toLowerCase().endsWith('.png')).sort();
    const rows = [];
    for (const file of files) {
        const png = await readPng(path.join(args.dir, file));
        const s = getCircleStats(png, args.alpha, args.quantile);
        rows.push({
            file,
            canvas: `${png.width}x${png.height}`,
            diameter: s.diameter.toFixed(2),
            radius: s.radius.toFixed(2),
            centerOffset: `${s.offsetX.toFixed(2)},${s.offsetY.toFixed(2)}`
        });
    }
    console.log(`alphaCutoff=${args.alpha}, quantile=${args.quantile}`);
    console.table(rows);
}

main().catch((e) => {
    console.error(e && e.stack ? e.stack : e);
    process.exit(1);
});

