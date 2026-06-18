import * as path from 'path';

const mctsTemperature = require(path.resolve(__dirname, '..', 'game', 'ai', 'mcts-temperature.ts'));

describe('MCTS temperature RNG injection', () => {
  test('DiversityConfig uses injected rng for branch details', () => {
    const values = [0.25, 0.5, 0.99];
    const rng = { random: jest.fn(() => values.shift() ?? 0.5) };
    const mathSpy = jest.spyOn(Math, 'random').mockReturnValue(0.123456);
    try {
      const config = new mctsTemperature.DiversityConfig({ rng });
      config.gameBranchingRate = 1;
      config.branchingMovesMin = 3;
      config.branchingMovesMax = 5;

      const result = config.maybeBranchGame(1);

      expect(result).toEqual({
        branchPoint: 5,
        numBranchMoves: 4,
        temp: Infinity,
      });
      expect(rng.random).toHaveBeenCalledTimes(3);
      expect(mathSpy).not.toHaveBeenCalled();
    } finally {
      mathSpy.mockRestore();
    }
  });

  test('MCTSTemperatureManager passes injected rng to diversity config', () => {
    const rng = { random: jest.fn(() => 0.1) };
    const mathSpy = jest.spyOn(Math, 'random').mockReturnValue(0.123456);
    try {
      const manager = new mctsTemperature.MCTSTemperatureManager({ rng });
      manager.diversity.gameBranchingRate = 1;

      const result = manager.maybeBranchGame(7);

      expect(result).not.toBeNull();
      expect(rng.random).toHaveBeenCalled();
      expect(mathSpy).not.toHaveBeenCalled();
    } finally {
      mathSpy.mockRestore();
    }
  });
});
