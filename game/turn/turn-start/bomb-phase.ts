type ProcessTurnStartBombMarkerOptions = {
    CardLogic: any;
    cardState: any;
    gameState: any;
    playerKey: any;
    events: any[];
    markerAnchor: any;
    isFrozenCell: (cardState: any, row: any, col: any) => boolean;
};

function processTurnStartBombMarker(options: ProcessTurnStartBombMarkerOptions): boolean {
    const opts = (options && typeof options === 'object') ? options : ({} as ProcessTurnStartBombMarkerOptions);
    const marker = opts.markerAnchor && opts.markerAnchor.marker;
    if (!marker) return false;
    if (opts.isFrozenCell && opts.isFrozenCell(opts.cardState, marker.row, marker.col)) return false;
    const res = opts.CardLogic.tickBombAt(opts.cardState, opts.gameState, marker, opts.playerKey);
    if (res && res.exploded && res.exploded.length) {
        opts.events.push({ type: 'bombs_exploded', details: res });
        return true;
    }
    return false;
}

const TurnStartBombPhaseModule = {
    processTurnStartBombMarker
};

export = TurnStartBombPhaseModule;
