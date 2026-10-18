-- =============================================================================
-- TML Service Transformation: people the Claims process routes to — CCM / ACCM per division and KAM users
-- Part 3b of the database design. Load AFTER schema.sql, schema_masters_crm.sql and schema_platform.sql:
--   psql -v ON_ERROR_STOP=1 -f docs/backend/schema.sql -f docs/backend/schema_masters_crm.sql \
--        -f docs/backend/schema_platform.sql -f docs/backend/schema_claim_people.sql
-- Self-checking tests: schema_claim_people_test.sql.  TEST DATA ONLY in this repository.
--
-- The Claims BA: "Division-wise CCM/ACCM mapping and KAM users are handled in User Management, not masters."
--   CCM / ACCM mapping: Dealer Code, Workshop / Division, CCM/ACCM Type, User (CRM ID, must exist), Active;
--                       one CCM and one ACCM per division.
--   KAM users (fleet goodwill): BU (PV / EV), User (CRM ID), Zone, Region, Active.
-- Level 2 of the Warranty Approval Matrix ("CCM/ACCM") resolves to the people mapped here for the request's division.
--
-- An assignment is never updated in place or deleted: changing the person ends the current row and starts a new one, so
-- the history of who was responsible when is kept (a claim decided last month shows who the CCM was then).
-- =============================================================================

SET search_path = admin, public;

-- The roles a person needs to be assigned (permissions follow roles, as everywhere else in the portal)
INSERT INTO app_role (role_id, role_name, description) VALUES
  ('CCM',  'Customer Care Manager',           'Claims: reviews authorization requests of the divisions mapped to them'),
  ('ACCM', 'Assistant Customer Care Manager', 'Claims: stands in for the CCM of the divisions mapped to them'),
  ('KAM',  'Key Account Manager',             'Claims: fleet goodwill for the BU, zone and region assigned to them')
ON CONFLICT (role_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 1. CCM / ACCM per division
-- -----------------------------------------------------------------------------
CREATE TABLE division_claim_owner (
  assignment_id    bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  division_id      uuid         NOT NULL REFERENCES division,
  owner_type       varchar(4)   NOT NULL CHECK (owner_type IN ('CCM', 'ACCM')),
  user_id          varchar(60)  NOT NULL REFERENCES app_user,
  assigned_at      timestamptz  NOT NULL DEFAULT now(),
  assigned_by      varchar(60)  NOT NULL,
  ended_at         timestamptz,
  ended_by         varchar(60),
  end_reason       varchar(200),
  CHECK ((ended_at IS NULL AND ended_by IS NULL) OR (ended_at IS NOT NULL AND ended_by IS NOT NULL)),
  CHECK (ended_at IS NULL OR ended_at >= assigned_at)
);
-- One CCM and one ACCM at a time per division (BA rule)
CREATE UNIQUE INDEX division_claim_owner_current ON division_claim_owner (division_id, owner_type) WHERE ended_at IS NULL;
CREATE INDEX division_claim_owner_user ON division_claim_owner (user_id) WHERE ended_at IS NULL;

-- -----------------------------------------------------------------------------
-- 2. KAM users
-- -----------------------------------------------------------------------------
-- Zone and region are kept as text for now: the Zone & Region master is still to be confirmed by the BAs, and the dealer table
-- holds North / South / East / West in a column called "region" (see the decisions in the design document).
CREATE TABLE kam_assignment (
  assignment_id    bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bu               varchar(2)   NOT NULL CHECK (bu IN ('PV', 'EV')),
  user_id          varchar(60)  NOT NULL REFERENCES app_user,
  zone             varchar(40)  NOT NULL CHECK (btrim(zone) <> ''),
  region           varchar(60)  NOT NULL CHECK (btrim(region) <> ''),
  assigned_at      timestamptz  NOT NULL DEFAULT now(),
  assigned_by      varchar(60)  NOT NULL,
  ended_at         timestamptz,
  ended_by         varchar(60),
  end_reason       varchar(200),
  CHECK ((ended_at IS NULL AND ended_by IS NULL) OR (ended_at IS NOT NULL AND ended_by IS NOT NULL)),
  CHECK (ended_at IS NULL OR ended_at >= assigned_at)
);
-- The same person cannot be assigned twice to the same BU, zone and region (several KAMs per area are allowed)
CREATE UNIQUE INDEX kam_assignment_current ON kam_assignment (bu, user_id, lower(zone), lower(region)) WHERE ended_at IS NULL;
CREATE INDEX kam_assignment_area ON kam_assignment (bu, lower(zone), lower(region)) WHERE ended_at IS NULL;

-- -----------------------------------------------------------------------------
-- 3. Rules that hold however a row is written
-- -----------------------------------------------------------------------------
-- The person must be an ACTIVE CRM user holding the matching role. Rows are history: only ending an open row is allowed.
CREATE FUNCTION claim_people_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_role varchar(4); u app_user%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION '% keeps history: end the assignment instead of deleting it', TG_TABLE_NAME; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.ended_at IS NOT NULL THEN RAISE EXCEPTION 'Assignment % has ended and cannot be changed', OLD.assignment_id; END IF;
    IF NEW.ended_at IS NULL OR (to_jsonb(NEW) - '{ended_at,ended_by,end_reason}'::text[]) <> (to_jsonb(OLD) - '{ended_at,ended_by,end_reason}'::text[]) THEN
      RAISE EXCEPTION 'An assignment can only be ended; to change the person, end it and assign again';
    END IF;
    RETURN NEW;
  END IF;

  v_role := CASE TG_TABLE_NAME WHEN 'kam_assignment' THEN 'KAM' ELSE to_jsonb(NEW) ->> 'owner_type' END;
  SELECT * INTO u FROM app_user WHERE user_id = NEW.user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown user %', NEW.user_id; END IF;
  IF u.status <> 'ACTIVE' THEN RAISE EXCEPTION 'User % is % and cannot be assigned', NEW.user_id, u.status; END IF;
  IF u.user_type <> 'CRM' THEN RAISE EXCEPTION 'User % needs a CRM ID (user type CRM) to be assigned as %', NEW.user_id, v_role; END IF;
  IF NOT EXISTS (SELECT 1 FROM user_role WHERE user_id = NEW.user_id AND role_id = v_role) THEN
    RAISE EXCEPTION 'User % does not hold the role %', NEW.user_id, v_role;
  END IF;
  IF TG_TABLE_NAME = 'division_claim_owner' THEN
    IF NOT EXISTS (SELECT 1 FROM division d JOIN dealer r ON r.dealer_code = d.dealer_code WHERE d.division_id = NEW.division_id AND d.is_active AND r.is_active) THEN
      RAISE EXCEPTION 'Division % is not active (or its dealer is not)', NEW.division_id;
    END IF;
    IF EXISTS (SELECT 1 FROM division_claim_owner WHERE division_id = NEW.division_id AND owner_type <> NEW.owner_type
                AND user_id = NEW.user_id AND ended_at IS NULL) THEN
      RAISE EXCEPTION 'User % cannot be both CCM and ACCM of the same division', NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER division_claim_owner_guard BEFORE INSERT OR UPDATE OR DELETE ON division_claim_owner FOR EACH ROW EXECUTE FUNCTION claim_people_guard();
CREATE TRIGGER kam_assignment_guard BEFORE INSERT OR UPDATE OR DELETE ON kam_assignment FOR EACH ROW EXECUTE FUNCTION claim_people_guard();

-- A role cannot be taken away from someone who is still assigned with it (end the assignment first)
CREATE FUNCTION user_role_claim_people_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.role_id = OLD.role_id AND NEW.user_id = OLD.user_id THEN RETURN NEW; END IF;
  IF OLD.role_id IN ('CCM', 'ACCM') AND EXISTS (SELECT 1 FROM division_claim_owner WHERE user_id = OLD.user_id AND owner_type = OLD.role_id AND ended_at IS NULL)
     OR OLD.role_id = 'KAM' AND EXISTS (SELECT 1 FROM kam_assignment WHERE user_id = OLD.user_id AND ended_at IS NULL) THEN
    RAISE EXCEPTION 'User % is still assigned as %: end the assignment before removing the role', OLD.user_id, OLD.role_id;
  END IF;
  IF TG_OP = 'UPDATE' THEN RETURN NEW; END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER user_role_claim_people BEFORE DELETE OR UPDATE ON user_role FOR EACH ROW EXECUTE FUNCTION user_role_claim_people_guard();

-- Someone who leaves (status INACTIVE) is no longer responsible for anything: their assignments end at once.
-- A temporary state (SUSPENDED, LOCKED) keeps the assignment, but the division shows up in claim_owner_gaps.
CREATE FUNCTION app_user_inactive_ends_assignments() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE n integer; m integer; v_by varchar(60) := coalesce(nullif(current_setting('app.user_id', true), ''), 'system');
BEGIN
  IF NEW.status = 'INACTIVE' AND OLD.status IS DISTINCT FROM 'INACTIVE' THEN
    UPDATE division_claim_owner SET ended_at = now(), ended_by = v_by, end_reason = 'User deactivated' WHERE user_id = NEW.user_id AND ended_at IS NULL;
    GET DIAGNOSTICS n = ROW_COUNT;
    UPDATE kam_assignment SET ended_at = now(), ended_by = v_by, end_reason = 'User deactivated' WHERE user_id = NEW.user_id AND ended_at IS NULL;
    GET DIAGNOSTICS m = ROW_COUNT;
    IF n + m > 0 THEN
      PERFORM write_audit('Claim Assignments Ended', 'Administration', NEW.user_id, format('%s CCM/ACCM, %s KAM', n, m), 'User deactivated');
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER app_user_inactive_claim_people AFTER UPDATE OF status ON app_user FOR EACH ROW EXECUTE FUNCTION app_user_inactive_ends_assignments();

-- -----------------------------------------------------------------------------
-- 4. The functions the API calls
-- -----------------------------------------------------------------------------
-- Makes p_user the CCM or ACCM of a division. The current person (if any) is ended in the same transaction.
-- Assigning the person who already holds it changes nothing. Returns the new assignment id (or the existing one).
CREATE FUNCTION assign_division_owner(p_division uuid, p_type varchar, p_user varchar, p_by varchar, p_reason varchar DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE cur division_claim_owner%ROWTYPE; v_id bigint; v_label text;
BEGIN
  IF p_type NOT IN ('CCM', 'ACCM') THEN RAISE EXCEPTION 'Type must be CCM or ACCM'; END IF;
  SELECT d.dealer_code || ' / ' || d.division_name INTO v_label FROM division d WHERE d.division_id = p_division;
  IF v_label IS NULL THEN RAISE EXCEPTION 'Unknown division %', p_division; END IF;
  SELECT * INTO cur FROM division_claim_owner WHERE division_id = p_division AND owner_type = p_type AND ended_at IS NULL FOR UPDATE;
  IF FOUND AND cur.user_id = p_user THEN RETURN cur.assignment_id; END IF;
  IF FOUND THEN
    UPDATE division_claim_owner SET ended_at = now(), ended_by = p_by, end_reason = coalesce(p_reason, 'Replaced by ' || p_user)
     WHERE assignment_id = cur.assignment_id;
  END IF;
  INSERT INTO division_claim_owner (division_id, owner_type, user_id, assigned_by) VALUES (p_division, p_type, p_user, p_by)
  RETURNING assignment_id INTO v_id;
  PERFORM write_audit('Claim Owner Assigned', 'Administration', p_type || ' of ' || v_label, cur.user_id, p_user);
  RETURN v_id;
END $$;

-- Ends the CCM or ACCM of a division without a successor (the division then shows up in claim_owner_gaps)
CREATE FUNCTION end_division_owner(p_division uuid, p_type varchar, p_by varchar, p_reason varchar) RETURNS void LANGUAGE plpgsql AS $$
DECLARE cur division_claim_owner%ROWTYPE;
BEGIN
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'A reason is required to end an assignment without a successor'; END IF;
  UPDATE division_claim_owner SET ended_at = now(), ended_by = p_by, end_reason = p_reason
   WHERE division_id = p_division AND owner_type = p_type AND ended_at IS NULL RETURNING * INTO cur;
  IF NOT FOUND THEN RAISE EXCEPTION 'Division % has no current %', p_division, p_type; END IF;
  PERFORM write_audit('Claim Owner Ended', 'Administration',
                      p_type || ' of ' || (SELECT dealer_code || ' / ' || division_name FROM division WHERE division_id = p_division), cur.user_id, p_reason);
END $$;

-- Assigns a KAM to a BU, zone and region. Returns the assignment id.
CREATE FUNCTION assign_kam(p_bu varchar, p_user varchar, p_zone varchar, p_region varchar, p_by varchar) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE v_id bigint;
BEGIN
  INSERT INTO kam_assignment (bu, user_id, zone, region, assigned_by) VALUES (p_bu, p_user, btrim(p_zone), btrim(p_region), p_by)
  RETURNING assignment_id INTO v_id;
  PERFORM write_audit('KAM Assigned', 'Administration', format('%s %s / %s', p_bu, btrim(p_zone), btrim(p_region)), NULL, p_user);
  RETURN v_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'User % is already KAM for % %/%', p_user, p_bu, p_zone, p_region;
END $$;

CREATE FUNCTION end_kam(p_assignment bigint, p_by varchar, p_reason varchar) RETURNS void LANGUAGE plpgsql AS $$
DECLARE k kam_assignment%ROWTYPE;
BEGIN
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'A reason is required to end a KAM assignment'; END IF;
  UPDATE kam_assignment SET ended_at = now(), ended_by = p_by, end_reason = p_reason WHERE assignment_id = p_assignment AND ended_at IS NULL RETURNING * INTO k;
  IF NOT FOUND THEN RAISE EXCEPTION 'KAM assignment % is not current', p_assignment; END IF;
  PERFORM write_audit('KAM Ended', 'Administration', format('%s %s / %s', k.bu, k.zone, k.region), k.user_id, p_reason);
END $$;

-- -----------------------------------------------------------------------------
-- 5. What screens, routing and governance read
-- -----------------------------------------------------------------------------
-- Who the CCM and ACCM of a division are (or were) at a given moment: used to route level 2 of the approval matrix,
-- and to show who was responsible for an old claim.
CREATE FUNCTION division_claim_owners(p_division uuid, p_at timestamptz DEFAULT now())
RETURNS TABLE (owner_type varchar, user_id varchar, full_name varchar, user_status varchar) LANGUAGE sql STABLE AS $$
  SELECT o.owner_type, o.user_id, u.full_name, u.status
    FROM division_claim_owner o JOIN app_user u ON u.user_id = o.user_id
   WHERE o.division_id = p_division AND o.assigned_at <= p_at AND (o.ended_at IS NULL OR o.ended_at > p_at)
   ORDER BY o.owner_type;
$$;

-- The KAMs of a BU, zone and region today (zone and region matched without regard to case)
CREATE FUNCTION kams_for(p_bu varchar, p_zone varchar, p_region varchar)
RETURNS TABLE (user_id varchar, full_name varchar, user_status varchar) LANGUAGE sql STABLE AS $$
  SELECT k.user_id, u.full_name, u.status FROM kam_assignment k JOIN app_user u ON u.user_id = k.user_id
   WHERE k.ended_at IS NULL AND k.bu = p_bu AND lower(k.zone) = lower(btrim(p_zone)) AND lower(k.region) = lower(btrim(p_region))
   ORDER BY k.assigned_at;
$$;

-- Every active division with its current CCM and ACCM (the "Claims people" screen of User Management)
CREATE VIEW division_claim_owner_status AS
SELECT d.dealer_code, r.dealer_name, d.division_id, d.division_name,
       ccm.user_id AS ccm_user_id,  ccm_u.full_name AS ccm_name,  ccm_u.status AS ccm_status,
       accm.user_id AS accm_user_id, accm_u.full_name AS accm_name, accm_u.status AS accm_status
  FROM division d JOIN dealer r ON r.dealer_code = d.dealer_code AND r.is_active
  LEFT JOIN division_claim_owner ccm  ON ccm.division_id = d.division_id  AND ccm.owner_type = 'CCM'  AND ccm.ended_at IS NULL
  LEFT JOIN app_user ccm_u  ON ccm_u.user_id = ccm.user_id
  LEFT JOIN division_claim_owner accm ON accm.division_id = d.division_id AND accm.owner_type = 'ACCM' AND accm.ended_at IS NULL
  LEFT JOIN app_user accm_u ON accm_u.user_id = accm.user_id
 WHERE d.is_active;

-- Governance: divisions where a claim at level 2 could get stuck (should be empty before go-live)
CREATE VIEW claim_owner_gaps AS
SELECT dealer_code, division_id, division_name, gap FROM (
  SELECT s.*, unnest(ARRAY[
           CASE WHEN ccm_user_id IS NULL THEN 'No CCM' WHEN ccm_status <> 'ACTIVE' THEN 'CCM ' || ccm_user_id || ' is ' || ccm_status END,
           CASE WHEN accm_user_id IS NULL THEN 'No ACCM' WHEN accm_status <> 'ACTIVE' THEN 'ACCM ' || accm_user_id || ' is ' || accm_status END]) AS gap
    FROM division_claim_owner_status s) x
 WHERE gap IS NOT NULL;

-- Dealer Admins see only their own dealer's mapping (TML users see all), as for the other dealer data
ALTER TABLE division_claim_owner ENABLE ROW LEVEL SECURITY;
CREATE POLICY division_claim_owner_dealer_scope ON division_claim_owner
  USING (coalesce(current_setting('app.dealer_code', true), '') = ''
         OR division_id IN (SELECT division_id FROM division WHERE dealer_code = current_setting('app.dealer_code', true)));

-- Audit actions written by this part (the catalogue is in part 3)
INSERT INTO audit_action_catalog (action, module, description, written_by, is_security, is_dpdp) VALUES
  ('Claim Owner Assigned',    'Administration', 'A CCM or ACCM was assigned to a division (old and new person).',              'DB', true, false),
  ('Claim Owner Ended',       'Administration', 'The CCM or ACCM of a division was ended without a successor.',               'DB', true, false),
  ('KAM Assigned',            'Administration', 'A KAM was assigned to a BU, zone and region.',                               'DB', true, false),
  ('KAM Ended',               'Administration', 'A KAM assignment was ended.',                                                'DB', true, false),
  ('Claim Assignments Ended', 'Administration', 'A user was deactivated and their CCM / ACCM / KAM assignments ended.',       'DB', true, false);
