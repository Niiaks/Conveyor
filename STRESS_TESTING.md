# Stress Testing Guide

This document provides instructions for running load tests on the Conveyor pipeline and interpreting the results for performance validation.

## Overview

The Conveyor stress tests use **k6**, a modern load testing tool designed for cloud-native architectures. The tests simulate realistic user behavior: requesting presigned URLs, uploading directly to MinIO, and notifying the API of completion.

## Prerequisites

- **k6** installed (check with `k6 --version`)
- Docker Compose services running (`docker compose up -d`)
- API server running (`pnpm start`)
- Workers running (`npx ts-node workers/validation.ts` and `npx ts-node workers/processing.ts`)

## Running the Load Test

### Basic Test Run

```bash
pnpm test:stress
```

### Custom Configuration

```bash
# Test with specific VU (Virtual User) count
k6 run --vus 50 --duration 2m tests/load/upload-stress.test.js

# Test with custom API URL
API_URL=http://production-server:3000 k6 run tests/load/upload-stress.test.js
```

## Test Stages

The default test follows this progression:

| Stage     | Duration | Target VUs | Purpose                  |
| --------- | -------- | ---------- | ------------------------ |
| Warm-up   | 30s      | 10         | Gradual ramp-up          |
| Load      | 1m       | 50         | Moderate concurrent load |
| Sustained | 2m       | 100        | Sustained high load      |
| Peak      | 1m       | 200        | Maximum stress test      |
| Cool-down | 30s      | 0          | Graceful shutdown        |

## Metrics Explained

### Custom Metrics

- **upload_initiations**: Number of successful presigned URL requests
- **direct_uploads**: Number of successful direct-to-MinIO uploads
- **notifications**: Number of successful completion notifications
- **end_to_end_latency**: Total time from API request to notification completion

### Standard k6 Metrics

- **http_req_duration**: HTTP request duration (includes network + server processing)
- **http_req_failed**: Percentage of failed HTTP requests
- **http_reqs**: Total number of HTTP requests per second
- **vus**: Current number of active virtual users

## Performance Thresholds

The test enforces these performance requirements:

```javascript
{
  http_req_duration: ['p(95)<500'],  // 95% of requests complete under 500ms
  http_req_failed: ['rate<0.05'],    // Less than 5% failure rate
}
```

## Interpreting Results

### Success Indicators

- **P95 latency < 500ms**: The system responds quickly even under load
- **Failure rate < 5%**: High reliability and fault tolerance
- **Upload initiations ≈ Direct uploads ≈ Notifications**: Pipeline integrity maintained

### Warning Signs

- **P95 latency > 1000ms**: Potential bottleneck in API or database
- **Failure rate > 10%**: System may be overloaded
- **Mismatched counts**: Queue backlog or worker processing delays

## Monitoring During Tests

### RabbitMQ Management UI

Visit `http://localhost:15672` (user: `user`, pass: `password`) to monitor:

- Queue depth in `validation` and `media_processing` queues
- Message rate (messages/sec)
- Consumer utilization

### MinIO Console

Visit `http://localhost:9001` to verify:

- Successful file uploads
- Storage utilization
- Network throughput

### MongoDB

Check database connection pool utilization and query performance during peak load.

## Example Results

Here's a sample output from a successful test run:

\`\`\`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Conveyor Stress Test Results
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Upload Initiations: 2,847
Direct Uploads: 2,847
Notifications: 2,847

Latency Metrics:
• Average: 287.45ms
• P95: 456.23ms
• Max: 1,203.67ms

HTTP Performance:
• Average: 95.12ms
• P95: 178.34ms
• Failure Rate: 0.14%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
\`\`\`

## Troubleshooting

### "ECONNREFUSED" Errors

- Ensure the API server is running on the correct port
- Verify `API_URL` environment variable

### "403 Forbidden" on MinIO Upload

- Check MinIO credentials in `.env`
- Verify presigned URL expiration settings

### Workers Not Processing

- Confirm RabbitMQ is running
- Check worker logs for errors
- Verify queue names match in API and workers

---

_These tests provide quantifiable, data-driven performance metrics to demonstrate system scalability and reliability._
