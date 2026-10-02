-- Self-checking tests for docs/backend/schema.sql. Run after the schema on an empty database:
--   psql -v ON_ERROR_STOP=1 -f docs/backend/schema.sql -f docs/backend/schema_test.sql
-- Any failed ASSERT stops the script with a non-zero exit code (CI runs this).
SET search_path = admin, public;

INSERT INTO dealer VALUES
  ('DLR1001', 'Sample Motors Hyderabad', 'South', 'Hyderabad', '3S', true, now(), now()),
  ('DLR1002', 'Rudra Motors South', 'South', 'Bengaluru', '3S', true, now(), now());
INSERT INTO division (dealer_code, division_name) VALUES ('DLR1001', 'Main Workshop'), ('DLR1002', 'Main Workshop');

-- Helper: the statement must be rejected by the database
CREATE FUNCTION pg_temp.expect_error(label text, stmt text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ok (rejected): %', label;
    RETURN;
  END;
  RAISE EXCEPTION 'expected an error but the statement succeeded: %', label;
END $$;

-- 1. Master engine: version bump, history, delta sync, JSONB lookup
INSERT INTO master_definition (master_id, master_name, logical_group, module_code, owner, rule_set, created_by, updated_by)
VALUES ('eqc_gc_mandate', 'Guided Check & Road Test Mandate Master', 'Electronic Quality Check', 'eqc', 'TML_ADMIN', 'eqc', 'ba', 'ba');
INSERT INTO master_field (master_id, field_key, label, field_type, options, is_mandatory, default_value, blank_label, created_by) VALUES
  ('eqc_gc_mandate', 'ppl', 'PPL', 'select', '["Nexon","Nexon EV"]', false, '""', '(All PPLs)', 'ba'),
  ('eqc_gc_mandate', 'complaintCode', 'Complaint Code', 'text', NULL, true, NULL, NULL, 'ba');
INSERT INTO master_record (master_id, record_id, data, changed_in_version, created_by, updated_by) VALUES
  ('eqc_gc_mandate', 'GCM-01', '{"ppl":"","complaintCode":"BRK-VIB-02"}', 0, 'ba', 'ba'),
  ('eqc_gc_mandate', 'GCM-02', '{"ppl":"Nexon EV","complaintCode":"BAT-SOC-03"}', 0, 'ba', 'ba');
UPDATE master_record SET data = data || '{"ppl":"Nexon"}', updated_by = 'admin' WHERE record_id = 'GCM-02';
DELETE FROM master_record WHERE record_id = 'GCM-01';

DO $$
DECLARE v int; h text; rv int; civ int;
BEGIN
  SELECT version INTO v FROM master_definition WHERE master_id = 'eqc_gc_mandate';
  ASSERT v = 5, format('master version should be 5 after 2 inserts, 1 update, 1 delete; got %s', v);
  SELECT string_agg(operation, ',' ORDER BY history_id) INTO h FROM master_record_history;
  ASSERT h = 'INSERT,INSERT,UPDATE,DELETE', format('history should be INSERT,INSERT,UPDATE,DELETE; got %s', h);
  SELECT row_version, changed_in_version INTO rv, civ FROM master_record WHERE record_id = 'GCM-02';
  ASSERT rv = 2 AND civ = 4, format('GCM-02 row_version/changed_in_version should be 2/4; got %s/%s', rv, civ);
  ASSERT (SELECT count(*) FROM master_record WHERE master_id = 'eqc_gc_mandate' AND data @> '{"complaintCode":"BAT-SOC-03"}') = 1,
    'JSONB containment lookup should find GCM-02';
  ASSERT (SELECT count(*) FROM master_record WHERE master_id = 'eqc_gc_mandate' AND changed_in_version > 3) = 1,
    'delta sync since version 3 should return one row';
END $$;

SELECT pg_temp.expect_error('select field needs 2+ options',
  $q$INSERT INTO master_field (master_id, field_key, label, field_type, options, created_by) VALUES ('eqc_gc_mandate','x','X','select','["A"]','u')$q$);
SELECT pg_temp.expect_error('field key "id" is reserved',
  $q$INSERT INTO master_field (master_id, field_key, label, field_type, created_by) VALUES ('eqc_gc_mandate','id','Id','text','u')$q$);
SELECT pg_temp.expect_error('master id format',
  $q$INSERT INTO master_definition (master_id, master_name, logical_group, module_code, owner, created_by, updated_by) VALUES ('Bad-Id','x','g','m','TML_ADMIN','u','u')$q$);
SELECT pg_temp.expect_error('record data must be an object',
  $q$INSERT INTO master_record (master_id, record_id, data, changed_in_version, created_by, updated_by) VALUES ('eqc_gc_mandate','X','[1]',0,'u','u')$q$);

-- 2. Bays and approvals
INSERT INTO bay (bay_no, dealer_code, division_id, bu, bay_name, bay_type, bay_status, approval_status, created_by, updated_by)
SELECT 1, 'DLR1001', division_id, 'PV', 'Mechanical Bay 01', 'Mechanical', 'Active', 'Approved', 'dlr', 'dlr' FROM division WHERE dealer_code = 'DLR1001';
INSERT INTO bay (bay_no, dealer_code, division_id, bu, bay_name, bay_type, created_by, updated_by)
SELECT 1, 'DLR1002', division_id, 'PV', 'Mechanical Bay 01', 'Mechanical', 'dlr2', 'dlr2' FROM division WHERE dealer_code = 'DLR1002';
INSERT INTO bay_request (request_no, kind, bay_id, from_status, to_status, reason, approver_role, requested_by)
SELECT 'BREQ-1', 'STATUS_CHANGE', bay_id, 'Active', 'Inactive', 'Manpower shortage', 'TML_ADMIN', 'dlr' FROM bay WHERE dealer_code = 'DLR1001';

SELECT pg_temp.expect_error('one open request per bay',
  $q$INSERT INTO bay_request (request_no, kind, bay_id, from_status, to_status, reason, approver_role, requested_by) SELECT 'BREQ-2','STATUS_CHANGE',bay_id,'Active','Inactive','x','TML_ADMIN','u' FROM bay WHERE dealer_code='DLR1001'$q$);
SELECT pg_temp.expect_error('a rejection needs a note',
  $q$UPDATE bay_request SET status='REJECTED', decided_by='mgr' WHERE request_no='BREQ-1'$q$);
SELECT pg_temp.expect_error('a status change needs from/to',
  $q$INSERT INTO bay_request (request_no, kind, bay_id, reason, approver_role, requested_by) SELECT 'BREQ-3','STATUS_CHANGE',bay_id,'x','TML_ADMIN','u' FROM bay WHERE dealer_code='DLR1002'$q$);
SELECT pg_temp.expect_error('only approved bays can be Active',
  $q$UPDATE bay SET bay_status='Active' WHERE dealer_code='DLR1002'$q$);
SELECT pg_temp.expect_error('bay names unique per dealer (case-insensitive)',
  $q$INSERT INTO bay (bay_no, dealer_code, division_id, bu, bay_name, bay_type, created_by, updated_by) SELECT 2,'DLR1001',division_id,'PV','mechanical bay 01','Mechanical','u','u' FROM division WHERE dealer_code='DLR1001'$q$);
SELECT pg_temp.expect_error('allocation 0..500',
  $q$INSERT INTO bay_allocation (dealer_code, division_id, bu, bay_type, allocated, updated_by) SELECT 'DLR1001',division_id,'PV','AC',501,'u' FROM division WHERE dealer_code='DLR1001'$q$);
UPDATE bay_request SET status = 'REJECTED', decided_by = 'mgr', decided_at = now(), decision_note = 'Bay needed for festive load' WHERE request_no = 'BREQ-1';

-- 3. Calendar, audit
SELECT pg_temp.expect_error('open time must be before close time',
  $q$INSERT INTO calendar_weekly_pattern (division_id, weekday, is_week_off, open_time, close_time, updated_by) SELECT division_id,1,false,'19:00','09:00','u' FROM division LIMIT 1$q$);
SELECT pg_temp.expect_error('hours override needs both times',
  $q$INSERT INTO calendar_date_override (division_id, calendar_date, open_time, updated_by) SELECT division_id,'2026-10-12','09:00','u' FROM division LIMIT 1$q$);
INSERT INTO audit_log (user_id, user_name, action, module, entity) VALUES ('u', 'U', 'Test', 'Test', 'e');
SELECT pg_temp.expect_error('audit log is append-only (update)', $q$UPDATE audit_log SET action='tampered'$q$);
SELECT pg_temp.expect_error('audit log is append-only (delete)', $q$DELETE FROM audit_log$q$);

-- 4. Row-level security: a dealer user only sees their own dealer
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tml_api_test') THEN CREATE ROLE tml_api_test; END IF;
END $$;
GRANT USAGE ON SCHEMA admin TO tml_api_test;
GRANT SELECT ON ALL TABLES IN SCHEMA admin TO tml_api_test;
SET ROLE tml_api_test;
SET app.dealer_code = 'DLR1002';
DO $$ BEGIN
  ASSERT (SELECT string_agg(dealer_code, ',') FROM admin.bay) = 'DLR1002', 'dealer DLR1002 must only see its own bays';
END $$;
RESET app.dealer_code;
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM admin.bay) = 2, 'a TML user (no dealer scope) sees all bays';
END $$;
RESET ROLE;

SELECT 'schema tests passed' AS result;
