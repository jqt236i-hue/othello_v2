const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", err => errors.push(err.message));
  page.on("console", msg => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  
  await page.goto("http://localhost:8080/?debug=1", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);

  const results = await page.evaluate(() => {
    const out = {};
    
    // 1. Test findMoveForCell directly
    try {
      const protection = typeof getActiveProtectionForPlayer === "function" 
        ? getActiveProtectionForPlayer(gameState.currentPlayer) : [];
      const perma = typeof getFlipBlockers === "function" 
        ? getFlipBlockers() : [];
      const move = findMoveForCell(gameState.currentPlayer, 2, 3, null, protection, perma);
      out.findMoveForCell = move ? { 
        found: true, 
        row: move.row, 
        col: move.col, 
        flipsCount: move.flips?.length 
      } : { found: false, moveIsNull: true };
    } catch(e) {
      out.findMoveForCell = { error: e.message, stack: e.stack };
    }
    
    // 2. Test handleCellClick directly
    try {
      const beforeTurn = gameState.turnNumber;
      handleCellClick(2, 3);
      out.handleCellClick = { 
        called: true, 
        turnBefore: beforeTurn, 
        turnAfter: gameState.turnNumber,
        boardChanged: gameState.turnNumber !== beforeTurn
      };
    } catch(e) {
      out.handleCellClick = { error: e.message, stack: e.stack };
    }
    
    // 3. Check if executeMove exists
    out.executeMoveType = typeof executeMove;
    
    // 4. Check isAnimationInProgress
    if (typeof isAnimationInProgress === "function") {
      out.isAnimating = isAnimationInProgress();
    }
    
    return out;
  });
  
  console.log("=== RESULTS ===");
  console.log(JSON.stringify(results, null, 2));
  console.log("=== ERRORS ===");
  console.log(JSON.stringify(errors, null, 2));
  
  await browser.close();
})();
