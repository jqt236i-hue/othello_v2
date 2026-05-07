#!/usr/bin/env node
const mod = require("../dist/scripts/serve-with-fallback");
Promise.resolve(mod.main ? mod.main() : undefined).catch((error) => {
    console.error('[serve] failed:', error && error.message ? error.message : error);
    process.exit(1);
});
