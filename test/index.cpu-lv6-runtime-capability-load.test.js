const fs = require('fs');
const path = require('path');

function expectCpuLv6RuntimeCapabilityOrder(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const profileTag = '<script src="constants/cpu-lv6-shared-profile.js"></script>';
  const capabilityTag = '<script src="shared/cpu-lv6-runtime-capability.js"></script>';
  const decisionTag = '<script src="game/cpu-decision.js"></script>';
  const turnHandlerTag = '<script src="game/cpu-turn-handler.js"></script>';

  expect(html.includes(profileTag)).toBe(true);
  expect(html.includes(capabilityTag)).toBe(true);
  expect(html.includes(decisionTag)).toBe(true);
  expect(html.includes(turnHandlerTag)).toBe(true);
  expect(html.indexOf(profileTag)).toBeLessThan(html.indexOf(capabilityTag));
  expect(html.indexOf(capabilityTag)).toBeLessThan(html.indexOf(decisionTag));
  expect(html.indexOf(capabilityTag)).toBeLessThan(html.indexOf(turnHandlerTag));
}

describe('cpu lv6 runtime capability script load order', () => {
  test('index.html loads runtime capability helper before CPU decision modules', () => {
    expectCpuLv6RuntimeCapabilityOrder(path.resolve(__dirname, '..', 'index.html'));
  });

  test('worker-public/index.html loads runtime capability helper before CPU decision modules', () => {
    expectCpuLv6RuntimeCapabilityOrder(path.resolve(__dirname, '..', 'worker-public', 'index.html'));
  });
});
