import * as helpers from '../shared/commentary-runtime-helpers.js';

describe('CommentaryRuntimeHelpers', () => {
  test('extracts cardId from playback events and resolves event type', () => {
    const playbackEvents = [
      { type: 'noop' },
      {
        type: 'card_use_animation',
        targets: [{ owner: 'black', cardId: 'swap_01' }]
      }
    ];

    const cardId = helpers.extractCardIdFromPlaybackEvents(playbackEvents);
    const eventType = helpers.resolveCommentaryEventType('use_card', cardId);

    expect(cardId).toBe('swap_01');
    expect(eventType).toBe('card_used');
  });

  test('normalizes player key when building CPU speaker prefix', () => {
    expect(helpers.getCpuSpeakerPrefix(' WHITE ')).toBe('白CPU');
    expect(helpers.getCpuSpeakerPrefix('black')).toBe('黒CPU');
  });

  test('normalizes speaker role to CPU prefix', () => {
    expect(helpers.normalizeSpeakerRole('unknown', 'cpu')).toBe('cpu');
    expect(helpers.getSpeakerPrefix(' WHITE ', 'unknown')).toBe('白CPU');
    expect(helpers.getSpeakerPrefix('black', '')).toBe('黒CPU');
  });

  test('resolves commentary runtime from global or require loader', () => {
    const runtime = { requestCommentary: jest.fn() };
    const fromGlobal = helpers.resolveCommentaryRuntimeFromGlobal({
      CpuCommentaryRuntime: runtime
    });
    const fromRequire = helpers.resolveCommentaryRuntimeByRequire(
      ['missing', 'ok'],
      (moduleId) => {
        if (moduleId === 'ok') return runtime;
        throw new Error('not found');
      }
    );

    expect(fromGlobal).toBe(runtime);
    expect(fromRequire).toBe(runtime);
  });
});
