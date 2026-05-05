const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto("http://localhost:8080/?debug=1", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);

  // Click on valid move cell (2,3)
  const beforeState = await page.evaluate(() => ({
    turnNumber: gameState?.turnNumber,
    currentPlayer: gameState?.currentPlayer,
  }));
  console.log("=== BEFORE CLICK ===");
  console.log(JSON.stringify(beforeState));
  
  await page.evaluate(() => {
    const board = document.getElementById("board");
    const cells = board.querySelectorAll(".cell");
    for (const cell of cells) {
      if (cell.dataset.row === "2" && cell.dataset.col === "3") {
        cell.click();
        return;
      }
    }
  });
  await page.waitForTimeout(2000);
  
  const afterState = await page.evaluate(() => ({
    turnNumber: gameState?.turnNumber,
    currentPlayer: gameState?.currentPlayer,
    consecutivePasses: gameState?.consecutivePasses,
    isProcessing: typeof isProcessing !== "undefined" ? isProcessing : "N/A",
    isCardAnimating: typeof isCardAnimating !== "undefined" ? isCardAnimating : "N/A",
  }));
  console.log("=== AFTER CLICK ===");
  console.log(JSON.stringify(afterState));
  
  await browser.close();
})();
