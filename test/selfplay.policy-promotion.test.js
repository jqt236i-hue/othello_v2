const fs = require('fs');
const path = require('path');
const {
    parseArgs,
    promoteModel
} = require('../scripts/promote-policy-model');

describe('selfplay policy promotion', () => {
    test('parseArgs requires adoption/candidate paths', () => {
        expect(() => parseArgs([])).toThrow('--adoption-result is required');
        expect(() => parseArgs(['--adoption-result', 'x.json'])).toThrow('--candidate-model is required');
    });

    test('promoteModel blocks when adoption decision is not passed', () => {
        const dir = path.resolve(__dirname, '..', 'data', 'models');
        fs.mkdirSync(dir, { recursive: true });
        const adoption = path.join(dir, 'adoption.block.test.json');
        const candidate = path.join(dir, 'candidate.block.test.json');
        fs.writeFileSync(adoption, JSON.stringify({ decision: { passed: false } }), 'utf8');
        fs.writeFileSync(candidate, JSON.stringify({ schemaVersion: 'policy_table.v1', states: {} }), 'utf8');

        expect(() => promoteModel({
            adoptionResultPath: adoption,
            candidateModelPath: candidate,
            targetModelPath: path.join(dir, 'target.block.test.json'),
            force: false
        })).toThrow('adoption decision is not passed');

        fs.unlinkSync(adoption);
        fs.unlinkSync(candidate);
    });

    test('promoteModel copies candidate when passed', () => {
        const dir = path.resolve(__dirname, '..', 'data', 'models');
        fs.mkdirSync(dir, { recursive: true });
        const adoption = path.join(dir, 'adoption.pass.test.json');
        const candidate = path.join(dir, 'candidate.pass.test.json');
        const target = path.join(dir, 'target.pass.test.json');
        const payload = { schemaVersion: 'policy_table.v1', states: { k: { bestAction: 'place:0:0', actions: {} } } };
        fs.writeFileSync(adoption, JSON.stringify({ decision: { passed: true } }), 'utf8');
        fs.writeFileSync(candidate, JSON.stringify(payload), 'utf8');

        const out = promoteModel({
            adoptionResultPath: adoption,
            candidateModelPath: candidate,
            targetModelPath: target,
            force: false
        });
        expect(out.targetModelPath).toBe(target);
        const copied = JSON.parse(fs.readFileSync(target, 'utf8'));
        expect(copied).toEqual(payload);

        fs.unlinkSync(adoption);
        fs.unlinkSync(candidate);
        fs.unlinkSync(target);
    });
});
