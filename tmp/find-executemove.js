const fs = require("fs");
const c = fs.readFileSync("public/module-registry.js", "utf8");

// Find the move-executor entry
const keywords = [
  "game/move-executor",
  "game/move-executor-visuals", 
  "game/game-controller-slim",
  "game/cpu-turn-handler"
];

for (const kw of keywords) {
  const idx = c.indexOf(`"${kw}"`);
  if (idx >= 0) {
    const start = c.lastIndexOf("_r(", idx);
    const end = c.indexOf(");", idx);
    console.log(`=== ${kw} ===`);
    if (start >= 0 && end > start) {
      const entry = c.substring(start, end + 2);
      // Unescape the string source
      console.log(entry.substring(0, 800));
    } else {
      console.log("Could not find _r() call");
    }
    console.log("");
  }
}

// Search for "executeMove" as assignment
console.log("=== Search for executeMove assignment ===");
const assignMatch = c.match(/executeMove\s*=\s*function/g);
console.log("matches:", assignMatch ? assignMatch.length : 0);
if (assignMatch) {
  for (const m of assignMatch) {
    const pos = c.indexOf(m);
    console.log(`Found at ${pos}: ${c.substring(Math.max(0,pos-50), pos+100)}`);
  }
}

// Search for "executeMove" not as function call
const allMatches = [...c.matchAll(/executeMove\s*[=:]/g)];
console.log(`executeMove with assignment/definition: ${allMatches.length}`);
for (const m of allMatches) {
  const pos = m.index;
  console.log(`  at ${pos}: ...${c.substring(Math.max(0,pos-80), pos+80)}...`);
}
