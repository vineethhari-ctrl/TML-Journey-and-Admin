-- =============================================================================
-- TML Service Transformation — Admin Portal backend schema (PostgreSQL 16)
--
-- Design in one line: masters are DATA, not tables. A new master (or a missed
-- field) is a row in master_definition / master_field, and its rows are JSONB in
-- master_record — so BAs keep adding masters without a deployment, exactly as the
-- portal works today. Only modules with workflow (bays, approvals, calendars,
-- users / roles, audit) get dedicated tables.
--
-- Conventions: snake_case; every business table has created_at/by + updated_at/by;
-- optimistic locking via row_version (sent back as the HTTP ETag); soft delete
-- via is_active where users can "deactivate"; audit_log is append-only.
-- See docs/backend/README.md for the reasoning and public/api-docs/openapi.yaml
-- for the API.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE SCHEMA IF NOT EXISTS admin;
SET search_path = admin, public;

-- -----------------------------------------------------------------------------
-- 1. Organisation: zones, dealers, divisions
-- -----------------------------------------------------------------------------
CREATE TABLE dealer (
  dealer_code      varchar(16)  PRIMARY KEY,                 -- e.g. DLR1001
  dealer_name      varchar(200) NOT NULL,
  region           varchar(16)  NOT NULL CHECK (region IN ('North', 'South', 'East', 'West')),
  city             varchar(100),
  facility_type    varchar(60),                              -- 3S / 2S …
  is_active        boolean      NOT NULL DEFAULT true,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE division (
  division_id      uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_code      varchar(16)  NOT NULL REFERENCES dealer,
  division_name    varchar(120) NOT NULL,                    -- e.g. Main Workshop, EV Hub
  is_active        boolean      NOT NULL DEFAULT true,
  UNIQUE (dealer_code, division_name)
);

-- -----------------------------------------------------------------------------
-- 2. Users, roles, permissions (identity comes from TML SSO; we store authorisation)
-- -----------------------------------------------------------------------------
CREATE TABLE app_role (
  role_id          varchar(40)  PRIMARY KEY,                 -- TML_ADMIN, TML_NETWORK_MANAGER, DEALER_ADMIN, BA, READ_ONLY, DEALER_APP
  role_name        varchar(100) NOT NULL,
  description      text,
  is_active        boolean      NOT NULL DEFAULT true
);

CREATE TABLE role_permission (
  role_id          varchar(40)  NOT NULL REFERENCES app_role,
  module           varchar(60)  NOT NULL,                    -- e.g. MASTERS, BAY, AUDIT, USERS
  can_view         boolean      NOT NULL DEFAULT false,
  can_create       boolean      NOT NULL DEFAULT false,
  can_edit         boolean      NOT NULL DEFAULT false,
  can_approve      boolean      NOT NULL DEFAULT false,
  can_delete       boolean      NOT NULL DEFAULT false,
  can_export       boolean      NOT NULL DEFAULT false,
  PRIMARY KEY (role_id, module)
);

CREATE TABLE app_user (
  user_id          varchar(60)  PRIMARY KEY,                 -- SSO subject / employee id
  employee_id      varchar(30)  UNIQUE,
  full_name        varchar(150) NOT NULL,
  email            varchar(200) NOT NULL UNIQUE,
  mobile           varchar(20),
  user_type        varchar(10)  NOT NULL CHECK (user_type IN ('CRM', 'NON-CRM', 'ADMIN')),
  dealer_code      varchar(16)  REFERENCES dealer,           -- set for dealer users → row-level scope
  status           varchar(10)  NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'LOCKED', 'PENDING')),
  last_login_at    timestamptz,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE user_role (
  user_id          varchar(60)  NOT NULL REFERENCES app_user ON DELETE CASCADE,
  role_id          varchar(40)  NOT NULL REFERENCES app_role,
  PRIMARY KEY (user_id, role_id)
);

-- -----------------------------------------------------------------------------
-- 3. Generic master engine
-- -----------------------------------------------------------------------------
CREATE TABLE master_definition (
  master_id        varchar(31)  PRIMARY KEY CHECK (master_id ~ '^[a-z][a-z0-9_]{2,30}$'),
  master_name      varchar(150) NOT NULL,
  logical_group    varchar(60)  NOT NULL,                    -- Vehicle Data, Dealer Network, Electronic Quality Check, Bodyshop …
  module_code      varchar(30)  NOT NULL,                    -- eqc, bodyshop, jc_creation …
  owner            varchar(16)  NOT NULL CHECK (owner IN ('TML_ADMIN', 'DEALER_ADMIN')),
  category         varchar(100),
  description      text,
  is_dealer_scoped boolean      NOT NULL DEFAULT false,      -- true: each record belongs to one dealer (dealer_code)
  is_system        boolean      NOT NULL DEFAULT false,      -- shipped with the product; cannot be deleted
  rule_set         varchar(40),                              -- server-side business rules plug-in: 'eqc', 'bodyshop', NULL
  source           varchar(200),                             -- e.g. "Smart Excel Import: Bodyshop_Master_1.xlsx"
  version          integer      NOT NULL DEFAULT 1,          -- bumped on every definition OR record change (dealer delta sync)
  row_version      integer      NOT NULL DEFAULT 1,          -- optimistic lock for the definition itself
  is_active        boolean      NOT NULL DEFAULT true,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  created_by       varchar(60)  NOT NULL,
  updated_at       timestamptz  NOT NULL DEFAULT now(),
  updated_by       varchar(60)  NOT NULL
);

CREATE TABLE master_field (
  master_id        varchar(31)  NOT NULL REFERENCES master_definition ON DELETE CASCADE,
  field_key        varchar(50)  NOT NULL CHECK (field_key ~ '^[a-zA-Z][a-zA-Z0-9_]*$' AND field_key <> 'id'),
  label            varchar(150) NOT NULL,
  field_type       varchar(10)  NOT NULL CHECK (field_type IN ('text', 'number', 'select', 'boolean', 'date')),
  options          jsonb,                                    -- ["Y","N"] for select
  is_mandatory     boolean      NOT NULL DEFAULT false,
  default_value    jsonb,                                    -- '""' = start blank (e.g. PPL blank = all PPLs)
  blank_label      varchar(60),                              -- "(All PPLs)"
  validation       jsonb,                                    -- {"min":1,"max":2,"pattern":"…","minDate":"…","customErrorMessage":"…"}
  description      text,
  is_custom        boolean      NOT NULL DEFAULT false,      -- added by a BA on the fly
  is_system        boolean      NOT NULL DEFAULT false,
  is_indexed       boolean      NOT NULL DEFAULT false,      -- DBA adds an expression index for frequent filters (ppl, complaintCode…)
  display_order    integer      NOT NULL DEFAULT 0,
  -- exposure to dealer applications
  display_in_dealer_app boolean NOT NULL DEFAULT false,
  dealer_target_module  varchar(30) CHECK (dealer_target_module IN ('vehicle_journey', 'job_card', 'reception', 'workshop_floor', 'general')),
  dealer_display_label  varchar(150),
  value_mapping    jsonb,                                    -- {"PLATINUM":"Platinum 5-Yr Cover"}
  ui_logic         jsonb,                                    -- rules-engine visibleIf / disabledIf / requiredIf …
  is_active        boolean      NOT NULL DEFAULT true,       -- fields are never hard-deleted (old records keep their data)
  created_at       timestamptz  NOT NULL DEFAULT now(),
  created_by       varchar(60)  NOT NULL,
  PRIMARY KEY (master_id, field_key),
  CHECK (field_type <> 'select' OR jsonb_array_length(options) >= 2)
);

CREATE TABLE master_record (
  master_id        varchar(31)  NOT NULL REFERENCES master_definition ON DELETE CASCADE,
  record_id        varchar(60)  NOT NULL,                    -- business id shown in the portal (e.g. GCM-01)
  dealer_code      varchar(16)  REFERENCES dealer,           -- only for dealer-scoped masters
  data             jsonb        NOT NULL,                    -- {"ppl":"","complaintCode":"BRK-VIB-02","gcApplicable":"Y", …}
  is_active        boolean      NOT NULL DEFAULT true,
  row_version      integer      NOT NULL DEFAULT 1,
  changed_in_version integer    NOT NULL,                    -- master_definition.version that last touched the row (delta sync)
  created_at       timestamptz  NOT NULL DEFAULT now(),
  created_by       varchar(60)  NOT NULL,
  updated_at       timestamptz  NOT NULL DEFAULT now(),
  updated_by       varchar(60)  NOT NULL,
  PRIMARY KEY (master_id, record_id),
  CHECK (jsonb_typeof(data) = 'object')
);
CREATE INDEX master_record_data_gin  ON master_record USING gin (data jsonb_path_ops);
CREATE INDEX master_record_sync      ON master_record (master_id, changed_in_version);
CREATE INDEX master_record_dealer    ON master_record (master_id, dealer_code) WHERE dealer_code IS NOT NULL;
-- Example of an is_indexed field (created by the DBA when a master grows):
-- CREATE INDEX mr_gcm_complaint ON master_record ((data->>'complaintCode')) WHERE master_id = 'eqc_gc_mandate';

-- Full history of every record change (who / when / before / after) — feeds "Change Log"
CREATE TABLE master_record_history (
  history_id       bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  master_id        varchar(31)  NOT NULL,
  record_id        varchar(60)  NOT NULL,
  operation        varchar(10)  NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data         jsonb,
  new_data         jsonb,
  master_version   integer      NOT NULL,
  changed_at       timestamptz  NOT NULL DEFAULT now(),
  changed_by       varchar(60)  NOT NULL,
  import_job_id    uuid                                       -- set when the change came from an import
);
CREATE INDEX master_record_history_lookup ON master_record_history (master_id, record_id, changed_at DESC);

-- Snapshot of the definition at each structural change (fields added, options changed …)
CREATE TABLE master_definition_history (
  master_id        varchar(31)  NOT NULL,
  version          integer      NOT NULL,
  definition       jsonb        NOT NULL,                    -- master_definition + fields as one document
  changed_at       timestamptz  NOT NULL DEFAULT now(),
  changed_by       varchar(60)  NOT NULL,
  change_summary   text,
  PRIMARY KEY (master_id, version)
);

-- Imports (Smart Excel Import, BA workbook, bulk upload): preview → commit, all-or-nothing
CREATE TABLE import_job (
  import_job_id    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  kind             varchar(20)  NOT NULL CHECK (kind IN ('SMART_EXCEL', 'BA_WORKBOOK', 'BULK_RECORDS')),
  file_name        varchar(255) NOT NULL,
  file_object_key  varchar(500),                              -- original file in object storage (kept for audit)
  status           varchar(12)  NOT NULL DEFAULT 'PREVIEW' CHECK (status IN ('PREVIEW', 'COMMITTED', 'REJECTED', 'EXPIRED')),
  payload          jsonb        NOT NULL,                     -- parsed masters / records as previewed
  report           jsonb        NOT NULL DEFAULT '{}'::jsonb, -- errors, warnings, gaps with Excel row numbers
  created_at       timestamptz  NOT NULL DEFAULT now(),
  created_by       varchar(60)  NOT NULL,
  committed_at     timestamptz,
  committed_by     varchar(60)
);

-- -----------------------------------------------------------------------------
-- 4. Bay governance (allocation → add / status change → approval)
-- -----------------------------------------------------------------------------
CREATE TABLE bay_allocation (
  allocation_id    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_code      varchar(16)  NOT NULL REFERENCES dealer,
  division_id      uuid         NOT NULL REFERENCES division,
  bu               varchar(4)   NOT NULL CHECK (bu IN ('PV', 'EV', 'CV')),
  bay_type         varchar(30)  NOT NULL,                     -- Mechanical, Electrical, EV, Fleet, Speedo, AC, BodyShop
  allocated        integer      NOT NULL CHECK (allocated BETWEEN 0 AND 500),
  row_version      integer      NOT NULL DEFAULT 1,
  updated_at       timestamptz  NOT NULL DEFAULT now(),
  updated_by       varchar(60)  NOT NULL,
  UNIQUE (dealer_code, division_id, bu, bay_type)
);

CREATE TABLE bay (
  bay_id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  bay_no           integer      NOT NULL,
  dealer_code      varchar(16)  NOT NULL REFERENCES dealer,
  division_id      uuid         NOT NULL REFERENCES division,
  bu               varchar(4)   NOT NULL CHECK (bu IN ('PV', 'EV', 'CV')),
  bay_name         varchar(120) NOT NULL,
  bay_type         varchar(30)  NOT NULL,
  bay_status       varchar(10)  NOT NULL DEFAULT 'Inactive' CHECK (bay_status IN ('Active', 'Inactive')),
  approval_status  varchar(20)  NOT NULL DEFAULT 'Draft' CHECK (approval_status IN ('Draft', 'Approved', 'Pending Approval', 'Rejected')),
  status_reason    varchar(200),
  floor            varchar(20),
  lift_availability varchar(20),
  special_equipments jsonb      NOT NULL DEFAULT '[]'::jsonb,
  tech_supervisor  varchar(100),
  technician_1     varchar(100),
  technician_2     varchar(100),
  pending_request_id uuid,                                    -- FK added below (circular)
  row_version      integer      NOT NULL DEFAULT 1,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  created_by       varchar(60)  NOT NULL,
  updated_at       timestamptz  NOT NULL DEFAULT now(),
  updated_by       varchar(60)  NOT NULL,
  UNIQUE (dealer_code, bay_no),
  CHECK (approval_status = 'Approved' OR bay_status = 'Inactive')   -- only approved bays can be Active
);
-- Bay names are unique per dealer among non-rejected bays
CREATE UNIQUE INDEX bay_name_unique ON bay (dealer_code, lower(bay_name)) WHERE approval_status <> 'Rejected';

CREATE TABLE bay_request (
  request_id       uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  request_no       varchar(30)  NOT NULL UNIQUE,              -- human reference, e.g. BREQ-2026-000123
  kind             varchar(15)  NOT NULL CHECK (kind IN ('ADD_BAY', 'STATUS_CHANGE')),
  bay_id           uuid         NOT NULL REFERENCES bay,
  from_status      varchar(10)  CHECK (from_status IN ('Active', 'Inactive')),
  to_status        varchar(10)  CHECK (to_status IN ('Active', 'Inactive')),
  reason           text         NOT NULL,
  allocation_snapshot jsonb,                                  -- {"allocated":4,"used":4} at request time
  approver_role    varchar(40)  NOT NULL CHECK (approver_role IN ('TML_NETWORK_MANAGER', 'TML_ADMIN')),
  status           varchar(10)  NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN')),
  requested_at     timestamptz  NOT NULL DEFAULT now(),
  requested_by     varchar(60)  NOT NULL,
  decided_at       timestamptz,
  decided_by       varchar(60),
  decision_note    text,
  CHECK (kind <> 'STATUS_CHANGE' OR (from_status IS NOT NULL AND to_status IS NOT NULL)),
  CHECK (status <> 'REJECTED' OR coalesce(trim(decision_note), '') <> '')   -- a rejection needs a reason
);
ALTER TABLE bay ADD CONSTRAINT bay_pending_request_fk FOREIGN KEY (pending_request_id) REFERENCES bay_request DEFERRABLE INITIALLY DEFERRED;
-- At most one open request per bay
CREATE UNIQUE INDEX bay_request_one_open ON bay_request (bay_id) WHERE status = 'PENDING';
CREATE INDEX bay_request_inbox ON bay_request (approver_role, status, requested_at DESC);

-- Policy switches the BU has not finalised (singleton row)
CREATE TABLE bay_policy (
  policy_id        smallint     PRIMARY KEY DEFAULT 1 CHECK (policy_id = 1),
  dealer_can_change_status          boolean NOT NULL DEFAULT true,
  dealer_status_change_needs_approval boolean NOT NULL DEFAULT true,
  updated_at       timestamptz  NOT NULL DEFAULT now(),
  updated_by       varchar(60)  NOT NULL DEFAULT 'system'
);

-- -----------------------------------------------------------------------------
-- 5. Non-operational hours & holiday calendar (per dealer division)
-- -----------------------------------------------------------------------------
CREATE TABLE calendar_weekly_pattern (
  division_id      uuid         NOT NULL REFERENCES division,
  weekday          smallint     NOT NULL CHECK (weekday BETWEEN 1 AND 7),   -- ISO: 1 = Monday
  is_week_off      boolean      NOT NULL DEFAULT false,
  open_time        time,
  close_time       time,
  updated_at       timestamptz  NOT NULL DEFAULT now(),
  updated_by       varchar(60)  NOT NULL,
  PRIMARY KEY (division_id, weekday),
  CHECK (is_week_off OR (open_time IS NOT NULL AND close_time IS NOT NULL AND open_time < close_time))
);

CREATE TABLE calendar_date_override (
  division_id      uuid         NOT NULL REFERENCES division,
  calendar_date    date         NOT NULL,
  is_holiday       boolean      NOT NULL DEFAULT false,
  holiday_name     varchar(120),
  remark           varchar(300),
  open_time        time,                                      -- hours override (half day) when not a holiday
  close_time       time,
  updated_at       timestamptz  NOT NULL DEFAULT now(),
  updated_by       varchar(60)  NOT NULL,
  PRIMARY KEY (division_id, calendar_date),
  CHECK ((open_time IS NULL) = (close_time IS NULL)),
  CHECK (open_time IS NULL OR open_time < close_time)
);

-- -----------------------------------------------------------------------------
-- 6. Notifications, e-mail outbox, audit
-- -----------------------------------------------------------------------------
CREATE TABLE notification (
  notification_id  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id varchar(60) REFERENCES app_user,
  recipient_role   varchar(40)  REFERENCES app_role,          -- broadcast to everyone holding a role
  type             varchar(12)  NOT NULL CHECK (type IN ('EXCEPTION', 'SECURITY', 'USER', 'DEVICE', 'CONFIG', 'APPROVAL')),
  title            varchar(200) NOT NULL,
  message          text         NOT NULL,
  target_path      varchar(300),                              -- deep link inside the portal, e.g. /admin/bay-approvals?request=…
  is_read          boolean      NOT NULL DEFAULT false,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  CHECK (recipient_user_id IS NOT NULL OR recipient_role IS NOT NULL)
);

-- Transactional outbox: written in the same transaction as the business change, sent by a worker
CREATE TABLE email_outbox (
  email_id         uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  to_address       varchar(320) NOT NULL,
  subject          varchar(300) NOT NULL,
  body_text        text         NOT NULL,
  deep_link        varchar(500),
  related_entity   varchar(60),                               -- e.g. bay_request:<uuid>
  status           varchar(10)  NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'SENT', 'FAILED')),
  attempts         smallint     NOT NULL DEFAULT 0,
  last_error       text,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  sent_at          timestamptz
);
CREATE INDEX email_outbox_queue ON email_outbox (status, created_at) WHERE status = 'QUEUED';

-- Append-only audit trail (partition by month in production; see README)
CREATE TABLE audit_log (
  audit_id         bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at      timestamptz  NOT NULL DEFAULT now(),
  user_id          varchar(60)  NOT NULL,
  user_name        varchar(150) NOT NULL,
  action           varchar(100) NOT NULL,                     -- "Bay Request Approved", "Masters Imported from BA Workbook" …
  module           varchar(60)  NOT NULL,
  entity           varchar(300) NOT NULL,
  old_value        text,
  new_value        text,
  ip_address       inet,
  status           varchar(8)   NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'FAILED', 'WARNING')),
  correlation_id   uuid                                       -- request id, to tie an audit row to logs
);
CREATE INDEX audit_log_time ON audit_log (occurred_at DESC);
CREATE INDEX audit_log_module ON audit_log (module, occurred_at DESC);

-- The audit trail cannot be edited or deleted by the application role
CREATE FUNCTION audit_log_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END $$;
CREATE TRIGGER audit_log_no_update BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

-- -----------------------------------------------------------------------------
-- 7. Keep master versions and history consistent automatically
-- -----------------------------------------------------------------------------
-- Every record insert / update / delete bumps the master's version, stamps the row
-- with it (for dealer delta sync) and writes master_record_history.
CREATE FUNCTION master_record_track() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_version integer;
  v_master  varchar(31) := coalesce(NEW.master_id, OLD.master_id);
BEGIN
  UPDATE master_definition SET version = version + 1, updated_at = now()
   WHERE master_id = v_master
   RETURNING version INTO v_version;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO master_record_history (master_id, record_id, operation, old_data, new_data, master_version, changed_by)
    VALUES (OLD.master_id, OLD.record_id, 'DELETE', OLD.data, NULL, v_version,
            coalesce(current_setting('app.user_id', true), 'system'));
    RETURN OLD;
  END IF;

  NEW.changed_in_version := v_version;
  IF TG_OP = 'UPDATE' THEN
    NEW.row_version := OLD.row_version + 1;
    NEW.updated_at := now();
  END IF;
  INSERT INTO master_record_history (master_id, record_id, operation, old_data, new_data, master_version, changed_by, import_job_id)
  VALUES (NEW.master_id, NEW.record_id, TG_OP,
          CASE WHEN TG_OP = 'UPDATE' THEN OLD.data END, NEW.data, v_version, NEW.updated_by,
          nullif(current_setting('app.import_job_id', true), '')::uuid);
  RETURN NEW;
END $$;

CREATE TRIGGER master_record_track_ins_upd BEFORE INSERT OR UPDATE ON master_record
  FOR EACH ROW EXECUTE FUNCTION master_record_track();
CREATE TRIGGER master_record_track_del AFTER DELETE ON master_record
  FOR EACH ROW EXECUTE FUNCTION master_record_track();

-- A Dealer Admin may only see / change their own dealer's rows (row-level security).
-- The API sets app.dealer_code per request for dealer users; TML users leave it empty.
ALTER TABLE master_record ENABLE ROW LEVEL SECURITY;
CREATE POLICY master_record_dealer_scope ON master_record
  USING (coalesce(current_setting('app.dealer_code', true), '') = '' OR dealer_code IS NULL
         OR dealer_code = current_setting('app.dealer_code', true));
ALTER TABLE bay ENABLE ROW LEVEL SECURITY;
CREATE POLICY bay_dealer_scope ON bay
  USING (coalesce(current_setting('app.dealer_code', true), '') = ''
         OR dealer_code = current_setting('app.dealer_code', true));

-- -----------------------------------------------------------------------------
-- 8. Reference data
-- -----------------------------------------------------------------------------
INSERT INTO app_role (role_id, role_name, description) VALUES
  ('TML_ADMIN',           'TML Admin (L1/L2 Support)', 'Full masters administration; approves bay status changes'),
  ('TML_NETWORK_MANAGER', 'TML Network Manager',       'Approves additional bays beyond the TML allocation'),
  ('BA',                  'Business Analyst',          'Creates and imports masters; cannot approve'),
  ('DEALER_ADMIN',        'Dealer (DSv) Admin',        'Dealer-owned masters and bays for one dealer'),
  ('READ_ONLY',           'Read only',                 'View and export'),
  ('DEALER_APP',          'Dealer application (service account)', 'Reads published masters and resolves rules');
INSERT INTO bay_policy (policy_id) VALUES (1);
