export {};

type DestroySourceAnimationDeps = {
    isNoAnim: () => boolean;
    getCellEl: (row: any, col: any) => any;
    resolveSniperSource: (target: any) => any;
    resolveRobotVacuumSource: (target: any) => any;
    resolveDestroyDragonSource: (target: any) => any;
    waitForAnimationFinish: (anim: any, durationMs: any, timeoutPaddingMs: any) => Promise<void>;
    sleep: (ms: any) => Promise<void>;
    timer: () => any;
    playbackScope: any;
};

function resolveSniperProjectileOwner(target: any) {
    const t = (target && typeof target === 'object') ? target : {};
    const meta = (t.meta && typeof t.meta === 'object') ? t.meta : {};
    const directOwner = (typeof t.projectileOwner === 'string') ? t.projectileOwner : null;
    const metaOwner = (typeof meta.projectileOwner === 'string') ? meta.projectileOwner : null;
    const owner = (directOwner || metaOwner || '').toLowerCase();
    if (owner === 'black' || owner === 'white') return owner;
    if (t.ownerBefore === 'black') return 'white';
    if (t.ownerBefore === 'white') return 'black';
    return 'black';
}

async function animateSniperProjectile(target: any, deps: DestroySourceAnimationDeps) {
    if (!target) return;
    if (deps.isNoAnim()) return;

    const source = deps.resolveSniperSource(target);
    if (!source) return;

    const fromCell = deps.getCellEl(source.row, source.col);
    const toCell = deps.getCellEl(target.r, target.col);
    if (!fromCell || !toCell) return;

    const fromRect = fromCell.getBoundingClientRect();
    const toRect = toCell.getBoundingClientRect();
    const owner = resolveSniperProjectileOwner(target);
    const imgPath = owner === 'white'
        ? 'assets/images/stones/normal_stone-white.png'
        : 'assets/images/stones/normal_stone-black.png';

    const sourceDiscScale = 0.82;
    const projectileScale = 0.25;
    const projectileSize = Math.max(8, Math.round(Math.min(fromRect.width, fromRect.height) * sourceDiscScale * projectileScale));

    const startX = fromRect.left + (fromRect.width / 2) - (projectileSize / 2);
    const startY = fromRect.top + (fromRect.height / 2) - (projectileSize / 2);
    const deltaX = (toRect.left + (toRect.width / 2)) - (fromRect.left + (fromRect.width / 2));
    const deltaY = (toRect.top + (toRect.height / 2)) - (fromRect.top + (fromRect.height / 2));

    const projectile = document.createElement('div');
    projectile.style.position = 'fixed';
    projectile.style.left = `${startX}px`;
    projectile.style.top = `${startY}px`;
    projectile.style.width = `${projectileSize}px`;
    projectile.style.height = `${projectileSize}px`;
    projectile.style.borderRadius = '50%';
    projectile.style.backgroundImage = `url('${imgPath}')`;
    projectile.style.backgroundSize = '100% 100%';
    projectile.style.backgroundRepeat = 'no-repeat';
    projectile.style.backgroundPosition = 'center';
    projectile.style.pointerEvents = 'none';
    projectile.style.zIndex = '1200';
    projectile.style.margin = '0';

    document.body.appendChild(projectile);

    const travelPx = Math.hypot(deltaX, deltaY);
    const durationMs = Math.max(120, Math.min(420, Math.round(90 + (travelPx * 0.35))));
    const anim = projectile.animate([
        { transform: 'translate(0, 0)', opacity: 1 },
        { transform: `translate(${deltaX}px, ${deltaY}px)`, opacity: 1 }
    ], {
        duration: durationMs,
        easing: 'linear'
    });

    await deps.waitForAnimationFinish(anim, durationMs, 120);

    if (projectile.parentElement) projectile.parentElement.removeChild(projectile);
}

async function animateRobotVacuumSuction(target: any, deps: DestroySourceAnimationDeps) {
    if (!target) return;
    if (deps.isNoAnim()) return;

    const source = deps.resolveRobotVacuumSource(target);
    if (!source) return;

    const fromCell = deps.getCellEl(target.r, target.col);
    const toCell = deps.getCellEl(source.row, source.col);
    if (!fromCell || !toCell) return;

    const fromRect = fromCell.getBoundingClientRect();
    const toRect = toCell.getBoundingClientRect();

    const ownerBefore = String(target.ownerBefore || '').toLowerCase();
    const imgPath = ownerBefore === 'white'
        ? 'assets/images/stones/normal_stone-white.png'
        : 'assets/images/stones/normal_stone-black.png';

    const sourceDiscScale = 0.82;
    const projectileScale = 1;
    const projectileSize = Math.max(18, Math.round(Math.min(fromRect.width, fromRect.height) * sourceDiscScale * projectileScale));

    const startX = fromRect.left + (fromRect.width / 2) - (projectileSize / 2);
    const startY = fromRect.top + (fromRect.height / 2) - (projectileSize / 2);
    const deltaX = (toRect.left + (toRect.width / 2)) - (fromRect.left + (fromRect.width / 2));
    const deltaY = (toRect.top + (toRect.height / 2)) - (fromRect.top + (fromRect.height / 2));

    const projectile = document.createElement('div');
    projectile.style.position = 'fixed';
    projectile.style.left = `${startX}px`;
    projectile.style.top = `${startY}px`;
    projectile.style.width = `${projectileSize}px`;
    projectile.style.height = `${projectileSize}px`;
    projectile.style.borderRadius = '50%';
    projectile.style.backgroundImage = `url('${imgPath}')`;
    projectile.style.backgroundSize = '100% 100%';
    projectile.style.backgroundRepeat = 'no-repeat';
    projectile.style.backgroundPosition = 'center';
    projectile.style.pointerEvents = 'none';
    projectile.style.zIndex = '1200';
    projectile.style.margin = '0';

    document.body.appendChild(projectile);

    const travelPx = Math.hypot(deltaX, deltaY);
    const durationMs = Math.max(140, Math.min(360, Math.round(140 + (travelPx * 0.28))));
    const anim = projectile.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${deltaX}px, ${deltaY}px) scale(0.68)`, opacity: 0.78 }
    ], {
        duration: durationMs,
        easing: 'cubic-bezier(0.2, 0.9, 0.25, 1)'
    });

    await deps.waitForAnimationFinish(anim, durationMs, 120);

    if (projectile.parentElement) projectile.parentElement.removeChild(projectile);
}

async function animateDestroyDragonBreath(target: any, deps: DestroySourceAnimationDeps) {
    if (!target) return;
    if (deps.isNoAnim()) return;

    const source = deps.resolveDestroyDragonSource(target);
    if (!source) return;

    const fromCell = deps.getCellEl(source.row, source.col);
    const toCell = deps.getCellEl(target.r, target.col);
    if (!fromCell || !toCell) return;

    const fromRect = fromCell.getBoundingClientRect();
    const toRect = toCell.getBoundingClientRect();

    const fromX = fromRect.left + (fromRect.width / 2);
    const fromY = fromRect.top + (fromRect.height / 2);
    const toX = toRect.left + (toRect.width / 2);
    const toY = toRect.top + (toRect.height / 2);

    const deltaX = toX - fromX;
    const deltaY = toY - fromY;
    const distance = Math.max(1, Math.hypot(deltaX, deltaY));
    const angleDeg = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
    const durationMs = Math.max(280, Math.min(520, Math.round(240 + (distance * 0.28))));

    const layer = document.createElement('div');
    layer.style.position = 'fixed';
    layer.style.left = '0';
    layer.style.top = '0';
    layer.style.width = '100vw';
    layer.style.height = '100vh';
    layer.style.pointerEvents = 'none';
    layer.style.zIndex = '1250';

    const beam = document.createElement('div');
    beam.style.position = 'fixed';
    beam.style.left = `${fromX}px`;
    beam.style.top = `${fromY - 4}px`;
    beam.style.width = `${distance}px`;
    beam.style.height = '8px';
    beam.style.transformOrigin = '0 50%';
    beam.style.transform = `rotate(${angleDeg}deg) scaleX(0.2)`;
    beam.style.borderRadius = '999px';
    beam.style.background = 'linear-gradient(90deg, rgba(255,235,150,0.95) 0%, rgba(255,150,40,0.95) 48%, rgba(255,70,20,0.85) 100%)';
    beam.style.boxShadow = '0 0 14px rgba(255,120,30,0.85), 0 0 24px rgba(255,70,20,0.6)';
    beam.style.opacity = '0';

    const muzzle = document.createElement('div');
    muzzle.style.position = 'fixed';
    muzzle.style.left = `${fromX - 8}px`;
    muzzle.style.top = `${fromY - 8}px`;
    muzzle.style.width = '16px';
    muzzle.style.height = '16px';
    muzzle.style.borderRadius = '50%';
    muzzle.style.background = 'radial-gradient(circle, rgba(255,245,190,0.95) 0%, rgba(255,154,40,0.9) 45%, rgba(255,80,20,0.15) 100%)';
    muzzle.style.boxShadow = '0 0 16px rgba(255,150,40,0.9)';
    muzzle.style.opacity = '0';

    const impact = document.createElement('div');
    impact.style.position = 'fixed';
    impact.style.left = `${toX - 16}px`;
    impact.style.top = `${toY - 16}px`;
    impact.style.width = '32px';
    impact.style.height = '32px';
    impact.style.borderRadius = '50%';
    impact.style.background = 'radial-gradient(circle, rgba(255,255,220,0.95) 0%, rgba(255,145,30,0.88) 40%, rgba(255,70,20,0.05) 100%)';
    impact.style.boxShadow = '0 0 22px rgba(255,130,25,0.85)';
    impact.style.opacity = '0';
    impact.style.transform = 'scale(0.35)';

    layer.appendChild(beam);
    layer.appendChild(muzzle);
    layer.appendChild(impact);
    document.body.appendChild(layer);

    await new Promise<void>((resolve) => {
        let timeoutId: any = null;
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            if (timeoutId !== null) {
                try { deps.timer().clearTimeout(timeoutId); } catch (e: any) { /* ignore */ }
                timeoutId = null;
            }
            resolve();
        };

        try {
            if (beam.animate) {
                beam.animate([
                    { offset: 0, opacity: 0, transform: `rotate(${angleDeg}deg) scaleX(0.2)` },
                    { offset: 0.18, opacity: 1, transform: `rotate(${angleDeg}deg) scaleX(1)` },
                    { offset: 0.72, opacity: 0.94, transform: `rotate(${angleDeg}deg) scaleX(1)` },
                    { offset: 1, opacity: 0, transform: `rotate(${angleDeg}deg) scaleX(0.92)` }
                ], {
                    duration: durationMs,
                    easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)'
                });
            }
            if (muzzle.animate) {
                muzzle.animate([
                    { offset: 0, opacity: 0, transform: 'scale(0.35)' },
                    { offset: 0.24, opacity: 1, transform: 'scale(1.08)' },
                    { offset: 0.68, opacity: 0.86, transform: 'scale(0.98)' },
                    { offset: 1, opacity: 0, transform: 'scale(0.7)' }
                ], {
                    duration: Math.max(220, durationMs - 30),
                    easing: 'ease-out'
                });
            }
            if (impact.animate) {
                impact.animate([
                    { offset: 0, opacity: 0, transform: 'scale(0.35)' },
                    { offset: 0.22, opacity: 1, transform: 'scale(1.15)' },
                    { offset: 0.7, opacity: 0.88, transform: 'scale(1.35)' },
                    { offset: 1, opacity: 0, transform: 'scale(1.75)' }
                ], {
                    duration: Math.max(260, durationMs + 40),
                    easing: 'ease-out'
                });
            }
        } catch (e: any) { /* ignore */ }

        try {
            timeoutId = deps.timer().setTimeout(finish, durationMs + 120, deps.playbackScope);
        } catch (e: any) {
            timeoutId = setTimeout(finish, durationMs + 120);
        }
    });

    if (layer.parentElement) layer.parentElement.removeChild(layer);
}

async function animateMeteorGodBlackBeam(target: any, deps: DestroySourceAnimationDeps) {
    if (!target) return;
    if (deps.isNoAnim()) return;

    const source = deps.resolveSniperSource(target);
    if (!source) return;

    const fromCell = deps.getCellEl(source.row, source.col);
    const toCell = deps.getCellEl(target.r, target.col);
    if (!fromCell || !toCell) return;
    if (!document || !document.body) return;

    const fromRect = fromCell.getBoundingClientRect();
    const toRect = toCell.getBoundingClientRect();

    const fromX = fromRect.left + (fromRect.width / 2);
    const fromY = fromRect.top + (fromRect.height / 2);
    const toX = toRect.left + (toRect.width / 2);
    const toY = toRect.top + (toRect.height / 2);

    const deltaX = toX - fromX;
    const deltaY = toY - fromY;
    const distance = Math.max(1, Math.hypot(deltaX, deltaY));
    const angleDeg = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
    const durationMs = Math.max(260, Math.min(460, Math.round(230 + (distance * 0.22))));

    const layer = document.createElement('div');
    layer.style.position = 'fixed';
    layer.style.left = '0';
    layer.style.top = '0';
    layer.style.width = '100vw';
    layer.style.height = '100vh';
    layer.style.pointerEvents = 'none';
    layer.style.zIndex = '1260';
    layer.style.overflow = 'hidden';

    const outerBeam = document.createElement('div');
    outerBeam.style.position = 'fixed';
    outerBeam.style.left = `${fromX}px`;
    outerBeam.style.top = `${fromY - 7}px`;
    outerBeam.style.width = `${distance}px`;
    outerBeam.style.height = '14px';
    outerBeam.style.transformOrigin = '0 50%';
    outerBeam.style.transform = `rotate(${angleDeg}deg) scaleX(0.08)`;
    outerBeam.style.borderRadius = '999px';
    outerBeam.style.background = 'linear-gradient(90deg, rgba(14,10,22,0.1) 0%, rgba(42,20,74,0.96) 18%, rgba(7,5,10,0.98) 52%, rgba(61,28,98,0.92) 84%, rgba(10,6,18,0.08) 100%)';
    outerBeam.style.boxShadow = '0 0 12px rgba(32, 12, 62, 0.98), 0 0 26px rgba(112, 58, 174, 0.62)';
    outerBeam.style.opacity = '0';

    const coreBeam = document.createElement('div');
    coreBeam.style.position = 'fixed';
    coreBeam.style.left = `${fromX}px`;
    coreBeam.style.top = `${fromY - 3}px`;
    coreBeam.style.width = `${distance}px`;
    coreBeam.style.height = '6px';
    coreBeam.style.transformOrigin = '0 50%';
    coreBeam.style.transform = `rotate(${angleDeg}deg) scaleX(0.04)`;
    coreBeam.style.borderRadius = '999px';
    coreBeam.style.background = 'linear-gradient(90deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.98) 22%, rgba(0,0,0,1) 70%, rgba(20,10,28,0.86) 100%)';
    coreBeam.style.boxShadow = 'inset 0 0 5px rgba(151, 92, 214, 0.34), 0 0 7px rgba(0, 0, 0, 0.95)';
    coreBeam.style.opacity = '0';

    const muzzle = document.createElement('div');
    muzzle.style.position = 'fixed';
    muzzle.style.left = `${fromX - 12}px`;
    muzzle.style.top = `${fromY - 12}px`;
    muzzle.style.width = '24px';
    muzzle.style.height = '24px';
    muzzle.style.borderRadius = '50%';
    muzzle.style.background = 'radial-gradient(circle, rgba(0,0,0,0.98) 0%, rgba(35,16,58,0.88) 46%, rgba(93,48,148,0.18) 76%, rgba(0,0,0,0) 100%)';
    muzzle.style.boxShadow = '0 0 20px rgba(78, 37, 132, 0.82)';
    muzzle.style.opacity = '0';
    muzzle.style.transform = 'scale(0.45)';

    const impact = document.createElement('div');
    impact.style.position = 'fixed';
    impact.style.left = `${toX - 20}px`;
    impact.style.top = `${toY - 20}px`;
    impact.style.width = '40px';
    impact.style.height = '40px';
    impact.style.borderRadius = '50%';
    impact.style.background = 'radial-gradient(circle, rgba(0,0,0,1) 0%, rgba(13,7,23,0.98) 44%, rgba(95,45,152,0.56) 70%, rgba(0,0,0,0) 100%)';
    impact.style.boxShadow = '0 0 22px rgba(73, 34, 126, 0.88), inset 0 0 12px rgba(0,0,0,0.95)';
    impact.style.opacity = '0';
    impact.style.transform = 'scale(0.28)';

    const ring = document.createElement('div');
    ring.style.position = 'fixed';
    ring.style.left = `${toX - 18}px`;
    ring.style.top = `${toY - 18}px`;
    ring.style.width = '36px';
    ring.style.height = '36px';
    ring.style.borderRadius = '50%';
    ring.style.border = '2px solid rgba(24, 10, 42, 0.92)';
    ring.style.boxShadow = '0 0 14px rgba(129, 74, 196, 0.7)';
    ring.style.opacity = '0';
    ring.style.transform = 'scale(1.32)';

    layer.appendChild(outerBeam);
    layer.appendChild(coreBeam);
    layer.appendChild(muzzle);
    layer.appendChild(impact);
    layer.appendChild(ring);
    document.body.appendChild(layer);

    await new Promise<void>((resolve) => {
        let timeoutId: any = null;
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            if (timeoutId !== null) {
                try { deps.timer().clearTimeout(timeoutId); } catch (e: any) { /* ignore */ }
                timeoutId = null;
            }
            resolve();
        };

        try {
            if (outerBeam.animate) {
                outerBeam.animate([
                    { offset: 0, opacity: 0, transform: `rotate(${angleDeg}deg) scaleX(0.08)` },
                    { offset: 0.16, opacity: 1, transform: `rotate(${angleDeg}deg) scaleX(1)` },
                    { offset: 0.74, opacity: 0.94, transform: `rotate(${angleDeg}deg) scaleX(1)` },
                    { offset: 1, opacity: 0, transform: `rotate(${angleDeg}deg) scaleX(0.96)` }
                ], {
                    duration: durationMs,
                    easing: 'cubic-bezier(0.2, 0.78, 0.18, 1)'
                });
            }
            if (coreBeam.animate) {
                coreBeam.animate([
                    { offset: 0, opacity: 0, transform: `rotate(${angleDeg}deg) scaleX(0.04)` },
                    { offset: 0.12, opacity: 1, transform: `rotate(${angleDeg}deg) scaleX(1)` },
                    { offset: 0.7, opacity: 1, transform: `rotate(${angleDeg}deg) scaleX(1)` },
                    { offset: 1, opacity: 0, transform: `rotate(${angleDeg}deg) scaleX(0.9)` }
                ], {
                    duration: Math.max(220, durationMs - 30),
                    easing: 'cubic-bezier(0.18, 0.9, 0.2, 1)'
                });
            }
            if (muzzle.animate) {
                muzzle.animate([
                    { offset: 0, opacity: 0, transform: 'scale(0.45)' },
                    { offset: 0.18, opacity: 0.95, transform: 'scale(1.1)' },
                    { offset: 0.72, opacity: 0.78, transform: 'scale(0.92)' },
                    { offset: 1, opacity: 0, transform: 'scale(0.58)' }
                ], {
                    duration: durationMs,
                    easing: 'ease-out'
                });
            }
            if (impact.animate) {
                impact.animate([
                    { offset: 0, opacity: 0, transform: 'scale(0.28)' },
                    { offset: 0.18, opacity: 0.9, transform: 'scale(1.18)' },
                    { offset: 0.74, opacity: 0.88, transform: 'scale(0.82)' },
                    { offset: 1, opacity: 0, transform: 'scale(0.22)' }
                ], {
                    duration: Math.max(240, durationMs + 60),
                    easing: 'cubic-bezier(0.16, 0.82, 0.24, 1)'
                });
            }
            if (ring.animate) {
                ring.animate([
                    { offset: 0, opacity: 0, transform: 'scale(1.32)' },
                    { offset: 0.2, opacity: 0.92, transform: 'scale(1.02)' },
                    { offset: 1, opacity: 0, transform: 'scale(0.18)' }
                ], {
                    duration: Math.max(240, durationMs + 70),
                    easing: 'cubic-bezier(0.2, 0.72, 0.2, 1)'
                });
            }
        } catch (e: any) { /* ignore */ }

        try {
            timeoutId = deps.timer().setTimeout(finish, durationMs + 140, deps.playbackScope);
        } catch (e: any) {
            timeoutId = setTimeout(finish, durationMs + 140);
        }
    });

    if (layer.parentElement) layer.parentElement.removeChild(layer);
}

async function animateUdgLightningStrike(target: any, deps: DestroySourceAnimationDeps) {
    if (!target) return;
    if (deps.isNoAnim()) return;

    const source = deps.resolveSniperSource(target);
    if (!source) return;

    const fromCell = deps.getCellEl(source.row, source.col);
    const toCell = deps.getCellEl(target.r, target.col);
    if (!fromCell || !toCell) return;
    if (!document || !document.body) return;

    const fromRect = fromCell.getBoundingClientRect();
    const toRect = toCell.getBoundingClientRect();
    const startX = fromRect.left + (fromRect.width / 2);
    const startY = fromRect.top + (fromRect.height / 2);
    const endX = toRect.left + (toRect.width / 2);
    const endY = toRect.top + (toRect.height / 2);

    const viewportW = Math.max(
        1,
        Number(window && window.innerWidth) || 0,
        Number(document.documentElement && document.documentElement.clientWidth) || 0
    );
    const viewportH = Math.max(
        1,
        Number(window && window.innerHeight) || 0,
        Number(document.documentElement && document.documentElement.clientHeight) || 0
    );

    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.left = '0';
    overlay.style.top = '0';
    overlay.style.width = `${viewportW}px`;
    overlay.style.height = `${viewportH}px`;
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '1250';
    overlay.style.overflow = 'hidden';

    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('width', String(viewportW));
    svg.setAttribute('height', String(viewportH));
    svg.setAttribute('viewBox', `0 0 ${viewportW} ${viewportH}`);
    svg.style.position = 'absolute';
    svg.style.left = '0';
    svg.style.top = '0';
    svg.style.overflow = 'visible';
    overlay.appendChild(svg);

    const distance = Math.max(1, Math.hypot(endX - startX, endY - startY));
    const segmentCount = Math.max(5, Math.min(11, Math.round(distance / 42)));
    const jitterPx = Math.max(8, Math.min(24, Math.round(distance / 13)));

    const buildPath = (sx: any, sy: any, ex: any, ey: any, segments: any, jitter: any) => {
        const safeSegments = Math.max(2, Number(segments) || 2);
        const points = [];
        const dx = ex - sx;
        const dy = ey - sy;
        const len = Math.max(1, Math.hypot(dx, dy));
        const nx = -dy / len;
        const ny = dx / len;

        for (let i = 0; i <= safeSegments; i++) {
            const t = i / safeSegments;
            let x = sx + (dx * t);
            let y = sy + (dy * t);
            if (i > 0 && i < safeSegments) {
                const centerWeight = 1 - Math.abs((t * 2) - 1);
                const offset = (Math.random() - 0.5) * jitter * (0.45 + centerWeight);
                x += nx * offset;
                y += ny * offset;
            }
            points.push({ x, y });
        }

        const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        return { d, points };
    };

    const createPath = (d: any, stroke: any, strokeWidth: any) => {
        const path = document.createElementNS(svgNs, 'path');
        path.setAttribute('d', d);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', stroke);
        path.setAttribute('stroke-width', String(strokeWidth));
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        return path;
    };

    const main = buildPath(startX, startY, endX, endY, segmentCount, jitterPx);
    const glow = createPath(main.d, 'rgba(134, 227, 255, 0.95)', 4.6);
    glow.style.filter = 'drop-shadow(0 0 10px rgba(128, 220, 255, 0.95))';
    const core = createPath(main.d, 'rgba(255, 255, 255, 0.98)', 2.1);
    core.style.filter = 'drop-shadow(0 0 5px rgba(255, 255, 255, 0.9))';
    svg.appendChild(glow);
    svg.appendChild(core);

    const branchBaseIndexes = [
        Math.max(1, Math.floor(main.points.length * 0.34)),
        Math.max(1, Math.floor(main.points.length * 0.62))
    ];
    const branchEls = [];
    for (const idx of branchBaseIndexes) {
        const anchor = main.points[idx];
        if (!anchor) continue;
        const branchEndX = anchor.x + ((Math.random() - 0.5) * 54) + ((endX - startX) * 0.12);
        const branchEndY = anchor.y + ((Math.random() - 0.5) * 54) - ((endY - startY) * 0.08);
        const branch = buildPath(
            anchor.x,
            anchor.y,
            branchEndX,
            branchEndY,
            Math.max(3, segmentCount - 3),
            Math.max(5, jitterPx * 0.68)
        );
        const branchGlow = createPath(branch.d, 'rgba(151, 234, 255, 0.76)', 2.4);
        branchGlow.style.filter = 'drop-shadow(0 0 7px rgba(140, 225, 255, 0.8))';
        const branchCore = createPath(branch.d, 'rgba(255, 255, 255, 0.92)', 1.2);
        svg.appendChild(branchGlow);
        svg.appendChild(branchCore);
        branchEls.push(branchGlow, branchCore);
    }

    const flash = document.createElement('div');
    flash.style.position = 'fixed';
    flash.style.left = `${endX}px`;
    flash.style.top = `${endY}px`;
    flash.style.width = '14px';
    flash.style.height = '14px';
    flash.style.borderRadius = '50%';
    flash.style.transform = 'translate(-50%, -50%) scale(0.15)';
    flash.style.background = 'radial-gradient(circle, rgba(255,255,255,0.98) 0%, rgba(191,240,255,0.84) 42%, rgba(124,220,255,0) 100%)';
    flash.style.filter = 'drop-shadow(0 0 16px rgba(160, 236, 255, 0.95))';
    flash.style.pointerEvents = 'none';
    flash.style.zIndex = '1251';
    overlay.appendChild(flash);

    const ring = document.createElement('div');
    ring.style.position = 'fixed';
    ring.style.left = `${endX}px`;
    ring.style.top = `${endY}px`;
    ring.style.width = '10px';
    ring.style.height = '10px';
    ring.style.borderRadius = '50%';
    ring.style.transform = 'translate(-50%, -50%) scale(0.2)';
    ring.style.border = '2px solid rgba(173, 238, 255, 0.9)';
    ring.style.pointerEvents = 'none';
    ring.style.zIndex = '1251';
    overlay.appendChild(ring);

    document.body.appendChild(overlay);

    const durationMs = Math.max(170, Math.min(300, Math.round(170 + (distance * 0.12))));
    const animations: any[] = [];
    const queueAnimation = (el: any, keyframes: any, options: any) => {
        try {
            if (!el || typeof el.animate !== 'function') return;
            const anim = el.animate(keyframes, options);
            animations.push(anim);
        } catch (e: any) {
            /* ignore */
        }
    };

    queueAnimation(glow, [
        { opacity: 0 },
        { opacity: 1, offset: 0.12 },
        { opacity: 0.46, offset: 0.27 },
        { opacity: 1, offset: 0.44 },
        { opacity: 0.34, offset: 0.63 },
        { opacity: 0.94, offset: 0.78 },
        { opacity: 0, offset: 1 }
    ], {
        duration: durationMs,
        easing: 'linear',
        fill: 'forwards'
    });

    queueAnimation(core, [
        { opacity: 0 },
        { opacity: 1, offset: 0.1 },
        { opacity: 0.66, offset: 0.22 },
        { opacity: 1, offset: 0.39 },
        { opacity: 0.54, offset: 0.58 },
        { opacity: 0.92, offset: 0.76 },
        { opacity: 0, offset: 1 }
    ], {
        duration: durationMs - 10,
        easing: 'linear',
        fill: 'forwards'
    });

    for (const branchEl of branchEls) {
        queueAnimation(branchEl, [
            { opacity: 0 },
            { opacity: 0.9, offset: 0.16 },
            { opacity: 0.26, offset: 0.41 },
            { opacity: 0.75, offset: 0.66 },
            { opacity: 0, offset: 1 }
        ], {
            duration: Math.max(130, durationMs - 32),
            easing: 'linear',
            fill: 'forwards'
        });
    }

    queueAnimation(flash, [
        { opacity: 0.2, transform: 'translate(-50%, -50%) scale(0.1)' },
        { opacity: 1, transform: 'translate(-50%, -50%) scale(1.3)', offset: 0.24 },
        { opacity: 0, transform: 'translate(-50%, -50%) scale(2.6)', offset: 1 }
    ], {
        duration: Math.max(150, durationMs + 30),
        easing: 'cubic-bezier(0.16, 0.84, 0.32, 1)',
        fill: 'forwards'
    });

    queueAnimation(ring, [
        { opacity: 0.85, transform: 'translate(-50%, -50%) scale(0.2)' },
        { opacity: 0.5, transform: 'translate(-50%, -50%) scale(1.4)', offset: 0.48 },
        { opacity: 0, transform: 'translate(-50%, -50%) scale(2.1)', offset: 1 }
    ], {
        duration: Math.max(140, durationMs + 10),
        easing: 'ease-out',
        fill: 'forwards'
    });

    try {
        if (!animations.length) {
            await new Promise((resolve) => {
                try {
                    deps.timer().setTimeout(resolve, durationMs + 40, deps.playbackScope);
                } catch (e: any) {
                    setTimeout(resolve, durationMs + 40);
                }
            });
            return;
        }

        await new Promise<void>((resolve) => {
            let timeoutId: any = null;
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                if (timeoutId !== null) {
                    try { deps.timer().clearTimeout(timeoutId); } catch (e: any) { /* ignore */ }
                    timeoutId = null;
                }
                resolve();
            };

            let settled = 0;
            const expected = animations.length;
            for (const anim of animations) {
                try {
                    if (anim && anim.finished && typeof anim.finished.then === 'function') {
                        anim.finished.then(() => {
                            settled += 1;
                            if (settled >= expected) finish();
                        }).catch(() => {
                            settled += 1;
                            if (settled >= expected) finish();
                        });
                    } else {
                        settled += 1;
                    }
                } catch (e: any) {
                    settled += 1;
                }
            }

            if (settled >= expected) finish();
            try {
                timeoutId = deps.timer().setTimeout(finish, durationMs + 140, deps.playbackScope);
            } catch (e: any) {
                timeoutId = setTimeout(finish, durationMs + 140);
            }
        });
    } finally {
        if (overlay && overlay.parentElement) overlay.parentElement.removeChild(overlay);
    }
}

async function animateWillHunterKingSlash(target: any, deps: DestroySourceAnimationDeps) {
    if (!target || deps.isNoAnim()) return;

    const cell = deps.getCellEl(target.r, target.col);
    if (!cell) return;

    const cellRect = cell.getBoundingClientRect();
    const source = deps.resolveSniperSource(target);
    const slash = document.createElement('div');
    slash.className = 'will-hunter-king-slash';

    let angleDeg = -32;
    if (source) {
        const sourceCell = deps.getCellEl(source.row, source.col);
        if (sourceCell) {
            const sourceRect = sourceCell.getBoundingClientRect();
            angleDeg = Math.atan2(
                (cellRect.top + (cellRect.height / 2)) - (sourceRect.top + (sourceRect.height / 2)),
                (cellRect.left + (cellRect.width / 2)) - (sourceRect.left + (sourceRect.width / 2))
            ) * (180 / Math.PI);
        }
    }

    slash.style.position = 'fixed';
    slash.style.left = `${cellRect.left}px`;
    slash.style.top = `${cellRect.top}px`;
    slash.style.width = `${cellRect.width}px`;
    slash.style.height = `${cellRect.height}px`;
    slash.style.setProperty('--slash-angle-deg', `${angleDeg}deg`);
    slash.style.pointerEvents = 'none';
    slash.style.zIndex = '1300';
    document.body.appendChild(slash);

    const durationMs = 280;
    try {
        if (typeof slash.animate === 'function') {
            const anim = slash.animate([
                { opacity: 0, transform: 'scale(0.6)' },
                { opacity: 1, transform: 'scale(1)' },
                { opacity: 0, transform: 'scale(1.08)' }
            ], {
                duration: durationMs,
                easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)'
            });
            await deps.waitForAnimationFinish(anim, durationMs, 80);
        } else {
            await deps.sleep(durationMs);
        }
    } finally {
        try { if (slash.parentElement) slash.parentElement.removeChild(slash); } catch (e: any) { /* ignore */ }
    }
}

module.exports = {
    resolveSniperProjectileOwner,
    animateSniperProjectile,
    animateRobotVacuumSuction,
    animateDestroyDragonBreath,
    animateMeteorGodBlackBeam,
    animateUdgLightningStrike,
    animateWillHunterKingSlash
};
