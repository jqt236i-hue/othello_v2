function cellStatesEqual(a: any, b: any): boolean {
  if (!a) return false;
  if (a.value !== b.value) return false;
  if (a.isLegal !== b.isLegal) return false;
  if (a.isLegalFree !== b.isLegalFree) return false;
  if (!!a.isTabooLegal !== !!b.isTabooLegal) return false;
  if (!!a.isRandomSpawnPreview !== !!b.isRandomSpawnPreview) return false;
  if (!!a.isSelectedTargetHighlighted !== !!b.isSelectedTargetHighlighted) return false;
  if (!!a.isSuperAttractionPathPreview !== !!b.isSuperAttractionPathPreview) return false;
  if (!!a.isSuperAttractionPreviewDestination !== !!b.isSuperAttractionPreviewDestination) return false;
  if (a.isSelectableFriendly !== b.isSelectableFriendly) return false;
  if (!!a.isExtendLifeTarget !== !!b.isExtendLifeTarget) return false;
  if (!!a.breedingSprout !== !!b.breedingSprout) return false;
  if (a.boardBonus !== b.boardBonus) return false;
  if (!!a.theoryNumberCell !== !!b.theoryNumberCell) return false;
  if (!!a.livingWillAura !== !!b.livingWillAura) return false;
  if ((a.manifestAura === null) !== (b.manifestAura === null)) return false;
  if (a.manifestAura && b.manifestAura && a.manifestAura.owner !== b.manifestAura.owner) return false;

  if ((a.special === null) !== (b.special === null)) return false;
  if (a.special && b.special) {
    if (a.special.type !== b.special.type) return false;
    if (a.special.owner !== b.special.owner) return false;
    if (a.special.remainingOwnerTurns !== b.special.remainingOwnerTurns) return false;
    if (a.special.regenRemaining !== b.special.regenRemaining) return false;
    if (a.special.flipEvadeRemaining !== b.special.flipEvadeRemaining) return false;
    if (a.special.destroyEvadeRemaining !== b.special.destroyEvadeRemaining) return false;
  }

  if ((a.inherited === null) !== (b.inherited === null)) return false;
  if (a.inherited && b.inherited) {
    if (a.inherited.owner !== b.inherited.owner) return false;
    if (a.inherited.remainingOwnerTurns !== b.inherited.remainingOwnerTurns) return false;
    if (a.inherited.flipEvadeRemaining !== b.inherited.flipEvadeRemaining) return false;
    if (a.inherited.destroyEvadeRemaining !== b.inherited.destroyEvadeRemaining) return false;
  }

  if ((a.guard === null) !== (b.guard === null)) return false;
  if (a.guard && b.guard) {
    if (a.guard.owner !== b.guard.owner) return false;
    if (a.guard.remainingOwnerTurns !== b.guard.remainingOwnerTurns) return false;
  }

  if ((a.bomb === null) !== (b.bomb === null)) return false;
  if (a.bomb && b.bomb) {
    if (a.bomb.remainingTurns !== b.bomb.remainingTurns) return false;
    if (a.bomb.owner !== b.bomb.owner) return false;
  }

  if ((a.blockade === null) !== (b.blockade === null)) return false;
  if (a.blockade && b.blockade) {
    if ((a.blockade.type || null) !== (b.blockade.type || null)) return false;
    if (a.blockade.remainingOwnerTurns !== b.blockade.remainingOwnerTurns) return false;
    if (a.blockade.owner !== b.blockade.owner) return false;
    if ((a.blockade.visualVariant || null) !== (b.blockade.visualVariant || null)) return false;
    if ((a.blockade.innerBoundaryMask || null) !== (b.blockade.innerBoundaryMask || null)) return false;
  }

  if ((a.frozen === null) !== (b.frozen === null)) return false;
  if (a.frozen && b.frozen) {
    if (a.frozen.remainingOwnerTurns !== b.frozen.remainingOwnerTurns) return false;
    if (a.frozen.owner !== b.frozen.owner) return false;
  }
  if ((a.poisonCell === null) !== (b.poisonCell === null)) return false;
  if (a.poisonCell && b.poisonCell && a.poisonCell.remainingTurns !== b.poisonCell.remainingTurns) return false;
  if ((a.healingCell === null) !== (b.healingCell === null)) return false;
  if (a.healingCell && b.healingCell && a.healingCell.remainingTurns !== b.healingCell.remainingTurns) return false;
  if ((a.poisoned === null) !== (b.poisoned === null)) return false;
  if (a.poisoned && b.poisoned && a.poisoned.remainingTurns !== b.poisoned.remainingTurns) return false;

  if ((a.seed === null) !== (b.seed === null)) return false;
  if (a.seed && b.seed) {
    if (a.seed.remainingOwnerTurns !== b.seed.remainingOwnerTurns) return false;
    if (a.seed.owner !== b.seed.owner) return false;
  }

  return true;
}

const DiffRendererEquality = {
  cellStatesEqual
};

export = DiffRendererEquality;
