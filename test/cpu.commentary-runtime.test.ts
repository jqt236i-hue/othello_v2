let runtime = null;
let engine = null;
import * as data from '../game/ai/commentary-data';
import * as shared from '../shared-constants.js';
const COMMENTARY_PREFIX_PATTERN = /^(へへっ、|このまま、|まだだ、|よし、|くっ、|見えてる、|置けないな、|動いたな、|まずいな、|さて、|この流れだ、|では、|なるほど、|読んでいる、|手がないな、|流れが変わった、|角は取った、|受け直す、|解析する、|優位を維持する、|再計算する、|実行する、|影響を確認する、|対象は把握した、|手番を送る、|盤面を更新する、|角を確保した、|損失を補正する、)+/;
const CPU_AHEAD_EMOTION_MARKER = /(押し切れる|崩さず広げる|確定へ近づける)/;
const CPU_BEHIND_EMOTION_MARKER = /(取り返す手はある|勝ち筋は残っている|再計算する)/;
const CPU_CARD_AHEAD_MARKER = /(押し切る)/;
const CPU_CARD_BEHIND_MARKER = /(まだ返す)/;
const CPU_CARD_HIT_AHEAD_MARKER = /(主導権は渡さない)/;
const CPU_CARD_HIT_BEHIND_MARKER = /(ここから立て直す)/;
const CPU_CARD_USE_PREFIX_BY_LEVEL = Object.freeze({
  1: /^よし、/,
  4: /^では、/,
  6: /^実行する、/
});
const CPU_CARD_HIT_PREFIX_BY_LEVEL = Object.freeze({
  1: /^くっ、/,
  4: /^なるほど、/,
  6: /^影響を確認する、/
});
const CPU_LEVEL_SAMPLES = [
  { label: 'goblin', level: 1, marker: /^へへっ、/ },
  { label: 'boss', level: 4, marker: /^さて、/ },
  { label: 'finalBoss', level: 6, marker: /^解析する、/ }
];
const THIRD_PERSON_CPU_MARKER = /(ゴブリン|盤上の主|観測者)は/;

function normalizeCommentaryBody(line) {
  return String(line || '')
    .replace(COMMENTARY_PREFIX_PATTERN, '')
    .replace(/[。！!？?]+$/g, '')
    .trim();
}

function charLength(line) {
  return Array.from(String(line || '')).length;
}

function sanitizeCommentaryLine(line, maxChars = 60) {
  const text = String(line || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const chars = Array.from(text);
  if (!Number.isFinite(maxChars) || maxChars <= 0 || chars.length <= maxChars) return text;

  const tokens = text.match(/[^\s、。！!？?]+(?:[、。！!？?]+)?|\s+/g) || [];
  let compact = '';
  for (const token of tokens) {
    const candidate = compact + token;
    if (charLength(candidate) > maxChars) break;
    compact = candidate;
  }

  const normalizedCompact = String(compact || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[、，\s]+$/g, '')
    .replace(/[。！!？?]+$/g, '');
  if (normalizedCompact) return normalizedCompact;

  return chars
    .slice(0, maxChars)
    .join('')
    .replace(/[、，\s]+$/g, '')
    .replace(/[。！!？?]+$/g, '');
}

function getCatalogCardTypes() {
  const defs = Array.isArray(shared && shared.CARD_DEFS) ? shared.CARD_DEFS : [];
  return [...new Set(
    defs.map((card) => String(card && card.type ? card.type : '').trim()).filter(Boolean)
  )].sort();
}

function getCpuSharedPools(level = data.CPU_COMMENTARY_DEFAULT_LEVEL || 3) {
  return [
    ['cpuChatterLines', data.getCpuChatterLines(level), 300],
    ['cpuAheadLines', data.getCpuAheadLines(level), 50],
    ['cpuBehindLines', data.getCpuBehindLines(level), 50],
    ['cpuCornerGainLines', data.getCpuCornerGainLines(level), 30],
    ['cpuCornerLossLines', data.getCpuCornerLossLines(level), 30]
  ];
}

describe('cpu commentary runtime', () => {
  beforeEach(() => {
    jest.resetModules();
    runtime = require('../game/ai/cpu-commentary-runtime');
    engine = require('../game/ai/fixed-commentary-engine');
    delete global.CPU_TALK_ENABLED;
    delete global.location;
    runtime.resetState();
    runtime.setConfig({ recentKeep: 8 });
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
    expect(runtime.getStatus().maxChars).toBe(60);
    expect(charLength(text)).toBeLessThanOrEqual(60);
  });

  test('custom maxChars can shorten commentary further', async () => {
    global.CPU_TALK_ENABLED = true;
    runtime.setConfig({ maxChars: 20 });

    const text = await runtime.requestCommentary({ eventType: 'turn_start' });

    expect(typeof text).toBe('string');
    expect(charLength(text)).toBeLessThanOrEqual(20);
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
    expect(text.includes(data.CARD_EFFECT_SUMMARIES.SWAP_WITH_ENEMY)).toBe(true);
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
    expect(text.includes(data.CARD_EFFECT_SUMMARIES.SWAP_WITH_ENEMY)).toBe(true);
  });

  test.each(CPU_LEVEL_SAMPLES)('cpu fixed pools keep exact rollout sizes for $label tier', ({ level }) => {
    for (const [, pool, expectedSize] of getCpuSharedPools(level)) {
      expect(Array.isArray(pool)).toBe(true);
      expect(pool.length).toBe(expectedSize);
      expect(new Set(pool).size).toBe(pool.length);
    }
  });

  test.each(CPU_LEVEL_SAMPLES)('cpu level $level fixed pools avoid third-person narration', ({ level }) => {
    const chatterLines = data.getCpuChatterLines(level);
    expect(chatterLines.length).toBe(300);
    for (const [, pool] of getCpuSharedPools(level)) {
      expect(pool.every((line) => !THIRD_PERSON_CPU_MARKER.test(line))).toBe(true);
    }
  });

  test.each(CPU_LEVEL_SAMPLES)('cpu level $level keeps multiple chatter lead-in variants', ({ level }) => {
    const leadIns = new Set(
      data.getCpuChatterLines(level)
        .map((line) => String(line || '').split(' ')[0])
        .filter(Boolean)
    );
    expect(leadIns.size).toBeGreaterThanOrEqual(5);
  });

  test.each(CPU_LEVEL_SAMPLES)('cpu level $level keeps emotional ahead and behind phrasing', ({ level }) => {
    expect(data.getCpuAheadLines(level).every((line) => CPU_AHEAD_EMOTION_MARKER.test(line))).toBe(true);
    expect(data.getCpuBehindLines(level).every((line) => CPU_BEHIND_EMOTION_MARKER.test(line))).toBe(true);
  });

  test.each(CPU_LEVEL_SAMPLES)('runtime turn_start uses $label-style voice for level $level', async ({ level, marker }) => {
    global.CPU_TALK_ENABLED = true;
    runtime.resetState();
    runtime.setConfig({ maxChars: 200, recentKeep: 8 });

    const text = await runtime.requestCommentary({
      eventType: 'turn_start',
      playerKey: 'white',
      turnNumber: 14,
      phase: 'middle',
      advantage: 'even',
      counts: { black: 12, white: 12 },
      corners: { own: 0, opp: 0 },
      level
    });

    expect(typeof text).toBe('string');
    expect(text).toMatch(marker);
  });

  test('legacy cpu pool exports alias reduced shared pools', () => {
    expect(data.cpuChatterLines).toBe(data.getCpuChatterLines(data.CPU_COMMENTARY_DEFAULT_LEVEL));
    expect(data.cpuAheadLines).toBe(data.getCpuAheadLines(data.CPU_COMMENTARY_DEFAULT_LEVEL));
    expect(data.cpuBehindLines).toBe(data.getCpuBehindLines(data.CPU_COMMENTARY_DEFAULT_LEVEL));
    expect(data.cpuCornerGainLines).toBe(data.getCpuCornerGainLines(data.CPU_COMMENTARY_DEFAULT_LEVEL));
    expect(data.cpuCornerLossLines).toBe(data.getCpuCornerLossLines(data.CPU_COMMENTARY_DEFAULT_LEVEL));

    expect(data.openingLines).toBe(data.cpuChatterLines);
    expect(data.middleEvenLines).toBe(data.cpuChatterLines);
    expect(data.endEvenLines).toBe(data.cpuChatterLines);
    expect(data.chatterLines).toBe(data.cpuChatterLines);
    expect(data.boardSwingLines).toBe(data.cpuChatterLines);
    expect(data.passLines).toBe(data.cpuChatterLines);
    expect(data.cardTargetLines).toBe(data.cpuChatterLines);

    expect(data.middleAheadLines).toBe(data.cpuAheadLines);
    expect(data.endAheadLines).toBe(data.cpuAheadLines);
    expect(data.tauntLines).toBe(data.cpuAheadLines);

    expect(data.middleBehindLines).toBe(data.cpuBehindLines);
    expect(data.endBehindLines).toBe(data.cpuBehindLines);
    expect(data.negativeLines).toBe(data.cpuBehindLines);
    expect(data.bluffLines).toBe(data.cpuBehindLines);

    expect(data.cornerFirstOwnedLines).toBe(data.cpuCornerGainLines);
    expect(data.cornerStreakTwoOwnedLines).toBe(data.cpuCornerGainLines);
    expect(data.cornerStreakThreeOwnedLines).toBe(data.cpuCornerGainLines);
    expect(data.cornerAllOwnedLines).toBe(data.cpuCornerGainLines);

    expect(data.cornerFirstLostLines).toBe(data.cpuCornerLossLines);
    expect(data.cornerStreakTwoLostLines).toBe(data.cpuCornerLossLines);
    expect(data.cornerStreakThreeLostLines).toBe(data.cpuCornerLossLines);
    expect(data.cornerAllLostLines).toBe(data.cpuCornerLossLines);
  });

  test('cpu card commentary pools keep 10 lines per card for each advantage context', () => {
    const evenUseLines = data.getCardUseLines('SWAP_WITH_ENEMY', 'even', 4);
    const aheadUseLines = data.getCardUseLines('SWAP_WITH_ENEMY', 'ahead', 4);
    const behindUseLines = data.getCardUseLines('SWAP_WITH_ENEMY', 'behind', 4);
    const evenHitLines = data.getCardHitLines('SWAP_WITH_ENEMY', 'even', 4);
    const aheadHitLines = data.getCardHitLines('SWAP_WITH_ENEMY', 'ahead', 4);
    const behindHitLines = data.getCardHitLines('SWAP_WITH_ENEMY', 'behind', 4);

    expect(evenUseLines).not.toEqual(aheadUseLines);
    expect(evenUseLines).not.toEqual(behindUseLines);
    expect(aheadUseLines).not.toEqual(behindUseLines);
    expect(evenHitLines).not.toEqual(aheadHitLines);
    expect(evenHitLines).not.toEqual(behindHitLines);
    expect(aheadHitLines).not.toEqual(behindHitLines);

    for (const pool of [evenUseLines, aheadUseLines, behindUseLines, evenHitLines, aheadHitLines, behindHitLines]) {
      expect(pool.length).toBe(10);
      expect(new Set(pool).size).toBe(pool.length);
      expect(pool.every((line) => line.includes('交換の意志'))).toBe(true);
      expect(pool.every((line) => line.includes(data.CARD_EFFECT_SUMMARIES.SWAP_WITH_ENEMY))).toBe(true);
    }

    expect(aheadUseLines.some((line) => CPU_CARD_AHEAD_MARKER.test(line))).toBe(true);
    expect(behindUseLines.some((line) => CPU_CARD_BEHIND_MARKER.test(line))).toBe(true);
    expect(aheadHitLines.some((line) => CPU_CARD_HIT_AHEAD_MARKER.test(line))).toBe(true);
    expect(behindHitLines.some((line) => CPU_CARD_HIT_BEHIND_MARKER.test(line))).toBe(true);
  });

  test.each(CPU_LEVEL_SAMPLES)('cpu level $level keeps multiple card lead-in variants', ({ level }) => {
    const leadIns = new Set(
      data.getCardUseLines('SWAP_WITH_ENEMY', 'even', level)
        .map((line) => String(line || '').split(' ')[0])
        .filter(Boolean)
    );
    expect(leadIns.size).toBeGreaterThanOrEqual(4);
  });

  test.each(CPU_LEVEL_SAMPLES)('runtime card reactions use the $label tier prefixes', ({ level }) => {
    engine.resetState();
    engine.setConfig({ maxChars: 200, regularTurnInterval: 1 });

    const used = engine._buildCommentaryForTest({
      eventType: 'card_used',
      playerKey: 'white',
      phase: 'middle',
      advantage: 'even',
      turnNumber: 12,
      counts: { black: 16, white: 16 },
      corners: { own: 0, opp: 0 },
      cardType: 'SWAP_WITH_ENEMY',
      level
    });
    engine.resetState();
    const hit = engine._buildCommentaryForTest({
      eventType: 'card_used_by_enemy',
      playerKey: 'white',
      phase: 'middle',
      advantage: 'even',
      turnNumber: 12,
      counts: { black: 16, white: 16 },
      corners: { own: 0, opp: 0 },
      cardType: 'SWAP_WITH_ENEMY',
      level
    });

    expect(used).toMatch(CPU_CARD_USE_PREFIX_BY_LEVEL[level]);
    expect(hit).toMatch(CPU_CARD_HIT_PREFIX_BY_LEVEL[level]);
  });

  test('all catalog card types have commentary labels and summaries', () => {
    const catalogTypes = getCatalogCardTypes();
    expect(catalogTypes.length).toBeGreaterThan(0);

    for (const cardType of catalogTypes) {
      expect(data.CARD_TYPE_LABELS[cardType]).toBeTruthy();
      expect(data.CARD_EFFECT_SUMMARIES[cardType]).toBeTruthy();
    }
  });

  test.each(CPU_LEVEL_SAMPLES)('runtime card_used lines always keep effect summaries for $label tier', ({ level }) => {
    const catalogTypes = getCatalogCardTypes();
    engine.resetState();
    engine.setConfig({ maxChars: 60, regularTurnInterval: 1 });

    for (const cardType of catalogTypes) {
      engine.resetState();
      const line = engine._buildCommentaryForTest({
        eventType: 'card_used',
        playerKey: 'white',
        phase: 'middle',
        advantage: 'even',
        turnNumber: 12,
        counts: { black: 16, white: 16 },
        corners: { own: 0, opp: 0 },
        cardType,
        level
      });

      expect(line).toContain(data.CARD_EFFECT_SUMMARIES[cardType]);
      expect(charLength(line)).toBeLessThanOrEqual(60);
    }
  });

  test.each(CPU_LEVEL_SAMPLES)('visible in-match dialogue stays around 60 chars for $label tier', ({ level }) => {
    const cardTypes = Object.keys(data.CARD_TYPE_LABELS || {});
    const allLines = [];

    for (const [, pool] of getCpuSharedPools(level)) {
      allLines.push(...pool);
    }
    for (const cardType of cardTypes) {
      for (const advantage of ['ahead', 'even', 'behind']) {
        allLines.push(...data.getCardUseLines(cardType, advantage, level));
        allLines.push(...data.getCardHitLines(cardType, advantage, level));
      }
    }

    const visible = allLines.map((line) => sanitizeCommentaryLine(line, 60));
    const avgLength = visible.reduce((sum, line) => sum + charLength(line), 0) / visible.length;

    expect(Math.max(...visible.map(charLength))).toBeLessThanOrEqual(60);
    expect(avgLength).toBeLessThanOrEqual(60);
  });

  test.each(CPU_LEVEL_SAMPLES)('in-match dialogue pools match requested totals for $label tier', ({ level }) => {
    const fixedTotal = getCpuSharedPools(level).reduce((n, [, pool]) => n + pool.length, 0);
    const cardTypes = Object.keys(data.CARD_TYPE_LABELS || {});
    const advantages = ['ahead', 'even', 'behind'];

    let cardUseTotal = 0;
    let cardHitTotal = 0;
    for (const cardType of cardTypes) {
      for (const advantage of advantages) {
        cardUseTotal += data.getCardUseLines(cardType, advantage, level).length;
        cardHitTotal += data.getCardHitLines(cardType, advantage, level).length;
      }
    }

    expect(fixedTotal).toBe(460);
    expect(cardUseTotal).toBe(cardTypes.length * advantages.length * 10);
    expect(cardHitTotal).toBe(cardTypes.length * advantages.length * 10);
    expect(fixedTotal + cardUseTotal + cardHitTotal).toBe(460 + (cardTypes.length * advantages.length * 20));
  });

  test.each(CPU_LEVEL_SAMPLES)('all in-match dialogue lines stay globally unique for $label tier', ({ level }) => {
    const cardTypes = Object.keys(data.CARD_TYPE_LABELS || {});
    const advantages = ['ahead', 'even', 'behind'];
    const allLines = [];

    for (const [, pool] of getCpuSharedPools(level)) {
      allLines.push(...pool);
    }

    for (const cardType of cardTypes) {
      for (const advantage of advantages) {
        allLines.push(...data.getCardUseLines(cardType, advantage, level));
        allLines.push(...data.getCardHitLines(cardType, advantage, level));
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
