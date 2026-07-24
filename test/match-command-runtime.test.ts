import {
  executeMatchRuntimeCommand,
  prepareMatchCommandAction,
  shouldSkipMatchCommandTurnStart
} from '../utils/match-command-runtime';

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

  test('prepares the shared canonical action and preserves a pending-selection turn skip', () => {
    const buildAction = jest.fn(() => ({
      actor: 'black',
      action: { type: 'select_target', pendingSelectionState: { type: 'SEED' } }
    }));
    const validatePendingSelectionPublish = jest.fn(() => ({
      ok: true,
      pendingEffectId: 'pending_1'
    }));
    const sanitizePendingSelectionActionForAuthority = jest.fn((_snapshot, _playerKey, action) => action);
    const snapshot = {
      cardState: {
        turnIndex: 7,
        pendingEffectByPlayer: { black: { type: 'SEED' } }
      }
    };

    const prepared = prepareMatchCommandAction({
      snapshot,
      body: { actionType: 'select_target', action: { type: 'select_target' } },
      playerKey: 'black',
      buildAction,
      normalizePlayerKey: (value) => value,
      validatePendingSelectionPublish,
      sanitizePendingSelectionActionForAuthority
    });

    expect(prepared).toEqual(expect.objectContaining({
      ok: true,
      currentTurnIndex: 7,
      pendingValidation: { ok: true, pendingEffectId: 'pending_1' }
    }));
    expect(buildAction).toHaveBeenCalledWith({
      actionType: 'select_target',
      actor: undefined,
      params: undefined,
      actionId: undefined,
      turnIndex: undefined,
      action: { type: 'select_target' }
    }, 'black', 7);
    if (prepared.ok !== true) throw new Error('Expected a prepared command');
    expect(shouldSkipMatchCommandTurnStart({
      cardState: prepared.currentCardState,
      playerKey: 'black',
      resolvedAction: prepared.resolvedAction,
      isSubPlacementTurnActive: () => false
    })).toBe(true);
  });

  test('keeps schema, seat, and pending-selection rejections fail-closed', () => {
    const base = {
      snapshot: { cardState: { turnIndex: 2 } },
      body: { actionType: 'place' },
      playerKey: 'black',
      normalizePlayerKey: (value) => value,
      validatePendingSelectionPublish: () => ({ ok: true }),
      sanitizePendingSelectionActionForAuthority: () => ({ type: 'place' })
    };

    expect(prepareMatchCommandAction({
      ...base,
      buildAction: () => null
    })).toEqual({ ok: false, rejectedReason: 'COMMAND_REQUIRED' });
    expect(prepareMatchCommandAction({
      ...base,
      buildAction: () => ({ actor: 'white', action: { type: 'place' } })
    })).toEqual({ ok: false, rejectedReason: 'SEAT_MISMATCH' });
    expect(prepareMatchCommandAction({
      ...base,
      buildAction: () => ({ actor: 'black', action: { type: 'place' } }),
      validatePendingSelectionPublish: () => ({ ok: false, rejectedReason: 'STALE_PENDING_SELECTION' })
    })).toEqual({ ok: false, rejectedReason: 'STALE_PENDING_SELECTION' });
  });

  test.each([
    ['null', null],
    ['undefined', undefined],
    ['empty object', {}]
  ])('treats %s network debug options as unspecified and strips them', (_label, debugOptions) => {
    const sanitizePendingSelectionActionForAuthority = jest.fn((_snapshot, _playerKey, action) => action);
    const prepared = prepareMatchCommandAction({
      snapshot: { cardState: { turnIndex: 3 } },
      body: { actionType: 'use_card' },
      playerKey: 'black',
      networkDebugEnabled: false,
      buildAction: () => ({
        actor: 'black',
        action: { type: 'use_card', debugOptions }
      }),
      normalizePlayerKey: (value) => value,
      validatePendingSelectionPublish: () => ({ ok: true }),
      sanitizePendingSelectionActionForAuthority
    });

    expect(prepared).toEqual(expect.objectContaining({ ok: true }));
    expect(sanitizePendingSelectionActionForAuthority).toHaveBeenCalledWith(
      expect.any(Object),
      'black',
      { type: 'use_card' }
    );
  });

  test.each([
    ['no-consume', { ignoreCost: true, noConsume: true }],
    ['turn-limit bypass', { skipCostAndTurnLimit: true }]
  ])('rejects non-empty %s options when network debug is disabled', (_label, debugOptions) => {
    expect(prepareMatchCommandAction({
      snapshot: { cardState: { turnIndex: 3 } },
      body: { actionType: 'use_card' },
      playerKey: 'black',
      networkDebugEnabled: false,
      buildAction: () => ({
        actor: 'black',
        action: { type: 'use_card', debugOptions }
      }),
      normalizePlayerKey: (value) => value,
      validatePendingSelectionPublish: () => ({ ok: true }),
      sanitizePendingSelectionActionForAuthority: (_snapshot, _playerKey, action) => action
    })).toEqual({ ok: false, rejectedReason: 'NETWORK_DEBUG_DISABLED' });
  });

  test('allows and canonicalizes the exact server-enabled no-consume debug pair', () => {
    const prepared = prepareMatchCommandAction({
      snapshot: { cardState: { turnIndex: 3 } },
      body: { actionType: 'use_card' },
      playerKey: 'black',
      networkDebugEnabled: true,
      buildAction: () => ({
        actor: 'black',
        action: {
          type: 'use_card',
          debugOptions: { noConsume: true, ignoreCost: true }
        }
      }),
      normalizePlayerKey: (value) => value,
      validatePendingSelectionPublish: () => ({ ok: true }),
      sanitizePendingSelectionActionForAuthority: (_snapshot, _playerKey, action) => action
    });

    expect(prepared).toEqual(expect.objectContaining({
      ok: true,
      resolvedAction: {
        type: 'use_card',
        debugOptions: { ignoreCost: true, noConsume: true }
      }
    }));
  });

  test.each([
    ['turn-limit bypass', { skipCostAndTurnLimit: true }],
    ['unknown option', { ignoreCost: true, noConsume: true, surprise: true }],
    ['partial allowlist', { noConsume: true }]
  ])('rejects %s even when network debug is enabled', (_label, debugOptions) => {
    expect(prepareMatchCommandAction({
      snapshot: { cardState: { turnIndex: 3 } },
      body: { actionType: 'use_card' },
      playerKey: 'black',
      networkDebugEnabled: true,
      buildAction: () => ({
        actor: 'black',
        action: { type: 'use_card', debugOptions }
      }),
      normalizePlayerKey: (value) => value,
      validatePendingSelectionPublish: () => ({ ok: true }),
      sanitizePendingSelectionActionForAuthority: (_snapshot, _playerKey, action) => action
    })).toEqual({ ok: false, rejectedReason: 'NETWORK_DEBUG_OPTIONS_INVALID' });
  });
});
