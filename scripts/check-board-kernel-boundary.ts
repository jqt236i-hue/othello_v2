import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

export type BoardKernelBoundaryRule =
    | 'hidden-shape-metadata'
    | 'dense-othello-priority'
    | 'authority-dense-board-aggregation'
    | 'ui-expansion-reconstruction'
    | 'consumer-expansion-interpretation'
    | 'consumer-dense-board-cell-access'
    | 'consumer-state-board-alias'
    | 'consumer-expansion-fallback-import'
    | 'fixed-board-geometry'
    | 'raw-state-shape-api'
    | 'state-kernel-null-card-state'
    | 'board-context-array-gate';

export interface BoardKernelBoundaryViolation {
    file: string;
    line: number;
    rule: BoardKernelBoundaryRule;
    scope: string;
    detail: string;
}

interface BoundaryAllowlistEntry {
    file: string;
    rule: BoardKernelBoundaryRule;
    scope: string;
    detail: string;
    maxMatches: number;
    purpose: string;
}

const repositoryRoot = path.resolve(__dirname, '..', '..');
const SOURCE_ROOTS = [
    'browser-vite',
    'game',
    'shared',
    'src/engine',
    'ui',
    'utils',
    'workers'
] as const;
const ROOT_SOURCE_FILES = [
    'entry-browser.js',
    'scripts/local-match-server.ts'
] as const;
const SKIP_SEGMENTS = new Set([
    '.git',
    '.wrangler',
    '__tests__',
    'coverage',
    'dist',
    'generated',
    'generated-assets',
    'node_modules',
    'test',
    'tests',
    'worker-public'
]);

/**
 * Every exception is identified by file, rule, enclosing declaration, and the
 * exact offending AST text. This intentionally makes moved or substituted
 * exceptions reviewable instead of letting an unrelated violation consume a
 * file-level count allowance.
 */
const ALLOWLIST: readonly BoundaryAllowlistEntry[] = Object.freeze([
    Object.freeze({
        file: 'game/ai/othello-onnx-runtime.ts',
        rule: 'fixed-board-geometry' as const,
        scope: 'isCornerMove',
        detail: 'row === 7',
        maxMatches: 1,
        purpose: 'The Othello ONNX feature/tensor contract is explicitly dense 8x8.'
    }),
    Object.freeze({
        file: 'game/ai/othello-onnx-runtime.ts',
        rule: 'fixed-board-geometry' as const,
        scope: 'isCornerMove',
        detail: 'col === 7',
        maxMatches: 1,
        purpose: 'The Othello ONNX feature/tensor contract is explicitly dense 8x8.'
    }),
    Object.freeze({
        file: 'game/ai/othello-onnx-runtime.ts',
        rule: 'fixed-board-geometry' as const,
        scope: 'isEdgeMove',
        detail: 'row === 7',
        maxMatches: 1,
        purpose: 'The Othello ONNX feature/tensor contract is explicitly dense 8x8.'
    }),
    Object.freeze({
        file: 'game/ai/othello-onnx-runtime.ts',
        rule: 'fixed-board-geometry' as const,
        scope: 'isEdgeMove',
        detail: 'col === 7',
        maxMatches: 1,
        purpose: 'The Othello ONNX feature/tensor contract is explicitly dense 8x8.'
    }),
    Object.freeze({
        file: 'game/ai/othello-onnx-runtime.ts',
        rule: 'fixed-board-geometry' as const,
        scope: 'isCSquareMove',
        detail: 'row === 7',
        maxMatches: 1,
        purpose: 'The Othello ONNX feature/tensor contract is explicitly dense 8x8.'
    }),
    Object.freeze({
        file: 'game/ai/othello-onnx-runtime.ts',
        rule: 'fixed-board-geometry' as const,
        scope: 'isCSquareMove',
        detail: 'col === 7',
        maxMatches: 1,
        purpose: 'The Othello ONNX feature/tensor contract is explicitly dense 8x8.'
    }),
    Object.freeze({
        file: 'game/ai/othello-onnx-runtime.ts',
        rule: 'fixed-board-geometry' as const,
        scope: 'buildInputVector',
        detail: 'row === 7',
        maxMatches: 2,
        purpose: 'The Othello ONNX feature/tensor contract is explicitly dense 8x8.'
    }),
    Object.freeze({
        file: 'game/ai/othello-onnx-runtime.ts',
        rule: 'fixed-board-geometry' as const,
        scope: 'buildInputVector',
        detail: 'col === 7',
        maxMatches: 2,
        purpose: 'The Othello ONNX feature/tensor contract is explicitly dense 8x8.'
    }),
    Object.freeze({
        file: 'game/ai/othello-onnx-runtime.ts',
        rule: 'board-context-array-gate' as const,
        scope: 'buildInputVector',
        detail: 'Array.isArray(ctx.board)',
        maxMatches: 1,
        purpose: 'The Othello ONNX tensor adapter intentionally accepts only its explicit dense 8x8 model input.'
    }),
    Object.freeze({
        file: 'game/ai/policy-onnx-runtime.ts',
        rule: 'fixed-board-geometry' as const,
        scope: 'isStandardBoardCoordinate',
        detail: 'value.row < 8',
        maxMatches: 1,
        purpose: 'The policy ONNX runtime rejects coordinates outside its declared standard_dense_8x8.v1 input contract.'
    }),
    Object.freeze({
        file: 'game/ai/policy-onnx-runtime.ts',
        rule: 'fixed-board-geometry' as const,
        scope: 'isStandardBoardCoordinate',
        detail: 'value.col < 8',
        maxMatches: 1,
        purpose: 'The policy ONNX runtime rejects coordinates outside its declared standard_dense_8x8.v1 input contract.'
    }),
    Object.freeze({
        file: 'ui/board-visual/model-builder.ts',
        rule: 'ui-expansion-reconstruction' as const,
        scope: 'buildDomCompatibilityRenderState',
        detail: 'boardExpansion.cells reverse projection',
        maxMatches: 1,
        purpose: 'DOM compatibility receives a completed model and immediately validates this reverse projection with BoardView digest parity.'
    }),
    Object.freeze({
        file: 'ui/board-visual/performance-harness.ts',
        rule: 'consumer-dense-board-cell-access' as const,
        scope: 'createGameState',
        detail: 'state.board[stone.row][stone.col]',
        maxMatches: 1,
        purpose: 'The performance harness writes a declared dense fixture before the canonical model is built.'
    }),
    Object.freeze({
        file: 'ui/pixi/board-scene.ts',
        rule: 'fixed-board-geometry' as const,
        scope: 'updateStarPoints',
        detail: 'row < 8',
        maxMatches: 1,
        purpose: 'Standard-board star decoration is explicitly gated by an 8x8 topology check and suppresses base voids.'
    }),
    Object.freeze({
        file: 'ui/pixi/board-scene.ts',
        rule: 'fixed-board-geometry' as const,
        scope: 'updateStarPoints',
        detail: 'col < 8',
        maxMatches: 1,
        purpose: 'Standard-board star decoration is explicitly gated by an 8x8 topology check and suppresses base voids.'
    })
]);

const HIDDEN_METADATA_NAMES = new Set([
    '__sharedBoardShapeMeta',
    'BOARD_SHAPE_META_KEY',
    'attachBoardShape',
    'copyBoardShapeMeta',
    'getBoardShapeMeta',
    'registerBoardShape'
]);
const SHAPE_API_NAMES = new Set([
    'cloneBoard',
    'collectBoardCoordinates',
    'countBoardEmpties',
    'countCornerControl',
    'countDiscs',
    'countDiscsByPlayer',
    'countEdgeControl',
    'forEachBoardShapeCell',
    'getBoardExpansionCornerSockets',
    'getBoardExpansionEdgeSockets',
    'getCellType',
    'getCellValue',
    'getCornerCells',
    'getCornerProximity',
    'getEffectiveCornerCells',
    'getEffectiveEdgeCells',
    'getExteriorVoidKeys',
    'getFlipsBasic',
    'getLegalMovesBasic',
    'getPerimeterCells',
    'hasPlayableCell',
    'isCorner',
    'isCornerCell',
    'isCSquare',
    'isEdge',
    'isEdgeCell',
    'isStandardBoard8x8',
    'isXSquare',
    'resolveBoardBounds',
    'setCellValue',
    'setCellValues',
    'summarizeEdgeRuns'
]);
const STATE_KERNEL_CARD_STATE_ARGUMENTS = new Map<string, number>([
    ['addStateExpansionCells', 2],
    ['canonicalizeStateBoard', 1],
    ['countStateDiscs', 1],
    ['createBoardContext', 1],
    ['createBoardMutationCheckpoint', 1],
    ['getStateCellValue', 3],
    ['restoreBoardMutationCheckpoint', 1],
    ['setStateCellValue', 4],
    ['setStateCellValues', 2]
]);
const STATE_KERNEL_CARD_STATE_OPTIONS = new Set([
    'buildBoardTopology',
    'createBoardView'
]);
const CANONICAL_FACADE_NAMES = new Set([
    'BoardUtils',
    'SharedBoardUtils',
    'boardUtils',
    'sharedBoardUtils'
]);
const COORDINATE_NAMES = new Set([
    'col',
    'column',
    'fromCol',
    'fromRow',
    'nextCol',
    'nextRow',
    'row',
    'sourceCol',
    'sourceRow',
    'targetCol',
    'targetRow',
    'toCol',
    'toRow'
]);

function normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
}

function toLine(sourceFile: ts.SourceFile, node: ts.Node): number {
    return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
    let current = expression;
    while (
        ts.isParenthesizedExpression(current)
        || ts.isAsExpression(current)
        || ts.isTypeAssertionExpression(current)
        || ts.isNonNullExpression(current)
    ) {
        current = current.expression;
    }
    return current;
}

function readPropertyName(expression: ts.Expression): string | null {
    const value = unwrapExpression(expression);
    if (ts.isPropertyAccessExpression(value) || ts.isPropertyAccessChain(value)) {
        return value.name.text;
    }
    if (ts.isElementAccessExpression(value) || ts.isElementAccessChain(value)) {
        const key = value.argumentExpression;
        return key && ts.isStringLiteralLike(key) ? key.text : null;
    }
    return null;
}

function readCallReceiver(expression: ts.Expression): ts.Expression | null {
    const value = unwrapExpression(expression);
    if (
        ts.isPropertyAccessExpression(value)
        || ts.isPropertyAccessChain(value)
        || ts.isElementAccessExpression(value)
        || ts.isElementAccessChain(value)
    ) {
        return value.expression;
    }
    return null;
}

function numericLiteralValue(expression: ts.Expression): number | null {
    const value = unwrapExpression(expression);
    if (ts.isNumericLiteral(value)) return Number(value.text);
    if (
        ts.isPrefixUnaryExpression(value)
        && value.operator === ts.SyntaxKind.MinusToken
        && ts.isNumericLiteral(value.operand)
    ) {
        return -Number(value.operand.text);
    }
    return null;
}

function isCoordinateExpression(expression: ts.Expression): boolean {
    const value = unwrapExpression(expression);
    if (ts.isIdentifier(value)) return COORDINATE_NAMES.has(value.text);
    if (ts.isPropertyAccessExpression(value) || ts.isPropertyAccessChain(value)) {
        return COORDINATE_NAMES.has(value.name.text);
    }
    return false;
}

function isComparisonOperator(kind: ts.SyntaxKind): boolean {
    return kind === ts.SyntaxKind.EqualsEqualsToken
        || kind === ts.SyntaxKind.EqualsEqualsEqualsToken
        || kind === ts.SyntaxKind.ExclamationEqualsToken
        || kind === ts.SyntaxKind.ExclamationEqualsEqualsToken
        || kind === ts.SyntaxKind.LessThanToken
        || kind === ts.SyntaxKind.LessThanEqualsToken
        || kind === ts.SyntaxKind.GreaterThanToken
        || kind === ts.SyntaxKind.GreaterThanEqualsToken;
}

function containsDerivedOuterBound(expression: ts.Expression, sourceFile: ts.SourceFile): boolean {
    const text = expression.getText(sourceFile).replace(/\s+/g, '');
    return /(?:maxRow|maxCol|rows|cols|board\.length)\+1\b/.test(text)
        || /\b(?:minRow|minCol)-1\b/.test(text);
}

function isTopologySensitiveConsumer(filePath: string): boolean {
    return filePath === 'shared/board-hint-projection.ts'
        || filePath === 'shared/commentary-context-helpers.ts'
        || filePath === 'shared/leaderboard-score.ts'
        || filePath === 'shared/playback-event-helpers.ts'
        || filePath === 'game/game-core-logic.ts'
        || filePath === 'game/logic/board_ops.ts'
        || filePath === 'game/logic/cards.ts'
        || filePath === 'game/logic/core.ts'
        || filePath === 'game/move-generator.ts'
        || filePath === 'game/network-turn-handoff.ts'
        || filePath === 'game/turn-manager.ts'
        || filePath === 'ui/board-accessibility-layer.ts'
        || filePath === 'ui/board-renderer.ts'
        || filePath === 'ui/presentation-handler.ts'
        || filePath === 'ui/result-overlay.ts'
        || filePath === 'ui/status-display.ts'
        || filePath.startsWith('game/ai/')
        || filePath.startsWith('game/card-effects/')
        || filePath.startsWith('game/cards/')
        || filePath.startsWith('game/cpu')
        || filePath.startsWith('game/logic/card-resolution/')
        || filePath.startsWith('game/logic/cards/')
        || filePath.startsWith('game/logic/cards-internal/')
        || filePath.startsWith('game/logic/effects/')
        || filePath.startsWith('game/special-effects/')
        || filePath.startsWith('game/turn/')
        || filePath.startsWith('src/engine/')
        || filePath.startsWith('ui/board-')
        || filePath.startsWith('ui/network/')
        || filePath.startsWith('ui/pixi/')
        || filePath.startsWith('ui/presentation/');
}

function isAuthorityFile(filePath: string): boolean {
    return filePath === 'workers/match-worker.ts'
        || filePath === 'scripts/local-match-server.ts'
        || filePath === 'utils/match-authority.ts'
        || filePath.startsWith('utils/match-authority/');
}

function isUiBoardProjection(filePath: string): boolean {
    return filePath.startsWith('ui/board-visual/')
        || filePath.startsWith('ui/board-dom-compat/')
        || filePath.startsWith('ui/board-input');
}

function isCardTopologyConsumer(filePath: string): boolean {
    if (
        filePath === 'game/logic/cards/expansion.ts'
        || filePath === 'game/logic/cards-internal/expansion-fallback.ts'
    ) {
        return false;
    }
    return filePath === 'game/logic/cards.ts'
        || filePath.startsWith('game/cards/')
        || filePath.startsWith('game/card-effects/')
        || filePath.startsWith('game/logic/card-resolution/')
        || filePath.startsWith('game/logic/cards/')
        || filePath.startsWith('game/logic/effects/')
        || filePath.startsWith('game/special-effects/');
}

function isExpansionDescriptorConsumer(filePath: string): boolean {
    return isCardTopologyConsumer(filePath)
        || filePath === 'shared/board-hint-projection.ts'
        || filePath.startsWith('ui/presentation/');
}

function expressionContainsBoardProperty(expression: ts.Expression, sourceFile: ts.SourceFile): boolean {
    return /(?:^|[?.])board(?:$|[?.[])/.test(expression.getText(sourceFile).replace(/\s+/g, ''));
}

function expressionContainsBoardExpansion(expression: ts.Expression, sourceFile: ts.SourceFile): boolean {
    const text = expression.getText(sourceFile).replace(/\s+/g, '');
    return /(?:^|[?.])boardExpansion(?:$|[?.[])/.test(text)
        || /^(?:expansion|expansionState)$/.test(text);
}

type BoardKernelAliasIndex = {
    facadeNames: Set<string>;
    apiNames: Map<string, string>;
    denseBoardNames: Set<string>;
};

function isCanonicalBoardModulePath(value: string): boolean {
    const normalized = value.replace(/\\/g, '/').toLowerCase();
    return normalized.includes('shared-board-utils')
        || normalized.includes('board/state-kernel');
}

function isStateLikeIdentifier(name: string): boolean {
    return /^(?:gs|gameState|state)(?:Ref|Value|Override|Snapshot)?$/i.test(name)
        || /gameState/i.test(name);
}

function isStateLikeExpression(expression: ts.Expression): boolean {
    const value = unwrapExpression(expression);
    if (ts.isIdentifier(value)) return isStateLikeIdentifier(value.text);
    if (ts.isPropertyAccessExpression(value) || ts.isPropertyAccessChain(value)) {
        return value.name.text === 'gameState';
    }
    if (ts.isElementAccessExpression(value) || ts.isElementAccessChain(value)) {
        const key = value.argumentExpression;
        return !!key && ts.isStringLiteralLike(key) && key.text === 'gameState';
    }
    return false;
}

function isRawStateBoardProperty(expression: ts.Expression): boolean {
    const value = unwrapExpression(expression);
    if (ts.isPropertyAccessExpression(value) || ts.isPropertyAccessChain(value)) {
        return value.name.text === 'board' && isStateLikeExpression(value.expression);
    }
    if (ts.isElementAccessExpression(value) || ts.isElementAccessChain(value)) {
        const key = value.argumentExpression;
        return !!key
            && ts.isStringLiteralLike(key)
            && key.text === 'board'
            && isStateLikeExpression(value.expression);
    }
    return false;
}

function containsDirectRawStateBoardValue(expression: ts.Expression): boolean {
    const value = unwrapExpression(expression);
    if (isRawStateBoardProperty(value)) return true;
    if (ts.isConditionalExpression(value)) {
        return containsDirectRawStateBoardValue(value.whenTrue)
            || containsDirectRawStateBoardValue(value.whenFalse);
    }
    if (
        ts.isBinaryExpression(value)
        && (
            value.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
            || value.operatorToken.kind === ts.SyntaxKind.BarBarToken
            || value.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
        )
    ) {
        return containsDirectRawStateBoardValue(value.left)
            || containsDirectRawStateBoardValue(value.right);
    }
    return false;
}

function isCanonicalFacadeName(name: string): boolean {
    return CANONICAL_FACADE_NAMES.has(name)
        || /Board(?:Utils|Kernel)(?:Module|Required)?$/i.test(name);
}

function isCanonicalFacadeExpression(
    expression: ts.Expression,
    aliases: BoardKernelAliasIndex
): boolean {
    const value = unwrapExpression(expression);
    if (ts.isIdentifier(value)) {
        return aliases.facadeNames.has(value.text) || isCanonicalFacadeName(value.text);
    }
    if (ts.isCallExpression(value)) {
        const callName = readPropertyName(value.expression)
            || (ts.isIdentifier(unwrapExpression(value.expression))
                ? (unwrapExpression(value.expression) as ts.Identifier).text
                : '');
        if (/Board(?:Utils|Kernel)/i.test(callName)) return true;
        if (
            ts.isIdentifier(unwrapExpression(value.expression))
            && (unwrapExpression(value.expression) as ts.Identifier).text === 'require'
            && value.arguments[0]
            && ts.isStringLiteralLike(value.arguments[0])
        ) {
            return isCanonicalBoardModulePath(value.arguments[0].text);
        }
    }
    if (ts.isPropertyAccessExpression(value) || ts.isPropertyAccessChain(value)) {
        return isCanonicalFacadeName(value.name.text);
    }
    return false;
}

function allCanonicalApiNames(): Set<string> {
    return new Set([
        ...SHAPE_API_NAMES,
        ...STATE_KERNEL_CARD_STATE_ARGUMENTS.keys(),
        ...STATE_KERNEL_CARD_STATE_OPTIONS
    ]);
}

function bindingPropertyName(element: ts.BindingElement): string | null {
    const propertyName = element.propertyName || element.name;
    if (ts.isIdentifier(propertyName)) return propertyName.text;
    if (ts.isStringLiteralLike(propertyName)) return propertyName.text;
    return null;
}

function bindingLocalName(element: ts.BindingElement): string | null {
    return ts.isIdentifier(element.name) ? element.name.text : null;
}

function collectBoardKernelAliases(sourceFile: ts.SourceFile): BoardKernelAliasIndex {
    const aliases: BoardKernelAliasIndex = {
        facadeNames: new Set(CANONICAL_FACADE_NAMES),
        apiNames: new Map<string, string>(),
        denseBoardNames: new Set<string>()
    };
    const canonicalApis = allCanonicalApiNames();

    const collectOnce = (): boolean => {
        const before = aliases.facadeNames.size + aliases.apiNames.size + aliases.denseBoardNames.size;
        const visit = (node: ts.Node): void => {
            if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
                if (isCanonicalBoardModulePath(node.moduleSpecifier.text) && node.importClause) {
                    if (node.importClause.name) aliases.facadeNames.add(node.importClause.name.text);
                    const bindings = node.importClause.namedBindings;
                    if (bindings && ts.isNamespaceImport(bindings)) {
                        aliases.facadeNames.add(bindings.name.text);
                    } else if (bindings && ts.isNamedImports(bindings)) {
                        for (const element of bindings.elements) {
                            const importedName = (element.propertyName || element.name).text;
                            if (canonicalApis.has(importedName)) {
                                aliases.apiNames.set(element.name.text, importedName);
                            }
                        }
                    }
                }
            }
            if (
                ts.isImportEqualsDeclaration(node)
                && ts.isExternalModuleReference(node.moduleReference)
                && node.moduleReference.expression
                && ts.isStringLiteralLike(node.moduleReference.expression)
                && isCanonicalBoardModulePath(node.moduleReference.expression.text)
            ) {
                aliases.facadeNames.add(node.name.text);
            }
            if (ts.isVariableDeclaration(node) && node.initializer) {
                if (ts.isIdentifier(node.name)) {
                    const localName = node.name.text;
                    if (isCanonicalFacadeExpression(node.initializer, aliases)) {
                        aliases.facadeNames.add(localName);
                    }
                    const initializer = unwrapExpression(node.initializer);
                    if (
                        ts.isPropertyAccessExpression(initializer)
                        || ts.isPropertyAccessChain(initializer)
                        || ts.isElementAccessExpression(initializer)
                        || ts.isElementAccessChain(initializer)
                    ) {
                        const apiName = readPropertyName(initializer);
                        const receiver = readCallReceiver(initializer);
                        if (
                            apiName
                            && canonicalApis.has(apiName)
                            && receiver
                            && isCanonicalFacadeExpression(receiver, aliases)
                        ) {
                            aliases.apiNames.set(localName, apiName);
                        }
                    } else if (ts.isIdentifier(initializer) && aliases.apiNames.has(initializer.text)) {
                        aliases.apiNames.set(localName, aliases.apiNames.get(initializer.text)!);
                    }
                    if (containsDirectRawStateBoardValue(node.initializer)) {
                        aliases.denseBoardNames.add(localName);
                    }
                } else if (ts.isObjectBindingPattern(node.name)) {
                    if (isCanonicalFacadeExpression(node.initializer, aliases)) {
                        for (const element of node.name.elements) {
                            const propertyName = bindingPropertyName(element);
                            const localName = bindingLocalName(element);
                            if (propertyName && localName && canonicalApis.has(propertyName)) {
                                aliases.apiNames.set(localName, propertyName);
                            }
                        }
                    }
                    if (isStateLikeExpression(node.initializer)) {
                        for (const element of node.name.elements) {
                            if (bindingPropertyName(element) === 'board') {
                                const localName = bindingLocalName(element);
                                if (localName) aliases.denseBoardNames.add(localName);
                            }
                        }
                    }
                }
            }
            if (
                ts.isBinaryExpression(node)
                && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
                && ts.isIdentifier(unwrapExpression(node.left))
            ) {
                const localName = (unwrapExpression(node.left) as ts.Identifier).text;
                if (containsDirectRawStateBoardValue(node.right)) {
                    aliases.denseBoardNames.add(localName);
                }
                if (isCanonicalFacadeExpression(node.right, aliases)) {
                    aliases.facadeNames.add(localName);
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(sourceFile);
        const after = aliases.facadeNames.size + aliases.apiNames.size + aliases.denseBoardNames.size;
        return after > before;
    };

    for (let pass = 0; pass < 4 && collectOnce(); pass += 1) {
        // A small fixed-point resolves chained aliases without type-checker I/O.
    }
    return aliases;
}

function isDirectStateBoardCellAccess(
    node: ts.Node,
    aliases: BoardKernelAliasIndex
): boolean {
    if (!ts.isElementAccessExpression(node) && !ts.isElementAccessChain(node)) return false;
    const rowAccess = unwrapExpression(node.expression);
    if (!ts.isElementAccessExpression(rowAccess) && !ts.isElementAccessChain(rowAccess)) return false;
    const boardAccess = unwrapExpression(rowAccess.expression);
    if (
        (ts.isPropertyAccessExpression(boardAccess) || ts.isPropertyAccessChain(boardAccess))
        && boardAccess.name.text === 'board'
    ) {
        return true;
    }
    return ts.isIdentifier(boardAccess) && aliases.denseBoardNames.has(boardAccess.text);
}

function isRawStateExpression(
    expression: ts.Expression,
    sourceFile: ts.SourceFile,
    aliases: BoardKernelAliasIndex
): boolean {
    const value = unwrapExpression(expression);
    if (isStateLikeExpression(value)) return true;
    if (ts.isIdentifier(value)) return aliases.denseBoardNames.has(value.text);
    if (
        (ts.isPropertyAccessExpression(value) || ts.isPropertyAccessChain(value))
        && value.name.text === 'board'
        && /(?:context|ctx)$/i.test(value.expression.getText().replace(/\s+/g, ''))
    ) {
        return false;
    }
    if (expressionContainsBoardProperty(value, sourceFile)) return true;
    return false;
}

function resolveCanonicalApiCall(
    node: ts.CallExpression,
    aliases: BoardKernelAliasIndex
): { apiName: string; receiverText: string } | null {
    const expression = unwrapExpression(node.expression);
    if (ts.isIdentifier(expression)) {
        const apiName = aliases.apiNames.get(expression.text);
        return apiName ? { apiName, receiverText: expression.text } : null;
    }
    const apiName = readPropertyName(expression);
    const receiver = readCallReceiver(expression);
    if (!apiName || !receiver || !isCanonicalFacadeExpression(receiver, aliases)) return null;
    return { apiName, receiverText: receiver.getText() };
}

function isNullLiteralExpression(expression: ts.Expression | undefined): boolean {
    if (!expression) return false;
    return unwrapExpression(expression).kind === ts.SyntaxKind.NullKeyword;
}

function expressionContainsNullLiteral(expression: ts.Expression): boolean {
    let found = false;
    const visit = (node: ts.Node): void => {
        if (node.kind === ts.SyntaxKind.NullKeyword) {
            found = true;
            return;
        }
        if (!found) ts.forEachChild(node, visit);
    };
    visit(expression);
    return found;
}

function expressionContainsEmbeddedCardState(expression: ts.Expression): boolean {
    let found = false;
    const visit = (node: ts.Node): void => {
        if (
            (ts.isPropertyAccessExpression(node) || ts.isPropertyAccessChain(node))
            && node.name.text === 'cardState'
            && isStateLikeExpression(node.expression)
        ) {
            found = true;
            return;
        }
        if (!found) ts.forEachChild(node, visit);
    };
    visit(expression);
    return found;
}

function readObjectPropertyValue(expression: ts.Expression, propertyName: string): ts.Expression | null {
    const value = unwrapExpression(expression);
    if (!ts.isObjectLiteralExpression(value)) return null;
    for (const property of value.properties) {
        if (ts.isShorthandPropertyAssignment(property) && property.name.text === propertyName) {
            return property.name;
        }
        if (!ts.isPropertyAssignment(property)) continue;
        const name = property.name.getText().replace(/['"]/g, '');
        if (name === propertyName) return property.initializer;
    }
    return null;
}

function classifyUnsafeCardStateArgument(expression: ts.Expression | undefined): string | null {
    if (!expression) return 'missing cardState';
    if (isNullLiteralExpression(expression)) return 'explicit null cardState';
    if (
        expressionContainsNullLiteral(expression)
        && expressionContainsEmbeddedCardState(expression)
    ) {
        return 'embedded gameState.cardState fallback';
    }
    return null;
}

function isBoardContextArrayGate(node: ts.CallExpression): boolean {
    const propertyName = readPropertyName(node.expression);
    const receiver = readCallReceiver(node.expression);
    if (
        propertyName !== 'isArray'
        || !receiver
        || !ts.isIdentifier(unwrapExpression(receiver))
        || (unwrapExpression(receiver) as ts.Identifier).text !== 'Array'
        || node.arguments.length !== 1
    ) {
        return false;
    }
    const argument = unwrapExpression(node.arguments[0]);
    if (!ts.isPropertyAccessExpression(argument) && !ts.isPropertyAccessChain(argument)) return false;
    if (argument.name.text !== 'board') return false;
    const contextText = argument.expression.getText().replace(/\s+/g, '');
    if (!/(?:context|ctx)$/i.test(contextText)) return false;

    let current: ts.Node | undefined = node;
    while (current && !ts.isFunctionLike(current)) {
        if (ts.isConditionalExpression(current)) {
            const boardText = argument.getText().replace(/\s+/g, '');
            const whenTrueText = current.whenTrue.getText().replace(/\s+/g, '');
            const whenFalseText = current.whenFalse.getText().replace(/\s+/g, '');
            const isFallback = (value: ts.Expression): boolean => {
                const unwrapped = unwrapExpression(value);
                return unwrapped.kind === ts.SyntaxKind.NullKeyword
                    || (ts.isArrayLiteralExpression(unwrapped) && unwrapped.elements.length === 0);
            };
            return (
                whenTrueText === boardText
                && isFallback(current.whenFalse)
            ) || (
                whenFalseText === boardText
                && isFallback(current.whenTrue)
            );
        }
        if (ts.isStatement(current)) break;
        current = current.parent;
    }
    return false;
}

function callableDeclarationName(node: ts.Node): string | null {
    if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isMethodDeclaration(node)) {
        const name = node.name;
        if (name && ts.isIdentifier(name)) return name.text;
    }
    if (
        (ts.isFunctionExpression(node) || ts.isArrowFunction(node))
        && ts.isVariableDeclaration(node.parent)
        && ts.isIdentifier(node.parent.name)
    ) {
        return node.parent.name.text;
    }
    return null;
}

function enclosingDeclarationName(node: ts.Node): string {
    let current: ts.Node | undefined = node;
    while (current) {
        const name = callableDeclarationName(current);
        if (name) return name;
        current = current.parent;
    }
    return '';
}

function pushViolation(
    violations: BoardKernelBoundaryViolation[],
    sourceFile: ts.SourceFile,
    node: ts.Node,
    rule: BoardKernelBoundaryRule,
    detail: string
): void {
    violations.push({
        file: normalizePath(sourceFile.fileName),
        line: toLine(sourceFile, node),
        rule,
        scope: enclosingDeclarationName(node) || '<module>',
        detail
    });
}

export function scanBoardKernelSource(
    filePathValue: string,
    sourceText: string
): BoardKernelBoundaryViolation[] {
    const filePath = normalizePath(filePathValue);
    const scriptKind = filePath.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS;
    const sourceFile = ts.createSourceFile(
        filePath,
        sourceText,
        ts.ScriptTarget.Latest,
        true,
        scriptKind
    );
    const violations: BoardKernelBoundaryViolation[] = [];
    const aliases = collectBoardKernelAliases(sourceFile);

    const visit = (node: ts.Node): void => {
        if (
            ts.isIdentifier(node)
            && HIDDEN_METADATA_NAMES.has(node.text)
        ) {
            pushViolation(violations, sourceFile, node, 'hidden-shape-metadata', node.text);
        }
        if (
            ts.isStringLiteralLike(node)
            && (
                node.text.includes('shape-metadata')
                || HIDDEN_METADATA_NAMES.has(node.text)
            )
        ) {
            pushViolation(violations, sourceFile, node, 'hidden-shape-metadata', node.text);
        }
        if (
            isCardTopologyConsumer(filePath)
            && (
                (ts.isStringLiteralLike(node) && node.text.includes('expansion-fallback'))
                || (ts.isIdentifier(node) && node.text === 'CardExpansionFallback')
            )
        ) {
            pushViolation(
                violations,
                sourceFile,
                node,
                'consumer-expansion-fallback-import',
                node.getText(sourceFile)
            );
        }

        if (ts.isCallExpression(node)) {
            const propertyName = readPropertyName(node.expression);
            const receiver = readCallReceiver(node.expression);
            const receiverText = receiver ? receiver.getText(sourceFile) : '';
            const canonicalCall = resolveCanonicalApiCall(node, aliases);

            if (
                (filePath.startsWith('game/ai/')
                    || filePath.startsWith('game/cpu')
                    || filePath.startsWith('src/engine/'))
                && (propertyName === 'getLegalMovesBasic' || propertyName === 'getFlipsBasic')
                && /\bothelloCore\b/i.test(receiverText)
            ) {
                pushViolation(
                    violations,
                    sourceFile,
                    node,
                    'dense-othello-priority',
                    `${receiverText}.${propertyName}`
                );
            }

            if (
                isAuthorityFile(filePath)
                && propertyName
                && new Set(['filter', 'flat', 'flatMap', 'forEach', 'reduce']).has(propertyName)
                && receiver
                && expressionContainsBoardProperty(receiver, sourceFile)
            ) {
                pushViolation(
                    violations,
                    sourceFile,
                    node,
                    'authority-dense-board-aggregation',
                    `${receiver.getText(sourceFile)}.${propertyName}`
                );
            }

            if (
                isTopologySensitiveConsumer(filePath)
                && canonicalCall
                && SHAPE_API_NAMES.has(canonicalCall.apiName)
                && node.arguments.length > 0
                && isRawStateExpression(node.arguments[0], sourceFile, aliases)
            ) {
                pushViolation(
                    violations,
                    sourceFile,
                    node,
                    'raw-state-shape-api',
                    `${canonicalCall.apiName} requires an explicit BoardContext`
                );
            }

            if (
                isTopologySensitiveConsumer(filePath)
                && canonicalCall
                && node.arguments.length > 0
                && isRawStateExpression(node.arguments[0], sourceFile, aliases)
            ) {
                const argumentIndex = STATE_KERNEL_CARD_STATE_ARGUMENTS.get(canonicalCall.apiName);
                if (argumentIndex !== undefined) {
                    const reason = classifyUnsafeCardStateArgument(node.arguments[argumentIndex]);
                    if (reason) {
                        pushViolation(
                            violations,
                            sourceFile,
                            node,
                            'state-kernel-null-card-state',
                            `${canonicalCall.apiName}: ${reason}`
                        );
                    }
                } else if (STATE_KERNEL_CARD_STATE_OPTIONS.has(canonicalCall.apiName)) {
                    const optionsArgument = node.arguments[1];
                    const cardStateArgument = optionsArgument
                        ? readObjectPropertyValue(optionsArgument, 'cardState')
                        : null;
                    const reason = optionsArgument && !ts.isObjectLiteralExpression(unwrapExpression(optionsArgument))
                        ? null
                        : classifyUnsafeCardStateArgument(cardStateArgument || undefined);
                    if (reason) {
                        pushViolation(
                            violations,
                            sourceFile,
                            node,
                            'state-kernel-null-card-state',
                            `${canonicalCall.apiName}: ${reason}`
                        );
                    }
                }
            }

            if (
                isTopologySensitiveConsumer(filePath)
                && isBoardContextArrayGate(node)
            ) {
                pushViolation(
                    violations,
                    sourceFile,
                    node,
                    'board-context-array-gate',
                    node.getText(sourceFile)
                );
            }
        }

        if (
            isAuthorityFile(filePath)
            && ts.isForOfStatement(node)
            && expressionContainsBoardProperty(node.expression, sourceFile)
        ) {
            pushViolation(
                violations,
                sourceFile,
                node,
                'authority-dense-board-aggregation',
                `for-of ${node.expression.getText(sourceFile)}`
            );
        }

        if (
            (ts.isPropertyAccessExpression(node) || ts.isPropertyAccessChain(node))
            && node.name.text === 'cells'
            && expressionContainsBoardExpansion(node.expression, sourceFile)
        ) {
            if (isUiBoardProjection(filePath)) {
                pushViolation(
                    violations,
                    sourceFile,
                    node,
                    'ui-expansion-reconstruction',
                    node.getText(sourceFile)
                );
            } else if (isExpansionDescriptorConsumer(filePath)) {
                pushViolation(
                    violations,
                    sourceFile,
                    node,
                    'consumer-expansion-interpretation',
                    node.getText(sourceFile)
                );
            }
        }

        if (
            isTopologySensitiveConsumer(filePath)
            && isDirectStateBoardCellAccess(node, aliases)
        ) {
            pushViolation(
                violations,
                sourceFile,
                node,
                'consumer-dense-board-cell-access',
                node.getText(sourceFile)
            );
        }

        if (
            (
                isCardTopologyConsumer(filePath)
                || filePath === 'game/game-core-logic.ts'
                || filePath === 'game/logic/board_ops.ts'
                || filePath === 'game/logic/core.ts'
            )
            && ts.isVariableDeclaration(node)
            && ts.isIdentifier(node.name)
            && node.initializer
            && containsDirectRawStateBoardValue(node.initializer)
        ) {
            pushViolation(
                violations,
                sourceFile,
                node,
                'consumer-state-board-alias',
                node.initializer.getText(sourceFile)
            );
        }

        if (
            isUiBoardProjection(filePath)
            && ts.isVariableDeclaration(node)
            && ts.isIdentifier(node.name)
            && node.name.text === 'boardExpansion'
            && node.initializer
            && ts.isObjectLiteralExpression(node.initializer)
            && node.initializer.properties.some((property) => {
                if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) return false;
                return property.name && property.name.getText(sourceFile).replace(/['"]/g, '') === 'cells';
            })
        ) {
            pushViolation(
                violations,
                sourceFile,
                node,
                'ui-expansion-reconstruction',
                'boardExpansion.cells reverse projection'
            );
        }

        if (
            isTopologySensitiveConsumer(filePath)
            && ts.isBinaryExpression(node)
            && isComparisonOperator(node.operatorToken.kind)
        ) {
            const leftCoordinate = isCoordinateExpression(node.left);
            const rightCoordinate = isCoordinateExpression(node.right);
            const leftNumber = numericLiteralValue(node.left);
            const rightNumber = numericLiteralValue(node.right);
            const fixedNumber = leftCoordinate ? rightNumber : (rightCoordinate ? leftNumber : null);
            const derivedOuterBound = leftCoordinate
                ? containsDerivedOuterBound(node.right, sourceFile)
                : (rightCoordinate ? containsDerivedOuterBound(node.left, sourceFile) : false);
            if (
                fixedNumber === -1
                || fixedNumber === 7
                || fixedNumber === 8
                || derivedOuterBound
            ) {
                pushViolation(
                    violations,
                    sourceFile,
                    node,
                    'fixed-board-geometry',
                    node.getText(sourceFile)
                );
            }
        }

        ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return violations;
}

function walkSourceFiles(absoluteRoot: string): string[] {
    if (!fs.existsSync(absoluteRoot)) return [];
    const out: string[] = [];
    for (const entry of fs.readdirSync(absoluteRoot, { withFileTypes: true })) {
        if (SKIP_SEGMENTS.has(entry.name)) continue;
        const absolutePath = path.join(absoluteRoot, entry.name);
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) {
            out.push(...walkSourceFiles(absolutePath));
            continue;
        }
        if (!entry.isFile() || (!entry.name.endsWith('.ts') && !entry.name.endsWith('.js'))) continue;
        if (entry.name.endsWith('.d.ts') || entry.name.includes('.generated.')) continue;
        if (entry.name.endsWith('.js') && fs.existsSync(absolutePath.replace(/\.js$/, '.ts'))) continue;
        out.push(absolutePath);
    }
    return out;
}

export function collectBoardKernelSourceFiles(root = repositoryRoot): string[] {
    const files = SOURCE_ROOTS.flatMap((sourceRoot) => walkSourceFiles(path.join(root, sourceRoot)));
    for (const relativeFile of ROOT_SOURCE_FILES) {
        const absolutePath = path.join(root, relativeFile);
        if (fs.existsSync(absolutePath)) files.push(absolutePath);
    }
    return Array.from(new Set(files)).sort();
}

export function applyBoardKernelBoundaryAllowlist(
    violations: readonly BoardKernelBoundaryViolation[]
): {
    remaining: BoardKernelBoundaryViolation[];
    usage: Array<BoundaryAllowlistEntry & { actualMatches: number }>;
} {
    const usage = ALLOWLIST.map((entry) => ({
        ...entry,
        actualMatches: violations.filter(
            (violation) => (
                violation.file === entry.file
                && violation.rule === entry.rule
                && violation.scope === entry.scope
                && violation.detail === entry.detail
            )
        ).length
    }));
    const overflowKeys = new Set(
        usage
            .filter((entry) => entry.actualMatches > entry.maxMatches)
            .map((entry) => (
                `${entry.file}\u0000${entry.rule}\u0000${entry.scope}\u0000${entry.detail}`
            ))
    );
    const remaining = violations.filter((violation) => {
        const entry = ALLOWLIST.find(
            (candidate) => (
                candidate.file === violation.file
                && candidate.rule === violation.rule
                && candidate.scope === violation.scope
                && candidate.detail === violation.detail
            )
        );
        if (!entry) return true;
        return overflowKeys.has(
            `${entry.file}\u0000${entry.rule}\u0000${entry.scope}\u0000${entry.detail}`
        );
    });
    return { remaining, usage };
}

export function scanBoardKernelRepository(root = repositoryRoot): {
    violations: BoardKernelBoundaryViolation[];
    usage: Array<BoundaryAllowlistEntry & { actualMatches: number }>;
} {
    const rawViolations: BoardKernelBoundaryViolation[] = [];
    for (const absolutePath of collectBoardKernelSourceFiles(root)) {
        const relativePath = normalizePath(path.relative(root, absolutePath));
        const sourceText = fs.readFileSync(absolutePath, 'utf8');
        rawViolations.push(...scanBoardKernelSource(relativePath, sourceText));
    }
    const filtered = applyBoardKernelBoundaryAllowlist(rawViolations);
    return { violations: filtered.remaining, usage: filtered.usage };
}

function main(): void {
    const result = scanBoardKernelRepository();
    for (const entry of result.usage) {
        console.log(
            `[board-kernel-boundary] allowlist ${entry.file} ${entry.rule} `
            + `${entry.scope} ${JSON.stringify(entry.detail)}: `
            + `${entry.actualMatches}/${entry.maxMatches} (${entry.purpose})`
        );
    }
    if (result.violations.length > 0) {
        console.error('\n[board-kernel-boundary] Forbidden board topology interpretation found:');
        for (const violation of result.violations) {
            console.error(
                ` - ${violation.file}:${violation.line} `
                + `[${violation.rule}] ${violation.scope}: ${violation.detail}`
            );
        }
        process.exitCode = 2;
        return;
    }
    console.log('[board-kernel-boundary] Board topology consumers use the canonical kernel.');
}

if (require.main === module) main();
