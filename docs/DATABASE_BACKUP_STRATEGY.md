# PostgreSQL Automated Backup & Restore Strategy

This document outlines the architecture, configuration, and recovery targets for the automated database backup and restore strategy.

## Architecture

We use **WAL-G** (successor to WAL-E) for continuous archiving of PostgreSQL to AWS S3 (or any S3-compatible object storage). This enables Point-in-Time Recovery (PITR) to any second within the last 30 days.

```
                    ┌─────────────────────────┐
                    │  PostgreSQL Primary DB  │
                    └───────────┬─────────────┘
                                │
          ┌─────────────────────┴─────────────────────┐
          ▼ (Continuous Archiving)                    ▼ (Scheduled Backup)
   Hourly WAL Segments                         Daily Full Basebackups
   (wal-g wal-push)                            (wal-g backup-push)
          │                                           │
          └─────────────────────┬─────────────────────┘
                                ▼
                     ┌──────────────────────┐
                     │ S3 Backup Bucket     │
                     │ (Retention: 30 days) │
                     └──────────────────────┘
```

## Recovery Targets

*   **RPO (Recovery Point Objective):** < 1 hour (ensured by pushing WAL segments hourly).
*   **RTO (Recovery Time Objective):** < 4 hours (ensured by automated restore drills and optimized network bandwidth).

---

## Configuration

### 1. WAL-G environment variables
WAL-G is configured via the following environment variables (stored securely in AWS SSM / Sealed Secrets):

```bash
WALG_S3_PREFIX=s3://stellar-db-backups/postgres
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1
PGHOST=localhost
PGUSER=postgres
PGPASSWORD=stellar_secure_pass
PGDATABASE=stellar_creator_portfolio
```

### 2. postgresql.conf Parameters
To enable continuous archiving in PostgreSQL:

```ini
wal_level = replica
archive_mode = on
archive_command = 'wal-g wal-push %p'
archive_timeout = 3600 # Force a WAL segment switch every hour
```

---

## Automation & Scheduling

We run the backups inside our Kubernetes cluster using CronJobs:

1.  **Daily Full Backup (Basebackup):** Runs at 02:00 UTC daily.
2.  **Backup Retention Policy:** Configured via a `wal-g delete` command run after every backup, pruning backups older than 30 days.
3.  **Monthly Restore Drill:** Runs at 04:00 UTC on the 1st of every month. It spins up a test PostgreSQL instance, restores the latest backup, runs a smoke test suite, logs the outcome to `AuditLog`, and terminates the test instance.

---

## Monitoring & Alerts

### 1. Slack Alert on Failure
Backup scripts monitor WAL-G return codes. Any non-zero exit status triggers an immediate webhook to Slack within 1 hour:

```bash
#!/bin/bash
# scripts/db-backup-alert.sh
WEBHOOK_URL=""

if [ $? -ne 0 ]; then
  payload="{\"text\": \"🚨 *CRITICAL*: PostgreSQL database backup failed on production cluster! Reason: $1. RPO is at risk.\"}"
  curl -X POST -H 'Content-type: application/json' --data "$payload" "$WEBHOOK_URL"
fi
```

### 2. Admin Dashboard Visibility
The admin dashboard fetches the latest backup status and age directly from the database's `AuditLog` table. A warning state is triggered if the last backup is older than 24 hours.

### 3. Restore Drill results
Monthly restore drills log details (success/failure, duration, data integrity checks) to `AuditLog`:
*   **Resource:** `db`
*   **Action:** `restore_drill`
*   **Payload:** `{ "status": "SUCCESS", "smokeTests": "passed", "restoredSize": "20.4 GB", "durationSec": 245 }`
