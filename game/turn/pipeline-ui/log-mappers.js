module.exports = process.env.JEST_WORKER_ID
    ? require('./log-mappers.ts')
    : require('../../../../dist/game/turn/pipeline-ui/log-mappers');
