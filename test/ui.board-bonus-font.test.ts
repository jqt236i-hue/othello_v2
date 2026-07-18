import { readDomCompatBoardCssSurface } from './helpers/css-test-helpers';

describe('board bonus number typography', () => {
    test('styles-board.css lets board bonus numbers follow the selected app font', () => {
        const css = readDomCompatBoardCssSurface();
        expect(css).toContain('.cell.has-board-bonus .board-bonus-number');
        expect(css).toContain('--board-bonus-number-font-family: var(--selected-app-font-accent-family, var(--selected-app-font-family));');
        expect(css).not.toContain('--board-bonus-number-font-family: "DotGothic16"');
    });
});
