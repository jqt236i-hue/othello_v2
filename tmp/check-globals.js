const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("http://localhost:8080/?debug=1", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);
  
  const globals = await page.evaluate(() => ({
    hasHandleCellClick: typeof handleCellClick !== "undefined",
    handleCellClickType: typeof handleCellClick,
    hasAttachBoardCellInteraction: typeof attachBoardCellInteraction !== "undefined",
    attachBoardCellInteractionType: typeof attachBoardCellInteraction,
    hasFindMoveForCell: typeof findMoveForCell !== "undefined",
    hasExecuteMove: typeof executeMove !== "undefined",
    hasIsAnimationInProgress: typeof isAnimationInProgress !== "undefined",
    hasCanLocalUserOperateCurrentTurn: typeof canLocalUserOperateCurrentTurn !== "undefined",
    windowHandleCellClick: typeof window.handleCellClick !== "undefined",
    windowResetGame: typeof window.resetGame !== "undefined",
    gameStateCurrentPlayer: typeof gameState !== "undefined" ? gameState.currentPlayer : "no gameState",
    isProcessing: typeof isProcessing !== "undefined" ? isProcessing : "no isProcessing",
    isCardAnimating: typeof isCardAnimating !== "undefined" ? isCardAnimating : "no isCardAnimating",
    autoModeActive: typeof AUTO_MODE_ACTIVE !== "undefined" ? AUTO_MODE_ACTIVE : "undefined",
  }));
  console.log(JSON.stringify(globals, null, 2));
  
  await browser.close();
})();
