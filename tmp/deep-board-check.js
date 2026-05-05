const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const logs = [];
  page.on("console", msg => logs.push({ type: msg.type(), text: msg.text() }));
  
  await page.goto("http://localhost:8080/?debug=1", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);

  // Get ALL board-related state
  const boardState = await page.evaluate(() => {
    const result = {};
    
    // Check board element contents
    const board = document.getElementById("board");
    result.boardHTML_sample = board ? board.innerHTML.substring(0, 500) : "no board";
    result.boardChildCount = board ? board.children.length : 0;
    
    // Check first cell details
    const firstCell = board ? board.querySelector(".cell") : null;
    if (firstCell) {
      result.firstCellHTML = firstCell.outerHTML.substring(0, 300);
      result.firstCellClasses = Array.from(firstCell.classList);
      result.firstCellDataset = JSON.parse(JSON.stringify(firstCell.dataset));
    }
    
    // Check for any disc elements
    const discs = board ? board.querySelectorAll(".disc") : [];
    result.discCount = discs.length;
    if (discs.length > 0) {
      result.firstDisc = discs[0].outerHTML.substring(0, 200);
    }
    
    // Check board state actual values at center
    if (typeof gameState !== "undefined" && gameState.board) {
      const b = gameState.board;
      result.centerCells = {
        "3,3": b[3]?.[3],
        "3,4": b[3]?.[4],
        "4,3": b[4]?.[3],
        "4,4": b[4]?.[4],
        "2,3": b[2]?.[3],
        "3,2": b[3]?.[2],
        "4,5": b[4]?.[5],
        "5,4": b[5]?.[4],
      };
    }
    
    // Check emitBoardUpdate function
    result.hasEmitBoardUpdate = typeof emitBoardUpdate === "function";
    result.hasRenderBoard = typeof renderBoard === "function";
    
    // Check card state hand
    if (typeof cardState !== "undefined") {
      result.handBlack = cardState.hands?.black?.length || 0;
      result.handWhite = cardState.hands?.white?.length || 0;
    }
    
    return result;
  });

  console.log("=== DEEP BOARD STATE ===");
  console.log(JSON.stringify(boardState, null, 2));
  console.log("=== ALL LOGS (first 30) ===");
  console.log(JSON.stringify(logs.slice(0, 30), null, 2));
  
  // Now let's try calling renderBoard manually
  console.log("=== TRYING MANUAL RENDER ===");
  const manualRenderResult = await page.evaluate(() => {
    const beforeDiscs = document.querySelectorAll("#board .disc").length;
    if (typeof renderBoard === "function") {
      try {
        renderBoard();
        return { 
          called: true, 
          beforeDiscs,
          afterDiscs: document.querySelectorAll("#board .disc").length,
          afterValidMoves: document.querySelectorAll("#board .valid-move").length
        };
      } catch(e) {
        return { called: true, error: e.message, stack: e.stack };
      }
    }
    return { called: false, reason: "renderBoard not found" };
  });
  console.log(JSON.stringify(manualRenderResult, null, 2));
  
  await page.screenshot({ path: "tmp/board-debug-screenshot.png", fullPage: true });
  await browser.close();
})();
