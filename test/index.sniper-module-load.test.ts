import * as fs from 'fs';
import * as path from 'path';

function assertSniperScriptOrder(html, targetLabel) {
  const randomSourceTag = '<script src="game/logic/cards-internal/random-source.js"></script>';
  const sniperTag = '<script src="game/logic/cards/sniper.js"></script>';
  const lightningTag = '<script src="game/logic/cards/lightning.js"></script>';
  const destroyDragonTag = '<script src="game/logic/cards/destroy_dragon.js"></script>';
  const cardsTag = '<script src="game/logic/cards.js"></script>';
  const randomSourceIndex = html.indexOf(randomSourceTag);
  const sniperIndex = html.indexOf(sniperTag);
  const lightningIndex = html.indexOf(lightningTag);
  const destroyDragonIndex = html.indexOf(destroyDragonTag);
  const cardsIndex = html.indexOf(cardsTag);

  expect(randomSourceIndex).toBeGreaterThanOrEqual(0);
  expect(sniperIndex).toBeGreaterThanOrEqual(0);
  expect(lightningIndex).toBeGreaterThanOrEqual(0);
  expect(destroyDragonIndex).toBeGreaterThanOrEqual(0);
  expect(cardsIndex).toBeGreaterThanOrEqual(0);
  expect(randomSourceIndex).toBeLessThan(sniperIndex);
  expect(randomSourceIndex).toBeLessThan(lightningIndex);
  expect(randomSourceIndex).toBeLessThan(destroyDragonIndex);
  expect(sniperIndex).toBeLessThan(cardsIndex);
  expect(lightningIndex).toBeLessThan(cardsIndex);
  expect(destroyDragonIndex).toBeLessThan(cardsIndex);

  if (randomSourceIndex < 0 || sniperIndex < 0 || lightningIndex < 0 || destroyDragonIndex < 0 || cardsIndex < 0 || randomSourceIndex >= sniperIndex || randomSourceIndex >= lightningIndex || randomSourceIndex >= destroyDragonIndex || sniperIndex >= cardsIndex || lightningIndex >= cardsIndex || destroyDragonIndex >= cardsIndex) {
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
