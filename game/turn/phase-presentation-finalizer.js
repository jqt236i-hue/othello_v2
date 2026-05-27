module.exports = process.env.JEST_WORKER_ID
    ? require('./phase-presentation-finalizer.ts')
    : require('../../dist/game/turn/phase-presentation-finalizer');
