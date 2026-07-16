import { JSDOM } from 'jsdom';

const AnimationFeedbackEvents = require('../ui/animation-feedback-events.js');

describe('special-card cinematic abort handling', () => {
  let dom: JSDOM | null = null;

  afterEach(() => {
    if (dom) {
      dom.window.close();
      dom = null;
    }
    delete (global as any).document;
    delete (global as any).window;
    delete (global as any).HTMLElement;
  });

  test('does not show a manifest summary after playback is aborted during the cinematic wait', async () => {
    dom = new JSDOM('<!doctype html><html><body></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).HTMLElement = dom.window.HTMLElement;
    const controller = new AbortController();
    const sleep = jest.fn(() => {
      if (controller.signal.aborted) return Promise.resolve();
      return new Promise<void>((resolve) => {
        controller.signal.addEventListener('abort', () => resolve(), { once: true });
      });
    });
    const typewriterSleep = jest.fn(() => new Promise<void>(() => {}));

    const cinematic = AnimationFeedbackEvents.handleSpecialCardCinematicEvent(
      {
        type: 'special_card_cinematic',
        phase: 1,
        targets: [{
          cardId: 'board_executor_01',
          cardType: 'BOARD_EXECUTOR',
          owner: 'white',
          displayName: '盤界の執行者',
          quote: '盤界の名において執行する',
          cinematicKey: 'board_executor',
          durationMs: 3000
        }]
      },
      {
        abortSignal: controller.signal,
        sleep,
        typewriterSleep,
        isNoAnim: () => false
      }
    );
    await Promise.resolve();

    expect(document.querySelector('.special-card-cinematic-overlay')).toBeTruthy();
    expect(document.querySelector('.manifest-summary-popup')).toBeNull();

    controller.abort();
    await cinematic;

    expect(document.querySelector('.special-card-cinematic-overlay')).toBeNull();
    expect(document.querySelector('.manifest-summary-popup')).toBeNull();
  });
});