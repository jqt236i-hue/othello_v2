const fs = require('fs');
const path = require('path');

describe('status-display portrait commentary bubbles', () => {
  test('showPortraitSpeechBubble only resets the same speaker role', () => {
    const jsPath = path.join(__dirname, '..', 'ui', 'status-display.js');
    const js = fs.readFileSync(jsPath, 'utf8');

    expect(js).toMatch(/function\s+showPortraitSpeechBubble[\s\S]*hidePortraitSpeechBubble\(config\.role\);/);
    expect(js).not.toMatch(/function\s+showPortraitSpeechBubble[\s\S]*hidePortraitSpeechBubble\(\);/);
  });
});
