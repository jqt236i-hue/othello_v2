import * as fs from 'fs';
import * as path from 'path';

describe('board bonus number typography', () => {
    test('styles-board.css keeps board bonus numbers on the dot font regardless of selected app font', () => {
        const css = fs.readFileSync(path.join(__dirname, '..', 'styles-board.css'), 'utf8');
        expect(css).toContain('.cell.has-board-bonus .board-bonus-number');
        expect(css).toContain('font-family: "DotGothic16", "MS Gothic", "Osaka-Mono", monospace;');
    });
});
