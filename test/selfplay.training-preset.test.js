const {
    parseArgs,
    buildPresetArgs
} = require('../scripts/run-selfplay-training-preset');

describe('selfplay training preset script', () => {
    test('parseArgs keeps pass-through arguments', () => {
        const args = parseArgs(['--profile', 'cards_v1', '--max-hours', '8', '--seed', '1001']);
        expect(args.profile).toBe('cards_v1');
        expect(args.passThrough).toEqual(['--max-hours', '8', '--seed', '1001']);
    });

    test('buildPresetArgs returns card-focused defaults', () => {
        const preset = buildPresetArgs('cards_v1');
        expect(preset).toContain('--max-hours');
        expect(preset).toContain('24');
        expect(preset).toContain('--card-usage-rate');
        expect(preset).toContain('0.40');
        expect(preset).toContain('--onnx-epochs');
        expect(preset).toContain('9999');
        expect(preset).toContain('--onnx-early-stop-patience');
        expect(preset).toContain('6');
        expect(preset).toContain('--adoption-seed-count');
        expect(preset).toContain('3');
        expect(preset).toContain('--adoption-final-seed-offset');
        expect(preset).toContain('--onnx-gate');
        expect(preset).toContain('--onnx-gate-min-seed-pass-count');
    });

    test('buildPresetArgs throws on unknown profile', () => {
        expect(() => buildPresetArgs('unknown')).toThrow('unknown --profile');
    });
});
