jest.mock('../othello-ai/core/board', () => ({}), { virtual: true });
jest.mock('../othello-ai/runtime/engine', () => ({}), { virtual: true });
jest.mock('../othello-ai/eval/value-table', () => ({}), { virtual: true });

const { parseArgs, summarizeGames } = require('../scripts/evaluate-othello-onnx');

describe('evaluate-othello-onnx args', () => {
  test('defaults full-game evaluation to browser runtime chooseMove path', () => {
    const args = parseArgs([]);

    expect(args.onnxValueRerank).toBe(true);
    expect(args.onnxFullSearchRerank).toBe(false);
  });

  test('can opt into legacy exhaustive value-only rerank path', () => {
    const args = parseArgs(['--onnx-full-search-rerank']);

    expect(args.onnxFullSearchRerank).toBe(true);
  });

  test('summarizes ONNX black and white results separately', () => {
    const summary = summarizeGames([
      {
        winner: 'onnx',
        blackAgentId: 'onnx',
        whiteAgentId: 'baseline',
        discDiffFromOnnx: 12
      },
      {
        winner: 'draw',
        blackAgentId: 'baseline',
        whiteAgentId: 'onnx',
        discDiffFromOnnx: 0
      },
      {
        winner: 'baseline',
        blackAgentId: 'onnx',
        whiteAgentId: 'baseline',
        discDiffFromOnnx: -4
      },
      {
        winner: 'onnx',
        blackAgentId: 'baseline',
        whiteAgentId: 'onnx',
        discDiffFromOnnx: 8
      }
    ]);

    expect(summary.onnxBlackGames).toBe(2);
    expect(summary.onnxBlackPointRate).toBe(0.5);
    expect(summary.averageBlackDiscDiffFromOnnx).toBe(4);
    expect(summary.onnxWhiteGames).toBe(2);
    expect(summary.onnxWhitePointRate).toBe(0.75);
    expect(summary.averageWhiteDiscDiffFromOnnx).toBe(4);
  });
});
