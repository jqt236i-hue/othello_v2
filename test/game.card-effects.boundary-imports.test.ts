const fs = require('fs');
const path = require('path');

describe('game/card-effects boundary imports', () => {
    test('protection-state stays independent from browser globals and card-system', () => {
        const source = fs.readFileSync(
            path.resolve(__dirname, '../game/card-effects/protection-state.ts'),
            'utf8'
        );

        expect(source).not.toMatch(/card-system/);
        expect(source).not.toMatch(/\bwindow\b/);
        expect(source).not.toMatch(/\bdocument\b/);
        expect(source).not.toMatch(/\bglobalThis\b/);
    });
});
