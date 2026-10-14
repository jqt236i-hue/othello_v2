import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_BYTES = 64 * 1024;
const DEFAULT_THRESHOLD_MB = 5;
// Hard cap for automatic full-read. --threshold can only lower this boundary.
export const MAX_FULL_READ = 512 * 1024;

const USAGE_LINES = [
  'Usage: node scripts/preview-file.js <path> [--bytes N] [--threshold MB] [--full]',
  `  --bytes N     number of bytes to show for head/tail (positive integer, default ${DEFAULT_BYTES})`,
  `  --threshold M show files up to M MB in full; larger files get head/tail (default ${DEFAULT_THRESHOLD_MB}).`,
  `                The automatic full display is always capped at ${MAX_FULL_READ / 1024} KB.`,
  '  --full        read whole file (use with caution)'
];

export type PreviewFileOptions = {
  file: string;
  bytes: number;
  thresholdBytes: number;
  full: boolean;
};

export type PreviewFileIo = {
  cwd: string;
  stdout: { write(chunk: string): unknown };
  stderr: { write(chunk: string): unknown };
};

type ParseResult =
  | { kind: 'help'; exitCode: number }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; options: PreviewFileOptions };

function parseFlagValue(argv: string[], index: number, name: string): string | { error: string } {
  const next = argv[index + 1];
  if (next === undefined || next.startsWith('--')) return { error: `${name} requires a value` };
  return next;
}

export function parsePreviewFileArgs(argv: string[]): ParseResult {
  if (argv.length === 0) return { kind: 'help', exitCode: 1 };
  if (argv.includes('--help')) return { kind: 'help', exitCode: 0 };

  let file: string | null = null;
  let bytes = DEFAULT_BYTES;
  let thresholdMb = DEFAULT_THRESHOLD_MB;
  let full = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--full') {
      full = true;
    } else if (arg === '--bytes' || arg === '--threshold') {
      const raw = parseFlagValue(argv, i, arg);
      if (typeof raw !== 'string') return { kind: 'error', message: raw.error };
      const value = Number(raw);
      if (arg === '--bytes') {
        if (!Number.isInteger(value) || value <= 0) {
          return { kind: 'error', message: `--bytes must be a positive integer (got ${raw})` };
        }
        bytes = value;
      } else {
        if (raw.trim() === '' || !Number.isFinite(value) || value < 0) {
          return { kind: 'error', message: `--threshold must be a non-negative number of MB (got ${raw})` };
        }
        thresholdMb = value;
      }
      i += 1;
    } else if (arg.startsWith('--')) {
      return { kind: 'error', message: `unknown option: ${arg}` };
    } else if (file === null) {
      file = arg;
    } else {
      return { kind: 'error', message: `unexpected argument: ${arg}` };
    }
  }
  if (file === null) return { kind: 'error', message: 'missing <path>' };
  return {
    kind: 'ok',
    options: {
      file,
      bytes,
      thresholdBytes: Math.min(Math.floor(thresholdMb * 1024 * 1024), MAX_FULL_READ),
      full
    }
  };
}

function formatBytes(b: number): string {
  if (b >= 1024 * 1024) return (b / (1024 * 1024)).toFixed(2) + ' MB';
  if (b >= 1024) return (b / 1024).toFixed(2) + ' KB';
  return b + ' B';
}

function isProbablyBinary(buf: Buffer): boolean {
  const len = Math.min(buf.length, 1024);
  for (let i = 0; i < len; i++) {
    if (buf[i] === 0) return true; // null byte — binary
  }
  return false;
}

function toHex(buf: Buffer, limit?: number): string {
  limit = limit || buf.length;
  const hex = buf.subarray(0, limit).toString('hex').match(/.{1,2}/g);
  return hex ? hex.join(' ') : '';
}

async function writeWholeFile(target: string, io: PreviewFileIo): Promise<void> {
  const buf = await fs.promises.readFile(target);
  if (isProbablyBinary(buf)) {
    io.stdout.write('\n[binary file] — showing first 256 bytes as hex:\n');
    io.stdout.write(toHex(buf, 256) + '\n');
  } else {
    io.stdout.write('\n[full file contents]\n');
    io.stdout.write(buf.toString('utf8'));
    io.stdout.write('\n\n');
  }
}

function streamWholeFile(target: string, io: PreviewFileIo): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(target, { encoding: 'utf8' });
    stream.on('data', (chunk) => io.stdout.write(String(chunk)));
    stream.on('end', () => {
      io.stdout.write('\n\n');
      resolve();
    });
    stream.on('error', reject);
  });
}

function writePreviewSection(label: string, buf: Buffer, io: PreviewFileIo): void {
  if (isProbablyBinary(buf)) {
    io.stdout.write(`\n--- ${label} (binary, hex preview) ---\n`);
    io.stdout.write(toHex(buf, 256) + '\n');
  } else {
    io.stdout.write(`\n--- ${label} (text preview) ---\n`);
    io.stdout.write(buf.toString('utf8'));
    io.stdout.write('\n\n');
  }
}

export async function runPreviewFile(argv: string[], io: PreviewFileIo): Promise<number> {
  const parsed = parsePreviewFileArgs(argv);
  if (parsed.kind === 'help') {
    io.stderr.write(USAGE_LINES.join('\n') + '\n');
    return parsed.exitCode;
  }
  if (parsed.kind === 'error') {
    io.stderr.write(`Error: ${parsed.message}\n${USAGE_LINES[0]}\n`);
    return 1;
  }
  const { file, bytes, thresholdBytes, full } = parsed.options;
  const target = path.resolve(io.cwd, file);
  try {
    const stat = await fs.promises.stat(target);
    if (!stat.isFile()) throw new Error('not a regular file');
    const size = stat.size;
    io.stdout.write(`Path: ${path.relative(io.cwd, target)}\n`);
    io.stdout.write(`Size: ${formatBytes(size)}\n`);

    if (full) {
      if (size <= MAX_FULL_READ) {
        await writeWholeFile(target, io);
      } else {
        io.stderr.write(`--full requested but file is large (${formatBytes(size)}). Proceeding to stream (may be slow).\n`);
        await streamWholeFile(target, io);
      }
      return 0;
    }

    if (size <= thresholdBytes) {
      await writeWholeFile(target, io);
      return 0;
    }

    // Large-file safe preview: head + tail
    const fd = await fs.promises.open(target, 'r');
    let headBuf: Buffer;
    let tailBuf = Buffer.alloc(0);
    try {
      const headBytes = Math.min(bytes, size);
      headBuf = Buffer.alloc(headBytes);
      await fd.read(headBuf, 0, headBytes, 0);
      const tailBytes = Math.min(bytes, Math.max(0, size - headBytes));
      if (tailBytes > 0) {
        tailBuf = Buffer.alloc(tailBytes);
        await fd.read(tailBuf, 0, tailBytes, size - tailBytes);
      }
    } finally {
      await fd.close();
    }

    writePreviewSection('head', headBuf, io);
    if (tailBuf.length) writePreviewSection('tail', tailBuf, io);

    io.stdout.write('\nHints:\n');
    io.stdout.write(` - Increase preview bytes: --bytes ${bytes * 2}\n`);
    io.stdout.write(' - Read full file (use only if you understand the size): --full\n');
    io.stdout.write(' - PowerShell: Get-Content -Path <file> -Tail 200\n');
    io.stdout.write(' - Use scripts/list-large-files.js to find other big files\n');
    return 0;
  } catch (err: any) {
    io.stderr.write(`Error: ${err && err.message ? err.message : String(err)}\n`);
    return 1;
  }
}

const isDirectRun = typeof require !== 'undefined'
  && !!require.main
  && /[\\/]preview-file\.js$/.test(String(require.main.filename || ''));

if (isDirectRun) {
  runPreviewFile(process.argv.slice(2), {
    cwd: process.cwd(),
    stdout: process.stdout,
    stderr: process.stderr
  }).then((code) => {
    process.exitCode = code;
  });
}
