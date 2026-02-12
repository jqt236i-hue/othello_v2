const path = require('path');
const runtime = require(path.resolve(__dirname, '..', 'game', 'ai', 'policy-onnx-runtime.js'));

describe('policy-onnx-runtime', () => {
  beforeEach(() => {
    global.ort = {
      Tensor: function Tensor(type, data, dims) {
        this.type = type;
        this.data = data;
        this.dims = dims;
      }
    };
    runtime.clearModel();
    runtime.configure({
      enabled: true,
      minLevel: 6,
      sourceUrl: 'data/models/policy-net.onnx',
      metaUrl: 'data/models/policy-net.onnx.meta.json'
    });
  });

  afterEach(() => {
    delete global.ort;
  });

  test('chooseMove returns null without loaded model', async () => {
    const selected = await runtime.chooseMove([{ row: 0, col: 0, flips: [] }], {
      playerKey: 'white',
      level: 6,
      board: [[0]],
      legalMovesCount: 1
    });
    expect(selected).toBeNull();
  });

  test('chooseMove selects move with highest logit among legal candidates', async () => {
    const scores = new Float32Array(64);
    scores[0] = 0.1;  // (0,0)
    scores[9] = 3.2;  // (1,1)
    scores[18] = 2.4; // (2,2)
    runtime.__setLoadedForTest({
      run: jest.fn(async () => ({
        logits: { data: scores }
      }))
    }, {
      schemaVersion: runtime.MODEL_SCHEMA_VERSION,
      inputName: 'obs',
      outputName: 'logits',
      inputDim: 70
    });

    const candidates = [
      { row: 0, col: 0, flips: [] },
      { row: 1, col: 1, flips: [] },
      { row: 2, col: 2, flips: [] }
    ];
    const board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0));
    const selected = await runtime.chooseMove(candidates, {
      playerKey: 'white',
      level: 6,
      board,
      legalMovesCount: candidates.length
    });
    expect(selected).toEqual(candidates[1]);
  });

  test('chooseCard selects highest score among usable cards', async () => {
    const placeScores = new Float32Array(64);
    const cardScores = new Float32Array(3);
    cardScores[0] = 0.3; // card_a
    cardScores[1] = 2.7; // card_b
    cardScores[2] = 1.1; // card_c

    runtime.__setLoadedForTest({
      run: jest.fn(async () => ({
        place_logits: { data: placeScores },
        card_logits: { data: cardScores }
      }))
    }, {
      schemaVersion: runtime.MODEL_SCHEMA_VERSION,
      inputName: 'obs',
      placeOutputName: 'place_logits',
      cardOutputName: 'card_logits',
      inputDim: 76,
      cardActionIds: ['card_a', 'card_b', 'card_c']
    });

    const board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0));
    const selected = await runtime.chooseCard(['card_a', 'card_c', 'card_b'], {
      playerKey: 'white',
      level: 6,
      board,
      legalMovesCount: 4,
      handCardIds: ['card_a', 'card_b'],
      usableCardIds: ['card_a', 'card_c', 'card_b']
    });
    expect(selected).toBe('card_b');
  });
});
