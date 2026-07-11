# Network Special-Stone Late-Game Performance Baseline

Generated: 2026-07-11T11:48:13.422Z
Commit: `f3f2be991436b03c07e45a291c54defc65a9c9ee`
Node: `v24.12.0`
Warmup / measured / integration: 25 / 500 / 160

## Node measurements

| fixture | protection median / p95 | legal median / p95 | turn-start median / p95 | presentation median / p95 | publish median / p95 |
|---|---:|---:|---:|---:|---:|
| baseline-light | 0.0019 / 0.0096 ms | 0.0198 / 0.1025 ms | 0.348 / 0.623 ms | 0.0017 / 0.0043 ms | 0.6589 / 0.9324 ms |
| late-dense | 0.0021 / 0.005 ms | 0.0141 / 0.0416 ms | 0.9021 / 1.3411 ms | 0.0021 / 0.0029 ms | 0.9047 / 1.3441 ms |
| late-special-20 | 0.0045 / 0.0109 ms | 0.0124 / 0.021 ms | 3.4681 / 4.9647 ms | 0.0039 / 0.0066 ms | 1.5846 / 2.3862 ms |

## Browser measurements

| fixture | board projection median / p95 | client apply + render preparation median / p95 |
|---|---:|---:|
| baseline-light | 0.1 / 0.2 ms | 0.3 / 0.5 ms |
| late-dense | 0.1 / 0.2 ms | 0.2 / 0.4 ms |
| late-special-20 | 0.1 / 0.3 ms | 0.3 / 0.5 ms |

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
