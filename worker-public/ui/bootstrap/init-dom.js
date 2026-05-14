module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function' ? require('./init-dom.ts') : require("../../dist/ui/bootstrap/init-dom");
