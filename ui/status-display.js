// ===== Status Display =====
// Import difficulty level constants
// (included via <script> in index.html before this file)

let cpuSpeechHideTimer = null;
let cpuSpeechViewportHandlersBound = false;
const HERO_DEFAULT_LABEL = 'オセロの勇者';
const NETWORK_WAITING_NAME = '接続待ち';
let StatusDisplayOwnerHelpersModule = null;
if (typeof require === 'function') {
    try { StatusDisplayOwnerHelpersModule = require('../utils/owner-helpers'); } catch (e) { /* ignore */ }
}
if (!StatusDisplayOwnerHelpersModule) {
    try {
        if (typeof window !== 'undefined' && window && window.OwnerHelpers) StatusDisplayOwnerHelpersModule = window.OwnerHelpers;
    } catch (e) { /* ignore */ }
}

function normalizeSeatKeyForLabel(value) {
    try {
        if (StatusDisplayOwnerHelpersModule && typeof StatusDisplayOwnerHelpersModule.normalizePlayerKey === 'function') {
            return StatusDisplayOwnerHelpersModule.normalizePlayerKey(value, 'black');
        }
    } catch (e) { /* ignore */ }
    return value === 'white' ? 'white' : 'black';
}

function toSeatLabel(value) {
    return normalizeSeatKeyForLabel(value) === 'white' ? '白' : '黒';
}

function normalizeNetworkDisplayName(value) {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    return normalized;
}

function isNetworkModeForLabels() {
    try {
        if (typeof window === 'undefined' || !window) return false;
        if (window.MatchMode && typeof window.MatchMode.isNetworkModeActive === 'function') {
            return !!window.MatchMode.isNetworkModeActive();
        }
        if (StatusDisplayOwnerHelpersModule && typeof StatusDisplayOwnerHelpersModule.isNetworkMode === 'function') {
            return !!StatusDisplayOwnerHelpersModule.isNetworkMode(window);
        }
        return window.MATCH_MODE === 'network' || window.__MATCH_MODE === 'network';
    } catch (e) {
        return false;
    }
}

function getNetworkSeatNamesForLabels() {
    try {
        if (typeof window !== 'undefined' && window && window.NetworkMatchClient && typeof window.NetworkMatchClient.getSeatNames === 'function') {
            const names = window.NetworkMatchClient.getSeatNames();
            if (names && typeof names === 'object') return names;
        }
    } catch (e) { /* ignore */ }
    return { black: '', white: '' };
}

function getOwnSeatKeyForLabels() {
    try {
        if (StatusDisplayOwnerHelpersModule && typeof StatusDisplayOwnerHelpersModule.resolveLocalPlayerKey === 'function') {
            return normalizeSeatKeyForLabel(StatusDisplayOwnerHelpersModule.resolveLocalPlayerKey(window));
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && window && window.NetworkMatchClient && typeof window.NetworkMatchClient.getSeatKey === 'function') {
            return normalizeSeatKeyForLabel(window.NetworkMatchClient.getSeatKey());
        }
    } catch (e) { /* ignore */ }
    return 'black';
}

function getTutorialStateApiForStatus() {
    try {
        if (typeof window !== 'undefined' && window && window.Tutorial && window.Tutorial.State) {
            return window.Tutorial.State;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function getStoryEncounterApiForStatus() {
    try {
        if (typeof window !== 'undefined' && window && window.Story && window.Story.Encounter) {
            return window.Story.Encounter;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function resolveStoryEncounterCpuPresentation() {
    const encounterApi = getStoryEncounterApiForStatus();
    if (!encounterApi || typeof encounterApi.resolveStoryEncounterPresentation !== 'function') {
        return null;
    }
    return encounterApi.resolveStoryEncounterPresentation();
}

function resolveObserverDuelCpuPresentation() {
    const stateApi = getTutorialStateApiForStatus();
    if (!stateApi || typeof stateApi.isObserverDuelActive !== 'function' || !stateApi.isObserverDuelActive()) {
        return null;
    }

    const scenario = typeof stateApi.getTutorialScenarioContext === 'function'
        ? stateApi.getTutorialScenarioContext()
        : null;
    return {
        imageSrc: scenario && scenario.observerImageSrc ? String(scenario.observerImageSrc) : 'assets/images/cpu/level6.png',
        label: scenario && scenario.observerName ? String(scenario.observerName) : '盤理の観測者',
        fadeOut: !!(scenario && scenario.observerDuelPostResultPhase === 'fade_out')
    };
}

function applyObserverDuelCpuPanelState(observerDuelPresentation, charImg, levelLabel) {
    const panel = document.getElementById('cpu-character-panel');
    const faded = !!(observerDuelPresentation && observerDuelPresentation.fadeOut === true);
    if (panel) {
        panel.style.transition = 'opacity 280ms ease';
        panel.style.opacity = faded ? '0.18' : '1';
    }
    if (charImg) {
        charImg.style.opacity = faded ? '0.18' : '1';
    }
    if (levelLabel) {
        levelLabel.style.opacity = faded ? '0.42' : '1';
    }
}

function applyNetworkSeatLabels(levelLabel) {
    const heroLabel = document.getElementById('hero-label');
    if (!isNetworkModeForLabels()) {
        if (heroLabel) heroLabel.textContent = HERO_DEFAULT_LABEL;
        return false;
    }

    const ownSeatKey = getOwnSeatKeyForLabels();
    const opponentSeatKey = ownSeatKey === 'white' ? 'black' : 'white';
    const seatNames = getNetworkSeatNamesForLabels();

    const ownName = normalizeNetworkDisplayName(seatNames[ownSeatKey]) || 'あなた';
    const opponentName = normalizeNetworkDisplayName(seatNames[opponentSeatKey]) || NETWORK_WAITING_NAME;

    if (heroLabel) {
        heroLabel.textContent = `${toSeatLabel(ownSeatKey)}:${ownName}`;
    }
    if (levelLabel) {
        levelLabel.textContent = `${toSeatLabel(opponentSeatKey)}:${opponentName}`;
    }
    return true;
}

function ensureCpuSpeechBubbleElement() {
    if (typeof document === 'undefined') return null;
    let bubble = document.getElementById('cpu-speech-bubble');
    if (bubble) return bubble;

    bubble = document.createElement('div');
    bubble.id = 'cpu-speech-bubble';
    bubble.setAttribute('aria-live', 'polite');
    bubble.setAttribute('aria-atomic', 'true');
    bubble.setAttribute('role', 'status');
    document.body.appendChild(bubble);
    return bubble;
}

function getCpuSpeechAnchorRect() {
    if (typeof document === 'undefined') return null;
    const img = document.getElementById('cpu-character-img');
    const panel = document.getElementById('cpu-character-panel');
    const target = (img && img.getAttribute('src')) ? img : panel;
    if (!target || typeof target.getBoundingClientRect !== 'function') return null;
    const rect = target.getBoundingClientRect();
    if (!Number.isFinite(rect.left) || !Number.isFinite(rect.top)) return null;
    return rect;
}

function positionCpuSpeechBubble() {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const bubble = ensureCpuSpeechBubbleElement();
    if (!bubble || !bubble.classList.contains('is-visible')) return;
    const rect = getCpuSpeechAnchorRect();
    if (!rect) return;

    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1280;
    const gap = viewportWidth <= 900 ? 14 : 18;

    bubble.style.maxWidth = viewportWidth <= 900
        ? `min(72vw, 320px)`
        : `min(46vw, 420px)`;
    bubble.style.left = `${rect.left + (rect.width / 2)}px`;
    bubble.style.top = `${Math.max(24, rect.top - gap)}px`;

    const bRect = bubble.getBoundingClientRect();
    if (bRect.top < 8) {
        const currentTop = Number.parseFloat(bubble.style.top) || 24;
        bubble.style.top = `${currentTop + (8 - bRect.top)}px`;
    }

    const adjusted = bubble.getBoundingClientRect();
    if (adjusted.left < 8 || adjusted.right > viewportWidth - 8) {
        const currentLeft = Number.parseFloat(bubble.style.left) || (rect.left + (rect.width / 2));
        if (adjusted.left < 8) {
            bubble.style.left = `${currentLeft + (8 - adjusted.left)}px`;
        } else if (adjusted.right > viewportWidth - 8) {
            bubble.style.left = `${currentLeft - (adjusted.right - (viewportWidth - 8))}px`;
        }
    }
}

function bindCpuSpeechViewportHandlers() {
    if (cpuSpeechViewportHandlersBound || typeof window === 'undefined') return;
    cpuSpeechViewportHandlersBound = true;
    const handler = () => {
        try { positionCpuSpeechBubble(); } catch (e) { /* ignore */ }
    };
    window.addEventListener('resize', handler);
    window.addEventListener('orientationchange', handler);
    window.addEventListener('scroll', handler, { passive: true });
}

function hideCpuSpeechBubble() {
    const bubble = ensureCpuSpeechBubbleElement();
    if (!bubble) return;
    bubble.classList.remove('is-visible');
    bubble.textContent = '';
}

function showCpuSpeechBubble(text) {
    const line = String(text || '').trim();
    if (!line || typeof document === 'undefined') return;
    const bubble = ensureCpuSpeechBubbleElement();
    if (!bubble) return;

    bindCpuSpeechViewportHandlers();
    bubble.textContent = line;
    bubble.classList.add('is-visible');
    positionCpuSpeechBubble();

    if (cpuSpeechHideTimer) {
        clearTimeout(cpuSpeechHideTimer);
        cpuSpeechHideTimer = null;
    }
}

function updateStatus() {
    // status element removed; keep CPU character update in sync
    updateCpuCharacter();
}

function applyCpuCharacterLevelScale(charImg, level) {
    if (!charImg) {
        return;
    }

    const levelNumber = Number(level);
    const normalizedLevel = Number.isFinite(levelNumber)
        ? Math.min(6, Math.max(1, Math.round(levelNumber)))
        : 1;
    const CPU_BASE_VISUAL_SCALE = 0.88;
    const levelScale = CPU_BASE_VISUAL_SCALE * (1 + ((normalizedLevel - 1) * 0.1));

    // Keep CPU image on the same stage-based sizing path as other UI elements.
    // Only apply the Lv倍率 via CSS custom property.
    charImg.style.width = '';
    charImg.style.height = '';
    charImg.style.transform = '';
    charImg.style.transformOrigin = '';
    charImg.style.setProperty('--cpu-level-scale', levelScale.toFixed(3));
}

function updateCpuCharacter() {
    const level = cpuSmartness.white || 1;
    const storyEncounterPresentation = resolveStoryEncounterCpuPresentation();
    const observerDuelPresentation = resolveObserverDuelCpuPresentation();
    const specialPresentation = storyEncounterPresentation || observerDuelPresentation;
    const displayLevel = observerDuelPresentation ? 6 : level;
    const charImg = getElement('cpuCharacterImg');
    const levelLabel = getElement('cpuLevelLabel');
    const heroLabel = document.getElementById('hero-label');
    
    if (charImg && levelLabel) {
        const primaryPath = specialPresentation && specialPresentation.imageSrc
            ? String(specialPresentation.imageSrc)
            : `assets/images/cpu/level${displayLevel}.png`;
        const fallbackCandidates = [];
        const levelImagePath = `assets/images/cpu/level${displayLevel}.png`;
        const legacyFallbackPath = `assets/cpu-characters/level${displayLevel}.png`;
        if (levelImagePath !== primaryPath) fallbackCandidates.push(levelImagePath);
        fallbackCandidates.push(legacyFallbackPath);
        let fallbackIndex = 0;
        
        // プリロード + フェード効果（新パス→旧パスの順で試行）
        const img = new Image();
        img.onload = () => {
            charImg.src = img.src;
            applyCpuCharacterLevelScale(charImg, displayLevel);
            applyObserverDuelCpuPanelState(observerDuelPresentation, charImg, levelLabel);
            try { positionCpuSpeechBubble(); } catch (e) { /* ignore */ }
        };
        img.onerror = () => {
            while (fallbackIndex < fallbackCandidates.length) {
                const nextPath = fallbackCandidates[fallbackIndex++];
                if (nextPath && img.src !== nextPath) {
                    img.src = nextPath;
                    return;
                }
            }
            charImg.style.opacity = '0.3';
            charImg.style.transform = '';
            charImg.style.width = '';
            charImg.style.height = '';
            charImg.style.removeProperty('--cpu-level-scale');
            applyObserverDuelCpuPanelState(observerDuelPresentation, charImg, levelLabel);
            console.warn(`敵キャラクター画像が見つかりません: ${primaryPath}`);
        };
        img.src = primaryPath;

        levelLabel.textContent = specialPresentation
            ? specialPresentation.label
            : (CPU_LEVEL_NAMES[level] || 'レベル ' + level);
        if (specialPresentation) {
            if (heroLabel) heroLabel.textContent = HERO_DEFAULT_LABEL;
        } else {
            applyNetworkSeatLabels(levelLabel);
        }
    }
}

if (typeof window !== 'undefined') {
    try { window.showCpuSpeechBubble = showCpuSpeechBubble; } catch (e) { /* ignore */ }
    try { window.hideCpuSpeechBubble = hideCpuSpeechBubble; } catch (e) { /* ignore */ }
    try { window.positionCpuSpeechBubble = positionCpuSpeechBubble; } catch (e) { /* ignore */ }
    try { window.updateCpuCharacter = updateCpuCharacter; } catch (e) { /* ignore */ }
    try { window.updateStatus = updateStatus; } catch (e) { /* ignore */ }
}

function showResult() {
    if (gameState && gameState.__resultShown) return;
    if (gameState) gameState.__resultShown = true;
    const resultToken = gameState ? (gameState.__resultToken = Date.now()) : null;

    const counts = countDiscs(gameState);
    let result;
    if (counts.black > counts.white) {
        result = `黒の勝ち! (黒: ${counts.black}, 白: ${counts.white})`;
    } else if (counts.white > counts.black) {
        result = `白の勝ち! (黒: ${counts.black}, 白: ${counts.white})`;
    } else {
        result = `引き分け! (黒: ${counts.black}, 白: ${counts.white})`;
    }
    // status element removed; log the result instead
    addLog('ゲーム終了: ' + result);


    
    // Show centered result overlay after a short delay
    setTimeout(() => {
        if (resultToken && gameState && gameState.__resultToken !== resultToken) return;
        try { showResultOverlay(); } catch (e) { console.warn('showResultOverlay failed', e); }
    }, 2000);
}

// Create or show a result overlay in the center of the screen.
function showResultOverlay() {
    const counts = countDiscs(gameState);
    let title = '';
    if (counts.black > counts.white) title = '勝利！';
    else if (counts.white > counts.black) title = '敗北...';
    else title = '引き分け';

    // Remove existing overlay if any
    const existing = document.getElementById('result-overlay');
    if (existing) existing.parentNode.removeChild(existing);

    const overlay = document.createElement('div');
    overlay.id = 'result-overlay';
    overlay.className = 'result-overlay';

    const panel = document.createElement('div');
    panel.className = 'result-panel';

    const titleEl = document.createElement('div');
    titleEl.className = 'result-title';
    titleEl.textContent = title;
    panel.appendChild(titleEl);

    const subtitle = document.createElement('div');
    subtitle.className = 'result-subtitle';
    subtitle.textContent = `${counts.black} : ${counts.white}`;
    panel.appendChild(subtitle);

    const countsEl = document.createElement('div');
    countsEl.className = 'result-counts';

    const blackDot = document.createElement('span');
    blackDot.className = 'result-dot black';
    countsEl.appendChild(blackDot);
    const blackText = document.createElement('span');
    blackText.className = 'result-count-text';
    blackText.textContent = ` 黒 ${counts.black}`;
    countsEl.appendChild(blackText);

    const spacer = document.createElement('span');
    spacer.style.width = '24px';
    countsEl.appendChild(spacer);

    const whiteDot = document.createElement('span');
    whiteDot.className = 'result-dot white';
    countsEl.appendChild(whiteDot);
    const whiteText = document.createElement('span');
    whiteText.className = 'result-count-text';
    whiteText.textContent = ` 白 ${counts.white}`;
    countsEl.appendChild(whiteText);

    panel.appendChild(countsEl);

    const btnRow = document.createElement('div');
    btnRow.className = 'result-btn-row';
    const restartBtn = document.createElement('button');
    restartBtn.className = 'premium-btn primary';
    restartBtn.textContent = '再戦';
    restartBtn.addEventListener('click', () => {
        const el = document.getElementById('result-overlay');
        if (el) el.parentNode.removeChild(el);
        if (typeof resetGame === 'function') resetGame();
    });
    const closeBtn = document.createElement('button');
    closeBtn.className = 'premium-btn secondary';
    closeBtn.textContent = '閉じる';
    closeBtn.addEventListener('click', () => {
        const el = document.getElementById('result-overlay');
        if (el) el.parentNode.removeChild(el);
    });
    btnRow.appendChild(restartBtn);
    btnRow.appendChild(closeBtn);
    panel.appendChild(btnRow);

    // Show a single monster (matching CPU difficulty) speaking; no hero line
    (function() {
        const cpuLevel = (cpuSmartness && cpuSmartness.white) ? cpuSmartness.white : 1;

        const outcomeKey = counts.black > counts.white ? 'win' : (counts.black < counts.white ? 'lose' : 'draw');
        // Monster perspective: if player (黒) wins, monster lost
        const monsterOutcome = outcomeKey === 'win' ? 'lose' : (outcomeKey === 'lose' ? 'win' : 'draw');

        const dialogContainer = document.createElement('div');
        dialogContainer.className = 'result-dialogues';

        const row = document.createElement('div');
        row.className = 'dialogue-row monster';
        const name = document.createElement('div'); name.className = 'character-name'; name.textContent = CPU_LEVEL_NAMES[cpuLevel] || (`モンスターLv${cpuLevel}`);
        const text = document.createElement('div'); text.className = 'dialogue-text';
        const speech = getDialogueForOutcome(cpuLevel, monsterOutcome);
        text.textContent = speech ? `「${speech}」` : '';
        row.appendChild(name); row.appendChild(text);
        dialogContainer.appendChild(row);

        panel.appendChild(dialogContainer);
    })();

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
}
