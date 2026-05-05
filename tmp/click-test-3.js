const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto("http://localhost:8080/?debug=1", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);

  // Get cell coordinates and click via mouse
  const cellInfo = await page.evaluate(() => {
    const board = document.getElementById("board");
    const cells = board.querySelectorAll(".cell");
    for (const cell of cells) {
      if (cell.dataset.row === "2" && cell.dataset.col === "3") {
        const rect = cell.getBoundingClientRect();
        return {
          row: cell.dataset.row,
          col: cell.dataset.col,
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
          listeners: null
        };
      }
    }
    return null;
  });
  
  console.log("=== CELL INFO ===");
  console.log(JSON.stringify(cellInfo));
  
  // Mouse click
  if (cellInfo) {
    await page.mouse.click(cellInfo.x, cellInfo.y);
    await page.waitForTimeout(2000);
    
    const afterState = await page.evaluate(() => ({
      turnNumber: gameState?.turnNumber,
      currentPlayer: gameState?.currentPlayer,
      boardCell23: gameState?.board?.[2]?.[3],
      boardCell33: gameState?.board?.[3]?.[3],
      boardCell43: gameState?.board?.[4]?.[3],
    }));
    console.log("=== AFTER MOUSE CLICK ===");
    console.log(JSON.stringify(afterState));
  }
  
  // Also check if handleCellClick exists and if event listeners are attached
  const bindings = await page.evaluate(() => {
    const board = document.getElementById("board");
    const boardClone = board.cloneNode(false);
    // Get event listeners if available via Chrome DevTools protocol
    return {
      hasHandleCellClick: typeof handleCellClick === "function",
      handleCellClickLength: typeof handleCellClick === "function" ? handleCellClick.toString().length : 0,
    };
  });
  console.log("=== BINDINGS ===");
  console.log(JSON.stringify(bindings));
  
  await browser.close();
})();
