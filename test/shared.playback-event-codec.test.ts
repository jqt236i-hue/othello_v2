import { packPlaybackEvents, unpackPlaybackEvents } from '../shared/playback-event-codec';
import { compactNetworkPresentationEnvelope, resolveNetworkPresentationEnvelope } from '../shared/network-presentation-envelope';
import { createNetworkSpecialStonePerformanceFixture, runHeadlessFixtureTurnStart } from './helpers/network-special-stone-performance-fixtures';

test('losslessly compacts a real heavy event journal and retains V2 compatibility', () => {
  const events = runHeadlessFixtureTurnStart(createNetworkSpecialStonePerformanceFixture('late-special-20')).playbackEvents;
  const frame = { roomId: 'ABC', visualSeq: 1, stateVersionFrom: 1, stateVersionTo: 2, playbackEvents: events };
  const payload = { roomId: 'ABC', playbackEvents: events, presentationFrames: [frame] };
  const wire = compactNetworkPresentationEnvelope(payload, 3);
  const v2 = compactNetworkPresentationEnvelope(payload, 2);
  expect(JSON.stringify(wire).length).toBeLessThan(JSON.stringify(v2).length * 0.85);
  const restored = resolveNetworkPresentationEnvelope(JSON.parse(JSON.stringify(wire)));
  expect(restored.ok).toBe(true);
  if (restored.ok) expect((restored.payload.presentationFrames as any[])[0]).toEqual(frame);
  expect((v2.presentationFrames as any[])[0]).toEqual(frame);
  expect(compactNetworkPresentationEnvelope(payload, null)).toBe(payload);
});

test('preserves adversarial JSON keys, arrays, nulls and numbers without prototype mutation', () => {
  const source = JSON.parse('[{"__proto__":{"polluted":true},"constructor":null,"a":[0,1,[],{},false,"",-7]}]');
  expect(unpackPlaybackEvents(packPlaybackEvents(source))).toEqual(source);
  expect(({} as any).polluted).toBeUndefined();
});

test('rejects malformed, ambiguous and unnegotiated event encoding', () => {
  expect(() => unpackPlaybackEvents({ keys: ['x'], tree: [1, [0, 0, 1, 0, 2]] })).toThrow();
  expect(() => unpackPlaybackEvents({ keys: [], tree: [1, [0, 9, 'bad']] })).toThrow();
  const packed = packPlaybackEvents([{ value: 1 }]);
  for (const version of [undefined, 1, 2]) expect(resolveNetworkPresentationEnvelope({ presentationEnvelopeVersion: version, presentationFrames: [{ playbackEventsPacked: packed }] }).ok).toBe(false);
  expect(resolveNetworkPresentationEnvelope({ presentationEnvelopeVersion: 3, presentationFrames: [{ playbackEventsPacked: packed, playbackEvents: [] }] }).ok).toBe(false);
  let deep: any = [1]; for (let i = 0; i < 70; i++) deep = [1, deep];
  expect(() => unpackPlaybackEvents({ keys: [], tree: deep })).toThrow('playback_codec_limit');
});
