import * as fs from 'fs';
import * as path from 'path';

describe('board bonus number typography', () => {
    test('styles-board.css lets board bonus numbers follow the selected app font', () => {
        const css = fs.readFileSync(path.join(__dirname, '..', 'styles-board.css'), 'utf8');
        expect(css).toContain('.cell.has-board-bonus .board-bonus-number');
        expect(css).toContain('--board-bonus-number-font-family: var(--selected-app-font-accent-family, var(--selected-app-font-family));');
        expect(css).not.toContain('--board-bonus-number-font-family: "DotGothic16"');
    });
});
