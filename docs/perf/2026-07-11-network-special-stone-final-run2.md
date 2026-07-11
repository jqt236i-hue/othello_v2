# Network Special-Stone Late-Game Performance Baseline

Generated: 2026-07-11T11:48:45.864Z
Commit: `f3f2be991436b03c07e45a291c54defc65a9c9ee`
Node: `v24.12.0`
Warmup / measured / integration: 25 / 500 / 160

## Node measurements

| fixture | protection median / p95 | legal median / p95 | turn-start median / p95 | presentation median / p95 | publish median / p95 |
|---|---:|---:|---:|---:|---:|
| baseline-light | 0.0037 / 0.0156 ms | 0.0377 / 0.2077 ms | 0.5252 / 1.0301 ms | 0.0032 / 0.0076 ms | 0.8908 / 1.5265 ms |
| late-dense | 0.0028 / 0.0049 ms | 0.02 / 0.0489 ms | 0.998 / 1.5345 ms | 0.0017 / 0.0031 ms | 1.0323 / 1.5607 ms |
| late-special-20 | 0.0061 / 0.0097 ms | 0.02 / 0.0383 ms | 3.3976 / 4.4595 ms | 0.0032 / 0.0064 ms | 1.6516 / 2.2833 ms |

## Browser measurements

| fixture | board projection median / p95 | client apply + render preparation median / p95 |
|---|---:|---:|
| baseline-light | 0.1 / 0.2 ms | 0.2 / 0.5 ms |
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
