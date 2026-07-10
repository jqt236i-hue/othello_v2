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

  test('training selfplay runner paths delegate to the canonical src runner', () => {
    const rootRunner = require(path.join(__dirname, '..', 'src', 'engine', 'selfplay-runner'));
    const trainingRunnerModule = require(path.join(__dirname, '..', 'training', 'engine', 'selfplay-runner'));
    const srcRunner = fs.readFileSync(path.join(__dirname, '..', 'src', 'engine', 'selfplay-runner.ts'), 'utf8');
    const trainingRunnerTs = fs.readFileSync(path.join(__dirname, '..', 'training', 'engine', 'selfplay-runner.ts'), 'utf8');
    const trainingRunnerJs = fs.readFileSync(path.join(__dirname, '..', 'training', 'engine', 'selfplay-runner.js'), 'utf8');

    expect(srcRunner).toContain("const SelfplayPositionWeights = require('./selfplay-position-weights.js');");
    expect(srcRunner).toContain('const POSITION_WEIGHTS = SelfplayPositionWeights.SELFPLAY_POSITION_WEIGHTS;');
    expect(srcRunner).not.toContain('const POSITION_WEIGHTS = [');

    expect(trainingRunnerTs).toContain("_require('../../src/engine/selfplay-runner')");
    expect(trainingRunnerTs).toContain('export = runner;');
    expect(trainingRunnerTs).not.toContain('function runSelfPlayGames');
    expect(trainingRunnerTs).not.toContain('const POSITION_WEIGHTS = SelfplayPositionWeights.SELFPLAY_POSITION_WEIGHTS;');
    expect(trainingRunnerTs.split(/\r?\n/).filter((line) => line.trim().length > 0).length).toBeLessThanOrEqual(12);

    expect(trainingRunnerJs).toContain('module.exports = require("../../src/engine/selfplay-runner.js");');
    expect(trainingRunnerModule).toBe(rootRunner);
  });
});
