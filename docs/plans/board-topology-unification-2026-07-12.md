# Board topology unification plan

## 1. Role and objective

This is the active implementation plan for making initial board shapes independent from later expansion and shrink effects. Player-visible behavior is owned by `01-rulebook.md`; stable runtime boundaries are owned by `docs/architecture-contracts.md` §6.1.1.

Objective: any future initial shape supplies only its base coordinate mask. `盤面拡張`, `盤面拡張神`, `盤面縮小`, `盤面縮小神`, CPU, network authority, and rendering operate on one current-topology projection without shape-name branches.

Non-goals: changing card costs, disabling topology-changing cards, restoring holes through expansion, or replacing server authority with browser state.

## 2. Stable design

Canonical serialized state stays backward compatible:

- `gameState.board`: base-envelope owner array
- `gameState.boardConfig`: initial envelope and shape initializer
- `gameState.boardExpansion.cells`: explicit added cells at arbitrary integer coordinates
- `cardState` hole markers: explicit removed/recoverable coordinates

Pure `BoardTopology` is rebuilt from those sources and exposes:

- `baseKeys`, `expansionKeys`, `existingKeys`, `playableKeys`, `holeKeys`
- `contentBounds`: all existing/hole coordinates
- `renderBounds`: base envelope union content bounds
- `candidateBounds`: current content bounds expanded by one coordinate
- deterministic coordinate lists and boundary-edge tests

The initial shape name is not consulted after base keys are generated.

## 3. Implementation phases

### Phase A — shared topology

- Add `shared/board/topology.ts` and export it through `SharedBoardUtils`.
- Generalize expansion descriptors from fixed `outerBounds` to safe arbitrary integer coordinates outside the base mask.
- Rebuild exterior flood fill and expansion sockets from topology candidate bounds.
- Keep holes excluded from additions and closed interior holes excluded from exterior candidates.

### Phase B — gameplay consumers

- Route expansion selectors and apply validation through the shared sockets.
- Ensure repeated expansion can use the newly added outer boundary.
- Keep shrink edge/corner helpers on the same playable coordinate set.
- Verify CPU and selfplay preserve `directionKey` and use canonical candidates.

### Phase C — unified board rendering

- Remove expansion cells from the absolute `#board-expansion-layer` rendering path.
- Build one CSS grid over `renderBounds`; map world coordinate `(row,col)` to grid coordinate using `minRow/minCol` offsets.
- Render base cells, base-shape void placeholders, expansion cells, and holes in that one grid.
- Derive CSS contour edges, hint arrows, selection hit areas, and reveal animation from the same world coordinates.
- Preserve Single Visual Writer and existing ordered playback.

### Phase D — parity and generation

- Verify local/headless/Worker candidate and apply results.
- Verify pending snapshot, reconnect, spectator, presentation, and final state convergence.
- Build browser assets and generate Worker mirror only from root sources.

## 4. Completion criteria

- Circle plus repeated `盤面拡張` and `盤面拡張神` never creates duplicate or visually detached cells.
- Every added cell is connected to the selected anchor/socket and is immediately usable by placement, movement, flip, and surrounding-cell effects.
- Expansion after prior expansion uses the current boundary rather than the initial envelope.
- Shrink after expansion and expansion after shrink use the same topology; holes remain holes and cannot be overwritten.
- Board cells, arrows, selection overlays, click targets, and CSS frame share one grid coordinate transform.
- Adding a new initial mask requires no card, CPU, network, or renderer shape-name branch.
- Focused topology/card/UI tests, typecheck, window boundary, network parity, browser build, Worker mirror, and real browser repeated-operation scenarios pass.

## 5. Verification bundle

```powershell
npx jest --runInBand --runTestsByPath test/shared.board-topology.test.ts test/game.board-expansion-will.test.ts test/game.board-shrink-will.test.ts test/shared.board-hint-projection.test.ts test/ui.board-expansion-cell-render.test.ts
npm run typecheck
npm run check:window
npm run test:network:parity
npm run build:browser
npm run worker:prepare
npm run check:worker-mirror
```

Use a real browser to exercise circle → expansion → repeated expansion → expansion god → shrink, checking contour, hints, click coordinates, and absence of console errors.
