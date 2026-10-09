-- =============================================================================
-- TML Service Transformation: masters from CRM and business control
-- Part 2 of the database design. Load AFTER schema.sql:
--   psql -v ON_ERROR_STOP=1 -f docs/backend/schema.sql -f docs/backend/schema_masters_crm.sql
-- Self-checking tests: schema_masters_crm_test.sql.  TEST DATA ONLY in this repository.
--
-- The three kinds of master (mail of 8 Oct 2026):
--   A  CRM master used as it is        source_system = 'CRM',   control_mode = 'NONE'
--   B  new ST master                   source_system = 'ST'     (nothing here changes how B works)
--   C  CRM master + business control   source_system = 'CRM',   control_mode = 'ENABLE_DISABLE' or 'CONFIGURE'
-- Business control is generic: it works for ANY master, so a master that Business asks to control later needs only a
-- setting (control_mode + a policy row), not a new table and not a deployment.
--
-- The one rule that makes it safe: CRM data and business choices live in DIFFERENT places.
--   master_record.crm_*        written only by the CRM sync, read-only for every user
--   master_record.data         what ST users edit (ST-owned fields only)
--   master_control             Business's choices (enabled / disabled / settings) per record and per ST function
-- A CRM refresh therefore can never overwrite a business choice.
-- =============================================================================

SET search_path = admin, public;

-- -----------------------------------------------------------------------------
-- 1. What a master is made of: where it comes from, how it is fetched, who may control it
-- -----------------------------------------------------------------------------
-- Registry of the lists of values (dropdowns) kept in the Common LOV master. A list is either kept in CRM (read-only in ST)
-- or created in ST. ST may add its own extra values to a CRM list only when allow_st_extension is on.
CREATE TABLE lov_type (
  lov_type         varchar(60)  PRIMARY KEY CHECK (lov_type ~ '^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$'),   -- MODULE_FIELD
  module_code      varchar(30)  NOT NULL,
  field_name       varchar(100) NOT NULL,
  source_system    varchar(3)   NOT NULL DEFAULT 'ST' CHECK (source_system IN ('CRM', 'ST')),
  allow_st_extension boolean    NOT NULL DEFAULT false,
  is_active        boolean      NOT NULL DEFAULT true,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  created_by       varchar(60)  NOT NULL,
  CHECK (source_system = 'CRM' OR allow_st_extension = false)
);

ALTER TABLE master_definition
  ADD COLUMN source_system    varchar(5)  NOT NULL DEFAULT 'ST'   CHECK (source_system IN ('ST', 'CRM', 'MIXED')),
  ADD COLUMN sync_mode        varchar(5)  NOT NULL DEFAULT 'NONE' CHECK (sync_mode IN ('NONE', 'API', 'SOLAR')),
  ADD COLUMN control_mode     varchar(14) NOT NULL DEFAULT 'NONE' CHECK (control_mode IN ('NONE', 'ENABLE_DISABLE', 'CONFIGURE')),
  ADD COLUMN allow_st_records boolean     NOT NULL DEFAULT false,   -- CRM master: may ST users add ST-only records?
  ADD COLUMN lov_type_field   varchar(50),                          -- Common LOV master only: the field that holds the list type
  ADD COLUMN lov_code_field   varchar(50),                          -- Common LOV master only: the field that holds the stable value code
  ADD CONSTRAINT master_source_consistent CHECK (
    (source_system = 'ST' AND sync_mode = 'NONE') OR (source_system = 'CRM' AND sync_mode <> 'NONE') OR source_system = 'MIXED');

-- Field level: which side owns each field, and what it points to
ALTER TABLE master_field
  ADD COLUMN source_system varchar(3)  NOT NULL DEFAULT 'ST' CHECK (source_system IN ('CRM', 'ST')),
  ADD COLUMN crm_field     varchar(80),                                          -- name of the field in the CRM feed
  ADD COLUMN ref_master    varchar(31) REFERENCES master_definition,             -- value = record_id of that master (a stable code)
  ADD COLUMN lov_type      varchar(60) REFERENCES lov_type,                      -- value = code of a value of that list
  ADD CONSTRAINT master_field_one_reference CHECK (ref_master IS NULL OR lov_type IS NULL);

-- A record = a CRM part (read-only) + an ST part (editable). ST-owned masters simply have no CRM part.
ALTER TABLE master_record
  ADD COLUMN crm_key       varchar(100),                                         -- the record's key in CRM (record_id = crm_key for CRM records)
  ADD COLUMN crm_data      jsonb CHECK (crm_data IS NULL OR jsonb_typeof(crm_data) = 'object'),
  ADD COLUMN crm_hash      char(32),                                             -- md5 of crm_data: a refresh that brings nothing new writes nothing
  ADD COLUMN crm_synced_at timestamptz,
  ADD COLUMN crm_status    varchar(14) CHECK (crm_status IN ('ACTIVE', 'REMOVED_IN_CRM')),
  ADD COLUMN needs_review  boolean     NOT NULL DEFAULT false,                   -- points at something that no longer exists
  ADD COLUMN review_reason varchar(300),
  ADD CONSTRAINT crm_part_complete CHECK (
    (crm_key IS NULL AND crm_data IS NULL AND crm_hash IS NULL AND crm_status IS NULL)
    OR (crm_key IS NOT NULL AND crm_data IS NOT NULL AND crm_hash IS NOT NULL AND crm_status IS NOT NULL));
CREATE UNIQUE INDEX master_record_crm_key ON master_record (master_id, crm_key) WHERE crm_key IS NOT NULL;
CREATE INDEX master_record_review ON master_record (master_id) WHERE needs_review;

-- History also keeps the CRM part
ALTER TABLE master_record_history ADD COLUMN old_crm_data jsonb, ADD COLUMN new_crm_data jsonb;

CREATE OR REPLACE FUNCTION master_record_track() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_version integer;
  v_master  varchar(31) := coalesce(NEW.master_id, OLD.master_id);
BEGIN
  UPDATE master_definition SET version = version + 1, updated_at = now()
   WHERE master_id = v_master
   RETURNING version INTO v_version;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO master_record_history (master_id, record_id, operation, old_data, new_data, old_crm_data, new_crm_data, master_version, changed_by)
    VALUES (OLD.master_id, OLD.record_id, 'DELETE', OLD.data, NULL, OLD.crm_data, NULL, v_version,
            coalesce(current_setting('app.user_id', true), 'system'));
    RETURN OLD;
  END IF;

  NEW.changed_in_version := v_version;
  IF TG_OP = 'UPDATE' THEN
    NEW.row_version := OLD.row_version + 1;
    NEW.updated_at := now();
  END IF;
  INSERT INTO master_record_history (master_id, record_id, operation, old_data, new_data, old_crm_data, new_crm_data, master_version, changed_by, import_job_id)
  VALUES (NEW.master_id, NEW.record_id, TG_OP,
          CASE WHEN TG_OP = 'UPDATE' THEN OLD.data END, NEW.data,
          CASE WHEN TG_OP = 'UPDATE' THEN OLD.crm_data END, NEW.crm_data,
          v_version, NEW.updated_by,
          nullif(current_setting('app.import_job_id', true), '')::uuid);
  RETURN NEW;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Guard rails on every record write (these fire before master_record_track: trigger names run in alphabetical order)
-- -----------------------------------------------------------------------------
CREATE FUNCTION master_record_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  m        master_definition%ROWTYPE;
  syncing  boolean := coalesce(current_setting('app.sync_run_id', true), '') <> '';
  bad      text;
  lov_t    text;
  lt       lov_type%ROWTYPE;
BEGIN
  SELECT * INTO m FROM master_definition WHERE master_id = NEW.master_id;

  -- 1. The CRM part is written only by the CRM sync.
  IF NOT syncing AND (
       (TG_OP = 'INSERT' AND (NEW.crm_key IS NOT NULL OR NEW.crm_data IS NOT NULL))
    OR (TG_OP = 'UPDATE' AND (NEW.crm_key, NEW.crm_data, NEW.crm_hash, NEW.crm_status) IS DISTINCT FROM (OLD.crm_key, OLD.crm_data, OLD.crm_hash, OLD.crm_status))) THEN
    RAISE EXCEPTION 'The CRM part of a record is read-only: only the CRM sync may change it (master %, record %)', NEW.master_id, NEW.record_id;
  END IF;

  -- 2. A master owned by ST has no CRM part; a CRM master takes ST-only records only when allowed.
  IF m.source_system = 'ST' AND NEW.crm_key IS NOT NULL THEN
    RAISE EXCEPTION 'Master % is owned by ST: its records have no CRM part', NEW.master_id;
  END IF;
  IF m.source_system = 'CRM' AND NEW.crm_key IS NULL AND NOT m.allow_st_records THEN
    RAISE EXCEPTION 'Master % comes from CRM: ST users cannot add records of their own (allow_st_records is off)', NEW.master_id;
  END IF;

  -- 3. Field ownership: ST users edit only ST fields; the sync fills only CRM fields.
  SELECT string_agg(k, ', ') INTO bad
    FROM jsonb_object_keys(NEW.data) k
   WHERE k IN (SELECT field_key FROM master_field WHERE master_id = NEW.master_id AND source_system = 'CRM');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'These fields come from CRM and cannot be edited in ST: %', bad;
  END IF;
  IF NEW.crm_data IS NOT NULL THEN
    SELECT string_agg(k, ', ') INTO bad
      FROM jsonb_object_keys(NEW.crm_data) k
     WHERE k IN (SELECT field_key FROM master_field WHERE master_id = NEW.master_id AND source_system = 'ST');
    IF bad IS NOT NULL THEN
      RAISE EXCEPTION 'These fields belong to ST and cannot be filled from CRM: %', bad;
    END IF;
  END IF;

  -- 4. Lists of values: a CRM list takes only CRM values (unless ST extension is allowed); an ST list takes only ST values.
  IF m.lov_type_field IS NOT NULL THEN
    lov_t := coalesce(NEW.data ->> m.lov_type_field, NEW.crm_data ->> m.lov_type_field);
    SELECT * INTO lt FROM lov_type WHERE lov_type = lov_t;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Unknown list type "%": register it in lov_type first', lov_t;
    END IF;
    IF lt.source_system = 'CRM' AND NEW.crm_key IS NULL AND NOT lt.allow_st_extension THEN
      RAISE EXCEPTION 'List % comes from CRM: ST users cannot add values to it', lov_t;
    END IF;
    IF lt.source_system = 'ST' AND NEW.crm_key IS NOT NULL THEN
      RAISE EXCEPTION 'List % is kept in ST: CRM values cannot be loaded into it', lov_t;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER master_record_crm_guard BEFORE INSERT OR UPDATE ON master_record
  FOR EACH ROW EXECUTE FUNCTION master_record_guard();

-- -----------------------------------------------------------------------------
-- 3. Business control: which records are available in which ST function
-- -----------------------------------------------------------------------------
-- A control scope is something Business can control for: usually an ST function ("EQC_GUIDED_CHECK"), maybe a whole module or
-- a dealer. Scopes are DATA: a new one is a row, not a deployment.
CREATE TABLE control_scope (
  scope_code       varchar(40)  PRIMARY KEY CHECK (scope_code ~ '^[A-Z][A-Z0-9_]*$'),
  scope_type       varchar(10)  NOT NULL DEFAULT 'FUNCTION' CHECK (scope_type IN ('FUNCTION', 'MODULE', 'DEALER', 'GLOBAL')),
  scope_name       varchar(150) NOT NULL,
  module_code      varchar(30),
  description      text,
  is_active        boolean      NOT NULL DEFAULT true,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  created_by       varchar(60)  NOT NULL
);

-- Switching control on for a master and a scope = one policy row.
--   default_state ENABLED  : everything is on, Business switches some records off         (deny-list)
--   default_state DISABLED : everything is off, Business enables the chosen records       (allow-list)
-- In allow-list mode a record that arrives from CRM is stored as PENDING_REVIEW so Business sees what is new.
CREATE TABLE master_control_policy (
  master_id        varchar(31)  NOT NULL REFERENCES master_definition ON DELETE CASCADE,
  scope_code       varchar(40)  NOT NULL REFERENCES control_scope,
  default_state    varchar(8)   NOT NULL DEFAULT 'ENABLED' CHECK (default_state IN ('ENABLED', 'DISABLED')),
  requires_approval boolean     NOT NULL DEFAULT false,                -- a second person must approve a change
  approver_role    varchar(30)  REFERENCES app_role,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  created_by       varchar(60)  NOT NULL,
  PRIMARY KEY (master_id, scope_code),
  CHECK (NOT requires_approval OR approver_role IS NOT NULL)
);

CREATE TABLE master_control (
  master_id        varchar(31)  NOT NULL,
  record_id        varchar(60)  NOT NULL,
  scope_code       varchar(40)  NOT NULL,
  state            varchar(14)  NOT NULL CHECK (state IN ('ENABLED', 'DISABLED', 'PENDING_REVIEW')),
  settings         jsonb        NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(settings) = 'object'),   -- control_mode CONFIGURE: values Business sets per scope
  reason           varchar(300),
  decided_by       varchar(60)  NOT NULL,
  decided_at       timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (master_id, record_id, scope_code),
  FOREIGN KEY (master_id, record_id) REFERENCES master_record ON DELETE CASCADE,
  FOREIGN KEY (master_id, scope_code) REFERENCES master_control_policy ON DELETE CASCADE
);
CREATE INDEX master_control_state ON master_control (master_id, scope_code, state);

-- Every control change, who and why (append-only like the audit log)
CREATE TABLE master_control_history (
  history_id       bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  master_id        varchar(31)  NOT NULL,
  record_id        varchar(60)  NOT NULL,
  scope_code       varchar(40)  NOT NULL,
  old_state        varchar(14),
  new_state        varchar(14),
  old_settings     jsonb,
  new_settings     jsonb,
  reason           varchar(300),
  changed_by       varchar(60)  NOT NULL,
  changed_at       timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX master_control_history_lookup ON master_control_history (master_id, record_id, changed_at DESC);

CREATE FUNCTION master_control_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'master_control_history is append-only'; END $$;
CREATE TRIGGER master_control_history_no_change BEFORE UPDATE OR DELETE ON master_control_history
  FOR EACH ROW EXECUTE FUNCTION master_control_immutable();

-- Optional second pair of eyes: a requested change waits here until someone else approves it.
CREATE TABLE master_control_request (
  request_id       uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id        varchar(31)  NOT NULL,
  record_id        varchar(60)  NOT NULL,
  scope_code       varchar(40)  NOT NULL,
  requested_state  varchar(8)   NOT NULL CHECK (requested_state IN ('ENABLED', 'DISABLED')),
  requested_settings jsonb,
  reason           varchar(300),
  status           varchar(8)   NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  requested_by     varchar(60)  NOT NULL,
  requested_at     timestamptz  NOT NULL DEFAULT now(),
  decided_by       varchar(60),
  decided_at       timestamptz,
  decision_note    varchar(300),
  FOREIGN KEY (master_id, record_id) REFERENCES master_record ON DELETE CASCADE,
  FOREIGN KEY (master_id, scope_code) REFERENCES master_control_policy ON DELETE CASCADE,
  CHECK (status = 'PENDING' OR (decided_by IS NOT NULL AND decided_at IS NOT NULL AND decided_by <> requested_by))
);
CREATE INDEX master_control_request_open ON master_control_request (status, requested_at) WHERE status = 'PENDING';

-- Only masters whose control_mode is on can have a policy.
CREATE FUNCTION master_control_policy_check() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT control_mode FROM master_definition WHERE master_id = NEW.master_id) = 'NONE' THEN
    RAISE EXCEPTION 'Business control is off for master %: set its control_mode first', NEW.master_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER master_control_policy_guard BEFORE INSERT ON master_control_policy
  FOR EACH ROW EXECUTE FUNCTION master_control_policy_check();

-- A control change is a definition change: bump the master's version so dealer apps re-sync it, and keep the history.
CREATE FUNCTION master_control_track() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    UPDATE master_definition SET version = version + 1, updated_at = now() WHERE master_id = NEW.master_id;
    IF TG_OP = 'INSERT' OR (OLD.state, OLD.settings) IS DISTINCT FROM (NEW.state, NEW.settings) THEN
      INSERT INTO master_control_history (master_id, record_id, scope_code, old_state, new_state, old_settings, new_settings, reason, changed_by)
      VALUES (NEW.master_id, NEW.record_id, NEW.scope_code, CASE WHEN TG_OP = 'UPDATE' THEN OLD.state END, NEW.state,
              CASE WHEN TG_OP = 'UPDATE' THEN OLD.settings END, NEW.settings, NEW.reason, NEW.decided_by);
    END IF;
    RETURN NEW;
  END IF;
  UPDATE master_definition SET version = version + 1, updated_at = now() WHERE master_id = OLD.master_id;
  RETURN OLD;
END $$;
CREATE TRIGGER master_control_track_ins_upd AFTER INSERT OR UPDATE ON master_control
  FOR EACH ROW EXECUTE FUNCTION master_control_track();
CREATE TRIGGER master_control_track_del AFTER DELETE ON master_control
  FOR EACH ROW EXECUTE FUNCTION master_control_track();

-- Business sets (or requests) a control. Returns APPLIED, or REQUESTED when the policy needs a second person.
CREATE FUNCTION set_master_control(p_master varchar, p_record varchar, p_scope varchar, p_state varchar, p_reason varchar, p_user varchar, p_settings jsonb DEFAULT NULL)
RETURNS varchar LANGUAGE plpgsql AS $$
DECLARE pol master_control_policy%ROWTYPE;
BEGIN
  SELECT * INTO pol FROM master_control_policy WHERE master_id = p_master AND scope_code = p_scope;
  IF NOT FOUND THEN RAISE EXCEPTION 'Master % has no business control policy for scope %', p_master, p_scope; END IF;
  IF p_state NOT IN ('ENABLED', 'DISABLED') THEN RAISE EXCEPTION 'State must be ENABLED or DISABLED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM master_record WHERE master_id = p_master AND record_id = p_record) THEN
    RAISE EXCEPTION 'Record % does not exist in master %', p_record, p_master;
  END IF;
  IF pol.requires_approval THEN
    INSERT INTO master_control_request (master_id, record_id, scope_code, requested_state, requested_settings, reason, requested_by)
    VALUES (p_master, p_record, p_scope, p_state, p_settings, p_reason, p_user);
    RETURN 'REQUESTED';
  END IF;
  INSERT INTO master_control (master_id, record_id, scope_code, state, settings, reason, decided_by)
  VALUES (p_master, p_record, p_scope, p_state, coalesce(p_settings, '{}'), p_reason, p_user)
  ON CONFLICT (master_id, record_id, scope_code)
  DO UPDATE SET state = EXCLUDED.state, settings = coalesce(p_settings, master_control.settings), reason = EXCLUDED.reason,
                decided_by = EXCLUDED.decided_by, decided_at = now();
  RETURN 'APPLIED';
END $$;

-- The approver decides (never the person who asked).
CREATE FUNCTION decide_master_control_request(p_request uuid, p_approve boolean, p_user varchar, p_note varchar DEFAULT NULL)
RETURNS varchar LANGUAGE plpgsql AS $$
DECLARE r master_control_request%ROWTYPE;
BEGIN
  SELECT * INTO r FROM master_control_request WHERE request_id = p_request FOR UPDATE;
  IF NOT FOUND OR r.status <> 'PENDING' THEN RAISE EXCEPTION 'Request % is not waiting for a decision', p_request; END IF;
  IF r.requested_by = p_user THEN RAISE EXCEPTION 'The person who asked cannot approve the request'; END IF;
  UPDATE master_control_request
     SET status = CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END, decided_by = p_user, decided_at = now(), decision_note = p_note
   WHERE request_id = p_request;
  IF p_approve THEN
    INSERT INTO master_control (master_id, record_id, scope_code, state, settings, reason, decided_by)
    VALUES (r.master_id, r.record_id, r.scope_code, r.requested_state, coalesce(r.requested_settings, '{}'), r.reason, p_user)
    ON CONFLICT (master_id, record_id, scope_code)
    DO UPDATE SET state = EXCLUDED.state, settings = coalesce(r.requested_settings, master_control.settings), reason = EXCLUDED.reason,
                  decided_by = EXCLUDED.decided_by, decided_at = now();
  END IF;
  RETURN CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END;
END $$;

-- -----------------------------------------------------------------------------
-- 4. What the portal and the dealer apps read: source data + business choices, combined
-- -----------------------------------------------------------------------------
-- Every record with its CRM part and ST part merged (the two never share a field).
CREATE VIEW master_record_effective AS
SELECT r.master_id, r.record_id, r.dealer_code, r.crm_key, r.crm_status, r.needs_review, r.review_reason, r.is_active,
       coalesce(r.crm_data, '{}'::jsonb) || r.data AS effective_data,
       r.changed_in_version, r.updated_at
  FROM master_record r;

-- Every record x every scope that controls its master, with the state that applies:
--   a record removed in CRM or made inactive is never available; else the business choice; else the scope's default.
CREATE VIEW master_scope_state AS
SELECT r.master_id, p.scope_code, r.record_id, r.crm_key,
       CASE WHEN NOT r.is_active OR r.crm_status = 'REMOVED_IN_CRM' THEN 'DISABLED'
            ELSE coalesce(c.state, p.default_state) END AS state,
       r.crm_status, r.needs_review,
       coalesce(r.crm_data, '{}'::jsonb) || r.data AS effective_data,
       c.settings, c.reason, c.decided_by, c.decided_at
  FROM master_record r
  JOIN master_control_policy p ON p.master_id = r.master_id
  LEFT JOIN master_control c ON c.master_id = r.master_id AND c.record_id = r.record_id AND c.scope_code = p.scope_code;

-- What the ST function actually offers: only ENABLED records (the dealer apps and portal screens use this).
CREATE VIEW master_available AS
SELECT master_id, scope_code, record_id, crm_key, effective_data, settings FROM master_scope_state WHERE state = 'ENABLED';

-- The to-do list of Business: new records from CRM waiting for a decision.
CREATE VIEW master_new_for_review AS
SELECT master_id, scope_code, record_id, crm_key, effective_data FROM master_scope_state WHERE state = 'PENDING_REVIEW';

-- -----------------------------------------------------------------------------
-- 5. The CRM link: configuration, runs, staging, per-record result
-- -----------------------------------------------------------------------------
CREATE TABLE master_sync_config (
  master_id        varchar(31)  PRIMARY KEY REFERENCES master_definition ON DELETE CASCADE,
  method           varchar(5)   NOT NULL CHECK (method IN ('API', 'SOLAR')),
  source_object    varchar(100) NOT NULL,                  -- the CRM object / API / Solar feed this master is read from
  key_field        varchar(80)  NOT NULL,                  -- the CRM field that is the record's stable key
  default_mode     varchar(5)   NOT NULL DEFAULT 'FULL' CHECK (default_mode IN ('FULL', 'DELTA')),
  schedule         varchar(60),                            -- e.g. '0 2 * * *' (decided with the architect)
  field_mapping    jsonb        NOT NULL CHECK (jsonb_typeof(field_mapping) = 'object'),   -- {"CRM_FIELD":"masterFieldKey"}
  is_enabled       boolean      NOT NULL DEFAULT true,
  updated_at       timestamptz  NOT NULL DEFAULT now(),
  updated_by       varchar(60)  NOT NULL
);

CREATE TABLE master_sync_run (
  run_id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id        varchar(31)  NOT NULL REFERENCES master_definition,
  mode             varchar(5)   NOT NULL CHECK (mode IN ('FULL', 'DELTA')),   -- FULL: records missing from the feed are marked removed
  status           varchar(9)   NOT NULL DEFAULT 'RUNNING' CHECK (status IN ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED')),
  started_at       timestamptz  NOT NULL DEFAULT now(),
  finished_at      timestamptz,
  triggered_by     varchar(60)  NOT NULL,
  source_watermark text,                                   -- the CRM's own "changes since" marker, for DELTA runs
  received         integer      NOT NULL DEFAULT 0,
  inserted         integer      NOT NULL DEFAULT 0,
  updated          integer      NOT NULL DEFAULT 0,
  unchanged        integer      NOT NULL DEFAULT 0,
  removed          integer      NOT NULL DEFAULT 0,
  restored         integer      NOT NULL DEFAULT 0,
  errors           integer      NOT NULL DEFAULT 0,
  message          varchar(500)
);
CREATE INDEX master_sync_run_master ON master_sync_run (master_id, started_at DESC);

CREATE TABLE master_sync_stage (
  run_id           uuid         NOT NULL REFERENCES master_sync_run ON DELETE CASCADE,
  crm_key          varchar(100) NOT NULL,
  payload          jsonb        NOT NULL,
  PRIMARY KEY (run_id, crm_key)
);

CREATE TABLE master_sync_item (
  item_id          bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id           uuid         NOT NULL REFERENCES master_sync_run ON DELETE CASCADE,
  crm_key          varchar(100),
  action           varchar(10)  NOT NULL CHECK (action IN ('INSERTED', 'UPDATED', 'REMOVED', 'RESTORED', 'ERROR')),
  message          varchar(500)
);
CREATE INDEX master_sync_item_run ON master_sync_item (run_id, action);

-- Step 1: open a run. The integration job then writes the CRM rows into master_sync_stage.
CREATE FUNCTION start_master_sync(p_master varchar, p_mode varchar, p_user varchar, p_watermark text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_run uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM master_sync_config WHERE master_id = p_master AND is_enabled) THEN
    RAISE EXCEPTION 'Master % has no enabled CRM sync configuration', p_master;
  END IF;
  INSERT INTO master_sync_run (master_id, mode, triggered_by, source_watermark) VALUES (p_master, p_mode, p_user, p_watermark) RETURNING run_id INTO v_run;
  RETURN v_run;
END $$;

-- Step 2: apply the staged rows in ONE transaction.
--   new key        -> record created; in allow-list scopes it waits as PENDING_REVIEW for Business
--   changed        -> only the CRM part is replaced; business choices and ST fields stay as they are
--   not changed    -> nothing is written (no new version, no history)
--   missing (FULL) -> marked REMOVED_IN_CRM: never offered to users, but kept with its history and business choice;
--                     if CRM brings it back it returns exactly as it was
CREATE FUNCTION apply_master_sync(p_run uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  run      master_sync_run%ROWTYPE;
  cfg      master_sync_config%ROWTYPE;
  s        record;
  mapped   jsonb;
  h        char(32);
  ex       master_record%ROWTYPE;
  who      varchar(60);
  n_in integer := 0; n_up integer := 0; n_un integer := 0; n_rm integer := 0; n_rs integer := 0; n_er integer := 0; n_rx integer := 0;
BEGIN
  SELECT * INTO run FROM master_sync_run WHERE run_id = p_run FOR UPDATE;
  IF NOT FOUND OR run.status <> 'RUNNING' THEN RAISE EXCEPTION 'Sync run % is not open', p_run; END IF;
  SELECT * INTO cfg FROM master_sync_config WHERE master_id = run.master_id;
  who := coalesce(run.triggered_by, 'crm-sync');
  PERFORM set_config('app.sync_run_id', p_run::text, true);     -- lets this transaction write the CRM part
  PERFORM set_config('app.user_id', who, true);

  FOR s IN SELECT * FROM master_sync_stage WHERE run_id = p_run ORDER BY crm_key LOOP
    n_rx := n_rx + 1;
    IF jsonb_typeof(s.payload) <> 'object' THEN
      INSERT INTO master_sync_item (run_id, crm_key, action, message) VALUES (p_run, s.crm_key, 'ERROR', 'The CRM row is not an object');
      n_er := n_er + 1; CONTINUE;
    END IF;
    SELECT coalesce(jsonb_object_agg(m.value #>> '{}', s.payload -> m.key), '{}'::jsonb) INTO mapped
      FROM jsonb_each(cfg.field_mapping) m WHERE s.payload ? m.key;
    h := md5(mapped::text);
    SELECT * INTO ex FROM master_record WHERE master_id = run.master_id AND crm_key = s.crm_key;

    BEGIN
      IF NOT FOUND THEN
        INSERT INTO master_record (master_id, record_id, data, crm_key, crm_data, crm_hash, crm_synced_at, crm_status, changed_in_version, created_by, updated_by)
        VALUES (run.master_id, s.crm_key, '{}', s.crm_key, mapped, h, now(), 'ACTIVE', 0, who, who);
        INSERT INTO master_control (master_id, record_id, scope_code, state, reason, decided_by)
          SELECT run.master_id, s.crm_key, p.scope_code, 'PENDING_REVIEW', 'New from CRM, waiting for Business', who
            FROM master_control_policy p WHERE p.master_id = run.master_id AND p.default_state = 'DISABLED';
        INSERT INTO master_sync_item (run_id, crm_key, action) VALUES (p_run, s.crm_key, 'INSERTED');
        n_in := n_in + 1;
      ELSIF ex.crm_status = 'REMOVED_IN_CRM' THEN
        UPDATE master_record SET crm_data = mapped, crm_hash = h, crm_synced_at = now(), crm_status = 'ACTIVE', updated_by = who
         WHERE master_id = run.master_id AND record_id = ex.record_id;
        INSERT INTO master_sync_item (run_id, crm_key, action, message) VALUES (p_run, s.crm_key, 'RESTORED', 'Back in CRM');
        n_rs := n_rs + 1;
      ELSIF ex.crm_hash IS DISTINCT FROM h THEN
        UPDATE master_record SET crm_data = mapped, crm_hash = h, crm_synced_at = now(), updated_by = who
         WHERE master_id = run.master_id AND record_id = ex.record_id;
        INSERT INTO master_sync_item (run_id, crm_key, action) VALUES (p_run, s.crm_key, 'UPDATED');
        n_up := n_up + 1;
      ELSE
        n_un := n_un + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO master_sync_item (run_id, crm_key, action, message) VALUES (p_run, s.crm_key, 'ERROR', left(SQLERRM, 500));
      n_er := n_er + 1;
    END;
  END LOOP;

  IF run.mode = 'FULL' THEN
    WITH gone AS (
      UPDATE master_record SET crm_status = 'REMOVED_IN_CRM', crm_synced_at = now(), updated_by = who
       WHERE master_id = run.master_id AND crm_key IS NOT NULL AND crm_status = 'ACTIVE'
         AND crm_key NOT IN (SELECT crm_key FROM master_sync_stage WHERE run_id = p_run)
      RETURNING crm_key
    ), logged AS (
      INSERT INTO master_sync_item (run_id, crm_key, action, message) SELECT p_run, crm_key, 'REMOVED', 'No longer in CRM' FROM gone RETURNING 1
    )
    SELECT count(*) INTO n_rm FROM logged;
  END IF;

  PERFORM flag_broken_references();

  UPDATE master_sync_run
     SET status = CASE WHEN n_er > 0 THEN 'PARTIAL' ELSE 'SUCCEEDED' END, finished_at = now(),
         received = n_rx, inserted = n_in, updated = n_up, unchanged = n_un, removed = n_rm, restored = n_rs, errors = n_er
   WHERE run_id = p_run;
  PERFORM set_config('app.sync_run_id', '', true);
END $$;

-- If the run cannot be applied at all, the caller records why.
CREATE FUNCTION fail_master_sync(p_run uuid, p_message varchar) RETURNS void LANGUAGE sql AS $$
  UPDATE master_sync_run SET status = 'FAILED', finished_at = now(), message = p_message WHERE run_id = p_run AND status = 'RUNNING';
$$;

-- -----------------------------------------------------------------------------
-- 6. Broken references: an ST record that points at a CRM value that no longer exists is flagged "needs review", never deleted
-- -----------------------------------------------------------------------------
-- Covers fields that refer to another master (ref_master) and fields that use a list of values (lov_type). The flag is cleared
-- again when the target is back. Returns how many records were newly flagged (or got a new reason).
CREATE FUNCTION flag_broken_references() RETURNS integer LANGUAGE plpgsql AS $$
DECLARE f record; n integer := 0;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _broken (master_id varchar(31), record_id varchar(60), reason varchar(300)) ON COMMIT DROP;
  TRUNCATE _broken;
  FOR f IN SELECT mf.master_id, mf.field_key, mf.label, mf.ref_master, mf.lov_type FROM master_field mf WHERE mf.ref_master IS NOT NULL OR mf.lov_type IS NOT NULL LOOP
    IF f.ref_master IS NOT NULL THEN
      INSERT INTO _broken
      SELECT r.master_id, r.record_id, left(format('%s refers to "%s", which is no longer available in %s', f.label, (coalesce(r.crm_data, '{}') || r.data) ->> f.field_key, f.ref_master), 300)
        FROM master_record r
       WHERE r.master_id = f.master_id AND (coalesce(r.crm_data, '{}') || r.data) ->> f.field_key IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM master_record t
                          WHERE t.master_id = f.ref_master AND t.record_id = (coalesce(r.crm_data, '{}') || r.data) ->> f.field_key
                            AND t.is_active AND coalesce(t.crm_status, 'ACTIVE') = 'ACTIVE');
    ELSE
      INSERT INTO _broken
      SELECT r.master_id, r.record_id, left(format('%s uses value "%s", which is no longer in list %s', f.label, (coalesce(r.crm_data, '{}') || r.data) ->> f.field_key, f.lov_type), 300)
        FROM master_record r
       WHERE r.master_id = f.master_id AND (coalesce(r.crm_data, '{}') || r.data) ->> f.field_key IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM master_record v JOIN master_definition d ON d.master_id = v.master_id AND d.lov_type_field IS NOT NULL
                          WHERE (coalesce(v.crm_data, '{}') || v.data) ->> d.lov_type_field = f.lov_type
                            AND (coalesce(v.crm_data, '{}') || v.data) ->> d.lov_code_field = (coalesce(r.crm_data, '{}') || r.data) ->> f.field_key
                            AND v.is_active AND coalesce(v.crm_status, 'ACTIVE') = 'ACTIVE');
    END IF;
  END LOOP;

  UPDATE master_record r SET needs_review = true, review_reason = b.reason
    FROM (SELECT DISTINCT ON (master_id, record_id) master_id, record_id, reason FROM _broken ORDER BY master_id, record_id) b
   WHERE r.master_id = b.master_id AND r.record_id = b.record_id AND (NOT r.needs_review OR r.review_reason IS DISTINCT FROM b.reason);
  GET DIAGNOSTICS n = ROW_COUNT;

  UPDATE master_record r SET needs_review = false, review_reason = NULL
   WHERE r.needs_review AND NOT EXISTS (SELECT 1 FROM _broken b WHERE b.master_id = r.master_id AND b.record_id = r.record_id);
  RETURN n;
END $$;

-- The review list for admins: records that point at something that is gone.
CREATE VIEW master_records_to_review AS
SELECT master_id, record_id, review_reason, (coalesce(crm_data, '{}'::jsonb) || data) AS effective_data FROM master_record WHERE needs_review;
