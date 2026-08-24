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

function closeNetworkRoomSettings(options: any): void {
    options.setVisible(false);
}

function refreshNetworkRooms(options: any): any {
    return options.refreshNetworkRoomList();
}

async function leaveNetworkRoom(options: any): Promise<void> {
    let leaveResult: any = { ok: true };
    try {
        if (options.client && typeof options.client.leaveRoom === 'function') {
            leaveResult = await options.client.leaveRoom();
        }
    } catch (e) {
        if (typeof options.writeNetworkStatus === 'function') {
            options.writeNetworkStatus('ネット対戦の退出処理に失敗しました', true);
        }
        return;
    }
    if (!leaveResult || leaveResult.ok !== true) {
        if (leaveResult && leaveResult.reloadRequired === true && typeof options.writeNetworkStatus === 'function') {
            options.writeNetworkStatus('ネット対戦の終了処理を完了できませんでした。ページを再読み込みしてください', true);
        }
        return;
    }
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

async function createNetworkRoom(options: any): Promise<any> {
    await options.setMode(options.networkMode, { silentLog: true });
    const serverUrl = options.serverInput ? options.serverInput.value.trim() : '';
    const playerName = options.playerNameInput
        ? options.normalizePlayerName(options.playerNameInput.value)
        : '';
    const localDeckSelection = options.readActiveLocalDeckSelection();
    const deckCode = localDeckSelection.deckCode;
    const roomBoardConfig = options.getPendingRoomBoardConfig();
    const requestedNetworkDebugEnabled = !!(
        options.debugCheckbox
        && options.debugCheckbox.checked
    );
    const requestedNetworkAutoEnabled = !!(
        options.autoCheckbox
        && options.autoCheckbox.checked
    );
    const requestedAllCardsDeckEnabled = typeof options.readNetworkAllCardsDeckEnabled === 'function'
        ? options.readNetworkAllCardsDeckEnabled()
        : !!(options.allCardsDeckCheckbox && options.allCardsDeckCheckbox.checked);
    const requestedTurnTimeSeconds = typeof options.readNetworkTurnTimeSeconds === 'function'
        ? options.readNetworkTurnTimeSeconds()
        : 120;
    options.notifyInvalidCustomDeckFallback(localDeckSelection);
    try {
        if (options.client && typeof options.client.setServerUrl === 'function') {
            options.client.setServerUrl(serverUrl);
        }
        const result = await options.client.createRoom({
            serverUrl,
            playerName,
            deckCode,
            roomName: options.readNetworkRoomName(),
            roomPassword: options.readNetworkRoomPassword(),
            roomBoardConfig,
            networkDebugEnabled: requestedNetworkDebugEnabled,
            networkAutoEnabled: requestedNetworkAutoEnabled,
            allCardsDeckEnabled: requestedAllCardsDeckEnabled,
            turnTimeSeconds: requestedTurnTimeSeconds
        });
        if (result && result.ok && options.roomInput) {
            options.roomInput.value = result.roomName || options.readNetworkRoomName() || '無名部屋';
        }
        if (result && result.ok && result.playerName && options.playerNameInput) {
            options.playerNameInput.value = result.playerName;
            options.setSharedPlayerName(result.playerName);
        }
        if (result && result.ok) {
            applyNetworkRoomSettingsResult(result, options.roomSettings);
            options.setNetworkRoomSettingsPopupVisible(false);
        }
        options.refreshNetworkChatVisibility();
        options.renderNetworkDeckInfo();
        options.refreshNetworkRoomList({ silentStatus: true });
        options.refreshBoardUi();
        return result;
    } catch (e) {
        options.writeNetworkStatus('部屋作成に失敗しました', true);
        return null;
    }
}

async function joinNetworkRoom(options: any): Promise<any> {
    await options.setMode(options.networkMode, { silentLog: true });
    const roomId = options.getSelectedNetworkRoomId();
    const serverUrl = options.serverInput ? options.serverInput.value.trim() : '';
    const playerName = options.resolveRequiredNetworkPlayerName();
    const localDeckSelection = options.readActiveLocalDeckSelection();
    const deckCode = localDeckSelection.deckCode;
    if (!playerName) return null;
    if (!roomId) {
        options.writeNetworkStatus('ルーム一覧から参加するルームを選んでください', true);
        return null;
    }
    options.notifyInvalidCustomDeckFallback(localDeckSelection);
    try {
        if (options.client && typeof options.client.setServerUrl === 'function') {
            options.client.setServerUrl(serverUrl);
        }
        const result = await options.client.joinRoom(roomId, {
            serverUrl,
            playerName,
            deckCode,
            roomPassword: options.readNetworkRoomPassword()
        });
        if (result && result.ok) {
            applyNetworkRoomSettingsResult(result, options.roomSettings);
        }
        options.refreshNetworkChatVisibility();
        options.renderNetworkDeckInfo();
        if (result && result.ok) {
            await options.refreshNetworkRoomList({ silentStatus: true });
        }
        options.refreshBoardUi();
        return result;
    } catch (e) {
        options.writeNetworkStatus('部屋参加に失敗しました', true);
        return null;
    }
}

export = {
    copyNetworkRoomName,
    toggleNetworkRoomSettings,
    closeNetworkRoomSettings,
    refreshNetworkRooms,
    leaveNetworkRoom,
    applyNetworkRoomSettingsResult,
    createNetworkRoom,
    joinNetworkRoom
};
