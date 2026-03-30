const fs = require('fs');
const path = require('path');

describe('ui bootstrap commentary routing', () => {
  test('bootstrap no longer parses commentary logs to show portrait bubbles', () => {
    const jsPath = path.join(__dirname, '..', 'ui', 'bootstrap.js');
    const js = fs.readFileSync(jsPath, 'utf8');

    expect(js).not.toMatch(/function\s+parsePortraitCommentaryLog\s*\(/);
    expect(js).not.toMatch(/function\s+maybeShowPortraitSpeechFromLog\s*\(/);
    expect(js).not.toMatch(/maybeShowPortraitSpeechFromLog\(/);
  });
});
