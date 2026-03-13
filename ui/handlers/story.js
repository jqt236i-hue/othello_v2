(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        const api = factory();
        root.StoryHandlerModule = api;
        root.setupStoryControls = api.setupStoryControls;
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const TEMPLATE = [
        '<div class="story-menu-backdrop"></div>',
        '<div class="story-menu-panel" role="dialog" aria-modal="false" aria-label="story menu">',
        '  <div class="story-menu-header">',
        '    <div class="story-menu-title">story</div>',
        '    <button class="story-menu-close" type="button" aria-label="story menu を閉じる">×</button>',
        '  </div>',
        '  <div class="story-menu-subtitle">章を選んで開始します。未解放の章は表示されますが開始できません。</div>',
        '  <div class="story-menu-list"></div>',
        '  <div class="story-menu-note"></div>',
        '</div>'
    ].join('');

    function resolveController(rootRef, tutorialOverlay, storyBtn) {
        const controllerModule = rootRef && rootRef.StoryControllerModule;
        if (!controllerModule || typeof controllerModule.createStoryController !== 'function') {
            return null;
        }
        try {
            return controllerModule.createStoryController({
                root: rootRef,
                overlay: tutorialOverlay,
                button: storyBtn
            });
        } catch (e) {
            return null;
        }
    }

    function markUnavailable(storyBtn, storyMenuOverlay) {
        if (storyBtn) {
            storyBtn.disabled = true;
            storyBtn.setAttribute('aria-disabled', 'true');
            storyBtn.setAttribute('aria-label', 'story 準備中');
            storyBtn.title = 'story は準備中です';
            storyBtn.dataset.storyState = 'unavailable';
        }
        if (storyMenuOverlay) {
            storyMenuOverlay.setAttribute('aria-hidden', 'true');
            storyMenuOverlay.textContent = '';
        }
    }

    function mountMenu(menuRoot) {
        if (!menuRoot || menuRoot.dataset.storyMenuMounted === '1') return;
        menuRoot.innerHTML = TEMPLATE;
        menuRoot.dataset.storyMenuMounted = '1';
    }

    function setMenuOpen(menuRoot, button, open) {
        if (!menuRoot) return;
        const isOpen = open === true;
        menuRoot.classList.toggle('is-open', isOpen);
        menuRoot.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
        if (button) {
            button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        }
    }

    function setupStoryControls(storyBtn, storyMenuOverlay, tutorialOverlay, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const rootRef = opts.root || (typeof window !== 'undefined' ? window : globalThis);
        const controller = resolveController(rootRef, tutorialOverlay, storyBtn);
        const stepsModule = rootRef && rootRef.StoryStepsModule;

        if (!controller || !stepsModule || !storyMenuOverlay) {
            markUnavailable(storyBtn, storyMenuOverlay);
            return null;
        }

        mountMenu(storyMenuOverlay);
        const closeButton = storyMenuOverlay.querySelector('.story-menu-close');
        const backdrop = storyMenuOverlay.querySelector('.story-menu-backdrop');
        const list = storyMenuOverlay.querySelector('.story-menu-list');
        const note = storyMenuOverlay.querySelector('.story-menu-note');

        function renderMenu() {
            if (!list) return;
            list.innerHTML = '';
            const chapterIds = typeof stepsModule.getChapterIds === 'function'
                ? stepsModule.getChapterIds()
                : [];

            for (const chapterId of chapterIds) {
                const chapter = stepsModule.getChapter(chapterId);
                const availability = controller.getChapterAvailability(chapterId);
                if (!chapter) continue;

                const button = storyMenuOverlay.ownerDocument.createElement('button');
                button.type = 'button';
                button.className = 'story-chapter-btn';

                const stateLabel = availability.cleared
                    ? 'clear'
                    : (availability.unlocked ? 'playable' : 'locked');
                if (!availability.unlocked) button.classList.add('is-locked');
                if (!availability.unlocked) button.disabled = true;

                const nameEl = storyMenuOverlay.ownerDocument.createElement('div');
                nameEl.className = 'story-chapter-name';
                nameEl.textContent = chapter.menuLabel || chapter.title || chapterId;

                const stateEl = storyMenuOverlay.ownerDocument.createElement('div');
                stateEl.className = 'story-chapter-state';
                stateEl.textContent = stateLabel;

                const descEl = storyMenuOverlay.ownerDocument.createElement('div');
                descEl.className = 'story-chapter-desc';
                descEl.textContent = availability.unlocked
                    ? (chapter.menuDescription || '開始できます。')
                    : (availability.message || chapter.lockMessage || 'プレイするにはチュートリアルをクリアしてください。');

                button.appendChild(nameEl);
                button.appendChild(stateEl);
                button.appendChild(descEl);

                if (availability.unlocked) {
                    button.addEventListener('click', () => {
                        setMenuOpen(storyMenuOverlay, storyBtn, false);
                        controller.open({ chapterId });
                    });
                }

                list.appendChild(button);
            }

            if (note) {
                note.textContent = '0章クリア後に第一章が解放されます。各章クリアで次章が解放されます。';
            }
        }

        function toggleMenu() {
            const isOpen = storyMenuOverlay.classList.contains('is-open');
            if (isOpen) {
                setMenuOpen(storyMenuOverlay, storyBtn, false);
                return;
            }
            if (controller.isActive()) {
                return;
            }
            renderMenu();
            setMenuOpen(storyMenuOverlay, storyBtn, true);
        }

        if (storyBtn) {
            storyBtn.disabled = false;
            storyBtn.removeAttribute('aria-disabled');
            storyBtn.removeAttribute('title');
            storyBtn.dataset.storyState = 'ready';
        }

        if (storyBtn && storyBtn.dataset.storyBound !== '1') {
            storyBtn.addEventListener('click', () => {
                toggleMenu();
            });
            storyBtn.dataset.storyBound = '1';
        }

        if (closeButton && closeButton.dataset.storyBound !== '1') {
            closeButton.addEventListener('click', () => {
                setMenuOpen(storyMenuOverlay, storyBtn, false);
            });
            closeButton.dataset.storyBound = '1';
        }

        if (backdrop && backdrop.dataset.storyBound !== '1') {
            backdrop.addEventListener('click', () => {
                setMenuOpen(storyMenuOverlay, storyBtn, false);
            });
            backdrop.dataset.storyBound = '1';
        }

        return controller;
    }

    return {
        resolveController,
        markUnavailable,
        setupStoryControls
    };
}));
