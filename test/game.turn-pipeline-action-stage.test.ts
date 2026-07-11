import * as fs from 'fs';
import * as path from 'path';

describe('turn pipeline action stages', () => {
  test('keeps place action dispatch separate from selection and placement-resolution stages', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '..', 'game', 'turn', 'turn_pipeline_phases.ts'), 'utf8');
    const actionPhaseSource = source.slice(source.indexOf('function applyActionPhase'));

    expect(source).toContain('function applyPrePlacementSelectionStage(');
    expect(source).toContain('function applyPlacementResolutionStage(');
    expect(actionPhaseSource).toContain('if (applyPrePlacementSelectionStage(ctx, presentationStartIndex)) {');
    expect(actionPhaseSource).toContain('if (applyPlacementResolutionStage(ctx)) {');
    expect(actionPhaseSource).not.toContain('ActionPhasePlaceResolutionModule.resolvePlacementAction({');
  });
});
