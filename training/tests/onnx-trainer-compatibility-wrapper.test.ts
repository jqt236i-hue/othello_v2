import * as fs from 'fs';
import * as path from 'path';

const PYTHON_ROOT = path.resolve(__dirname, '..', 'python');

function readPython(fileName: string) {
    return fs.readFileSync(path.join(PYTHON_ROOT, fileName), 'utf8');
}

function countDefinitions(source: string, functionName: string) {
    return (source.match(new RegExp(`^def ${functionName}\\(`, 'gm')) || []).length;
}

describe('CNN trainer compatibility wrappers', () => {
    test('keeps dataset, training, and ONNX implementation in one shared core', () => {
        const core = readPython('policy_trainer_cnn.py');

        expect(countDefinitions(core, 'parse_args')).toBe(1);
        expect(countDefinitions(core, 'load_dataset')).toBe(1);
        expect(countDefinitions(core, 'train_model')).toBe(1);
        expect(countDefinitions(core, 'export_onnx')).toBe(1);
        expect(core).toContain('V2_COMPATIBILITY_PROFILE');
        expect(core).toContain('V3_COMPATIBILITY_PROFILE');
        expect(core).toContain('profile.supports_board_history');
    });

    test.each([
        ['train_policy_onnx_v2.py', 'V2_COMPATIBILITY_PROFILE'],
        ['train_policy_onnx_v3.py', 'V3_COMPATIBILITY_PROFILE']
    ])('%s delegates to its immutable compatibility profile', (fileName, profileName) => {
        const wrapper = readPython(fileName);

        expect(wrapper).toContain(`from policy_trainer_cnn import ${profileName}, run_cli`);
        expect(wrapper).toContain(`return run_cli(${profileName})`);
        expect(countDefinitions(wrapper, 'load_dataset')).toBe(0);
        expect(countDefinitions(wrapper, 'train_model')).toBe(0);
        expect(countDefinitions(wrapper, 'export_onnx')).toBe(0);
    });
});
