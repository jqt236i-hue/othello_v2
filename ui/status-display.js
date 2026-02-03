// ===== Status Display =====
// Import difficulty level constants
// (included via <script> in index.html before this file)

function updateStatus() {
    // status element removed; keep CPU character update in sync
    updateCpuCharacter();
}

function updateCpuCharacter() {
    const level = cpuSmartness.white || 1;
    const charImg = getElement('cpuCharacterImg');
    const levelLabel = getElement('cpuLevelLabel');
    
    if (charImg && levelLabel) {
        const primaryPath = `assets/images/cpu/level${level}.png`;
        const fallbackPath = `assets/cpu-characters/level${level}.png`;
        
        // プリロード + フェード効果（新パス→旧パスの順で試行）
        const img = new Image();
        img.onload = () => {
            charImg.src = img.src;
            charImg.style.opacity = '1';
            // レベルに応じてサイズを 6% 増しで設定（level1:+0% ... level4:+18%）。
            // ただし level5 は level4 より 10% 大きくする
            // 仕様変更: 各レベルをさらに30%拡大する（全レベルに対して +30%）
            // transform: scale() で中心から均等に拡大
            const scaleLevel = Math.min(level, 5); // Lv6 も Lv5 と同サイズ
            let baseScale = 1 + ((scaleLevel - 1) * 0.06);
            if (scaleLevel >= 5) {
                const scaleLevel4 = 1 + ((4 - 1) * 0.06); // level4 のスケール
                baseScale = scaleLevel4 * 1.10; // level5/6 は level4 の 110%
            }
            // Apply global shrink factor to reduce sizes by 38% (i.e., keep 62%)
            // Then increase monster images by 23% as requested
            const SIZE_SHRINK = 0.62;
            const MONSTER_BOOST = 1.23; // +23%
            const scaleValue = baseScale * 1.3 * MONSTER_BOOST * SIZE_SHRINK; // apply level base, +30%, +23%, then shrink
            charImg.style.transform = `scale(${scaleValue})`;
            // Adjust displayed pixel size accordingly (279px * 1.23 ≈ 343px)
            charImg.style.width = '343px';
            charImg.style.height = '343px';
        };
        img.onerror = () => {
            if (img.src.endsWith(primaryPath)) {
                // 新構成が見つからなければ旧構成にフォールバック
                img.src = fallbackPath;
            } else {
                charImg.style.opacity = '0.3';
                // エラー時にはデフォルトサイズに戻す
                charImg.style.width = '';
                charImg.style.height = '';
                console.warn(`敵キャラクター画像が見つかりません: ${primaryPath} / ${fallbackPath}`);
            }
        };
        img.src = primaryPath;

        levelLabel.textContent = CPU_LEVEL_NAMES[level] || 'レベル ' + level;
    }
}

function showResult() {
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


    
    // Show centered result overlay
    try { showResultOverlay(); } catch (e) { console.warn('showResultOverlay failed', e); }
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
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn result-close-btn';
    closeBtn.textContent = '閉じる';
    closeBtn.addEventListener('click', () => {
        const el = document.getElementById('result-overlay');
        if (el) el.parentNode.removeChild(el);
    });
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
