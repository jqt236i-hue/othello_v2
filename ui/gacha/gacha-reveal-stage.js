(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.GachaRevealStageModule = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function createStaticElement(docRef, tagName, className, text) {
        const element = docRef.createElement(tagName);
        if (className) element.className = className;
        if (typeof text === 'string') element.textContent = text;
        return element;
    }

    function createParticleRow(docRef, container, className, count) {
        for (let i = 0; i < count; i += 1) {
            const particle = docRef.createElement('span');
            particle.className = className;
            particle.style.setProperty('--gacha-particle-index', String(i));
            container.appendChild(particle);
        }
    }

    function ensureGachaRevealStage(docRef, overlay) {
        if (!docRef || !overlay) return null;

        let stage = docRef.getElementById('gachaRevealStage');
        if (!stage) {
            stage = docRef.createElement('div');
            stage.id = 'gachaRevealStage';
            stage.setAttribute('aria-hidden', 'true');

            const skipBtn = createStaticElement(docRef, 'button', 'btn-small', 'SKIP');
            skipBtn.id = 'gachaRevealSkipBtn';
            skipBtn.type = 'button';
            skipBtn.setAttribute('aria-label', 'ガチャ演出をスキップ');
            stage.appendChild(skipBtn);

            const viewport = createStaticElement(docRef, 'div', 'gacha-reveal-viewport');
            stage.appendChild(viewport);

            const backdrop = createStaticElement(docRef, 'div', 'gacha-reveal-backdrop');
            viewport.appendChild(backdrop);

            const particles = createStaticElement(docRef, 'div', 'gacha-reveal-particles');
            createParticleRow(docRef, particles, 'gacha-reveal-particle', 10);
            viewport.appendChild(particles);

            const rings = createStaticElement(docRef, 'div', 'gacha-reveal-rings');
            rings.appendChild(createStaticElement(docRef, 'span', 'gacha-reveal-aurora'));
            rings.appendChild(createStaticElement(docRef, 'span', 'gacha-reveal-ring gacha-reveal-ring-a'));
            rings.appendChild(createStaticElement(docRef, 'span', 'gacha-reveal-ring gacha-reveal-ring-b'));
            rings.appendChild(createStaticElement(docRef, 'span', 'gacha-reveal-core'));
            viewport.appendChild(rings);

            const impact = createStaticElement(docRef, 'div', 'gacha-reveal-impact');
            impact.appendChild(createStaticElement(docRef, 'span', 'gacha-reveal-impact-flash'));
            impact.appendChild(createStaticElement(docRef, 'span', 'gacha-reveal-impact-ray'));
            impact.appendChild(createStaticElement(docRef, 'span', 'gacha-reveal-impact-halo'));
            viewport.appendChild(impact);

            const copy = createStaticElement(docRef, 'div', 'gacha-reveal-copy');
            copy.appendChild(createStaticElement(docRef, 'div', 'gacha-reveal-label', 'HAND GACHA'));
            copy.appendChild(createStaticElement(docRef, 'div', 'gacha-reveal-headline', '観測が収束しています'));
            copy.appendChild(createStaticElement(docRef, 'div', 'gacha-reveal-subtitle', '新しい手の見た目を解析中...'));
            viewport.appendChild(copy);

            const hero = createStaticElement(docRef, 'div', 'gacha-reveal-hero');
            hero.appendChild(createStaticElement(docRef, 'div', 'gacha-reveal-hero-rarity'));
            const heroImageWrap = createStaticElement(docRef, 'div', 'gacha-reveal-hero-image-wrap');
            const heroImage = docRef.createElement('img');
            heroImage.className = 'gacha-reveal-hero-image';
            heroImage.alt = '';
            heroImage.loading = 'lazy';
            heroImage.decoding = 'async';
            heroImage.draggable = false;
            heroImageWrap.appendChild(heroImage);
            hero.appendChild(heroImageWrap);
            hero.appendChild(createStaticElement(docRef, 'div', 'gacha-reveal-hero-name'));
            hero.appendChild(createStaticElement(docRef, 'div', 'gacha-reveal-hero-status'));
            viewport.appendChild(hero);

            const grid = createStaticElement(docRef, 'div', 'gacha-reveal-grid');
            viewport.appendChild(grid);

            overlay.appendChild(stage);
        }

        return {
            stage,
            skipBtn: docRef.getElementById('gachaRevealSkipBtn'),
            headline: stage.querySelector('.gacha-reveal-headline'),
            subtitle: stage.querySelector('.gacha-reveal-subtitle'),
            hero: stage.querySelector('.gacha-reveal-hero'),
            heroRarity: stage.querySelector('.gacha-reveal-hero-rarity'),
            heroImage: stage.querySelector('.gacha-reveal-hero-image'),
            heroName: stage.querySelector('.gacha-reveal-hero-name'),
            heroStatus: stage.querySelector('.gacha-reveal-hero-status'),
            grid: stage.querySelector('.gacha-reveal-grid')
        };
    }

    function createSlotCard(docRef, pull, isNew, index, spotlightId) {
        const rarityId = String((pull && pull.rarity) || '').trim().toLowerCase();
        const card = docRef.createElement('div');
        card.className = `gacha-reveal-slot rarity-${rarityId}`;
        card.setAttribute('data-gacha-rarity', rarityId);
        if (pull && pull.item && pull.item.id === spotlightId) {
            card.classList.add('is-spotlight');
        }
        card.style.setProperty('--gacha-reveal-delay', `${Math.max(0, index) * 42}ms`);

        const rarity = createStaticElement(docRef, 'div', 'gacha-reveal-slot-rarity', String((pull && pull.rarity) || ''));
        const image = docRef.createElement('img');
        image.className = 'gacha-reveal-slot-image';
        image.src = pull && pull.item ? pull.item.imagePath : '';
        image.alt = '';
        image.loading = 'lazy';
        image.decoding = 'async';
        image.draggable = false;
        const name = createStaticElement(docRef, 'div', 'gacha-reveal-slot-name', pull && pull.item ? pull.item.label : '');
        const status = createStaticElement(docRef, 'div', `gacha-reveal-slot-status ${isNew ? 'is-new' : 'is-owned'}`, isNew ? 'NEW' : '所持済み');

        card.appendChild(rarity);
        card.appendChild(image);
        card.appendChild(name);
        card.appendChild(status);
        return card;
    }

    function populateHero(refs, pull, newlyUnlockedIdSet) {
        const item = pull && pull.item ? pull.item : null;
        if (!refs || !item) return;
        const rarityId = String(pull.rarity || '').trim().toLowerCase();
        const isNew = newlyUnlockedIdSet.has(item.id);
        refs.hero.setAttribute('data-gacha-rarity', rarityId);
        refs.heroRarity.textContent = String(pull.rarity || '');
        refs.heroImage.src = item.imagePath;
        refs.heroName.textContent = item.label;
        refs.heroStatus.textContent = isNew ? 'NEW' : '所持済み';
        refs.heroStatus.className = `gacha-reveal-hero-status ${isNew ? 'is-new' : 'is-owned'}`;
    }

    function populateGrid(refs, pulls, newlyUnlockedIdSet, spotlightPull) {
        if (!refs || !refs.grid) return;
        refs.grid.innerHTML = '';
        const docRef = refs.grid.ownerDocument || (typeof document !== 'undefined' ? document : null);
        if (!docRef) return;

        const spotlightId = spotlightPull && spotlightPull.item ? spotlightPull.item.id : null;
        pulls.forEach((pull, index) => {
            const itemId = pull && pull.item ? pull.item.id : '';
            refs.grid.appendChild(createSlotCard(docRef, pull, newlyUnlockedIdSet.has(itemId), index, spotlightId));
        });
    }

    function resetStageVisualState(stage, isTenPull) {
        if (!stage) return;
        stage.classList.remove(
            'is-active',
            'is-charging',
            'is-hero-visible',
            'is-grid-visible',
            'is-impact-visible',
            'is-finishing',
            'is-skip-requested',
            'is-awaiting-dismiss',
            'is-single-pull',
            'is-ten-pull'
        );
        stage.classList.add(isTenPull ? 'is-ten-pull' : 'is-single-pull');
        stage.setAttribute('aria-hidden', 'false');
    }

    function hideStage(stage) {
        if (!stage) return;
        stage.classList.remove(
            'is-active',
            'is-charging',
            'is-hero-visible',
            'is-grid-visible',
            'is-impact-visible',
            'is-finishing',
            'is-skip-requested',
            'is-awaiting-dismiss',
            'is-single-pull',
            'is-ten-pull'
        );
        stage.setAttribute('aria-hidden', 'true');
        stage.removeAttribute('data-rarity');
        stage.removeAttribute('data-gacha-rarity');
        stage.removeAttribute('data-reveal-effect');
    }

    return {
        ensureGachaRevealStage,
        populateHero,
        populateGrid,
        resetStageVisualState,
        hideStage
    };
}));
