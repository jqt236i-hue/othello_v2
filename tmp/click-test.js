const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const errors = [];
  page.on("pageerror", err => errors.push({ text: err.message, stack: err.stack }));
  page.on("console", msg => {
    if (msg.type() === "error") errors.push({ text: msg.text() });
  });
  
  await page.goto("http://localhost:8080/?debug=1", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);

  // Try clicking on a known valid move cell (2,3) - this IS a valid move
  const cellClickResult = await page.evaluate(() => {
    const board = document.getElementById("board");
    const cells = board.querySelectorAll(".cell");
    // Click cell at row=2, col=3 (known valid move from getLegalMovesBasic)
    let targetCell = null;
    for (const cell of cells) {
      if (cell.dataset.row === "2" && cell.dataset.col === "3") {
        targetCell = cell;
        break;
      }
    }
    if (!targetCell) return { error: "target cell not found" };
    
    // Try clicking via click() method
    try {
      targetCell.click();
      return { clicked: true, row: targetCell.dataset.row, col: targetCell.dataset.col };
    } catch(e) {
      return { clicked: false, error: e.message };
    }
  });
  console.log("=== CELL CLICK (2,3) ===");
  console.log(JSON.stringify(cellClickResult, null, 2));
  
  await page.waitForTimeout(1000);
  
  // Check state after click
  const afterClick = await page.evaluate(() => ({
    turnNumber: gameState?.turnNumber,
    currentPlayer: gameState?.currentPlayer,
    errors: errors.length
  }));
  console.log("=== AFTER CLICK STATE ===");
  console.log(JSON.stringify(afterClick, null, 2));
  
  // Check the renderBoard source to see how valid moves are computed
  const renderBoardSource = await page.evaluate(() => {
    if (typeof renderBoard === "function") {
      return renderBoard.toString().substring(0, 2000);
    }
    return "renderBoard not found";
  });
  console.log("=== RENDERBOARD SOURCE (partial) ===");
  console.log(renderBoardSource);
  
  console.log("=== ERRORS DURING TEST ===");
  console.log(JSON.stringify(errors, null, 2));
  
  await browser.close();
})();
