import {
  groupByPhase,
  groupPresentationEventsByPhase,
  planPresentationPhases,
  type PresentationEventLike,
  type PresentationParallelStep
} from '../ui/presentation/phase-planner';

type TestEvent = PresentationEventLike & {
  readonly id: string;
};

function event(id: string, values: Omit<TestEvent, 'id'> = {}): TestEvent {
  return Object.freeze({ id, ...values });
}

describe('presentation phase planner', () => {
  test('exposes an immutable groupByPhase-compatible view', () => {
    const first = event('first', { phase: 2 });
    const second = event('second', { phase: 1 });
    const third = event('third', { phase: 2 });

    const groups = groupPresentationEventsByPhase([first, second, third]);

    expect(groups).toEqual({ 1: [second], 2: [first, third] });
    expect(groupByPhase([first, second, third])).toEqual(groups);
    expect(Object.isFrozen(groups)).toBe(true);
    expect(Object.isFrozen(groups['2'])).toBe(true);
  });

  test('groups by numeric phase while preserving stable input order and event identity', () => {
    const phaseTwoFirst = event('phase-two-first', {
      phase: 2,
      sequenceIndex: 90,
      actionId: 'action-b',
      effectBlockId: 'effect-b'
    });
    const phaseZero = event('phase-zero', { sequenceIndex: 0 });
    const phaseOne = event('phase-one', { phase: 1, sequenceIndex: 50 });
    const phaseTwoSecond = event('phase-two-second', {
      phase: 2,
      sequenceIndex: 1,
      actionId: 'action-a',
      effectBlockId: 'effect-a'
    });
    const input = Object.freeze([phaseTwoFirst, phaseZero, phaseOne, phaseTwoSecond]);

    const plan = planPresentationPhases(input);

    expect(plan.map((phase) => phase.phase)).toEqual([0, 1, 2]);
    expect(plan.map((phase) => phase.phaseKey)).toEqual(['0', '1', '2']);
    expect(plan[2].events).toEqual([phaseTwoFirst, phaseTwoSecond]);
    expect(plan[2].events[0]).toBe(phaseTwoFirst);
    expect(plan[2].events[1]).toBe(phaseTwoSecond);
    expect(plan[2].events.map((item) => item.sequenceIndex)).toEqual([90, 1]);
    expect(plan[2].events.map((item) => item.actionId)).toEqual(['action-b', 'action-a']);
    expect(plan[2].events.map((item) => item.effectBlockId)).toEqual(['effect-b', 'effect-a']);
    expect(input).toEqual([phaseTwoFirst, phaseZero, phaseOne, phaseTwoSecond]);
  });

  test('uses the legacy phase-zero fallback for falsy phase values', () => {
    const missing = event('missing');
    const nullPhase = event('null', { phase: null });
    const emptyPhase = event('empty', { phase: '' });
    const nanPhase = event('nan', { phase: Number.NaN });

    const plan = planPresentationPhases([missing, nullPhase, emptyPhase, nanPhase]);

    expect(plan).toHaveLength(1);
    expect(plan[0].phase).toBe(0);
    expect(plan[0].events).toEqual([missing, nullPhase, emptyPhase, nanPhase]);
  });

  test('serializes manifest endings before launching the remaining phase work', () => {
    const nonFlipA = event('non-flip-a', { phase: 3, type: 'destroy', sequenceIndex: 10 });
    const endingA = event('ending-a', { phase: 3, type: 'manifest_ending', sequenceIndex: 11 });
    const flipA = event('flip-a', { phase: 3, type: 'flip', sequenceIndex: 12 });
    const endingB = event('ending-b', { phase: 3, type: 'manifest_ending', sequenceIndex: 13 });
    const nonFlipB = event('non-flip-b', { phase: 3, type: 'sound_effect', sequenceIndex: 14 });

    const [phase] = planPresentationPhases([nonFlipA, endingA, flipA, endingB, nonFlipB]);

    expect(phase.steps.slice(0, 2)).toEqual([
      { kind: 'serial-event', event: endingA, inputIndex: 1 },
      { kind: 'serial-event', event: endingB, inputIndex: 3 }
    ]);
    const parallel = phase.steps[2] as PresentationParallelStep<TestEvent>;
    expect(parallel.kind).toBe('parallel');
    expect(parallel.launches).toEqual([
      { kind: 'flip-batch', events: [flipA], inputIndices: [2] },
      { kind: 'event', event: nonFlipA, inputIndex: 0 },
      { kind: 'event', event: nonFlipB, inputIndex: 4 }
    ]);
  });

  test('launches one stable flip batch before non-flip events in input order', () => {
    const beforeFlip = event('before-flip', { phase: 4, type: 'place' });
    const flipA = event('flip-a', { phase: 4, type: 'flip' });
    const betweenFlips = event('between-flips', { phase: 4, type: 'log' });
    const flipB = event('flip-b', { phase: 4, type: 'flip' });
    const afterFlip = event('after-flip', { phase: 4, type: 'destroy' });

    const [phase] = planPresentationPhases([beforeFlip, flipA, betweenFlips, flipB, afterFlip]);
    const parallel = phase.steps[0] as PresentationParallelStep<TestEvent>;

    expect(parallel.launches).toEqual([
      { kind: 'flip-batch', events: [flipA, flipB], inputIndices: [1, 3] },
      { kind: 'event', event: beforeFlip, inputIndex: 0 },
      { kind: 'event', event: betweenFlips, inputIndex: 2 },
      { kind: 'event', event: afterFlip, inputIndex: 4 }
    ]);
  });

  test('supports injected event type constants without changing ordering policy', () => {
    const regular = event('regular', { type: 'regular' });
    const flip = event('flip', { type: 'CUSTOM_FLIP' });
    const serial = event('serial', { type: 'CUSTOM_SERIAL' });

    const [phase] = planPresentationPhases([regular, flip, serial], {
      flipEventType: 'CUSTOM_FLIP',
      serialEventTypes: ['CUSTOM_SERIAL']
    });

    expect(phase.steps).toEqual([
      { kind: 'serial-event', event: serial, inputIndex: 2 },
      {
        kind: 'parallel',
        launches: [
          { kind: 'flip-batch', events: [flip], inputIndices: [1] },
          { kind: 'event', event: regular, inputIndex: 0 }
        ]
      }
    ]);
  });
});
