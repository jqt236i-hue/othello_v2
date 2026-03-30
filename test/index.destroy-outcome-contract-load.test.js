const fs = require('fs');
const path = require('path');

function expectDestroyOutcomeContractOrder(htmlPath, label) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const contractTag = '<script src="shared/destroy-outcome-contract.js"></script>';
  const boardOpsTag = '<script src="game/logic/board_ops.js"></script>';
  const cardsTag = '<script src="game/logic/cards.js"></script>';

  expect(html.includes(contractTag)).toBe(true);
  expect(html.includes(boardOpsTag)).toBe(true);
  expect(html.includes(cardsTag)).toBe(true);
  expect(html.indexOf(contractTag)).toBeGreaterThan(-1);
  expect(html.indexOf(contractTag)).toBeLessThan(html.indexOf(boardOpsTag));
  expect(html.indexOf(contractTag)).toBeLessThan(html.indexOf(cardsTag));
}

describe('destroy outcome contract script load order', () => {
  test('index.html loads shared destroy outcome contract before board ops and cards', () => {
    expectDestroyOutcomeContractOrder(path.resolve(__dirname, '../index.html'), 'index.html');
  });

  test('worker-public/index.html loads shared destroy outcome contract before board ops and cards', () => {
    expectDestroyOutcomeContractOrder(path.resolve(__dirname, '../worker-public/index.html'), 'worker-public/index.html');
  });
});
