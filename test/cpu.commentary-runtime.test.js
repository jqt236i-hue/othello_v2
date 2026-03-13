let runtime = null;
let engine = null;
const data = require('../data/dialogue/fixed-commentary-data');

function normalizeCommentaryBody(line) {
  return String(line || '')
    .replace(/^(へへっ、|くそっ、|おっと、|ちっ、|よし、|くっ、)+/, '')
    .replace(/[。！!？?]+$/g, '')
    .trim();
}

describe('cpu commentary runtime', () => {
  beforeEach(() => {
    jest.resetModules();
    runtime = require('../game/ai/cpu-commentary-runtime');
    engine = require('../game/ai/fixed-commentary-engine');
    delete global.CPU_TALK_ENABLED;
    delete global.location;
    runtime.resetState();
    runtime.setConfig({ maxChars: 20, recentKeep: 8 });
  });

  test('can be disabled by global flag', async () => {
    global.CPU_TALK_ENABLED = false;
    const text = await runtime.requestCommentary({ eventType: 'turn_start' });
    expect(text).toBeNull();
  });

  test('returns fixed phrase when enabled', async () => {
    global.CPU_TALK_ENABLED = true;

    const text = await runtime.requestCommentary({ eventType: 'turn_start' });

    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
    expect(text.length).toBeLessThanOrEqual(20);
  });

  test('card_used line includes card label', async () => {
    global.CPU_TALK_ENABLED = true;
    runtime.setConfig({ maxChars: 200 });

    const text = await runtime.requestCommentary({
      eventType: 'card_used',
      playerKey: 'white',
      cardType: 'SWAP_WITH_ENEMY'
    });

    expect(typeof text).toBe('string');
    expect(text.includes('交換の意志')).toBe(true);
    expect(text.includes('相手の通常石1つ')).toBe(true);
  });

  test('card_used_by_enemy line includes card label', async () => {
    global.CPU_TALK_ENABLED = true;
    runtime.setConfig({ maxChars: 200 });

    const text = await runtime.requestCommentary({
      eventType: 'card_used_by_enemy',
      playerKey: 'white',
      cardType: 'SWAP_WITH_ENEMY'
    });

    expect(typeof text).toBe('string');
    expect(text.includes('交換の意志')).toBe(true);
    expect(text.includes('相手の通常石1つ')).toBe(true);
  });

  test('basic pools are fixed to 100 lines total', () => {
    const pools = [
      data.openingLines,
      data.middleAheadLines,
      data.middleEvenLines,
      data.middleBehindLines,
      data.endAheadLines,
      data.endEvenLines,
      data.endBehindLines,
      data.chatterLines,
      data.tauntLines,
      data.negativeLines,
      data.bluffLines,
      data.boardSwingLines,
      data.passLines,
      data.cardTargetLines
    ];
    const total = pools.reduce((n, one) => n + (Array.isArray(one) ? one.length : 0), 0);
    expect(total).toBe(100);
  });

  test('basic pools keep unique lines in each pool', () => {
    const pools = [
      data.openingLines,
      data.middleAheadLines,
      data.middleEvenLines,
      data.middleBehindLines,
      data.endAheadLines,
      data.endEvenLines,
      data.endBehindLines,
      data.chatterLines,
      data.tauntLines,
      data.negativeLines,
      data.bluffLines,
      data.boardSwingLines,
      data.passLines,
      data.cardTargetLines
    ];
    for (const one of pools) {
      expect(Array.isArray(one)).toBe(true);
      expect(new Set(one).size).toBe(one.length);
    }
  });

  test('通常ターン文は2ターンに1回だけ更新する', () => {
    engine.resetState();
    engine.setConfig({ maxChars: 200, regularTurnInterval: 2 });

    const base = {
      eventType: 'turn_start',
      playerKey: 'white',
      phase: 'middle',
      advantage: 'even',
      counts: { black: 16, white: 16 },
      corners: { own: 0, opp: 0 }
    };

    const t1 = engine._buildCommentaryForTest({ ...base, turnNumber: 1 });
    const t2 = engine._buildCommentaryForTest({ ...base, turnNumber: 2 });
    const t3 = engine._buildCommentaryForTest({ ...base, turnNumber: 3 });
    const t4 = engine._buildCommentaryForTest({ ...base, turnNumber: 4 });

    expect(t1).not.toBe('');
    expect(t2).not.toBe('');
    expect(t3).toBe('');
    expect(t4).not.toBe('');
  });

  test('カード使用は更新間隔を無視して即時発話する', () => {
    engine.resetState();
    engine.setConfig({ maxChars: 200, regularTurnInterval: 2 });

    const base = {
      eventType: 'turn_start',
      playerKey: 'white',
      phase: 'middle',
      advantage: 'even',
      counts: { black: 16, white: 16 },
      corners: { own: 0, opp: 0 }
    };

    engine._buildCommentaryForTest({ ...base, turnNumber: 1 });
    engine._buildCommentaryForTest({ ...base, turnNumber: 2 });
    const skipped = engine._buildCommentaryForTest({ ...base, turnNumber: 3 });
    const interrupted = engine._buildCommentaryForTest({
      ...base,
      eventType: 'card_used',
      turnNumber: 3,
      cardType: 'SWAP_WITH_ENEMY'
    });

    expect(skipped).toBe('');
    expect(interrupted).not.toBe('');
  });

  test('フェーズ切替は更新間隔を無視して即時発話する', () => {
    engine.resetState();
    engine.setConfig({ maxChars: 200, regularTurnInterval: 2 });

    const base = {
      eventType: 'turn_start',
      playerKey: 'white',
      advantage: 'even',
      counts: { black: 16, white: 16 },
      corners: { own: 0, opp: 0 }
    };

    engine._buildCommentaryForTest({ ...base, phase: 'opening', turnNumber: 1 });
    engine._buildCommentaryForTest({ ...base, phase: 'opening', turnNumber: 2 });
    const switched = engine._buildCommentaryForTest({ ...base, phase: 'middle', turnNumber: 3 });

    expect(switched).not.toBe('');
  });

  test('優勢劣勢の逆転は更新間隔を無視して即時発話する', () => {
    engine.resetState();
    engine.setConfig({ maxChars: 200, regularTurnInterval: 2 });

    const base = {
      eventType: 'turn_start',
      playerKey: 'white',
      phase: 'middle',
      counts: { black: 16, white: 16 },
      corners: { own: 0, opp: 0 }
    };

    engine._buildCommentaryForTest({ ...base, advantage: 'even', turnNumber: 1 });
    engine._buildCommentaryForTest({ ...base, advantage: 'ahead', turnNumber: 2 });
    const reversed = engine._buildCommentaryForTest({ ...base, advantage: 'behind', turnNumber: 3 });

    expect(reversed).not.toBe('');
  });

  test('角取得は更新間隔を無視して即時発話する', () => {
    engine.resetState();
    engine.setConfig({ maxChars: 200, regularTurnInterval: 2 });

    const base = {
      eventType: 'turn_start',
      playerKey: 'white',
      phase: 'middle',
      advantage: 'even',
      counts: { black: 16, white: 16 }
    };

    engine._buildCommentaryForTest({ ...base, turnNumber: 1, corners: { own: 0, opp: 0 } });
    engine._buildCommentaryForTest({ ...base, turnNumber: 2, corners: { own: 0, opp: 0 } });
    const line = engine._buildCommentaryForTest({ ...base, turnNumber: 3, corners: { own: 1, opp: 0 } });

    const body = normalizeCommentaryBody(line);
    const pool = new Set((data.cornerFirstOwnedLines || []).map(normalizeCommentaryBody));
    expect(line).not.toBe('');
    expect(pool.has(body)).toBe(true);
  });

  test('優勢の停滞局面で弱気プールを選ばない', () => {
    const randomSpy = jest.spyOn(Math, 'random');
    try {
      randomSpy
        .mockReturnValueOnce(0.1)
        .mockReturnValueOnce(0.99)
        .mockReturnValueOnce(0.1);

      engine.resetState();
      engine.setConfig({ maxChars: 200, unchangedThreshold: 1 });

      const context = {
        eventType: 'turn_start',
        playerKey: 'white',
        phase: 'middle',
        advantage: 'ahead',
        turnNumber: 20,
        counts: { black: 10, white: 20 },
        corners: { own: 0, opp: 0 }
      };

      engine._buildCommentaryForTest(context);
      const line = engine._buildCommentaryForTest(context);

      const body = normalizeCommentaryBody(line);
      const bluffBodies = new Set((data.bluffLines || []).map(normalizeCommentaryBody));
      expect(bluffBodies.has(body)).toBe(false);
    } finally {
      randomSpy.mockRestore();
    }
  });

  test('playerKeyの大文字と空白を正規化して黒視点の優勢文を選ぶ', () => {
    const randomSpy = jest.spyOn(Math, 'random');
    try {
      randomSpy.mockReturnValue(0.9);

      engine.resetState();
      engine.setConfig({ maxChars: 200, regularTurnInterval: 1, unchangedThreshold: 999 });

      const base = {
        eventType: 'turn_start',
        playerKey: ' BLACK ',
        phase: 'middle',
        counts: { black: 20, white: 10 },
        corners: { own: 0, opp: 0 }
      };

      engine._buildCommentaryForTest({ ...base, turnNumber: 18 });
      const line = engine._buildCommentaryForTest({ ...base, turnNumber: 20 });

      const body = normalizeCommentaryBody(line);
      const aheadBodies = new Set((data.middleAheadLines || []).map(normalizeCommentaryBody));
      expect(aheadBodies.has(body)).toBe(true);
    } finally {
      randomSpy.mockRestore();
    }
  });
});
