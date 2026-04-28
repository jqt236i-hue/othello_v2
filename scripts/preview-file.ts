import * as fs from 'fs';
import * as path from 'path';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const argv = process.argv.slice(2);
if (argv.length === 0 || argv.includes('--help')) {
  console.error('Usage: node scripts/preview-file.js <path> [--bytes N] [--threshold MB] [--full]');
  console.error('  --bytes N     number of bytes to show for head/tail (default 65536)');
  console.error('  --threshold M treat files larger than M MB as large (default 5)');
  console.error('  --full        read whole file (use with caution)');
  process.exit(argv.length === 0 ? 1 : 0);
}

function getFlag(name: string, fallback: number): number {
  const i = argv.indexOf(name);
  if (i === -1) return fallback;
  const next = argv[i + 1];
  if (!next || next.startsWith('--')) return fallback;
  return Number(next);
}

const fileArg = argv[0];
const BYTES = Number(getFlag('--bytes', 64 * 1024));
const THRESHOLD_MB = Number(getFlag('--threshold', 5));
const FULL = argv.includes('--full');
const MAX_FULL_READ = 512 * 1024; // 512 KB hard cap for auto full-read

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
  return buf.slice(0, limit).toString('hex').match(/.{1,2}/g)!.join(' ');
}

(async function main() {
  const target = path.resolve(process.cwd(), fileArg);
  try {
    const stat = await fs.promises.stat(target);
    if (!stat.isFile()) throw new Error('not a regular file');
    const size = stat.size;
    console.log(`Path: ${path.relative(process.cwd(), target)}`);
    console.log(`Size: ${formatBytes(size)}`);

    if ((size <= MAX_FULL_READ && !FULL) || (size <= MAX_FULL_READ && FULL)) {
      // safe to read full small files
      const buf = await fs.promises.readFile(target);
      if (isProbablyBinary(buf)) {
        console.log('\n[binary file] — showing first 256 bytes as hex:');
        console.log(toHex(buf, 256));
      } else {
        console.log('\n[full file contents]');
        process.stdout.write(buf.toString('utf8'));
        console.log('\n');
      }
      return;
    }

    if (FULL && size > MAX_FULL_READ) {
      console.warn(`--full requested but file is large (${formatBytes(size)}). Proceeding to stream (may be slow).`);
      const stream = fs.createReadStream(target, { encoding: 'utf8' });
      stream.pipe(process.stdout);
      stream.on('end', () => console.log('\n'));
      stream.on('error', (e) => { throw e; });
      return;
    }

    // Large-file safe preview: head + tail
    const fd = await fs.promises.open(target, 'r');
    const headBytes = Math.min(BYTES, size);
    const headBuf = Buffer.alloc(headBytes);
    await fd.read(headBuf, 0, headBytes, 0);

    const tailBytes = Math.min(BYTES, Math.max(0, size - headBytes));
    let tailBuf = Buffer.alloc(0);
    if (tailBytes > 0) {
      tailBuf = Buffer.alloc(tailBytes);
      await fd.read(tailBuf, 0, tailBytes, size - tailBytes);
    }
    await fd.close();

    if (isProbablyBinary(headBuf)) {
      console.log('\n--- head (binary, hex preview) ---');
      console.log(toHex(headBuf, 256));
    } else {
      console.log('\n--- head (text preview) ---');
      process.stdout.write(headBuf.toString('utf8'));
      console.log('\n');
    }

    if (tailBuf.length) {
      if (isProbablyBinary(tailBuf)) {
        console.log('\n--- tail (binary, hex preview) ---');
        console.log(toHex(tailBuf, 256));
      } else {
        console.log('\n--- tail (text preview) ---');
        process.stdout.write(tailBuf.toString('utf8'));
        console.log('\n');
      }
    }

    console.log('\nHints:');
    console.log(` - Increase preview bytes: --bytes ${BYTES * 2}`);
    console.log(` - Read full file (use only if you understand the size): --full`);
    console.log(' - PowerShell: Get-Content -Path <file> -Tail 200');
    console.log(' - Use scripts/list-large-files.js to find other big files');
  } catch (err: any) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
