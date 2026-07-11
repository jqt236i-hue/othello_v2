# Network Special-Stone Late-Game Performance Baseline

Generated: 2026-07-11T11:45:19.946Z
Commit: `f3f2be991436b03c07e45a291c54defc65a9c9ee`
Node: `v24.12.0`
Warmup / measured / integration: 25 / 120 / 40

## Node measurements

| fixture | protection median / p95 | legal median / p95 | turn-start median / p95 | presentation median / p95 | publish median / p95 |
|---|---:|---:|---:|---:|---:|
| baseline-light | 0.002 / 0.0033 ms | 0.0699 / 0.2414 ms | 0.4986 / 0.8389 ms | 0.0018 / 0.0028 ms | 0.7842 / 1.1524 ms |
| late-dense | 0.0022 / 0.0031 ms | 0.031 / 0.0485 ms | 1.0162 / 1.4701 ms | 0.0019 / 0.004 ms | 1.023 / 1.5435 ms |
| late-special-20 | 0.0067 / 0.0143 ms | 0.0155 / 0.0467 ms | 3.8666 / 5.2382 ms | 0.0031 / 0.0038 ms | 1.4309 / 2.6172 ms |

## Browser measurements

| fixture | board projection median / p95 | client apply + render preparation median / p95 |
|---|---:|---:|
| baseline-light | 0.1 / 0.3 ms | 0.2 / 0.5 ms |
| late-dense | 0.1 / 0.2 ms | 0.2 / 0.5 ms |
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
