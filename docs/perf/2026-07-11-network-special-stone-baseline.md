# Network Special-Stone Late-Game Performance Baseline

Generated: 2026-07-11T09:58:42.181Z
Commit: `62b170a1289a4a2fffca49d84dc58fd2e0fee948`
Node: `v24.12.0`
Warmup / measured / integration: 25 / 120 / 40

## Node measurements

| fixture | protection median / p95 | legal median / p95 | turn-start median / p95 | presentation median / p95 | publish median / p95 |
|---|---:|---:|---:|---:|---:|
| baseline-light | 0.0061 / 0.0189 ms | 0.0981 / 0.2611 ms | 0.5495 / 0.963 ms | 0.0021 / 0.0027 ms | 1.0424 / 1.5179 ms |
| late-dense | 0.0063 / 0.0196 ms | 0.0403 / 0.0961 ms | 1.1773 / 1.6983 ms | 0.0012 / 0.0021 ms | 0.953 / 1.3117 ms |
| late-special-20 | 0.0265 / 0.0607 ms | 0.034 / 0.0711 ms | 4.5626 / 5.5938 ms | 0.003 / 0.0035 ms | 2.1599 / 2.8687 ms |

## Browser measurements

| fixture | board projection median / p95 | client apply + render preparation median / p95 |
|---|---:|---:|
| baseline-light | 0.2 / 0.3 ms | 0.3 / 0.6 ms |
| late-dense | 0.1 / 0.3 ms | 0.3 / 0.4 ms |
| late-special-20 | 0.2 / 0.4 ms | 0.4 / 0.6 ms |

## Deterministic operation counts

### baseline-light

```json
{
  "specialMarkerCollections": 1,
  "manifestMarkerCollections": 1,
  "bombMarkerCollections": 1,
  "blockingMarkerCollections": 1,
  "frozenCellChecks": 1,
  "nestedFullMarkerScans": 1,
  "canonicalMarkerScans": 5,
  "markerEntriesVisited": 10,
  "flipContextCompilesPerGetLegalMoves": 60,
  "cardProtectionContextsPerRender": 1,
  "legalMoveGenerationsPerRender": 1,
  "presentationEventIndexesPerMapping": 0,
  "viewerProjectionBlack": 1,
  "viewerProjectionWhite": 1,
  "viewerProjectionSpectator": 1,
  "acceptedPublishRoomPersists": 2,
  "renderSnapshotFullClones": 1
}
```

### late-dense

```json
{
  "specialMarkerCollections": 1,
  "manifestMarkerCollections": 1,
  "bombMarkerCollections": 1,
  "blockingMarkerCollections": 1,
  "frozenCellChecks": 2,
  "nestedFullMarkerScans": 2,
  "canonicalMarkerScans": 6,
  "markerEntriesVisited": 24,
  "flipContextCompilesPerGetLegalMoves": 12,
  "cardProtectionContextsPerRender": 1,
  "legalMoveGenerationsPerRender": 1,
  "presentationEventIndexesPerMapping": 0,
  "viewerProjectionBlack": 1,
  "viewerProjectionWhite": 1,
  "viewerProjectionSpectator": 1,
  "acceptedPublishRoomPersists": 2,
  "renderSnapshotFullClones": 1
}
```

### late-special-20

```json
{
  "specialMarkerCollections": 1,
  "manifestMarkerCollections": 1,
  "bombMarkerCollections": 1,
  "blockingMarkerCollections": 1,
  "frozenCellChecks": 12,
  "nestedFullMarkerScans": 12,
  "canonicalMarkerScans": 16,
  "markerEntriesVisited": 320,
  "flipContextCompilesPerGetLegalMoves": 12,
  "cardProtectionContextsPerRender": 1,
  "legalMoveGenerationsPerRender": 1,
  "presentationEventIndexesPerMapping": 0,
  "viewerProjectionBlack": 1,
  "viewerProjectionWhite": 1,
  "viewerProjectionSpectator": 1,
  "acceptedPublishRoomPersists": 2,
  "renderSnapshotFullClones": 1
}
```

## Notes

- Timing values are characterization data, not standalone CI pass/fail gates.
- `acceptedPublishRoomPersists: 2` records the current accepted Worker path before Phase 5.
- Browser and Node measurements are intentionally separated.
