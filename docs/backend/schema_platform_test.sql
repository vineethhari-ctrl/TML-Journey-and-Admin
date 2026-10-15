-- Self-checking tests for docs/backend/schema_platform.sql (configuration, devices, sessions, default views, audit coverage).
-- TEST DATA ONLY. Run after parts 1 and 2:
--   psql -v ON_ERROR_STOP=1 -f docs/backend/schema.sql -f docs/backend/schema_masters_crm.sql -f docs/backend/schema_platform.sql -f docs/backend/schema_platform_test.sql
-- Any failed ASSERT stops the script with a non-zero exit code (CI runs this).
SET search_path = admin, public;

CREATE OR REPLACE FUNCTION pg_temp.expect_error(label text, stmt text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ok (rejected): %', label;
    RETURN;
  END;
  RAISE EXCEPTION 'expected an error but the statement succeeded: %', label;
END $$;

-- Ids created during the test are kept in session settings (psql variables are not visible inside DO blocks)
CREATE OR REPLACE FUNCTION pg_temp.v(k text) RETURNS text LANGUAGE sql AS $$ SELECT current_setting('test.' || k) $$;
CREATE OR REPLACE FUNCTION pg_temp.u(k text) RETURNS uuid LANGUAGE sql AS $$ SELECT current_setting('test.' || k)::uuid $$;

-- A SHA-256-like fingerprint for a test device
CREATE OR REPLACE FUNCTION pg_temp.fp(p text) RETURNS char LANGUAGE sql AS $$ SELECT encode(sha256(convert_to(p, 'UTF8')), 'hex') $$;

-- Test people: two dealers, a dealer service advisor at each, and a TML admin
INSERT INTO dealer (dealer_code, dealer_name, region, city, facility_type) VALUES
  ('DLR9001', 'Test Motors One', 'West', 'Pune', '3S'),
  ('DLR9002', 'Test Motors Two', 'North', 'Delhi', '3S');
INSERT INTO app_user (user_id, employee_id, full_name, email, user_type, dealer_code) VALUES
  ('test.sa1',    'T9001', 'Test Advisor One', 'sa1@example.test',   'CRM',   'DLR9001'),
  ('test.sa2',    'T9002', 'Test Advisor Two', 'sa2@example.test',   'CRM',   'DLR9002'),
  ('test.admin',  'T9000', 'Test TML Admin',   'admin@example.test', 'ADMIN', NULL);
INSERT INTO user_role (user_id, role_id) VALUES ('test.sa1', 'READ_ONLY'), ('test.sa2', 'READ_ONLY'), ('test.admin', 'TML_ADMIN');
SET app.user_id = 'test.admin';
SET app.user_name = 'Test TML Admin';
SET app.client_ip = '10.0.0.10';

-- -----------------------------------------------------------------------------
-- 1. Configuration: the 16 portal settings + 1 new, typed and range-checked, with history and audit
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM system_setting) = 17, 'all 17 settings are seeded';
  ASSERT (SELECT count(*) FROM system_setting WHERE portal_field IS NOT NULL) = 16, 'the 16 portal settings are mapped to the portal fields';
  ASSERT setting_int('session.timeout_minutes') = 60 AND setting_int('session.idle_timeout_minutes') = 15, 'portal defaults';
  ASSERT setting_bool('security.device_registration_required'), 'device registration is required by default';
  ASSERT (SELECT enforced_by FROM system_setting WHERE setting_key = 'security.password_expiry_days') = 'SSO', 'password expiry belongs to SSO';
END $$;

SELECT set_system_setting('session.max_concurrent', '2', 'test.admin', 'Tighter for the pilot');
DO $$ BEGIN
  ASSERT setting_int('session.max_concurrent') = 2, 'a valid change is saved';
  ASSERT (SELECT row_version FROM system_setting WHERE setting_key = 'session.max_concurrent') = 2, 'the version goes up';
  ASSERT (SELECT count(*) FROM system_setting_history WHERE setting_key = 'session.max_concurrent' AND old_value = '3' AND new_value = '2') = 1, 'history keeps old and new';
  ASSERT (SELECT count(*) FROM audit_log WHERE action = 'Configuration Changed' AND old_value = '3' AND new_value = '2'
            AND user_id = 'test.admin' AND ip_address = '10.0.0.10') = 1, 'the change is audited with who and from where';
END $$;
SELECT set_system_setting('session.max_concurrent', '2', 'test.admin');   -- same value: nothing written
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM system_setting_history WHERE setting_key = 'session.max_concurrent') = 1, 'saving the same value writes nothing';
END $$;

SELECT pg_temp.expect_error('unknown setting',              $q$SELECT set_system_setting('session.colour', '1', 'test.admin')$q$);
SELECT pg_temp.expect_error('number above the maximum',     $q$SELECT set_system_setting('session.timeout_minutes', '5000', 'test.admin')$q$);
SELECT pg_temp.expect_error('number below the minimum',     $q$SELECT set_system_setting('security.max_login_attempts', '0', 'test.admin')$q$);
SELECT pg_temp.expect_error('decimal for a whole number',   $q$SELECT set_system_setting('session.timeout_minutes', '30.5', 'test.admin')$q$);
SELECT pg_temp.expect_error('text for a number',            $q$SELECT set_system_setting('session.timeout_minutes', '"30"', 'test.admin')$q$);
SELECT pg_temp.expect_error('number for a switch',          $q$SELECT set_system_setting('notification.sms_enabled', '1', 'test.admin')$q$);
SELECT pg_temp.expect_error('idle longer than session',     $q$SELECT set_system_setting('session.idle_timeout_minutes', '90', 'test.admin')$q$);
SELECT pg_temp.expect_error('session shorter than idle',    $q$SELECT set_system_setting('session.timeout_minutes', '10', 'test.admin')$q$);
SELECT pg_temp.expect_error('stale version (someone else changed it)',
                                                            $q$SELECT set_system_setting('session.max_concurrent', '4', 'test.admin', NULL, 1)$q$);
SELECT pg_temp.expect_error('direct update out of range',   $q$UPDATE system_setting SET value = '0' WHERE setting_key = 'session.max_concurrent'$q$);
SELECT pg_temp.expect_error('setting history is append-only', $q$DELETE FROM system_setting_history$q$);

-- -----------------------------------------------------------------------------
-- 2. Devices: a new device waits for approval, the admins are told, every step is logged
-- -----------------------------------------------------------------------------
SELECT set_config('test.d1', (register_device('test.sa1', pg_temp.fp('sa1-laptop'), 'Laptop', 'Windows 11', 'Edge 128', '10.1.1.5', 'Pune'))::text, false);
DO $$ BEGIN
  ASSERT (SELECT status FROM user_device WHERE device_id = pg_temp.v('d1')) = 'PENDING', 'a new device waits for approval';
  ASSERT (SELECT count(*) FROM notification WHERE type = 'DEVICE' AND recipient_role = 'TML_ADMIN' AND target_path LIKE '%' || pg_temp.v('d1')) = 1, 'the TML admins are notified';
  ASSERT (SELECT count(*) FROM user_device_event WHERE device_id = pg_temp.v('d1') AND event = 'REGISTERED') = 1, 'the registration is logged';
  ASSERT (SELECT count(*) FROM audit_log WHERE action = 'Device Registered' AND entity LIKE pg_temp.v('d1') || '%') = 1, 'the registration is audited';
END $$;
DO $$ BEGIN
  ASSERT register_device('test.sa1', pg_temp.fp('sa1-laptop'), 'Laptop', 'Windows 11', 'Edge 129', '10.1.1.6', NULL) = pg_temp.v('d1'), 'a known device is recognised, not registered again';
  ASSERT (SELECT browser || ' ' || host(last_ip_address) || ' ' || last_location FROM user_device WHERE device_id = pg_temp.v('d1')) = 'Edge 129 10.1.1.6 Pune',
         'a known device refreshes browser and IP and keeps the last location';
  ASSERT (SELECT count(*) FROM user_device WHERE user_id = 'test.sa1') = 1, 'still one device';
END $$;

SELECT pg_temp.expect_error('sign in from a pending device', format($q$SELECT start_session('test.sa1', %L, '10.1.1.5', 'Pune', 'Edge')$q$, pg_temp.v('d1')));
SELECT pg_temp.expect_error('fingerprint that is not a hash',
  $q$INSERT INTO user_device (user_id, fingerprint_hash, device_type) VALUES ('test.sa1', 'my-laptop-serial-123', 'Laptop')$q$);
SELECT pg_temp.expect_error('unknown device type',
  $q$INSERT INTO user_device (user_id, fingerprint_hash, device_type) VALUES ('test.sa1', repeat('a', 64), 'Toaster')$q$);
SELECT pg_temp.expect_error('block without a reason',       format($q$SELECT set_device_status(%L, 'BLOCK', 'test.admin')$q$, pg_temp.v('d1')));
SELECT pg_temp.expect_error('deactivate a pending device',  format($q$SELECT set_device_status(%L, 'DEACTIVATE', 'test.admin')$q$, pg_temp.v('d1')));
SELECT pg_temp.expect_error('unknown device action',        format($q$SELECT set_device_status(%L, 'DELETE', 'test.admin')$q$, pg_temp.v('d1')));

SELECT set_device_status(pg_temp.v('d1'), 'APPROVE', 'test.admin');
SELECT pg_temp.expect_error('approve twice',                format($q$SELECT set_device_status(%L, 'APPROVE', 'test.admin')$q$, pg_temp.v('d1')));

-- With registration switched off, a new device is ACTIVE at once (no notification)
SELECT set_system_setting('security.device_registration_required', 'false', 'test.admin', 'Pilot: no approval');
SELECT set_config('test.d2', (register_device('test.sa1', pg_temp.fp('sa1-tablet'), 'Tablet', 'Android 14', 'Chrome', '10.1.1.7', 'Pune'))::text, false);
SELECT set_config('test.d3', (register_device('test.sa2', pg_temp.fp('sa2-desktop'), 'Desktop', 'Windows 11', 'Chrome', '10.2.2.5', 'Delhi'))::text, false);
SELECT set_config('test.d4', (register_device('test.admin', pg_temp.fp('admin-laptop'), 'Laptop', 'macOS', 'Safari', '10.0.0.10', 'Mumbai'))::text, false);
SELECT set_system_setting('security.device_registration_required', 'true', 'test.admin', 'Pilot over');
DO $$ BEGIN
  ASSERT (SELECT status FROM user_device WHERE device_id = pg_temp.v('d2')) = 'ACTIVE', 'no approval needed when registration is off';
  ASSERT (SELECT count(*) FROM notification WHERE type = 'DEVICE') = 1, 'no notification for a device that needs no approval';
  ASSERT (SELECT string_agg(event, ',' ORDER BY event_id) FROM user_device_event WHERE device_id = pg_temp.v('d1')) = 'REGISTERED,APPROVED', 'device history';
END $$;

-- -----------------------------------------------------------------------------
-- 3. Sessions: sign-in, concurrent limit, timeouts, admin termination, device and user changes end sessions
-- -----------------------------------------------------------------------------
SELECT pg_temp.expect_error('sign in with somebody else''s device', format($q$SELECT start_session('test.sa2', %L, '10.2.2.5', 'Delhi', 'Chrome')$q$, pg_temp.v('d1')));
SELECT pg_temp.expect_error('sign in for an unknown user',          format($q$SELECT start_session('nobody', %L, '10.2.2.5', 'Delhi', 'Chrome')$q$, pg_temp.v('d1')));

SELECT set_config('test.s1', (start_session('test.sa1', pg_temp.v('d1'), '10.1.1.5', 'Pune', 'Edge 129'))::text, false);
SELECT set_config('test.s2', (start_session('test.sa1', pg_temp.v('d2'), '10.1.1.7', 'Pune', 'Chrome')  )::text, false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM user_session WHERE user_id = 'test.sa1' AND ended_at IS NULL) = 2, 'two open sessions (the limit is 2)';
  ASSERT (SELECT last_login_at IS NOT NULL FROM app_user WHERE user_id = 'test.sa1'), 'last sign-in is kept on the user';
  ASSERT (SELECT count(*) FROM login_attempt WHERE user_id = 'test.sa1' AND succeeded) = 2, 'successful sign-ins are recorded';
  ASSERT (SELECT status FROM user_session_status WHERE session_id = pg_temp.u('s1')) = 'ACTIVE', 'a fresh session is ACTIVE';
END $$;
UPDATE user_session SET started_at = now() - interval '2 minutes', last_activity_at = now() - interval '2 minutes' WHERE session_id = pg_temp.u('s1');
SELECT set_config('test.s3', (start_session('test.sa1', pg_temp.v('d2'), '10.1.1.7', 'Pune', 'Chrome'))::text, false);
DO $$ BEGIN
  ASSERT (SELECT end_reason FROM user_session WHERE session_id = pg_temp.u('s1')) = 'SUPERSEDED', 'the third sign-in ends the least recently used session';
  ASSERT (SELECT count(*) FROM user_session WHERE user_id = 'test.sa1' AND ended_at IS NULL) = 2, 'never more open sessions than the limit';
END $$;
SELECT pg_temp.expect_error('an ended session cannot be reopened', format($q$UPDATE user_session SET ended_at = NULL, end_reason = NULL, ended_by = NULL WHERE session_id = %L$q$, pg_temp.u('s1')));
SELECT pg_temp.expect_error('end reason must be from the list',    format($q$UPDATE user_session SET ended_at = now(), end_reason = 'BORED', ended_by = 'x' WHERE session_id = %L$q$, pg_temp.u('s2')));
SELECT pg_temp.expect_error('ended without a reason',              format($q$UPDATE user_session SET ended_at = now() WHERE session_id = %L$q$, pg_temp.u('s2')));

-- Activity, idle and timeout
DO $$ BEGIN
  ASSERT touch_session(pg_temp.u('s2')), 'activity keeps an open session alive';
  ASSERT NOT touch_session(pg_temp.u('s1')), 'an ended session is not alive';
END $$;
UPDATE user_session SET last_activity_at = now() - interval '20 minutes', started_at = now() - interval '25 minutes' WHERE session_id = pg_temp.u('s2');
DO $$ BEGIN
  ASSERT (SELECT status FROM user_session_status WHERE session_id = pg_temp.u('s2')) = 'IDLE', 'no activity for longer than the idle timeout shows IDLE';
  ASSERT NOT touch_session(pg_temp.u('s2')), 'the next request after the idle timeout is refused';
  ASSERT (SELECT end_reason FROM user_session WHERE session_id = pg_temp.u('s2')) = 'IDLE_TIMEOUT', 'and the session is closed as IDLE_TIMEOUT';
END $$;
SELECT set_config('test.s4', (start_session('test.sa2', pg_temp.v('d3'), '10.2.2.5', 'Delhi', 'Chrome'))::text, false);
SELECT set_config('test.s5', (start_session('test.sa2', pg_temp.v('d3'), '10.2.2.5', 'Delhi', 'Chrome'))::text, false);
UPDATE user_session SET started_at = now() - interval '61 minutes' WHERE session_id = pg_temp.u('s4');
UPDATE user_session SET started_at = now() - interval '30 minutes', last_activity_at = now() - interval '16 minutes' WHERE session_id = pg_temp.u('s5');
DO $$ BEGIN
  ASSERT expire_sessions() = 2, 'housekeeping closes the timed-out and the idle session';
  ASSERT (SELECT end_reason FROM user_session WHERE session_id = pg_temp.u('s4')) = 'TIMEOUT', 'past the session timeout: TIMEOUT';
  ASSERT (SELECT end_reason FROM user_session WHERE session_id = pg_temp.u('s5')) = 'IDLE_TIMEOUT', 'past the idle timeout: IDLE_TIMEOUT';
  ASSERT (SELECT count(*) FROM audit_log WHERE action = 'Sessions Ended') = 0, 'routine endings (timeout, superseded) are not audited';
END $$;

-- Sign-out and admin termination
SELECT end_session(pg_temp.u('s3'), 'LOGOUT', 'test.sa1');
SELECT pg_temp.expect_error('sign out twice',                 format($q$SELECT end_session(%L, 'LOGOUT', 'test.sa1')$q$, pg_temp.u('s3')));
SELECT pg_temp.expect_error('end a session for no reason',    format($q$SELECT end_session(%L, 'BORED', 'test.sa1')$q$, pg_temp.u('s3')));
SELECT set_config('test.s6', (start_session('test.sa1', pg_temp.v('d1'), '10.1.1.5', 'Pune', 'Edge'))::text, false);
SELECT end_session(pg_temp.u('s6'), 'TERMINATED_BY_ADMIN', 'test.admin');
DO $$ BEGIN
  ASSERT (SELECT ended_by FROM user_session WHERE session_id = pg_temp.u('s6')) = 'test.admin', 'who ended it is kept';
  ASSERT (SELECT count(*) FROM audit_log WHERE action = 'Session Terminated' AND entity = pg_temp.v('s6')) = 1, 'an admin termination is audited';
END $$;

-- "Terminate all" keeps the admin's own session
SELECT set_config('test.s7', (start_session('test.sa1', pg_temp.v('d1'), '10.1.1.5', 'Pune', 'Edge'))::text, false);
SELECT set_config('test.s8', (start_session('test.sa2', pg_temp.v('d3'), '10.2.2.5', 'Delhi', 'Chrome'))::text, false);
SELECT set_config('test.s9', (start_session('test.admin', pg_temp.v('d4'), '10.0.0.10', 'Mumbai', 'Safari'))::text, false);
DO $$ BEGIN
  ASSERT end_sessions_where('all', 'test.admin', 'TERMINATED_BY_ADMIN', 'test.admin') = 2, 'all sessions but the admin''s own end';
  ASSERT (SELECT ended_at IS NULL FROM user_session WHERE session_id = pg_temp.u('s9')), 'the admin''s own session stays open';
  ASSERT (SELECT count(*) FROM audit_log WHERE action = 'Session Terminated All') = 1, 'terminate-all is audited once';
END $$;
SELECT pg_temp.expect_error('unknown scope', $q$SELECT end_sessions_where('planet', 'x', 'TERMINATED_BY_ADMIN', 'test.admin')$q$);

-- Blocking a device ends its sessions; a blocked device cannot sign in; unblock works
SELECT set_config('test.s10', (start_session('test.sa1', pg_temp.v('d1'), '10.1.1.5', 'Pune', 'Edge'))::text, false);
SELECT set_device_status(pg_temp.v('d1'), 'BLOCK', 'test.admin', 'Reported stolen');
DO $$ BEGIN
  ASSERT (SELECT end_reason FROM user_session WHERE session_id = pg_temp.u('s10')) = 'DEVICE_BLOCKED', 'blocking a device ends its sessions';
  ASSERT (SELECT status_reason FROM user_device WHERE device_id = pg_temp.v('d1')) = 'Reported stolen', 'the block reason is kept';
  ASSERT (SELECT count(*) FROM audit_log WHERE action IN ('Device Blocked', 'Sessions Ended') AND entity LIKE '%' || pg_temp.v('d1') || '%') = 2, 'block and session end are audited';
END $$;
SELECT pg_temp.expect_error('sign in from a blocked device', format($q$SELECT start_session('test.sa1', %L, '10.1.1.5', 'Pune', 'Edge')$q$, pg_temp.v('d1')));
SELECT set_device_status(pg_temp.v('d1'), 'UNBLOCK', 'test.admin', 'Found');
SELECT set_device_status(pg_temp.v('d2'), 'DEACTIVATE', 'test.admin', 'Tablet returned');
SELECT pg_temp.expect_error('sign in from an inactive device', format($q$SELECT start_session('test.sa1', %L, '10.1.1.7', 'Pune', 'Chrome')$q$, pg_temp.v('d2')));
SELECT set_device_status(pg_temp.v('d2'), 'REACTIVATE', 'test.admin');
DO $$ BEGIN
  ASSERT (SELECT string_agg(event, ',' ORDER BY event_id) FROM user_device_event WHERE device_id = pg_temp.v('d2')) = 'REGISTERED,DEACTIVATED,REACTIVATED', 'deactivate / reactivate history';
END $$;
SELECT pg_temp.expect_error('device history is append-only', $q$DELETE FROM user_device_event$q$);

-- Suspending a user ends their sessions; a suspended user cannot sign in
SELECT set_config('test.s11', (start_session('test.sa2', pg_temp.v('d3'), '10.2.2.5', 'Delhi', 'Chrome'))::text, false);
UPDATE app_user SET status = 'SUSPENDED' WHERE user_id = 'test.sa2';
DO $$ BEGIN
  ASSERT (SELECT end_reason || '/' || ended_by FROM user_session WHERE session_id = pg_temp.u('s11')) = 'USER_SUSPENDED/test.admin', 'suspension ends the sessions, by the acting admin';
END $$;
SELECT pg_temp.expect_error('suspended user signs in', format($q$SELECT start_session('test.sa2', %L, '10.2.2.5', 'Delhi', 'Chrome')$q$, pg_temp.v('d3')));
UPDATE app_user SET status = 'ACTIVE' WHERE user_id = 'test.sa2';

-- A password change reported by SSO ends the sessions (setting on), or not (setting off)
SELECT set_config('test.s12', (start_session('test.sa2', pg_temp.v('d3'), '10.2.2.5', 'Delhi', 'Chrome'))::text, false);
DO $$ BEGIN
  ASSERT record_password_change('test.sa2') = 1, 'password change ends the open session';
  ASSERT (SELECT end_reason FROM user_session WHERE session_id = pg_temp.u('s12')) = 'PASSWORD_CHANGED', 'reason PASSWORD_CHANGED';
END $$;
SELECT set_system_setting('session.force_logout_on_password_change', 'false', 'test.admin');
SELECT set_config('test.s13', (start_session('test.sa2', pg_temp.v('d3'), '10.2.2.5', 'Delhi', 'Chrome'))::text, false);
DO $$ BEGIN
  ASSERT record_password_change('test.sa2') = 0, 'with the setting off, sessions stay open';
  ASSERT (SELECT ended_at IS NULL FROM user_session WHERE session_id = pg_temp.u('s13')), 'session still open';
END $$;
SELECT set_system_setting('session.force_logout_on_password_change', 'true', 'test.admin');

-- -----------------------------------------------------------------------------
-- 4. Failed sign-ins: lock after the limit, sessions end, admins told, lock expires; a success resets the count
-- -----------------------------------------------------------------------------
SELECT set_system_setting('security.max_login_attempts', '3', 'test.admin');
DO $$ BEGIN
  ASSERT NOT record_login_failure('test.sa2', '10.9.9.9', 'Wrong OTP'), 'first failure: no lock';
  ASSERT NOT record_login_failure('test.sa2', '10.9.9.9', 'Wrong OTP'), 'second failure: no lock';
END $$;
SELECT set_config('test.s14', (start_session('test.sa2', pg_temp.v('d3'), '10.2.2.5', 'Delhi', 'Chrome'))::text, false);   -- a success resets the count
DO $$ BEGIN
  ASSERT (SELECT failed_login_count FROM app_user WHERE user_id = 'test.sa2') = 0, 'a successful sign-in resets the count';
  ASSERT NOT record_login_failure('test.sa2', '10.9.9.9', 'Wrong OTP'), '1 after the reset';
  ASSERT NOT record_login_failure('test.sa2', '10.9.9.9', 'Wrong OTP'), '2 after the reset';
  ASSERT record_login_failure('test.sa2', '10.9.9.9', 'Wrong OTP'), 'the third failure in a row locks';
  ASSERT (SELECT status FROM app_user WHERE user_id = 'test.sa2') = 'LOCKED', 'account LOCKED';
  ASSERT (SELECT locked_until BETWEEN now() + interval '29 minutes' AND now() + interval '31 minutes' FROM app_user WHERE user_id = 'test.sa2'), 'locked for the configured 30 minutes';
  ASSERT (SELECT ended_at IS NOT NULL FROM user_session WHERE session_id = pg_temp.u('s14')) AND (SELECT ended_at IS NOT NULL FROM user_session WHERE session_id = pg_temp.u('s13')), 'the lock ends open sessions';
  ASSERT (SELECT count(*) FROM audit_log WHERE action = 'Account Locked' AND status = 'WARNING' AND entity = 'test.sa2') = 1, 'the lock is audited as a warning';
  ASSERT (SELECT count(*) FROM notification WHERE type = 'SECURITY' AND recipient_role = 'TML_ADMIN') = 1, 'the TML admins are told';
  ASSERT NOT record_login_failure('test.sa2', '10.9.9.9', 'Wrong OTP'), 'failures while locked are recorded but do not lock again';
  ASSERT (SELECT count(*) FROM login_attempt WHERE user_id = 'test.sa2' AND NOT succeeded) = 6, 'every failure is recorded';
  ASSERT NOT record_login_failure('someone.unknown', '10.9.9.9', NULL), 'an unknown name is recorded, nothing to lock';
  ASSERT (SELECT count(*) FROM login_attempt WHERE login_name = 'someone.unknown') = 1, 'unknown name recorded by name';
END $$;
SELECT pg_temp.expect_error('locked user signs in', format($q$SELECT start_session('test.sa2', %L, '10.2.2.5', 'Delhi', 'Chrome')$q$, pg_temp.v('d3')));
UPDATE app_user SET locked_until = now() - interval '1 minute' WHERE user_id = 'test.sa2';   -- the lock time has passed
SELECT set_config('test.s15', (start_session('test.sa2', pg_temp.v('d3'), '10.2.2.5', 'Delhi', 'Chrome'))::text, false);
DO $$ BEGIN
  ASSERT (SELECT status = 'ACTIVE' AND locked_until IS NULL AND lock_reason IS NULL AND failed_login_count = 0 FROM app_user WHERE user_id = 'test.sa2'),
         'an expired lock is lifted at the next sign-in and the count starts again';
  ASSERT (SELECT count(*) FROM audit_log WHERE action = 'Account Unlocked' AND entity = 'test.sa2') = 1, 'the unlock is audited';
  ASSERT NOT record_login_failure('test.sa2', '10.9.9.9', 'Wrong OTP'), 'one failure after an unlock does not lock again';
END $$;
-- An admin lock (no end time) stays until an admin lifts it
UPDATE app_user SET status = 'LOCKED', lock_reason = 'Investigation' WHERE user_id = 'test.sa2';
SELECT pg_temp.expect_error('admin-locked user signs in', format($q$SELECT start_session('test.sa2', %L, '10.2.2.5', 'Delhi', 'Chrome')$q$, pg_temp.v('d3')));
UPDATE app_user SET status = 'ACTIVE' WHERE user_id = 'test.sa2';
DO $$ BEGIN
  ASSERT (SELECT lock_reason IS NULL AND failed_login_count = 0 FROM app_user WHERE user_id = 'test.sa2'), 'an admin unlock clears the lock details';
END $$;

-- Housekeeping removes old history only
UPDATE login_attempt SET attempted_at = now() - interval '200 days' WHERE login_name = 'someone.unknown';
DO $$ BEGIN
  ASSERT purge_session_history() = 1, 'only history older than the retention is removed';
END $$;

-- -----------------------------------------------------------------------------
-- 5. Row-level security: a dealer admin sees only their own dealer's sessions, devices and sign-ins
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tml_api_test') THEN CREATE ROLE tml_api_test; END IF;
END $$;
GRANT USAGE ON SCHEMA admin TO tml_api_test;
GRANT SELECT ON ALL TABLES IN SCHEMA admin TO tml_api_test;
SET ROLE tml_api_test;
SET app.dealer_code = 'DLR9001';
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM admin.user_session WHERE user_id <> 'test.sa1') = 0 AND (SELECT count(*) FROM admin.user_session) > 0, 'dealer sees only its own sessions';
  ASSERT (SELECT string_agg(DISTINCT user_id, ',') FROM admin.user_device) = 'test.sa1', 'dealer sees only its own devices';
  ASSERT (SELECT count(*) FROM admin.login_attempt WHERE user_id IS DISTINCT FROM 'test.sa1') = 0, 'dealer sees only its own sign-ins';
END $$;
RESET app.dealer_code;
DO $$ BEGIN
  ASSERT (SELECT count(DISTINCT user_id) FROM admin.user_device) = 3, 'a TML user sees every device';
END $$;
RESET ROLE;

-- -----------------------------------------------------------------------------
-- 6. Default Views: catalogue, the default for all roles, a role's own view, the checks, history and reset
-- -----------------------------------------------------------------------------
DO $$ DECLARE v jsonb := effective_default_view('READ_ONLY'); BEGIN
  ASSERT (SELECT count(*) FROM ui_card) = 12 AND (SELECT count(*) FROM ui_tab) = 9 AND (SELECT count(*) FROM ui_list_column) = 44, 'catalogue seeded';
  ASSERT v ->> 'source' = '*', 'a role without its own view uses the default for all roles';
  ASSERT jsonb_array_length(v #> '{cards,allowed}') = 12 AND v #>> '{tabs,landing}' = 'gate_in', 'all cards, Gate-In first';
  ASSERT v #> '{columns,gate_in,pinnedLeft}' = '["vehicleNo"]' AND v #> '{columns,gate_in,pinnedRight}' = '["action"]', 'pinned columns';
  ASSERT jsonb_array_length(v #> '{columns,gate_in,visible}') = 6 AND jsonb_array_length(v #> '{columns,gate_in,hidden}') = 8, 'lean Gate-In columns, the rest hidden';
  ASSERT (v #> '{columns,gate_in,visible}') ->> 0 = 'vehicleNo', 'the given column order is kept';
END $$;

SELECT set_config('test.v1', save_default_view('READ_ONLY', $json${
  "cards": {"allowed": ["jc_tracking","eqc","customer_journey"], "order": ["eqc"], "hidden": ["customer_journey"]},
  "tabs":  {"allowed": ["gate_in","my_assignment","quality_inspection"], "order": ["quality_inspection"], "hidden": ["gate_in"], "landing": "quality_inspection"},
  "columns": {"gate_in": {"visible": ["vehicleNo","status"], "pinnedLeft": ["vehicleNo"]}}}$json$::jsonb, 'test.admin', 'Viewers start on quality')::text, false);
DO $$ DECLARE v jsonb := effective_default_view('READ_ONLY'); BEGIN
  ASSERT pg_temp.v('v1')::int = 1, 'first version';
  ASSERT v ->> 'source' = 'READ_ONLY', 'the role now has its own view';
  ASSERT v #> '{cards,order}' = '["eqc","jc_tracking","customer_journey"]', 'ordered card first, the rest in catalogue order';
  ASSERT v #> '{cards,hidden}' = '["customer_journey"]', 'hidden card kept';
  ASSERT v #> '{tabs,order}' = '["quality_inspection","gate_in","my_assignment"]' AND v #>> '{tabs,landing}' = 'quality_inspection', 'tabs and landing';
  ASSERT v #> '{columns,gate_in,visible}' = '["vehicleNo","status"]' AND jsonb_array_length(v #> '{columns,gate_in,hidden}') = 12, 'own columns for Gate-In';
  ASSERT v #> '{columns,journey_search,pinnedLeft}' = '["vehicle"]', 'lists not given fall back to the default for all roles';
  ASSERT (SELECT count(*) FROM audit_log WHERE action = 'Default Views Updated' AND entity = 'Default view of role READ_ONLY') = 1, 'saving is audited';
END $$;

SELECT pg_temp.expect_error('unknown role',
  $q$SELECT save_default_view('NO_SUCH_ROLE', '{"cards":{"allowed":["eqc"]},"tabs":{"allowed":["gate_in","thd"],"landing":"gate_in"}}', 'test.admin')$q$);
SELECT pg_temp.expect_error('no cards',
  $q$SELECT save_default_view('BA', '{"cards":{"allowed":[]},"tabs":{"allowed":["gate_in","thd"],"landing":"gate_in"}}', 'test.admin')$q$);
SELECT pg_temp.expect_error('every card hidden',
  $q$SELECT save_default_view('BA', '{"cards":{"allowed":["eqc"],"hidden":["eqc"]},"tabs":{"allowed":["gate_in","thd"],"landing":"gate_in"}}', 'test.admin')$q$);
SELECT pg_temp.expect_error('unknown card',
  $q$SELECT save_default_view('BA', '{"cards":{"allowed":["coffee"]},"tabs":{"allowed":["gate_in","thd"],"landing":"gate_in"}}', 'test.admin')$q$);
SELECT pg_temp.expect_error('card listed twice',
  $q$SELECT save_default_view('BA', '{"cards":{"allowed":["eqc","eqc"]},"tabs":{"allowed":["gate_in","thd"],"landing":"gate_in"}}', 'test.admin')$q$);
SELECT pg_temp.expect_error('hidden card that is not allowed',
  $q$SELECT save_default_view('BA', '{"cards":{"allowed":["eqc"],"hidden":["thd"]},"tabs":{"allowed":["gate_in","thd"],"landing":"gate_in"}}', 'test.admin')$q$);
SELECT pg_temp.expect_error('unknown tab',
  $q$SELECT save_default_view('BA', '{"cards":{"allowed":["eqc"]},"tabs":{"allowed":["gate_in","thd","canteen"],"landing":"gate_in"}}', 'test.admin')$q$);
SELECT pg_temp.expect_error('fewer than 2 visible tabs',
  $q$SELECT save_default_view('BA', '{"cards":{"allowed":["eqc"]},"tabs":{"allowed":["gate_in","thd"],"hidden":["thd"],"landing":"gate_in"}}', 'test.admin')$q$);
SELECT pg_temp.expect_error('only 1 of 3 tabs visible',
  $q$SELECT save_default_view('BA', '{"cards":{"allowed":["eqc"]},"tabs":{"allowed":["gate_in","thd","mr_details"],"hidden":["thd","mr_details"],"landing":"gate_in"}}', 'test.admin')$q$);
SELECT pg_temp.expect_error('landing tab hidden',
  $q$SELECT save_default_view('BA', '{"cards":{"allowed":["eqc"]},"tabs":{"allowed":["gate_in","thd","mr_details"],"hidden":["gate_in"],"landing":"gate_in"}}', 'test.admin')$q$);
SELECT pg_temp.expect_error('landing tab not allowed',
  $q$SELECT save_default_view('BA', '{"cards":{"allowed":["eqc"]},"tabs":{"allowed":["gate_in","thd"],"landing":"mr_details"}}', 'test.admin')$q$);
SELECT pg_temp.expect_error('no landing tab',
  $q$SELECT save_default_view('BA', '{"cards":{"allowed":["eqc"]},"tabs":{"allowed":["gate_in","thd"]}}', 'test.admin')$q$);
SELECT pg_temp.expect_error('unknown list',
  $q$SELECT save_default_view('BA', '{"cards":{"allowed":["eqc"]},"tabs":{"allowed":["gate_in","thd"],"landing":"gate_in"},"columns":{"payroll":{"visible":["x"]}}}', 'test.admin')$q$);
SELECT pg_temp.expect_error('unknown column',
  $q$SELECT save_default_view('BA', '{"cards":{"allowed":["eqc"]},"tabs":{"allowed":["gate_in","thd"],"landing":"gate_in"},"columns":{"gate_in":{"visible":["salary"]}}}', 'test.admin')$q$);
SELECT pg_temp.expect_error('no visible column',
  $q$SELECT save_default_view('BA', '{"cards":{"allowed":["eqc"]},"tabs":{"allowed":["gate_in","thd"],"landing":"gate_in"},"columns":{"gate_in":{"visible":[]}}}', 'test.admin')$q$);
SELECT pg_temp.expect_error('column both visible and hidden',
  $q$SELECT save_default_view('BA', '{"cards":{"allowed":["eqc"]},"tabs":{"allowed":["gate_in","thd"],"landing":"gate_in"},"columns":{"gate_in":{"visible":["model"],"hidden":["model"]}}}', 'test.admin')$q$);
SELECT pg_temp.expect_error('pinned column not visible',
  $q$SELECT save_default_view('BA', '{"cards":{"allowed":["eqc"]},"tabs":{"allowed":["gate_in","thd"],"landing":"gate_in"},"columns":{"gate_in":{"visible":["model"],"pinnedLeft":["status"]}}}', 'test.admin')$q$);
SELECT pg_temp.expect_error('column pinned left and right',
  $q$SELECT save_default_view('BA', '{"cards":{"allowed":["eqc"]},"tabs":{"allowed":["gate_in","thd"],"landing":"gate_in"},"columns":{"gate_in":{"visible":["model"],"pinnedLeft":["model"],"pinnedRight":["model"]}}}', 'test.admin')$q$);
SELECT pg_temp.expect_error('missing tabs section',
  $q$SELECT save_default_view('BA', '{"cards":{"allowed":["eqc"]}}', 'test.admin')$q$);
SELECT pg_temp.expect_error('policy for a role that does not exist (direct insert)',
  $q$INSERT INTO default_view_policy (role_id, landing_tab_id, updated_by) VALUES ('GHOST', 'gate_in', 'x')$q$);
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM default_view_policy WHERE role_id = 'BA'), 'a refused save leaves nothing behind';
  ASSERT effective_default_view('READ_ONLY') ->> 'source' = 'READ_ONLY', 'a refused save does not touch other roles';
END $$;

-- A role with a single allowed tab needs only that one visible
SELECT save_default_view('BA', '{"cards":{"allowed":["eqc"]},"tabs":{"allowed":["mr_details"],"landing":"mr_details"}}', 'test.admin');

-- Second version, then reset, then save again: versions keep counting, history keeps everything
SELECT set_config('test.v2', (save_default_view('READ_ONLY', '{"cards":{"allowed":["eqc"]},"tabs":{"allowed":["gate_in","thd"],"landing":"thd"}}', 'test.admin', 'Simpler'))::text, false);
SELECT reset_default_view('READ_ONLY', 'test.admin', 'Back to default');
SELECT pg_temp.expect_error('reset twice',             $q$SELECT reset_default_view('READ_ONLY', 'test.admin')$q$);
SELECT pg_temp.expect_error('remove the default for all roles', $q$SELECT reset_default_view('*', 'test.admin')$q$);
SELECT set_config('test.v4', (save_default_view('READ_ONLY', '{"cards":{"allowed":["thd"]},"tabs":{"allowed":["gate_in","thd"],"landing":"gate_in"}}', 'test.admin'))::text, false);
DO $$ BEGIN
  ASSERT pg_temp.v('v2')::int = 2 AND pg_temp.v('v4')::int = 4, 'versions keep counting after a reset';
  ASSERT (SELECT string_agg(version::text || CASE WHEN policy ? 'reset' THEN 'R' ELSE '' END, ',' ORDER BY version) FROM default_view_history WHERE role_id = 'READ_ONLY') = '1,2,3R,4',
         'every version and the reset are in the history';
  ASSERT (SELECT count(*) FROM audit_log WHERE action = 'Default Views Reset') = 1, 'the reset is audited';
END $$;
SELECT pg_temp.expect_error('default view history is append-only', $q$UPDATE default_view_history SET reason = 'x'$q$);

-- A column retired from the catalogue disappears from every default view, without editing the views
UPDATE ui_list_column SET is_active = false WHERE list_id = 'gate_in' AND column_key = 'model';
UPDATE ui_card SET is_active = false WHERE card_id = 'spd';
DO $$ DECLARE v jsonb := effective_default_view('TML_ADMIN'); BEGIN
  ASSERT NOT (v #> '{columns,gate_in,hidden}') ? 'model' AND NOT (v #> '{columns,gate_in,visible}') ? 'model', 'a retired column is gone';
  ASSERT NOT (v #> '{cards,allowed}') ? 'spd', 'a retired card is gone';
END $$;
SELECT pg_temp.expect_error('a retired card cannot be chosen',
  $q$SELECT save_default_view('BA', '{"cards":{"allowed":["spd"]},"tabs":{"allowed":["gate_in","thd"],"landing":"gate_in"}}', 'test.admin')$q$);
UPDATE ui_list_column SET is_active = true WHERE list_id = 'gate_in' AND column_key = 'model';
UPDATE ui_card SET is_active = true WHERE card_id = 'spd';

-- -----------------------------------------------------------------------------
-- 7. Audit coverage: every action the database wrote is catalogued; DB actions are not left to the API
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM audit_log_uncatalogued WHERE action <> 'Test'), 'every action in the audit log so far is catalogued (the ''Test'' row comes from schema_test.sql)';
  ASSERT (SELECT count(*) FROM audit_action_catalog WHERE written_by = 'DB') = 14, '14 actions are written by the database';
  ASSERT (SELECT count(DISTINCT action) FROM audit_log a WHERE EXISTS (SELECT 1 FROM audit_action_catalog c WHERE c.action = a.action AND c.written_by = 'DB')) = 14,
         'these tests made the database write all 14 of them';
  ASSERT NOT EXISTS (SELECT 1 FROM audit_log a JOIN audit_action_catalog c ON c.action = a.action WHERE a.module <> c.module), 'every audit row is under its catalogued module';
  ASSERT (SELECT count(*) FROM audit_action_catalog WHERE is_dpdp) = 3, 'the three DPDP actions are catalogued';
  ASSERT (SELECT count(*) FROM audit_log_security WHERE action = 'Account Locked') = 1, 'the security review shows the lock';
  ASSERT NOT EXISTS (SELECT 1 FROM audit_log_security WHERE action LIKE 'Default Views%'), 'layout changes are not in the security review';
END $$;
-- An action nobody catalogued shows up in the governance view
INSERT INTO audit_log (user_id, user_name, action, module, entity) VALUES ('test.admin', 'Test TML Admin', 'Something New', 'Administration', 'x');
DO $$ BEGIN
  ASSERT (SELECT occurrences FROM audit_log_uncatalogued WHERE action = 'Something New') = 1, 'an uncatalogued action is flagged';
END $$;

RESET app.user_id; RESET app.user_name; RESET app.client_ip;
SELECT 'platform tests passed' AS result;
