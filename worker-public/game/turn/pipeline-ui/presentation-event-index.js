module.exports = process.env.JEST_WORKER_ID
    ? require('./presentation-event-index.ts')
    : require('../../../../dist/game/turn/pipeline-ui/presentation-event-index');
