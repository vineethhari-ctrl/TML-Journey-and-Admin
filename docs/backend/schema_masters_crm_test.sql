-- Self-checking tests for docs/backend/schema_masters_crm.sql (CRM masters + business control). TEST DATA ONLY.
--   psql -v ON_ERROR_STOP=1 -f docs/backend/schema.sql -f docs/backend/schema_masters_crm.sql -f docs/backend/schema_masters_crm_test.sql
-- The story follows the architect's example: CRM holds many PL / PPL models, Business makes only some of them available in a
-- specific ST function, CRM changes its data, and the business choices must survive every refresh.
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

-- Puts one CRM row into the staging table of a run
CREATE OR REPLACE FUNCTION pg_temp.stage(p_run uuid, p_key text, p_name text, p_pl text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO master_sync_stage (run_id, crm_key, payload) VALUES (p_run, p_key, jsonb_build_object('PPL_ID', p_key, 'PPL_NAME', p_name, 'PL', p_pl));
$$;

-- -----------------------------------------------------------------------------
-- 1. Definitions: a CRM master with business control, scopes and policies
-- -----------------------------------------------------------------------------
INSERT INTO master_definition (master_id, master_name, logical_group, module_code, owner, source_system, sync_mode, control_mode, created_by, updated_by)
VALUES ('ppl_master', 'PPL & PL (Product Line) Master', 'Common Masters', 'common', 'TML_ADMIN', 'CRM', 'API', 'ENABLE_DISABLE', 'ba', 'ba');
INSERT INTO master_field (master_id, field_key, label, field_type, source_system, crm_field, created_by) VALUES
  ('ppl_master', 'pplName',     'PPL',          'text', 'CRM', 'PPL_NAME', 'ba'),
  ('ppl_master', 'productLine', 'PL (Variant)', 'text', 'CRM', 'PL',       'ba'),
  ('ppl_master', 'remark',      'ST remark',    'text', 'ST',  NULL,       'ba');
INSERT INTO master_sync_config (master_id, method, source_object, key_field, schedule, field_mapping, updated_by)
VALUES ('ppl_master', 'API', 'CRM.PPL', 'PPL_ID', '0 2 * * *', '{"PPL_NAME":"pplName","PL":"productLine"}', 'ba');
INSERT INTO control_scope (scope_code, scope_name, module_code, created_by) VALUES
  ('EQC_GUIDED_CHECK', 'eQC Guided Check & Road Test', 'eqc', 'ba'),
  ('JC_CREATION',      'Job card creation',            'jc_creation', 'ba');
INSERT INTO master_control_policy (master_id, scope_code, default_state, created_by) VALUES
  ('ppl_master', 'EQC_GUIDED_CHECK', 'DISABLED', 'ba'),   -- allow-list: only the models Business picks
  ('ppl_master', 'JC_CREATION',      'ENABLED',  'ba');   -- deny-list: everything unless switched off

DO $$ BEGIN
  PERFORM pg_temp.expect_error('a CRM master needs a sync mode',
    $q$INSERT INTO master_definition (master_id, master_name, logical_group, module_code, owner, source_system, sync_mode, created_by, updated_by) VALUES ('bad_crm','x','g','m','TML_ADMIN','CRM','NONE','u','u')$q$);
  PERFORM pg_temp.expect_error('an ST master cannot have a sync mode',
    $q$INSERT INTO master_definition (master_id, master_name, logical_group, module_code, owner, source_system, sync_mode, created_by, updated_by) VALUES ('bad_st','x','g','m','TML_ADMIN','ST','API','u','u')$q$);
  PERFORM pg_temp.expect_error('no control policy while control is off for the master',
    $q$INSERT INTO master_control_policy (master_id, scope_code, created_by) VALUES ('eqc_gc_mandate','JC_CREATION','u')$q$);
END $$;

-- -----------------------------------------------------------------------------
-- 2. First CRM sync: 8 models arrive
-- -----------------------------------------------------------------------------
DO $$
DECLARE r uuid;
BEGIN
  r := start_master_sync('ppl_master', 'FULL', 'crm-sync');
  PERFORM pg_temp.stage(r, 'PPL001', 'Altroz', 'PV');      PERFORM pg_temp.stage(r, 'PPL002', 'Curvv EV', 'EV');
  PERFORM pg_temp.stage(r, 'PPL003', 'Curvv', 'PV');       PERFORM pg_temp.stage(r, 'PPL004', 'Harrier', 'PV');
  PERFORM pg_temp.stage(r, 'PPL005', 'Nexon', 'PV');       PERFORM pg_temp.stage(r, 'PPL006', 'Nexon EV', 'EV');
  PERFORM pg_temp.stage(r, 'PPL007', 'Punch', 'PV');       PERFORM pg_temp.stage(r, 'PPL008', 'Safari', 'PV');
  PERFORM apply_master_sync(r);
  ASSERT (SELECT status || ':' || inserted || ':' || errors FROM master_sync_run WHERE run_id = r) = 'SUCCEEDED:8:0', 'first sync should insert 8 records';
  PERFORM set_config('test.run1', r::text, false);
END $$;

DO $$ BEGIN
  ASSERT (SELECT count(*) FROM master_record WHERE master_id = 'ppl_master' AND crm_status = 'ACTIVE') = 8, '8 CRM records';
  ASSERT (SELECT record_id FROM master_record WHERE master_id = 'ppl_master' AND crm_data ->> 'pplName' = 'Safari') = 'PPL008', 'record_id equals the CRM key';
  -- allow-list scope: everything waits for Business; deny-list scope: everything is available
  ASSERT (SELECT count(*) FROM master_new_for_review WHERE master_id = 'ppl_master' AND scope_code = 'EQC_GUIDED_CHECK') = 8, 'all 8 wait for Business in the allow-list scope';
  ASSERT (SELECT count(*) FROM master_available WHERE master_id = 'ppl_master' AND scope_code = 'EQC_GUIDED_CHECK') = 0, 'nothing is available yet in the allow-list scope';
  ASSERT (SELECT count(*) FROM master_available WHERE master_id = 'ppl_master' AND scope_code = 'JC_CREATION') = 8, 'everything is available in the deny-list scope';
END $$;

-- -----------------------------------------------------------------------------
-- 3. Business enables three models for the eQC function; users cannot touch the CRM part
-- -----------------------------------------------------------------------------
DO $$
DECLARE v_before int; v_after int;
BEGIN
  SELECT version INTO v_before FROM master_definition WHERE master_id = 'ppl_master';
  ASSERT set_master_control('ppl_master', 'PPL001', 'EQC_GUIDED_CHECK', 'ENABLED', 'Needed for UAT', 'biz.user') = 'APPLIED';
  ASSERT set_master_control('ppl_master', 'PPL004', 'EQC_GUIDED_CHECK', 'ENABLED', 'Needed for UAT', 'biz.user') = 'APPLIED';
  ASSERT set_master_control('ppl_master', 'PPL005', 'EQC_GUIDED_CHECK', 'ENABLED', 'Needed for UAT', 'biz.user') = 'APPLIED';
  SELECT version INTO v_after FROM master_definition WHERE master_id = 'ppl_master';
  ASSERT v_after = v_before + 3, format('each control change bumps the master version (dealer apps re-sync): %s -> %s', v_before, v_after);
  ASSERT (SELECT string_agg(record_id, ',' ORDER BY record_id) FROM master_available WHERE master_id = 'ppl_master' AND scope_code = 'EQC_GUIDED_CHECK') = 'PPL001,PPL004,PPL005', 'exactly the 3 chosen models are available';
  ASSERT (SELECT count(*) FROM master_new_for_review WHERE master_id = 'ppl_master' AND scope_code = 'EQC_GUIDED_CHECK') = 5, '5 still wait';
  ASSERT (SELECT string_agg(coalesce(old_state, '-') || '>' || new_state, ' ' ORDER BY history_id) FROM master_control_history WHERE record_id = 'PPL001') = '->PENDING_REVIEW PENDING_REVIEW>ENABLED', 'history shows pending, then enabled';
  ASSERT (SELECT changed_by FROM master_control_history WHERE record_id = 'PPL001' ORDER BY history_id DESC LIMIT 1) = 'biz.user', 'history says who';
END $$;

DO $$ BEGIN
  PERFORM pg_temp.expect_error('users cannot change the CRM part',
    $q$UPDATE master_record SET crm_data = '{"pplName":"Hacked"}' WHERE master_id = 'ppl_master' AND record_id = 'PPL001'$q$);
  PERFORM pg_temp.expect_error('users cannot add a record with a CRM key',
    $q$INSERT INTO master_record (master_id, record_id, data, crm_key, crm_data, crm_hash, crm_status, changed_in_version, created_by, updated_by) VALUES ('ppl_master','PPLX','{}','PPLX','{"pplName":"X"}',md5('x'),'ACTIVE',0,'u','u')$q$);
  PERFORM pg_temp.expect_error('users cannot add records of their own to a CRM master',
    $q$INSERT INTO master_record (master_id, record_id, data, changed_in_version, created_by, updated_by) VALUES ('ppl_master','ST-ONLY','{"remark":"x"}',0,'u','u')$q$);
  PERFORM pg_temp.expect_error('a CRM field cannot be edited in ST',
    $q$UPDATE master_record SET data = '{"pplName":"Mine"}' WHERE master_id = 'ppl_master' AND record_id = 'PPL001'$q$);
END $$;
-- ... but an ST field of a CRM record can be edited
UPDATE master_record SET data = '{"remark":"Priority model"}', updated_by = 'ba' WHERE master_id = 'ppl_master' AND record_id = 'PPL002';

-- -----------------------------------------------------------------------------
-- 4. ST records that point at CRM data (a master reference and a list of values)
-- -----------------------------------------------------------------------------
INSERT INTO lov_type (lov_type, module_code, field_name, source_system, allow_st_extension, created_by) VALUES
  ('COMMON_FUEL_TYPE', 'COMMON', 'Fuel Type', 'CRM', false, 'ba'),
  ('COMMON_PRIORITY',  'COMMON', 'Priority',  'CRM', true,  'ba'),
  ('JC_WASH_TYPE',     'JC',     'Wash Type', 'ST',  false, 'ba');
INSERT INTO master_definition (master_id, master_name, logical_group, module_code, owner, source_system, sync_mode, lov_type_field, lov_code_field, created_by, updated_by)
VALUES ('common_lov', 'Common LOV Master', 'Common Masters', 'common', 'TML_ADMIN', 'MIXED', 'API', 'lovType', 'code', 'ba', 'ba');
INSERT INTO master_definition (master_id, master_name, logical_group, module_code, owner, created_by, updated_by)
VALUES ('eqc_guided', 'Guided Check (test)', 'Electronic Quality Check', 'eqc', 'TML_ADMIN', 'ba', 'ba');
INSERT INTO master_field (master_id, field_key, label, field_type, ref_master, lov_type, created_by) VALUES
  ('eqc_guided', 'ppl',      'PPL',       'text', 'ppl_master', NULL, 'ba'),
  ('eqc_guided', 'fuelType', 'Fuel Type', 'text', NULL, 'COMMON_FUEL_TYPE', 'ba');
DO $$ BEGIN
  PERFORM pg_temp.expect_error('a field cannot be both a master reference and a list',
    $q$INSERT INTO master_field (master_id, field_key, label, field_type, ref_master, lov_type, created_by) VALUES ('eqc_guided','bad','Bad','text','ppl_master','COMMON_FUEL_TYPE','u')$q$);
END $$;

-- CRM values of the fuel list arrive through the sync (simulated by opening the sync gate for this session)
SELECT set_config('app.sync_run_id', 'test-load', false);
INSERT INTO master_record (master_id, record_id, data, crm_key, crm_data, crm_hash, crm_synced_at, crm_status, changed_in_version, created_by, updated_by) VALUES
  ('common_lov', 'FUEL-PETROL', '{}', 'FUEL-PETROL', '{"lovType":"COMMON_FUEL_TYPE","code":"PETROL","label":"Petrol"}', md5('p'), now(), 'ACTIVE', 0, 'crm-sync', 'crm-sync'),
  ('common_lov', 'FUEL-EV',     '{}', 'FUEL-EV',     '{"lovType":"COMMON_FUEL_TYPE","code":"EV","label":"Electric"}',    md5('e'), now(), 'ACTIVE', 0, 'crm-sync', 'crm-sync');
SELECT set_config('app.sync_run_id', '', false);

DO $$ BEGIN
  PERFORM pg_temp.expect_error('ST cannot add a value to a CRM list',
    $q$INSERT INTO master_record (master_id, record_id, data, changed_in_version, created_by, updated_by) VALUES ('common_lov','FUEL-X','{"lovType":"COMMON_FUEL_TYPE","code":"X","label":"X"}',0,'u','u')$q$);
  PERFORM pg_temp.expect_error('an unknown list type is refused',
    $q$INSERT INTO master_record (master_id, record_id, data, changed_in_version, created_by, updated_by) VALUES ('common_lov','Q-1','{"lovType":"NO_SUCH_LIST","code":"X"}',0,'u','u')$q$);
  -- allowed: an ST value on a CRM list that allows extension, and an ST value on an ST list
  INSERT INTO master_record (master_id, record_id, data, changed_in_version, created_by, updated_by) VALUES
    ('common_lov', 'PRIO-ST', '{"lovType":"COMMON_PRIORITY","code":"URGENT","label":"Urgent (ST extension)"}', 0, 'ba', 'ba'),
    ('common_lov', 'WASH-1',  '{"lovType":"JC_WASH_TYPE","code":"BASIC","label":"Basic wash"}', 0, 'ba', 'ba');
  ASSERT (SELECT count(*) FROM master_record WHERE master_id = 'common_lov' AND crm_key IS NULL) = 2, 'ST extension and ST list values are accepted';
END $$;

INSERT INTO master_record (master_id, record_id, data, changed_in_version, created_by, updated_by) VALUES
  ('eqc_guided', 'GC-1', '{"ppl":"PPL004","fuelType":"PETROL"}', 0, 'ba', 'ba'),   -- Harrier will disappear from CRM below
  ('eqc_guided', 'GC-2', '{"ppl":"PPL001","fuelType":"EV"}',     0, 'ba', 'ba'),
  ('eqc_guided', 'GC-3', '{"ppl":"PPL001","fuelType":"STEAM"}',  0, 'ba', 'ba');   -- not in the fuel list at all
DO $$ BEGIN
  ASSERT flag_broken_references() = 1, 'GC-3 uses a fuel value that is not in the list';
  ASSERT (SELECT string_agg(record_id, ',') FROM master_records_to_review) = 'GC-3', 'only GC-3 needs review';
  ASSERT (SELECT review_reason FROM master_record WHERE record_id = 'GC-3') LIKE '%STEAM%', 'the reason names the value';
END $$;

-- -----------------------------------------------------------------------------
-- 5. Second sync: CRM renames one model, adds one, and drops Harrier (which Business had enabled)
-- -----------------------------------------------------------------------------
DO $$
DECLARE r uuid; v_before int; v_after int;
BEGIN
  r := start_master_sync('ppl_master', 'FULL', 'crm-sync');
  PERFORM pg_temp.stage(r, 'PPL001', 'Altroz', 'PV');            PERFORM pg_temp.stage(r, 'PPL002', 'Curvv EV Facelift', 'EV');
  PERFORM pg_temp.stage(r, 'PPL003', 'Curvv', 'PV');             PERFORM pg_temp.stage(r, 'PPL005', 'Nexon', 'PV');
  PERFORM pg_temp.stage(r, 'PPL006', 'Nexon EV', 'EV');          PERFORM pg_temp.stage(r, 'PPL007', 'Punch', 'PV');
  PERFORM pg_temp.stage(r, 'PPL008', 'Safari', 'PV');            PERFORM pg_temp.stage(r, 'PPL009', 'Sierra EV', 'EV');
  PERFORM apply_master_sync(r);
  ASSERT (SELECT inserted || ':' || updated || ':' || unchanged || ':' || removed || ':' || restored || ':' || errors FROM master_sync_run WHERE run_id = r) = '1:1:6:1:0:0',
    'second sync: 1 new, 1 changed, 6 unchanged, 1 removed';

  ASSERT (SELECT crm_status FROM master_record WHERE record_id = 'PPL004' AND master_id = 'ppl_master') = 'REMOVED_IN_CRM', 'Harrier is marked removed, not deleted';
  ASSERT (SELECT string_agg(record_id, ',' ORDER BY record_id) FROM master_available WHERE master_id = 'ppl_master' AND scope_code = 'EQC_GUIDED_CHECK') = 'PPL001,PPL005',
    'a model removed in CRM is no longer offered, the other choices stay';
  ASSERT (SELECT state FROM master_control WHERE record_id = 'PPL004' AND scope_code = 'EQC_GUIDED_CHECK') = 'ENABLED', 'the business choice for the removed model is kept';
  ASSERT (SELECT count(*) FROM master_available WHERE master_id = 'ppl_master' AND scope_code = 'JC_CREATION') = 8, 'deny-list scope: 8 available (7 old + the new one), the removed one is gone';
  ASSERT (SELECT count(*) FROM master_new_for_review WHERE scope_code = 'EQC_GUIDED_CHECK' AND record_id = 'PPL009') = 1, 'the new model waits for Business in the allow-list scope';
  ASSERT (SELECT crm_data ->> 'pplName' FROM master_record WHERE record_id = 'PPL002' AND master_id = 'ppl_master') = 'Curvv EV Facelift', 'CRM change applied';
  ASSERT (SELECT data ->> 'remark' FROM master_record WHERE record_id = 'PPL002' AND master_id = 'ppl_master') = 'Priority model', 'the ST field survived the refresh';
  ASSERT (SELECT (old_crm_data ->> 'pplName') || ' > ' || (new_crm_data ->> 'pplName') FROM master_record_history WHERE record_id = 'PPL002' AND master_id = 'ppl_master' AND operation = 'UPDATE' ORDER BY history_id DESC LIMIT 1) = 'Curvv EV > Curvv EV Facelift', 'history keeps the old and new CRM data';

  -- the reference of GC-1 to the removed model is flagged for review (never deleted)
  ASSERT (SELECT needs_review FROM master_record WHERE record_id = 'GC-1') AND (SELECT review_reason FROM master_record WHERE record_id = 'GC-1') LIKE '%PPL004%', 'GC-1 needs review';
  ASSERT NOT (SELECT needs_review FROM master_record WHERE record_id = 'GC-2'), 'GC-2 is fine';

  -- a refresh that brings nothing new writes nothing
  SELECT version INTO v_before FROM master_definition WHERE master_id = 'ppl_master';
  r := start_master_sync('ppl_master', 'FULL', 'crm-sync');
  PERFORM pg_temp.stage(r, 'PPL001', 'Altroz', 'PV');            PERFORM pg_temp.stage(r, 'PPL002', 'Curvv EV Facelift', 'EV');
  PERFORM pg_temp.stage(r, 'PPL003', 'Curvv', 'PV');             PERFORM pg_temp.stage(r, 'PPL005', 'Nexon', 'PV');
  PERFORM pg_temp.stage(r, 'PPL006', 'Nexon EV', 'EV');          PERFORM pg_temp.stage(r, 'PPL007', 'Punch', 'PV');
  PERFORM pg_temp.stage(r, 'PPL008', 'Safari', 'PV');            PERFORM pg_temp.stage(r, 'PPL009', 'Sierra EV', 'EV');
  PERFORM apply_master_sync(r);
  SELECT version INTO v_after FROM master_definition WHERE master_id = 'ppl_master';
  ASSERT (SELECT inserted + updated + removed + restored FROM master_sync_run WHERE run_id = r) = 0 AND v_after = v_before, 'an identical refresh changes nothing and does not bump the version';
END $$;

-- -----------------------------------------------------------------------------
-- 6. CRM brings Harrier back: it returns exactly as it was, with the business choice
-- -----------------------------------------------------------------------------
DO $$
DECLARE r uuid;
BEGIN
  r := start_master_sync('ppl_master', 'FULL', 'crm-sync');
  PERFORM pg_temp.stage(r, 'PPL001', 'Altroz', 'PV');            PERFORM pg_temp.stage(r, 'PPL002', 'Curvv EV Facelift', 'EV');
  PERFORM pg_temp.stage(r, 'PPL003', 'Curvv', 'PV');             PERFORM pg_temp.stage(r, 'PPL004', 'Harrier', 'PV');
  PERFORM pg_temp.stage(r, 'PPL005', 'Nexon', 'PV');             PERFORM pg_temp.stage(r, 'PPL006', 'Nexon EV', 'EV');
  PERFORM pg_temp.stage(r, 'PPL007', 'Punch', 'PV');             PERFORM pg_temp.stage(r, 'PPL008', 'Safari', 'PV');
  PERFORM pg_temp.stage(r, 'PPL009', 'Sierra EV', 'EV');
  PERFORM apply_master_sync(r);
  ASSERT (SELECT restored FROM master_sync_run WHERE run_id = r) = 1, 'Harrier restored';
  ASSERT (SELECT string_agg(record_id, ',' ORDER BY record_id) FROM master_available WHERE master_id = 'ppl_master' AND scope_code = 'EQC_GUIDED_CHECK') = 'PPL001,PPL004,PPL005', 'the enabled models are back as Business chose';
  ASSERT NOT (SELECT needs_review FROM master_record WHERE record_id = 'GC-1'), 'the review flag clears when the target is back';
END $$;

-- -----------------------------------------------------------------------------
-- 7. A bad CRM row does not stop the others
-- -----------------------------------------------------------------------------
DO $$
DECLARE r uuid;
BEGIN
  r := start_master_sync('ppl_master', 'DELTA', 'crm-sync', 'watermark-42');
  PERFORM pg_temp.stage(r, 'PPL010', 'Tiago', 'PV');
  INSERT INTO master_sync_stage (run_id, crm_key, payload) VALUES (r, 'PPL011', '"not an object"');
  PERFORM apply_master_sync(r);
  ASSERT (SELECT status || ':' || inserted || ':' || errors FROM master_sync_run WHERE run_id = r) = 'PARTIAL:1:1', 'one good row applied, one error reported';
  ASSERT (SELECT count(*) FROM master_sync_item WHERE run_id = r AND action = 'ERROR' AND crm_key = 'PPL011') = 1, 'the error is listed per record';
  ASSERT (SELECT removed FROM master_sync_run WHERE run_id = r) = 0, 'a DELTA run never marks missing records as removed';
  PERFORM pg_temp.expect_error('a finished run cannot be applied again', format('SELECT apply_master_sync(%L)', r));
END $$;

-- -----------------------------------------------------------------------------
-- 8. Control is generic: a master Business asks about LATER (and an ST-owned one) works the same way
-- -----------------------------------------------------------------------------
INSERT INTO master_definition (master_id, master_name, logical_group, module_code, owner, created_by, updated_by)
VALUES ('dealer_outlets', 'Outlets (test)', 'Dealer Network', 'common', 'TML_ADMIN', 'ba', 'ba');
INSERT INTO master_record (master_id, record_id, data, changed_in_version, created_by, updated_by) VALUES
  ('dealer_outlets', 'OUT-1', '{"name":"Outlet 1"}', 0, 'ba', 'ba'), ('dealer_outlets', 'OUT-2', '{"name":"Outlet 2"}', 0, 'ba', 'ba'), ('dealer_outlets', 'OUT-3', '{"name":"Outlet 3"}', 0, 'ba', 'ba');
DO $$ BEGIN
  PERFORM pg_temp.expect_error('control is off until an admin switches it on',
    $q$INSERT INTO master_control_policy (master_id, scope_code, created_by) VALUES ('dealer_outlets','JC_CREATION','u')$q$);
  -- Business asks for control: one setting and one policy row, no new table and no deployment
  UPDATE master_definition SET control_mode = 'ENABLE_DISABLE' WHERE master_id = 'dealer_outlets';
  INSERT INTO master_control_policy (master_id, scope_code, default_state, created_by) VALUES ('dealer_outlets', 'JC_CREATION', 'ENABLED', 'ba');
  ASSERT set_master_control('dealer_outlets', 'OUT-2', 'JC_CREATION', 'DISABLED', 'Outlet closed for service', 'biz.user') = 'APPLIED';
  ASSERT (SELECT string_agg(record_id, ',' ORDER BY record_id) FROM master_available WHERE master_id = 'dealer_outlets' AND scope_code = 'JC_CREATION') = 'OUT-1,OUT-3', 'an ST master is controlled the same way';
  -- a record that is not a record, a missing policy and a wrong state are refused
  PERFORM pg_temp.expect_error('unknown record', $q$SELECT set_master_control('dealer_outlets','NOPE','JC_CREATION','ENABLED','x','u')$q$);
  PERFORM pg_temp.expect_error('no policy for this scope', $q$SELECT set_master_control('dealer_outlets','OUT-1','EQC_GUIDED_CHECK','ENABLED','x','u')$q$);
  PERFORM pg_temp.expect_error('a user cannot set PENDING_REVIEW', $q$SELECT set_master_control('dealer_outlets','OUT-1','JC_CREATION','PENDING_REVIEW','x','u')$q$);
END $$;

-- Settings per scope (control_mode CONFIGURE)
UPDATE master_definition SET control_mode = 'CONFIGURE' WHERE master_id = 'dealer_outlets';
DO $$ BEGIN
  PERFORM set_master_control('dealer_outlets', 'OUT-1', 'JC_CREATION', 'ENABLED', 'Higher daily limit', 'biz.user', '{"dailyJobCardLimit": 60}');
  ASSERT (SELECT (settings ->> 'dailyJobCardLimit')::int FROM master_available WHERE master_id = 'dealer_outlets' AND record_id = 'OUT-1') = 60, 'settings travel with the available record';
END $$;

-- -----------------------------------------------------------------------------
-- 9. Optional approval: a second person decides
-- -----------------------------------------------------------------------------
INSERT INTO control_scope (scope_code, scope_name, created_by) VALUES ('DASHBOARD', 'Dashboards', 'ba');
INSERT INTO master_control_policy (master_id, scope_code, default_state, requires_approval, approver_role, created_by)
VALUES ('dealer_outlets', 'DASHBOARD', 'ENABLED', true, 'TML_ADMIN', 'ba');
DO $$
DECLARE q1 uuid; q2 uuid;
BEGIN
  ASSERT set_master_control('dealer_outlets', 'OUT-3', 'DASHBOARD', 'DISABLED', 'Hide from dashboards', 'biz.user') = 'REQUESTED', 'a change needing approval is only requested';
  ASSERT (SELECT count(*) FROM master_available WHERE master_id = 'dealer_outlets' AND scope_code = 'DASHBOARD') = 3, 'nothing changes before approval';
  SELECT request_id INTO q1 FROM master_control_request WHERE status = 'PENDING' AND record_id = 'OUT-3';
  PERFORM pg_temp.expect_error('the person who asked cannot approve', format('SELECT decide_master_control_request(%L, true, %L)', q1, 'biz.user'));
  ASSERT decide_master_control_request(q1, true, 'admin.user', 'Agreed') = 'APPROVED';
  ASSERT (SELECT count(*) FROM master_available WHERE master_id = 'dealer_outlets' AND scope_code = 'DASHBOARD') = 2, 'approved: the change applies';

  PERFORM set_master_control('dealer_outlets', 'OUT-1', 'DASHBOARD', 'DISABLED', 'Test', 'biz.user');
  SELECT request_id INTO q2 FROM master_control_request WHERE status = 'PENDING' AND record_id = 'OUT-1';
  ASSERT decide_master_control_request(q2, false, 'admin.user', 'Not now') = 'REJECTED';
  ASSERT (SELECT count(*) FROM master_available WHERE master_id = 'dealer_outlets' AND scope_code = 'DASHBOARD') = 2, 'rejected: nothing changes';
  PERFORM pg_temp.expect_error('a decided request cannot be decided again', format('SELECT decide_master_control_request(%L, true, %L)', q2, 'admin.user'));
END $$;

-- -----------------------------------------------------------------------------
-- 10. History cannot be rewritten
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  PERFORM pg_temp.expect_error('control history is append-only', $q$UPDATE master_control_history SET reason = 'edited'$q$);
  PERFORM pg_temp.expect_error('control history cannot be deleted', $q$DELETE FROM master_control_history$q$);
END $$;

SELECT 'masters / CRM / business control tests passed' AS result;
