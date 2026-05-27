module.exports = process.env.JEST_WORKER_ID
    ? require('./board-event-playback.ts')
    : require('../../../../dist/game/turn/pipeline-ui/board-event-playback');
