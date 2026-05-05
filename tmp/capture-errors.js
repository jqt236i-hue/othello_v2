const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  const warnings = [];
  page.on("console", msg => {
    if (msg.type() === "error") errors.push({ text: msg.text(), location: msg.location() });
    if (msg.type() === "warning") warnings.push({ text: msg.text(), location: msg.location() });
  });
  page.on("pageerror", err => errors.push({ text: err.message, stack: err.stack }));
  await page.goto("http://localhost:8080/?debug=1", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);
  
  const validMoves = await page.evaluate(() => {
    try {
      if (typeof getLegalMovesBasic === "function" && typeof gameState !== "undefined") {
        const moves = getLegalMovesBasic(gameState.board, gameState.currentPlayer);
        return { count: moves.length, sample: moves.slice(0, 3) };
      }
      return { error: "getLegalMovesBasic or gameState not found" };
    } catch(e) { return { error: e.message }; }
  });
  
  const gameInfo = await page.evaluate(() => {
    try {
      return {
        hasGameState: typeof gameState !== "undefined",
        hasCardState: typeof cardState !== "undefined",
        currentPlayer: gameState?.currentPlayer,
        turnNumber: gameState?.turnNumber,
        boardSize: gameState?.board?.length,
        hasCore: typeof Core !== "undefined" || typeof CoreLogic !== "undefined",
        hasCardLogic: typeof CardLogic !== "undefined",
        hasTurnPipeline: typeof TurnPipelinePhases !== "undefined",
        isProcessing: typeof isProcessing !== "undefined" ? isProcessing : "undefined",
        isCardAnimating: typeof isCardAnimating !== "undefined" ? isCardAnimating : "undefined",
        gameStateKeys: gameState ? Object.keys(gameState) : null,
       };
    } catch(e) { return { error: e.message }; }
  });
  
  const clickResult = await page.evaluate(() => {
    try {
      const board = document.getElementById("board");
      if (!board) return { error: "board element not found" };
      const cells = board.querySelectorAll(".cell");
      let targetCell = null;
      for (const cell of cells) {
        if (cell.classList.contains("valid-move")) {
          targetCell = cell;
          break;
        }
      }
      if (!targetCell) return { error: "no valid-move cells found", totalCells: cells.length };
      const rect = targetCell.getBoundingClientRect();
      return { 
        found: true, 
        cellClass: targetCell.className,
        row: targetCell.dataset?.row,
        col: targetCell.dataset?.col,
        position: { x: rect.x + rect.width/2, y: rect.y + rect.height/2 }
      };
    } catch(e) { return { error: e.message }; }
  });
  
  if (clickResult.found) {
    await page.mouse.click(clickResult.position.x, clickResult.position.y);
    await page.waitForTimeout(1000);
    const postClickState = await page.evaluate(() => ({
      turnNumber: gameState?.turnNumber,
      currentPlayer: gameState?.currentPlayer,
    }));
    clickResult.postClickState = postClickState;
  }
  
  const boardMarkers = await page.evaluate(() => {
    try {
      const board = document.getElementById("board");
      if (!board) return { error: "board not found" };
      const cells = board.querySelectorAll(".cell");
      const result = [];
      cells.forEach((cell, i) => {
        const classes = Array.from(cell.classList);
        const hasDisc = cell.querySelector(".disc");
        result.push({
          index: i,
          classes: classes.filter(c => c !== "cell"),
          hasDisc: !!hasDisc,
          row: cell.dataset?.row,
          col: cell.dataset?.col
        });
      });
      return result;
    } catch(e) { return { error: e.message }; }
  });
  
  console.log("=== CONSOLE ERRORS ===");
  console.log(JSON.stringify(errors, null, 2));
  console.log("=== CONSOLE WARNINGS ===");
  console.log(JSON.stringify(warnings, null, 2));
  console.log("=== GAME STATE ===");
  console.log(JSON.stringify(gameInfo, null, 2));
  console.log("=== VALID MOVES ===");
  console.log(JSON.stringify(validMoves, null, 2));
  console.log("=== CLICK RESULT ===");
  console.log(JSON.stringify(clickResult, null, 2));
  console.log("=== BOARD MARKERS (sample) ===");
  console.log(JSON.stringify(boardMarkers.filter(m => m.classes.length > 0 || m.hasDisc).slice(0, 20), null, 2));
  
  await page.screenshot({ path: "tmp/capture-errors-screenshot.png", fullPage: true });
  await browser.close();
})();
