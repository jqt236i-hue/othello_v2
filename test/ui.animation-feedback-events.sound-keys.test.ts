import SoundEngineModule = require('../sound-engine.ts');
import * as fs from 'fs';
import * as path from 'path';
import { JSDOM } from 'jsdom';

const AnimationFeedbackEvents = require('../ui/animation-feedback-events.js');

function getRegisteredSoundKeys(): string[] {
  const soundEngine = (SoundEngineModule as any).default || SoundEngineModule;
  const map = soundEngine && typeof soundEngine === 'object' && soundEngine.effectSoundFiles
    ? soundEngine.effectSoundFiles
    : {};
  return Object.keys(map)
    .map((key) => String(key || '').trim())
    .filter((key) => key.length > 0)
    .sort();
}

describe('animation feedback sound key coverage', () => {
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

  test('registered effect sound keys are forwarded to SoundEngine.playEffectByKey', async () => {
    const keys = getRegisteredSoundKeys();
    expect(keys.length).toBeGreaterThan(0);

    const played: string[] = [];
    const deps = {
      soundEngine: {
        init: jest.fn(),
        playEffectByKey: jest.fn((key: string) => {
          played.push(String(key || '').trim());
        })
      }
    };

    for (const key of keys) {
      await AnimationFeedbackEvents.handleSoundEffectEvent(
        {
          type: 'sound_effect',
          phase: 1,
          targets: [{ soundKey: key }]
        },
        deps
      );
    }

    expect(deps.soundEngine.init).toHaveBeenCalledTimes(keys.length);
    expect(new Set(played)).toEqual(new Set(keys));
  });

  test('special card cinematic quote does not render a caret cursor', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '..', 'styles-animations.css'), 'utf8');
    expect(css).not.toContain('.special-card-cinematic-quote[data-full-text]::after');
    expect(css).not.toContain('special-card-cinematic-caret');
  });

  test('manifest summary popup uses a more transparent board-readable background', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '..', 'styles-animations.css'), 'utf8');
    expect(css).toContain('rgba(7, 12, 18, 0.62)');
  });

  test('manifest summary popup keeps fade transitions enabled', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '..', 'styles-animations.css'), 'utf8');
    const staticPresentationBlock = css.match(/\/\* Static special-card presentation:[\s\S]*?\}\s*/)?.[0] || '';

    expect(css).toMatch(/\.manifest-summary-popup\s*\{[\s\S]*opacity 280ms ease[\s\S]*transform 360ms/);
    expect(css).toMatch(/\.manifest-summary-popup\.is-leaving\s*\{[\s\S]*opacity:\s*0/);
    expect(staticPresentationBlock).not.toContain('.manifest-summary-popup');
  });

  test('special card dim overlays keep their fade effects enabled', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '..', 'styles-animations.css'), 'utf8');
    const staticPresentationBlock = css.match(/\/\* Static special-card presentation:[\s\S]*?\}\s*/)?.[0] || '';

    expect(css).toMatch(/\.special-card-cinematic-overlay\s*\{[\s\S]*transition:\s*opacity 320ms ease/);
    expect(css).toMatch(/\.manifest-ending-overlay\s*\{[\s\S]*animation:\s*manifestEndingDim/);
    expect(staticPresentationBlock).not.toContain('.special-card-cinematic-overlay');
    expect(staticPresentationBlock).not.toContain('.manifest-ending-overlay');
  });

  test('duplicate sound keys in one playback event are deduplicated before playback', async () => {
    const playEffectByKey = jest.fn();
    await AnimationFeedbackEvents.handleSoundEffectEvent(
      {
        type: 'sound_effect',
        phase: 4,
        soundKey: 'stone_destroy',
        targets: [
          { soundKey: 'stone_destroy' },
          { soundKey: 'card_use_button' },
          { soundKey: 'card_use_button' }
        ]
      },
      {
        consumeSkipNextCardUseButtonSound: () => false,
        soundEngine: {
          init: jest.fn(),
          playEffectByKey
        }
      }
    );

    expect(playEffectByKey.mock.calls.map((call) => call[0])).toEqual([
      'stone_destroy',
      'card_use_button'
    ]);
  });

  test('special card cinematic reveals quote with a typewriter delay until its playback waits complete', async () => {
    dom = new JSDOM('<!doctype html><html><body></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).HTMLElement = dom.window.HTMLElement;
    const resolvers: Array<() => void> = [];
    const typewriterResolvers: Array<() => void> = [];
    const sleep = jest.fn(() => new Promise<void>((resolve) => {
      resolvers.push(resolve);
    }));
    const typewriterSleep = jest.fn(() => new Promise<void>((resolve) => {
      typewriterResolvers.push(resolve);
    }));

    const promise = AnimationFeedbackEvents.handleSpecialCardCinematicEvent(
      {
        type: 'special_card_cinematic',
        phase: 4,
        targets: [{
          cardId: 'observer_will_01',
          owner: 'black',
          displayName: '盤理の観測者',
          quote: '我が観測をもって、悲しき輪廻に新たな一手を示そう',
          cinematicKey: 'observer_will',
          characterImage: 'assets/images/special-cards/characters/observer_will.png',
          durationMs: 3000
        }]
      },
      { sleep, typewriterSleep, isNoAnim: () => false }
    );

    await Promise.resolve();
    const overlay = document.querySelector('.special-card-cinematic-overlay') as HTMLElement;
    expect(overlay).toBeTruthy();
    expect(overlay.dataset.cinematicKey).toBe('observer_will');
    const character = document.querySelector('.special-card-cinematic-character') as HTMLElement;
    expect(character).toBeTruthy();
    expect(character.style.getPropertyValue('--special-card-character-image')).toContain('assets/images/special-cards/characters/observer_will.png');
    expect(document.querySelector('.special-card-cinematic-title')?.textContent).toBe('盤理の観測者');
    const quoteEl = document.querySelector('.special-card-cinematic-quote') as HTMLElement;
    expect(quoteEl).toBeTruthy();
    expect(quoteEl.dataset.fullText).toBe('我が観測をもって、悲しき輪廻に新たな一手を示そう');
    expect(quoteEl.textContent).toBe('');
    expect(typewriterSleep).toHaveBeenCalledWith(120);
    expect(sleep).toHaveBeenCalledWith(3000);

    typewriterResolvers.shift()?.();
    await Promise.resolve();
    expect(quoteEl.textContent).toBe('我');
    expect(typewriterSleep).toHaveBeenCalledWith(20);

    typewriterResolvers.shift()?.();
    await Promise.resolve();
    expect(quoteEl.textContent).toBe('我が');

    for (let i = 0; i < 7; i++) {
      typewriterResolvers.shift()?.();
      await Promise.resolve();
    }
    expect(quoteEl.textContent).toBe('我が観測をもって、');
    expect(typewriterSleep).toHaveBeenCalledWith(250);

    resolvers.shift()?.();
    await Promise.resolve();
    expect(sleep).toHaveBeenCalledWith(260);
    resolvers.shift()?.();
    await promise;
    expect(document.querySelector('.special-card-cinematic-overlay')).toBeNull();
  });

  test('special card cinematic fixes quote line boxes before typewriter reveal starts', async () => {
    dom = new JSDOM('<!doctype html><html><body></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).HTMLElement = dom.window.HTMLElement;
    const resolvers: Array<() => void> = [];
    const typewriterResolvers: Array<() => void> = [];
    const sleep = jest.fn(() => new Promise<void>((resolve) => {
      resolvers.push(resolve);
    }));
    const typewriterSleep = jest.fn(() => new Promise<void>((resolve) => {
      typewriterResolvers.push(resolve);
    }));

    const promise = AnimationFeedbackEvents.handleSpecialCardCinematicEvent(
      {
        type: 'special_card_cinematic',
        targets: [{
          displayName: '盤理の観測者',
          quote: '我が観測をもって、悲しき輪廻に新たな一手を示そう',
          cinematicKey: 'observer_will',
          durationMs: 3000
        }]
      },
      { sleep, typewriterSleep, isNoAnim: () => false }
    );

    await Promise.resolve();
    const quoteEl = document.querySelector('.special-card-cinematic-quote') as HTMLElement;
    const lines = Array.from(document.querySelectorAll('.special-card-cinematic-quote-line')) as HTMLElement[];

    expect(quoteEl.dataset.fullText).toBe('我が観測をもって、悲しき輪廻に新たな一手を示そう');
    expect(lines.map((line) => line.dataset.fullText)).toEqual([
      '我が観測をもって、悲しき',
      '輪廻に新たな一手を示そう'
    ]);
    expect(lines.map((line) => line.textContent)).toEqual(['', '']);

    typewriterResolvers.shift()?.();
    await Promise.resolve();
    expect(lines.map((line) => line.textContent)).toEqual(['我', '']);

    resolvers.shift()?.();
    await Promise.resolve();
    resolvers.shift()?.();
    await promise;
  });

  test('special card cinematic immediately applies manifestation background and queues dedicated BGM', async () => {
    dom = new JSDOM('<!doctype html><html><body></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).HTMLElement = dom.window.HTMLElement;
    const resolvers: Array<() => void> = [];
    const sleep = jest.fn(() => new Promise<void>((resolve) => {
      resolvers.push(resolve);
    }));
    const syncManifestBgmOverride = jest.fn();

    const promise = AnimationFeedbackEvents.handleSpecialCardCinematicEvent(
      {
        type: 'special_card_cinematic',
        phase: 4,
        targets: [{
          cardId: 'observer_will_01',
          owner: 'black',
          displayName: '盤理の観測者',
          quote: '我が観測をもって、悲しき輪廻に新たな一手を示そう',
          cinematicKey: 'observer_will',
          characterImage: 'assets/images/special-cards/characters/observer_will.png',
          manifestBackgroundKey: 'observer_will_world',
          manifestBackgroundImage: 'assets/images/background/manifest-worlds/観測の世界.png',
          manifestBgmKey: 'observer_will_path',
          manifestBgmTrack: {
            name: '観測の道',
            file: 'assets/audio/bgm/manifest-stones/観測の道-bpm150.mp3',
            loopStart: 9.6,
            loopEnd: 62.4
          },
          durationMs: 3000
        }]
      },
      {
        sleep,
        isNoAnim: () => false,
        soundEngine: { syncManifestBgmOverride }
      }
    );

    await Promise.resolve();
    expect(document.body.classList.contains('manifest-world-background-active')).toBe(true);
    expect(document.body.getAttribute('data-manifest-world-background-key')).toBe('observer_will_world');
    expect(document.body.getAttribute('data-manifest-world-background-source')).toBe('special_card_use');
    expect(document.body.style.getPropertyValue('--manifest-world-background')).toContain('assets/images/background/manifest-worlds/観測の世界.png');
    expect(syncManifestBgmOverride).toHaveBeenCalledWith(
      'observer_will_path',
      expect.objectContaining({
        file: 'assets/audio/bgm/manifest-stones/観測の道-bpm150.mp3'
      })
    );
    expect((window as any).__manifestPresentationOverride).toMatchObject({
      source: 'special_card_use',
      manifestBackgroundKey: 'observer_will_world',
      manifestBgmKey: 'observer_will_path',
      resolvedByMarker: false
    });

    resolvers.shift()?.();
    await Promise.resolve();
    resolvers.shift()?.();
    await promise;
  });

  test('special card cinematic shows a dismissible manifest summary after the cinematic leaves', async () => {
    jest.useFakeTimers();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    dom = new JSDOM('<!doctype html><html><body></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).HTMLElement = dom.window.HTMLElement;
    const resolvers: Array<() => void> = [];
    const sleep = jest.fn(() => new Promise<void>((resolve) => {
      resolvers.push(resolve);
    }));

    const promise = AnimationFeedbackEvents.handleSpecialCardCinematicEvent(
      {
        type: 'special_card_cinematic',
        phase: 4,
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
      { sleep, isNoAnim: () => false }
    );

    await Promise.resolve();
    expect(document.querySelector('.manifest-summary-popup')).toBeNull();

    resolvers.shift()?.();
    await Promise.resolve();
    resolvers.shift()?.();
    await promise;

    const popup = document.querySelector('.manifest-summary-popup') as HTMLElement;
    expect(popup).toBeTruthy();
    expect(popup.dataset.cardType).toBe('BOARD_EXECUTOR');
    expect(popup.textContent).not.toContain('執行領域');
    expect(popup.textContent).toContain('両者: カード使用封印');
    expect(popup.textContent).toContain('手札が多いほど布石を失う');
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 3000);

    popup.click();
    await Promise.resolve();
    expect(popup.classList.contains('is-leaving')).toBe(true);
    jest.runAllTimers();
    setTimeoutSpy.mockRestore();
    jest.useRealTimers();
  });

  test('observer will manifest summary is hidden for the using side and shown to the victim side', async () => {
    jest.useFakeTimers();
    dom = new JSDOM('<!doctype html><html><body></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).HTMLElement = dom.window.HTMLElement;
    (window as any).NetworkMatchClient = {
      isActive: () => true,
      getSeatKey: () => 'black'
    };
    const immediateSleep = jest.fn(() => Promise.resolve());

    await AnimationFeedbackEvents.handleSpecialCardCinematicEvent(
      {
        type: 'special_card_cinematic',
        targets: [{
          cardType: 'OBSERVER_WILL',
          owner: 'black',
          displayName: '盤理の観測者',
          cinematicKey: 'observer_will',
          durationMs: 3000
        }]
      },
      { sleep: immediateSleep, isNoAnim: () => false }
    );

    expect(document.querySelector('.manifest-summary-popup')).toBeNull();

    await AnimationFeedbackEvents.handleSpecialCardCinematicEvent(
      {
        type: 'special_card_cinematic',
        targets: [{
          cardType: 'OBSERVER_WILL',
          owner: 'white',
          displayName: '盤理の観測者',
          cinematicKey: 'observer_will',
          durationMs: 3000
        }]
      },
      { sleep: immediateSleep, isNoAnim: () => false }
    );

    const popup = document.querySelector('.manifest-summary-popup') as HTMLElement;
    expect(popup).toBeTruthy();
    expect(popup.dataset.cardType).toBe('OBSERVER_WILL');
    expect(popup.textContent).not.toContain('観測領域');
    expect(popup.textContent).toContain('手札1枚を0コストで奪われる');
    expect(popup.textContent).toContain('観測済みカードはコスト増加');
    jest.runAllTimers();
    jest.useRealTimers();
  });

  test('auto pass notice shows player and reason for three seconds before fading out', async () => {
    jest.useFakeTimers();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    dom = new JSDOM('<!doctype html><html><body></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).HTMLElement = dom.window.HTMLElement;

    AnimationFeedbackEvents.showAutoPassNotice({
      playerKey: 'black'
    }, { isNoAnim: () => false });

    const popup = document.querySelector('.auto-pass-notice-popup') as HTMLElement;
    expect(popup).toBeTruthy();
    expect(popup.getAttribute('role')).toBe('status');
    expect(popup.textContent).toContain('黒 : 自動パス');
    expect(popup.textContent).toContain('合法手と使用可能カードがありません。');
    expect(popup.classList.contains('is-visible')).toBe(true);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 3000);

    jest.advanceTimersByTime(3000);
    expect(popup.classList.contains('is-leaving')).toBe(true);
    jest.advanceTimersByTime(500);
    expect(document.querySelector('.auto-pass-notice-popup')).toBeNull();

    setTimeoutSpy.mockRestore();
    jest.useRealTimers();
  });

  test('voluntary and timeout passes use the same popup with a "パス" title', () => {
    jest.useFakeTimers();
    dom = new JSDOM('<!doctype html><html><body></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).HTMLElement = dom.window.HTMLElement;

    AnimationFeedbackEvents.showAutoPassNotice({ playerKey: 'white', reason: 'voluntary_pass' }, { isNoAnim: () => false });
    let popup = document.querySelector('.auto-pass-notice-popup') as HTMLElement;
    expect(popup.textContent).toContain('白 : パス');
    expect(popup.textContent).not.toContain('自動パス');
    expect(popup.textContent).toContain('パスを選びました。');
    expect(popup.dataset.passKind).toBe('manual');

    AnimationFeedbackEvents.showAutoPassNotice({ playerKey: 'black', reason: 'timeout_pass' }, { isNoAnim: () => false });
    const popups = document.querySelectorAll('.auto-pass-notice-popup');
    expect(popups).toHaveLength(1);
    popup = popups[0] as HTMLElement;
    expect(popup.textContent).toContain('黒 : パス');
    expect(popup.textContent).toContain('持ち時間が切れました。');

    AnimationFeedbackEvents.showAutoPassNotice({ playerKey: 'black', reason: 'stone_supply_exhausted_no_usable_cards' }, { isNoAnim: () => false });
    popup = document.querySelector('.auto-pass-notice-popup') as HTMLElement;
    expect(popup.textContent).toContain('黒 : 自動パス');
    expect(popup.textContent).toContain('持ち石がなく、使用可能カードもありません。');
    expect(popup.dataset.passKind).toBe('auto');

    jest.runAllTimers();
    jest.useRealTimers();
  });
});
