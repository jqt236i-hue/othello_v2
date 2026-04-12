describe('ui commentary broker', () => {
  afterEach(() => {
    jest.resetModules();
  });

  test('requestCommentaryAndShow shows CPU commentary without adding it to the log by default', async () => {
    const addLog = jest.fn();
    const showCpuSpeechBubble = jest.fn();
    const requestCommentary = jest.fn(async () => '読み切った');
    const broker = require('../ui/commentary-broker');

    broker.resetState().initBroker({
      root: {
        CpuCommentaryRuntime: { requestCommentary }
      },
      addLog,
      getShowCpuSpeechBubble: () => showCpuSpeechBubble,
      getShowHeroSpeechBubble: () => null
    });

    const board = Array.from({ length: 8 }, () => Array(8).fill(0));
    await broker.requestCommentaryAndShow({
      eventType: 'card_used',
      playerKey: 'white',
      speakerRole: 'cpu',
      turnNumber: 8,
      counts: { black: 2, white: 3 },
      board,
      cardId: 'swap_01'
    });

    expect(requestCommentary).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'card_used',
      playerKey: 'white',
      cardId: 'swap_01'
    }));
    expect(addLog).not.toHaveBeenCalled();
    expect(showCpuSpeechBubble).toHaveBeenCalledWith('読み切った', expect.objectContaining({
      speakerRole: 'cpu',
      playerKey: 'white',
      prefix: '白CPU',
      text: '白CPU: 読み切った'
    }));
  });

  test('dedupeScope suppresses duplicate hero commentary until resetState', async () => {
    const addLog = jest.fn();
    const showHeroSpeechBubble = jest.fn();
    const requestCommentary = jest.fn(async () => 'まだ遊べる。');
    const broker = require('../ui/commentary-broker');

    broker.resetState().initBroker({
      root: {
        CpuCommentaryRuntime: { requestCommentary }
      },
      addLog,
      getShowCpuSpeechBubble: () => null,
      getShowHeroSpeechBubble: () => showHeroSpeechBubble
    });

    const board = Array.from({ length: 8 }, () => Array(8).fill(0));
    await broker.requestCommentaryAndShow({
      eventType: 'turn_start',
      playerKey: 'black',
      speakerRole: 'hero',
      turnNumber: 3,
      counts: { black: 4, white: 3 },
      board,
      dedupeScope: 'hero-turn',
      dedupeKey: 'cpu|black|3'
    });
    await broker.requestCommentaryAndShow({
      eventType: 'turn_start',
      playerKey: 'black',
      speakerRole: 'hero',
      turnNumber: 3,
      counts: { black: 4, white: 3 },
      board,
      dedupeScope: 'hero-turn',
      dedupeKey: 'cpu|black|3'
    });

    expect(requestCommentary).toHaveBeenCalledTimes(1);
    expect(addLog).not.toHaveBeenCalled();
    expect(showHeroSpeechBubble).toHaveBeenCalledTimes(1);

    broker.resetState();

    await broker.requestCommentaryAndShow({
      eventType: 'turn_start',
      playerKey: 'black',
      speakerRole: 'hero',
      turnNumber: 3,
      counts: { black: 4, white: 3 },
      board,
      dedupeScope: 'hero-turn',
      dedupeKey: 'cpu|black|3'
    });

    expect(requestCommentary).toHaveBeenCalledTimes(2);
    expect(addLog).not.toHaveBeenCalled();
    expect(showHeroSpeechBubble).toHaveBeenCalledTimes(2);
  });
});
