import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { MAX_FULL_READ, parsePreviewFileArgs, runPreviewFile } from '../scripts/preview-file';

function createIo(cwd: string) {
  let stdout = '';
  let stderr = '';
  return {
    io: {
      cwd,
      stdout: { write: (chunk: string) => { stdout += chunk; return true; } },
      stderr: { write: (chunk: string) => { stderr += chunk; return true; } }
    },
    out: () => stdout,
    err: () => stderr
  };
}

describe('scripts/preview-file', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-file-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function writeText(name: string, size: number): string {
    const body = 'H'.repeat(Math.min(size, 16)) + 'm'.repeat(Math.max(0, size - 32)) + 'T'.repeat(Math.min(16, Math.max(0, size - 16)));
    fs.writeFileSync(path.join(dir, name), body.slice(0, size));
    return name;
  }

  test('uses the requested threshold as the full/preview boundary', async () => {
    // 0.001 MB = 1048 bytes
    const atBoundary = writeText('at.txt', 1048);
    const overBoundary = writeText('over.txt', 1049);

    const atRun = createIo(dir);
    await expect(runPreviewFile([atBoundary, '--threshold', '0.001'], atRun.io)).resolves.toBe(0);
    expect(atRun.out()).toContain('[full file contents]');

    const overRun = createIo(dir);
    await expect(runPreviewFile([overBoundary, '--threshold', '0.001', '--bytes', '16'], overRun.io)).resolves.toBe(0);
    expect(overRun.out()).not.toContain('[full file contents]');
    expect(overRun.out()).toContain('--- head (text preview) ---');
    expect(overRun.out()).toContain('--- tail (text preview) ---');
    expect(overRun.out()).toContain('H'.repeat(16));
    expect(overRun.out()).not.toContain('m'.repeat(64));
  });

  test('keeps the 512 KiB automatic full-read cap even when the threshold is larger', async () => {
    const atCap = writeText('cap.txt', MAX_FULL_READ);
    const overCap = writeText('cap-plus.txt', MAX_FULL_READ + 1);

    const capRun = createIo(dir);
    await runPreviewFile([atCap, '--threshold', '100'], capRun.io);
    expect(capRun.out()).toContain('[full file contents]');

    const overRun = createIo(dir);
    await runPreviewFile([overCap, '--threshold', '100'], overRun.io);
    expect(overRun.out()).not.toContain('[full file contents]');
    expect(overRun.out()).toContain('--- head (text preview) ---');
    expect(parsePreviewFileArgs(['x', '--threshold', '100'])).toEqual({
      kind: 'ok',
      options: expect.objectContaining({ thresholdBytes: MAX_FULL_READ })
    });
  });

  test('--full reads the whole file regardless of the threshold', async () => {
    const name = writeText('full.txt', 2000);
    const run = createIo(dir);
    await runPreviewFile([name, '--threshold', '0', '--full'], run.io);
    expect(run.out()).toContain('[full file contents]');
    expect(run.out()).toContain('m'.repeat(1000));
  });

  test('shows binary files as a hex preview', async () => {
    fs.writeFileSync(path.join(dir, 'bin.dat'), Buffer.from([0x00, 0x01, 0xff, 0x10]));
    const run = createIo(dir);
    await runPreviewFile(['bin.dat'], run.io);
    expect(run.out()).toContain('[binary file]');
    expect(run.out()).toContain('00 01 ff 10');
  });

  test.each([
    [['x', '--bytes', 'abc'], '--bytes must be a positive integer'],
    [['x', '--bytes', '0'], '--bytes must be a positive integer'],
    [['x', '--bytes', '-5'], '--bytes must be a positive integer'],
    [['x', '--bytes', '1.5'], '--bytes must be a positive integer'],
    [['x', '--threshold', 'abc'], '--threshold must be a non-negative number'],
    [['x', '--threshold', '-1'], '--threshold must be a non-negative number'],
    [['x', '--threshold', 'Infinity'], '--threshold must be a non-negative number'],
    [['x', '--threshold'], '--threshold requires a value'],
    [['x', '--treshold', '1'], 'unknown option: --treshold'],
    [['--full'], 'missing <path>']
  ])('rejects invalid arguments %j before reading', async (argv, message) => {
    const run = createIo(dir);
    await expect(runPreviewFile(argv as string[], run.io)).resolves.toBe(1);
    expect(run.err()).toContain(message);
    expect(run.out()).toBe('');
  });

  test('help documents the automatic full-read cap', async () => {
    const run = createIo(dir);
    await expect(runPreviewFile(['--help'], run.io)).resolves.toBe(0);
    expect(run.err()).toContain('capped at 512 KB');
  });
});
