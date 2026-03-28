let runtime = null;
let engine = null;
const data = require('../data/dialogue/fixed-commentary-data');
const shared = require('../shared-constants');

function normalizeCommentaryBody(line) {
  return String(line || '')
    .replace(/^(へへっ、|くそっ、|おっと、|ちっ、|よし、|くっ、)+/, '')
    .replace(/[。！!？?]+$/g, '')
    .trim();
}

function sanitizeCommentaryLine(line, maxChars = 120) {
  const text = String(line || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const chars = Array.from(text);
  if (!Number.isFinite(maxChars) || maxChars <= 0 || chars.length <= maxChars) return text;
  return chars.slice(0, maxChars).join('');
}

function getCatalogCardTypes() {
  const defs = Array.isArray(shared && shared.CARD_DEFS) ? shared.CARD_DEFS : [];
  return [...new Set(
    defs.map((card) => String(card && card.type ? card.type : '').trim()).filter(Boolean)
  )].sort();
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

  test('speakerRole hero can request hero-side card commentary', async () => {
    global.CPU_TALK_ENABLED = true;
    runtime.setConfig({ maxChars: 200 });

    const text = await runtime.requestCommentary({
      eventType: 'card_used',
      playerKey: 'black',
      speakerRole: 'hero',
      turnNumber: 12,
      counts: { black: 20, white: 12 },
      cardType: 'SWAP_WITH_ENEMY'
    });

    expect(typeof text).toBe('string');
    expect(text).toContain('交換の意志');
    expect(text).toContain('相手の通常石1つ');
    expect(text).toContain('を切る');
  });

  test('basic pools are fixed to 100000 lines total', () => {
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
    expect(total).toBe(100000);
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

  test('corner commentary pools keep 2400 varied unique lines', () => {
    const pools = [
      data.cornerFirstOwnedLines,
      data.cornerFirstLostLines,
      data.cornerStreakTwoOwnedLines,
      data.cornerStreakTwoLostLines,
      data.cornerStreakThreeOwnedLines,
      data.cornerStreakThreeLostLines,
      data.cornerAllOwnedLines,
      data.cornerAllLostLines
    ];

    for (const one of pools) {
      expect(Array.isArray(one)).toBe(true);
      expect(one.length).toBe(2400);
      expect(new Set(one).size).toBe(one.length);
    }
  });

  test('card commentary pools expand to 480 lines per card and advantage context', () => {
    const useLines = data.getCardUseLines('SWAP_WITH_ENEMY', 'even');
    const hitLines = data.getCardHitLines('SWAP_WITH_ENEMY', 'even');

    expect(useLines.length).toBe(480);
    expect(hitLines.length).toBe(480);
    expect(new Set(useLines).size).toBe(useLines.length);
    expect(new Set(hitLines).size).toBe(hitLines.length);
  });

  test('hero fixed pools keep exact rollout sizes', () => {
    const pools = [
      ['heroChatterLines', data.heroChatterLines, 300],
      ['heroAheadLines', data.heroAheadLines, 50],
      ['heroBehindLines', data.heroBehindLines, 50],
      ['heroCornerGainLines', data.heroCornerGainLines, 30],
      ['heroCornerLossLines', data.heroCornerLossLines, 30]
    ];

    for (const [, pool, expectedSize] of pools) {
      expect(Array.isArray(pool)).toBe(true);
      expect(pool.length).toBe(expectedSize);
      expect(new Set(pool).size).toBe(pool.length);
    }
  });

  test('hero card commentary pools expand to 10 lines per catalog card and advantage context', () => {
    const catalogTypes = getCatalogCardTypes();
    let totalUseLines = 0;
    let totalHitLines = 0;

    expect(catalogTypes.length).toBeGreaterThan(0);

    for (const cardType of catalogTypes) {
      for (const advantage of ['ahead', 'even', 'behind']) {
        const useLines = data.getHeroCardUseLines(cardType, advantage);
        const hitLines = data.getHeroCardHitLines(cardType, advantage);

        expect(useLines.length).toBe(10);
        expect(hitLines.length).toBe(10);
        expect(new Set(useLines).size).toBe(useLines.length);
        expect(new Set(hitLines).size).toBe(hitLines.length);

        totalUseLines += useLines.length;
        totalHitLines += hitLines.length;
      }
    }

    expect(totalUseLines).toBe(catalogTypes.length * 3 * 10);
    expect(totalHitLines).toBe(catalogTypes.length * 3 * 10);
  });

  test('all catalog card types have commentary labels and summaries', () => {
    const catalogTypes = getCatalogCardTypes();
    expect(catalogTypes.length).toBeGreaterThan(0);

    for (const cardType of catalogTypes) {
      expect(data.CARD_TYPE_LABELS[cardType]).toBeTruthy();
      expect(data.CARD_EFFECT_SUMMARIES[cardType]).toBeTruthy();
    }
  });

  test('in-match dialogue pools match requested totals', () => {
    const fixedPools = [
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
      data.cardTargetLines,
      data.cornerFirstOwnedLines,
      data.cornerFirstLostLines,
      data.cornerStreakTwoOwnedLines,
      data.cornerStreakTwoLostLines,
      data.cornerStreakThreeOwnedLines,
      data.cornerStreakThreeLostLines,
      data.cornerAllOwnedLines,
      data.cornerAllLostLines
    ];
    const fixedTotal = fixedPools.reduce((n, one) => n + (Array.isArray(one) ? one.length : 0), 0);
    const cardTypes = Object.keys(data.CARD_TYPE_LABELS || {});

    let cardUseTotal = 0;
    let cardHitTotal = 0;
    for (const cardType of cardTypes) {
      for (const advantage of ['ahead', 'even', 'behind']) {
        cardUseTotal += data.getCardUseLines(cardType, advantage).length;
        cardHitTotal += data.getCardHitLines(cardType, advantage).length;
      }
    }

    expect(fixedTotal).toBe(119200);
    expect(cardUseTotal).toBe(cardTypes.length * 3 * 480);
    expect(cardHitTotal).toBe(cardTypes.length * 3 * 480);
    expect(fixedTotal + cardUseTotal + cardHitTotal).toBe(119200 + (cardTypes.length * 3 * 480 * 2));
  });

  test('all in-match dialogue lines stay globally unique including sanitized display text', () => {
    const cardTypes = Object.keys(data.CARD_TYPE_LABELS || {});
    const allLines = [];

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
      data.cardTargetLines,
      data.cornerFirstOwnedLines,
      data.cornerFirstLostLines,
      data.cornerStreakTwoOwnedLines,
      data.cornerStreakTwoLostLines,
      data.cornerStreakThreeOwnedLines,
      data.cornerStreakThreeLostLines,
      data.cornerAllOwnedLines,
      data.cornerAllLostLines
    ];

    for (const pool of pools) {
      allLines.push(...pool);
    }

    for (const cardType of cardTypes) {
      for (const advantage of ['ahead', 'even', 'behind']) {
        allLines.push(...data.getCardUseLines(cardType, advantage));
        allLines.push(...data.getCardHitLines(cardType, advantage));
      }
    }

    const sanitized = allLines.map((line) => sanitizeCommentaryLine(line, 120));

    expect(new Set(allLines).size).toBe(allLines.length);
    expect(new Set(sanitized).size).toBe(sanitized.length);
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

  test('開幕の通常ターン文は候補プールを均等寄りにランダム選択する', () => {
    const randomSpy = jest.spyOn(Math, 'random');
    try {
      randomSpy
        .mockReturnValueOnce(0.1)
        .mockReturnValueOnce(0.5)
        .mockReturnValueOnce(0.1);

      engine.resetState();
      engine.setConfig({ maxChars: 200, regularTurnInterval: 1 });

      const base = {
        eventType: 'turn_start',
        playerKey: 'white',
        phase: 'opening',
        advantage: 'even',
        counts: { black: 2, white: 2 },
        corners: { own: 0, opp: 0 }
      };

      engine._buildCommentaryForTest({ ...base, turnNumber: 1 });
      const line = engine._buildCommentaryForTest({ ...base, turnNumber: 2 });

      const body = normalizeCommentaryBody(line);
      const chatterBodies = new Set((data.chatterLines || []).map(normalizeCommentaryBody));
      expect(chatterBodies.has(body)).toBe(true);
    } finally {
      randomSpy.mockRestore();
    }
  });

  test('劣勢継続時も通常の劣勢プールを混ぜてランダム選択する', () => {
    const randomSpy = jest.spyOn(Math, 'random');
    try {
      randomSpy
        .mockReturnValueOnce(0.1)
        .mockReturnValueOnce(0.9)
        .mockReturnValueOnce(0.1);

      engine.resetState();
      engine.setConfig({ maxChars: 200, regularTurnInterval: 1, behindThreshold: 1 });

      engine._buildCommentaryForTest({
        eventType: 'turn_start',
        playerKey: 'white',
        phase: 'opening',
        advantage: 'even',
        turnNumber: 1,
        counts: { black: 2, white: 2 },
        corners: { own: 0, opp: 0 }
      });

      const line = engine._buildCommentaryForTest({
        eventType: 'turn_start',
        playerKey: 'white',
        phase: 'middle',
        advantage: 'behind',
        turnNumber: 2,
        counts: { black: 3, white: 2 },
        corners: { own: 0, opp: 0 }
      });

      const body = normalizeCommentaryBody(line);
      const behindBodies = new Set((data.middleBehindLines || []).map(normalizeCommentaryBody));
      expect(behindBodies.has(body)).toBe(true);
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
