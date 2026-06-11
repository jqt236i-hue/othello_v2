const SelfplayPositionWeights = require('../src/engine/selfplay-position-weights.js');
const fs = require('fs');
const path = require('path');

describe('selfplay position weights', () => {
  test('keeps the named selfplay matrix explicit', () => {
    expect(SelfplayPositionWeights.SELFPLAY_POSITION_WEIGHTS).toEqual([
      [120, -20, 20, 5, 5, 20, -20, 120],
      [-20, -40, -5, -5, -5, -5, -40, -20],
      [20, -5, 15, 3, 3, 15, -5, 20],
      [5, -5, 3, 3, 3, 3, -5, 5],
      [5, -5, 3, 3, 3, 3, -5, 5],
      [20, -5, 15, 3, 3, 15, -5, 20],
      [-20, -40, -5, -5, -5, -5, -40, -20],
      [120, -20, 20, 5, 5, 20, -20, 120]
    ]);
  });

  test('src and training selfplay runners share the same named matrix', () => {
    const srcRunner = fs.readFileSync(path.join(__dirname, '..', 'src', 'engine', 'selfplay-runner.ts'), 'utf8');
    const trainingRunner = fs.readFileSync(path.join(__dirname, '..', 'training', 'engine', 'selfplay-runner.ts'), 'utf8');

    expect(srcRunner).toContain("const SelfplayPositionWeights = require('./selfplay-position-weights.js');");
    expect(trainingRunner).toContain("const SelfplayPositionWeights = require('../../src/engine/selfplay-position-weights.js');");
    expect(srcRunner).toContain('const POSITION_WEIGHTS = SelfplayPositionWeights.SELFPLAY_POSITION_WEIGHTS;');
    expect(trainingRunner).toContain('const POSITION_WEIGHTS = SelfplayPositionWeights.SELFPLAY_POSITION_WEIGHTS;');
    expect(srcRunner).not.toContain('const POSITION_WEIGHTS = [');
    expect(trainingRunner).not.toContain('const POSITION_WEIGHTS = [');
  });
});
