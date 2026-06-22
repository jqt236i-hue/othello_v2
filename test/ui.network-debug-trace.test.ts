import { createNetworkDebugTrace } from '../ui/network/debug-trace';

describe('network debug trace', () => {
  test('records trace type separately from network source', () => {
    const trace = createNetworkDebugTrace({ limit: 2, now: () => 1000 });

    trace.record('snapshot_apply', {
      source: 'stream',
      operationId: 'op-1',
      stateVersion: 4,
      visualSeq: 3,
      boardWriter: 'none'
    });

    expect(trace.entries()).toEqual([
      {
        type: 'snapshot_apply',
        source: 'stream',
        operationId: 'op-1',
        stateVersion: 4,
        visualSeq: 3,
        boardWriter: 'none',
        playbackActive: null,
        decision: null,
        timestamp: 1000,
        accepted: null,
        reason: null
      }
    ]);
  });

  test('keeps latest trace entries with stable envelope fields', () => {
    const trace = createNetworkDebugTrace({ limit: 2, now: () => 12345 });

    trace.record('publish_response', {
      operationId: 'op-1',
      stateVersion: 10,
      visualSeq: 20,
      boardWriter: 'presentation_timeline',
      accepted: true,
      ignoredField: 'not persisted'
    });
    trace.record('stream', {
      operationId: 'op-2',
      stateVersion: '11',
      visualSeq: '21',
      boardWriter: 'none'
    });
    trace.record('state_sync', {
      operationId: '',
      stateVersion: Number.NaN,
      visualSeq: null,
      boardWriter: 'renderBoard'
    });

    expect(trace.snapshot()).toEqual([
      {
        at: 12345,
        source: 'stream',
        operationId: 'op-2',
        stateVersion: 11,
        visualSeq: 21,
        boardWriter: 'none',
        playbackActive: null,
        decision: null,
        accepted: null,
        reason: null
      },
      {
        at: 12345,
        source: 'state_sync',
        operationId: null,
        stateVersion: null,
        visualSeq: null,
        boardWriter: 'renderBoard',
        playbackActive: null,
        decision: null,
        accepted: null,
        reason: null
      }
    ]);
  });

  test('clears entries and exposes summary counts by source and board writer', () => {
    const trace = createNetworkDebugTrace({ limit: 10, now: () => 1 });

    trace.record('stream', { boardWriter: 'none' });
    trace.record('stream', { boardWriter: 'none' });
    trace.record('presentation_journal', { boardWriter: 'renderBoardFull', reason: 'recovery' });

    expect(trace.summary()).toEqual({
      total: 3,
      bySource: {
        stream: 2,
        presentation_journal: 1
      },
      byBoardWriter: {
        none: 2,
        renderBoardFull: 1
      }
    });

    trace.clear();

    expect(trace.snapshot()).toEqual([]);
    expect(trace.summary()).toEqual({
      total: 0,
      bySource: {},
      byBoardWriter: {}
    });
  });

  test('keeps decision and playback state on capped network intake traces', () => {
    const trace = createNetworkDebugTrace({ limit: 2, now: () => 100 });

    trace.record('network_intake_submit', {
      source: 'stream',
      operationId: 'op1',
      stateVersion: 1,
      visualSeq: 1,
      boardWriter: 'network_timeline',
      playbackActive: true,
      decision: 'accepted',
      reason: 'presentation_frames'
    });
    trace.record('network_intake_submit', {
      source: 'state_sync',
      operationId: 'op2',
      stateVersion: 2,
      visualSeq: 2,
      boardWriter: 'none',
      playbackActive: false,
      decision: 'deduped',
      reason: 'duplicate_operation_state'
    });
    trace.record('network_intake_submit', {
      source: 'stream',
      operationId: 'op3',
      stateVersion: 3,
      visualSeq: 3,
      boardWriter: 'network_timeline',
      playbackActive: false,
      decision: 'accepted',
      reason: 'fresh_state'
    });

    expect(trace.snapshot()).toEqual([
      expect.objectContaining({ operationId: 'op2', playbackActive: false, decision: 'deduped' }),
      expect.objectContaining({ operationId: 'op3', playbackActive: false, decision: 'accepted' })
    ]);
  });
});
