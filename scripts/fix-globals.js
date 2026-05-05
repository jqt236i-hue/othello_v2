const fs = require('fs');
let e = fs.readFileSync('entry-browser.js', 'utf8');

// Replace NO-OP CoreLogic line with explicit assignment
e = e.replace(
  'if (typeof window.CoreLogic !== "undefined") window.CoreLogic = window.CoreLogic;',
  'window.CoreLogic = require("./dist/game/logic/core");'
);

// Replace NO-OP CardLogic line with explicit assignment
e = e.replace(
  'if (typeof window.CardLogic !== "undefined") window.CardLogic = window.CardLogic;',
  'window.CardLogic = require("./dist/game/logic/cards");'
);

fs.writeFileSync('entry-browser.js', e, 'utf8');
console.log('Done. CoreLogic and CardLogic assignments replaced.');
