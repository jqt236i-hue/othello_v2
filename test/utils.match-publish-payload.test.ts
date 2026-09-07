import { createMatchPublishPayloadBuilder } from '../utils/match-publish-payload';
import MatchAuthority = require('../utils/match-authority');

function harness(decorateAcknowledgement = false) {
    const toPublicSnapshot = jest.fn(() => ({ projected: true }));
    const buildPresentationFrames = jest.fn(() => []);
    const build = createMatchPublishPayloadBuilder({
        authority: MatchAuthority,
        buildPresentationCursor: () => ({ visualSeq: 4 }), toPublicSnapshot,
        toPublicRoomDeck: () => null, toPublicRoomBoardConfig: () => null,
        toPublicNetworkDebugEnabled: () => false, toPublicNetworkAutoEnabled: () => false,
        toPublicTurnTimer: () => null, buildPresentationFrames,
        decoratePayload: payload => ({ ...payload, ratedMatch: { id: 'rated' } }),
        decorateAcknowledgement
    });
    return { build, toPublicSnapshot, buildPresentationFrames };
}

test('full responses share projection, optional fields and decoration', () => {
    const worker = harness();
    const local = harness(true);
    const options = { ok: false, serverTime: 123, rejectedReason: 'STALE', snapshot: null, errorMessage: 'retry' };
    const response = worker.build(null, 'black', options);
    expect(response).toEqual(local.build(null, 'black', options));
    expect(response).toMatchObject({ ok: false, snapshot: null, rejectedReason: 'STALE', errorMessage: 'retry', serverTime: 123 });
    expect(worker.toPublicSnapshot).not.toHaveBeenCalled();
});

test('importing wire assembly does not initialize authority before Worker preload', () => {
    try {
        jest.isolateModules(() => {
            jest.doMock('../utils/match-authority', () => { throw new Error('authority initialized too early'); });
            expect(() => require('../utils/match-publish-payload')).not.toThrow();
        });
    } finally {
        jest.dontMock('../utils/match-authority');
    }
});

test('acknowledgements keep the explicit legacy decoration difference and avoid projection', () => {
    const worker = harness();
    const local = harness(true);
    const options = { ok: true, serverTime: 123, publishResponseMode: 'ack_only' };
    const response = worker.build(null, 'black', options);
    const localResponse = local.build(null, 'black', options);
    expect(response).not.toHaveProperty('ratedMatch');
    expect(localResponse).toEqual({ ...response, ratedMatch: { id: 'rated' } });
    expect(worker.toPublicSnapshot).not.toHaveBeenCalled();
    expect(worker.buildPresentationFrames).not.toHaveBeenCalled();
    expect(local.toPublicSnapshot).not.toHaveBeenCalled();
});
