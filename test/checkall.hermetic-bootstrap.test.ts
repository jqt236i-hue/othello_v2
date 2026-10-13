import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const {
  REQUIRED_DIST_SCRIPTS,
  findStaleCompiledSources,
  runCheckallBootstrap
} = require('../scripts/checkall-bootstrap.js');

type FakeResult = {
  status: number | null;
  signal: NodeJS.Signals | null;
  error?: Error;
};

const success = (): FakeResult => ({ status: 0, signal: null });

describe('checkall hermetic bootstrap', () => {
  test('compiles the canonical TypeScript snapshot before launching the built runner', () => {
    const calls: Array<{ command: string; args: string[]; options: any }> = [];
    const spawnSync = jest.fn((command: string, args: string[], options: any) => {
      calls.push({ command, args, options });
      return success();
    });

    const result = runCheckallBootstrap({
      rootDir: path.resolve('fixture-root'),
      spawnSync,
      existsSync: () => true
    });

    expect(result).toEqual({ stage: 'runner', status: 0, signal: null });
    expect(calls).toHaveLength(2);
    expect(calls[0].args).toEqual(expect.arrayContaining([
      expect.stringMatching(/typescript[\\/]bin[\\/]tsc/),
      '-p',
      expect.stringMatching(/fixture-root[\\/]tsconfig\.build\.json$/)
    ]));
    expect(calls[1].args).toEqual([
      expect.stringMatching(/fixture-root[\\/]dist[\\/]scripts[\\/]run-all-checks\.js$/)
    ]);
  });

  test.each(REQUIRED_DIST_SCRIPTS)('rejects a snapshot missing %s before launching checks', (missingName: string) => {
    const spawnSync = jest.fn(() => success());
    const result = runCheckallBootstrap({
      rootDir: path.resolve('fixture-root'),
      spawnSync,
      existsSync: (candidate: string) => path.basename(candidate) !== missingName
    });

    expect(result).toEqual({
      stage: 'snapshot',
      status: 2,
      signal: null,
      missing: [missingName]
    });
    expect(spawnSync).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['compiler nonzero', { status: 7, signal: null }, { stage: 'compile', status: 7, signal: null }],
    ['compiler signal', { status: null, signal: 'SIGTERM' }, { stage: 'compile', status: null, signal: 'SIGTERM' }],
    ['compiler spawn error', { status: null, signal: null, error: new Error('spawn failed') }, {
      stage: 'compile', status: 1, signal: null, error: expect.any(Error)
    }]
  ])('preserves %s failure without launching the runner', (_label, compilerResult, expected) => {
    const spawnSync = jest.fn(() => compilerResult);
    expect(runCheckallBootstrap({ spawnSync, existsSync: () => true })).toEqual(expected);
    expect(spawnSync).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['runner nonzero', { status: 9, signal: null }, { stage: 'runner', status: 9, signal: null }],
    ['runner signal', { status: null, signal: 'SIGINT' }, { stage: 'runner', status: null, signal: 'SIGINT' }],
    ['runner spawn error', { status: null, signal: null, error: new Error('runner failed') }, {
      stage: 'runner', status: 1, signal: null, error: expect.any(Error)
    }]
  ])('preserves %s failure instead of retrying', (_label, runnerResult, expected) => {
    const spawnSync = jest.fn()
      .mockImplementationOnce(() => success())
      .mockImplementationOnce(() => runnerResult);
    expect(runCheckallBootstrap({ spawnSync, existsSync: () => true })).toEqual(expected);
    expect(spawnSync).toHaveBeenCalledTimes(2);
  });

  test('prepared mode launches only the runner when the compiled snapshot is fresh', () => {
    const spawnSync = jest.fn(() => success());
    const result = runCheckallBootstrap({
      rootDir: path.resolve('fixture-root'),
      prepared: true,
      spawnSync,
      existsSync: () => true,
      findStaleCompiledSources: () => []
    });

    expect(result).toEqual({ stage: 'runner', status: 0, signal: null });
    expect(spawnSync).toHaveBeenCalledTimes(1);
    expect((spawnSync.mock.calls[0] as unknown[])[1]).toEqual([
      expect.stringMatching(/fixture-root[\\/]dist[\\/]scripts[\\/]run-all-checks\.js$/)
    ]);
  });

  test('prepared mode fails fast on a stale snapshot instead of compiling or checking it', () => {
    const spawnSync = jest.fn(() => success());
    const result = runCheckallBootstrap({
      rootDir: path.resolve('fixture-root'),
      prepared: true,
      spawnSync,
      existsSync: () => true,
      findStaleCompiledSources: () => ['scripts/check-worker-mirror.ts']
    });

    expect(result).toEqual({ stage: 'snapshot', status: 2, signal: null, stale: ['scripts/check-worker-mirror.ts'] });
    expect(spawnSync).not.toHaveBeenCalled();
  });

  test('stale detection compares every tsconfig.build.json source with its dist output', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'checkall-stale-'));
    try {
      fs.writeFileSync(path.join(root, 'tsconfig.build.json'), JSON.stringify({
        compilerOptions: { outDir: './dist', rootDir: '.' },
        include: ['scripts/**/*.ts', 'top.ts']
      }));
      const write = (relativePath: string, mtimeSeconds: number) => {
        const target = path.join(root, relativePath);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, 'export {};\n');
        fs.utimesSync(target, mtimeSeconds, mtimeSeconds);
      };
      write('scripts/fresh.ts', 1000);
      write('dist/scripts/fresh.js', 2000);
      write('scripts/edited.ts', 3000);
      write('dist/scripts/edited.js', 2000);
      write('scripts/new.ts', 1000);
      write('scripts/types.d.ts', 5000);
      write('top.ts', 1000);
      write('dist/top.js', 1000);
      write('not-compiled.ts', 9000);

      expect(findStaleCompiledSources(root)).toEqual(['scripts/edited.ts', 'scripts/new.ts']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
