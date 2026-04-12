# Backend Authority Architecture Audit: Root Cause Analysis

## EXECUTIVE SUMMARY

The card-othello online network has **5 critical structural vulnerabilities**:

1. **stateVersion conflates sequence lock with optimistic lock** 
   - When opponent publishes, stateVersion increments; client's baseVersion becomes stale
   - Worker rejects with VERSION_MISMATCH; client must re-fetch
   - **Online-only**: Offline mode has no opponent delay

2. **Hidden-hand rehydration is bidirectional & fragile**
   - Server projects → client receives projected → client sends back projected → server rehydrates using previousHands
   - If previousHands is stale/partial, rehydration silently corrupts
   - **Online-only**: Reconnect mid-game has partial snapshots

3. **Turn-start reconciliation is implicit server-side**
   - Worker applies econcileTurnStartIfNeeded() during publish without telling client
   - Client doesn't know what was reconciled; can apply duplicate logic
   - **Online-only**: Client's playback may differ from server's reconciliation order

4. **No explicit authority markers on snapshots**
   - Client can't distinguish: server snapshot vs. client's own playback
   - On reconnect, client may use stale local snapshot instead of fetching authoritative version
   - **Online-only**: Offline mode never reconnects

5. **SSE event ID is not resumable**
   - Events have id: room_stateVersion_seq
   - Browser caches last ID for EventSource resume
   - Server ignores Last-Event-ID; always sends full snapshot on new connection
   - If stateVersion advanced during disconnect, client may have stale version reference
   - **Online-only**: Network disconnects are rare offline

## KEY FILES ANALYZED

Backend Authority:
- workers/match-worker.mjs (1-2100 lines, core Durable Object)
- scripts/local-match-server.js (match server reference implementation)

Tests:
- test/workers.match-stream-sse.test.js (SSE event ID validation)
- test/workers.match-heartbeat-stateversion.test.js (stateVersion in heartbeat)
- test/workers.match-publish-idempotency.test.js (idempotency check)
- test/workers.match-condemn-visibility.test.js (hidden-hand projection)
- test/workers.match-publish-sanitize.test.js (rehydration & reconciliation)
- test/workers.match-room-deck.test.js (deck initialization on join)
- test/workers.match-turn-timer.test.js (turn timer, timeout pass)
- test/workers.match-rematch-publish.test.js (out-of-turn reset_game)
- test/workers.match-leaderboard.test.js (shared leaderboard)

Client:
- ui/network-client.js (network match client, publishes & tracks state)
- scripts/match-network-smoke.js (protocol smoke test)

Design:
- docs/network-match-design-plan.md (overall architecture)
- docs/archive/public-network-card-fix-runbook-2026-03-14.md (historical known issues & fixes)

## BUG CLASS EVIDENCE

### BUG CLASS A: Version Lock Race (stateVersion Conflation)

File: workers/match-worker.mjs:1797-1808
\\\
if (baseVersion === null || baseVersion !== room.stateVersion) {
    return jsonResponse(409, {
        ok: false,
        rejectedReason: 'VERSION_MISMATCH',
        ...
    });
}
\\\

**Trigger Sequence:**
1. Client A fetches state → stateVersion: 5
2. Client A publishes with baseVersion: 5
3. Client B's publish arrives → Worker increments to stateVersion: 6
4. Client A's publish arrives with baseVersion: 5, server has stateVersion: 6
5. **REJECTED: VERSION_MISMATCH**

**Why Online-Only:**
- Offline: No opponent publish; stateVersion doesn't change during client's turn
- Online: Network latency makes this race visible

### BUG CLASS B: Hidden-Hand Rehydration Fragility

File: workers/match-worker.mjs:543-586 (rehydrateSnapshotForPublish)
\\\
const previousCardState = (previousSnapshot && previousSnapshot.cardState && typeof previousSnapshot.cardState === 'object')
    ? previousSnapshot.cardState : {};
const previousHands = (previousCardState.hands && typeof previousCardState.hands === 'object')
    ? previousCardState.hands : {};
\\\

**Vulnerability:**
- If previousHands is stale, resolveCardIdFromHiddenToken() returns null
- Null values propagate silently into pending.offers or discard pile
- No integrity check: "did rehydration produce correct cards?"

**Why Online-Only:**
- Offline: Snapshot is always current (no reconnect)
- Online: Client reconnects with partial snapshot from storage; previousHands may be incomplete

### BUG CLASS C: Turn-Start Implicit

File: workers/match-worker.mjs:1872
\\\
nextSnapshot = rehydrateSnapshotForPublish(room.snapshot, snapshot);
await reconcileTurnStartIfNeeded(room, nextSnapshot);  // <-- Server applies silently
\\\

**Issue:**
- Client doesn't know turn-start was applied
- Client doesn't apply turn-start logic (waits for server snapshot)
- If client publishes again before seeing server response, no double-apply check

**Why Online-Only:**
- Offline: Client is authoritative; server doesn't exist
- Online: Client must trust server's snapshot, but doesn't know what it contains

### BUG CLASS D: No Authority Marker

**Test:** test/workers.match-publish-sanitize.test.js:293-307
Shows: Server reconciles turn-start; client doesn't know to skip local reconciliation

**Why Online-Only:**
- Offline: Client's playback IS authoritative; no server to diverge from
- Online: Server snapshot overwrites client playback; client can't tell if it should re-apply logic

### BUG CLASS E: SSE Event ID Not Resumable

File: workers/match-worker.mjs:1956-1968 (handleStream - initial connect)
\\\
const initialPayload = buildSnapshotPayload(room, { playbackEvents: [] }, viewerSeatKey);
\\\

**Issue:**
- Server always sends full snapshot on new stream, ignoring Last-Event-ID
- If client was at heartbeat stateVersion: N, but stream reconnects at stateVersion: N+2
- Client's internal state reflects N, server has N+2
- Next publish with baseVersion: N is rejected

**Why Online-Only:**
- Offline: No network disconnect; stream never drops
- Online: Flaky network reconnects are inevitable

### BUG CLASS F: Seat Token Rejoin Race

File: workers/match-worker.mjs:1598-1603 (handleJoin)
\\\
if (!room.seatTokens || !room.seatTokens[seatKey]) {
    room.seatTokens = room.seatTokens || {};
    room.seatTokens[seatKey] = makeSeatToken();  // <-- Creates NEW token
}
const seatToken = room.seatTokens[seatKey];
const rejoined = providedToken && providedToken === seatToken;
\\\

**Race Scenario:**
1. Player A joins black, gets token T_black
2. Player A network drops
3. Player B joins, takes black (seat is empty from server's view), gets new token T_black'
4. Player A reconnects with old token T_black
5. Server accepts anyway (doesn't validate token matches on join)
6. **Ghost seat created or Player A locked out**

**Why Online-Only:**
- Offline: App controls join order; no concurrent joins
- Online: Network delays make race window visible

### BUG CLASS G: Room Deck Rebase Version Bump

File: workers/match-worker.mjs:1617-1625 (handleJoin)
\\\
if (!hadTwoSeats && hasTwoSeatsNow && room.stateVersion === 0) {
    nextSnapshot = await makeInitialSnapshot(room.seed, buildInitialDeckSnapshotOptions(room));
    room.stateVersion = 1;  // <-- Version bump
    room.snapshot = nextSnapshot;
}
\\\

**Issue:**
- When 2nd player joins, stateVersion jumps from 0 to 1
- Client A received v0, publishes with baseVersion: 0
- Server now has v1; client A's publish is rejected as VERSION_MISMATCH
- Client A must refetch

**Why Online-Only:**
- Offline: Join timing is controlled; client doesn't publish between joins
- Online: Join events are async; client may publish after 1st join but before seeing 2nd join broadcast

## ROOT ARCHITECTURE PROBLEMS

### Problem 1: stateVersion Serves Dual Purpose

- **Sequence number**: Orders events (3 before 4)
- **Optimistic lock**: Validates snapshot is current (if I saw v5, can I publish v5?)

**Why This Breaks:**
- Opponent's publish increments stateVersion
- Client's seen stateVersion becomes stale but truthful
- Worker rejects client's truthful baseVersion as "not current"
- **No way to distinguish**: "you're replaying an old action" vs. "state has advanced beyond you"

**Solution:** Separate operationId (per action) from stateVersion (global sequence). Use operationId for idempotency.

### Problem 2: Hidden-Hand Bridge is Fragile

**Server → Client:** Project hands to __hidden_hand__:owner:index
**Client → Server:** Send back projected hands
**Server → Storage:** Rehydrate using previousHands

**Why This Breaks:**
- Rehydration assumes previousHands is complete & current
- If client reconnects with partial snapshot, previousHands is stale
- Silent corruption: offers remain hidden or explicit cards leak

**Solution:** Server never rehydrates; keep hands plaintext internally, project only on send. Or: Client sends {handIndex, cardId} pairs explicitly; server validates before storing.

### Problem 3: Turn-Start is Implicit

- Only server applies turn-start logic (in reconcileTurnStartIfNeeded)
- Client never calls it; waits for server snapshot
- No marker: "turn-start was applied here"

**Why This Breaks:**
- Client doesn't know if server already applied turn-start
- If client publishes again, no guard against double-booking
- Client's playback may differ from server's turn-start order

**Solution:** Server includes metadata: turnStartAppliedAt: stateVersion. Client only applies if metadata says server didn't.

### Problem 4: No Explicit Authority Declaration

- Snapshot has no field indicating: "this is from server" vs. "this is your local playback"
- On reconnect, client may use stale local snapshot instead of fetching

**Why This Breaks:**
- Client can't safely reason about snapshot provenance
- Multiplayer state divergence goes undetected

**Solution:** Add _meta: { authority: 'server', version: N, reconciled: true/false }

### Problem 5: SSE Event ID Not Resumable

- Events include id: room_stateVersion_seq
- Browser sends Last-Event-ID on reconnect
- Server ignores it; always sends full snapshot

**Why This Breaks:**
- Every reconnect is a full restart
- If client's stateVersion reference is ahead of server's actual version, next publish fails

**Solution:** Implement event buffer; on stream connect, check Last-Event-ID and resume from buffer. Or: Client fetches state on reconnect (simple workaround).

## CONCRETE FIXES & OWNERSHIP

### Fix 1: Add Authority & Reconciliation Metadata (JOINT)

**Backend Change:**
Add to every snapshot:
\\\
_meta: {
  authority: 'server',
  version: room.stateVersion,
  projectedForSeat: viewerSeatKey,
  turnStartReconciled: boolean
}
\\\

**Client Change:**
- Read _meta.authority to verify snapshot is from server
- Check _meta.turnStartReconciled to skip client-side turn-start
- Use _meta.version instead of guessing stateVersion

**Impact:** Explicit contracts; prevents playback divergence

### Fix 2: Explicit Rejection Codes (BACKEND-ONLY)

**Change:**
\\\
VERSION_MISMATCH → VERSION_MISMATCH with rejectionDetail:
  - 'BASE_VERSION_NULL'
  - 'VERSION_AHEAD' (server is ahead)
  - 'VERSION_BEHIND' (you're behind; fetch state)
  - 'VERSION_GAP' (you skipped versions; fatal)
\\\

**Impact:** Client can make smart recovery decisions without additional fetches

### Fix 3: Turn-Start Reconciliation Flag (JOINT)

**Backend:**
- reconcileTurnStartIfNeeded() returns boolean
- Store flag in snapshot

**Client:**
- Check flag before applying local turn-start logic
- Prevents double-booking

**Impact:** Eliminates turn-start divergence

### Fix 4: OperationId as Primary Idempotency Key (JOINT)

**Backend:**
- Require operationId for all publishes (except reset_game)
- Return operationId in idempotent response
- Check operationId first, not baseVersion

**Client:**
- Generate unique operationId per action
- Track operationId → response stateVersion mapping
- Can see: "my operation was applied at v5, server is now v7"

**Impact:** Decouples idempotency from version-locking; solves VERSION_MISMATCH race

### Fix 5: Seat Join Token Validation (BACKEND-ONLY)

**Change:**
- If client provides seatToken, validate it matches before accepting join
- If seat is occupied and no matching token, reject SEAT_ALREADY_OCCUPIED
- No silent token creation

**Impact:** Prevents ghost seats from concurrent joins

### Fix 6: SSE Event Resume (BACKEND - OPTIONAL)

**Change:**
- Implement circular event buffer (last 100 events per room)
- On stream connect, check Last-Event-ID
- Resume from buffer instead of full snapshot

**Impact:** Reduces reconnect data; maintains event-id coherence

## ROLLOUT RECOMMENDATION

**Phase 1 (Backend-Only, No Client Risk):**
- Fix 2 (rejection codes)
- Fix 5 (seat token validation)
- Goal: Reduce VERSION_MISMATCH diagnostics, prevent seat races

**Phase 2 (Joint, Requires Client Coordination):**
- Fix 1 (metadata)
- Fix 3 (turn-start flag)
- Fix 4 (operationId primary key)
- Goal: Eliminate playback divergence, idempotency races

**Phase 3 (Optional Infrastructure):**
- Fix 6 (SSE resume)

