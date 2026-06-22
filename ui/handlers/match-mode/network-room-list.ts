function createNetworkRoomListController(context: any) {
    const {
        root,
        uiRefs,
        normalizePlayerName,
        normalizeRoomName,
        formatRoomIdInput,
        joinRoomFromList,
        spectateRoomFromList
    } = context;

    function createNetworkPanelInput(id: string, type: string, placeholder: string) {
        const input = document.createElement('input');
        input.id = id;
        input.type = type;
        input.placeholder = placeholder;
        input.autocomplete = 'off';
        input.spellcheck = false;
        return input;
    }

    function ensureNetworkLobbyUi() {
        if (!uiRefs.networkPanel || uiRefs.networkRoomList) return;
        const roomInput = uiRefs.networkRoomInput;
        if (roomInput) {
            roomInput.placeholder = 'ルーム名（任意）';
            roomInput.maxLength = 20;
            roomInput.removeAttribute('pattern');
        }
        if (uiRefs.networkCopyRoomBtn) {
            uiRefs.networkCopyRoomBtn.textContent = 'ルーム名コピー';
        }
        const existingPasswordInput = typeof document !== 'undefined'
            ? document.getElementById('networkRoomPasswordInput')
            : null;
        const passwordInput = (existingPasswordInput as HTMLInputElement | null)
            || createNetworkPanelInput('networkRoomPasswordInput', 'password', 'パスワード（任意）');
        passwordInput.maxLength = 20;
        if (!existingPasswordInput && roomInput && roomInput.parentNode === uiRefs.networkPanel) {
            uiRefs.networkPanel.insertBefore(passwordInput, roomInput.nextSibling);
        } else if (!existingPasswordInput) {
            uiRefs.networkPanel.appendChild(passwordInput);
        }
        uiRefs.networkRoomPasswordInput = passwordInput;

        const listWrap = document.createElement('div');
        listWrap.id = 'networkRoomListPanel';

        const header = document.createElement('div');
        header.id = 'networkRoomListHeader';
        const title = document.createElement('span');
        title.className = 'network-room-list-title';
        title.textContent = 'ルーム一覧';
        const refreshBtn = document.createElement('button');
        refreshBtn.id = 'networkRoomListRefreshBtn';
        refreshBtn.className = 'btn-small';
        refreshBtn.type = 'button';
        refreshBtn.textContent = '更新';
        header.appendChild(title);
        header.appendChild(refreshBtn);

        const list = document.createElement('div');
        list.id = 'networkRoomList';
        list.setAttribute('aria-live', 'polite');
        const viewport = document.createElement('div');
        viewport.id = 'networkRoomListViewport';
        viewport.appendChild(list);

        listWrap.appendChild(header);
        listWrap.appendChild(viewport);

        const deckInfo = uiRefs.networkDeckInfo;
        if (deckInfo && deckInfo.parentNode === uiRefs.networkPanel) {
            uiRefs.networkPanel.insertBefore(listWrap, deckInfo);
        } else {
            uiRefs.networkPanel.appendChild(listWrap);
        }
        uiRefs.networkRoomListRefreshBtn = refreshBtn;
        uiRefs.networkRoomList = list;
    }

    function renderNetworkRoomList(rooms: any[]) {
        if (!uiRefs.networkRoomList) return;
        uiRefs.networkRoomList.textContent = '';
        const list = Array.isArray(rooms) ? rooms : [];
        if (list.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'network-room-list-empty';
            empty.textContent = '募集中のルームはありません';
            uiRefs.networkRoomList.appendChild(empty);
            return;
        }

        list.forEach((room) => {
            const entry = room && typeof room === 'object' ? room : {};
            const roomId = formatRoomIdInput(entry.roomId);
            if (!roomId) return;
            const item = document.createElement('div');
            item.className = 'network-room-list-entry';
            item.dataset.roomId = roomId;
            item.dataset.hasPassword = entry.hasPassword === true ? '1' : '0';
            item.dataset.roomName = normalizeRoomName(entry.roomName) || '無名部屋';
            const roomName = normalizeRoomName(entry.roomName) || '無名部屋';
            const host = normalizePlayerName(entry.hostName) || '名前なし';
            const boardLabel = String(entry.boardLabel || '8x8');
            const seatCount = Number.isFinite(Number(entry.seatCount)) ? Number(entry.seatCount) : 1;
            const maxSeats = Number.isFinite(Number(entry.maxSeats)) ? Number(entry.maxSeats) : 2;
            const spectatorCount = Number.isFinite(Number(entry.spectatorCount)) ? Number(entry.spectatorCount) : 0;
            const maxSpectators = Number.isFinite(Number(entry.maxSpectators)) ? Number(entry.maxSpectators) : 4;
            const blackPlayerName = normalizePlayerName(entry.blackPlayerName || entry.blackName || entry.seatNames?.black) || host;
            const whitePlayerName = normalizePlayerName(entry.whitePlayerName || entry.whiteName || entry.guestName || entry.opponentName || entry.seatNames?.white)
                || (seatCount >= 2 ? '参加者' : '募集中');
            const currentRoomId = root.NetworkMatchClient && typeof root.NetworkMatchClient.getRoomId === 'function'
                ? formatRoomIdInput(root.NetworkMatchClient.getRoomId())
                : '';
            if (currentRoomId && currentRoomId === roomId) {
                item.classList.add('is-current-room');
            }
            const body = document.createElement('div');
            body.className = 'network-room-entry-body';
            const main = document.createElement('span');
            main.className = 'network-room-entry-main';
            const nameEl = document.createElement('span');
            nameEl.className = 'network-room-entry-name';
            nameEl.textContent = roomName;
            const badgeWrap = document.createElement('span');
            badgeWrap.className = 'network-room-entry-badges';
            const seatBadge = document.createElement('span');
            seatBadge.className = 'network-room-entry-badge';
            seatBadge.textContent = `${seatCount}/${maxSeats}`;
            badgeWrap.appendChild(seatBadge);
            if (entry.hasPassword === true) {
                const passwordBadge = document.createElement('span');
                passwordBadge.className = 'network-room-entry-badge is-password';
                passwordBadge.textContent = '鍵あり';
                badgeWrap.appendChild(passwordBadge);
            }
            main.appendChild(nameEl);
            main.appendChild(badgeWrap);

            const meta = document.createElement('span');
            meta.className = 'network-room-entry-meta';
            const hostEl = document.createElement('span');
            hostEl.textContent = `ホスト ${host}`;
            const boardEl = document.createElement('span');
            boardEl.textContent = `盤面 ${boardLabel}`;
            const spectatorEl = document.createElement('span');
            spectatorEl.textContent = `観測 ${spectatorCount}/${maxSpectators}`;
            meta.appendChild(hostEl);
            meta.appendChild(boardEl);
            meta.appendChild(spectatorEl);

            const versus = document.createElement('span');
            versus.className = 'network-room-entry-versus';
            const blackMark = document.createElement('span');
            blackMark.className = 'network-room-entry-mark';
            blackMark.textContent = blackPlayerName;
            if (Array.from(blackPlayerName).length > 4) {
                blackMark.classList.add('is-long-name');
            }
            const versusText = document.createElement('span');
            versusText.className = 'network-room-entry-vs';
            versusText.textContent = 'VS';
            const whiteMark = document.createElement('span');
            whiteMark.className = 'network-room-entry-mark';
            whiteMark.textContent = whitePlayerName;
            if (Array.from(whitePlayerName).length > 4) {
                whiteMark.classList.add('is-long-name');
            }
            versus.appendChild(blackMark);
            versus.appendChild(versusText);
            versus.appendChild(whiteMark);

            const counts = document.createElement('span');
            counts.className = 'network-room-entry-counts';
            const playerCount = document.createElement('span');
            playerCount.className = 'network-room-entry-count is-player-count';
            const playerLabel = document.createElement('span');
            playerLabel.className = 'network-room-entry-count-label';
            playerLabel.textContent = 'プレイヤー';
            const playerValue = document.createElement('span');
            playerValue.className = 'network-room-entry-count-value';
            playerValue.textContent = `${seatCount}/${maxSeats}`;
            playerCount.appendChild(playerLabel);
            playerCount.appendChild(playerValue);
            const spectatorCountEl = document.createElement('span');
            spectatorCountEl.className = 'network-room-entry-count is-spectator-count';
            const spectatorLabel = document.createElement('span');
            spectatorLabel.className = 'network-room-entry-count-label';
            spectatorLabel.textContent = '観測中';
            const spectatorValue = document.createElement('span');
            spectatorValue.className = 'network-room-entry-count-value';
            spectatorValue.textContent = `${spectatorCount}/${maxSpectators}`;
            spectatorCountEl.appendChild(spectatorLabel);
            spectatorCountEl.appendChild(spectatorValue);
            counts.appendChild(playerCount);
            counts.appendChild(spectatorCountEl);

            body.appendChild(main);
            body.appendChild(versus);
            body.appendChild(counts);
            body.appendChild(meta);

            const joinButton = document.createElement('button');
            joinButton.type = 'button';
            joinButton.className = 'btn-small network-room-entry-join';
            joinButton.textContent = '参加';
            joinButton.disabled = entry.canJoin === false;
            if (currentRoomId && currentRoomId === roomId) {
                joinButton.textContent = '参加済み';
                joinButton.disabled = true;
            }
            joinButton.setAttribute(
                'aria-label',
                `${roomName}に参加。ホスト ${host}、盤面 ${boardLabel}、${seatCount}/${maxSeats}${entry.hasPassword === true ? '、パスワードあり' : ''}`
            );
            joinButton.addEventListener('click', () => {
                joinRoomFromList(roomId, roomName, entry.hasPassword === true);
            });
            const spectateButton = document.createElement('button');
            spectateButton.type = 'button';
            spectateButton.className = 'btn-small network-room-entry-spectate';
            spectateButton.textContent = '観測';
            spectateButton.disabled = entry.canSpectate === false;
            if (currentRoomId && currentRoomId === roomId) {
                spectateButton.classList.add('network-room-entry-leave');
                spectateButton.textContent = '退出';
                spectateButton.disabled = false;
                spectateButton.setAttribute('aria-label', `${roomName}から退出`);
                spectateButton.addEventListener('click', () => {
                    if (uiRefs.networkLeaveBtn && typeof uiRefs.networkLeaveBtn.click === 'function') {
                        uiRefs.networkLeaveBtn.click();
                    }
                });
            } else {
                spectateButton.setAttribute(
                    'aria-label',
                    `${roomName}を観測。観測 ${spectatorCount}/${maxSpectators}${entry.hasPassword === true ? '、パスワードあり' : ''}`
                );
                spectateButton.addEventListener('click', () => {
                    spectateRoomFromList(roomId, roomName, entry.hasPassword === true);
                });
            }
            item.appendChild(body);
            item.appendChild(joinButton);
            item.appendChild(spectateButton);
            uiRefs.networkRoomList.appendChild(item);
        });
    }


    return {
        ensureNetworkLobbyUi,
        renderNetworkRoomList
    };
}

const MatchModeNetworkRoomList = {
    createNetworkRoomListController
};

export = MatchModeNetworkRoomList;
