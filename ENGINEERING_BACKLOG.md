# Engineering Backlog

## P0 - Phase 1 (Implement now)

### BE-001: API latency instrumentation and request timing
- Priority: P0
- Estimate: 0.5 day
- Scope:
  - Add FastAPI middleware for per-request latency timing.
  - Add structured request logs with method, path, status, duration.
  - Add `X-Response-Time-ms` header.
- Acceptance criteria:
  - All HTTP responses include `X-Response-Time-ms`.
  - Logs include duration for all non-health endpoints.

### BE-002: Reduce LLM prompt/response log overhead
- Priority: P0
- Estimate: 0.5 day
- Scope:
  - Remove always-on full prompt/response logging.
  - Add env-gated debug logs (`DEBUG_LLM=1`) for targeted troubleshooting.
  - Add token usage logging helper for Gemini responses.
- Acceptance criteria:
  - No full prompt bodies logged in default mode.
  - LLM usage metadata is logged when available.

### BE-003: Consolidate check flow to one API call
- Priority: P0
- Estimate: 0.5 day
- Scope:
  - Add endpoint to do presence detection + consistency check in one backend request.
  - Keep backward compatibility for existing `/who` and `/check`.
- Acceptance criteria:
  - Frontend can call one endpoint and receive `present` and `flags`.
  - Existing endpoints still work.

### BE-004: Add SQLite indexes for hot query paths
- Priority: P0
- Estimate: 0.5 day
- Scope:
  - Add indexes for entities type/name, attributes lookups, relationships lookup/join keys, embedding chunk lookup.
- Acceptance criteria:
  - Schema creates indexes idempotently.
  - Query plans use indexes on repeated endpoints.

### FE-001: Combine check network calls + cancellation
- Priority: P0
- Estimate: 0.5 day
- Scope:
  - Replace `who -> check` chain with single `checkPassage` API call.
  - Add request cancellation so stale checks are aborted.
- Acceptance criteria:
  - New check cancels prior in-flight check.
  - No stale check result overwrites latest UI state.

### FE-002: Client timeout + lightweight retry policy
- Priority: P0
- Estimate: 0.5 day
- Scope:
  - Add axios timeout.
  - Add one retry for transient network/5xx failures (not for 4xx).
- Acceptance criteria:
  - Requests fail fast on timeout.
  - Transient errors are retried once automatically.

## P1 - Next sprint

### BE-005: Replace ingest polling with SSE progress stream
- Priority: P1
- Estimate: 1.5 days
- Scope:
  - Add `/ingest/{job_id}/events` SSE endpoint.
  - Frontend subscribes to live updates instead of polling loop.
- Acceptance criteria:
  - Ingest progress updates stream in near real-time.
  - Polling loop removed.

### BE-006: Batch context queries for consistency check
- Priority: P1
- Estimate: 1.5 days
- Scope:
  - Replace per-character query loops with batched SQL queries.
  - Bound vector search concurrency.
- Acceptance criteria:
  - Lower p95 `/check` latency for multi-character scenes.

### BE-007: Token budget enforcement
- Priority: P1
- Estimate: 1 day
- Scope:
  - Truncate/check context to max token budget before LLM call.
  - Add deterministic ranking for top relationships/attributes/moments.
- Acceptance criteria:
  - Prompt payload size is bounded.
  - Average token spend per check decreases measurably.

### FE-003: Graph incremental updates and large-graph controls
- Priority: P1
- Estimate: 2 days
- Scope:
  - Keep one vis-network instance, update DataSets incrementally.
  - Add search, neighborhood focus, and edge type filters.
- Acceptance criteria:
  - No network destroy/recreate on simple filter toggles.
  - Graph interaction remains smooth with larger datasets.

## P2 - UX and polish

### FE-004: Motion and UX polish
- Priority: P2
- Estimate: 2 days
- Scope:
  - Add entry and transition animations for flags/panels.
  - Improve empty and error states with actionable controls.
  - Add reduced-motion accessibility behavior.
- Acceptance criteria:
  - UI feels more responsive and intentional without harming readability.

### BE-008: Durable async job state
- Priority: P2
- Estimate: 2-3 days
- Scope:
  - Move in-memory ingest job map to persistent queue/state backend.
  - Add retry policy and recovery after restarts.
- Acceptance criteria:
  - Ingest jobs survive API process restart.
