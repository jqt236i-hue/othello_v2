import StoneSupply = require('../shared/stone-supply');

type SupplyColor = 'black' | 'white';
const MAX_VISIBLE_STONES = 30;

/** Frame chrome only: never writes cells/canvas or changes the canonical supply. */
function createTray(frame: HTMLElement, color: SupplyColor): HTMLElement {
    const doc = frame.ownerDocument;
    const tray = doc.createElement('div');
    tray.className = `board-stone-supply board-stone-supply--${color}`;
    tray.dataset.player = color;
    tray.hidden = true;
    const label = doc.createElement('span');
    label.className = 'board-stone-supply-label';
    label.textContent = '持ち石';
    label.setAttribute('aria-hidden', 'true');
    const stack = doc.createElement('div');
    stack.className = 'board-stone-supply-stack';
    stack.setAttribute('aria-hidden', 'true');
    const count = doc.createElement('span');
    count.className = 'board-stone-supply-count';
    count.setAttribute('aria-hidden', 'true');
    tray.append(label, stack, count);
    frame.appendChild(tray);
    return tray;
}

export function renderStoneSupplyTrays(frame: HTMLElement | null, cardState: unknown): void {
    if (!frame) return;
    const black = StoneSupply.getStoneSupplyRemaining(cardState, 'black');
    const white = StoneSupply.getStoneSupplyRemaining(cardState, 'white');
    if (black === null || white === null) {
        frame.querySelectorAll<HTMLElement>('.board-stone-supply').forEach((tray) => {
            tray.hidden = true;
            tray.removeAttribute('aria-label');
            tray.removeAttribute('title');
            delete tray.dataset.remaining;
            delete tray.dataset.supplySignature;
            tray.querySelector('.board-stone-supply-stack')?.replaceChildren();
            const count = tray.querySelector('.board-stone-supply-count');
            if (count) count.textContent = '';
        });
        return;
    }

    // Keep the initial capacity fixed throughout a match, so the two columns
    // share a scale and do not stretch back to full height after each move.
    const rawInitial = Number((cardState as { stoneSupply?: { initial?: unknown } })?.stoneSupply?.initial);
    const initial = Math.max(1, Number.isFinite(rawInitial) ? Math.floor(rawInitial) : 0, black, white);
    const slots = Math.min(MAX_VISIBLE_STONES, initial);
    const remainingByColor = { black, white };
    for (const color of ['white', 'black'] as const) {
        const remaining = remainingByColor[color];
        const tray = frame.querySelector<HTMLElement>(`.board-stone-supply--${color}`) || createTray(frame, color);
        const signature = `${initial}/${remaining}`;
        if (tray.dataset.supplySignature === signature) continue;
        tray.hidden = false;
        tray.dataset.supplySignature = signature;
        tray.dataset.remaining = String(remaining);
        tray.classList.toggle('has-large-count', remaining >= 100);
        tray.setAttribute('role', 'img');
        tray.setAttribute('aria-label', `${color === 'black' ? '黒' : '白'}の持ち石 ${remaining}枚`);
        tray.title = `${color === 'black' ? '黒' : '白'}の持ち石: ${remaining}枚`;
        tray.style.setProperty('--supply-slots', String(slots));
        const count = tray.querySelector('.board-stone-supply-count');
        if (count) count.textContent = String(remaining);
        const stack = tray.querySelector<HTMLElement>('.board-stone-supply-stack');
        if (!stack) continue;
        const visibleCount = Math.min(slots, Math.ceil(remaining * slots / initial));
        // Preserve unchanged discs; removing the top exposes the next stone.
        while (stack.children.length > visibleCount) stack.lastElementChild?.remove();
        while (stack.children.length < visibleCount) {
            const disc = frame.ownerDocument.createElement('span');
            disc.className = 'board-stone-supply-disc';
            disc.style.setProperty('--supply-index', String(stack.children.length));
            stack.appendChild(disc);
        }
    }
}
