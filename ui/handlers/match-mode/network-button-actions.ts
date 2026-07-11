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

async function leaveNetworkRoom(options: any): Promise<void> {
    try {
        if (options.client && typeof options.client.leaveRoom === 'function') {
            await options.client.leaveRoom();
        }
    } catch (e) { /* leave cleanup continues */ }
    options.setNetworkRoomDebugEnabled(false);
    options.setNetworkRoomAutoEnabled(false);
    if (options.debugCheckbox) options.debugCheckbox.checked = false;
    if (options.autoCheckbox) options.autoCheckbox.checked = false;
    options.applyNetworkDebugModeAccess();
    options.refreshNetworkAutoModeAccess();
    await options.setMode(options.cpuMode, { silentLog: true, skipNetworkLeave: true });
    options.renderNetworkDeckInfo(null);
    options.refreshBoardUi();
}

function applyNetworkRoomSettingsResult(result: any, options: any): boolean {
    if (!result || result.ok !== true) return false;
    options.setNetworkRoomDebugEnabled(result.networkDebugEnabled === true);
    options.setNetworkRoomAutoEnabled(result.networkAutoEnabled === true);
    options.applyNetworkDebugModeAccess();
    options.refreshNetworkAutoModeAccess();
    options.tryAutoEnableDebugModeForNetworkRoom();
    return true;
}

export = { copyNetworkRoomName, toggleNetworkRoomSettings, refreshNetworkRooms, leaveNetworkRoom, applyNetworkRoomSettingsResult };
