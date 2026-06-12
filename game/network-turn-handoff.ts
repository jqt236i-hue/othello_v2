
function loadRuntime(): any {
    try {
        return require('./network-turn-handoff.runtime');
    } catch (e) {
        return require('../../game/network-turn-handoff.runtime');
    }
}

export = loadRuntime();
