const fs = require('fs');
const path = require('path');

function assertSniperScriptOrder(html, targetLabel) {
  const sniperTag = '<script src="game/logic/cards/sniper.js"></script>';
  const lightningTag = '<script src="game/logic/cards/lightning.js"></script>';
  const destroyDragonTag = '<script src="game/logic/cards/destroy_dragon.js"></script>';
  const cardsTag = '<script src="game/logic/cards.js"></script>';
  const sniperIndex = html.indexOf(sniperTag);
  const lightningIndex = html.indexOf(lightningTag);
  const destroyDragonIndex = html.indexOf(destroyDragonTag);
  const cardsIndex = html.indexOf(cardsTag);

  expect(sniperIndex).toBeGreaterThanOrEqual(0);
  expect(lightningIndex).toBeGreaterThanOrEqual(0);
  expect(destroyDragonIndex).toBeGreaterThanOrEqual(0);
  expect(cardsIndex).toBeGreaterThanOrEqual(0);
  expect(sniperIndex).toBeLessThan(cardsIndex);
  expect(lightningIndex).toBeLessThan(cardsIndex);
  expect(destroyDragonIndex).toBeLessThan(cardsIndex);

  if (sniperIndex < 0 || lightningIndex < 0 || destroyDragonIndex < 0 || cardsIndex < 0 || sniperIndex >= cardsIndex || lightningIndex >= cardsIndex || destroyDragonIndex >= cardsIndex) {
    throw new Error(`${targetLabel}: sniper.js load order is invalid`);
  }
}

describe('sniper module load order', () => {
  test('index.html loads sniper.js before cards.js', () => {
    const htmlPath = path.join(__dirname, '..', 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    assertSniperScriptOrder(html, 'index.html');
  });

  test('worker-public/index.html loads sniper.js before cards.js', () => {
    const htmlPath = path.join(__dirname, '..', 'worker-public', 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    assertSniperScriptOrder(html, 'worker-public/index.html');
  });
});
