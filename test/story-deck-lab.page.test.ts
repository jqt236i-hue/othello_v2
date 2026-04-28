import * as fs from 'fs';
import * as path from 'path';

describe('story deck lab page', () => {
  test('root page loads base card sizing styles before deck lab layout', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'story-deck-lab.html'), 'utf8');

    const variablesTag = '<link rel="stylesheet" href="styles-variables.css">';
    const baseTag = '<link rel="stylesheet" href="styles-base.css">';
    const layoutTag = '<link rel="stylesheet" href="styles-layout.css">';
    const cardsTag = '<link rel="stylesheet" href="styles-cards.css">';

    expect(html.includes(variablesTag)).toBe(true);
    expect(html.includes(baseTag)).toBe(true);
    expect(html.includes(layoutTag)).toBe(true);
    expect(html.includes(cardsTag)).toBe(true);
    expect(html.indexOf(layoutTag)).toBeGreaterThan(html.indexOf(baseTag));
    expect(html.indexOf(cardsTag)).toBeGreaterThan(html.indexOf(layoutTag));
  });

  test('root page loads story deck lab modules in order', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'story-deck-lab.html'), 'utf8');

    const sharedConstantsTag = '<script src="shared-constants.js"></script>';
    const specTag = '<script src="shared/story-deck-spec.js"></script>';
    const codecTag = '<script src="shared/story-deck-codec.js"></script>';
    const controllerTag = '<script src="ui/story-deck-lab/story-deck-lab-controller.js"></script>';

    expect(html.includes(sharedConstantsTag)).toBe(true);
    expect(html.includes(specTag)).toBe(true);
    expect(html.includes(codecTag)).toBe(true);
    expect(html.includes(controllerTag)).toBe(true);
    expect(html.indexOf(specTag)).toBeGreaterThan(html.indexOf(sharedConstantsTag));
    expect(html.indexOf(codecTag)).toBeGreaterThan(html.indexOf(specTag));
    expect(html.indexOf(controllerTag)).toBeGreaterThan(html.indexOf(codecTag));
  });

  test('worker-public page mirrors story deck lab modules', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'worker-public', 'story-deck-lab.html'), 'utf8');

    expect(html.includes('<link rel="stylesheet" href="styles-variables.css">')).toBe(true);
    expect(html.includes('<link rel="stylesheet" href="styles-base.css">')).toBe(true);
    expect(html.includes('<script src="shared/story-deck-spec.js"></script>')).toBe(true);
    expect(html.includes('<script src="shared/story-deck-codec.js"></script>')).toBe(true);
    expect(html.includes('<script src="ui/story-deck-lab/story-deck-lab-controller.js"></script>')).toBe(true);
  });
});
