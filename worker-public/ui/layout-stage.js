(function () {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const BASE_WIDE = { width: 1920, height: 1080 };
    const BASE_TABLET_43 = { width: 1366, height: 960 };
    const BASE_PHONE_PORTRAIT = { width: 430, height: 932 };
    const PROFILE_WIDE = 'layout-profile-16x9';
    const PROFILE_TABLET_43 = 'layout-profile-tablet-4x3';
    const PROFILE_PHONE_PORTRAIT = 'layout-profile-phone-portrait';
    const CLASS_PHONE_LANDSCAPE_BLOCKED = 'layout-phone-landscape-blocked';
    const ASPECT_TABLET_43_MIN = 1.2;
    const ASPECT_TABLET_43_MAX = 1.52;
    const ASPECT_TABLET_43_HYSTERESIS = 0.05;
    const root = document.documentElement;
    root.classList.add('layout-stage-enabled');

    let rafId = null;
    let previousProfile = PROFILE_WIDE;
    const initialDevicePixelRatio = Number(window.devicePixelRatio || 1);

    function matchesMedia(query) {
        try {
            if (typeof window.matchMedia !== 'function') return false;
            return !!window.matchMedia(query).matches;
        } catch (e) {
            return false;
        }
    }

    function isDesktopLandscapeViewport(viewport) {
        if (!viewport || !Number.isFinite(viewport.width) || !Number.isFinite(viewport.height)) return false;
        if (viewport.width < 901 || viewport.width < viewport.height) return false;
        try {
            if (typeof window.matchMedia === 'function') {
                const finePointer = window.matchMedia('(pointer: fine)').matches;
                const hoverCapable = window.matchMedia('(hover: hover)').matches;
                if (finePointer || hoverCapable) return true;
            }
        } catch (e) {
            // ignore and use width/orientation fallback only
        }
        return false;
    }

    function getDesktopChromeCompensation(viewport) {
        if (!isDesktopLandscapeViewport(viewport)) return 0;
        const screenObj = window.screen;
        if (!screenObj) return 0;

        const rawScreenHeight = Number(screenObj.height);
        const rawAvailHeight = Number(screenObj.availHeight);
        const screenHeight = Number.isFinite(rawScreenHeight) && rawScreenHeight > 0 ? rawScreenHeight : 0;
        const availHeight = Number.isFinite(rawAvailHeight) && rawAvailHeight > 0 ? rawAvailHeight : 0;
        const referenceHeight = Math.max(screenHeight, availHeight);
        if (!Number.isFinite(referenceHeight) || referenceHeight <= 0) return 0;

        const estimatedChrome = Math.round(referenceHeight - viewport.height);
        return Math.max(0, Math.min(200, estimatedChrome));
    }

    function getTabletLandscapeCompensation(viewport) {
        if (!viewport || !Number.isFinite(viewport.width) || !Number.isFinite(viewport.height)) return 0;
        if (viewport.width < 901 || viewport.width < viewport.height) return 0;
        const screenObj = window.screen;
        if (!screenObj) return 0;

        const rawScreenHeight = Number(screenObj.height);
        const rawAvailHeight = Number(screenObj.availHeight);
        const screenHeight = Number.isFinite(rawScreenHeight) && rawScreenHeight > 0 ? rawScreenHeight : 0;
        const availHeight = Number.isFinite(rawAvailHeight) && rawAvailHeight > 0 ? rawAvailHeight : 0;
        const referenceHeight = Math.max(screenHeight, availHeight);
        if (!Number.isFinite(referenceHeight) || referenceHeight <= 0) return 0;

        const estimatedChrome = Math.round(referenceHeight - viewport.height);
        const moderatedChrome = Math.round(estimatedChrome * 0.5);
        return Math.max(0, Math.min(96, moderatedChrome));
    }

    function resolveLayoutProfile(viewport, simAspect) {
        if (!viewport || !Number.isFinite(viewport.width) || !Number.isFinite(viewport.height)) {
            return { profile: PROFILE_WIDE, blockPhoneLandscape: false };
        }
        const currentAspect = Number.isFinite(simAspect) && simAspect > 0
            ? simAspect
            : (viewport.width / viewport.height);
        const isPortrait = viewport.height >= viewport.width;
        const shortEdge = Math.min(viewport.width, viewport.height);
        const longEdge = Math.max(viewport.width, viewport.height);
        const userAgent = typeof navigator !== 'undefined' ? String(navigator.userAgent || '') : '';
        const maxTouchPoints = typeof navigator !== 'undefined' ? Number(navigator.maxTouchPoints || 0) : 0;
        const isIpadUserAgent = /iPad/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
        const touchCapable = matchesMedia('(pointer: coarse)')
            || matchesMedia('(any-pointer: coarse)')
            || maxTouchPoints > 0
            || ('ontouchstart' in window);
        const phoneLikeViewport = shortEdge <= 500 && longEdge <= 1000;
        const isPhoneLikeTouchDevice = touchCapable && phoneLikeViewport;
        const tabletLikeTouchDevice = touchCapable && !isPhoneLikeTouchDevice
            && shortEdge >= 700 && shortEdge <= 1500
            && longEdge >= 1000 && longEdge <= 3000;

        if (isPhoneLikeTouchDevice && !isPortrait) {
            return { profile: PROFILE_WIDE, blockPhoneLandscape: false };
        }

        if (isPhoneLikeTouchDevice && isPortrait) {
            return { profile: PROFILE_PHONE_PORTRAIT, blockPhoneLandscape: false };
        }

        if (!isPortrait && isIpadUserAgent) {
            return { profile: PROFILE_TABLET_43, blockPhoneLandscape: false };
        }

        if (!isPortrait && tabletLikeTouchDevice && currentAspect <= 1.9) {
            return { profile: PROFILE_TABLET_43, blockPhoneLandscape: false };
        }

        const nearTabletAspect = currentAspect >= ASPECT_TABLET_43_MIN && currentAspect <= ASPECT_TABLET_43_MAX;
        const nearTabletAspectWithHysteresis = currentAspect >= (ASPECT_TABLET_43_MIN - ASPECT_TABLET_43_HYSTERESIS)
            && currentAspect <= (ASPECT_TABLET_43_MAX + ASPECT_TABLET_43_HYSTERESIS);
        const keepTabletProfile = previousProfile === PROFILE_TABLET_43 && nearTabletAspectWithHysteresis;

        if (!isPortrait && Number.isFinite(simAspect) && simAspect >= ASPECT_TABLET_43_MIN && simAspect <= ASPECT_TABLET_43_MAX) {
            return { profile: PROFILE_TABLET_43, blockPhoneLandscape: false };
        }

        if (!isPortrait && (nearTabletAspect || keepTabletProfile)) {
            return { profile: PROFILE_TABLET_43, blockPhoneLandscape: false };
        }

        return { profile: PROFILE_WIDE, blockPhoneLandscape: false };
    }

    function getBaseSizeForProfile(profile) {
        if (profile === PROFILE_PHONE_PORTRAIT) return BASE_PHONE_PORTRAIT;
        return profile === PROFILE_TABLET_43 ? BASE_TABLET_43 : BASE_WIDE;
    }

    function applyProfileClasses(profile, blockPhoneLandscape) {
        root.classList.toggle(PROFILE_WIDE, profile === PROFILE_WIDE);
        root.classList.toggle(PROFILE_TABLET_43, profile === PROFILE_TABLET_43);
        root.classList.toggle(PROFILE_PHONE_PORTRAIT, profile === PROFILE_PHONE_PORTRAIT);
        root.classList.toggle(CLASS_PHONE_LANDSCAPE_BLOCKED, !!blockPhoneLandscape);
        root.setAttribute('data-layout-profile', profile);
    }

    function isZoomInteractionActive() {
        const vv = window.visualViewport;
        if (vv && Number.isFinite(vv.scale) && Math.abs(vv.scale - 1) > 0.01) {
            return true;
        }
        const currentDpr = Number(window.devicePixelRatio || 1);
        if (Number.isFinite(initialDevicePixelRatio) && Number.isFinite(currentDpr)) {
            if (Math.abs(currentDpr - initialDevicePixelRatio) > 0.001) {
                return true;
            }
        }
        return false;
    }

    function parseSimAspectRatio() {
        try {
            const data = String(root.getAttribute('data-sim-aspect') || '').trim();
            if (!data) return null;
            const parts = data.split(':');
            if (parts.length !== 2) return null;
            const w = Number(parts[0]);
            const h = Number(parts[1]);
            if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
            return w / h;
        } catch (e) {
            return null;
        }
    }

    function getViewportSize() {
        const innerWidth = Math.max(1, Math.round(window.innerWidth || 1));
        const innerHeight = Math.max(1, Math.round(window.innerHeight || 1));
        const currentDpr = Number(window.devicePixelRatio || 1);
        const dprRatio = Number.isFinite(initialDevicePixelRatio) && initialDevicePixelRatio > 0
            ? (currentDpr / initialDevicePixelRatio)
            : 1;

        let normalizedWidth = innerWidth;
        let normalizedHeight = innerHeight;

        if (Number.isFinite(dprRatio) && dprRatio > 0.25 && dprRatio < 4) {
            normalizedWidth = Math.max(1, Math.round(innerWidth * dprRatio));
            normalizedHeight = Math.max(1, Math.round(innerHeight * dprRatio));
        }

        const vv = window.visualViewport;
        if (vv && Number.isFinite(vv.width) && Number.isFinite(vv.height)) {
            const vvScale = Number(vv.scale || 1);
            if (Number.isFinite(vvScale) && Math.abs(vvScale - 1) > 0.01) {
                const vvWidth = Math.max(1, Math.round(vv.width * vvScale));
                const vvHeight = Math.max(1, Math.round(vv.height * vvScale));
                normalizedWidth = Math.max(normalizedWidth, vvWidth);
                normalizedHeight = Math.max(normalizedHeight, vvHeight);
            }
        }

        return {
            width: normalizedWidth,
            height: normalizedHeight
        };
    }

    function applyLayoutStageVars() {
        const viewport = getViewportSize();
        const simAspect = parseSimAspectRatio();
        const resolvedLayout = resolveLayoutProfile(viewport, simAspect);
        const profile = resolvedLayout.profile;
        const blockPhoneLandscape = !!resolvedLayout.blockPhoneLandscape;
        const baseSize = getBaseSizeForProfile(profile);
        const baseWidth = baseSize.width;
        const baseHeight = baseSize.height;
        previousProfile = profile;

        applyProfileClasses(profile, blockPhoneLandscape);
        root.style.setProperty('--layout-base-width', String(baseWidth));
        root.style.setProperty('--layout-base-height', String(baseHeight));

        let effectiveWidth = viewport.width;
        let effectiveHeight = viewport.height;
        let compensationHeight = 0;

        if (simAspect && Number.isFinite(simAspect) && simAspect > 0) {
            const currentAspect = viewport.width / viewport.height;
            if (currentAspect > simAspect) {
                effectiveWidth = Math.round(viewport.height * simAspect);
                effectiveHeight = viewport.height;
            } else {
                effectiveWidth = viewport.width;
                effectiveHeight = Math.round(viewport.width / simAspect);
            }
        } else if (profile === PROFILE_WIDE && !blockPhoneLandscape) {
            compensationHeight = getDesktopChromeCompensation(viewport);
        } else if (profile === PROFILE_TABLET_43) {
            compensationHeight = getTabletLandscapeCompensation(viewport);
        }

        const effectiveHeightForScale = effectiveHeight < baseHeight
            ? Math.min(baseHeight, effectiveHeight + compensationHeight)
            : effectiveHeight;
        const scale = Math.min(effectiveWidth / baseWidth, effectiveHeightForScale / baseHeight);
        const stageScale = Math.max(0.01, scale);
        const stageWidth = Math.round(baseWidth * stageScale);
        const stageHeight = Math.round(baseHeight * stageScale);
        const offsetX = Math.round((viewport.width - stageWidth) / 2);
        const offsetY = Math.round((viewport.height - stageHeight) / 2);
        const bottomSafeShift = Math.max(0, -offsetY);

        root.style.setProperty('--layout-stage-scale', String(stageScale));
        root.style.setProperty('--layout-stage-width', `${stageWidth}px`);
        root.style.setProperty('--layout-stage-height', `${stageHeight}px`);
        root.style.setProperty('--layout-stage-offset-x', `${offsetX}px`);
        root.style.setProperty('--layout-stage-offset-y', `${offsetY}px`);
        root.style.setProperty('--layout-stage-bottom-safe-shift', `${bottomSafeShift}px`);
        root.style.setProperty('--layout-stage-viewport-width', `${viewport.width}px`);
        root.style.setProperty('--layout-stage-viewport-height', `${viewport.height}px`);
    }

    function scheduleApplyLayoutStageVars(force) {
        if (rafId !== null && typeof window.cancelAnimationFrame === 'function') {
            window.cancelAnimationFrame(rafId);
            rafId = null;
        }
        if (typeof window.requestAnimationFrame === 'function') {
            rafId = window.requestAnimationFrame(function () {
                rafId = null;
                applyLayoutStageVars();
            });
            return;
        }
        applyLayoutStageVars();
    }

    window.addEventListener('resize', scheduleApplyLayoutStageVars, { passive: true });
    window.addEventListener('orientationchange', () => scheduleApplyLayoutStageVars(true), { passive: true });

    const vv = window.visualViewport;
    if (vv && typeof vv.addEventListener === 'function') {
        vv.addEventListener('resize', scheduleApplyLayoutStageVars, { passive: true });
        vv.addEventListener('scroll', scheduleApplyLayoutStageVars, { passive: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', scheduleApplyLayoutStageVars, { once: true });
    }

    applyLayoutStageVars();
})();
