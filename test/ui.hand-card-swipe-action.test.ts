import * as HandCardSwipeAction from '../cards/hand-card-swipe-action';

describe('hand card swipe action gesture', () => {
  test('activates after the configured long press duration', () => {
    const gesture = HandCardSwipeAction.createHandCardSwipeGesture({ x: 100, y: 120, timeMs: 1000 });

    expect(HandCardSwipeAction.updateHandCardSwipeGesture(gesture, { x: 100, y: 120, timeMs: 1169 })).toEqual({
      action: 'pending',
      active: false,
      cancelled: false
    });

    expect(HandCardSwipeAction.updateHandCardSwipeGesture(gesture, { x: 100, y: 120, timeMs: 1170 })).toEqual({
      action: 'pending',
      active: true,
      cancelled: false
    });
  });

  test('resolves upward movement as card use after long press activation', () => {
    const gesture = HandCardSwipeAction.createHandCardSwipeGesture({ x: 160, y: 220, timeMs: 0 });
    HandCardSwipeAction.updateHandCardSwipeGesture(gesture, { x: 160, y: 220, timeMs: 170 });

    const update = HandCardSwipeAction.updateHandCardSwipeGesture(gesture, { x: 164, y: 155, timeMs: 200 });
    const end = HandCardSwipeAction.finishHandCardSwipeGesture(gesture, { x: 164, y: 155, timeMs: 205 });

    expect(update.action).toBe('use');
    expect(end.action).toBe('use');
  });

  test('keeps an early upward swipe alive until the long press threshold completes', () => {
    const gesture = HandCardSwipeAction.createHandCardSwipeGesture({ x: 160, y: 220, timeMs: 0 });

    const early = HandCardSwipeAction.updateHandCardSwipeGesture(gesture, { x: 162, y: 188, timeMs: 60 });
    const end = HandCardSwipeAction.finishHandCardSwipeGesture(gesture, { x: 164, y: 155, timeMs: 180 });

    expect(early.cancelled).toBe(false);
    expect(early.active).toBe(false);
    expect(end.action).toBe('use');
  });

  test('resolves rightward movement as hand card destroy after long press activation', () => {
    const gesture = HandCardSwipeAction.createHandCardSwipeGesture({ x: 90, y: 220, timeMs: 0 });
    HandCardSwipeAction.updateHandCardSwipeGesture(gesture, { x: 90, y: 220, timeMs: 170 });

    const update = HandCardSwipeAction.updateHandCardSwipeGesture(gesture, { x: 150, y: 230, timeMs: 200 });
    const end = HandCardSwipeAction.finishHandCardSwipeGesture(gesture, { x: 150, y: 230, timeMs: 205 });

    expect(update.action).toBe('destroy');
    expect(end.action).toBe('destroy');
  });

  test('keeps a short rightward movement pending instead of destroying the card', () => {
    const gesture = HandCardSwipeAction.createHandCardSwipeGesture({ x: 90, y: 220, timeMs: 0 });
    HandCardSwipeAction.updateHandCardSwipeGesture(gesture, { x: 90, y: 220, timeMs: 170 });

    const update = HandCardSwipeAction.updateHandCardSwipeGesture(gesture, { x: 134, y: 230, timeMs: 200 });
    const end = HandCardSwipeAction.finishHandCardSwipeGesture(gesture, { x: 134, y: 230, timeMs: 205 });

    expect(update.action).toBe('pending');
    expect(end.action).toBe('cancel');
  });

  test('keeps a medium rightward movement pending before the destroy threshold', () => {
    const gesture = HandCardSwipeAction.createHandCardSwipeGesture({ x: 90, y: 220, timeMs: 0 });
    HandCardSwipeAction.updateHandCardSwipeGesture(gesture, { x: 90, y: 220, timeMs: 170 });

    const update = HandCardSwipeAction.updateHandCardSwipeGesture(gesture, { x: 149, y: 230, timeMs: 200 });
    const end = HandCardSwipeAction.finishHandCardSwipeGesture(gesture, { x: 149, y: 230, timeMs: 205 });

    expect(update.action).toBe('pending');
    expect(end.action).toBe('cancel');
  });

  test('reduces the destroy threshold near the right edge of a narrow viewport', () => {
    expect(HandCardSwipeAction.resolveHandCardSwipeDestroyThreshold(60, 90, 390)).toBe(60);
    expect(HandCardSwipeAction.resolveHandCardSwipeDestroyThreshold(60, 320, 390)).toBe(59);
    expect(HandCardSwipeAction.resolveHandCardSwipeDestroyThreshold(60, 353, 390)).toBe(31);
    expect(HandCardSwipeAction.resolveHandCardSwipeDestroyThreshold(60, 360, 390)).toBe(28);
  });

  test('cancels when the pointer drifts away from action directions before long press activation', () => {
    const gesture = HandCardSwipeAction.createHandCardSwipeGesture({ x: 90, y: 220, timeMs: 0 });

    const update = HandCardSwipeAction.updateHandCardSwipeGesture(gesture, { x: 54, y: 220, timeMs: 80 });
    const end = HandCardSwipeAction.finishHandCardSwipeGesture(gesture, { x: 54, y: 220, timeMs: 100 });

    expect(update.cancelled).toBe(true);
    expect(end.action).toBe('cancel');
  });
});
