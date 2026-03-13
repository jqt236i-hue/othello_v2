const fs = require('fs');
const path = require('path');

function expectCardInternalModulesLoadedBeforeCards(html, rootPath) {
  const selectorsTag = '<script src="game/logic/cards/selectors.js"></script>';
  const prechecksTag = '<script src="game/logic/cards-internal/card-usage-prechecks.js"></script>';
  const orchestratorTag = '<script src="game/logic/cards-internal/selector-orchestrator.js"></script>';
  const handManagerTag = '<script src="game/logic/cards-internal/hand-manager.js"></script>';
  const effectTimingTag = '<script src="game/logic/cards-internal/effect-timing.js"></script>';
  const cardsTag = '<script src="game/logic/cards.js"></script>';

  expect(html.includes(selectorsTag)).toBe(true);
  expect(html.includes(prechecksTag)).toBe(true);
  expect(html.includes(orchestratorTag)).toBe(true);
  expect(html.includes(handManagerTag)).toBe(true);
  expect(html.includes(effectTimingTag)).toBe(true);
  expect(html.indexOf(prechecksTag)).toBeGreaterThan(html.indexOf(selectorsTag));
  expect(html.indexOf(orchestratorTag)).toBeGreaterThan(html.indexOf(prechecksTag));
  expect(html.indexOf(handManagerTag)).toBeGreaterThan(html.indexOf(orchestratorTag));
  expect(html.indexOf(effectTimingTag)).toBeGreaterThan(html.indexOf(handManagerTag));
  expect(html.indexOf(cardsTag)).toBeGreaterThan(html.indexOf(effectTimingTag));
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'game/logic/cards-internal/card-usage-prechecks.js'))).toBe(true);
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'game/logic/cards-internal/selector-orchestrator.js'))).toBe(true);
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'game/logic/cards-internal/hand-manager.js'))).toBe(true);
  expect(fs.existsSync(path.resolve(__dirname, rootPath, 'game/logic/cards-internal/effect-timing.js'))).toBe(true);
}

describe('card module script includes', () => {
  test('index.html loads will_hunter_king card module before cards.js', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    const moduleTag = '<script src="game/logic/cards/will_hunter_king.js"></script>';
    const cardsTag = '<script src="game/logic/cards.js"></script>';

    expect(html.includes(moduleTag)).toBe(true);
    expect(html.indexOf(moduleTag)).toBeGreaterThan(-1);
    expect(html.indexOf(cardsTag)).toBeGreaterThan(html.indexOf(moduleTag));
  });

  test('index.html loads card internal modules before cards.js', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    expectCardInternalModulesLoadedBeforeCards(html, '../');
  });

  test('index.html loads markers card module before cards.js', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    const moduleTag = '<script src="game/logic/cards/markers.js"></script>';
    const cardsTag = '<script src="game/logic/cards.js"></script>';

    expect(html.includes(moduleTag)).toBe(true);
    expect(html.indexOf(cardsTag)).toBeGreaterThan(html.indexOf(moduleTag));
    expect(fs.existsSync(path.resolve(__dirname, '../game/logic/cards/markers.js'))).toBe(true);
  });

  test('index.html loads freeze card effect script', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    const moduleTag = '<script src="game/card-effects/freeze.js"></script>';

    expect(html.includes(moduleTag)).toBe(true);
    expect(fs.existsSync(path.resolve(__dirname, '../game/card-effects/freeze.js'))).toBe(true);
  });

  test('worker-public/index.html loads will_hunter_king card module before cards.js', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../worker-public/index.html'), 'utf8');
    const moduleTag = '<script src="game/logic/cards/will_hunter_king.js"></script>';
    const cardsTag = '<script src="game/logic/cards.js"></script>';

    expect(html.includes(moduleTag)).toBe(true);
    expect(html.indexOf(moduleTag)).toBeGreaterThan(-1);
    expect(html.indexOf(cardsTag)).toBeGreaterThan(html.indexOf(moduleTag));
  });

  test('worker-public/index.html loads card internal modules before cards.js', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../worker-public/index.html'), 'utf8');
    expectCardInternalModulesLoadedBeforeCards(html, '../worker-public');
  });

  test('worker-public/index.html loads markers card module before cards.js', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../worker-public/index.html'), 'utf8');
    const moduleTag = '<script src="game/logic/cards/markers.js"></script>';
    const cardsTag = '<script src="game/logic/cards.js"></script>';

    expect(html.includes(moduleTag)).toBe(true);
    expect(html.indexOf(cardsTag)).toBeGreaterThan(html.indexOf(moduleTag));
    expect(fs.existsSync(path.resolve(__dirname, '../worker-public/game/logic/cards/markers.js'))).toBe(true);
  });

  test('worker-public/index.html loads freeze card effect script', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../worker-public/index.html'), 'utf8');
    const moduleTag = '<script src="game/card-effects/freeze.js"></script>';

    expect(html.includes(moduleTag)).toBe(true);
    expect(fs.existsSync(path.resolve(__dirname, '../worker-public/game/card-effects/freeze.js'))).toBe(true);
  });

  test('index.html loads deck builder shared scripts before deck builder handler', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    const deckSpecTag = '<script src="shared/deck-spec.js"></script>';
    const deckCodecTag = '<script src="shared/deck-codec.js"></script>';
    const controllerTag = '<script src="ui/deck-builder-controller.js"></script>';
    const handlerTag = '<script src="ui/handlers/deck-builder.js"></script>';

    expect(html.includes(deckSpecTag)).toBe(true);
    expect(html.includes(deckCodecTag)).toBe(true);
    expect(html.includes(controllerTag)).toBe(true);
    expect(html.includes(handlerTag)).toBe(true);
    expect(html.indexOf(deckSpecTag)).toBeGreaterThan(-1);
    expect(html.indexOf(deckCodecTag)).toBeGreaterThan(html.indexOf(deckSpecTag));
    expect(html.indexOf(controllerTag)).toBeGreaterThan(html.indexOf(deckCodecTag));
    expect(html.indexOf(handlerTag)).toBeGreaterThan(html.indexOf(controllerTag));
  });

  test('worker-public/index.html loads deck builder shared scripts before deck builder handler', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../worker-public/index.html'), 'utf8');
    const deckSpecTag = '<script src="shared/deck-spec.js"></script>';
    const deckCodecTag = '<script src="shared/deck-codec.js"></script>';
    const controllerTag = '<script src="ui/deck-builder-controller.js"></script>';
    const handlerTag = '<script src="ui/handlers/deck-builder.js"></script>';

    expect(html.includes(deckSpecTag)).toBe(true);
    expect(html.includes(deckCodecTag)).toBe(true);
    expect(html.includes(controllerTag)).toBe(true);
    expect(html.includes(handlerTag)).toBe(true);
    expect(html.indexOf(deckSpecTag)).toBeGreaterThan(-1);
    expect(html.indexOf(deckCodecTag)).toBeGreaterThan(html.indexOf(deckSpecTag));
    expect(html.indexOf(controllerTag)).toBeGreaterThan(html.indexOf(deckCodecTag));
    expect(html.indexOf(handlerTag)).toBeGreaterThan(html.indexOf(controllerTag));
  });
});
