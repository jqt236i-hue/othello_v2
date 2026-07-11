async function copyNetworkRoomName(options: any): Promise<boolean> {
    const roomName = options.readNetworkRoomName() || '無名部屋';
    if (!roomName) {
        options.writeNetworkStatus('コピーするルーム名がありません', true);
        return false;
    }
    const copied = await options.copyTextToClipboard(roomName);
    if (copied) {
        options.writeNetworkStatus(`ルーム名「${roomName}」をコピーしました`, false);
        return true;
    }
    options.writeNetworkStatus('ルーム名のコピーに失敗しました', true);
    return false;
}

function toggleNetworkRoomSettings(options: any): boolean {
    const popup = options.popup;
    const isOpen = !!(popup && popup.classList && popup.classList.contains('is-open'));
    options.setVisible(!isOpen);
    return !isOpen;
}

function refreshNetworkRooms(options: any): any {
    return options.refreshNetworkRoomList();
}

export = { copyNetworkRoomName, toggleNetworkRoomSettings, refreshNetworkRooms };
