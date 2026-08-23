import * as path from 'path';

const {
  REQUIRED_DIST_SCRIPTS,
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
});
