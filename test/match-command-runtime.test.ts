import { executeMatchRuntimeCommand } from '../utils/match-command-runtime';

describe('match command runtime port', () => {
  const command = {
    room: { stateVersion: 3 },
    body: { actionType: 'pass' },
    playerKey: 'black'
  };

  test('returns the synchronous adapter result without rewriting its command', () => {
    const execute = jest.fn(() => ({ ok: true, snapshot: { stateVersion: 4 } }));

    const result = executeMatchRuntimeCommand(command, { execute });

    expect(result).toEqual({ ok: true, snapshot: { stateVersion: 4 } });
    expect(execute).toHaveBeenCalledWith(command);
  });

  test('preserves an asynchronous adapter result for Worker-compatible ports', async () => {
    const execute = jest.fn(async () => ({ ok: true, snapshot: { stateVersion: 4 } }));

    await expect(executeMatchRuntimeCommand(command, { execute })).resolves.toEqual({
      ok: true,
      snapshot: { stateVersion: 4 }
    });
    expect(execute).toHaveBeenCalledWith(command);
  });

  test('fails closed when no adapter is supplied', () => {
    expect(executeMatchRuntimeCommand(command, null)).toEqual({
      ok: false,
      rejectedReason: 'COMMAND_PIPELINE_UNAVAILABLE'
    });
  });
});
