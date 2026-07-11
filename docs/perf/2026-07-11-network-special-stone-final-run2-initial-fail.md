# Network Special-Stone Late-Game Performance Baseline

Generated: 2026-07-11T11:45:49.858Z
Commit: `f3f2be991436b03c07e45a291c54defc65a9c9ee`
Node: `v24.12.0`
Warmup / measured / integration: 25 / 120 / 40

## Node measurements

| fixture | protection median / p95 | legal median / p95 | turn-start median / p95 | presentation median / p95 | publish median / p95 |
|---|---:|---:|---:|---:|---:|
| baseline-light | 0.0019 / 0.0036 ms | 0.0727 / 0.1749 ms | 0.4567 / 0.8526 ms | 0.0032 / 0.0052 ms | 0.7869 / 1.2876 ms |
| late-dense | 0.0037 / 0.0082 ms | 0.0336 / 0.075 ms | 1.2713 / 1.8167 ms | 0.0019 / 0.0039 ms | 1.0567 / 1.4928 ms |
| late-special-20 | 0.0065 / 0.0148 ms | 0.017 / 0.0325 ms | 4.103 / 5.5934 ms | 0.0051 / 0.0072 ms | 1.7471 / 2.6409 ms |

## Browser measurements

| fixture | board projection median / p95 | client apply + render preparation median / p95 |
|---|---:|---:|
| baseline-light | 0.1 / 0.3 ms | 0.3 / 0.5 ms |
| late-dense | 0.1 / 0.3 ms | 0.3 / 0.6 ms |
| late-special-20 | 0.1 / 0.3 ms | 0.3 / 0.6 ms |

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
