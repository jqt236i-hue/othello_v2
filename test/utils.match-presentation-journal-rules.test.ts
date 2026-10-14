import { createMatchPresentationJournalRules } from '../utils/match-presentation-journal-rules';

function createRules() {
  const appended: any[] = [];
  const projections: any[] = [];
  const cacheKeys: string[] = [];
  const rules = createMatchPresentationJournalRules({
    authority: {
      buildPublicSnapshotForViewer: (room: any, viewer: any) => {
        projections.push(viewer);
        return { stateVersion: room.stateVersion, viewer: viewer.role === 'seat' ? viewer.seatKey : 'spectator' };
      },
      appendPresentationFrame: (_room: any, options: any) => {
        appended.push(options);
        return { visualSeq: 1 };
      },
      normalizeEffectLogMessages: (value: unknown) => (Array.isArray(value) ? value.map(String) : []),
      toPublicPresentationFrame: (entry: any, viewer: any) => ({ entry, viewer })
    },
    parseSeatKeyOptional: (value: unknown) => (value === 'black' || value === 'white' ? String(value) : null),
    getPublishPresentationFrames: (_options, viewerKey, build) => {
      cacheKeys.push(viewerKey);
      return build();
    }
  });
  return { rules, appended, projections, cacheKeys };
}

describe('shared match presentation-journal rules', () => {
  test('captures initial viewer snapshots once and initializes the journal cursor', () => {
    const { rules, projections } = createRules();
    const room: any = { stateVersion: 4 };
    rules.ensureInitialPresentationSnapshots(room);
    rules.ensureInitialPresentationSnapshots(room);
    expect(room.initialSnapshotByViewer).toEqual({
      black: { stateVersion: 4, viewer: 'black' },
      white: { stateVersion: 4, viewer: 'white' },
      spectator: { stateVersion: 4, viewer: 'spectator' }
    });
    expect(projections).toHaveLength(3);
    expect(room.visualSeq).toBe(0);
    expect(room.presentationJournal).toEqual([]);
    expect(rules.buildPresentationCursor({ visualSeq: '2.7', stateVersion: -1 })).toEqual({ visualSeq: 2, stateVersion: 0 });
  });

  test('accepted-frame materials keep per-viewer payload objects and prefer prepared viewer artifacts', () => {
    const { rules, appended } = createRules();
    const room: any = { stateVersion: 5, initialSnapshotByViewer: {} };
    const prepared = { stateVersion: 5, viewer: 'prepared-white' };
    rules.appendPresentationFrameForAcceptedPublish(room, {
      previousStateVersion: 4,
      nextStateVersion: 5,
      operationId: 'op1',
      actorSeatKey: 'black',
      actionType: 'place',
      playbackEvents: [{ type: 'place' }],
      effectLogs: ['log'],
      publishViewerArtifacts: { projectedSnapshots: { white: prepared } },
      createdAt: 123
    });
    const options = appended[0];
    expect(options).toMatchObject({ stateVersionFrom: 4, stateVersionTo: 5, operationId: 'op1', actorSeatKey: 'black', actionType: 'place', createdAt: 123 });
    expect(options.payloadByViewer.black).toEqual({ playbackEvents: [{ type: 'place' }], effectLogs: ['log'], playbackDiagnostics: null });
    expect(options.payloadByViewer.black).not.toBe(options.payloadByViewer.white);
    expect(options.payloadByViewer.white).not.toBe(options.payloadByViewer.spectator);
    expect(options.snapshotAfterByViewer.white).toBe(prepared);
    expect(options.snapshotAfterByViewer.black).toEqual({ stateVersion: 5, viewer: 'black' });
  });

  test('frames use the per-viewer cache key and pass prepared frames through', () => {
    const { rules, cacheKeys } = createRules();
    const entry = { visualSeq: 1 };
    expect(rules.buildPresentationFramesForViewer({}, { role: 'seat', seatKey: 'white' }, { presentationFrameEntry: entry })).toHaveLength(1);
    rules.buildPresentationFramesForViewer({}, { role: 'spectator', spectatorId: 's1' }, { presentationFrameEntry: entry });
    expect(cacheKeys).toEqual(['white', 'spectator']);
    const prepared = [{ visualSeq: 9 }];
    expect(rules.buildPresentationFramesForViewer({}, null, { presentationFrames: prepared })).toBe(prepared);
    expect(rules.buildPresentationFramesForViewer({}, null, {})).toEqual([]);
    expect(rules.viewerFromSeatKey('white')).toEqual({ role: 'seat', seatKey: 'white' });
    expect(rules.viewerFromSeatKey('x')).toEqual({ role: 'spectator', spectatorId: '' });
  });
});
