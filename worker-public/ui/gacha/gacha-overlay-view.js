(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.GachaOverlayViewModule = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function resolveDocument(rootRef) {
        if (rootRef && rootRef.document) return rootRef.document;
        if (typeof document !== 'undefined') return document;
        return null;
    }

    function resolveGachaHelpersModule() {
        if (typeof require === 'function') {
            try {
                return require('../../shared/gacha-helpers.js');
            } catch (e) { /* ignore */ }
        }
        try {
            if (typeof globalThis !== 'undefined' && globalThis.GachaHelpersModule) return globalThis.GachaHelpersModule;
        } catch (e) { /* ignore */ }
        return null;
    }

    function resolveRefs(docRef, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const refs = {
            openBtn: opts.openBtn || docRef.getElementById('gachaOpenBtn'),
            overlay: opts.overlay || docRef.getElementById('gachaOverlay'),
            modal: opts.modal || docRef.getElementById('gachaModal'),
            closeBtn: opts.closeBtn || docRef.getElementById('gachaCloseBtn'),
            balanceValue: opts.balanceValue || docRef.getElementById('gachaBalanceValue'),
            detailToggleBtn: opts.detailToggleBtn || docRef.getElementById('gachaDetailToggleBtn'),
            detailsPanel: opts.detailsPanel || docRef.getElementById('gachaDetailsPanel'),
            singlePullBtn: opts.singlePullBtn || docRef.getElementById('gachaSinglePullBtn'),
            tenPullBtn: opts.tenPullBtn || docRef.getElementById('gachaTenPullBtn'),
            statusText: opts.statusText || docRef.getElementById('gachaStatusText'),
            results: opts.results || docRef.getElementById('gachaResults')
        };
        if (!refs.openBtn || !refs.overlay || !refs.modal || !refs.closeBtn || !refs.balanceValue || !refs.detailToggleBtn || !refs.detailsPanel || !refs.singlePullBtn || !refs.tenPullBtn || !refs.statusText || !refs.results) {
            return null;
        }
        return refs;
    }

    function writeStatus(statusEl, text, isError) {
        if (!statusEl) return;
        statusEl.textContent = String(text || '');
        statusEl.classList.toggle('is-error', isError === true);
    }

    function createRarityRow(docRef, rateInfo, helpersModule) {
        const row = docRef.createElement('div');
        row.className = 'gacha-rate-row';
        if (!rateInfo.available) row.classList.add('is-unavailable');

        const rarity = docRef.createElement('span');
        rarity.className = 'gacha-rate-rarity';
        rarity.textContent = rateInfo.rarity;

        const probability = docRef.createElement('span');
        probability.className = 'gacha-rate-probability';
        const configured = helpersModule.formatRateBasisPoints(rateInfo.configuredRateBasisPoints);
        if (rateInfo.available) {
            const effective = helpersModule.formatRateBasisPoints(rateInfo.effectiveRateBasisPoints);
            probability.textContent = effective === configured
                ? configured
                : `${configured}（現在 ${effective}）`;
        } else {
            probability.textContent = `${configured}（未登録）`;
        }

        const count = docRef.createElement('span');
        count.className = 'gacha-rate-count';
        count.textContent = `${rateInfo.itemCount}種`;

        row.appendChild(rarity);
        row.appendChild(probability);
        row.appendChild(count);
        return row;
    }

    function renderDetails(detailsPanel, catalogItems, helpersModule) {
        if (!detailsPanel) return;
        detailsPanel.innerHTML = '';

        const docRef = detailsPanel.ownerDocument || (typeof document !== 'undefined' ? document : null);
        const gachaHelpers = helpersModule || resolveGachaHelpersModule();
        if (!docRef || !gachaHelpers) return;

        const intro = docRef.createElement('div');
        intro.className = 'gacha-details-copy';
        intro.textContent = '観測石100で1回、1000で10連。重複時は所持済みとして表示し、観測石の補填はありません。';
        detailsPanel.appendChild(intro);

        const rateList = docRef.createElement('div');
        rateList.className = 'gacha-rate-list';
        const summary = gachaHelpers.summarizeRarityAvailability(catalogItems);
        gachaHelpers.computeEffectiveRarityRates(summary).forEach((rateInfo) => {
            rateList.appendChild(createRarityRow(docRef, rateInfo, gachaHelpers));
        });
        detailsPanel.appendChild(rateList);

        if (summary.missingRarities.length) {
            const note = docRef.createElement('div');
            note.className = 'gacha-details-note';
            note.textContent = `未登録 rarity は現在抽選対象外: ${summary.missingRarities.join(', ')}`;
            detailsPanel.appendChild(note);
        }
    }

    function createResultCard(docRef, pull, newlyUnlockedIdSet) {
        const item = pull && pull.item ? pull.item : null;
        if (!item) return null;
        const rarityId = String(pull.rarity || '').trim().toLowerCase();

        const card = docRef.createElement('div');
        card.className = `gacha-result-card rarity-${rarityId}`;
        card.setAttribute('data-gacha-rarity', rarityId);

        const rarity = docRef.createElement('div');
        rarity.className = 'gacha-result-rarity';
        rarity.textContent = String(pull.rarity || '');
        card.appendChild(rarity);

        const image = docRef.createElement('img');
        image.className = 'gacha-result-image';
        image.src = item.imagePath;
        image.alt = '';
        image.loading = 'lazy';
        image.decoding = 'async';
        image.draggable = false;
        card.appendChild(image);

        const name = docRef.createElement('div');
        name.className = 'gacha-result-name';
        name.textContent = item.label;
        card.appendChild(name);

        const status = docRef.createElement('div');
        const isNew = newlyUnlockedIdSet.has(item.id);
        status.className = `gacha-result-status ${isNew ? 'is-new' : 'is-owned'}`;
        status.textContent = isNew ? 'NEW' : '所持済み';
        card.appendChild(status);

        return card;
    }

    function renderPullResults(resultsEl, pulls, newlyUnlockedIds) {
        if (!resultsEl) return;
        const docRef = resultsEl.ownerDocument || (typeof document !== 'undefined' ? document : null);
        if (!docRef) return;

        resultsEl.innerHTML = '';
        const safePulls = Array.isArray(pulls) ? pulls : [];
        if (!safePulls.length) {
            const empty = docRef.createElement('div');
            empty.className = 'gacha-results-empty';
            empty.textContent = 'まだガチャ結果はありません';
            resultsEl.appendChild(empty);
            return;
        }

        const newlyUnlockedIdSet = new Set(Array.isArray(newlyUnlockedIds) ? newlyUnlockedIds : []);
        safePulls.forEach((pull) => {
            const card = createResultCard(docRef, pull, newlyUnlockedIdSet);
            if (card) resultsEl.appendChild(card);
        });
    }

    function setDetailsVisible(refs, visible) {
        const open = visible === true;
        refs.detailsPanel.hidden = !open;
        refs.detailToggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        refs.detailToggleBtn.textContent = open ? '詳細を閉じる' : '詳細';
    }

    function setOverlayVisible(refs, visible) {
        const open = visible === true;
        refs.overlay.classList.toggle('is-open', open);
        refs.overlay.setAttribute('aria-hidden', open ? 'false' : 'true');
        refs.openBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (!open) refs.overlay.classList.remove('is-revealing');
    }

    function setBusyState(refs, visible) {
        refs.overlay.classList.toggle('is-revealing', visible === true);
    }

    function setResultsBusy(refs, visible) {
        if (visible === true) {
            refs.results.setAttribute('aria-busy', 'true');
            return;
        }
        refs.results.removeAttribute('aria-busy');
    }

    function syncBalanceAndButtons(refs, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const balance = Math.max(0, Math.floor(Number(opts.balance) || 0));
        const hasCatalog = opts.hasCatalog === true;
        const isAnimating = opts.isAnimating === true;
        const singlePullCost = Math.max(0, Math.floor(Number(opts.singlePullCost) || 0));
        const tenPullCost = Math.max(0, Math.floor(Number(opts.tenPullCost) || 0));

        refs.balanceValue.textContent = String(balance);
        refs.closeBtn.disabled = isAnimating;
        refs.detailToggleBtn.disabled = isAnimating;
        refs.singlePullBtn.disabled = isAnimating || !hasCatalog || balance < singlePullCost;
        refs.tenPullBtn.disabled = isAnimating || !hasCatalog || balance < tenPullCost;
    }

    function focusPrimaryAction(refs) {
        try {
            refs.singlePullBtn.focus({ preventScroll: true });
        } catch (e) {
            try { refs.singlePullBtn.focus(); } catch (_e) { /* ignore */ }
        }
    }

    function createGachaOverlayView(options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const rootRef = opts.root || (typeof window !== 'undefined' ? window : null);
        const docRef = opts.document || resolveDocument(rootRef);
        if (!docRef) return null;

        const refs = resolveRefs(docRef, opts);
        if (!refs) return null;

        return {
            refs,
            writeStatus: function (text, isError) {
                writeStatus(refs.statusText, text, isError);
            },
            renderDetails: function (catalogItems, helpersModule) {
                renderDetails(refs.detailsPanel, catalogItems, helpersModule);
            },
            renderPullResults: function (pulls, newlyUnlockedIds) {
                renderPullResults(refs.results, pulls, newlyUnlockedIds);
            },
            setDetailsVisible: function (visible) {
                setDetailsVisible(refs, visible);
            },
            isDetailsVisible: function () {
                return refs.detailsPanel.hidden !== true;
            },
            setOverlayVisible: function (visible) {
                setOverlayVisible(refs, visible);
            },
            setBusyState: function (visible) {
                setBusyState(refs, visible);
            },
            setResultsBusy: function (visible) {
                setResultsBusy(refs, visible);
            },
            syncBalanceAndButtons: function (state) {
                syncBalanceAndButtons(refs, state);
            },
            focusPrimaryAction: function () {
                focusPrimaryAction(refs);
            }
        };
    }

    return {
        createGachaOverlayView,
        resolveRefs,
        writeStatus,
        renderDetails,
        renderPullResults
    };
}));
