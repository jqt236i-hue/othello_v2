export type SpecialMarkerRenderDeps = {
  documentRef: Document;
  applyDoubleDigitTimerClass?: (timerElement: HTMLElement, rawValue: any) => any;
};

function applyTimerClass(deps: SpecialMarkerRenderDeps, element: HTMLElement, value: any) {
  if (typeof deps.applyDoubleDigitTimerClass === 'function') {
    deps.applyDoubleDigitTimerClass(element, value);
  }
}

export function createSpecialMarkerRenderer(deps: SpecialMarkerRenderDeps) {
  const doc = deps.documentRef;

  function createHoleMark(kind: 'board-shrink' | 'meteor', innerBoundaryMask?: string[]) {
    const holeMark = doc.createElement('div');
    holeMark.className = kind === 'board-shrink' ? 'board-shrink-hole-mark' : 'meteor-hole-mark';
    if (kind === 'board-shrink') {
      for (const edge of (Array.isArray(innerBoundaryMask) ? innerBoundaryMask : [])) {
        const edgeEl = doc.createElement('div');
        edgeEl.className = `board-shrink-hole-inner-edge inner-edge-${edge}`;
        holeMark.appendChild(edgeEl);
      }
    }
    return holeMark;
  }

  function createBlockadeMark(remainingOwnerTurns: any) {
    const blockadeMark = doc.createElement('div');
    blockadeMark.className = 'blockade-mark';
    const remain = Number(remainingOwnerTurns);
    if (Number.isFinite(remain)) {
      const turnLabel = doc.createElement('div');
      turnLabel.className = 'blockade-turn';
      turnLabel.textContent = String(Math.max(0, remain));
      blockadeMark.appendChild(turnLabel);
    }
    return blockadeMark;
  }

  function createSeedMark(remainingOwnerTurns: any) {
    const seedMark = doc.createElement('div');
    seedMark.className = 'seed-mark';
    const seedIcon = doc.createElement('div');
    seedIcon.className = 'seed-icon';
    seedMark.appendChild(seedIcon);
    const remain = Number(remainingOwnerTurns);
    if (Number.isFinite(remain)) {
      const turnLabel = doc.createElement('div');
      turnLabel.className = 'seed-turn countdown-timer';
      const normalized = Math.max(0, Math.trunc(remain));
      turnLabel.textContent = String(normalized);
      applyTimerClass(deps, turnLabel, remain);
      seedMark.appendChild(turnLabel);
    }
    return seedMark;
  }

  function createBonusLabel(value: any) {
    const bonusLabel = doc.createElement('div');
    bonusLabel.className = 'board-bonus-number';
    bonusLabel.textContent = String(value);
    return bonusLabel;
  }

  function createTimedMarkerLabel(className: string, value: any) {
    const timer = doc.createElement('div');
    timer.className = className;
    const remaining = Math.max(0, Math.trunc(Number(value)));
    timer.textContent = String(remaining);
    applyTimerClass(deps, timer, remaining);
    return timer;
  }

  function createGuardTimerLabel(value: any) {
    return createTimedMarkerLabel('guard-timer', value);
  }

  function createRegenBadgeLabel(value: any, options: any = {}) {
    const badge = doc.createElement('div');
    badge.className = 'stone-regen-badge';
    if (String(options && options.specialType || '').toUpperCase() === 'ZOMBIE') {
      badge.classList.add('stone-regen-badge--zombie');
    }
    const remaining = Math.max(0, Math.trunc(Number(value)));
    badge.setAttribute('data-count', String(remaining));
    const valueLabel = doc.createElement('span');
    valueLabel.className = 'stone-regen-badge-value';
    valueLabel.textContent = String(remaining);
    badge.appendChild(valueLabel);
    applyTimerClass(deps, badge, remaining);
    return badge;
  }

  function createStoneStatusTimerLabel(className: string, value: any) {
    const normalizedClassName = String(className || '').trim() || 'special-timer';
    const classes = normalizedClassName.split(/\s+/).filter(Boolean);
    const fullClassName = classes.includes('stone-timer')
      ? normalizedClassName
      : `stone-timer ${normalizedClassName}`;
    return createTimedMarkerLabel(fullClassName, value);
  }

  function createFlipProtectionBadge() {
    const badge = doc.createElement('div');
    badge.className = 'stone-flip-protection-badge';
    badge.textContent = '反';
    badge.setAttribute('aria-hidden', 'true');
    return badge;
  }

  function createFreezeMark(remainingOwnerTurns: any) {
    const freezeMark = doc.createElement('div');
    freezeMark.className = 'freeze-mark';
    const remain = Number(remainingOwnerTurns);
    if (Number.isFinite(remain)) {
      const turnLabel = doc.createElement('div');
      turnLabel.className = 'freeze-turn';
      turnLabel.textContent = String(Math.max(0, Math.trunc(remain)));
      freezeMark.appendChild(turnLabel);
    }
    return freezeMark;
  }

  function createPoisonCellMark(remainingTurns: any) {
    const mark = doc.createElement('div');
    mark.className = 'poison-cell-mark';
    mark.appendChild(createTimedMarkerLabel('poison-cell-turn countdown-timer', remainingTurns));
    return mark;
  }

  function createPoisonLethalTimer(remainingTurns: any) {
    const timer = doc.createElement('div');
    timer.className = 'poison-lethal-timer';
    const value = Number(remainingTurns);
    timer.textContent = Number.isFinite(value) ? String(Math.max(0, Math.trunc(value))) : '';
    timer.setAttribute('aria-hidden', 'true');
    return timer;
  }

  function createScorchedCellMark(remainingTurns: any) {
    const mark = doc.createElement('div');
    mark.className = 'scorched-cell-mark';
    mark.appendChild(createTimedMarkerLabel('scorched-cell-turn countdown-timer', remainingTurns));
    return mark;
  }

  function createScorchLethalTimer(remainingTurns: any) {
    const timer = doc.createElement('div');
    timer.className = 'scorch-lethal-timer';
    const value = Number(remainingTurns);
    timer.textContent = Number.isFinite(value) ? String(Math.max(0, Math.trunc(value))) : '';
    timer.setAttribute('aria-hidden', 'true');
    return timer;
  }

  return {
    createHoleMark,
    createBlockadeMark,
    createSeedMark,
    createBonusLabel,
    createTimedMarkerLabel,
    createGuardTimerLabel,
    createRegenBadgeLabel,
    createStoneStatusTimerLabel,
    createFlipProtectionBadge,
    createFreezeMark,
    createPoisonCellMark,
    createPoisonLethalTimer,
    createScorchedCellMark,
    createScorchLethalTimer
  };
}

module.exports = {
  createSpecialMarkerRenderer
};
