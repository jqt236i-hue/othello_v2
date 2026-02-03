/**
 * @file result-overlay.js
 * @description ゲーム終了時の結果表示オーバーレイ
 */

/**
 * 結果を表示
 * Show game result in log and overlay
 */
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
    addLog('ゲーム終了: ' + result);



    // Show centered result overlay
    try { showResultOverlay(); } catch (e) { console.warn('showResultOverlay failed', e); }
}

/**
 * 結果オーバーレイを表示
 * Create or show a result overlay in the center of the screen
 */
function showResultOverlay() {
    const counts = countDiscs(gameState);
    let title = '';
    let statusClass = '';

    if (counts.black > counts.white) {
        title = 'VICTORY';
        statusClass = 'win';
    } else if (counts.white > counts.black) {
        title = 'DEFEAT';
        statusClass = 'lose';
    } else {
        title = 'DRAW';
        statusClass = 'draw';
    }

    // Remove existing overlay if any
    const existing = document.getElementById('result-overlay');
    if (existing) existing.parentNode.removeChild(existing);

    const overlay = document.createElement('div');
    overlay.id = 'result-overlay';
    overlay.className = `result-overlay ${statusClass}`;

    const panel = document.createElement('div');
    panel.className = 'result-panel glass-morphism';

    const titleEl = document.createElement('div');
    titleEl.className = 'result-title main-title';
    titleEl.textContent = title;
    panel.appendChild(titleEl);

    const scoreRow = document.createElement('div');
    scoreRow.className = 'result-score-row';

    const blackScore = document.createElement('div');
    blackScore.className = 'score-item black-player';
    blackScore.innerHTML = `<span class="score-label">PLAYER</span><span class="score-value">${counts.black}</span>`;

    const vsLabel = document.createElement('div');
    vsLabel.className = 'vs-label';
    vsLabel.textContent = 'VS';

    const whiteScore = document.createElement('div');
    whiteScore.className = 'score-item white-player';
    whiteScore.innerHTML = `<span class="score-label">MONSTER</span><span class="score-value">${counts.white}</span>`;

    scoreRow.appendChild(blackScore);
    scoreRow.appendChild(vsLabel);
    scoreRow.appendChild(whiteScore);
    panel.appendChild(scoreRow);

    // Monster speech area
    const dialogContainer = createMonsterDialogue(counts);
    panel.appendChild(dialogContainer);

    const btnRow = document.createElement('div');
    btnRow.className = 'result-btn-row';

    const restartBtn = document.createElement('button');
    restartBtn.className = 'premium-btn primary';
    restartBtn.textContent = 'もう一度プレイ';
    restartBtn.onclick = () => {
        const el = document.getElementById('result-overlay');
        if (el) el.parentNode.removeChild(el);
        resetGame();
    };

    const closeBtn = document.createElement('button');
    closeBtn.className = 'premium-btn secondary';
    closeBtn.textContent = '閉じる';
    closeBtn.onclick = () => {
        const el = document.getElementById('result-overlay');
        if (el) el.parentNode.removeChild(el);
    };

    btnRow.appendChild(restartBtn);
    btnRow.appendChild(closeBtn);
    panel.appendChild(btnRow);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // Trigger entrance animation with a tiny delay
    setTimeout(() => {
        overlay.classList.add('active');
    }, 10);
}

/**
 * モンスターの台詞を作成
 * Create monster dialogue based on game outcome
 * @param {Object} counts - 石の数 {black, white}
 * @returns {HTMLElement} ダイアログコンテナ
 */
function createMonsterDialogue(counts) {
    const levelNames = ['不明', '盤喰いの小鬼', '反転の影', '布石を紡ぐ者', '盤面支配者', '終局を告げる者', '盤理の観測者'];
    const cpuLevel = (cpuSmartness && cpuSmartness.white) ? cpuSmartness.white : 1;

    const outcomeKey = counts.black > counts.white ? 'win' : (counts.black < counts.white ? 'lose' : 'draw');
    // Monster perspective: if player (黒) wins, monster lost
    const monsterOutcome = outcomeKey === 'win' ? 'lose' : (outcomeKey === 'lose' ? 'win' : 'draw');

    const monsters = getMonsterDialogues();

    const dialogContainer = document.createElement('div');
    dialogContainer.className = 'result-dialogues';

    const row = document.createElement('div');
    row.className = 'dialogue-row monster';
    const name = document.createElement('div');
    name.className = 'character-name';
    name.textContent = levelNames[cpuLevel] || (`モンスターLv${cpuLevel}`);
    const text = document.createElement('div');
    text.className = 'dialogue-text';

    let speech = '';
    if (monsters[cpuLevel]) {
        const entry = monsters[cpuLevel][monsterOutcome];
        if (Array.isArray(entry)) {
            speech = entry[Math.floor(Math.random() * entry.length)];
        } else {
            speech = entry || '';
        }
    }
    text.textContent = speech ? `「${speech}」` : '';
    row.appendChild(name);
    row.appendChild(text);
    dialogContainer.appendChild(row);

    return dialogContainer;
}

/**
 * モンスター台詞データ取得
 * Get monster dialogue data
 * @returns {Object} モンスター台詞データ
 */
function getMonsterDialogues() {
    return {
        1: {
            win: ['ふふ、これが実力差だ。', 'ざまぁみろ、やっぱり甘いな。', '見たか、人間の限界はそこだ。', 'その程度で満足か？もっと来い！', 'へっ、期待外れだな。'],
            lose: ['くそっ…次は許さない！', 'うわ、強い…撤退！', 'ぐぬぬ…悔しい！', 'やられた…くそっ！', 'ふざけるな、もう一度！'],
            draw: 'ふん、次は勝つ。'
        },
        2: {
            win: ['人間ごときが勝てると思うか？', '小手調べにしては上出来すぎるな、だが甘い。', 'お前の一手は読めていた、次も無駄だぞ。', '余裕だ、見どころはそこか。', 'へへ、捻り潰すのは簡単だ。'],
            lose: ['ぐぬぬ…見くびられたか！', 'くっ…いつか返してやる！', '許せん…次は策を変える！', 'く、悔しい…影が薄れる…', 'こんなところで負ける訳には…！'],
            draw: '互角だな、悪くない。'
        },
        3: {
            win: ['読みが浅い、こちらの方が一枚上手だ。', '計略通り、術中にはまったようだな。', '面白い…だが力が足りぬ。', 'その程度で満足するな、もっと来い。', 'やはり私の読みには敵わない。'],
            lose: ['くっ…布石が乱れた…', 'ぬう…計算が狂った！', '悔しい、次は読み切ってやる！', 'ちっ…隙を突かれたか！', 'このままでは終わらん！'],
            draw: '悪くない、また会おう。'
        },
        4: {
            win: ['盤面は我が庭だ、踏み外すな。', '圧倒的だ、楽しませてもらったぞ。', '支配者の名は伊達ではない。', '一手で崩れるその脆さ、笑うしかないな。', '情けは無用、次も蹂躙してやる。'],
            lose: ['面を割られた…許さん！', 'どうして…支配が崩れるなど！', 'く、屈辱だ…練り直す！', '次は徹底的に仕返ししてやる！', 'まさかの敗北、受け入れがたし！'],
            draw: '興味深い、引き分けもまた一興。'
        },
        5: {
            win: ['貴様の全てはここで潰えた。', 'これが頂点と凡庸の差だ。', '跪け、そして学べ。', '無様だ…私の前に立つ資格なし。', '終焉を見届けた、これが実力だ。'],
            lose: ['……認めたくないが悔しい。', 'まさかの敗北、されど次は違う。', 'く、実力を見誤った…屈辱だ。', '負けを糧にし、研鑽を積むのみ。', '敗北は痛いが、次こそは必ず。'],
            draw: '…よい試合だった。'
        },
        6: {
            win: ['盤理は語る、最善は唯一。', '三十手先まで視えている、抵抗は無意味だ。', '観測の果て、君の手は既に詰んでいる。', '全局面は掌中にある、迷いはない。', '決定済みの未来だ、ただ受け入れよ。'],
            lose: ['ほう…観測を上回るとは。次は修正する。', '一瞬の乱数か、だが再び誤算は許さぬ。', '興味深い偏差だ。次は収束させよう。', '想定外…ならば分岐を削り、必勝へ向かう。', 'わずかな誤差だ。再計算で終わる。'],
            draw: '観測結果は拮抗。次は差を証明しよう。'
        }
    };
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        showResult,
        showResultOverlay,
        createMonsterDialogue,
        getMonsterDialogues
    };
}
