declare function getNetworkTelemetry(): any;
declare function getState(): {
    active: boolean;
    roomId: string;
    seatKey: any;
    roomSeats: any;
    seatNames: any;
    seatHandSkins: any;
    roomDeck: any;
    roomBoardConfig: any;
    networkDebugEnabled: boolean;
    stateVersion: number | null;
    publishTracker: {
        nextSequence: number;
        operations: any;
    };
};
declare function hasTwoPlayers(): any;
declare function applySnapshot(snapshot: any, options: any): any;
declare function isActive(): boolean;
declare function setStatusWriter(writer: any): void;
declare function setServerUrl(url: any): void;
declare function getServerUrl(): string;
declare function createRoom(options: any): any;
declare function joinRoom(roomId: any, options: any): any;
declare function syncLatestState(): any;
declare function leaveRoom(): any;
declare function publishSnapshot(meta: any): any;
declare function requestRematch(): Promise<any>;
declare function getSeatKey(): string;
declare function getRoomId(): string;
declare function getStateVersion(): any;
declare function getRoomSeats(): any;
declare function getSeatNames(): any;
declare function getSeatHandSkins(): any;
declare function getRoomDeck(): null;
declare function getRoomBoardConfig(): any;
declare function setRoomStateListener(listener: any): void;
declare function setTurnTimerListener(listener: any): void;
declare function setChatListener(listener: any): void;
declare function getChatMaxLength(): number;
declare function sendChatMessage(text: any): Promise<{
    ok: boolean;
    reason: any;
    message?: undefined;
} | {
    ok: boolean;
    message: {
        id: number;
        seatKey: any;
        text: string;
        serverTime: number;
    } | null;
    reason?: undefined;
}>;
declare function updateHandSkin(selectedHandSkinId: any): Promise<{
    ok: boolean;
    reason: any;
    seatHandSkins?: undefined;
} | {
    ok: boolean;
    seatHandSkins: any;
    reason?: undefined;
}>;
declare const api: {
    isActive: typeof isActive;
    setStatusWriter: typeof setStatusWriter;
    setServerUrl: typeof setServerUrl;
    getServerUrl: typeof getServerUrl;
    setRoomStateListener: typeof setRoomStateListener;
    setTurnTimerListener: typeof setTurnTimerListener;
    getRoomSeats: typeof getRoomSeats;
    getSeatNames: typeof getSeatNames;
    getSeatHandSkins: typeof getSeatHandSkins;
    hasTwoPlayers: typeof hasTwoPlayers;
    setChatListener: typeof setChatListener;
    getChatMaxLength: typeof getChatMaxLength;
    sendChatMessage: typeof sendChatMessage;
    updateHandSkin: typeof updateHandSkin;
    createRoom: typeof createRoom;
    joinRoom: typeof joinRoom;
    leaveRoom: typeof leaveRoom;
    syncLatestState: typeof syncLatestState;
    publishSnapshot: typeof publishSnapshot;
    requestRematch: typeof requestRematch;
    applySnapshot: typeof applySnapshot;
    getSeatKey: typeof getSeatKey;
    getRoomId: typeof getRoomId;
    getState: typeof getState;
    getStateVersion: typeof getStateVersion;
    getRoomDeck: typeof getRoomDeck;
    getRoomBoardConfig: typeof getRoomBoardConfig;
    getNetworkTelemetry: typeof getNetworkTelemetry;
};
export = api;
//# sourceMappingURL=network-client.d.ts.map