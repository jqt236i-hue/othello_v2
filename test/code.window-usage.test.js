const child = require('child_process');

describe('static window usage check', () => {
    test('no forbidden window usage in non-UI files', () => {
        const res = child.spawnSync(process.execPath, ['scripts/check-window-usage.js'], { encoding: 'utf8' });
        if (res.status !== 0) {
            console.error(res.stdout || '', res.stderr || '');
        }
        expect(res.status).toBe(0);
    });
});
