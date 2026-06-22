function createNetworkChatController(context: any) {
    const {
        root,
        uiRefs,
        CHAT_INPUT_FALLBACK_MAX
    } = context;

    let networkChatVisible = false;

    function getChatMaxLength() {
        try {
            if (root.NetworkMatchClient && typeof root.NetworkMatchClient.getChatMaxLength === 'function') {
                return Math.max(1, Number(root.NetworkMatchClient.getChatMaxLength()) || CHAT_INPUT_FALLBACK_MAX);
            }
        } catch (e) { /* ignore */ }
        return CHAT_INPUT_FALLBACK_MAX;
    }

    function formatChatInput(value: any) {
        const maxLength = getChatMaxLength();
        return Array.from(String(value || '').replace(/[\r\n]+/g, ' ').trim())
            .slice(0, maxLength)
            .join('');
    }

    function clearNetworkChatMessages() {
        if (!uiRefs.networkChatMessages) return;
        uiRefs.networkChatMessages.innerHTML = '';
    }

    function normalizeNetworkChatSeatKey(value: any) {
        const normalized = String(value || '').trim().toLowerCase();
        return normalized === 'white' ? 'white' : 'black';
    }

    function appendNetworkChatMessage(entry: any) {
        if (!uiRefs.networkChatMessages || !entry || !entry.text) return;
        const seatKey = normalizeNetworkChatSeatKey(entry.seatKey);
        const seatLabel = seatKey === 'white' ? '白' : '黒';
        const localSeat = (root.NetworkMatchClient && typeof root.NetworkMatchClient.getSeatKey === 'function')
            ? normalizeNetworkChatSeatKey(root.NetworkMatchClient.getSeatKey())
            : 'black';

        const line = document.createElement('div');
        line.className = 'network-chat-line';
        if (seatKey === localSeat) {
            line.classList.add('network-chat-line--self');
        }
        line.textContent = `${seatLabel}: ${entry.text}`;
        uiRefs.networkChatMessages.appendChild(line);
        uiRefs.networkChatMessages.scrollTop = uiRefs.networkChatMessages.scrollHeight;
    }

    function showNetworkChatSpeechBubble(entry: any) {
        if (!entry || !entry.text) return;
        const seatKey = normalizeNetworkChatSeatKey(entry.seatKey);
        const localSeat = (root.NetworkMatchClient && typeof root.NetworkMatchClient.getSeatKey === 'function')
            ? normalizeNetworkChatSeatKey(root.NetworkMatchClient.getSeatKey())
            : 'black';
        const speechText = String(entry.text || '').trim();
        if (!speechText) return;

        if (seatKey === localSeat) {
            if (typeof root.showHeroSpeechBubble === 'function') {
                root.showHeroSpeechBubble(speechText);
            }
            return;
        }

        if (typeof root.showCpuSpeechBubble === 'function') {
            root.showCpuSpeechBubble(speechText);
        }
    }

    function renderNetworkChatHistory(messages: any) {
        clearNetworkChatMessages();
        if (!Array.isArray(messages)) return;
        messages.forEach((entry) => {
            appendNetworkChatMessage(entry);
        });
    }

    function setNetworkChatExpanded(expanded: any) {
        if (!uiRefs.networkChatPanel) return;
        const isOpen = !!expanded;
        uiRefs.networkChatPanel.classList.toggle('is-open', isOpen);
        if (uiRefs.networkChatToggle) {
            uiRefs.networkChatToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        }
    }

    function setNetworkChatVisible(visible: any) {
        if (!uiRefs.networkChatPanel) return;
        const nextVisible = !!visible;
        const changed = networkChatVisible !== nextVisible;
        networkChatVisible = nextVisible;

        uiRefs.networkChatPanel.classList.toggle('is-active', nextVisible);
        uiRefs.networkChatPanel.setAttribute('aria-hidden', nextVisible ? 'false' : 'true');
        if (uiRefs.networkChatInput) {
            uiRefs.networkChatInput.disabled = !nextVisible;
        }
        if (uiRefs.networkChatSendBtn) {
            uiRefs.networkChatSendBtn.disabled = !nextVisible;
        }
        if (changed && nextVisible) {
            setNetworkChatExpanded(false);
        }
        if (changed && !nextVisible) {
            setNetworkChatExpanded(false);
            clearNetworkChatMessages();
        }
    }

    function refreshNetworkChatVisibility(options?: any) {
        const opts = options || {};
        const isNetworkMode = opts.networkMode === true;
        const spectatorActive = opts.spectatorActive === true;
        const hasTwoPlayers = !!(
            root.NetworkMatchClient
            && typeof root.NetworkMatchClient.hasTwoPlayers === 'function'
            && root.NetworkMatchClient.hasTwoPlayers()
        );
        setNetworkChatVisible(isNetworkMode && hasTwoPlayers && !spectatorActive);
    }


    return {
        getVisible: () => networkChatVisible,
        getChatMaxLength,
        formatInput: formatChatInput,
        appendMessage: appendNetworkChatMessage,
        showSpeechBubble: showNetworkChatSpeechBubble,
        renderHistory: renderNetworkChatHistory,
        setExpanded: setNetworkChatExpanded,
        refreshVisibility: refreshNetworkChatVisibility
    };
}

const MatchModeNetworkChat = {
    createNetworkChatController
};

export = MatchModeNetworkChat;
