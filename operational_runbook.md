# MioTranslate Operational Runbook

This runbook outlines operational procedures for SRE and DevOps teams maintaining the MioTranslate platform. 

## 1. Background Jobs & Concurrency

### 1.1 Job Dispatcher Recovery
MioTranslate relies on Spring Data JPA and `@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)` to emit `AsyncJobEvent` signals.

**Symptom**: Background jobs (Translations, Publishing, Notifications) are not being picked up by workers.
**Investigation**:
1. Check if the `JobDispatcher` thread pool is exhausted (metrics `miotranslate.jobs.active`).
2. Verify Redis/Message Queue connectivity if externalized, though the current mock uses an in-memory `ApplicationEventPublisher`.

### 1.2 Investigating Dead Letters & Audit Trail
All critical system actions are logged to the `system_ops.audit_records` table.

**Querying recent failures**:
```sql
SELECT entity_type, entity_id, action_type, status, user_id, timestamp
FROM system_ops.audit_records
WHERE status = 'FAILED'
ORDER BY timestamp DESC
LIMIT 50;
```

## 2. Publishing & Releases

### 2.1 Release Verification
When a release is triggered (DEV, QA, or PRODUCTION), a Release entity is created.
To verify if a release was successfully pushed to the external Language Services API:

```sql
SELECT release_id, environment, status, published_at, error_log
FROM translation_mgmt.releases
WHERE environment = 'PRODUCTION'
ORDER BY published_at DESC;
```

### 2.2 Manual Rollback Procedure
If a production release corrupts the downstream application, users can trigger a rollback via the UI. If the UI is inaccessible, administrators can trigger it via API:

```bash
curl -X POST http://localhost:8080/v1/publishing/releases/rollback \
  -H "APIKEY: E3#4fSq43U@57v" \
  -H "Content-Type: application/json" \
  -d '{"targetEnvironment": "PRODUCTION", "targetVersion": 2}'
```
*Note: Ensure `targetVersion` is a previously successful release version.*

## 3. Database Administration

### 3.1 Migration Scripts
Flyway manages database migrations. To run migrations on a new environment:
```bash
./mvnw flyway:migrate -Dflyway.url=jdbc:postgresql://<host>:5432/miotranslate -Dflyway.user=<user> -Dflyway.password=<pass>
```

### 3.2 Backup and Restore
MioTranslate uses standard PostgreSQL.
**Backup**:
```bash
pg_dump -U postgres -h localhost -d miotranslate -F c -f miotranslate_backup.dump
```
**Restore**:
```bash
pg_restore -U postgres -h localhost -d miotranslate -1 miotranslate_backup.dump
```

## 4. Troubleshooting Common Scenarios

### 4.1 ETag / Optimistic Concurrency Conflicts
**Symptom**: Users report "Conflict" or "409" errors when saving English Copy or Translations.
**Root Cause**: Another user modified the exact same tag between the time the first user loaded the page and attempted to save.
**Resolution**: Instruct the user to refresh the page. The UI will automatically catch `409` errors and prompt the user to refresh.

### 4.2 Migration Execution Failures
**Symptom**: A bulk migration is stuck in `EXECUTING` state.
**Investigation**: Check the application logs for `MigrationExecutionWorker` errors. 
```bash
grep "MigrationExecutionWorker" app.log
```
Check the migration status in the database:
```sql
SELECT status, total_rows, processed_rows, error_log 
FROM migration_mgmt.migrations 
WHERE migration_id = '<id>';
```

## 5. Deployment Checklist (Production)

- [ ] PostgreSQL Database provisioned (v15+).
- [ ] Flyway migrations executed successfully.
- [ ] Environment variables configured:
  - `SPRING_DATASOURCE_URL`
  - `SPRING_DATASOURCE_USERNAME`
  - `SPRING_DATASOURCE_PASSWORD`
  - `MIO_API_KEY` (Auth token for API clients)
  - `LANGUAGE_SERVICES_URL`
- [ ] API Server cluster running behind Load Balancer.
- [ ] Frontend SPA built and deployed to CDN/Nginx.
- [ ] Proxy configured to route `/v1/*` to the API Servers.
