#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { chromium } from 'playwright';
import { analyzeLosslessWebp } from './lossless-webp-pipeline';

/** Hardware decode admission evidence for scripts/assets/optimized-ui-images.policy.json:
 * headful desktop Chromium, PNG and lossless WebP decoded alternately from
 * fresh object URLs, 12 samples per format. A WebP is admissible only when its
 * median decode is within +2 ms and +10% of the PNG median. */

const SAMPLES_PER_FORMAT = 12;
const ALLOWED_DELTA_MS = 2;
const ALLOWED_DELTA_RATIO = 0.1;

function median(values: number[]): number {
    const sorted = values.slice().sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export async function measureUiImageDecode(sources: string[]) {
    const root = process.cwd();
    const browser = await chromium.launch({
        headless: false,
        args: process.platform === 'win32' ? ['--use-gl=angle', '--use-angle=d3d11'] : []
    });
    try {
        const page = await browser.newPage();
        await page.setContent('<!doctype html><html><body></body></html>');
        const environment = await page.evaluate(() => ({
            browser: navigator.userAgent,
            devicePixelRatio: window.devicePixelRatio,
            hardwareConcurrency: navigator.hardwareConcurrency,
            renderer: (() => {
                const gl = document.createElement('canvas').getContext('webgl');
                const info = gl && gl.getExtension('WEBGL_debug_renderer_info');
                return gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : null;
            })()
        }));
        const results = [];
        for (const source of sources) {
            const analysis = await analyzeLosslessWebp(path.resolve(root, source));
            const png = fs.readFileSync(path.resolve(root, source)).toString('base64');
            const webp = analysis.encoded.toString('base64');
            const samples = await page.evaluate(async ({ png, webp, count }) => {
                const toBlob = (base64: string, type: string) => new Blob([Uint8Array.from(atob(base64), c => c.charCodeAt(0))], { type });
                const blobs = { png: toBlob(png, 'image/png'), webp: toBlob(webp, 'image/webp') };
                const out: Record<string, number[]> = { png: [], webp: [] };
                const decodeOnce = async (kind: 'png' | 'webp') => {
                    const url = URL.createObjectURL(blobs[kind]);
                    const image = new Image();
                    image.src = url;
                    const started = performance.now();
                    await image.decode();
                    out[kind].push(performance.now() - started);
                    URL.revokeObjectURL(url);
                };
                await decodeOnce('png'); await decodeOnce('webp');
                out.png = []; out.webp = [];
                for (let index = 0; index < count; index += 1) {
                    await decodeOnce(index % 2 === 0 ? 'png' : 'webp');
                    await decodeOnce(index % 2 === 0 ? 'webp' : 'png');
                }
                return out;
            }, { png, webp, count: SAMPLES_PER_FORMAT });
            const pngMedianMs = median(samples.png), webpMedianMs = median(samples.webp);
            const deltaMs = webpMedianMs - pngMedianMs;
            const allowedDeltaMs = Math.max(ALLOWED_DELTA_MS, pngMedianMs * ALLOWED_DELTA_RATIO);
            results.push({
                source, width: analysis.width, height: analysis.height, hasAlpha: analysis.hasAlpha,
                sourceBytes: analysis.sourceBytes, outputBytes: analysis.outputBytes, savingsRatio: analysis.savingsRatio,
                visiblePixelsEqual: analysis.visiblePixelsEqual,
                hardwareDecode: {
                    capturedAt: new Date().toISOString(), ...environment, sampleCountPerFormat: SAMPLES_PER_FORMAT, order: 'alternating',
                    pngMedianMs: Number(pngMedianMs.toFixed(3)), webpMedianMs: Number(webpMedianMs.toFixed(3)),
                    deltaMs: Number(deltaMs.toFixed(3)), allowedDeltaMs: Number(allowedDeltaMs.toFixed(3)),
                    verdict: deltaMs <= allowedDeltaMs ? 'admitted' : 'rejected'
                }
            });
        }
        return results;
    } finally {
        await browser.close();
    }
}

if (require.main === module) {
    const [output, ...sources] = process.argv.slice(2);
    measureUiImageDecode(sources).then((results) => {
        fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
        fs.writeFileSync(output, JSON.stringify(results, null, 2));
        for (const result of results) {
            console.log(`${result.source} ${result.sourceBytes}->${result.outputBytes} png=${result.hardwareDecode.pngMedianMs} webp=${result.hardwareDecode.webpMedianMs} ${result.hardwareDecode.verdict}`);
        }
    }).catch((error) => { console.error(error); process.exitCode = 1; });
}
