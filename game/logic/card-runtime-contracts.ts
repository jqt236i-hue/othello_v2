import {
    createCardRuntimeUnavailableError,
    isCardRuntimeUnavailableError
} from './card-runtime-errors';

export type CardRuntimeModule = object | ((...args: never[]) => unknown);
type CardRuntimeFunction = (...args: any[]) => any;
const NO_REQUIRED_EXPORTS = Object.freeze([]) as readonly never[];
type CardRuntimeValueValidator<T> = (value: unknown) => value is T;
type CardRuntimeRecord = Readonly<Record<string, unknown>>;
type CardRuntimeStringRecord = Readonly<Record<string, string>>;
type CardRuntimeDirectionList = readonly (readonly [number, number])[];
type CardRuntimeBonusDistribution = readonly Readonly<{ value: number; count: number }>[];
const NO_REQUIRED_VALUE_EXPORTS = Object.freeze({}) as Readonly<Record<never, never>>;
const SET_SIZE_GETTER = Object.getOwnPropertyDescriptor(Set.prototype, 'size')!.get!;
const SET_VALUES = Set.prototype.values;
const SET_ITERATOR_NEXT = Object.getPrototypeOf(new Set<unknown>().values()).next as (
    this: Iterator<unknown>
) => IteratorResult<unknown>;

function readOwnDataProperty(value: object, key: PropertyKey): unknown {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')
        ? descriptor.value
        : undefined;
}

function readRuntimeServiceDescriptor(
    value: object,
    key: PropertyKey,
    capability: string,
    cohort: string
): PropertyDescriptor | undefined {
    try {
        return Object.getOwnPropertyDescriptor(value, key);
    } catch (error) {
        if (isCardRuntimeUnavailableError(error)) throw error;
        throw createCardRuntimeUnavailableError(capability, cohort);
    }
}

function readRuntimeServiceFrozenState(
    value: object,
    capability: string,
    cohort: string
): boolean {
    try {
        return Object.isFrozen(value);
    } catch (error) {
        if (isCardRuntimeUnavailableError(error)) throw error;
        throw createCardRuntimeUnavailableError(capability, cohort);
    }
}

function isNonEmptyRecord(value: unknown): value is CardRuntimeRecord {
    return !!value
        && typeof value === 'object'
        && !Array.isArray(value)
        && Object.keys(value).length > 0;
}

function isNonEmptyStringRecord(value: unknown): value is CardRuntimeStringRecord {
    if (!isNonEmptyRecord(value)) return false;
    return Object.keys(value).every((key) => {
        const entry = readOwnDataProperty(value, key);
        return typeof entry === 'string' && entry.length > 0;
    });
}

function isCardDefinitionList(value: unknown): value is readonly CardRuntimeRecord[] {
    if (!Array.isArray(value) || value.length === 0) return false;
    for (let index = 0; index < value.length; index += 1) {
        const entry = readOwnDataProperty(value, String(index));
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
        const id = readOwnDataProperty(entry, 'id');
        const type = readOwnDataProperty(entry, 'type');
        const cost = readOwnDataProperty(entry, 'cost');
        const enabledDescriptor = Object.getOwnPropertyDescriptor(entry, 'enabled');
        if (typeof id !== 'string' || id.length === 0 || typeof type !== 'string' || type.length === 0) {
            return false;
        }
        if (typeof cost !== 'number' || !Number.isFinite(cost) || cost < 0) return false;
        if (enabledDescriptor) {
            if (!Object.prototype.hasOwnProperty.call(enabledDescriptor, 'value')) return false;
            if (enabledDescriptor.value !== undefined && typeof enabledDescriptor.value !== 'boolean') return false;
        }
    }
    return true;
}

function isProgressionConfigMap(value: unknown, mode: 'throw' | 'chain'): value is CardRuntimeRecord {
    if (!isNonEmptyRecord(value)) return false;
    for (const key of Object.keys(value)) {
        const entry = readOwnDataProperty(value, key);
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
        if (readOwnDataProperty(entry, 'type') !== key) return false;
        const cardId = readOwnDataProperty(entry, 'cardId');
        const name = readOwnDataProperty(entry, 'name');
        const nextType = readOwnDataProperty(entry, 'nextType');
        const nextCardId = readOwnDataProperty(entry, 'nextCardId');
        const nextName = readOwnDataProperty(entry, 'nextName');
        if (cardId !== null && (typeof cardId !== 'string' || cardId.length === 0)) return false;
        if (typeof name !== 'string' || name.length === 0) return false;
        if (nextType !== null && (typeof nextType !== 'string' || nextType.length === 0)) return false;
        if (nextCardId !== null && (typeof nextCardId !== 'string' || nextCardId.length === 0)) return false;
        if (nextName !== null && (typeof nextName !== 'string' || nextName.length === 0)) return false;
        const total = readOwnDataProperty(entry, mode === 'throw' ? 'totalPlacements' : 'totalChains');
        const infinite = readOwnDataProperty(entry, 'infinite');
        const extraPlacements = readOwnDataProperty(entry, 'extraPlacements');
        if (typeof total !== 'number' || !(total > 0) || (!Number.isInteger(total) && total !== Infinity)) return false;
        if (typeof infinite !== 'boolean' || infinite !== (total === Infinity)) return false;
        if (!Number.isInteger(extraPlacements) || Number(extraPlacements) < 0) return false;
        if (mode === 'chain') {
            const extraLinks = readOwnDataProperty(entry, 'extraLinks');
            if (typeof extraLinks !== 'number' || !(extraLinks > 0)
                || (!Number.isInteger(extraLinks) && extraLinks !== Infinity)) return false;
            if (extraLinks !== Infinity && extraLinks !== Number(total) - 1) return false;
            if (extraPlacements !== 0) return false;
        } else {
            const expectedExtraPlacements = total === Infinity ? 0 : Number(total) - 1;
            if (extraPlacements !== expectedExtraPlacements) return false;
        }
    }
    return true;
}

function isThrowProgressionConfigMap(value: unknown): value is CardRuntimeRecord {
    return isProgressionConfigMap(value, 'throw');
}

function isChainProgressionConfigMap(value: unknown): value is CardRuntimeRecord {
    return isProgressionConfigMap(value, 'chain');
}

function isMarkerKinds(value: unknown): value is CardRuntimeStringRecord {
    return isNonEmptyStringRecord(value)
        && readOwnDataProperty(value, 'SPECIAL_STONE') === 'specialStone'
        && readOwnDataProperty(value, 'MANIFEST_STONE') === 'manifestStone';
}

function isMarkerCategories(value: unknown): value is CardRuntimeStringRecord {
    return isNonEmptyStringRecord(value)
        && readOwnDataProperty(value, 'BOMB') === 'bomb';
}

function isManifestStoneMetadata(value: unknown): value is CardRuntimeRecord {
    if (!isNonEmptyRecord(value)) return false;
    for (const key of Object.keys(value)) {
        const entry = readOwnDataProperty(value, key);
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
        if (readOwnDataProperty(entry, 'markerType') !== key) return false;
        for (const stringKey of ['cardId', 'displayName', 'displayCategoryName', 'visualEffectKey']) {
            const text = readOwnDataProperty(entry, stringKey);
            if (typeof text !== 'string' || text.length === 0) return false;
        }
        if (!isPositiveInteger(readOwnDataProperty(entry, 'durationOwnerTurns'))) return false;
        if (typeof readOwnDataProperty(entry, 'inviolable') !== 'boolean') return false;
        const imagePathByOwner = readOwnDataProperty(entry, 'imagePathByOwner');
        if (!isNonEmptyStringRecord(imagePathByOwner)) return false;
        if (typeof readOwnDataProperty(imagePathByOwner, 'black') !== 'string'
            || typeof readOwnDataProperty(imagePathByOwner, 'white') !== 'string') return false;
    }
    return true;
}

function isDirectionList(value: unknown): value is CardRuntimeDirectionList {
    if (!Array.isArray(value) || value.length !== 8) return false;
    const uniqueDirections = new Set<string>();
    for (let index = 0; index < value.length; index += 1) {
        const direction = readOwnDataProperty(value, String(index));
        if (!Array.isArray(direction) || direction.length !== 2) return false;
        const rowDelta = readOwnDataProperty(direction, '0');
        const colDelta = readOwnDataProperty(direction, '1');
        if (!Number.isInteger(rowDelta) || !Number.isInteger(colDelta)) return false;
        if (Number(rowDelta) < -1 || Number(rowDelta) > 1 || Number(colDelta) < -1 || Number(colDelta) > 1) return false;
        if (rowDelta === 0 && colDelta === 0) return false;
        uniqueDirections.add(`${rowDelta},${colDelta}`);
    }
    return uniqueDirections.size === 8;
}

function isBonusDistribution(value: unknown): value is CardRuntimeBonusDistribution {
    if (!Array.isArray(value) || value.length === 0) return false;
    const coveredValues = new Set<number>();
    for (let index = 0; index < value.length; index += 1) {
        const entry = readOwnDataProperty(value, String(index));
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
        const bonusValue = readOwnDataProperty(entry, 'value');
        const count = readOwnDataProperty(entry, 'count');
        if (!Number.isInteger(bonusValue) || Number(bonusValue) < 1 || Number(bonusValue) > 10
            || !Number.isInteger(count) || Number(count) < 1 || coveredValues.has(Number(bonusValue))) {
            return false;
        }
        coveredValues.add(Number(bonusValue));
    }
    return coveredValues.size === 10;
}

function isPositiveInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isBlackPlayerValue(value: unknown): value is number {
    return value === 1;
}

function isWhitePlayerValue(value: unknown): value is number {
    return value === -1;
}

function isEmptyPlayerValue(value: unknown): value is number {
    return value === 0;
}

function isNonEmptyStringArray(value: unknown): value is readonly string[] {
    if (!Array.isArray(value) || value.length === 0) return false;
    for (let index = 0; index < value.length; index += 1) {
        const entry = readOwnDataProperty(value, String(index));
        if (typeof entry !== 'string' || entry.length === 0) return false;
    }
    return true;
}

function isNonEmptyStringSet(value: unknown): value is ReadonlySet<string> {
    if (!(value instanceof Set)) return false;
    try {
        if (SET_SIZE_GETTER.call(value) === 0) return false;
        const iterator = SET_VALUES.call(value);
        while (true) {
            const step = SET_ITERATOR_NEXT.call(iterator);
            if (step.done) break;
            if (typeof step.value !== 'string' || step.value.length === 0) return false;
        }
    } catch (_error) {
        return false;
    }
    return true;
}

function requiredFunctions<K extends readonly string[]>(...keys: K) {
    return Object.freeze({ functions: Object.freeze(keys), values: NO_REQUIRED_VALUE_EXPORTS });
}

function requiredValues<V extends Readonly<Record<string, CardRuntimeValueValidator<unknown>>>>(values: V) {
    return Object.freeze({ functions: NO_REQUIRED_EXPORTS, values: Object.freeze(values) });
}

function requiredFunctionsWithValues<
    F extends readonly string[],
    V extends Readonly<Record<string, CardRuntimeValueValidator<unknown>>>
>(functions: F, values: V) {
    return Object.freeze({ functions: Object.freeze(functions), values: Object.freeze(values) });
}

/**
 * Side-effect-free activation contract. Every listed export is used directly
 * by the factory or is the constructor for a narrower runtime port.
 */
export const CARD_RUNTIME_REQUIRED_EXPORTS = Object.freeze({
    state: Object.freeze({
        sharedConstants: requiredValues({
            CARD_DEFS: isCardDefinitionList,
            CARD_TYPE_BY_ID: isNonEmptyStringRecord,
            BLACK: isBlackPlayerValue,
            WHITE: isWhitePlayerValue,
            EMPTY: isEmptyPlayerValue,
            DIRECTIONS: isDirectionList,
            BOARD_SIZE: isPositiveInteger,
            CHARGE_MAX: isPositiveInteger,
            INITIAL_BOARD_BONUS_DISTRIBUTION: isBonusDistribution,
            TIME_STOP_GOD_TURNS: isPositiveInteger,
            TIME_STOP_GOD_CONSECUTIVE_TURNS: isPositiveInteger,
            TIME_STOP_GOD_SELF_DESTROY_COUNT: isPositiveInteger,
            TIME_STOP_DEITY_TURNS: isPositiveInteger,
            TIME_STOP_DEITY_CONSECUTIVE_TURNS: isPositiveInteger,
            TIME_STOP_DEITY_SELF_DESTROY_COUNT: isPositiveInteger
        }),
        deckSpec: requiredFunctions(
            'getEnabledCardIds', 'getStandardDeckCardIds', 'getDefaultDeckSize',
            'sampleDefaultDeckCardIds', 'normalizeDeckSpec', 'expandDeckSpec'
        ),
        randomSourceModule: requiredFunctions('resolveRandomSource', 'readRandomUnit', 'resolveRandomIndex'),
        stateFactory: requiredFunctions('createCardState', 'copyCardState'),
        stateManager: requiredFunctions(
            'drawCard', 'addToHand', 'removeFromHand', 'getHand', 'ensureHands',
            'addCharge', 'consumeCharge', 'getCharge', 'normalizeCharge', 'addMarker',
            'removeMarker', 'getMarkers', 'updateMarker', 'shuffleDeck', 'createDefaultDeck', 'getDeck'
        ),
        deckSetup: requiredFunctions('createCardDeckSetup'),
        handAccess: requiredFunctions('createCardHandAccess'),
        handManager: requiredFunctions(
            'dealInitialHands', 'commitDraw', 'getCardDef', 'getCardType', 'getCardDisplayName',
            'getCardCodeName', 'getCardCost', 'resolveHandIndexForCard', 'canConsumeCardUseForTurn',
            'canUseCard', 'ensureHandDestroyFlags', 'ensureCardCopyState', 'getHandCopyIdAt',
            'getHandCopyIds', 'isCardCopyIdRevealedToViewer', 'revealCurrentHandToViewer',
            'setCardCostOverrideForCopyId', 'addCardCostModifierForCopyId', 'getEffectiveCardCostForCopy',
            'addCardToHand', 'addCardToDiscard', 'removeHandCardAt', 'clearHandToDiscard',
            'moveDiscardCardToHandByCardId', 'destroyHandCard', 'analyzeCardUsability',
            'getUsableCardIds', 'hasUsableCard'
        ),
        availability: requiredFunctions('createCardAvailability'),
        costs: requiredFunctions('getCardCost'),
        definitions: requiredFunctions('getCardDef', 'getCardType', 'getCardDisplayName', 'getCardCodeName'),
        utilities: requiredFunctions(
            'normalizePlayerKey', 'ensureChargeState', 'setChargeWithDelta', 'addChargeWithDelta',
            'addCharge', 'getMarkerRuleClass', 'isManifestStoneMarker', 'isTrueSpecialStoneMarker',
            'isTemptTargetableMarker', 'isCaptureTargetableMarker', 'blocksTemptAt',
            'canLossWillRevertMarker', 'isDurationAffectableMarker', 'getManifestStoneMarkerAt',
            'getSpecialMarkerAt', 'getTrueSpecialStoneMarkerAt', 'isSpecialStoneAt',
            'isManifestStoneAt', 'isTrueSpecialStoneAt', 'isInviolableStoneAt',
            'isNonNormalStoneVisualAt', 'getSpecialOwnerAt', 'getTrueSpecialStoneOwnerAt',
            'isNormalStoneForPlayer'
        ),
        progression: requiredFunctionsWithValues(
            ['getThrowChainConfig', 'getChainWillConfig', 'isChainWillCardType',
                'addGeneratedThrowChainCard', 'addGeneratedChainWillCard', 'resolveChainWillMaxLinks'] as const,
            {
                THROW_CHAIN_CONFIG_BY_TYPE: isThrowProgressionConfigMap,
                CHAIN_WILL_CONFIG_BY_TYPE: isChainProgressionConfigMap,
                CHAIN_WILL_CARD_TYPES: isNonEmptyStringArray
            }
        ),
        offerBuilders: requiredFunctions('createOfferBuilders'),
        targetCounts: requiredFunctions('createEffectTargetCounts'),
        salvationEffect: requiredFunctions(
            'cloneSalvationDestroyedEntries', 'cloneSalvationDestroyedLedger',
            'ensureSalvationDestroyedLedger', 'createCardSalvationEffect'
        ),
        lossEffect: requiredFunctions('createCardLossEffect'),
        fateEffect: requiredFunctions('createCardFateEffect')
    }),
    targeting: Object.freeze({
        targetResolver: requiredFunctions(
            'getTrapTargets', 'getTeleportTargets', 'getBoardExpansionTargets', 'getBoardShrinkTargets',
            'getTabooReverseCandidates', 'pickTabooReverseFlips', 'getReverseWillTargets',
            'getSelectableTargets', 'getDestroyTargets', 'getSwapTargets', 'getGuardTargets',
            'getCaptureTargets', 'getTemptTargets', 'getPositionSwapTargets', 'getSeedTargets',
            'getCloneTargets', 'getBreedingTargets', 'getMeteorTargets', 'getCausalReplayTargets',
            'getFreezeTargets', 'getBlockadeTargets', 'getPoisonTargets', 'getScorchTargets', 'getHealingCellTargets',
            'getCellTeleportTargets', 'getSniperTargets', 'getTimeBombTargets', 'getLightningTargets',
            'getCrossBombTargets', 'getXBombTargets', 'getReinforcementTargets',
            'getEqualityTargets', 'getLastResortTargets'
        ),
        targetAccess: requiredFunctions(
            'getTemptWillTargets', 'getCaptureWillTargets', 'getTemptTargets', 'getCaptureTargets',
            'getDestroyTargets', 'getReverseWillTargets', 'getSwapTargets', 'getPositionSwapTargets',
            'getBreedingTargets', 'getSniperTargets', 'getLightningTargets', 'getCrossBombTargets',
            'getXBombTargets', 'getReinforcementTargets', 'getEqualityTargets', 'getLastResortTargets',
            'getTrapTargets', 'getGuardTargets', 'getLivingWillTargets', 'getHyperactiveInheritTargets',
            'getExtendLifeTargets', 'getCorrosionTargets', 'getTimeBombTargets', 'getTeleportTargets',
            'getCloneTargets', 'getBoardExpansionTargets', 'getBoardExpansionGodSocketTargets',
            'getBoardExpansionGodPendingSelectionsForCard', 'ensureExpansionCellForCard',
            'getBoardExpansionGodTargets', 'getBoardExpansionGodRequiredSelectionCount',
            'getBoardShrinkSelectionCount', 'getBoardShrinkPendingSelectionsForCard',
            'getBoardShrinkTargets', 'getBoardShrinkGodTargets', 'getCellTeleportDestinations',
            'getCellTeleportTargets', 'getBlockadeTargets', 'getPoisonTargets', 'getScorchTargets', 'getHealingCellTargets',
            'getMeteorTargets', 'getCausalReplayTargets', 'getFreezeTargets', 'getSeedTargets',
            'getStrongWindTargets', 'getSuperBuoyancyTargets', 'getBuoyancyTargets',
            'getSuperGravityTargets', 'getSuperAttractionTargets', 'getSuperAttractionPathPreview',
            'getGravityTargets', 'getSelectableTargets'
        ),
        selectors: requiredFunctions(
            'getDestroyTargets', 'getSwapTargets', 'getPositionSwapTargets', 'getStrongWindTargets',
            'getBuoyancyTargets', 'getSuperBuoyancyTargets', 'getSuperAttractionTargets',
            'getSuperAttractionPathPreview', 'getGravityTargets', 'getSuperGravityTargets',
            'getTrapTargets', 'getGuardTargets', 'getLivingWillTargets', 'getHyperactiveInheritTargets',
            'getExtendLifeTargets', 'getCorrosionTargets', 'getTimeBombTargets', 'getTeleportTargets',
            'getCellTeleportTargets', 'getCellTeleportDestinations', 'getCloneTargets', 'getReincarnationTargets',
            'getBoardExpansionSocketTargets', 'getBoardExpansionGodSocketTargets',
            'getBoardExpansionTargets', 'getBoardExpansionGodTargets', 'getBlockadeTargets',
            'getPoisonTargets', 'getScorchTargets', 'getHealingCellTargets', 'getMeteorTargets', 'getCausalReplayTargets',
            'getBoardShrinkTargets', 'getBoardShrinkGodTargets', 'getFreezeTargets', 'getSeedTargets',
            'isBlockedCell'
        ),
        usagePrechecks: requiredFunctions('validateCardUsagePreconditions'),
        targets: requiredFunctions('getTemptWillTargets', 'getCaptureWillTargets'),
        boardConfiguration: requiredFunctions('createCardBoardConfiguration'),
        boardShapeAccess: requiredFunctions('createCardBoardShapeAccess'),
        flips: requiredFunctions('getDirectionalChainFlips', 'getFlipsWithContext', 'getOccupiedOriginFlipsWithContext')
    }),
    board: Object.freeze({
        sharedBoardUtils: requiredFunctions(
            'resolveBoardConfig', 'createBoardContext', 'inspectBoardState', 'getCellValue', 'setCellValue',
            'addStateExpansionCells', 'createBoardMutationCheckpoint', 'restoreBoardMutationCheckpoint',
            'collectBoardCoordinates', 'getCornerCells', 'getEffectiveCornerCells', 'createBoardView',
            'toBoardCellKey', 'isMainBoardCell', 'isExpansionCoordinate'
        ),
        boardOps: requiredFunctions(
            'spawnAt', 'runSpawnBlock', 'destroyAt', 'changeAt', 'revertSpecialStoneAt', 'moveAt',
            'swapOccupiedCells', 'applyHoleAt', 'applyCellRemovalAt', 'getCellValue', 'setCellValue',
            'allocateStoneId', 'emitPresentationEvent', 'consumeStoneSalvationGodRevives',
            'runEffectBlock', 'runDestroyBlock', 'runCellRemovalBlock'
        ),
        markersAdapter: requiredFunctionsWithValues(
            ['ensureMarkers', 'getMarkers', 'getMarkerCategory', 'getSpecialMarkers',
                'getManifestMarkers', 'getBombMarkers', 'removeMarkersAt'] as const,
            {
                MARKER_KINDS: isMarkerKinds,
                MARKER_CATEGORIES: isMarkerCategories
            }
        ),
        expansion: requiredFunctions(
            'isMainBoardCellForCard', 'resolveExpansionSideForCard', 'normalizeExpansionOwnerForCard',
            'isExpansionCoordinateForCard', 'getExpansionDescriptorsForCard',
            'syncLegacyExpansionFieldsForCard', 'ensureMutableBoardExpansionForCard',
            'getCellValueForCard', 'setCellValueForCard', 'buildInitialBoardBonusMap'
        ),
        shrink: requiredFunctions('applyBoardShrinkWill', 'applyBoardShrinkGod'),
        movement: requiredFunctions(
            'applyStrongWindWill', 'applyBuoyancyWill', 'applySuperBuoyancyWill',
            'applySuperAttractionWill', 'applyGravityWill', 'applySuperGravityWill'
        ),
        teleport: requiredFunctions('applyTeleportWill', 'applyCellTeleportWill'),
        clone: requiredFunctions('applyCloneWill'),
        meteor: requiredFunctions('applyMeteorWill'),
        causalReplay: requiredFunctions('applyCausalReplayWill'),
        randomBoardSpawn: requiredFunctions(
            'collectRandomBoardSpawnablePositions', 'resolveRandomBoardSpawnEffectUsage',
            'canUseReinforcementWillForPlayer', 'resolveReinforcementWillUsage',
            'canUseSupportTroopsWillForPlayer', 'resolveSupportTroopsWillUsage'
        ),
        spawnAndFlip: requiredFunctions('resolveGeneratedFlipBatch', 'spawnAndFlipBatch', 'spawnAndFlipPlacement'),
        generatedSpawnFlipResolver: requiredFunctions('createGeneratedSpawnFlipResolver')
    }),
    marker: Object.freeze({
        specialCardRegistry: requiredFunctions('isInviolableSpecialCardId', 'getSpecialCardPresentation'),
        specialStoneRegistry: requiredFunctionsWithValues(
            ['normalizeSpecialStoneType', 'getSpecialStoneInfo', 'getSpecialStoneFootprint',
                'isFullyProtectedCell', 'isOverlayOnlySpecialStoneType', 'getMarkerSemanticTraits',
                'isTemporarySpecialCellType'] as const,
            { TEMPORARY_SPECIAL_CELL_TYPES: isNonEmptyStringSet }
        ),
        manifestStoneRegistry: requiredFunctionsWithValues(
            ['normalizeManifestStoneType', 'isManifestStoneType', 'getManifestStoneMetadata',
                'isManifestStoneMarker', 'createManifestStoneMarkerData'] as const,
            { MANIFEST_STONE_METADATA: isManifestStoneMetadata }
        ),
        evasionStatus: requiredFunctions(
            'normalizeEvasionType', 'getEvasionProfile', 'getFlipEvadeDefault', 'getDestroyEvadeDefault',
            'readFlipEvadeRemaining', 'readDestroyEvadeRemaining', 'canUseFlipEvade',
            'consumeFlipEvade', 'consumeDestroyEvade', 'shouldPruneEvasionMarker'
        ),
        destroyOutcome: requiredFunctions('createDestroyOutcome', 'isDestroyOutcomeResolved'),
        stoneStatusSnapshot: requiredFunctions(
            'toCounterOrNull', 'resolveDisplayTimerValue', 'createSpecialStoneStatusSnapshot',
            'buildSpecialStoneStatusTags', 'resolveStoneVisualStatusFromMarkers'
        ),
        presentationHelpers: requiredFunctions(
            'compactPresentationMeta', 'getCellVisualPresentationMeta',
            'swapOccupiedCellsWithPresentation', 'allocateStoneId',
            'emitPresentationEvent', 'flushPresentationEvents'
        ),
        contextBuilders: requiredFunctions('createCardContextBuilders'),
        captureSource: requiredFunctions('resolveCaptureSourceInfo'),
        markers: requiredFunctionsWithValues(
            ['ensureMarkers', 'getMarkers', 'getMarkerCategory', 'getBombMarkerType',
                'isBombCategoryMarker', 'isManifestStoneMarker', 'isSpecialStoneMarker',
                'getMarkerRuleClass', 'isTrueSpecialStoneMarker', 'isTemptTargetableMarker',
                'isCaptureTargetableMarker', 'blocksTemptAt', 'canLossWillRevertMarker',
                'isDurationAffectableMarker', 'isInviolableCell', 'isCardPlayLockedForPlayer',
                'isPlacementLockedForPlayer', 'getSpecialMarkers', 'getManifestMarkers',
                'getActiveManifestMarkers', 'getBombMarkers', 'getBlockadeMarkers', 'getBlockingMarkers',
                'isFrozenCellForCard', 'isMeteorHoleCell', 'isGuardProtectedCell', 'findSpecialMarkerAt',
                'findManifestMarkerAt', 'findBombMarkerAt', 'createMarkerContextIndex', 'removeMarkersAt',
                'getSpecialMarkerAt', 'getTrueSpecialStoneMarkerAt', 'isSpecialStoneAt',
                'isManifestStoneAt', 'isTrueSpecialStoneAt', 'getSpecialOwnerAt',
                'getTrueSpecialStoneOwnerAt', 'clearStoneIdAtForCard', 'getStoneIdAtForCard',
                'setStoneIdAtForCard', 'swapCellCoordinates', 'addMarker', 'applyExtendLifeWill',
                'applyExtendLifeGod', 'addSpecialStoneDurationOnHealingCells', 'applyCorrosionWill'] as const,
            {
                MARKER_KINDS: isMarkerKinds,
                MARKER_CATEGORIES: isMarkerCategories
            }
        )
    }),
    pending: Object.freeze({
        pendingStateManager: requiredFunctions(
            'requiresTargetSelection', 'isCancellablePendingType', 'resolvePendingSelectionContract',
            'isSelectionOnlyEndTurnPendingType', 'shouldDeferNetworkPublishForPendingType',
            'shouldWaitForPlaybackIdleForPendingType', 'resolvePendingSelectionDispatchKey',
            'createPendingEffectState', 'cancelPendingSelection'
        ),
        pendingCoordinator: requiredFunctions(
            'readPendingEffect', 'getPendingEffectType', 'writePendingEffect', 'clearPendingEffect',
            'requiresPendingTarget', 'getPendingSelectionContract', 'isSelectionOnlyEndTurnPendingType',
            'shouldDeferNetworkPublishForPendingType', 'shouldWaitForPlaybackIdleForPendingType',
            'resolvePendingSelectionDispatchKey', 'resolvePendingSelectionActionField',
            'buildPendingSelectionTargetPayload', 'applyPendingSelectionCardContext',
            'storePendingSelectionAction', 'readPendingSelectionAction', 'clearPendingSelectionAction',
            'clearPendingSelectionActionCache', 'syncPendingSelectionActionCache',
            'shouldRetainPendingSelectionAction', 'createPendingSelectionAction',
            'clearPendingSelectionFailureState'
        ),
        chargeLedger: requiredFunctions('setChargeValue', 'addChargeValue', 'addChargeWithTotal'),
        effectResolver: requiredFunctions(
            'getCardHandManagerContext', 'getCardEffectTimingContext', 'getCardContext',
            'applyCardUsage', 'cancelPendingSelection'
        ),
        timingProcessor: requiredFunctions(
            'onTurnStart', 'onTurnStartBeforeAnchors', 'drawForTurnStart',
            'flushDeferredTurnStartStatusExpirations', 'processTurnStartStatusMarkerAnchor',
            'onTurnEnd', 'applyPlacementEffects', 'tickBombs', 'tickBombAt',
            'processDragonEffects', 'processUltimateDestroyGodEffects', 'processHyperactiveMoves'
        ),
        riboTimeStop: requiredFunctions(
            'armRiboWillEffect', 'getTimeStopGodDestroyableCount', 'getTimeStopDeityDestroyableCount',
            'canUseTimeStopGodForPlayer', 'canUseTimeStopDeityForPlayer', 'resolveTimeStopGodUsage',
            'resolveTimeStopDeityUsage', 'consumeTimeStopConsecutiveTurn',
            'processTimeStopEffectsAtTurnStartAnchor', 'processRiboWillTurnStartEffects'
        )
    }),
    resolution: Object.freeze({
        theoryIncarnationBindings: requiredFunctions('buildTheoryIncarnationResolutionDeps'),
        chain: requiredFunctions('findChainChoice', 'applyChainWillAfterMove'),
        regen: requiredFunctions('applyRegenWill', 'applyRegenAfterFlips'),
        livingWill: requiredFunctions(
            'applyLivingWill', 'applyLivingWillAfterFlips', 'findLivingWillMarkerAt',
            'restoreFromLivingWillSnapshot'
        ),
        meteorGod: requiredFunctions('processMeteorGodEffects', 'processMeteorGodEffectsAtAnchor'),
        zombieWill: requiredFunctions('createZombieMarkerData', 'processZombieEffectsAtTurnStartAnchor'),
        timeBomb: requiredFunctions('applyTimeBombWill'),
        breeding: requiredFunctions(
            'processBreedingEffects', 'processBreedingEffectsAtAnchor',
            'processBreedingEffectsAtTurnStartAnchor'
        ),
        hyperactive: requiredFunctions(
            'moveHyperactiveOnce', 'moveRandomAdjacentStoneAtAnchor', 'resolveHyperactiveFlipEvasion',
            'processHyperactiveMoveAtAnchor', 'processInstantHyperactiveMoveAtAnchor',
            'processUltimateHyperactiveMoveAtAnchor', 'processGluttonousMoveAtAnchor',
            'processRobotVacuumMoveAtAnchor'
        ),
        ultimateDestroyGod: requiredFunctions(
            'processUltimateDestroyGodEffectsAtAnchor', 'processUltimateDestroyGodEffectsAtTurnStartAnchor'
        ),
        sniper: requiredFunctions('processSniperWillEffects', 'processSniperWillEffectsAtTurnStartAnchor'),
        lightning: requiredFunctions('processLightningWillEffects', 'processLightningWillEffectsAtAnchor'),
        fireWill: requiredFunctions('processFireWillEffects', 'processFireWillEffectsAtAnchor'),
        waterWill: requiredFunctions('processWaterWillEffects', 'processWaterWillEffectsAtAnchor'),
        grassWill: requiredFunctions('processGrassWillEffects', 'processGrassWillEffectsAtAnchor'),
        shinraBanshoGod: requiredFunctions('resolveShinraBanshoGodFusions'),
        willHunterKing: requiredFunctions('processWillHunterKingEffectsAtTurnStartAnchor'),
        destroyDragon: requiredFunctions(
            'processDestroyDragonEffects', 'processDestroyDragonEffectsAtAnchor',
            'processDestroyDragonEffectsAtTurnStartAnchor'
        ),
        workWill: requiredFunctions('placeWorkStone', 'processWorkEffects'),
        ultimateWorkGod: requiredFunctions('processUltimateWorkGodAtTurnStartAnchor'),
        dragonEffects: requiredFunctions('processDragonEffectsAtAnchor', 'processDragonEffectsAtTurnStartAnchor'),
        destroyOneStone: requiredFunctions('applyDestroyOneStone'),
        swapWithEnemy: requiredFunctions('applySwapWithEnemy'),
        protect: requiredFunctions('applyStrongWill', 'applyGuardWill'),
        trap: requiredFunctions('applyTrapWill', 'processTrapEffects'),
        ownership: requiredFunctions('applyTemptWill', 'transferCellMarkerOwnership', 'applyCaptureWill'),
        boardExpansionApply: requiredFunctions('applyBoardExpansionWill', 'applyBoardExpansionGod'),
        statusCells: requiredFunctions(
            'applyBlockadeWill', 'applyFreezeWill', 'applyMassFreezeWill', 'applySeedWill',
            'applySeedMarker', 'applyPoisonWill', 'applyScorchedCell', 'applyHealingCell',
            'syncPoisonContacts', 'syncScorchContacts', 'syncHazardContacts',
            'processStatusCellTurnEnd', 'processPoisonTurnEnd'
        ),
        handEffects: requiredFunctions(
            'applyHeavenBlessingChoice', 'applyRevealHandWill', 'applyCondemnWill',
            'applyObserverWillChoice', 'applyExecutionWill'
        ),
        observerWill: requiredFunctions(
            'applyObserverWillStoneReservation', 'hasActiveObserverWillReveal',
            'observeActiveObserverWillHandForOwner', 'applyObserverWillObservedCostTax',
            'clearObserverWillObservationCost', 'processObserverWillMarkerAtTurnStart',
            'processObserverWillRepaymentsAtTurnStart'
        ),
        theoryIncarnation: requiredFunctions(
            'addNumberCellCollectedTotal', 'canUseTheoryIncarnation', 'applyTheoryIncarnationUsage',
            'applyTheoryIncarnationStoneReservation', 'processTheoryIncarnationMarkerAtPlacement',
            'processTheoryIncarnationMarkerAtTurnStart',
            'processTheoryIncarnationMarkerAfterOwnerPlacement', 'processTheoryIncarnationOwnerPass'
        ),
        chaosSummon: requiredFunctions('canUseChaosSummon', 'applyChaosSummonUsage'),
        reincarnationWill: requiredFunctions('getReincarnationTargets', 'applyReincarnationWill'),
        boardExecutor: requiredFunctions(
            'canUseBoardExecutor', 'applyBoardExecutorUsage', 'applyBoardExecutorStoneReservation',
            'processBoardExecutorHandTaxAtTurnStart', 'processBoardExecutorMarkerAtTurnStart'
        ),
        specialStoneMarkerFactory: requiredFunctions(
            'buildMarkerDataForCardType', 'buildTheoryIncarnationSpawnEntry',
            'buildTheoryIncarnationSpawnTable'
        ),
        positionSwap: requiredFunctions('applyPositionSwapWill')
    })
});

type RequiredFunctionNames<S> = S extends { readonly functions: readonly (infer K)[] }
    ? Extract<K, string>
    : never;
type RequiredValueExports<S> = S extends {
    readonly values: infer V extends Readonly<Record<string, CardRuntimeValueValidator<unknown>>>
}
    ? { [K in keyof V]: V[K] extends CardRuntimeValueValidator<infer T> ? T : never }
    : Readonly<Record<never, never>>;
type CardRuntimePort<S> = Readonly<
    { [K in RequiredFunctionNames<S>]: CardRuntimeFunction }
    & RequiredValueExports<S>
>;
type CardRuntimeServicesFromSchema<S> = Readonly<{
    [C in keyof S]: Readonly<{
        [K in keyof S[C]]: CardRuntimePort<S[C][K]>
    }>
}>;
type CardRuntimeServicesInputFromSchema<S> = Readonly<{
    [C in keyof S]: Readonly<{
        [K in keyof S[C]]: CardRuntimeModule
    }>
}>;

export type CardRuntimeServices = CardRuntimeServicesFromSchema<typeof CARD_RUNTIME_REQUIRED_EXPORTS>;
export type CardRuntimeServicesInput = CardRuntimeServicesInputFromSchema<typeof CARD_RUNTIME_REQUIRED_EXPORTS>;
export type CardStateDeckHandServices = CardRuntimeServices['state'];
export type CardTargetLegalityServices = CardRuntimeServices['targeting'];
export type CardBoardTopologyServices = CardRuntimeServices['board'];
export type CardMarkerProtectionServices = CardRuntimeServices['marker'];
export type CardPendingServices = CardRuntimeServices['pending'];
export type CardResolutionServices = CardRuntimeServices['resolution'];

export type CardRuntimeCohort = keyof CardRuntimeServices;

export interface CardRuntimeInvocationContext {
    readonly cardState: unknown;
    readonly gameState: unknown;
    readonly playerKey: unknown;
    readonly randomSource?: unknown;
    readonly actionMeta?: unknown;
    readonly events?: unknown;
}

const SERVICE_GROUPS: readonly CardRuntimeCohort[] = Object.freeze([
    'state', 'targeting', 'board', 'marker', 'pending', 'resolution'
]);
export const CARD_RUNTIME_SERVICE_KEYS = Object.freeze({
    state: Object.freeze([
        'sharedConstants', 'deckSpec', 'randomSourceModule', 'stateFactory',
        'stateManager', 'deckSetup', 'handAccess', 'handManager', 'availability',
        'costs', 'definitions', 'utilities', 'progression', 'offerBuilders',
        'targetCounts', 'salvationEffect', 'lossEffect', 'fateEffect'
    ] satisfies readonly (keyof CardStateDeckHandServices)[]),
    targeting: Object.freeze([
        'targetResolver', 'targetAccess', 'selectors', 'usagePrechecks', 'targets',
        'boardConfiguration', 'boardShapeAccess', 'flips'
    ] satisfies readonly (keyof CardTargetLegalityServices)[]),
    board: Object.freeze([
        'sharedBoardUtils', 'boardOps', 'markersAdapter', 'expansion', 'shrink',
        'movement', 'teleport', 'clone', 'meteor', 'causalReplay',
        'randomBoardSpawn', 'spawnAndFlip', 'generatedSpawnFlipResolver'
    ] satisfies readonly (keyof CardBoardTopologyServices)[]),
    marker: Object.freeze([
        'specialCardRegistry', 'specialStoneRegistry', 'manifestStoneRegistry',
        'evasionStatus', 'destroyOutcome', 'stoneStatusSnapshot',
        'presentationHelpers', 'contextBuilders', 'captureSource', 'markers'
    ] satisfies readonly (keyof CardMarkerProtectionServices)[]),
    pending: Object.freeze([
        'pendingStateManager', 'pendingCoordinator', 'chargeLedger',
        'effectResolver', 'timingProcessor', 'riboTimeStop'
    ] satisfies readonly (keyof CardPendingServices)[]),
    resolution: Object.freeze([
        'theoryIncarnationBindings', 'chain', 'regen', 'livingWill', 'meteorGod',
        'zombieWill', 'timeBomb', 'breeding', 'hyperactive', 'ultimateDestroyGod',
        'sniper', 'lightning', 'fireWill', 'waterWill', 'grassWill',
        'shinraBanshoGod', 'willHunterKing', 'destroyDragon', 'workWill',
        'ultimateWorkGod', 'dragonEffects', 'destroyOneStone', 'swapWithEnemy',
        'protect', 'trap', 'ownership', 'boardExpansionApply', 'statusCells',
        'handEffects', 'observerWill', 'theoryIncarnation', 'chaosSummon', 'reincarnationWill',
        'boardExecutor', 'specialStoneMarkerFactory', 'positionSwap'
    ] satisfies readonly (keyof CardResolutionServices)[])
} satisfies Readonly<Record<CardRuntimeCohort, readonly string[]>>);
const FORBIDDEN_STATEFUL_SERVICE_KEYS = /^(?:cardState|gameState|prng|randomSource|events|action|actionMeta|snapshot)$/i;

function assertExactServiceKeys(
    value: object,
    expectedKeys: readonly string[],
    capability: string,
    cohort: string,
    root = false
): void {
    let ownKeys: PropertyKey[];
    try {
        ownKeys = Reflect.ownKeys(value);
    } catch (_error) {
        throw createCardRuntimeUnavailableError(capability, cohort);
    }
    const expected = new Set(expectedKeys);
    for (const ownKey of ownKeys) {
        if (typeof ownKey === 'string' && expected.has(ownKey)) continue;
        const keyLabel = typeof ownKey === 'symbol' ? ownKey.toString() : String(ownKey);
        if (!root && typeof ownKey === 'string' && FORBIDDEN_STATEFUL_SERVICE_KEYS.test(ownKey)) {
            throw new TypeError(`stateful invocation value is forbidden in card runtime services: ${capability}.${keyLabel}`);
        }
        throw new TypeError(root
            ? `unknown card runtime service group: ${keyLabel}`
            : `unknown card runtime service: ${capability}.${keyLabel}`);
    }
}

function isUsableModule(value: unknown): value is CardRuntimeModule {
    if (typeof value === 'function') return true;
    return !!value && typeof value === 'object' && Object.keys(value as object).some((key) => key !== '__esModule');
}

function assertSharedConstantsRelationships(
    moduleExports: Record<string, unknown>,
    cohort: CardRuntimeCohort,
    key: string
): void {
    const definitions = readOwnDataProperty(moduleExports, 'CARD_DEFS') as readonly CardRuntimeRecord[];
    const typeById = readOwnDataProperty(moduleExports, 'CARD_TYPE_BY_ID') as CardRuntimeStringRecord;
    const seenIds = new Set<string>();
    for (let index = 0; index < definitions.length; index += 1) {
        const definition = readOwnDataProperty(definitions, String(index)) as CardRuntimeRecord;
        const id = readOwnDataProperty(definition, 'id') as string;
        const type = readOwnDataProperty(definition, 'type') as string;
        if (seenIds.has(id) || readOwnDataProperty(typeById, id) !== type) {
            throw createCardRuntimeUnavailableError(`${cohort}.${key}.CARD_TYPE_BY_ID`, cohort);
        }
        seenIds.add(id);
    }
    if (Object.keys(typeById).length !== seenIds.size) {
        throw createCardRuntimeUnavailableError(`${cohort}.${key}.CARD_TYPE_BY_ID`, cohort);
    }
}

function assertProgressionRelationships(
    moduleExports: Record<string, unknown>,
    cohort: CardRuntimeCohort,
    key: string
): void {
    const throwConfig = readOwnDataProperty(moduleExports, 'THROW_CHAIN_CONFIG_BY_TYPE') as CardRuntimeRecord;
    const config = readOwnDataProperty(moduleExports, 'CHAIN_WILL_CONFIG_BY_TYPE') as CardRuntimeRecord;
    const cardTypes = readOwnDataProperty(moduleExports, 'CHAIN_WILL_CARD_TYPES') as readonly string[];
    const expected = Object.keys(config).sort();
    const actual: string[] = [];
    for (let index = 0; index < cardTypes.length; index += 1) {
        const value = readOwnDataProperty(cardTypes, String(index));
        if (typeof value !== 'string') {
            throw createCardRuntimeUnavailableError(`${cohort}.${key}.CHAIN_WILL_CARD_TYPES`, cohort);
        }
        actual.push(value);
    }
    actual.sort();
    if (new Set(actual).size !== actual.length || JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw createCardRuntimeUnavailableError(`${cohort}.${key}.CHAIN_WILL_CARD_TYPES`, cohort);
    }
    for (const [mapName, progressionMap] of [
        ['THROW_CHAIN_CONFIG_BY_TYPE', throwConfig],
        ['CHAIN_WILL_CONFIG_BY_TYPE', config]
    ] as const) {
        for (const type of Object.keys(progressionMap)) {
            const entry = readOwnDataProperty(progressionMap, type) as CardRuntimeRecord;
            const nextType = readOwnDataProperty(entry, 'nextType');
            const nextCardId = readOwnDataProperty(entry, 'nextCardId');
            const nextName = readOwnDataProperty(entry, 'nextName');
            if (nextType === null) {
                if (nextCardId !== null || nextName !== null) {
                    throw createCardRuntimeUnavailableError(`${cohort}.${key}.${mapName}`, cohort);
                }
                continue;
            }
            const nextEntry = readOwnDataProperty(progressionMap, nextType as string);
            const nextEntryCardId = nextEntry && typeof nextEntry === 'object'
                ? readOwnDataProperty(nextEntry, 'cardId')
                : undefined;
            const nextCatalogEntryIsMissing = nextCardId === null
                && nextName === null
                && nextEntryCardId === null;
            if (!nextEntry || typeof nextEntry !== 'object' || (
                !nextCatalogEntryIsMissing
                && (
                    nextCardId !== nextEntryCardId
                    || nextName !== readOwnDataProperty(nextEntry, 'name')
                )
            )) {
                throw createCardRuntimeUnavailableError(`${cohort}.${key}.${mapName}`, cohort);
            }
        }
    }
}

function assertRequiredModuleExports(
    cohort: CardRuntimeCohort,
    key: string,
    value: unknown
): void {
    let usable = false;
    try { usable = isUsableModule(value); } catch (_error) { usable = false; }
    if (!usable) {
        throw createCardRuntimeUnavailableError(`${cohort}.${key}`, cohort);
    }
    const cohortContracts = CARD_RUNTIME_REQUIRED_EXPORTS[cohort] as Record<string, {
        readonly functions: readonly string[];
        readonly values: Readonly<Record<string, CardRuntimeValueValidator<unknown>>>;
    }>;
    const contract = cohortContracts[key];
    if (!contract) {
        throw new TypeError(`missing card runtime export contract: ${cohort}.${key}`);
    }
    const moduleExports = value as Record<string, unknown>;
    for (const exportName of contract.functions) {
        const descriptor = readRuntimeServiceDescriptor(
            moduleExports,
            exportName,
            `${cohort}.${key}.${exportName}`,
            cohort
        );
        if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') || typeof descriptor.value !== 'function') {
            throw createCardRuntimeUnavailableError(`${cohort}.${key}.${exportName}`, cohort);
        }
    }
    for (const [exportName, validateValue] of Object.entries(contract.values)) {
        const descriptor = readRuntimeServiceDescriptor(
            moduleExports,
            exportName,
            `${cohort}.${key}.${exportName}`,
            cohort
        );
        let validValue = false;
        if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
            try { validValue = validateValue(descriptor.value); } catch (_error) { validValue = false; }
        }
        if (
            !descriptor
            || !Object.prototype.hasOwnProperty.call(descriptor, 'value')
            || !validValue
        ) {
            throw createCardRuntimeUnavailableError(`${cohort}.${key}.${exportName}`, cohort);
        }
    }
    if (cohort === 'state' && key === 'sharedConstants') {
        try {
            assertSharedConstantsRelationships(moduleExports, cohort, key);
        } catch (error) {
            if (isCardRuntimeUnavailableError(error)) throw error;
            throw createCardRuntimeUnavailableError(`${cohort}.${key}.CARD_TYPE_BY_ID`, cohort);
        }
    }
    if (cohort === 'state' && key === 'progression') {
        try {
            assertProgressionRelationships(moduleExports, cohort, key);
        } catch (error) {
            if (isCardRuntimeUnavailableError(error)) throw error;
            throw createCardRuntimeUnavailableError(`${cohort}.${key}.progressionRelationships`, cohort);
        }
    }
}

function freezeValidatedGroup<T extends object>(
    cohort: CardRuntimeCohort,
    groupValue: T
): Readonly<T> {
    if (!groupValue || typeof groupValue !== 'object' || Array.isArray(groupValue)) {
        throw createCardRuntimeUnavailableError(cohort, cohort);
    }
    assertExactServiceKeys(groupValue, CARD_RUNTIME_SERVICE_KEYS[cohort], cohort, cohort);
    const copy: Record<string, CardRuntimeModule> = {};
    for (const key of CARD_RUNTIME_SERVICE_KEYS[cohort]) {
        const descriptor = readRuntimeServiceDescriptor(groupValue, key, `${cohort}.${key}`, cohort);
        if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
            throw createCardRuntimeUnavailableError(`${cohort}.${key}`, cohort);
        }
        const value = descriptor.value;
        assertRequiredModuleExports(cohort, key, value);
        copy[key] = value;
    }
    if (Object.keys(copy).length === 0) {
        throw createCardRuntimeUnavailableError(cohort, cohort);
    }
    return Object.freeze(copy) as Readonly<T>;
}

export function createCardRuntimeServices(input: CardRuntimeServicesInput): CardRuntimeServices {
    if (!input || typeof input !== 'object') {
        throw createCardRuntimeUnavailableError('card-runtime-services', 'activation');
    }
    assertExactServiceKeys(input, SERVICE_GROUPS, 'card-runtime-services', 'activation', true);
    const resultRecord: Record<string, Readonly<object>> = {};
    for (const cohort of SERVICE_GROUPS) {
        const descriptor = readRuntimeServiceDescriptor(input, cohort, cohort, cohort);
        if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
            throw createCardRuntimeUnavailableError(cohort, cohort);
        }
        resultRecord[cohort] = freezeValidatedGroup(cohort, descriptor.value as object);
    }
    const result = resultRecord as unknown as CardRuntimeServices;
    for (const cohort of SERVICE_GROUPS) {
        if (!Object.isFrozen(result[cohort])) {
            throw new TypeError(`card runtime service group is mutable: ${cohort}`);
        }
    }
    return Object.freeze(result);
}

export function assertCardRuntimeServices(value: unknown): asserts value is CardRuntimeServices {
    const services = value as CardRuntimeServices;
    if (
        !services
        || typeof services !== 'object'
        || !readRuntimeServiceFrozenState(services, 'card-runtime-services/activation', 'activation')
    ) {
        throw createCardRuntimeUnavailableError('card-runtime-services', 'activation');
    }
    assertExactServiceKeys(services, SERVICE_GROUPS, 'card-runtime-services', 'activation', true);
    for (const cohort of SERVICE_GROUPS) {
        const descriptor = readRuntimeServiceDescriptor(services, cohort, cohort, 'activation');
        if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
            throw createCardRuntimeUnavailableError(cohort, 'activation');
        }
        const group = descriptor.value as CardRuntimeServices[typeof cohort];
        if (
            !group
            || typeof group !== 'object'
            || !readRuntimeServiceFrozenState(group, `${cohort}/activation`, 'activation')
        ) {
            throw createCardRuntimeUnavailableError(cohort, 'activation');
        }
        assertExactServiceKeys(group, CARD_RUNTIME_SERVICE_KEYS[cohort], cohort, cohort);
        for (const key of CARD_RUNTIME_SERVICE_KEYS[cohort]) {
            const descriptor = readRuntimeServiceDescriptor(group, key, `${cohort}.${key}`, cohort);
            if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
                throw createCardRuntimeUnavailableError(`${cohort}.${key}`, cohort);
            }
            assertRequiredModuleExports(cohort, key, descriptor.value);
        }
    }
}

export const CARD_RUNTIME_COHORT_OWNERSHIP = Object.freeze({
    state: 'game/logic/card-runtime-composer.ts',
    targeting: 'game/logic/card-runtime-composer.ts',
    board: 'game/logic/card-runtime-composer.ts',
    marker: 'game/logic/card-runtime-composer.ts',
    pending: 'game/logic/card-runtime-composer.ts',
    resolution: 'game/logic/card-runtime-composer.ts'
} satisfies Readonly<Record<CardRuntimeCohort, string>>);
