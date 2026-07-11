# Network Special-Stone Late-Game Performance Baseline

Generated: 2026-07-11T11:47:17.698Z
Commit: `f3f2be991436b03c07e45a291c54defc65a9c9ee`
Node: `v24.12.0`
Warmup / measured / integration: 25 / 120 / 40

## Node measurements

| fixture | protection median / p95 | legal median / p95 | turn-start median / p95 | presentation median / p95 | publish median / p95 |
|---|---:|---:|---:|---:|---:|
| baseline-light | 0.0032 / 0.0037 ms | 0.083 / 0.2879 ms | 0.5157 / 0.8825 ms | 0.0022 / 0.0036 ms | 0.7635 / 1.284 ms |
| late-dense | 0.0039 / 0.0069 ms | 0.0318 / 0.0523 ms | 1.0053 / 1.5507 ms | 0.0018 / 0.0033 ms | 0.8781 / 1.2801 ms |
| late-special-20 | 0.0121 / 0.0277 ms | 0.0242 / 0.0584 ms | 4.1495 / 6.179 ms | 0.0034 / 0.0042 ms | 1.5919 / 2.154 ms |

## Browser measurements

| fixture | board projection median / p95 | client apply + render preparation median / p95 |
|---|---:|---:|
| baseline-light | 0.1 / 0.3 ms | 0.3 / 0.6 ms |
| late-dense | 0.1 / 0.2 ms | 0.2 / 0.4 ms |
| late-special-20 | 0.1 / 0.2 ms | 0.3 / 0.5 ms |

## Deterministic operation counts

### baseline-light

```json
{
  "specialMarkerCollections": 0,
  "manifestMarkerCollections": 0,
  "bombMarkerCollections": 0,
  "blockingMarkerCollections": 0,
  "frozenCellChecks": 0,
  "nestedFullMarkerScans": 0,
  "canonicalMarkerScans": 1,
  "markerEntriesVisited": 2,
  "flipContextCompilesPerGetLegalMoves": 1,
  "cardProtectionContextsPerRender": 1,
  "legalMoveGenerationsPerRender": 1,
  "presentationEventIndexesPerMapping": 1,
  "viewerProjectionBlack": 1,
  "viewerProjectionWhite": 1,
  "viewerProjectionSpectator": 1,
  "acceptedPublishRoomPersists": 1,
  "renderSnapshotFullClones": 0
}
```

### late-dense

```json
{
  "specialMarkerCollections": 0,
  "manifestMarkerCollections": 0,
  "bombMarkerCollections": 0,
  "blockingMarkerCollections": 0,
  "frozenCellChecks": 0,
  "nestedFullMarkerScans": 0,
  "canonicalMarkerScans": 1,
  "markerEntriesVisited": 4,
  "flipContextCompilesPerGetLegalMoves": 1,
  "cardProtectionContextsPerRender": 1,
  "legalMoveGenerationsPerRender": 1,
  "presentationEventIndexesPerMapping": 1,
  "viewerProjectionBlack": 1,
  "viewerProjectionWhite": 1,
  "viewerProjectionSpectator": 1,
  "acceptedPublishRoomPersists": 1,
  "renderSnapshotFullClones": 0
}
```

### late-special-20

```json
{
  "specialMarkerCollections": 0,
  "manifestMarkerCollections": 0,
  "bombMarkerCollections": 0,
  "blockingMarkerCollections": 0,
  "frozenCellChecks": 0,
  "nestedFullMarkerScans": 0,
  "canonicalMarkerScans": 1,
  "markerEntriesVisited": 20,
  "flipContextCompilesPerGetLegalMoves": 1,
  "cardProtectionContextsPerRender": 1,
  "legalMoveGenerationsPerRender": 1,
  "presentationEventIndexesPerMapping": 1,
  "viewerProjectionBlack": 1,
  "viewerProjectionWhite": 1,
  "viewerProjectionSpectator": 1,
  "acceptedPublishRoomPersists": 1,
  "renderSnapshotFullClones": 0
}
```

## Notes

- Timing values are characterization data, not standalone CI pass/fail gates.
- `acceptedPublishRoomPersists` records the accepted Worker durability boundary.
- Browser and Node measurements are intentionally separated.
