const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = 'https://card-othello-match.jqt236i.workers.dev';
const VIEWPORT = { width: 1440, height: 1200 };
const OUT_DIR = path.join(process.cwd(), 'tmp', 'playwright-network-verify');
const RESULT_PATH = path.join(OUT_DIR, 'result.json');

fs.mkdirSync(OUT_DIR, { recursive: true });

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForGameReady(page) {
    await page.waitForFunction(() => {
        try {
            return !!(window.NetworkMatchClient && window.gameState && window.cardState);
        } catch (e) {
            return false;
        }
    }, { timeout: 30000 });
}

async function waitForPlaybackIdle(page) {
    try {
        await page.waitForFunction(() => {
            try {
                const layer = document.getElementById('handLayer');
                const wrapper = document.getElementById('handWrapper');
                const movingCard = !!(layer && layer.querySelector('.card-item.visible'));
                const heldDrawCard = !!(wrapper && wrapper.querySelector('.held-draw-card'));
                const layerVisible = !!(layer && layer.style && layer.style.display === 'block');
                const busy = !!(window.VisualPlaybackActive || window.isCardAnimating || window.isProcessing || movingCard || heldDrawCard || layerVisible);
                return !busy;
            } catch (e) {
                return true;
            }
        }, { timeout: 15000 });
    } catch (e) {
        // best-effort only
    }
}

async function openNetworkDialog(page, playerName) {
    await page.getByRole('button', { name: 'ネット対戦' }).click();
    await page.waitForFunction(() => {
        try {
            return window.MATCH_MODE === 'network' || window.__MATCH_MODE === 'network';
        } catch (e) {
            return false;
        }
    }, { timeout: 10000 });
    await page.getByRole('textbox', { name: '名前を入力してください' }).fill(playerName);
}

async function createRoom(page, playerName) {
    await openNetworkDialog(page, playerName);
    await page.getByRole('button', { name: '部屋作成' }).click();
    const roomInput = page.getByRole('textbox', { name: '部屋番号（3桁）' });
    await page.waitForFunction(() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        const room = inputs.find((input) => String(input.getAttribute('placeholder') || '').includes('部屋番号'));
        return !!(room && /^[A-Z0-9]{3}$/.test(room.value));
    }, { timeout: 15000 });
    return roomInput.inputValue();
}

async function joinRoom(page, roomId, playerName) {
    await openNetworkDialog(page, playerName);
    await page.getByRole('textbox', { name: '部屋番号（3桁）' }).fill(roomId);
    await page.getByRole('button', { name: '参加' }).click();
}

async function waitForTwoPlayers(page) {
    await page.waitForFunction(() => {
        try {
            return !!(window.NetworkMatchClient && typeof window.NetworkMatchClient.hasTwoPlayers === 'function' && window.NetworkMatchClient.hasTwoPlayers());
        } catch (e) {
            return false;
        }
    }, { timeout: 20000 });
}

async function remoteCardUseCheck(blackPage, whitePage) {
    const bogusRect = { left: 1200, top: 1000, width: 90, height: 120, right: 1290, bottom: 1120 };

    const [cardUseHandle, publishResult] = await Promise.all([
        whitePage.waitForFunction(() => {
            try {
                const layer = document.getElementById('handLayer');
                const cards = layer ? Array.from(layer.querySelectorAll('.card-item.visible')) : [];
                if (!cards.length) return false;
                const card = cards[0];
                const rect = card.getBoundingClientRect();
                return {
                    count: cards.length,
                    left: rect.left,
                    top: rect.top,
                    right: rect.right,
                    bottom: rect.bottom,
                    width: rect.width,
                    height: rect.height,
                    text: (card.textContent || '').trim(),
                    innerWidth: window.innerWidth,
                    innerHeight: window.innerHeight
                };
            } catch (e) {
                return false;
            }
        }, { timeout: 10000 }),
        blackPage.evaluate(async (payload) => {
            return window.NetworkMatchClient.publishSnapshot({
                actionType: 'use_card',
                playerKey: 'black',
                playbackEvents: [{
                    type: 'card_use_animation',
                    phase: 1,
                    targets: [{
                        player: 'black',
                        owner: 'black',
                        cardId: 'sample_card',
                        name: 'Sample Card',
                        cost: 5,
                        sourceCardRect: payload
                    }]
                }]
            });
        }, bogusRect)
    ]);

    const observed = await cardUseHandle.jsonValue();
    const screenshotPath = path.join(OUT_DIR, 'remote-card-use.png');
    await whitePage.screenshot({ path: screenshotPath, animations: 'disabled' });

    return {
        bogusRect,
        publishResult,
        observed,
        screenshotPath,
        passed: !!(publishResult && publishResult.ok)
            && !!observed
            && observed.count === 1
            && observed.top < (observed.innerHeight / 2)
            && Math.abs(observed.top - bogusRect.top) > 250
    };
}

async function remoteHandAddCheck(blackPage, whitePage) {
    const [drawHandle, publishResult] = await Promise.all([
        whitePage.waitForFunction(() => {
            try {
                const wrapper = document.getElementById('handWrapper');
                const cards = wrapper ? Array.from(wrapper.querySelectorAll('.held-draw-card')) : [];
                if (!cards.length) return false;
                const card = cards[0];
                const rect = card.getBoundingClientRect();
                return {
                    count: cards.length,
                    left: rect.left,
                    top: rect.top,
                    right: rect.right,
                    bottom: rect.bottom,
                    width: rect.width,
                    height: rect.height,
                    className: card.className,
                    innerWidth: window.innerWidth,
                    innerHeight: window.innerHeight
                };
            } catch (e) {
                return false;
            }
        }, { timeout: 10000 }),
        blackPage.evaluate(async () => {
            return window.NetworkMatchClient.publishSnapshot({
                actionType: 'draw_card',
                playerKey: 'black',
                playbackEvents: [{
                    type: 'hand_add',
                    phase: 1,
                    targets: [{
                        player: 'black',
                        cardId: 'draw_test_card',
                        count: 1
                    }]
                }]
            });
        })
    ]);

    const observed = await drawHandle.jsonValue();
    const screenshotPath = path.join(OUT_DIR, 'remote-hand-add.png');
    await whitePage.screenshot({ path: screenshotPath, animations: 'disabled' });

    return {
        publishResult,
        observed,
        screenshotPath,
        passed: !!(publishResult && publishResult.ok)
            && !!observed
            && observed.count === 1
            && /held-draw-card/.test(String(observed.className || ''))
            && observed.top < (observed.innerHeight / 2)
    };
}

async function main() {
    const browser = await chromium.launch({ headless: true });
    const blackContext = await browser.newContext({ viewport: VIEWPORT });
    const whiteContext = await browser.newContext({ viewport: VIEWPORT });
    const blackPage = await blackContext.newPage();
    const whitePage = await whiteContext.newPage();

    const result = {
        ok: false,
        baseUrl: BASE_URL,
        timestamp: new Date().toISOString(),
        roomId: null,
        seats: null,
        cardUse: null,
        handAdd: null,
        error: null
    };

    try {
        await Promise.all([
            blackPage.goto(BASE_URL, { waitUntil: 'domcontentloaded' }),
            whitePage.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
        ]);
        await Promise.all([waitForGameReady(blackPage), waitForGameReady(whitePage)]);

        const roomId = await createRoom(blackPage, 'P1');
        result.roomId = roomId;

        await joinRoom(whitePage, roomId, 'P2');
        await Promise.all([waitForTwoPlayers(blackPage), waitForTwoPlayers(whitePage)]);

        await wait(1500);
        await Promise.all([waitForPlaybackIdle(blackPage), waitForPlaybackIdle(whitePage)]);

        result.seats = {
            blackPage: await blackPage.evaluate(() => ({
                seatKey: window.NetworkMatchClient.getSeatKey(),
                matchMode: window.MATCH_MODE || window.__MATCH_MODE
            })),
            whitePage: await whitePage.evaluate(() => ({
                seatKey: window.NetworkMatchClient.getSeatKey(),
                matchMode: window.MATCH_MODE || window.__MATCH_MODE
            }))
        };

        result.cardUse = await remoteCardUseCheck(blackPage, whitePage);
        await wait(1200);
        await Promise.all([waitForPlaybackIdle(blackPage), waitForPlaybackIdle(whitePage)]);

        result.handAdd = await remoteHandAddCheck(blackPage, whitePage);
        await wait(1200);

        result.ok = !!(result.cardUse && result.cardUse.passed && result.handAdd && result.handAdd.passed);
    } catch (error) {
        result.error = error && error.stack ? error.stack : String(error);
    } finally {
        try {
            await blackPage.evaluate(async () => {
                if (window.NetworkMatchClient && typeof window.NetworkMatchClient.leaveRoom === 'function') {
                    await window.NetworkMatchClient.leaveRoom();
                }
            });
        } catch (e) { /* ignore */ }
        try {
            await whitePage.evaluate(async () => {
                if (window.NetworkMatchClient && typeof window.NetworkMatchClient.leaveRoom === 'function') {
                    await window.NetworkMatchClient.leaveRoom();
                }
            });
        } catch (e) { /* ignore */ }

        await blackContext.close();
        await whiteContext.close();
        await browser.close();
    }

    fs.writeFileSync(RESULT_PATH, JSON.stringify(result, null, 2), 'utf8');
    if (result.ok) {
        process.stdout.write(`verification succeeded: ${RESULT_PATH}\n`);
        process.exit(0);
    }
    process.stderr.write(`verification failed: ${RESULT_PATH}\n`);
    process.exit(1);
}

main();