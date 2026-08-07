# Notification Worker — Deployment Model

## Architecture Decision: Separate Kubernetes Deployment

The notification worker runs as a **separate Kubernetes Deployment** (`nst-worker`) on the NST Cluster. It is not co-located with the API server (`nst-api`). This separation:

- Prevents native PostgreSQL queue polling from competing with HTTP request processing for CPU/memory
- Allows the worker to be scaled, restarted, and deployed independently from the API
- Allows the API to restart during deployments without dropping in-flight queue consumers

---

## Deployment Topology

```text
NST Cluster (K3s, Worker Nodes: 8GB RAM limit)
│
├── Deployment: nst-api
│   ├── Replicas: 2–3
│   ├── Handles: All HTTP requests from Expo + Next.js clients
│   └── Does NOT poll the native queue
│
├── Deployment: nst-worker
│   ├── Replicas: 1
│   ├── Handles: native PostgreSQL queue polling + Expo Push delivery
│   └── Does NOT handle HTTP traffic
│
└── StatefulSet / External: PostgreSQL
    └── Shared by both nst-api and nst-worker
    └── Requires dedicated node or scale down to 2-node CNPG to fit in 8GB RAM constraints.
```

**Worker replica count is intentionally 1.** The native queue uses `FOR UPDATE SKIP LOCKED` which safely prevents race conditions even with multiple consumers. However, for V1 at NST scale, a single worker replica is sufficient (handles 50 notifications/sec).

---

## Worker Internals & Canonical Configuration

The worker is a separate Node.js process (`worker/index.ts`) in the same monorepo. It strictly adheres to the following configuration:
- `WORKER_POLL_INTERVAL_MS=5000`
- `WORKER_BATCH_SIZE=100`
- `WORKER_MAX_RETRIES=4`
- `WORKER_SHUTDOWN_TIMEOUT_MS=25000`
- `EXPO_RECEIPT_DELAY_MINUTES=15`
- `EXPO_MAX_BATCH_SIZE=100`

It uses the official `expo-server-sdk` npm package for all Push API interactions.

It runs an event loop that:

```
1. BEGIN transaction.
2. Poll native queue table for up to WORKER_BATCH_SIZE messages using `SELECT ... FOR UPDATE SKIP LOCKED`.
4. The worker dispatches using the ordered pair `(job_type, status)` from the `payload`.
5. For `(SEND_PUSH, PENDING/RETRY_PENDING)`: chunk using `expo.chunkPushNotifications(max EXPO_MAX_BATCH_SIZE)` and call `expo.sendPushNotificationsAsync`.
6. On success tickets: persist ticket IDs on the job in the dedicated `ticket_ids` JSONB field, update job status to 'WAITING_FOR_RECEIPTS', set `available_at = now() + EXPO_RECEIPT_DELAY_MINUTES`. (Payload is never mutated).
7. For `(SEND_PUSH, WAITING_FOR_RECEIPTS)` (where available_at <= now): chunk using `expo.chunkPushNotificationReceiptIds(max EXPO_MAX_BATCH_SIZE)` and call `expo.getPushNotificationReceiptsAsync`.
8. On receipt success: update job status to 'COMPLETED', clear `ticket_ids` to NULL, write delivery status to notifications table.
9. On failure (tickets or receipts): clear `ticket_ids` to NULL (if evaluating receipts), update job status to 'RETRY_PENDING' (increment `attempt_count`) or 'FAILED'/'DEAD_LETTER' depending on the Failure Matrix.
10. Wait WORKER_POLL_INTERVAL_MS, repeat.
```

## Worker Health & Readiness

The worker exposes HTTP endpoints on port 8080 (or 3001) to support Kubernetes probes. These endpoints differentiate between the process being alive and the worker actively being capable of processing jobs.

### Liveness Probe: `GET /health`
* **Purpose**: Determine if the Node.js process is alive.
* **Success Condition**: Returns HTTP 200 OK while the process is running.
* **Response Schema**: `{ "status": "ok", "timestamp": "<ISO-8601>" }`
* **Kubernetes Integration**: Used by the pod's `livenessProbe`.

### Readiness Probe: `GET /ready`
* **Purpose**: Determine if the worker is fully initialized and capable of processing notification jobs.
* **Success Conditions**: Returns HTTP 200 OK only if ALL of the following are true:
  1. Worker initialization is completed.
  2. The Prisma database connection is healthy (`SELECT 1` succeeds).
  3. The worker is NOT shutting down (`isShuttingDown == false`).
* **Failure Conditions**: Returns HTTP 503 Service Unavailable if ANY of the following are true:
  1. Initialization is incomplete.
  2. The database is unavailable.
  3. Graceful shutdown is active.
* **Response Schema**:
  ```json
  {
    "status": "ok" | "error",
    "database": "connected" | "disconnected",
    "shutting_down": boolean,
    "initialized": boolean,
    "timestamp": "<ISO-8601>"
  }
  ```
* **Kubernetes Integration**: Used by the pod's `readinessProbe` to ensure traffic (or job routing logic, if any) is only directed to healthy instances.

## Metrics & Observability

The worker exposes production-grade Prometheus metrics via the HTTP server on port 8080 (or 3001) to support operational monitoring.

### Observability Endpoint: `GET /metrics`
* **Purpose**: Expose worker metrics in the standard Prometheus text exposition format for scraping.
* **Relationship to other endpoints**: 
  - `/health` determines liveness.
  - `/ready` determines readiness.
  - `/metrics` provides observability data.
* **Response Format**: Prometheus text exposition format.
* **Content-Type**: `text/plain; version=0.0.4; charset=utf-8` (or the default provided by `prom-client`).
* **Authentication**: None required. Assumed to be scraped internally by the cluster's Prometheus server.
* **Performance**: The endpoint is completely lock-free and non-blocking. It relies solely on in-memory counters and gauges.

### Canonical Metrics Specification

#### Counter: `nst_jobs_processed_total`
* **Description**: Total number of notification jobs that reached a terminal or successful state.
* **Labels**: `status`, `notification_type`
* **Increment Rules**: 
  - Increment exactly once when a job reaches `COMPLETED`, `FAILED`, `ARCHIVED`, or `DEAD_LETTER`.
  - **Never** increment when a job transitions to `RETRY_PENDING` (as it is not fully processed).

#### Gauge: `nst_queue_depth`
* **Description**: The current number of jobs sitting in the queue, grouped by their lifecycle status.
* **Labels**: `status`
* **Collection Rule**: Derived directly from the `notification_jobs` table (the canonical source). It is explicitly forbidden to introduce Redis or caching layers for queue depth.
* **Collection Mechanism**: A periodic background refresh task (default interval: every 15 seconds) that executes a `GROUP BY status` SQL query against the `notification_jobs` table. This updates the gauges asynchronously to ensure the `/metrics` endpoint remains lock-free and fast.
* **Failure Behavior**: If the SQL query fails, the gauges retain their last known value, and an error is logged.

#### Histogram: `nst_processing_duration_seconds`
* **Description**: Processing latency from the moment a job is claimed to the moment its execution block completes.
* **Labels**: `job_type`
* **Units**: Seconds
* **Buckets**: `[0.1, 0.5, 1, 2, 5, 15, 30]`
  - *Justification*: Notification pushes typically take ~0.5s for Expo requests. 15s and 30s buckets are included to catch major network degradations or timeouts during receipt polling.

#### Counter: `nst_expo_api_errors_total`
* **Description**: Total number of Expo API errors encountered during push sending or receipt polling.
* **Labels**: `error_code` (e.g., `DeviceNotRegistered`, `MessageTooBig`, `InvalidCredentials`, `network_timeout`)
* **Increment Rules**: Increment exactly once per failed ticket/receipt. Includes both transient network failures and permanent device failures.

### Performance & Operational Requirements
- **Expected Overhead**: Negligible. The background queue depth collection is a lightweight aggregation query on an indexed column (`status`).
- **Scrape Interval**: Designed to support scraping intervals as aggressive as every 10 seconds without impacting worker throughput.

## Graceful Shutdown


The worker strictly implements a graceful shutdown sequence to prevent lock abandonment:
1. Traps `SIGTERM` and `SIGINT` signals.
2. Sets a global `isShuttingDown = true` flag. The polling loop stops accepting new batches.
3. Uses `Promise.allSettled` to wait for the currently executing batch (in-flight Expo requests and Prisma transactions) to finish.
4. Enforces a hard timeout of `WORKER_SHUTDOWN_TIMEOUT_MS` (25000ms), which is safely under the standard Kubernetes `terminationGracePeriodSeconds` (30s).
5. Disconnects from the database (`await prisma.$disconnect()`).
6. Exits the process cleanly (`process.exit(0)`).

---

## Operational Constraints & Resource Limits

**CRITICAL:** The NST Cluster worker nodes are limited to **8GB RAM** each.
- A strict 3-node CNPG + Distributed MinIO deployment **will cause Out-Of-Memory (OOM) cascading failures** on these nodes.
- **V1 Deployment Model:** Downgrade to a 2-node CNPG cluster and use external S3 for backups, OR request dedicated infrastructure for the database.
- Multi-replica SSE fan-out (via PG NOTIFY) and strict 3-node HA requirements are considered "Future Scaling Options" if the cluster is upgraded.

---

## Retry & Failure Handling

The worker uses an **application-controlled exponential retry strategy** for transient failures, manually extending the `available_at` timestamp on each failure.

| Scenario | Behavior |
|---|---|
| Expo Push API returns 5xx (Attempt 1) | Worker updates job `status = 'RETRY_PENDING'` and `available_at = now() + 30s`. |
| Expo Push API returns 5xx (Attempt 2) | Worker updates job `status = 'RETRY_PENDING'` and `available_at = now() + 2m`. |
| Expo Push API returns 5xx (Attempt 3) | Worker updates job `status = 'RETRY_PENDING'` and `available_at = now() + 10m`. |
| Expo Push API returns 5xx (Attempt 4) | Worker updates job `status = 'DEAD_LETTER'` for Platform Admin review. |
| Expo Receipt returns `DeviceNotRegistered` | Permanent failure. Invalid push tokens are immediately deleted. Worker updates job `status = 'FAILED'`. Do not retry. |
| HTTP 429 / MessageTooBig / InvalidCredentials | Permanent failure. Worker updates job `status = 'FAILED'`. Do not retry. |
| Entity Deleted (User/Event missing) | Worker detects missing relation and updates job `status = 'ARCHIVED'`. Do not retry. |
| Worker pod crashes | 'PROCESSING' jobs remain locked indefinitely unless a heartbeat timeout mechanism is implemented. (V1 relies on single pod stability). |
| Network partition | Messages accumulate in the queue table; delivered in batch once connectivity restores. |

### Dead Letter Queue Operations
Platform Admins interact with the `DEAD_LETTER` state via the `apps/api` service (not the worker):
- **Inspection**: `GET /admin/queue/dead-letters`
- **Replay**: `POST /admin/queue/dead-letters/:id/replay`. The API service transactionally resets the job to `PENDING`, making it visible to the worker again, and creates a `QUEUE_JOB_REPLAY` audit log.

---

## Queue Consumer Deduplication

The native PostgreSQL queue safely manages deduplication across multiple workers via row-level locks:
- When a worker claims a batch using `FOR UPDATE SKIP LOCKED`, those specific rows are locked.
- Other concurrent workers instantly skip the locked rows and claim the next available rows.
- The worker explicitly updates the row state (`status`) within the transaction.

---

## Delivery Status Write-Back

After each delivery attempt, the worker updates the `notifications` table via Prisma:

```typescript
await prisma.notification.update({
  where: { id: notificationId },
  data: {
    delivered_at: new Date(),         // on success
    delivery_failed_at: new Date(),   // on permanent failure
    delivery_error: errorMessage,
  }
});
```

---

## K3s Manifest Summary

```yaml
# nst-worker Deployment (abbreviated)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nst-worker
spec:
  replicas: 1
  template:
    spec:
      containers:
        - name: worker
          image: ghcr.io/nst/nst-worker:latest
          command: ["node", "dist/worker/index.js"]
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: nst-secrets
                  key: DATABASE_URL
            - name: EXPO_ACCESS_TOKEN
              valueFrom:
                secretKeyRef:
                  name: nst-secrets
                  key: EXPO_ACCESS_TOKEN
      restartPolicy: Always
```
