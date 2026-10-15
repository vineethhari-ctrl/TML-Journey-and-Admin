-- =============================================================================
-- TML Service Transformation: Admin Portal platform — configuration, devices, sessions, default views, audit coverage
-- Part 3 of the database design. Load AFTER schema.sql (part 1) and schema_masters_crm.sql (part 2):
--   psql -v ON_ERROR_STOP=1 -f docs/backend/schema.sql -f docs/backend/schema_masters_crm.sql -f docs/backend/schema_platform.sql
-- Self-checking tests: schema_platform_test.sql.  TEST DATA ONLY in this repository.
--
-- Covers the Admin Portal screens Configuration, Devices, Sessions, Default Views and the coverage of the Audit Log.
-- Identity (who a person is, passwords) stays with TML SSO; this part stores what the portal itself must control.
--
-- Session variables set by the API on every request (same convention as part 1):
--   app.user_id, app.user_name   who is acting (audit)          app.client_ip   the caller's IP (audit)
--   app.dealer_code              set for dealer users only (row-level security)
-- =============================================================================

SET search_path = admin, public;

-- -----------------------------------------------------------------------------
-- 0. Audit helper: one place that writes audit rows from the database
-- -----------------------------------------------------------------------------
-- Actions the database writes itself (security-relevant, and things only the database sees, such as an automatic lock)
-- are listed in audit_action_catalog with written_by = 'DB'. The API must not write those actions again.
CREATE FUNCTION write_audit(p_action varchar, p_module varchar, p_entity varchar, p_old text, p_new text, p_status varchar DEFAULT 'SUCCESS')
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO audit_log (user_id, user_name, action, module, entity, old_value, new_value, ip_address, status)
  VALUES (coalesce(nullif(current_setting('app.user_id', true), ''), 'system'),
          coalesce(nullif(current_setting('app.user_name', true), ''), nullif(current_setting('app.user_id', true), ''), 'system'),
          p_action, p_module, left(p_entity, 300), p_old, p_new,
          nullif(current_setting('app.client_ip', true), '')::inet, p_status);
END $$;

-- -----------------------------------------------------------------------------
-- 1. Configuration (Admin Portal → Configuration): one row per setting, typed and range-checked, with history
-- -----------------------------------------------------------------------------
CREATE TABLE system_setting (
  setting_key      varchar(60)  PRIMARY KEY CHECK (setting_key ~ '^[a-z]+(\.[a-z_]+)+$'),   -- e.g. session.timeout_minutes
  setting_group    varchar(12)  NOT NULL CHECK (setting_group IN ('SESSION', 'SECURITY', 'NOTIFICATION', 'JOURNEY')),
  label            varchar(120) NOT NULL,
  portal_field     varchar(60),                                                         -- the field name in the portal (SystemConfiguration)
  value_type       varchar(7)   NOT NULL CHECK (value_type IN ('INTEGER', 'BOOLEAN')),
  value            jsonb        NOT NULL,
  default_value    jsonb        NOT NULL,
  min_value        integer,
  max_value        integer,
  unit             varchar(12),                                                         -- minutes, hours, days, count
  description      text         NOT NULL,
  enforced_by      varchar(4)   NOT NULL DEFAULT 'APP' CHECK (enforced_by IN ('APP', 'SSO')),   -- SSO: kept for reference, enforced by TML SSO
  row_version      integer      NOT NULL DEFAULT 1,
  updated_at       timestamptz  NOT NULL DEFAULT now(),
  updated_by       varchar(60)  NOT NULL,
  CHECK ((value_type = 'BOOLEAN' AND jsonb_typeof(value) = 'boolean' AND jsonb_typeof(default_value) = 'boolean' AND min_value IS NULL AND max_value IS NULL)
      OR (value_type = 'INTEGER' AND jsonb_typeof(value) = 'number' AND jsonb_typeof(default_value) = 'number'
          AND min_value IS NOT NULL AND max_value IS NOT NULL AND min_value <= max_value
          AND (value #>> '{}')::numeric = trunc((value #>> '{}')::numeric)
          AND (value #>> '{}')::numeric BETWEEN min_value AND max_value
          AND (default_value #>> '{}')::numeric BETWEEN min_value AND max_value))
);

-- Every change, who, when and why (append-only)
CREATE TABLE system_setting_history (
  history_id       bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  setting_key      varchar(60)  NOT NULL REFERENCES system_setting,
  old_value        jsonb,
  new_value        jsonb        NOT NULL,
  reason           varchar(300),
  changed_by       varchar(60)  NOT NULL,
  changed_at       timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX system_setting_history_key ON system_setting_history (setting_key, changed_at DESC);

CREATE FUNCTION history_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION '% is append-only', TG_TABLE_NAME; END $$;
CREATE TRIGGER system_setting_history_no_change BEFORE UPDATE OR DELETE ON system_setting_history
  FOR EACH ROW EXECUTE FUNCTION history_append_only();

-- Read a setting (used by the session and device rules below, and by the API)
CREATE FUNCTION setting_int(p_key varchar) RETURNS integer LANGUAGE sql STABLE AS $$
  SELECT (value #>> '{}')::integer FROM system_setting WHERE setting_key = p_key AND value_type = 'INTEGER';
$$;
CREATE FUNCTION setting_bool(p_key varchar) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT (value #>> '{}')::boolean FROM system_setting WHERE setting_key = p_key AND value_type = 'BOOLEAN';
$$;

-- The only way to change a setting: checks the type, the range and the cross-setting rules, keeps history, writes the audit.
-- p_row_version (optional) is the version the admin saw: a concurrent change by someone else is refused, not overwritten.
CREATE FUNCTION set_system_setting(p_key varchar, p_value jsonb, p_user varchar, p_reason varchar DEFAULT NULL, p_row_version integer DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE s system_setting%ROWTYPE; v_idle integer; v_session integer;
BEGIN
  SELECT * INTO s FROM system_setting WHERE setting_key = p_key FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown setting %', p_key; END IF;
  IF p_row_version IS NOT NULL AND p_row_version <> s.row_version THEN
    RAISE EXCEPTION 'Setting % was changed by someone else (version % is now %): reload and try again', p_key, p_row_version, s.row_version;
  END IF;
  IF s.value_type = 'BOOLEAN' AND jsonb_typeof(p_value) <> 'boolean' THEN
    RAISE EXCEPTION 'Setting % takes true or false', p_key;
  END IF;
  IF s.value_type = 'INTEGER' AND (jsonb_typeof(p_value) <> 'number' OR (p_value #>> '{}')::numeric <> trunc((p_value #>> '{}')::numeric)) THEN
    RAISE EXCEPTION 'Setting % takes a whole number', p_key;
  END IF;
  IF s.value_type = 'INTEGER' AND (p_value #>> '{}')::numeric NOT BETWEEN s.min_value AND s.max_value THEN
    RAISE EXCEPTION 'Setting % must be between % and %', p_key, s.min_value, s.max_value::text || coalesce(' ' || nullif(s.unit, 'count'), '');
  END IF;
  IF p_value = s.value THEN RETURN; END IF;   -- no change, nothing written

  -- Cross-setting rule: a session cannot end for inactivity later than it ends altogether
  v_idle    := CASE WHEN p_key = 'session.idle_timeout_minutes' THEN (p_value #>> '{}')::integer ELSE setting_int('session.idle_timeout_minutes') END;
  v_session := CASE WHEN p_key = 'session.timeout_minutes'      THEN (p_value #>> '{}')::integer ELSE setting_int('session.timeout_minutes') END;
  IF v_idle > v_session THEN
    RAISE EXCEPTION 'The idle timeout (% min) cannot be longer than the session timeout (% min)', v_idle, v_session;
  END IF;

  UPDATE system_setting SET value = p_value, row_version = row_version + 1, updated_at = now(), updated_by = p_user WHERE setting_key = p_key;
  INSERT INTO system_setting_history (setting_key, old_value, new_value, reason, changed_by) VALUES (p_key, s.value, p_value, p_reason, p_user);
  PERFORM write_audit('Configuration Changed', 'Administration', s.label, s.value::text, p_value::text);
END $$;

-- The 16 settings of the portal, with the portal's defaults, plus one new setting for session history retention
INSERT INTO system_setting (setting_key, setting_group, label, portal_field, value_type, value, default_value, min_value, max_value, unit, description, enforced_by, updated_by) VALUES
  ('session.timeout_minutes',               'SESSION',      'Session timeout',                     'sessionTimeoutMinutes',       'INTEGER', '60',   '60',   5,  1440, 'minutes', 'A session ends this long after it started, whatever the activity.', 'APP', 'system'),
  ('session.idle_timeout_minutes',          'SESSION',      'Idle timeout',                        'idleTimeoutMinutes',          'INTEGER', '15',   '15',   1,  240,  'minutes', 'A session with no activity for this long is shown as idle and ends at the next request or housekeeping run.', 'APP', 'system'),
  ('session.max_concurrent',                'SESSION',      'Maximum concurrent sessions per user', 'maxConcurrentSessions',      'INTEGER', '3',    '3',    1,  20,   'count',   'A new sign-in beyond this number ends the user''s oldest session.', 'APP', 'system'),
  ('session.force_logout_on_password_change','SESSION',     'Force logout on password change',     'forceLogoutOnPasswordChange', 'BOOLEAN', 'true', 'true', NULL, NULL, NULL,     'When SSO reports a password change, all the user''s sessions end.', 'APP', 'system'),
  ('session.history_retention_days',        'SESSION',      'Keep ended sessions and sign-in attempts for', NULL,                 'INTEGER', '180',  '180',  30, 3650, 'days',    'NEW (not in the portal yet): ended sessions and sign-in attempts older than this are removed by housekeeping.', 'APP', 'system'),
  ('security.max_login_attempts',           'SECURITY',     'Maximum failed sign-in attempts',     'maxLoginAttempts',            'INTEGER', '5',    '5',    1,  20,   'count',   'After this many failed attempts in a row the account is locked.', 'APP', 'system'),
  ('security.account_lock_minutes',         'SECURITY',     'Account lock duration',               'accountLockDurationMinutes',  'INTEGER', '30',   '30',   1,  1440, 'minutes', 'An automatic lock is lifted after this long. A lock set by an admin stays until the admin lifts it.', 'APP', 'system'),
  ('security.password_expiry_days',         'SECURITY',     'Password expiry',                     'passwordExpiryDays',          'INTEGER', '90',   '90',   0,  365,  'days',    'Passwords are owned by TML SSO; kept here for reference only.', 'SSO', 'system'),
  ('security.device_registration_required', 'SECURITY',     'Device registration required',        'deviceRegistrationRequired',  'BOOLEAN', 'true', 'true', NULL, NULL, NULL,     'A device seen for the first time waits for admin approval before it can be used.', 'APP', 'system'),
  ('notification.email_enabled',            'NOTIFICATION', 'E-mail notifications',                'emailNotificationsEnabled',   'BOOLEAN', 'true', 'true', NULL, NULL, NULL,     'Send notification e-mails (e-mail outbox).', 'APP', 'system'),
  ('notification.sms_enabled',              'NOTIFICATION', 'SMS notifications',                   'smsNotificationsEnabled',     'BOOLEAN', 'true', 'true', NULL, NULL, NULL,     'Send notification SMS.', 'APP', 'system'),
  ('notification.in_app_enabled',           'NOTIFICATION', 'In-app notifications',                'inAppNotificationsEnabled',   'BOOLEAN', 'true', 'true', NULL, NULL, NULL,     'Show notifications in the portal (bell).', 'APP', 'system'),
  ('notification.urgent_exception_alerts',  'NOTIFICATION', 'Urgent exception alerts',             'urgentExceptionAlerts',       'BOOLEAN', 'true', 'true', NULL, NULL, NULL,     'Alert immediately on critical journey exceptions.', 'APP', 'system'),
  ('journey.event_retention_days',          'JOURNEY',      'Journey event retention',             'journeyEventRetentionDays',   'INTEGER', '365',  '365',  30, 3650, 'days',    'Journey events older than this are archived.', 'APP', 'system'),
  ('journey.exception_threshold_minutes',   'JOURNEY',      'Exception threshold',                 'exceptionThresholdMinutes',   'INTEGER', '30',   '30',   1,  1440, 'minutes', 'A stage overdue by this long raises a journey exception.', 'APP', 'system'),
  ('journey.stage_timeout_hours',           'JOURNEY',      'Stage timeout',                       'stageTimeoutThresholdHours',  'INTEGER', '4',    '4',    1,  168,  'hours',   'A stage open longer than this is flagged as timed out.', 'APP', 'system'),
  ('journey.auto_escalate_exceptions',      'JOURNEY',      'Auto-escalate exceptions',            'autoEscalateExceptions',      'BOOLEAN', 'true', 'true', NULL, NULL, NULL,     'Escalate an exception automatically along the escalation matrix.', 'APP', 'system');

-- -----------------------------------------------------------------------------
-- 2. Users: what the portal needs on top of part 1 for locks and password changes
-- -----------------------------------------------------------------------------
ALTER TABLE app_user
  ADD COLUMN locked_until        timestamptz,     -- set by an automatic lock; NULL with status LOCKED = locked by an admin until lifted
  ADD COLUMN lock_reason         varchar(200),
  ADD COLUMN password_changed_at timestamptz,     -- reported by SSO
  ADD COLUMN failed_login_count  integer NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0);   -- failures in a row since the last success or unlock

-- Lifting a lock (by an admin, or automatically at the next sign-in) clears the lock details and the failure count
CREATE FUNCTION app_user_unlock_clears() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'LOCKED' AND NEW.status <> 'LOCKED' THEN
    NEW.locked_until := NULL; NEW.lock_reason := NULL; NEW.failed_login_count := 0;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER app_user_unlock BEFORE UPDATE OF status ON app_user FOR EACH ROW EXECUTE FUNCTION app_user_unlock_clears();

-- -----------------------------------------------------------------------------
-- 3. Devices (Admin Portal → Devices)
-- -----------------------------------------------------------------------------
CREATE TABLE user_device (
  device_id        varchar(60)  PRIMARY KEY DEFAULT ('DEV-' || upper(substr(md5(gen_random_uuid()::text), 1, 10))),
  user_id          varchar(60)  NOT NULL REFERENCES app_user ON DELETE CASCADE,
  fingerprint_hash char(64)     NOT NULL CHECK (fingerprint_hash ~ '^[0-9a-f]{64}$'),   -- SHA-256 of the device identifier: the raw identifier is never stored
  device_type      varchar(16)  NOT NULL CHECK (device_type IN ('Desktop', 'Laptop', 'Tablet', 'Mobile', 'Workshop Device')),
  operating_system varchar(60),
  browser          varchar(60),
  mac_address      macaddr,                        -- only for managed workshop devices (MDM); browsers cannot read it
  last_ip_address  inet,
  last_location    varchar(120),
  status           varchar(8)   NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('PENDING', 'ACTIVE', 'INACTIVE', 'BLOCKED')),
  status_reason    varchar(200),
  status_changed_by varchar(60),
  status_changed_at timestamptz,
  first_registered_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at     timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (user_id, fingerprint_hash),
  CHECK (status <> 'BLOCKED' OR status_reason IS NOT NULL)
);
CREATE INDEX user_device_user ON user_device (user_id);
CREATE INDEX user_device_pending ON user_device (first_registered_at) WHERE status = 'PENDING';

-- Every status change of a device (append-only)
CREATE TABLE user_device_event (
  event_id         bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  device_id        varchar(60)  NOT NULL REFERENCES user_device ON DELETE CASCADE,
  event            varchar(12)  NOT NULL CHECK (event IN ('REGISTERED', 'APPROVED', 'BLOCKED', 'UNBLOCKED', 'DEACTIVATED', 'REACTIVATED')),
  old_status       varchar(8),
  new_status       varchar(8)   NOT NULL,
  reason           varchar(200),
  by_user          varchar(60)  NOT NULL,
  at               timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX user_device_event_device ON user_device_event (device_id, at DESC);
CREATE TRIGGER user_device_event_no_change BEFORE UPDATE OR DELETE ON user_device_event
  FOR EACH ROW EXECUTE FUNCTION history_append_only();

-- A device seen at sign-in. Known device: refreshes last seen. New device: PENDING when registration is required
-- (an admin must approve it; the TML admins get a notification), else ACTIVE straight away. Returns the device id.
CREATE FUNCTION register_device(p_user varchar, p_fingerprint_hash char, p_type varchar, p_os varchar, p_browser varchar, p_ip inet, p_location varchar)
RETURNS varchar LANGUAGE plpgsql AS $$
DECLARE d user_device%ROWTYPE; v_status varchar(8);
BEGIN
  SELECT * INTO d FROM user_device WHERE user_id = p_user AND fingerprint_hash = p_fingerprint_hash;
  IF FOUND THEN
    UPDATE user_device SET last_seen_at = now(), last_ip_address = p_ip, last_location = coalesce(p_location, last_location),
                           operating_system = coalesce(p_os, operating_system), browser = coalesce(p_browser, browser)
     WHERE device_id = d.device_id;
    RETURN d.device_id;
  END IF;
  v_status := CASE WHEN coalesce(setting_bool('security.device_registration_required'), true) THEN 'PENDING' ELSE 'ACTIVE' END;
  INSERT INTO user_device (user_id, fingerprint_hash, device_type, operating_system, browser, last_ip_address, last_location, status, status_changed_by, status_changed_at)
  VALUES (p_user, p_fingerprint_hash, p_type, p_os, p_browser, p_ip, p_location, v_status, 'system', now())
  RETURNING * INTO d;
  INSERT INTO user_device_event (device_id, event, old_status, new_status, by_user) VALUES (d.device_id, 'REGISTERED', NULL, v_status, p_user);
  PERFORM write_audit('Device Registered', 'Administration', d.device_id || ' (' || p_user || ')', NULL, v_status);
  IF v_status = 'PENDING' THEN
    INSERT INTO notification (recipient_role, type, title, message, target_path)
    VALUES ('TML_ADMIN', 'DEVICE', 'New device waiting for approval',
            format('%s signed in from a new %s (%s). Approve or block it.', p_user, p_type, coalesce(p_browser, p_os, 'unknown')),
            '/admin/devices?device=' || d.device_id);
  END IF;
  RETURN d.device_id;
END $$;

-- Admin actions on a device: APPROVE (PENDING -> ACTIVE), BLOCK (reason required; ends its sessions), UNBLOCK,
-- DEACTIVATE (no longer used), REACTIVATE.
CREATE FUNCTION set_device_status(p_device varchar, p_action varchar, p_user varchar, p_reason varchar DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE d user_device%ROWTYPE; v_new varchar(8); v_event varchar(12); v_audit varchar(40);
BEGIN
  SELECT * INTO d FROM user_device WHERE device_id = p_device FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown device %', p_device; END IF;
  CASE p_action
    WHEN 'APPROVE'    THEN IF d.status <> 'PENDING'  THEN RAISE EXCEPTION 'Only a PENDING device can be approved (device % is %)', p_device, d.status; END IF;
                           v_new := 'ACTIVE';   v_event := 'APPROVED';    v_audit := 'Device Approved';
    WHEN 'BLOCK'      THEN IF d.status = 'BLOCKED'   THEN RAISE EXCEPTION 'Device % is already blocked', p_device; END IF;
                           IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'A reason is required to block a device'; END IF;
                           v_new := 'BLOCKED';  v_event := 'BLOCKED';     v_audit := 'Device Blocked';
    WHEN 'UNBLOCK'    THEN IF d.status <> 'BLOCKED'  THEN RAISE EXCEPTION 'Device % is not blocked', p_device; END IF;
                           v_new := 'ACTIVE';   v_event := 'UNBLOCKED';   v_audit := 'Device Unblocked';
    WHEN 'DEACTIVATE' THEN IF d.status <> 'ACTIVE'   THEN RAISE EXCEPTION 'Only an ACTIVE device can be deactivated (device % is %)', p_device, d.status; END IF;
                           v_new := 'INACTIVE'; v_event := 'DEACTIVATED'; v_audit := 'Device Deactivated';
    WHEN 'REACTIVATE' THEN IF d.status <> 'INACTIVE' THEN RAISE EXCEPTION 'Only an INACTIVE device can be reactivated (device % is %)', p_device, d.status; END IF;
                           v_new := 'ACTIVE';   v_event := 'REACTIVATED'; v_audit := 'Device Reactivated';
    ELSE RAISE EXCEPTION 'Unknown device action %', p_action;
  END CASE;
  UPDATE user_device SET status = v_new, status_reason = p_reason, status_changed_by = p_user, status_changed_at = now() WHERE device_id = p_device;
  INSERT INTO user_device_event (device_id, event, old_status, new_status, reason, by_user) VALUES (p_device, v_event, d.status, v_new, p_reason, p_user);
  PERFORM write_audit(v_audit, 'Administration', p_device || ' (' || d.user_id || ')', d.status, v_new);
  IF v_new IN ('BLOCKED', 'INACTIVE') THEN
    PERFORM end_sessions_where('device', p_device, CASE WHEN v_new = 'BLOCKED' THEN 'DEVICE_BLOCKED' ELSE 'DEVICE_DEACTIVATED' END, p_user);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. Sessions (Admin Portal → Sessions) and sign-in attempts
-- -----------------------------------------------------------------------------
CREATE TABLE user_session (
  session_id       uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          varchar(60)  NOT NULL REFERENCES app_user ON DELETE CASCADE,
  device_id        varchar(60)  NOT NULL REFERENCES user_device,
  sso_session_hash char(64),                        -- SHA-256 of the SSO session / token id, to end the SSO side too; never the token
  ip_address       inet,
  location         varchar(120),
  user_agent       varchar(300),
  started_at       timestamptz  NOT NULL DEFAULT now(),
  last_activity_at timestamptz  NOT NULL DEFAULT now(),
  ended_at         timestamptz,
  end_reason       varchar(20)  CHECK (end_reason IN ('LOGOUT', 'TIMEOUT', 'IDLE_TIMEOUT', 'TERMINATED_BY_ADMIN', 'SUPERSEDED',
                                                      'DEVICE_BLOCKED', 'DEVICE_DEACTIVATED', 'USER_SUSPENDED', 'USER_LOCKED',
                                                      'USER_INACTIVE', 'PASSWORD_CHANGED')),
  ended_by         varchar(60),
  CHECK ((ended_at IS NULL AND end_reason IS NULL AND ended_by IS NULL) OR (ended_at IS NOT NULL AND end_reason IS NOT NULL AND ended_by IS NOT NULL)),
  CHECK (last_activity_at >= started_at AND (ended_at IS NULL OR ended_at >= started_at))
);
CREATE INDEX user_session_open ON user_session (user_id, started_at) WHERE ended_at IS NULL;
CREATE INDEX user_session_device_open ON user_session (device_id) WHERE ended_at IS NULL;
CREATE INDEX user_session_ended ON user_session (ended_at) WHERE ended_at IS NOT NULL;

-- An ended session is history: it can never be reopened or changed
CREATE FUNCTION user_session_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.ended_at IS NOT NULL THEN RAISE EXCEPTION 'Session % has ended and cannot be changed', OLD.session_id; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER user_session_ended_is_final BEFORE UPDATE ON user_session FOR EACH ROW EXECUTE FUNCTION user_session_guard();

-- What the Sessions screen shows: ACTIVE, IDLE (no activity for the idle timeout, not yet closed) or TERMINATED
CREATE VIEW user_session_status AS
SELECT s.session_id, s.user_id, u.full_name AS user_name, u.employee_id, u.user_type, u.dealer_code,
       s.device_id, d.device_type, s.ip_address, s.location, s.started_at, s.last_activity_at, s.ended_at, s.end_reason, s.ended_by,
       CASE WHEN s.ended_at IS NOT NULL THEN 'TERMINATED'
            WHEN s.last_activity_at < now() - make_interval(mins => setting_int('session.idle_timeout_minutes'))
              OR s.started_at < now() - make_interval(mins => setting_int('session.timeout_minutes')) THEN 'IDLE'
            ELSE 'ACTIVE' END AS status
  FROM user_session s JOIN app_user u ON u.user_id = s.user_id JOIN user_device d ON d.device_id = s.device_id;

-- Ends every open session matching a user, a device, or everybody (p_scope = 'user' | 'device' | 'all').
-- For 'all', p_value is the user to keep (the admin doing it). Returns how many sessions ended.
CREATE FUNCTION end_sessions_where(p_scope varchar, p_value varchar, p_reason varchar, p_by varchar) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  IF p_scope NOT IN ('user', 'device', 'all') THEN RAISE EXCEPTION 'Unknown scope %', p_scope; END IF;
  UPDATE user_session SET ended_at = now(), end_reason = p_reason, ended_by = p_by
   WHERE ended_at IS NULL
     AND CASE p_scope WHEN 'user' THEN user_id = p_value WHEN 'device' THEN device_id = p_value
                      WHEN 'all' THEN user_id IS DISTINCT FROM p_value ELSE false END;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 AND p_reason = 'TERMINATED_BY_ADMIN' THEN
    PERFORM write_audit(CASE WHEN p_scope = 'all' THEN 'Session Terminated All' ELSE 'Session Terminated' END, 'Administration',
                        p_scope || ' ' || coalesce(p_value, ''), n || ' open', 'TERMINATED');
  ELSIF n > 0 AND p_reason NOT IN ('LOGOUT', 'TIMEOUT', 'IDLE_TIMEOUT', 'SUPERSEDED') THEN
    PERFORM write_audit('Sessions Ended', 'Administration', p_scope || ' ' || coalesce(p_value, ''), n || ' open', p_reason);
  END IF;
  RETURN n;
END $$;

-- Sign-in. Refused for a user who is not ACTIVE (an expired automatic lock is lifted first) and for a device that is not
-- ACTIVE. Above the concurrent-session limit the user's oldest open session ends (SUPERSEDED). Returns the session id.
CREATE FUNCTION start_session(p_user varchar, p_device varchar, p_ip inet, p_location varchar, p_user_agent varchar, p_sso_session_hash char DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE u app_user%ROWTYPE; d user_device%ROWTYPE; v_id uuid; v_max integer; v_open integer;
BEGIN
  SELECT * INTO u FROM app_user WHERE user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown user %', p_user; END IF;
  IF u.status = 'LOCKED' AND u.locked_until IS NOT NULL AND u.locked_until <= now() THEN
    UPDATE app_user SET status = 'ACTIVE', updated_at = now() WHERE user_id = p_user;   -- the unlock trigger clears the lock details
    PERFORM write_audit('Account Unlocked', 'Administration', p_user, 'LOCKED', 'ACTIVE (lock expired)');
    u.status := 'ACTIVE';
  END IF;
  IF u.status <> 'ACTIVE' THEN RAISE EXCEPTION 'User % cannot sign in: account is %', p_user, u.status; END IF;

  SELECT * INTO d FROM user_device WHERE device_id = p_device;
  IF NOT FOUND OR d.user_id <> p_user THEN RAISE EXCEPTION 'Device % is not registered to user %', p_device, p_user; END IF;
  IF d.status <> 'ACTIVE' THEN RAISE EXCEPTION 'Device % cannot be used: it is %', p_device, d.status; END IF;

  v_max := coalesce(setting_int('session.max_concurrent'), 3);
  SELECT count(*) INTO v_open FROM user_session WHERE user_id = p_user AND ended_at IS NULL;
  IF v_open >= v_max THEN
    UPDATE user_session SET ended_at = now(), end_reason = 'SUPERSEDED', ended_by = 'system'
     WHERE session_id IN (SELECT session_id FROM user_session WHERE user_id = p_user AND ended_at IS NULL
                           ORDER BY last_activity_at, started_at LIMIT v_open - v_max + 1);
  END IF;

  INSERT INTO user_session (user_id, device_id, sso_session_hash, ip_address, location, user_agent)
  VALUES (p_user, p_device, p_sso_session_hash, p_ip, p_location, p_user_agent) RETURNING session_id INTO v_id;
  UPDATE app_user SET last_login_at = now(), failed_login_count = 0 WHERE user_id = p_user;
  UPDATE user_device SET last_seen_at = now(), last_ip_address = coalesce(p_ip, last_ip_address) WHERE device_id = p_device;
  INSERT INTO login_attempt (user_id, ip_address, device_id, succeeded) VALUES (p_user, p_ip, p_device, true);
  RETURN v_id;
END $$;

-- Every API request: keeps the session alive and returns true; returns false when the session has ended (it is closed
-- here if it has just timed out or gone idle), and the API then asks the user to sign in again.
CREATE FUNCTION touch_session(p_session uuid) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE s user_session%ROWTYPE; v_reason varchar(20);
BEGIN
  SELECT * INTO s FROM user_session WHERE session_id = p_session FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown session %', p_session; END IF;
  IF s.ended_at IS NOT NULL THEN RETURN false; END IF;
  v_reason := CASE WHEN s.started_at < now() - make_interval(mins => setting_int('session.timeout_minutes')) THEN 'TIMEOUT'
                   WHEN s.last_activity_at < now() - make_interval(mins => setting_int('session.idle_timeout_minutes')) THEN 'IDLE_TIMEOUT' END;
  IF v_reason IS NOT NULL THEN
    UPDATE user_session SET ended_at = now(), end_reason = v_reason, ended_by = 'system' WHERE session_id = p_session;
    RETURN false;
  END IF;
  UPDATE user_session SET last_activity_at = now() WHERE session_id = p_session;
  RETURN true;
END $$;

-- The user signs out
CREATE FUNCTION end_session(p_session uuid, p_reason varchar, p_by varchar) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_reason NOT IN ('LOGOUT', 'TERMINATED_BY_ADMIN') THEN RAISE EXCEPTION 'Use LOGOUT or TERMINATED_BY_ADMIN'; END IF;
  UPDATE user_session SET ended_at = now(), end_reason = p_reason, ended_by = p_by WHERE session_id = p_session AND ended_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session % is not open', p_session; END IF;
  IF p_reason = 'TERMINATED_BY_ADMIN' THEN
    PERFORM write_audit('Session Terminated', 'Administration', p_session::text, 'ACTIVE', 'TERMINATED');
  END IF;
END $$;

-- Housekeeping (every few minutes): closes timed-out and idle sessions. Returns how many ended.
CREATE FUNCTION expire_sessions() RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer; m integer;
BEGIN
  UPDATE user_session SET ended_at = now(), end_reason = 'TIMEOUT', ended_by = 'system'
   WHERE ended_at IS NULL AND started_at < now() - make_interval(mins => setting_int('session.timeout_minutes'));
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE user_session SET ended_at = now(), end_reason = 'IDLE_TIMEOUT', ended_by = 'system'
   WHERE ended_at IS NULL AND last_activity_at < now() - make_interval(mins => setting_int('session.idle_timeout_minutes'));
  GET DIAGNOSTICS m = ROW_COUNT;
  RETURN n + m;
END $$;

-- Sign-in attempts (successful and failed). With TML SSO most failures happen at SSO; the portal records what it sees.
CREATE TABLE login_attempt (
  attempt_id       bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id          varchar(60)  REFERENCES app_user ON DELETE CASCADE,   -- NULL when the name did not match a user
  login_name       varchar(200),
  ip_address       inet,
  device_id        varchar(60)  REFERENCES user_device ON DELETE SET NULL,
  succeeded        boolean      NOT NULL,
  failure_reason   varchar(100),
  attempted_at     timestamptz  NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR login_name IS NOT NULL),
  CHECK (succeeded OR failure_reason IS NOT NULL)
);
CREATE INDEX login_attempt_user ON login_attempt (user_id, attempted_at DESC);

-- A failed sign-in. After the configured number of failures in a row the account is locked for the configured time,
-- the sessions end, the TML admins are notified and the audit is written. Returns true when this attempt locked the account.
CREATE FUNCTION record_login_failure(p_user varchar, p_ip inet, p_reason varchar) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE u app_user%ROWTYPE; v_fails integer; v_max integer; v_minutes integer;
BEGIN
  SELECT * INTO u FROM app_user WHERE user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO login_attempt (login_name, ip_address, succeeded, failure_reason) VALUES (p_user, p_ip, false, coalesce(p_reason, 'Unknown user'));
    RETURN false;
  END IF;
  INSERT INTO login_attempt (user_id, ip_address, succeeded, failure_reason) VALUES (p_user, p_ip, false, coalesce(p_reason, 'Failed'));
  IF u.status <> 'ACTIVE' THEN RETURN false; END IF;
  v_max := coalesce(setting_int('security.max_login_attempts'), 5);
  v_minutes := coalesce(setting_int('security.account_lock_minutes'), 30);
  -- Failures while the account is not ACTIVE (already locked, suspended) are recorded above but do not count
  UPDATE app_user SET failed_login_count = failed_login_count + 1 WHERE user_id = p_user RETURNING failed_login_count INTO v_fails;
  IF v_fails < v_max THEN RETURN false; END IF;
  UPDATE app_user SET status = 'LOCKED', locked_until = now() + make_interval(mins => v_minutes),
                      lock_reason = format('%s failed sign-in attempts', v_fails), updated_at = now()
   WHERE user_id = p_user;
  PERFORM write_audit('Account Locked', 'Administration', p_user, 'ACTIVE', format('LOCKED for %s min after %s failed attempts', v_minutes, v_fails), 'WARNING');
  INSERT INTO notification (recipient_role, type, title, message, target_path)
  VALUES ('TML_ADMIN', 'SECURITY', 'Account locked', format('%s was locked after %s failed sign-in attempts.', p_user, v_fails), '/admin/users?user=' || p_user);
  RETURN true;
END $$;

-- SSO reports a password change: all sessions end when the setting says so
CREATE FUNCTION record_password_change(p_user varchar) RETURNS integer LANGUAGE plpgsql AS $$
BEGIN
  UPDATE app_user SET password_changed_at = now(), updated_at = now() WHERE user_id = p_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown user %', p_user; END IF;
  IF coalesce(setting_bool('session.force_logout_on_password_change'), true) THEN
    RETURN end_sessions_where('user', p_user, 'PASSWORD_CHANGED', 'system');
  END IF;
  RETURN 0;
END $$;

-- When an admin suspends, locks or deactivates a user, the user's sessions end at once
CREATE FUNCTION app_user_status_sessions() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('SUSPENDED', 'LOCKED', 'INACTIVE') THEN
    PERFORM end_sessions_where('user', NEW.user_id,
      CASE NEW.status WHEN 'SUSPENDED' THEN 'USER_SUSPENDED' WHEN 'LOCKED' THEN 'USER_LOCKED' ELSE 'USER_INACTIVE' END,
      coalesce(nullif(current_setting('app.user_id', true), ''), 'system'));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER app_user_status_ends_sessions AFTER UPDATE OF status ON app_user FOR EACH ROW EXECUTE FUNCTION app_user_status_sessions();

-- Housekeeping: removes ended sessions and sign-in attempts older than the retention setting. Returns rows removed.
CREATE FUNCTION purge_session_history() RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer; m integer; v_days integer := coalesce(setting_int('session.history_retention_days'), 180);
BEGIN
  DELETE FROM user_session WHERE ended_at < now() - make_interval(days => v_days);
  GET DIAGNOSTICS n = ROW_COUNT;
  DELETE FROM login_attempt WHERE attempted_at < now() - make_interval(days => v_days);
  GET DIAGNOSTICS m = ROW_COUNT;
  RETURN n + m;
END $$;

-- Dealer Admins see only their own dealer's people (same rule as master_record in part 1)
ALTER TABLE user_session ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_session_dealer_scope ON user_session
  USING (coalesce(current_setting('app.dealer_code', true), '') = ''
         OR user_id IN (SELECT user_id FROM app_user WHERE dealer_code = current_setting('app.dealer_code', true)));
ALTER TABLE user_device ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_device_dealer_scope ON user_device
  USING (coalesce(current_setting('app.dealer_code', true), '') = ''
         OR user_id IN (SELECT user_id FROM app_user WHERE dealer_code = current_setting('app.dealer_code', true)));
ALTER TABLE login_attempt ENABLE ROW LEVEL SECURITY;
CREATE POLICY login_attempt_dealer_scope ON login_attempt
  USING (coalesce(current_setting('app.dealer_code', true), '') = ''
         OR user_id IN (SELECT user_id FROM app_user WHERE dealer_code = current_setting('app.dealer_code', true)));

-- -----------------------------------------------------------------------------
-- 5. Default Views (Admin Portal → Default Views, TML admin only)
-- -----------------------------------------------------------------------------
-- Per role: which landing cards, header tabs and list columns a user starts with. Users personalise for their own session
-- only; at logout the defaults come back (BU decision, 6 Oct 2026). Personal layouts are therefore NOT stored here.
--
-- The catalogue: everything a default view can refer to. A release that adds a card, tab, list or column adds a row.
CREATE TABLE ui_card (
  card_id          varchar(40)  PRIMARY KEY,                 -- the module code, e.g. jc_creation
  label            varchar(120) NOT NULL,
  display_order    integer      NOT NULL,
  is_active        boolean      NOT NULL DEFAULT true
);
CREATE TABLE ui_tab (
  tab_id           varchar(40)  PRIMARY KEY,                 -- e.g. gate_in
  label            varchar(120) NOT NULL,
  display_order    integer      NOT NULL,
  is_active        boolean      NOT NULL DEFAULT true
);
CREATE TABLE ui_list (
  list_id          varchar(40)  PRIMARY KEY,                 -- e.g. gate_in, journey_search
  label            varchar(120) NOT NULL,
  is_active        boolean      NOT NULL DEFAULT true
);
CREATE TABLE ui_list_column (
  list_id          varchar(40)  NOT NULL REFERENCES ui_list,
  column_key       varchar(40)  NOT NULL,
  label            varchar(120) NOT NULL,
  display_order    integer      NOT NULL,
  is_pii           boolean      NOT NULL DEFAULT false,      -- customer name / phone: shown masked unless the role may unmask (DPDP)
  is_active        boolean      NOT NULL DEFAULT true,
  PRIMARY KEY (list_id, column_key)
);

-- One policy per role; role_id '*' is the default for every role without its own policy
CREATE TABLE default_view_policy (
  role_id          varchar(40)  PRIMARY KEY,
  landing_tab_id   varchar(40)  NOT NULL REFERENCES ui_tab,
  version          integer      NOT NULL DEFAULT 1,
  updated_at       timestamptz  NOT NULL DEFAULT now(),
  updated_by       varchar(60)  NOT NULL
);
CREATE TABLE default_view_card (
  role_id          varchar(40)  NOT NULL REFERENCES default_view_policy ON DELETE CASCADE,
  card_id          varchar(40)  NOT NULL REFERENCES ui_card,
  display_order    integer      NOT NULL,
  is_hidden        boolean      NOT NULL DEFAULT false,      -- allowed but hidden until the user shows it
  PRIMARY KEY (role_id, card_id)
);
CREATE TABLE default_view_tab (
  role_id          varchar(40)  NOT NULL REFERENCES default_view_policy ON DELETE CASCADE,
  tab_id           varchar(40)  NOT NULL REFERENCES ui_tab,
  display_order    integer      NOT NULL,
  is_hidden        boolean      NOT NULL DEFAULT false,
  PRIMARY KEY (role_id, tab_id)
);
-- A card or tab that has no row for the role is not allowed for that role: it never appears, not even under "More".
CREATE TABLE default_view_column (
  role_id          varchar(40)  NOT NULL REFERENCES default_view_policy ON DELETE CASCADE,
  list_id          varchar(40)  NOT NULL,
  column_key       varchar(40)  NOT NULL,
  state            varchar(12)  NOT NULL CHECK (state IN ('PINNED_LEFT', 'VISIBLE', 'PINNED_RIGHT', 'HIDDEN')),
  display_order    integer      NOT NULL,
  PRIMARY KEY (role_id, list_id, column_key),
  FOREIGN KEY (list_id, column_key) REFERENCES ui_list_column
);

-- Every saved version of a role's default view (append-only), as the same document the API sends
CREATE TABLE default_view_history (
  history_id       bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role_id          varchar(40)  NOT NULL,
  version          integer      NOT NULL,
  policy           jsonb        NOT NULL,                    -- NULL-free snapshot; a reset is stored as {"reset": true}
  reason           varchar(300),
  changed_by       varchar(60)  NOT NULL,
  changed_at       timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (role_id, version)
);
CREATE TRIGGER default_view_history_no_change BEFORE UPDATE OR DELETE ON default_view_history
  FOR EACH ROW EXECUTE FUNCTION history_append_only();

-- The role must exist (except the '*' default)
CREATE FUNCTION default_view_role_check() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role_id <> '*' AND NOT EXISTS (SELECT 1 FROM app_role WHERE role_id = NEW.role_id) THEN
    RAISE EXCEPTION 'Unknown role %', NEW.role_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER default_view_policy_role BEFORE INSERT OR UPDATE ON default_view_policy FOR EACH ROW EXECUTE FUNCTION default_view_role_check();

-- Smallest number of visible header tabs (same rule as the portal: MIN_VISIBLE_TABS)
CREATE FUNCTION default_view_min_visible_tabs() RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT 2 $$;

-- Saves a role's default view in one go, from the same document the Default Views screen edits:
--   {"cards":   {"allowed": [...], "order": [...], "hidden": [...]},
--    "tabs":    {"allowed": [...], "order": [...], "hidden": [...], "landing": "gate_in"},
--    "columns": {"gate_in": {"visible": [...], "hidden": [...], "pinnedLeft": [...], "pinnedRight": [...]}, ...}}
-- "order" may list fewer items than "allowed" (the rest follow in catalogue order). Lists not given in "columns" use the '*'
-- default. Everything is checked first; nothing is written if one rule fails. Returns the new version.
CREATE FUNCTION save_default_view(p_role varchar, p_policy jsonb, p_user varchar, p_reason varchar DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  v_cards text[]; v_card_order text[]; v_card_hidden text[];
  v_tabs text[];  v_tab_order text[];  v_tab_hidden text[]; v_landing text;
  v_list text; v_cols jsonb; v_vis text[]; v_hid text[]; v_pl text[]; v_pr text[]; v_all text[];
  v_bad text; v_version integer; v_had_own boolean;
BEGIN
  IF p_role <> '*' AND NOT EXISTS (SELECT 1 FROM app_role WHERE role_id = p_role) THEN RAISE EXCEPTION 'Unknown role %', p_role; END IF;
  IF coalesce(jsonb_typeof(p_policy -> 'cards'), '') <> 'object' OR coalesce(jsonb_typeof(p_policy -> 'tabs'), '') <> 'object' THEN
    RAISE EXCEPTION 'A default view needs "cards" and "tabs"';
  END IF;

  -- Cards
  v_cards       := ARRAY(SELECT jsonb_array_elements_text(coalesce(p_policy #> '{cards,allowed}', '[]')));
  v_card_order  := ARRAY(SELECT jsonb_array_elements_text(coalesce(p_policy #> '{cards,order}', '[]')));
  v_card_hidden := ARRAY(SELECT jsonb_array_elements_text(coalesce(p_policy #> '{cards,hidden}', '[]')));
  IF cardinality(v_cards) = 0 THEN RAISE EXCEPTION 'At least one landing card must be allowed'; END IF;
  IF cardinality(v_cards) <> (SELECT count(DISTINCT x) FROM unnest(v_cards) x) THEN RAISE EXCEPTION 'A landing card is listed twice'; END IF;
  SELECT string_agg(x, ', ') INTO v_bad FROM unnest(v_cards) x WHERE x NOT IN (SELECT card_id FROM ui_card WHERE is_active);
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Unknown landing card(s): %', v_bad; END IF;
  SELECT string_agg(x, ', ') INTO v_bad FROM unnest(v_card_order || v_card_hidden) x WHERE x <> ALL (v_cards);
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Card(s) ordered or hidden but not allowed: %', v_bad; END IF;
  IF NOT EXISTS (SELECT 1 FROM unnest(v_cards) x WHERE x <> ALL (v_card_hidden)) THEN RAISE EXCEPTION 'At least one landing card must be visible'; END IF;

  -- Tabs
  v_tabs       := ARRAY(SELECT jsonb_array_elements_text(coalesce(p_policy #> '{tabs,allowed}', '[]')));
  v_tab_order  := ARRAY(SELECT jsonb_array_elements_text(coalesce(p_policy #> '{tabs,order}', '[]')));
  v_tab_hidden := ARRAY(SELECT jsonb_array_elements_text(coalesce(p_policy #> '{tabs,hidden}', '[]')));
  v_landing    := p_policy #>> '{tabs,landing}';
  IF cardinality(v_tabs) = 0 THEN RAISE EXCEPTION 'At least one header tab must be allowed'; END IF;
  IF cardinality(v_tabs) <> (SELECT count(DISTINCT x) FROM unnest(v_tabs) x) THEN RAISE EXCEPTION 'A header tab is listed twice'; END IF;
  SELECT string_agg(x, ', ') INTO v_bad FROM unnest(v_tabs) x WHERE x NOT IN (SELECT tab_id FROM ui_tab WHERE is_active);
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Unknown header tab(s): %', v_bad; END IF;
  SELECT string_agg(x, ', ') INTO v_bad FROM unnest(v_tab_order || v_tab_hidden) x WHERE x <> ALL (v_tabs);
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Tab(s) ordered or hidden but not allowed: %', v_bad; END IF;
  IF (SELECT count(*) FROM unnest(v_tabs) x WHERE x <> ALL (v_tab_hidden)) < least(default_view_min_visible_tabs(), cardinality(v_tabs)) THEN
    RAISE EXCEPTION 'At least % header tabs must be visible', least(default_view_min_visible_tabs(), cardinality(v_tabs));
  END IF;
  IF v_landing IS NULL OR v_landing <> ALL (v_tabs) OR v_landing = ANY (v_tab_hidden) THEN
    RAISE EXCEPTION 'The landing tab must be one of the visible allowed tabs';
  END IF;

  -- Columns (each list given)
  FOR v_list, v_cols IN SELECT key, value FROM jsonb_each(coalesce(p_policy -> 'columns', '{}')) LOOP
    IF NOT EXISTS (SELECT 1 FROM ui_list WHERE list_id = v_list AND is_active) THEN RAISE EXCEPTION 'Unknown list %', v_list; END IF;
    v_vis := ARRAY(SELECT jsonb_array_elements_text(coalesce(v_cols -> 'visible', '[]')));
    v_hid := ARRAY(SELECT jsonb_array_elements_text(coalesce(v_cols -> 'hidden', '[]')));
    v_pl  := ARRAY(SELECT jsonb_array_elements_text(coalesce(v_cols -> 'pinnedLeft', '[]')));
    v_pr  := ARRAY(SELECT jsonb_array_elements_text(coalesce(v_cols -> 'pinnedRight', '[]')));
    v_all := ARRAY(SELECT column_key FROM ui_list_column WHERE list_id = v_list AND is_active);
    SELECT string_agg(x, ', ') INTO v_bad FROM unnest(v_vis || v_hid || v_pl || v_pr) x WHERE x <> ALL (v_all);
    IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Unknown column(s) in list %: %', v_list, v_bad; END IF;
    IF cardinality(v_vis) = 0 THEN RAISE EXCEPTION 'List % needs at least one visible column', v_list; END IF;
    IF cardinality(v_vis) <> (SELECT count(DISTINCT x) FROM unnest(v_vis) x) THEN RAISE EXCEPTION 'A column is listed twice in list %', v_list; END IF;
    SELECT string_agg(x, ', ') INTO v_bad FROM unnest(v_vis) x WHERE x = ANY (v_hid);
    IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Column(s) both visible and hidden in list %: %', v_list, v_bad; END IF;
    SELECT string_agg(x, ', ') INTO v_bad FROM unnest(v_pl || v_pr) x WHERE x <> ALL (v_vis);
    IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Pinned column(s) must be visible in list %: %', v_list, v_bad; END IF;
    SELECT string_agg(x, ', ') INTO v_bad FROM unnest(v_pl) x WHERE x = ANY (v_pr);
    IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Column(s) pinned both left and right in list %: %', v_list, v_bad; END IF;
  END LOOP;

  -- All checks passed: replace the role's rows
  -- Versions keep counting across resets, so every saved version stays unique in the history
  PERFORM 1 FROM default_view_policy WHERE role_id = p_role FOR UPDATE;
  v_had_own := FOUND;
  v_version := coalesce((SELECT max(version) FROM default_view_history WHERE role_id = p_role), 0) + 1;
  DELETE FROM default_view_policy WHERE role_id = p_role;
  INSERT INTO default_view_policy (role_id, landing_tab_id, version, updated_by) VALUES (p_role, v_landing, v_version, p_user);

  INSERT INTO default_view_card (role_id, card_id, display_order, is_hidden)
  SELECT p_role, c, row_number() OVER (ORDER BY coalesce(array_position(v_card_order, c), 1000 + (SELECT display_order FROM ui_card WHERE card_id = c))),
         c = ANY (v_card_hidden)
    FROM unnest(v_cards) c;
  INSERT INTO default_view_tab (role_id, tab_id, display_order, is_hidden)
  SELECT p_role, t, row_number() OVER (ORDER BY coalesce(array_position(v_tab_order, t), 1000 + (SELECT display_order FROM ui_tab WHERE tab_id = t))),
         t = ANY (v_tab_hidden)
    FROM unnest(v_tabs) t;

  FOR v_list, v_cols IN SELECT key, value FROM jsonb_each(coalesce(p_policy -> 'columns', '{}')) LOOP
    v_vis := ARRAY(SELECT jsonb_array_elements_text(v_cols -> 'visible'));
    v_pl  := ARRAY(SELECT jsonb_array_elements_text(coalesce(v_cols -> 'pinnedLeft', '[]')));
    v_pr  := ARRAY(SELECT jsonb_array_elements_text(coalesce(v_cols -> 'pinnedRight', '[]')));
    -- visible columns in the given order; every other column of the list is hidden, in catalogue order
    INSERT INTO default_view_column (role_id, list_id, column_key, state, display_order)
    SELECT p_role, v_list, c.column_key,
           CASE WHEN c.column_key = ANY (v_pl) THEN 'PINNED_LEFT' WHEN c.column_key = ANY (v_pr) THEN 'PINNED_RIGHT'
                WHEN c.column_key = ANY (v_vis) THEN 'VISIBLE' ELSE 'HIDDEN' END,
           row_number() OVER (ORDER BY coalesce(array_position(v_vis, c.column_key), 1000 + c.display_order))
      FROM ui_list_column c WHERE c.list_id = v_list AND c.is_active;
  END LOOP;

  INSERT INTO default_view_history (role_id, version, policy, reason, changed_by) VALUES (p_role, v_version, effective_default_view(p_role), p_reason, p_user);
  PERFORM write_audit('Default Views Updated', 'Administration', 'Default view of role ' || p_role,
                      CASE WHEN v_had_own THEN 'version ' || (v_version - 1) END, 'version ' || v_version);
  RETURN v_version;
END $$;

-- Back to the '*' default for a role (its own policy is removed; history keeps it)
CREATE FUNCTION reset_default_view(p_role varchar, p_user varchar, p_reason varchar DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_version integer;
BEGIN
  IF p_role = '*' THEN RAISE EXCEPTION 'The default for all roles cannot be removed; change it instead'; END IF;
  SELECT version INTO v_version FROM default_view_policy WHERE role_id = p_role FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Role % already uses the default view', p_role; END IF;
  DELETE FROM default_view_policy WHERE role_id = p_role;
  INSERT INTO default_view_history (role_id, version, policy, reason, changed_by) VALUES (p_role, v_version + 1, '{"reset": true}', p_reason, p_user);
  PERFORM write_audit('Default Views Reset', 'Administration', 'Default view of role ' || p_role, 'version ' || v_version, 'uses the default for all roles');
END $$;

-- What a user of a role starts with, as one document: the role's own policy, else '*'; per list, the role's columns,
-- else the '*' columns, else the catalogue. Only active catalogue items are returned.
CREATE FUNCTION effective_default_view(p_role varchar) RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE v_src varchar(40); v_landing varchar(40); v_cards jsonb; v_tabs jsonb; v_cols jsonb;
BEGIN
  SELECT role_id, landing_tab_id INTO v_src, v_landing FROM default_view_policy WHERE role_id = p_role;
  IF NOT FOUND THEN SELECT role_id, landing_tab_id INTO v_src, v_landing FROM default_view_policy WHERE role_id = '*'; END IF;
  IF v_src IS NULL THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
           'allowed', coalesce(jsonb_agg(c.card_id ORDER BY c.display_order), '[]'),
           'order',   coalesce(jsonb_agg(c.card_id ORDER BY c.display_order), '[]'),
           'hidden',  coalesce(jsonb_agg(c.card_id ORDER BY c.display_order) FILTER (WHERE c.is_hidden), '[]'))
    INTO v_cards
    FROM default_view_card c JOIN ui_card u ON u.card_id = c.card_id AND u.is_active WHERE c.role_id = v_src;
  SELECT jsonb_build_object(
           'allowed', coalesce(jsonb_agg(t.tab_id ORDER BY t.display_order), '[]'),
           'order',   coalesce(jsonb_agg(t.tab_id ORDER BY t.display_order), '[]'),
           'hidden',  coalesce(jsonb_agg(t.tab_id ORDER BY t.display_order) FILTER (WHERE t.is_hidden), '[]'),
           'landing', v_landing)
    INTO v_tabs
    FROM default_view_tab t JOIN ui_tab u ON u.tab_id = t.tab_id AND u.is_active WHERE t.role_id = v_src;

  SELECT coalesce(jsonb_object_agg(l.list_id, cols), '{}') INTO v_cols
    FROM ui_list l
    CROSS JOIN LATERAL (
      SELECT coalesce(
        (SELECT r FROM (VALUES (p_role), ('*')) AS src(rid)
           CROSS JOIN LATERAL (
             SELECT CASE WHEN count(*) = 0 THEN NULL ELSE jsonb_build_object(
                      'visible',     coalesce(jsonb_agg(c.column_key ORDER BY c.display_order) FILTER (WHERE c.state <> 'HIDDEN'), '[]'),
                      'hidden',      coalesce(jsonb_agg(c.column_key ORDER BY c.display_order) FILTER (WHERE c.state = 'HIDDEN'), '[]'),
                      'pinnedLeft',  coalesce(jsonb_agg(c.column_key ORDER BY c.display_order) FILTER (WHERE c.state = 'PINNED_LEFT'), '[]'),
                      'pinnedRight', coalesce(jsonb_agg(c.column_key ORDER BY c.display_order) FILTER (WHERE c.state = 'PINNED_RIGHT'), '[]')) END AS r
               FROM default_view_column c JOIN ui_list_column u ON u.list_id = c.list_id AND u.column_key = c.column_key AND u.is_active
              WHERE c.role_id = src.rid AND c.list_id = l.list_id
           ) x
          WHERE r IS NOT NULL
          ORDER BY src.rid = '*' LIMIT 1),
        (SELECT jsonb_build_object('visible', jsonb_agg(column_key ORDER BY display_order), 'hidden', '[]'::jsonb, 'pinnedLeft', '[]'::jsonb, 'pinnedRight', '[]'::jsonb)
           FROM ui_list_column WHERE list_id = l.list_id AND is_active)) AS cols
    ) z
   WHERE l.is_active;

  RETURN jsonb_build_object('role', p_role, 'source', v_src, 'cards', v_cards, 'tabs', v_tabs, 'columns', v_cols);
END $$;

-- The catalogue as the portal has it today (cards = the 12 module cards; tabs = the workshop header tabs; lists and columns
-- = the worklists and TML Journey Search). Product data, not business data.
INSERT INTO ui_card (card_id, label, display_order) VALUES
  ('appointment', 'Appointment Reminder', 1), ('reception', 'Pickup & Drop - Admin / Driver App', 2), ('receptionist', 'Receptionist', 3),
  ('security', 'Security Guard', 4), ('jc_creation', 'JC Creation- Mechanical', 5), ('bodyshop', 'JC Creation- Bodyshop', 6),
  ('jc_tracking', 'JC Tracking', 7), ('eqc', 'eQC / Washing', 8), ('thd', 'THD', 9), ('spd', 'SPD', 10),
  ('claim', 'Auth. Request Approval & Service Claims', 11), ('customer_journey', 'Customer Journey & Dealer Network', 12);
INSERT INTO ui_tab (tab_id, label, display_order) VALUES
  ('gate_in', 'Today''s Total Gate-In', 1), ('my_assignment', 'My Assignment', 2), ('pre_inspection', 'Pre Inspection', 3),
  ('estimate_approvals', 'Pending Estimate Approvals', 4), ('active_job_cards', 'My Active Job Cards', 5), ('mr_details', 'MR Details', 6),
  ('thd', 'THD', 7), ('additional_jobs', 'Additional Jobs & Parts', 8), ('quality_inspection', 'Quality Inspection', 9);
INSERT INTO ui_list (list_id, label) VALUES
  ('gate_in', 'Today''s Total Gate-In'), ('my_assignment', 'My Assignment'), ('mr_details', 'MR Details'), ('journey_search', 'TML Journey Search');
INSERT INTO ui_list_column (list_id, column_key, label, display_order, is_pii) VALUES
  ('gate_in', 'action', 'Action', 1, false), ('gate_in', 'vehicleNo', 'Vehicle No.', 2, false), ('gate_in', 'model', 'Model', 3, false),
  ('gate_in', 'assignedSa', 'Assigned SA', 4, false), ('gate_in', 'customerName', 'Customer Name', 5, true), ('gate_in', 'maskedPhone', 'Phone No.', 6, true),
  ('gate_in', 'customerType', 'Customer Type', 7, false), ('gate_in', 'customerSeverity', 'Customer Severity', 8, false), ('gate_in', 'revisit', 'Revisit', 9, false),
  ('gate_in', 'criticalCustomer', 'Critical Customer', 10, false), ('gate_in', 'status', 'Status', 11, false), ('gate_in', 'waitingTime', 'Waiting Time (HH:MM)', 12, false),
  ('gate_in', 'workshopElapsed', 'Workshop Elapsed Time', 13, false), ('gate_in', 'appointmentId', 'Appointment ID', 14, false),
  ('my_assignment', 'action', 'Action', 1, false), ('my_assignment', 'vehicleNo', 'Vehicle No.', 2, false), ('my_assignment', 'model', 'Model', 3, false),
  ('my_assignment', 'customerName', 'Customer Name', 4, true), ('my_assignment', 'maskedPhone', 'Phone No.', 5, true), ('my_assignment', 'customerType', 'Customer Type', 6, false),
  ('my_assignment', 'customerSeverity', 'Customer Severity', 7, false), ('my_assignment', 'revisit', 'Revisit', 8, false), ('my_assignment', 'criticalCustomer', 'Critical Customer', 9, false),
  ('my_assignment', 'status', 'Status', 10, false), ('my_assignment', 'stageAging', 'Stage Aging (HH:MM)', 11, false), ('my_assignment', 'workshopElapsed', 'Workshop Elapsed Time', 12, false),
  ('my_assignment', 'visitorType', 'Visitor Type', 13, false), ('my_assignment', 'vehicleType', 'Vehicle Type', 14, false),
  ('mr_details', 'action', 'Action', 1, false), ('mr_details', 'requestId', 'Request ID', 2, false), ('mr_details', 'jcNo', 'JC No.', 3, false),
  ('mr_details', 'vehicleNo', 'Vehicle No.', 4, false), ('mr_details', 'status', 'Status', 5, false), ('mr_details', 'requestDateTime', 'Request Date & Time', 6, false),
  ('mr_details', 'stageAging', 'Stage Ageing DD:HH:MM', 7, false), ('mr_details', 'assignedTo', 'Assigned To', 8, false),
  ('journey_search', 'vehicle', 'Vehicle', 1, false), ('journey_search', 'customer', 'Customer', 2, true), ('journey_search', 'jcNumber', 'JC Number', 3, false),
  ('journey_search', 'dealer', 'Dealer & Workshop', 4, false), ('journey_search', 'stage', 'Current Stage', 5, false), ('journey_search', 'status', 'Status', 6, false),
  ('journey_search', 'updated', 'Last Updated', 7, false), ('journey_search', 'action', 'Action', 8, false);

-- The default for all roles: the portal's built-in "generic" policy (all cards, all tabs, Gate-In first, lean columns)
SELECT save_default_view('*', $json${
  "cards": {"allowed": ["appointment","reception","receptionist","security","jc_creation","bodyshop","jc_tracking","eqc","thd","spd","claim","customer_journey"]},
  "tabs":  {"allowed": ["gate_in","my_assignment","pre_inspection","estimate_approvals","active_job_cards","mr_details","thd","additional_jobs","quality_inspection"], "landing": "gate_in"},
  "columns": {
    "gate_in":        {"visible": ["vehicleNo","model","assignedSa","status","waitingTime","action"], "pinnedLeft": ["vehicleNo"], "pinnedRight": ["action"]},
    "my_assignment":  {"visible": ["action","vehicleNo","model","customerName","maskedPhone","status","stageAging","vehicleType"], "pinnedLeft": ["action","vehicleNo"]},
    "journey_search": {"visible": ["vehicle","customer","jcNumber","stage","status","action"], "pinnedLeft": ["vehicle"], "pinnedRight": ["action"]},
    "mr_details":     {"visible": ["action","requestId","jcNo","vehicleNo","status","stageAging","assignedTo"], "pinnedLeft": ["action","requestId"]}
  }}$json$::jsonb, 'system', 'Built-in default (portal "generic" policy)');

-- -----------------------------------------------------------------------------
-- 6. Audit coverage: every action the portal and the database write, so nothing is missed or written twice
-- -----------------------------------------------------------------------------
CREATE TABLE audit_action_catalog (
  action           varchar(100) PRIMARY KEY,
  module           varchar(60)  NOT NULL,
  description      varchar(300) NOT NULL,
  written_by       varchar(3)   NOT NULL CHECK (written_by IN ('APP', 'DB')),   -- DB: written by this database; the API must not write it again
  is_security      boolean      NOT NULL DEFAULT false,                         -- shown in the security review of the Audit Log
  is_dpdp          boolean      NOT NULL DEFAULT false                          -- personal-data access (DPDP access log)
);
INSERT INTO audit_action_catalog (action, module, description, written_by, is_security, is_dpdp) VALUES
  -- written by this database (part 3)
  ('Configuration Changed',      'Administration',  'A system setting changed (old and new value).',                         'DB',  true,  false),
  ('Device Registered',          'Administration',  'A device was seen for the first time (PENDING or ACTIVE).',              'DB',  true,  false),
  ('Device Approved',            'Administration',  'An admin approved a pending device.',                                     'DB',  true,  false),
  ('Device Blocked',             'Administration',  'An admin blocked a device (its sessions end).',                           'DB',  true,  false),
  ('Device Unblocked',           'Administration',  'An admin unblocked a device.',                                            'DB',  true,  false),
  ('Device Deactivated',         'Administration',  'An admin deactivated a device (its sessions end).',                       'DB',  true,  false),
  ('Device Reactivated',         'Administration',  'An admin reactivated a device.',                                          'DB',  true,  false),
  ('Session Terminated',         'Administration',  'An admin ended a session or the sessions of a user / device.',            'DB',  true,  false),
  ('Session Terminated All',     'Administration',  'An admin ended all sessions except their own.',                           'DB',  true,  false),
  ('Sessions Ended',             'Administration',  'Sessions ended because a device was blocked, a user was suspended / locked / deactivated, or a password changed.', 'DB', true, false),
  ('Account Locked',             'Administration',  'Locked automatically after too many failed sign-ins.',                    'DB',  true,  false),
  ('Account Unlocked',           'Administration',  'An automatic lock expired and was lifted at the next sign-in.',                          'DB',  true,  false),
  ('Default Views Updated',      'Administration',  'The default view of a role was saved (new version).',                     'DB',  false, false),
  ('Default Views Reset',        'Administration',  'A role went back to the default view for all roles.',                     'DB',  false, false),
  -- written by the API (the portal writes these today)
  ('User Created',               'Administration',  'A user was created.',                                                     'APP', true,  false),
  ('User Updated',               'Administration',  'A user''s role or status changed.',                                       'APP', true,  false),
  ('User Suspended',             'Administration',  'A user was suspended.',                                                   'APP', true,  false),
  ('User Activated',             'Administration',  'A user was activated.',                                                   'APP', true,  false),
  ('Role Updated',               'Administration',  'A role changed.',                                                         'APP', true,  false),
  ('Permissions Matrix Saved',   'Administration',  'Module permissions of roles were saved.',                                 'APP', true,  false),
  ('Role Permissions Reset',     'Administration',  'Role permissions went back to the defaults.',                             'APP', true,  false),
  ('Employee Profile Updated',   'Administration',  'Employment details of an employee changed.',                              'APP', false, false),
  ('Employee Skills Updated',    'Administration',  'Skills or certificates of an employee changed.',                          'APP', false, false),
  ('UNMASK_PII',                 'DPDP',            'A user revealed a masked customer name or phone number.',                 'APP', true,  true),
  ('CTI_CALL',                   'DPDP',            'A user called a customer from the portal.',                               'APP', true,  true),
  ('EXPORT_WORKLIST',            'DPDP',            'A worklist with customer data was exported.',                             'APP', true,  true),
  ('Rule Added',                 'Masters',         'A no-code rule was added to a master.',                                   'APP', false, false),
  ('Rule Changed',               'Masters',         'A no-code rule of a master changed.',                                     'APP', false, false),
  ('Rule Deleted',               'Masters',         'A no-code rule was removed.',                                             'APP', false, false),
  ('LOV Saved',                  'Masters',         'A list of values was saved.',                                             'APP', false, false),
  ('Master Data Bulk Edit',      'Masters',         'Several rows of a master changed at once.',                               'APP', false, false),
  ('Master Data Bulk Delete',    'Masters',         'Several rows of a master were removed at once.',                          'APP', false, false),
  ('Master Data Batch Undo',     'Masters',         'A batch change of a master was undone.',                                  'APP', false, false),
  ('Master Data Batch Rollback', 'Masters',         'A batch change of a master was rolled back.',                             'APP', false, false),
  ('Master Data Exported',       'Masters',         'A master was exported.',                                                  'APP', false, false),
  ('Bulk Parameter Records Uploaded', 'Masters',    'Rows were uploaded into a master.',                                       'APP', false, false),
  ('Field Mapping Configured',   'Masters',         'How a master field is shown in the dealer app changed.',                  'APP', false, false),
  ('Masters Exported for Publishing', 'Masters',    'All masters were saved for publishing.',                                  'APP', false, false),
  ('Master Changes Exported',    'Masters',         'A user exported their changed master rows for review.',                   'APP', false, false),
  ('Bodyshop Master Factory Reset', 'Masters',      'The Bodyshop master went back to the shipped content.',                   'APP', false, false),
  ('Fleet List Uploaded',        'Fleet Register',  'The fleet list was uploaded.',                                            'APP', false, false),
  ('Fleet List Exported',        'Fleet Register',  'The fleet list was exported.',                                            'APP', false, false),
  ('Fleet Vehicle Activated',    'Fleet Register',  'A fleet chassis was activated.',                                          'APP', false, false),
  ('Fleet Vehicle Deactivated',  'Fleet Register',  'A fleet chassis was deactivated.',                                        'APP', false, false),
  ('Fleet Vehicle Removed',      'Fleet Register',  'A fleet chassis was removed.',                                            'APP', false, false),
  ('Fleet Upload Privilege Changed', 'Fleet Register', 'Which roles may upload the fleet list changed.',                       'APP', true,  false),
  ('Approval Requested',         'Bay Management',  'A bay change was sent for approval.',                                     'APP', false, false),
  ('Bays Sent for Approval',     'Bay Management',  'Several bays were sent for approval.',                                    'APP', false, false),
  ('Bays Imported',              'Bay Management',  'Bays were imported.',                                                     'APP', false, false),
  ('Bay Status Changed',         'Bay Management',  'The status of a bay changed.',                                            'APP', false, false),
  ('Bay Details Updated',        'Bay Management',  'Details of a bay changed.',                                               'APP', false, false),
  ('Weekly Pattern Updated',     'Holiday Calendar','The weekly working pattern of a division changed.',                        'APP', false, false),
  ('Bulk Holiday Set',           'Holiday Calendar','Holidays were set for several divisions.',                                'APP', false, false);

-- Governance check: actions in the audit log that nobody has catalogued (should always be empty)
CREATE VIEW audit_log_uncatalogued AS
SELECT action, module, count(*) AS occurrences, max(occurred_at) AS last_seen
  FROM audit_log a WHERE NOT EXISTS (SELECT 1 FROM audit_action_catalog c WHERE c.action = a.action)
 GROUP BY action, module;

-- The security review of the Audit Log (security-relevant and DPDP actions only)
CREATE VIEW audit_log_security AS
SELECT a.*, c.is_dpdp FROM audit_log a JOIN audit_action_catalog c ON c.action = a.action WHERE c.is_security;
