// Encodes recorded frames into a cropped, silent, looping H.264 MP4.
// Segments are joined with short fades (or seamlessly), captions are burned in,
// and runs of unchanged frames are capped so dead time does not drag the clip.
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import type { RecordedFrame, RecordedSegment } from './recorder';

export interface Crop { x: number; y: number; w: number; h: number; }
export interface EncodeInput { outDir: string; frames: RecordedFrame[]; segs: RecordedSegment[]; }
export interface EncodeOptions { crop: Crop; outW?: number; fps?: number; crf?: number; fade?: number; }

const FONT_CANDIDATES = [
    'C:/Windows/Fonts/YuGothB.ttc',
    'C:/Windows/Fonts/meiryob.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',
    '/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc'
];
const MAX_FRAME_GAP = 0.2;      // seconds a single screencast frame may last
const MAX_STATIC = 0.9;         // cap for unchanged stretches inside a clip
const MAX_STATIC_END = 1.3;     // cap for the final still before the loop restarts
const STATIC_DIFF = 0.12;       // mean abs luma diff of 44px-wide thumbnails treated as "no change"

function ffmpeg(args: string[]) {
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
}

export function probeDuration(file: string): number {
    const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim();
    return Number(out);
}

function resolveFont(): string | null {
    const found = FONT_CANDIDATES.find((p) => fs.existsSync(p));
    return found ? found.replace(/:/g, '\\:') : null;
}

function frameThumbs(frames: RecordedFrame[], crop: Crop): Buffer[] {
    if (!frames.length) return [];
    const tw = 44;
    const th = Math.max(2, Math.round(crop.h * tw / crop.w));
    const dir = path.dirname(frames[0].file);
    const out = execFileSync('ffmpeg', [
        '-hide_banner', '-loglevel', 'error', '-start_number', '0', '-i', path.join(dir, '%06d.jpg'),
        '-vf', `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y},scale=${tw}:${th},format=gray`, '-f', 'rawvideo', 'pipe:'
    ], { maxBuffer: 1 << 30 });
    const size = tw * th;
    const thumbs: Buffer[] = [];
    for (let i = 0; i + size <= out.length; i += size) thumbs.push(out.subarray(i, i + size));
    return thumbs;
}

function meanDiff(a: Buffer, b: Buffer): number {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
    return s / a.length;
}

export function encodeClip(input: EncodeInput, outFile: string, options: EncodeOptions) {
    const { crop } = options;
    const outW = options.outW ?? 440;
    const fps = options.fps ?? 30;
    const crf = options.crf ?? 27;
    const fade = options.fade ?? 0.18;
    const work = path.join(input.outDir, 'work');
    fs.rmSync(work, { recursive: true, force: true });
    fs.mkdirSync(work, { recursive: true });
    const thumbs = frameThumbs(input.frames, crop);
    const indexOf = new Map(input.frames.map((f, i) => [f.file, i]));
    const thumbOf = (f: RecordedFrame) => thumbs[indexOf.get(f.file) as number];
    const still = (a: RecordedFrame, b: RecordedFrame) => {
        const ta = thumbOf(a), tb = thumbOf(b);
        return !!(ta && tb && meanDiff(ta, tb) < STATIC_DIFF);
    };
    const font = resolveFont();
    const segCount = input.segs.length;
    const segFiles: string[] = [];

    input.segs.forEach((seg, si) => {
        const raw = input.frames.filter((f) => f.seg === seg.id);
        if (raw.length < 2) return;
        const dur = raw.map((f, i) => (i + 1 < raw.length ? Math.min(MAX_FRAME_GAP, Math.max(0.001, raw[i + 1].t - f.t)) : 0.1));
        const keep = raw.map(() => true);
        let runTime = 0;
        for (let i = 1; i < raw.length; i++) {
            if (!still(raw[i - 1], raw[i])) { runTime = 0; continue; }
            runTime += dur[i - 1];
            let isTail = true;
            for (let j = i + 1; j < raw.length; j++) { if (!still(raw[j - 1], raw[j])) { isTail = false; break; } }
            const cap = isTail && si === segCount - 1 ? MAX_STATIC_END : MAX_STATIC;
            if (runTime > cap) keep[i] = false;
        }
        const kept = raw.map((f, i) => ({ f, d: dur[i] })).filter((_, i) => keep[i]);
        let list = 'ffconcat version 1.0\n';
        for (const { f, d } of kept) list += `file '${f.file.replace(/\\/g, '/')}'\nduration ${d.toFixed(4)}\n`;
        list += `file '${kept[kept.length - 1].f.file.replace(/\\/g, '/')}'\n`;
        const listFile = path.join(work, `seg${si}.txt`);
        fs.writeFileSync(listFile, list);
        const total = kept.reduce((s, k) => s + k.d, 0);
        const outH = Math.round(crop.h * outW / crop.w / 2) * 2;
        let vf = `fps=${fps},crop=${crop.w}:${crop.h}:${crop.x}:${crop.y},scale=${outW}:${outH}:flags=lanczos`;
        if (seg.caption && font) {
            const tf = path.join(work, `cap${si}.txt`);
            fs.writeFileSync(tf, seg.caption, 'utf8');
            const tfe = tf.replace(/\\/g, '/').replace(/:/g, '\\:');
            const size = Math.min(Math.round(outW / 17), Math.floor(outW * 0.84 / Array.from(seg.caption).length));
            vf += `,drawtext=fontfile='${font}':textfile='${tfe}':fontsize=${size}:fontcolor=white:borderw=3:bordercolor=black@0.85:x=(w-text_w)/2:y=h*0.035:box=1:boxcolor=black@0.35:boxborderw=8`;
        }
        const next = input.segs[si + 1];
        const fin = si > 0 ? (seg.seamless ? 0 : fade) : 0.25;
        const fout = si < segCount - 1 ? (next && next.seamless ? 0 : fade) : 0.25;
        if (fin) vf += `,fade=t=in:st=0:d=${fin}`;
        if (fout) vf += `,fade=t=out:st=${Math.max(0, total - fout).toFixed(3)}:d=${fout}`;
        const segOut = path.join(work, `seg${si}.mp4`);
        ffmpeg(['-f', 'concat', '-safe', '0', '-i', listFile, '-vf', vf, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-r', String(fps), segOut]);
        segFiles.push(segOut);
    });
    if (!segFiles.length) throw new Error('no segments to encode');
    const concatList = path.join(work, 'all.txt');
    fs.writeFileSync(concatList, segFiles.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n'));
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    ffmpeg(['-f', 'concat', '-safe', '0', '-i', concatList, '-c', 'copy', '-an', '-movflags', '+faststart', outFile]);
    return { outFile, seconds: probeDuration(outFile), kb: Math.round(fs.statSync(outFile).size / 1024) };
}
