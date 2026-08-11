-- 1. Create nst_worker role safely (NO PASSWORD, NOSUPERUSER, NOBYPASSRLS, NOCREATEROLE, NOCREATEDB)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'nst_worker') THEN
        CREATE ROLE nst_worker WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
    END IF;
END
$$;

-- 2. Basic database access
GRANT CONNECT ON DATABASE nst_events TO nst_worker;
GRANT USAGE ON SCHEMA public TO nst_worker;

-- 3. Exact table and column privileges for nst_worker

-- notification_jobs: SELECT on specific columns, UPDATE on mutated columns
GRANT SELECT (id, status, payload, priority, attempt_count, max_attempts, available_at, locked_at, worker_id, idempotency_key, last_error, created_at, updated_at, ticket_ids) ON notification_jobs TO nst_worker;
GRANT UPDATE (status, locked_at, updated_at, ticket_ids, attempt_count, available_at, last_error) ON notification_jobs TO nst_worker;

-- users: SELECT only the id column
GRANT SELECT (id) ON users TO nst_worker;

-- push_tokens: SELECT on expo_token, DELETE on row
GRANT SELECT (expo_token) ON push_tokens TO nst_worker;
GRANT DELETE ON push_tokens TO nst_worker;

-- notifications: UPDATE on delivered_at
GRANT UPDATE (delivered_at) ON notifications TO nst_worker;

-- 4. RLS Policies specifically TO nst_worker

-- notification_jobs
CREATE POLICY "Worker system access to notification_jobs" ON notification_jobs FOR ALL TO nst_worker USING (true) WITH CHECK (true);

-- users
CREATE POLICY "Worker system access to users" ON users FOR SELECT TO nst_worker USING (true);

-- push_tokens
CREATE POLICY "Worker system access to push_tokens select" ON push_tokens FOR SELECT TO nst_worker USING (true);
CREATE POLICY "Worker system access to push_tokens delete" ON push_tokens FOR DELETE TO nst_worker USING (true);

-- notifications
CREATE POLICY "Worker system access to notifications" ON notifications FOR UPDATE TO nst_worker USING (true) WITH CHECK (true);
