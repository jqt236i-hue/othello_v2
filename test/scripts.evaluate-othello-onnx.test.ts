jest.mock('../othello-ai/core/board', () => ({}), { virtual: true });
jest.mock('../othello-ai/runtime/engine', () => ({}), { virtual: true });
jest.mock('../othello-ai/eval/value-table', () => ({}), { virtual: true });

const { parseArgs } = require('../scripts/evaluate-othello-onnx');

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
});
