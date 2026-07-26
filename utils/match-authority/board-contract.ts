export const MATCH_BOARD_CONTRACT_VERSION = 2;

type RecordValue = Record<string, any>;

export interface MatchAuthorityBoardInspection {
    ok: boolean;
    version: number | null;
    legacy: boolean;
    migrated: boolean;
    errors: string[];
    warnings: string[];
}

export interface MatchAuthorityBoardDiscCounts {
    black: number;
    white: number;
}

interface SharedBoardUtilsLike {
    BOARD_CONTRACT_VERSION?: unknown;
    inspectBoardState?: (
        gameState: unknown,
        cardState: unknown,
        options?: { strict?: boolean }
    ) => {
        ok?: unknown;
        errors?: unknown;
        warnings?: unknown;
    };
    canonicalizeStateBoard?: (
        gameState: unknown,
        cardState: unknown,
        options?: { strict?: boolean }
    ) => {
        ok?: unknown;
        errors?: unknown;
        warnings?: unknown;
    };
    countStateDiscs?: (
        gameState: unknown,
        cardState: unknown
    ) => MatchAuthorityBoardDiscCounts;
}

interface MatchAuthorityBoardContractDeps {
    sharedBoardUtils: SharedBoardUtilsLike | null;
}

function asRecord(value: unknown): RecordValue {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as RecordValue
        : {};
}

function toStringList(value: unknown): string[] {
    return Array.isArray(value) ? value.map((entry) => String(entry)) : [];
}

function readContractVersion(snapshotValue: unknown): number | null {
    const snapshot = asRecord(snapshotValue);
    const meta = asRecord(snapshot._meta);
    if (!Object.prototype.hasOwnProperty.call(meta, 'boardContractVersion')) return null;
    const version = Number(meta.boardContractVersion);
    return Number.isInteger(version) ? version : null;
}

function sortExpansionDescriptorsForHash(snapshotValue: unknown): unknown {
    const snapshot = asRecord(snapshotValue);
    const gameState = asRecord(snapshot.gameState);
    const boardExpansion = asRecord(gameState.boardExpansion);
    if (!Array.isArray(boardExpansion.cells)) return snapshotValue;
    boardExpansion.cells = boardExpansion.cells.slice().sort((leftValue: unknown, rightValue: unknown) => {
        const left = asRecord(leftValue);
        const right = asRecord(rightValue);
        return Number(left.row) - Number(right.row) || Number(left.col) - Number(right.col);
    });
    return snapshotValue;
}

export function createMatchAuthorityBoardContractApi(deps: MatchAuthorityBoardContractDeps) {
    const boardUtils = deps && deps.sharedBoardUtils ? deps.sharedBoardUtils : null;
    const configuredVersion = Number(boardUtils && boardUtils.BOARD_CONTRACT_VERSION);
    const boardContractVersion = Number.isInteger(configuredVersion)
        ? configuredVersion
        : MATCH_BOARD_CONTRACT_VERSION;

    function inspectSnapshotBoardContract(
        snapshotValue: unknown,
        options?: { allowLegacy?: boolean; requireFullSnapshot?: boolean }
    ): MatchAuthorityBoardInspection {
        const opts = options && typeof options === 'object' ? options : {};
        const snapshot = asRecord(snapshotValue);
        const gameState = asRecord(snapshot.gameState);
        const cardState = asRecord(snapshot.cardState);
        const hasFullSnapshot = !!(
            snapshot.gameState
            && typeof snapshot.gameState === 'object'
            && !Array.isArray(snapshot.gameState)
            && snapshot.cardState
            && typeof snapshot.cardState === 'object'
            && !Array.isArray(snapshot.cardState)
        );
        const meta = asRecord(snapshot._meta);
        const hasVersion = Object.prototype.hasOwnProperty.call(meta, 'boardContractVersion');
        const version = readContractVersion(snapshotValue);
        const legacy = !hasVersion;

        if (!hasFullSnapshot) {
            if (opts.requireFullSnapshot === true || version !== null) {
                return {
                    ok: false,
                    version,
                    legacy,
                    migrated: false,
                    errors: ['snapshot requires gameState and cardState'],
                    warnings: []
                };
            }
            return {
                ok: true,
                version,
                legacy: true,
                migrated: false,
                errors: [],
                warnings: ['legacy partial snapshot was not board-validated']
            };
        }

        if (hasVersion && version !== boardContractVersion) {
            return {
                ok: false,
                version,
                legacy: false,
                migrated: false,
                errors: [`unsupported board contract version: ${version}`],
                warnings: []
            };
        }
        if (legacy && opts.allowLegacy === false) {
            return {
                ok: false,
                version,
                legacy: true,
                migrated: false,
                errors: ['board contract version is required'],
                warnings: []
            };
        }
        if (!boardUtils || typeof boardUtils.inspectBoardState !== 'function') {
            return {
                ok: false,
                version,
                legacy,
                migrated: false,
                errors: ['shared board inspector is unavailable'],
                warnings: []
            };
        }

        try {
            const inspection = boardUtils.inspectBoardState(gameState, cardState, {
                strict: !legacy
            });
            return {
                ok: inspection && inspection.ok === true,
                version,
                legacy,
                migrated: false,
                errors: toStringList(inspection && inspection.errors),
                warnings: toStringList(inspection && inspection.warnings)
            };
        } catch (error) {
            return {
                ok: false,
                version,
                legacy,
                migrated: false,
                errors: [error instanceof Error ? error.message : String(error)],
                warnings: []
            };
        }
    }

    function normalizeSnapshotBoardContract(
        snapshotValue: unknown,
        options?: { allowLegacy?: boolean; requireFullSnapshot?: boolean }
    ): MatchAuthorityBoardInspection {
        const initial = inspectSnapshotBoardContract(snapshotValue, options);
        if (!initial.ok) return initial;
        const snapshot = asRecord(snapshotValue);
        const gameState = asRecord(snapshot.gameState);
        const cardState = asRecord(snapshot.cardState);
        if (
            !snapshot.gameState
            || typeof snapshot.gameState !== 'object'
            || Array.isArray(snapshot.gameState)
            || !snapshot.cardState
            || typeof snapshot.cardState !== 'object'
            || Array.isArray(snapshot.cardState)
        ) {
            return initial;
        }
        if (!boardUtils || typeof boardUtils.canonicalizeStateBoard !== 'function') {
            return {
                ...initial,
                ok: false,
                errors: ['shared board canonicalizer is unavailable']
            };
        }

        try {
            const canonical = boardUtils.canonicalizeStateBoard(gameState, cardState, {
                strict: !initial.legacy
            });
            if (!canonical || canonical.ok !== true) {
                return {
                    ...initial,
                    ok: false,
                    errors: toStringList(canonical && canonical.errors),
                    warnings: toStringList(canonical && canonical.warnings)
                };
            }
            snapshot._meta = asRecord(snapshot._meta);
            snapshot._meta.boardContractVersion = boardContractVersion;
            const strictInspection = inspectSnapshotBoardContract(snapshot, {
                allowLegacy: false,
                requireFullSnapshot: options && options.requireFullSnapshot
            });
            return {
                ...strictInspection,
                legacy: initial.legacy,
                migrated: initial.legacy && strictInspection.ok,
                warnings: [
                    ...initial.warnings,
                    ...toStringList(canonical.warnings),
                    ...strictInspection.warnings
                ]
            };
        } catch (error) {
            return {
                ...initial,
                ok: false,
                errors: [error instanceof Error ? error.message : String(error)]
            };
        }
    }

    function stampSnapshotBoardContract(snapshotValue: unknown): boolean {
        const snapshot = asRecord(snapshotValue);
        if (Object.keys(snapshot).length === 0) return false;
        snapshot._meta = asRecord(snapshot._meta);
        snapshot._meta.boardContractVersion = boardContractVersion;
        return true;
    }

    function countSnapshotBoardDiscs(
        snapshotValue: unknown,
        boardUtilsOverride?: SharedBoardUtilsLike | null
    ): MatchAuthorityBoardDiscCounts | null {
        const snapshot = asRecord(snapshotValue);
        const gameState = asRecord(snapshot.gameState);
        const cardState = asRecord(snapshot.cardState);
        const activeBoardUtils = boardUtilsOverride || boardUtils;
        if (
            !snapshot.gameState
            || typeof snapshot.gameState !== 'object'
            || Array.isArray(snapshot.gameState)
            || !snapshot.cardState
            || typeof snapshot.cardState !== 'object'
            || Array.isArray(snapshot.cardState)
            || !activeBoardUtils
            || typeof activeBoardUtils.countStateDiscs !== 'function'
        ) {
            return null;
        }
        try {
            const counts = activeBoardUtils.countStateDiscs(gameState, cardState);
            const black = Number(counts && counts.black);
            const white = Number(counts && counts.white);
            return Number.isFinite(black) && Number.isFinite(white)
                ? { black: Math.trunc(black), white: Math.trunc(white) }
                : null;
        } catch (error) {
            return null;
        }
    }

    return {
        BOARD_CONTRACT_VERSION: boardContractVersion,
        readSnapshotBoardContractVersion: readContractVersion,
        inspectSnapshotBoardContract,
        normalizeSnapshotBoardContract,
        stampSnapshotBoardContract,
        canonicalizeSnapshotBoardForHash: sortExpansionDescriptorsForHash,
        countSnapshotBoardDiscs
    };
}
