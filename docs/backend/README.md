# Backend Design — TML Service Transformation Admin Portal

| | |
| --- | --- |
| **API contract** | [`public/api-docs/openapi.yaml`](../../public/api-docs/openapi.yaml), browsable at **`<portal>/api-docs/`** on the live site |
| **Database** | [`schema.sql`](schema.sql) (PostgreSQL 16) + self-checking tests [`schema_test.sql`](schema_test.sql), run in CI on every change |
| **Masters from CRM + business control** | [`schema_masters_crm.sql`](schema_masters_crm.sql) (part 2, loads on top of `schema.sql`) + tests [`schema_masters_crm_test.sql`](schema_masters_crm_test.sql); approach in [`MASTER_DATA_STRATEGY.md`](MASTER_DATA_STRATEGY.md); the review document for the architect is built with `npm run backend-doc` |
| **Platform: configuration, devices, sessions, default views, audit coverage** | [`schema_platform.sql`](schema_platform.sql) (part 3, loads on top of parts 1 and 2) + tests [`schema_platform_test.sql`](schema_platform_test.sql); CCM / ACCM and KAM users in [`schema_claim_people.sql`](schema_claim_people.sql) (part 3b, section 16); summary in section 14 below; endpoints under the tags *Configuration*, *Devices & sessions* and *Default views* of the API contract |
| **Business rules** | Already written and unit-tested in the portal: `src/utils/eqcRules.ts`, `bodyshopRules.ts`, `bayGovernance.ts`, `holidayCalendar.ts`, `masterValidationSchema.ts`, `smartExcelImport.ts` |
| **Status** | Design ready for review by TML IT / architecture. Today the portal keeps data in each user's browser; this backend makes it shared and production-grade. |

---

## 1. The idea in one picture

**Masters are data, not tables.** A new master, or a field the BAs missed, is a row in `master_definition` / `master_field`,
and its rows are JSON in `master_record`. That's why the pending BA masters **do not block** the backend: when they
arrive they are uploaded (Smart Excel Import) as data. No new tables, APIs or deployments are needed.

```mermaid
flowchart LR
  subgraph Users
    BA[BA / TML Admin<br/>Admin Portal]
    DA[Dealer Admin<br/>Admin Portal]
    APP[Dealer applications<br/>built by TML developers]
  end
  SSO[(TML SSO<br/>OIDC / Azure AD)]
  GW[TML API gateway]
  API[Admin API service<br/>stateless, horizontally scaled]
  DB[(PostgreSQL 16<br/>masters · bays · calendars · audit)]
  OBJ[(Object storage<br/>uploaded Excel, GC images)]
  MAIL[E-mail worker<br/>reads outbox]
  SMTP[[TML mail relay]]
  SIEBEL[(Siebel extract)]

  BA & DA -->|HTTPS + token| GW
  APP -->|client credentials| GW
  BA & DA & APP -. sign in .-> SSO
  GW --> API --> DB
  API --> OBJ
  DB --> MAIL --> SMTP
  SIEBEL -->|one-time loader via Import API| API
```

## 2. Key decisions

| Decision | Why |
| --- | --- |
| **Generic master engine** (definition + fields + JSONB records) | BAs add masters and fields at run time, so the backend does too. One set of endpoints serves every master. |
| **PostgreSQL 16 + JSONB** | Relational integrity for workflows (bays, approvals) plus flexible master rows; GIN index for JSON lookups; widely supported by TML IT. |
| **Version number per master** (`master_definition.version`, `master_record.changed_in_version`) | Dealer apps sync only what changed since their last version, which suits 580+ dealers polling. |
| **Business rules run on the server** (`/rules/eqc/resolve`, `/rules/bodyshop/inventory-capture`) | Dealer apps never re-implement "blank PPL = all PPLs" etc.; one source of truth. The rule code is ported from the portal with its unit tests. |
| **Preview → commit for every import** | BAs see every error and gap (with Excel row numbers) before anything is saved; the commit is all-or-nothing. |
| **Transactional e-mail outbox** | The approval e-mail is written in the same transaction as the request, so it is never lost or sent for a rolled-back change. |
| **Row-level security** for dealer users | A Dealer Admin can only see and change their own dealer's rows, enforced in the database as well as the API. |
| **Append-only audit log** (trigger blocks UPDATE/DELETE) | Required for governance; also feeds the portal's Audit Log and Change Log. |
| **Optimistic locking** (`ETag` / `If-Match`) | Two admins editing the same row never silently overwrite each other. |

## 3. Data model

```mermaid
erDiagram
  MASTER_DEFINITION ||--o{ MASTER_FIELD : has
  MASTER_DEFINITION ||--o{ MASTER_RECORD : has
  MASTER_RECORD ||--o{ MASTER_RECORD_HISTORY : "every change"
  MASTER_DEFINITION ||--o{ MASTER_DEFINITION_HISTORY : "every structural change"
  IMPORT_JOB ||--o{ MASTER_RECORD_HISTORY : "changes from an import"
  DEALER ||--o{ DIVISION : runs
  DEALER ||--o{ BAY : owns
  DIVISION ||--o{ BAY : contains
  DIVISION ||--o{ BAY_ALLOCATION : "TML allocation"
  BAY ||--o{ BAY_REQUEST : "add / status change"
  DIVISION ||--o{ CALENDAR_WEEKLY_PATTERN : "7 days"
  DIVISION ||--o{ CALENDAR_DATE_OVERRIDE : "holidays / half days"
  APP_USER }o--o{ APP_ROLE : "user_role"
  APP_ROLE ||--o{ ROLE_PERMISSION : grants
  APP_USER ||--o{ NOTIFICATION : receives

  MASTER_DEFINITION {
    varchar master_id PK
    varchar logical_group
    varchar module_code
    varchar owner "TML_ADMIN | DEALER_ADMIN"
    varchar rule_set "eqc | bodyshop | null"
    int version "bumped on every change"
  }
  MASTER_FIELD {
    varchar field_key PK
    varchar field_type "text number select boolean date"
    jsonb options
    bool is_mandatory
    jsonb validation "min max pattern dates"
    bool display_in_dealer_app
  }
  MASTER_RECORD {
    varchar record_id PK
    jsonb data
    int changed_in_version
    int row_version
  }
  BAY {
    uuid bay_id PK
    varchar bay_status "Active | Inactive"
    varchar approval_status "Draft Approved Pending Rejected"
  }
  BAY_REQUEST {
    uuid request_id PK
    varchar kind "ADD_BAY | STATUS_CHANGE"
    varchar approver_role
    varchar status "PENDING APPROVED REJECTED"
  }
```

Rules enforced **inside the database** (all proven by `schema_test.sql`):

- master id / field key format; `id` is reserved; a dropdown needs 2+ options; record data must be an object
- only **Approved** bays can be **Active**; bay names are unique per dealer (case-insensitive)
- **one open request per bay**; a **rejection needs a note**; a status change needs from/to
- allocation 0–500; calendar open < close; an hours override needs both times
- audit log cannot be edited or deleted; every record change bumps the master version and writes history
- dealer users see only their own dealer (row-level security)
- **Fleet flag**: chassis must be a 17-character VIN; Valid To ≥ Valid From; `customer_category(chassis, day)` returns
  FLEET only for an active row inside its validity (else INDIVIDUAL); the fleet-upload privilege is
  `role_permission (module 'FLEET', can_create)`
- **ID chain under a JC** (`journey_id_link`, `customer_update`): an ID belongs to one JC; one Appointment / Visit / SR /
  Pre-JC / JC per JC, several MRs; a JC link carries its own number; a customer update points at a known ID and holds
  no personal data. See `docs/FLEET_AND_ID_CHAIN.md` for the assumptions (BA gave no further detail)

## 4. How a new master flows (no deployment)

```mermaid
sequenceDiagram
  autonumber
  actor BA
  participant Portal as Admin Portal
  participant API
  participant DB as PostgreSQL
  participant App as Dealer app
  BA->>Portal: Smart Excel Import (BA's own Excel)
  Portal->>API: POST /imports (file or parsed payload)
  API->>API: detect tables, infer types, validate, find gaps
  API->>DB: import_job (PREVIEW) + original file in object storage
  API-->>Portal: preview: masters, columns, errors, gaps with Excel rows
  BA->>Portal: adjust names / group / types, click Create
  Portal->>API: POST /imports/{id}/commit
  API->>DB: one transaction: master_definition + fields + records (+history, version++)
  API-->>Portal: committed, audit logged
  App->>API: GET /dealer/masters/{id}/records?sinceVersion=N
  API-->>App: only the changed / deleted rows + currentVersion
```

## 5. Bay approval flow

```mermaid
sequenceDiagram
  autonumber
  actor DA as Dealer Admin
  participant API
  participant DB as PostgreSQL
  participant W as E-mail worker
  actor NM as TML Network Manager
  DA->>API: POST /bays (beyond allocation, justification)
  API->>DB: bay (Pending Approval, Inactive) + bay_request + notification + email_outbox — one transaction
  W->>DB: pick QUEUED e-mail
  W-->>NM: e-mail with deep link /admin/bay-approvals?request=…
  NM->>API: POST /bay-requests/{id}/decision (APPROVED)
  API->>DB: request APPROVED + bay Approved/Active + audit — one transaction
  API-->>DA: notification in the bell
```

Status changes follow the same pattern, with **TML Admin (L1/L2)** as approver. The *Bay status policy* switches
(`/bay-policy`) decide whether a Dealer Admin may change status, and whether it needs approval.

## 6. Validation layers (same rules as the portal, never weaker)

1. **Field rules** from `master_field`: type, mandatory, dropdown options, min/max, pattern, date range.
   This is a port of `src/utils/masterValidationSchema.ts`.
2. **Master business rules** chosen by `master_definition.rule_set`: ports of `eqcRules.ts` and `bodyshopRules.ts`
   (cross-field checks, duplicates, Red < Orange …). The portal's unit tests become the backend's contract tests.
3. **No-code rules** from `master_rule` (set by the TML Admin in the portal's Rules tab or the BA workbook "Rules"
   sheet): Required when, No duplicates, From ≤ To, Allowed values depend on another field, Must exist in another
   master, Number between, Format. Severity error = refuse, warning = save and report. Port of
   `src/utils/masterRules.ts`; its unit tests are the contract. Plain code — no AI or external service.
4. **Database constraints** (section 3), the last line of defence.

Errors are returned as `application/problem+json` with the field, and for imports also the sheet and Excel row.

## 7. Roles and access

| Role | Masters | Records | Imports | Bays | Approve | Audit |
| --- | --- | --- | --- | --- | --- | --- |
| **TML_ADMIN** (L1/L2) | create / change | all | yes | all dealers, direct status change | status changes | view / export |
| **TML_NETWORK_MANAGER** | view | view | — | view | additional bays | view |
| **BA** | create / change | all | yes | view | — | view |
| **DEALER_ADMIN** | view | DEALER_ADMIN-owned masters, own dealer only | — | own dealer: add, draft, send, request status change | — | own actions |
| **READ_ONLY** | view | view | — | view | — | view |
| **DEALER_APP** (service) | published only | read / sync | — | read | — | — |

Identity comes from TML SSO (OIDC). `GET /me` returns roles, permissions and the dealer scope, and the portal hides
what the user can't do. The API and the database enforce it regardless.

## 8. For the dealer-app developers

- **Load once, then sync deltas:** `GET /dealer/masters` (versions) → `GET /dealer/masters/{id}/records` → later
  `?sinceVersion=<last currentVersion>`; `If-None-Match` gives `304` when nothing changed.
- **Don't re-implement rules:** call `POST /rules/eqc/resolve` (GC mandate, steps, PTD colour, DID check, checklists)
  and `POST /rules/bodyshop/inventory-capture` (sections, checkpoints, evidence, insurance documents).
- Only fields with `displayInDealerApp = true` are exposed, with `dealerDisplayLabel` and `valueMapping`.
- Holiday-aware scheduling: `GET /calendars/{divisionId}?month=YYYY-MM` returns the effective hours per day.

## 9. Switching the portal from browser storage to the API

| Portal today (`src/context/…`) | API |
| --- | --- |
| `AppContext.createMaster` | `POST /masters` |
| `AppContext.updateMasterConfig` (fields, records) | `POST/PATCH /masters/{id}/fields…`, `POST/PUT/DELETE /masters/{id}/records…`, `POST /masters/{id}/records/bulk` |
| `AppContext.importMasters` (BA Workbook, Smart Excel Import) | `POST /imports` → `POST /imports/{id}/commit` |
| `BayContext.addBay` / `submitBays` / `changeBayStatus` | `POST /bays`, `POST /bays/submit`, `POST /bays/{id}/status-change` |
| `BayContext.decideRequest` | `POST /bay-requests/{id}/decision` |
| `BayContext.setAllocation` / `setPolicy` | `PUT /bay-allocations`, `PUT /bay-policy` |
| Holiday calendar state (MastersMaintenancePage) | `GET /calendars/{id}`, `PUT …/weekly-pattern`, `PUT/DELETE …/dates/{date}`, `POST …/bulk-holiday` |
| `logAudit`, `addNotification` | written by the API automatically; read via `GET /audit-log`, `GET /notifications` |
| Role switcher (prototype only) | removed; roles come from SSO via `GET /me` |

The screens stay the same; each context function swaps its `setState` for an API call. That's a contained change.

## 10. Non-functional

| Topic | Approach |
| --- | --- |
| Volume | ~580+ dealers, hundreds of masters, up to ~100k rows per large master; read-heavy |
| Performance targets | p95 < 300 ms for reads and rule resolution, < 1 s for writes; imports of 5,000 rows < 30 s |
| Caching | ETag / `304` on dealer reads; optional Redis for `/rules/*` keyed by master versions |
| Audit growth | partition `audit_log` by month; keep 7 years (or TML policy); archive older partitions |
| Backups | daily full + PITR (WAL archiving); restore drill each quarter |
| Observability | correlation id per request (also stored in `audit_log`), structured logs, metrics per endpoint, alert on outbox failures |
| Security | TLS everywhere, SSO tokens, least-privilege DB user (non-owner, so row-level security applies), VAPT before go-live, files virus-scanned before parsing |

## 11. Siebel migration

1. Extract Siebel master data to staging tables (TML IT).
2. Load each master through `POST /imports` (`BULK_RECORDS` or `BA_WORKBOOK`) with `dryRun`, reusing the same validation as BAs.
3. Reconciliation report per master: rows in Siebel vs loaded vs rejected, with reasons.
4. Freeze, final delta load, cut-over.

## 12. Suggested build order

1. Foundation: SSO, `/me`, roles, audit, problem+json errors, CI with this schema and tests.
2. Master engine: definitions, fields, records, history, field validation, export.
3. Imports: preview / commit for Smart Excel, BA workbook, bulk records.
4. Dealer read API and rule resolution (EQC, Bodyshop, calendar).
5. Bays: allocation, add / submit / status change, approvals, outbox e-mails.
6. Switch the portal screens from browser storage to the API (section 9); Siebel loads; performance tests; VAPT.

## 13. Decisions needed from TML IT

- Backend language/framework (the design is stack-neutral; Java / Spring Boot or Node / NestJS both fit).
- Hosting (TML cloud tenant / on-prem), environments (DEV / UAT / PROD), API gateway.
- SSO tenant and role mapping (AD groups → roles above).
- Mail relay for approval e-mails; object storage for files and GC images.
- Data retention for audit and import files.

## 14. Part 3: configuration, devices, sessions, default views, audit coverage

Part 3 gives the Admin Portal screens **Configuration, Devices, Sessions and Default Views** a shared, governed home, and makes
the **Audit Log** complete. Identity and passwords stay with TML SSO; part 3 stores only what the portal itself must control.

| Area | Tables | Rules enforced in the database |
| --- | --- | --- |
| Configuration | `system_setting`, `system_setting_history` | 16 portal settings + 1 new (`session.history_retention_days`); typed (number / switch), range-checked, idle timeout ≤ session timeout; stale saves refused (`row_version`); history and audit on every change |
| Devices | `user_device`, `user_device_event` | Only a SHA-256 fingerprint is stored. A new device is PENDING until a TML admin approves it (when *Device registration required* is on) and the admins get a notification. Block needs a reason; blocking or deactivating ends the device's sessions |
| Sessions | `user_session`, `login_attempt`, view `user_session_status` | Sign-in refused for a user or device that is not ACTIVE; concurrent limit ends the least recently used session; session and idle timeouts; an ended session can never be reopened; suspending, locking or deactivating a user, or an SSO password change, ends their sessions; *N* failed sign-ins in a row lock the account for the configured time (admins notified) and the lock lifts itself at the next sign-in after that time; housekeeping removes history older than the retention |
| Default views | `ui_card`, `ui_tab`, `ui_list`, `ui_list_column`, `default_view_policy`, `default_view_card / _tab / _column`, `default_view_history` | Per role, with `*` as the default for every role without its own view. At least one card and two tabs visible, landing tab visible, pinned columns visible, unknown or retired items refused; versions and history; personal layouts are **not** stored (BU decision 6 Oct 2026: session only) |
| Audit coverage | `audit_action_catalog`, views `audit_log_uncatalogued`, `audit_log_security` | Every action is catalogued with who writes it (14 by the database, the rest by the API), whether it is security-relevant and whether it is a DPDP personal-data access (`UNMASK_PII`, `CTI_CALL`, `EXPORT_WORKLIST`). The governance view must stay empty |

Housekeeping jobs the API runs: `expire_sessions()` every few minutes, `purge_session_history()` daily.
Every API request calls `touch_session(sessionId)`; `false` means "sign in again".

Decisions for the architect (part 3): which role's default view a user with several roles gets (proposal: a fixed role
priority, TML_ADMIN first); whether workshop devices report a MAC address through MDM (the column is ready, browsers cannot read it);
whether failed sign-ins at SSO are forwarded to the portal (otherwise only portal-side failures count towards the lock).

## 15. Rule endpoints for THD and Claims, users and roles (API contract)

Added to `public/api-docs/openapi.yaml`. No new database tables: the users, roles, permissions and
employee-profile tables already exist in `schema.sql`, and the THD and Claims masters are ordinary masters.

| Area | Endpoints | Notes |
| --- | --- | --- |
| THD rules | `POST /rules/thd/auto-trigger` | Which auto-THD rules fire for a job card event, and which are still waiting for a Time Window from business. Same rules as `thdRules.ts` |
| Claims rules | `POST /rules/claims/route`, `POST /rules/claims/goodwill-category` | Who approves a request of a given amount (limit inclusive), and the Issue Type / Category of a Goodwill Request. Same rules as `claimRules.ts` |
| Users | `GET/POST /users`, `GET/PATCH /users/{id}`, `POST /users/{id}/status` | Status actions ACTIVATE, SUSPEND, DEACTIVATE, UNLOCK; the database ends the user's sessions when a user is suspended, locked or deactivated |
| Bulk upload of users | `POST /imports` with kind `USER_LIST` | Same preview, then commit, as the other imports; duplicates, unknown roles and dealers, invalid e-mail or mobile are reported with the Excel row |
| Roles | `GET/POST /roles`, `GET/PATCH /roles/{id}`, `PUT /roles/{id}/permissions` | The permission matrix of a role is replaced in one transaction |
| Employee profiles | `GET/PUT /employees/{id}/profile` | Employment details, skills and certificates |

The worked examples of the three rule endpoints are proven against the real rules by `src/utils/__tests__/apiRuleContract.test.ts`.

Points for the architect: (1) the portal's user record has department, zone and workshop, which the database does not hold on
the user (region comes from the dealer): where should they live? (2) users created by bulk upload start ACTIVE (the database
default) unless the file says otherwise; or should they start PENDING until the first SSO sign-in? (3) row-level security by dealer
exists for sessions, devices and sign-ins but not yet for the user list, so for now the API enforces "a Dealer Admin sees and
changes only their own dealer's users"; add the same rule in the database? (4) "a role that active users still hold cannot be
made inactive" is an API rule, not a database rule.

## 16. Part 3b: CCM / ACCM per division and KAM users

[`schema_claim_people.sql`](schema_claim_people.sql) + tests [`schema_claim_people_test.sql`](schema_claim_people_test.sql)
(36 checks, 25 refused wrong actions). The Claims BA keeps these in User Management, not masters.

- `division_claim_owner`: one current CCM and one current ACCM per active division; never the same person for both. Level 2 of
  the Warranty Approval Matrix resolves to them (`division_claim_owners(division, at)` also answers "who was it when this claim was decided").
- `kam_assignment`: KAM users per BU (PV / EV), zone and region; several per area allowed, not the same person twice.
- The person must be an ACTIVE CRM user holding the role CCM, ACCM or KAM (roles added here). A role cannot be removed while assigned.
- Rows are history: changing the person ends the current row and starts a new one; nothing is edited or deleted. Deactivating a
  user ends their assignments; a suspended or locked person stays assigned but shows in `claim_owner_gaps` (should be empty at go-live).
- Dealer Admins see only their own dealer's mapping (row-level security). 5 audit actions, written by the database and catalogued.
- API: tag *Claims people* (`/claim-owners`, `/divisions/{id}/claim-owners…`, `/kams…`); bulk upload as `/imports` kinds `CCM_ACCM_LIST` and `KAM_LIST`.

Open for the architect: the zone / region naming (the dealer table's "region" holds North / South / East / West), and the defaults
above (role required, several KAMs per area, what happens when a person leaves).

## Verify locally

```bash
# Database: load the schema and run its tests (needs PostgreSQL 16)
createdb tml && psql -d tml -v ON_ERROR_STOP=1 -f docs/backend/schema.sql -f docs/backend/schema_test.sql \
  -f docs/backend/schema_masters_crm.sql -f docs/backend/schema_masters_crm_test.sql \
  -f docs/backend/schema_platform.sql -f docs/backend/schema_platform_test.sql \
  -f docs/backend/schema_claim_people.sql -f docs/backend/schema_claim_people_test.sql
# API contract
npx @redocly/cli lint public/api-docs/openapi.yaml
```
