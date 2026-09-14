import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import TrainingBuild = require('../scripts/build-training-cli');

test('checks external shared imports while emitting only owned CLI entries with accurate source maps', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'training-cli-build-'));
    try {
        fs.mkdirSync(path.join(root, 'training/scripts'), { recursive: true });
        fs.mkdirSync(path.join(root, 'shared'));
        fs.mkdirSync(path.join(root, 'dist/scripts'), { recursive: true });
        fs.writeFileSync(path.join(root, 'shared/value.ts'), 'export const value = 7;');
        fs.writeFileSync(path.join(root, 'training/scripts/entry.ts'), "import { value } from '../../shared/value'; export const result = value;");
        const config = path.join(root, 'tsconfig.json');
        fs.writeFileSync(config, JSON.stringify({ compilerOptions: {
            target: 'ES2022', module: 'commonjs', types: [], skipLibCheck: true,
            rootDir: './training/scripts', outDir: './dist/scripts', sourceMap: true
        }, include: ['training/scripts/*.ts'] }));
        expect(TrainingBuild.emitTrainingScripts(config)).toHaveLength(1);
        const script = path.join(root, 'dist/scripts/entry.js');
        expect(fs.readFileSync(script, 'utf8')).toContain('../../shared/value');
        const map = JSON.parse(fs.readFileSync(script + '.map', 'utf8'));
        expect(path.resolve(path.dirname(script), map.sources[0])).toBe(path.join(root, 'training/scripts/entry.ts'));
        expect(fs.existsSync(path.join(root, 'shared/value.js'))).toBe(false);
        expect(fs.existsSync(path.join(root, 'dist/shared/value.js'))).toBe(false);
    } finally {
        if (path.dirname(path.resolve(root)) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith('training-cli-build-')) throw new Error('unexpected test workspace');
        fs.rmSync(root, { recursive: true, force: true });
    }
});
