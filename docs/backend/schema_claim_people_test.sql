-- Self-checking tests for docs/backend/schema_claim_people.sql (CCM / ACCM per division, KAM users). TEST DATA ONLY.
-- Run after parts 1, 2, 3 and 3b (CI loads every part and its tests in order).
-- Any failed ASSERT stops the script with a non-zero exit code.
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
CREATE OR REPLACE FUNCTION pg_temp.div(p_dealer text, p_name text) RETURNS uuid LANGUAGE sql AS $$
  SELECT division_id FROM division WHERE dealer_code = p_dealer AND division_name = p_name $$;

-- Test organisation and people
INSERT INTO dealer (dealer_code, dealer_name, region, city, facility_type) VALUES
  ('DLR9201', 'Test Claims Motors A', 'West', 'Pune', '3S'),
  ('DLR9202', 'Test Claims Motors B', 'South', 'Chennai', '3S');
INSERT INTO division (dealer_code, division_name) VALUES ('DLR9201', 'Main Workshop'), ('DLR9201', 'EV Hub'), ('DLR9202', 'Main Workshop');
INSERT INTO app_user (user_id, employee_id, full_name, email, user_type, dealer_code) VALUES
  ('test.ccm1',  'T9201', 'Test CCM One',   'ccm1@example.test',  'CRM', NULL),
  ('test.ccm2',  'T9202', 'Test CCM Two',   'ccm2@example.test',  'CRM', NULL),
  ('test.accm1', 'T9203', 'Test ACCM One',  'accm1@example.test', 'CRM', NULL),
  ('test.both',  'T9204', 'Test Both Roles','both@example.test',  'CRM', NULL),
  ('test.kam1',  'T9205', 'Test KAM One',   'kam1@example.test',  'CRM', NULL),
  ('test.kam2',  'T9206', 'Test KAM Two',   'kam2@example.test',  'CRM', NULL),
  ('test.noncrm','T9207', 'Test Non CRM',   'noncrm@example.test','NON-CRM', NULL);
INSERT INTO user_role (user_id, role_id) VALUES
  ('test.ccm1', 'CCM'), ('test.ccm2', 'CCM'), ('test.accm1', 'ACCM'), ('test.both', 'CCM'), ('test.both', 'ACCM'),
  ('test.kam1', 'KAM'), ('test.kam2', 'KAM'), ('test.noncrm', 'CCM');
SET app.user_id = 'test.admin';
SET app.user_name = 'Test TML Admin';

-- -----------------------------------------------------------------------------
-- 1. CCM / ACCM per division
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM app_role WHERE role_id IN ('CCM', 'ACCM', 'KAM')) = 3, 'the three roles exist';
  ASSERT (SELECT count(*) FROM claim_owner_gaps WHERE dealer_code = 'DLR9201') = 4, 'two new divisions: no CCM and no ACCM in each';
END $$;

SELECT assign_division_owner(pg_temp.div('DLR9201', 'Main Workshop'), 'CCM',  'test.ccm1',  'test.admin');
SELECT assign_division_owner(pg_temp.div('DLR9201', 'Main Workshop'), 'ACCM', 'test.accm1', 'test.admin');
SELECT assign_division_owner(pg_temp.div('DLR9202', 'Main Workshop'), 'CCM',  'test.ccm1',  'test.admin');   -- one CCM can cover several divisions
DO $$ BEGIN
  ASSERT (SELECT ccm_user_id || '/' || accm_user_id FROM division_claim_owner_status WHERE division_id = pg_temp.div('DLR9201', 'Main Workshop')) = 'test.ccm1/test.accm1',
         'the division has its CCM and ACCM';
  ASSERT NOT EXISTS (SELECT 1 FROM claim_owner_gaps WHERE division_id = pg_temp.div('DLR9201', 'Main Workshop')), 'no gap for a fully mapped division';
  ASSERT (SELECT string_agg(gap, ',') FROM claim_owner_gaps WHERE division_id = pg_temp.div('DLR9202', 'Main Workshop')) = 'No ACCM', 'the missing ACCM is reported';
  ASSERT (SELECT count(*) FROM audit_log WHERE action = 'Claim Owner Assigned' AND entity = 'CCM of DLR9201 / Main Workshop' AND new_value = 'test.ccm1') = 1, 'assignment audited';
  ASSERT assign_division_owner(pg_temp.div('DLR9201', 'Main Workshop'), 'CCM', 'test.ccm1', 'test.admin')
         = (SELECT assignment_id FROM division_claim_owner WHERE division_id = pg_temp.div('DLR9201', 'Main Workshop') AND owner_type = 'CCM' AND ended_at IS NULL),
         'assigning the same person again changes nothing';
  ASSERT (SELECT count(*) FROM audit_log WHERE action = 'Claim Owner Assigned') = 3, 'and writes no audit';
END $$;

-- Replacing the CCM ends the old row and keeps the history
-- (test only: back-date the first assignment by 30 days; the history guard is switched off for this one statement)
ALTER TABLE division_claim_owner DISABLE TRIGGER division_claim_owner_guard;
UPDATE division_claim_owner SET assigned_at = now() - interval '30 days' WHERE user_id = 'test.ccm1' AND division_id = pg_temp.div('DLR9201', 'Main Workshop');
ALTER TABLE division_claim_owner ENABLE TRIGGER division_claim_owner_guard;
SELECT assign_division_owner(pg_temp.div('DLR9201', 'Main Workshop'), 'CCM', 'test.ccm2', 'test.admin', 'Transfer');
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM division_claim_owner WHERE division_id = pg_temp.div('DLR9201', 'Main Workshop') AND owner_type = 'CCM') = 2, 'old and new row kept';
  ASSERT (SELECT ended_by || '/' || end_reason FROM division_claim_owner WHERE user_id = 'test.ccm1' AND division_id = pg_temp.div('DLR9201', 'Main Workshop')) = 'test.admin/Transfer',
         'who ended it and why';
  ASSERT (SELECT user_id FROM division_claim_owners(pg_temp.div('DLR9201', 'Main Workshop')) WHERE owner_type = 'CCM') = 'test.ccm2', 'today the CCM is the new person';
  ASSERT (SELECT user_id FROM division_claim_owners(pg_temp.div('DLR9201', 'Main Workshop'), now() - interval '10 days') WHERE owner_type = 'CCM') = 'test.ccm1',
         'ten days ago it was the old one (for old claims)';
  ASSERT (SELECT old_value || '>' || new_value FROM audit_log WHERE action = 'Claim Owner Assigned' AND new_value = 'test.ccm2') = 'test.ccm1>test.ccm2', 'audit shows old and new';
END $$;

SELECT pg_temp.expect_error('a second current CCM for a division (direct insert)',
  format($q$INSERT INTO division_claim_owner (division_id, owner_type, user_id, assigned_by) VALUES (%L, 'CCM', 'test.both', 'x')$q$, pg_temp.div('DLR9201', 'Main Workshop')));
SELECT assign_division_owner(pg_temp.div('DLR9201', 'EV Hub'), 'CCM', 'test.both', 'test.admin');
SELECT pg_temp.expect_error('the same person as CCM and ACCM of one division',
  format($q$SELECT assign_division_owner(%L, 'ACCM', 'test.both', 'test.admin')$q$, pg_temp.div('DLR9201', 'EV Hub')));
SELECT pg_temp.expect_error('a user without the role',
  format($q$SELECT assign_division_owner(%L, 'ACCM', 'test.ccm2', 'test.admin')$q$, pg_temp.div('DLR9201', 'EV Hub')));
SELECT pg_temp.expect_error('a user without a CRM ID',
  format($q$SELECT assign_division_owner(%L, 'ACCM', 'test.noncrm', 'test.admin')$q$, pg_temp.div('DLR9202', 'Main Workshop')));
SELECT pg_temp.expect_error('an unknown user',
  format($q$SELECT assign_division_owner(%L, 'ACCM', 'nobody', 'test.admin')$q$, pg_temp.div('DLR9202', 'Main Workshop')));
SELECT pg_temp.expect_error('a type other than CCM / ACCM',
  format($q$SELECT assign_division_owner(%L, 'BOSS', 'test.ccm2', 'test.admin')$q$, pg_temp.div('DLR9202', 'Main Workshop')));
SELECT pg_temp.expect_error('an unknown division',
  $q$SELECT assign_division_owner(gen_random_uuid(), 'CCM', 'test.ccm2', 'test.admin')$q$);
UPDATE division SET is_active = false WHERE dealer_code = 'DLR9202';
SELECT pg_temp.expect_error('an inactive division',
  format($q$SELECT assign_division_owner(%L, 'ACCM', 'test.accm1', 'test.admin')$q$, pg_temp.div('DLR9202', 'Main Workshop')));
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM claim_owner_gaps WHERE dealer_code = 'DLR9202'), 'an inactive division is not a gap';
END $$;
UPDATE division SET is_active = true WHERE dealer_code = 'DLR9202';

-- History is protected
SELECT pg_temp.expect_error('deleting an assignment',            $q$DELETE FROM division_claim_owner WHERE user_id = 'test.ccm1'$q$);
SELECT pg_temp.expect_error('changing the person in place',      $q$UPDATE division_claim_owner SET user_id = 'test.both' WHERE user_id = 'test.ccm2'$q$);
SELECT pg_temp.expect_error('changing an ended assignment',
  format($q$UPDATE division_claim_owner SET end_reason = 'x' WHERE user_id = 'test.ccm1' AND division_id = %L$q$, pg_temp.div('DLR9201', 'Main Workshop')));
SELECT pg_temp.expect_error('ending without who',                $q$UPDATE division_claim_owner SET ended_at = now() WHERE user_id = 'test.ccm2'$q$);

-- Ending without a successor needs a reason and shows a gap
SELECT pg_temp.expect_error('ending without a reason',
  format($q$SELECT end_division_owner(%L, 'CCM', 'test.admin', '')$q$, pg_temp.div('DLR9201', 'EV Hub')));
SELECT end_division_owner(pg_temp.div('DLR9201', 'EV Hub'), 'CCM', 'test.admin', 'Division handed over');
SELECT pg_temp.expect_error('ending what is not there',
  format($q$SELECT end_division_owner(%L, 'CCM', 'test.admin', 'again')$q$, pg_temp.div('DLR9201', 'EV Hub')));
DO $$ BEGIN
  ASSERT (SELECT string_agg(gap, ',' ORDER BY gap) FROM claim_owner_gaps WHERE division_id = pg_temp.div('DLR9201', 'EV Hub')) = 'No ACCM,No CCM', 'gap after ending';
  ASSERT (SELECT count(*) FROM audit_log WHERE action = 'Claim Owner Ended' AND new_value = 'Division handed over') = 1, 'ending audited';
END $$;

-- A role cannot be removed while assigned with it
SELECT pg_temp.expect_error('removing the role of an assigned CCM', $q$DELETE FROM user_role WHERE user_id = 'test.ccm2' AND role_id = 'CCM'$q$);
SELECT pg_temp.expect_error('switching the role of an assigned ACCM', $q$UPDATE user_role SET role_id = 'READ_ONLY' WHERE user_id = 'test.accm1' AND role_id = 'ACCM'$q$);
DELETE FROM user_role WHERE user_id = 'test.both' AND role_id = 'ACCM';   -- not assigned as ACCM: allowed
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM user_role WHERE user_id = 'test.both' AND role_id = 'ACCM'), 'a role nobody relies on can be removed';
END $$;

-- A suspended person keeps the assignment but shows up as a gap; a deactivated person loses it
UPDATE app_user SET status = 'SUSPENDED' WHERE user_id = 'test.accm1';
DO $$ BEGIN
  ASSERT (SELECT gap FROM claim_owner_gaps WHERE division_id = pg_temp.div('DLR9201', 'Main Workshop')) = 'ACCM test.accm1 is SUSPENDED', 'suspended ACCM is a gap';
  ASSERT (SELECT count(*) FROM division_claim_owner WHERE user_id = 'test.accm1' AND ended_at IS NULL) = 1, 'but stays assigned';
END $$;
SELECT pg_temp.expect_error('assigning a suspended user',
  format($q$SELECT assign_division_owner(%L, 'ACCM', 'test.accm1', 'test.admin')$q$, pg_temp.div('DLR9202', 'Main Workshop')));
UPDATE app_user SET status = 'INACTIVE' WHERE user_id = 'test.accm1';
DO $$ BEGIN
  ASSERT (SELECT end_reason || '/' || ended_by FROM division_claim_owner WHERE user_id = 'test.accm1') = 'User deactivated/test.admin', 'deactivation ends the assignment';
  ASSERT (SELECT gap FROM claim_owner_gaps WHERE division_id = pg_temp.div('DLR9201', 'Main Workshop')) = 'No ACCM', 'and the division now has no ACCM';
  ASSERT (SELECT count(*) FROM audit_log WHERE action = 'Claim Assignments Ended' AND entity = 'test.accm1') = 1, 'audited once';
END $$;

-- -----------------------------------------------------------------------------
-- 2. KAM users
-- -----------------------------------------------------------------------------
SELECT set_config('test.k1', assign_kam('PV', 'test.kam1', 'West', 'Mumbai', 'test.admin')::text, false);
SELECT assign_kam('PV', 'test.kam2', ' west ', 'MUMBAI', 'test.admin');   -- several KAMs for one area are allowed
SELECT assign_kam('EV', 'test.kam1', 'West', 'Mumbai', 'test.admin');      -- the same person for another BU
DO $$ BEGIN
  ASSERT (SELECT string_agg(user_id, ',' ORDER BY user_id) FROM kams_for('PV', 'WEST', 'mumbai')) = 'test.kam1,test.kam2', 'KAMs of an area, any letter case';
  ASSERT (SELECT string_agg(user_id, ',') FROM kams_for('EV', 'West', 'Mumbai')) = 'test.kam1', 'per BU';
  ASSERT NOT EXISTS (SELECT 1 FROM kams_for('PV', 'North', 'Delhi')), 'nobody for an area without a KAM';
  ASSERT (SELECT zone FROM kam_assignment WHERE user_id = 'test.kam2') = 'west', 'spaces are trimmed';
  ASSERT (SELECT count(*) FROM audit_log WHERE action = 'KAM Assigned') = 3, 'KAM assignments audited';
END $$;
SELECT pg_temp.expect_error('the same KAM twice for one area', $q$SELECT assign_kam('PV', 'test.kam1', 'west', 'mumbai', 'test.admin')$q$);
SELECT pg_temp.expect_error('a BU other than PV / EV',          $q$SELECT assign_kam('CV', 'test.kam1', 'West', 'Pune', 'test.admin')$q$);
SELECT pg_temp.expect_error('a blank zone',                     $q$SELECT assign_kam('PV', 'test.kam1', ' ', 'Pune', 'test.admin')$q$);
SELECT pg_temp.expect_error('a KAM without the KAM role',       $q$SELECT assign_kam('PV', 'test.ccm2', 'West', 'Pune', 'test.admin')$q$);
SELECT pg_temp.expect_error('removing the KAM role while assigned', $q$DELETE FROM user_role WHERE user_id = 'test.kam1' AND role_id = 'KAM'$q$);
SELECT pg_temp.expect_error('ending a KAM without a reason',    format($q$SELECT end_kam(%s, 'test.admin', NULL)$q$, current_setting('test.k1')));
SELECT end_kam(current_setting('test.k1')::bigint, 'test.admin', 'Moved to EV only');
SELECT pg_temp.expect_error('ending a KAM twice',               format($q$SELECT end_kam(%s, 'test.admin', 'again')$q$, current_setting('test.k1')));
SELECT pg_temp.expect_error('deleting a KAM assignment',        $q$DELETE FROM kam_assignment WHERE user_id = 'test.kam2'$q$);
DO $$ BEGIN
  ASSERT (SELECT string_agg(user_id, ',') FROM kams_for('PV', 'West', 'Mumbai')) = 'test.kam2', 'an ended KAM is no longer returned';
  ASSERT (SELECT count(*) FROM audit_log WHERE action = 'KAM Ended' AND old_value = 'test.kam1') = 1, 'ending audited';
END $$;
SELECT assign_kam('PV', 'test.kam1', 'West', 'Mumbai', 'test.admin');      -- can be assigned again after ending
UPDATE app_user SET status = 'INACTIVE' WHERE user_id = 'test.kam1';
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM kam_assignment WHERE user_id = 'test.kam1' AND ended_at IS NULL), 'deactivation ends every KAM assignment';
  ASSERT (SELECT count(*) FROM kam_assignment WHERE user_id = 'test.kam1') = 3, 'history kept';
END $$;

-- -----------------------------------------------------------------------------
-- 3. Dealer scope, audit coverage
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tml_api_test') THEN CREATE ROLE tml_api_test; END IF;
END $$;
GRANT USAGE ON SCHEMA admin TO tml_api_test;
GRANT SELECT ON ALL TABLES IN SCHEMA admin TO tml_api_test;
SET ROLE tml_api_test;
SET app.dealer_code = 'DLR9202';
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM admin.division_claim_owner) = 1
     AND (SELECT count(*) FROM admin.division_claim_owner o JOIN admin.division d ON d.division_id = o.division_id WHERE d.dealer_code <> 'DLR9202') = 0,
         'a dealer sees only its own divisions'' mapping';
END $$;
RESET app.dealer_code;
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM admin.division_claim_owner) = 5, 'a TML user sees every mapping (current and ended)';
END $$;
RESET ROLE;

DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM audit_log_uncatalogued WHERE action NOT IN ('Test', 'Something New')), 'every action written is catalogued (the two dummy rows come from the part 1 and part 3 tests)';
  ASSERT (SELECT count(DISTINCT action) FROM audit_log WHERE action IN ('Claim Owner Assigned', 'Claim Owner Ended', 'KAM Assigned', 'KAM Ended', 'Claim Assignments Ended')) = 5,
         'these tests made the database write all 5 new actions';
END $$;

RESET app.user_id; RESET app.user_name;
SELECT 'claim people tests passed' AS result;
