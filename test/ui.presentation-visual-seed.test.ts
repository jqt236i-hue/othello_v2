const VisualSeed = require('../ui/presentation/visual-seed');
const SourceTrajectory = require('../ui/board-visual/source-trajectory');

describe('presentation-only visual seed', () => {
  const networkEvent = {
    visualSeq: 19,
    sequenceIndex: 4,
    actionId: 'turn-8:action-2',
    effectBlockId: 'turn-8:action-2:destroy',
    type: 'DESTROY_PARTICLE',
    target: { row: -2, col: 11 }
  };

  test('is deterministic and insensitive to target object property order', () => {
    const first = VisualSeed.createVisualSeed(networkEvent);
    const second = VisualSeed.createVisualSeed({
      ...networkEvent,
      target: { col: 11, row: -2 }
    });

    expect(first).toBe(second);
    expect(VisualSeed.createVisualSeedKey(networkEvent)).toBe(
      VisualSeed.createVisualSeedKey({ ...networkEvent, target: { col: 11, row: -2 } })
    );
  });

  test.each([
    ['visualSeq', { visualSeq: 20 }],
    ['sequenceIndex', { sequenceIndex: 5 }],
    ['actionId', { actionId: 'turn-8:action-3' }],
    ['effectBlockId', { effectBlockId: 'turn-8:action-2:spawn' }],
    ['effect kind', { type: 'SPAWN_PARTICLE' }],
    ['target', { target: { row: -2, col: 12 } }]
  ])('includes %s in the seed identity', (_label, replacement) => {
    expect(VisualSeed.createVisualSeed({ ...networkEvent, ...replacement })).not.toBe(
      VisualSeed.createVisualSeed(networkEvent)
    );
  });

  test('uses an ordered presentationBatchId for local batches without mutating source events', () => {
    const events = [
      { type: 'PLACE_SPARK', row: 2, col: 3, sequenceIndex: 0 },
      { type: 'PLACE_SPARK', row: 2, col: 4, sequenceIndex: 1 }
    ];
    const firstBatch = VisualSeed.withPresentationBatchId(events, 0);
    const secondBatch = VisualSeed.withPresentationBatchId(events, 1);

    expect(firstBatch.map((event: any) => event.presentationBatchId)).toEqual([
      'local-presentation:0',
      'local-presentation:0'
    ]);
    expect(secondBatch[0].presentationBatchId).toBe('local-presentation:1');
    expect(events[0]).not.toHaveProperty('presentationBatchId');
    expect(VisualSeed.createVisualSeed(firstBatch[0])).not.toBe(
      VisualSeed.createVisualSeed(secondBatch[0])
    );
  });

  test('uses visualSeq as the network identity even if a local batch id is also present', () => {
    expect(VisualSeed.createVisualSeed({
      ...networkEvent,
      presentationBatchId: 'local-presentation:2'
    })).toBe(VisualSeed.createVisualSeed({
      ...networkEvent,
      presentationBatchId: 'local-presentation:99'
    }));
  });

  test('normalizes equivalent coordinate target shapes and ignores extra target fields', () => {
    const shared = {
      visualSeq: 23,
      sequenceIndex: 4,
      actionId: 'action-2',
      effectBlockId: 'block-7',
      effectKind: 'lightning'
    };
    const compact = VisualSeed.createVisualSeed({ ...shared, target: { r: 2, col: 5 } });
    const canonical = VisualSeed.createVisualSeed({ ...shared, target: { row: 2, col: 5, ignored: true } });

    expect(compact).toBe(canonical);
  });

  test('shared next-batch assignment advances once and preserves existing identities', () => {
    const first = VisualSeed.withNextPresentationBatchId([{ type: 'destroy' }, { type: 'flip' }]);
    const second = VisualSeed.withNextPresentationBatchId([{ type: 'spawn' }]);
    const existing = VisualSeed.withNextPresentationBatchId([{ type: 'move', visualSeq: 91 }]);

    expect(first.map((event: any) => event.presentationBatchId)).toEqual([
      'local-presentation:0',
      'local-presentation:0'
    ]);
    expect((second[0] as any).presentationBatchId).toBe('local-presentation:1');
    expect(existing[0]).toEqual({ type: 'move', visualSeq: 91 });
  });

  test('reads presentation metadata from a nested event without changing the tuple', () => {
    expect(VisualSeed.createVisualSeed({ event: networkEvent })).toBe(
      VisualSeed.createVisualSeed(networkEvent)
    );
    expect(VisualSeed.createVisualSeed({
      event: {
        type: 'DESTROY_PARTICLE',
        row: -2,
        col: 11,
        meta: {
          visualSeq: 19,
          sequenceIndex: 4,
          actionId: 'turn-8:action-2',
          effectBlockId: 'turn-8:action-2:destroy'
        }
      }
    })).toBe(VisualSeed.createVisualSeed(networkEvent));
  });

  test('requires either authoritative visualSeq or an explicit local batch identity', () => {
    expect(() => VisualSeed.createVisualSeed({ type: 'PLACE_SPARK', row: 0, col: 0 }))
      .toThrow('visual_seed_identity_required');
    expect(() => VisualSeed.createPresentationBatchId(-1))
      .toThrow('presentation_batch_index_invalid');
    expect(() => VisualSeed.createPresentationBatchId(1.5))
      .toThrow('presentation_batch_index_invalid');
  });

  test('does not consume Math.random or a canonical game RNG', () => {
    const randomSpy = jest.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be consumed');
    });
    const canonicalGameRng = jest.fn(() => 0.5);

    expect(() => VisualSeed.createVisualSeed(networkEvent)).not.toThrow();
    const firstRandom = VisualSeed.createVisualRandom(networkEvent);
    const secondRandom = VisualSeed.createVisualRandom(networkEvent);
    expect([firstRandom(), firstRandom(), firstRandom()]).toEqual([
      secondRandom(), secondRandom(), secondRandom()
    ]);
    expect(randomSpy).not.toHaveBeenCalled();
    expect(canonicalGameRng).not.toHaveBeenCalled();
    randomSpy.mockRestore();
  });

  test('keeps a fixed runtime-neutral value for classic and Vite lanes', () => {
    expect(VisualSeed.createVisualSeed({
      visualSeq: 7,
      sequenceIndex: 12,
      actionId: '行動-α',
      effectBlockId: '劇的効果-🌟',
      effectKind: 'TRAIL',
      target: { row: -3, col: 16 }
    })).toBe(155224080);
  });

  test('board lightning requests preserve the existing destroy-source seed tuple', () => {
    const event = {
      ...networkEvent,
      type: 'destroy',
      targets: [{
        r: -2,
        col: 11,
        sourceRow: -3,
        sourceCol: 10,
        cause: 'LIGHTNING_WILL',
        reason: 'lightning_destroyed'
      }]
    };
    const request = SourceTrajectory.collectBoardSourceTrajectoryRequests([event]).requests[0];
    expect(request.visualSeed).toBe(VisualSeed.createVisualSeed({
      event: {
        ...event,
        presentationBatchId: 'local-presentation:0',
        effectKind: 'destroy-source',
        target: { row: -2, col: 11 }
      }
    }));
  });
});
