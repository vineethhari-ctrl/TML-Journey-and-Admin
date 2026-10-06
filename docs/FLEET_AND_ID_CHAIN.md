# Fleet flag and the ID chain under a Job Card

Source: JC Creation walkthrough (meeting notes + BU screenshots, 6 Oct 2026). The BA has confirmed **no further detail
will be given**, so both features are built on the working assumptions below. Each assumption is shown on screen and
can be changed without redesign if the business decides otherwise.

## 1. Fleet flag

**What the walkthrough says:** a role is given the privilege to upload chassis numbers as *Fleet*; vehicles not uploaded
are *Individual*. The Vehicle Info screen shows the badge under the customer name.

**What is built**

| Where | What |
| --- | --- |
| Admin Portal → **Fleet Register** (`#/admin/fleet`) | Upload Excel / CSV (template download), preview with every bad row and its Excel row number, then save as **Add / update** or **Replace whole list**; check a chassis; list with search, activate / deactivate, remove; export; grant the upload privilege to roles. Every change is in the Audit Log (module *Fleet Register*). |
| Badge `CustomerCategoryBadge` | *Fleet · account* (amber) or *Individual* (grey), under the customer name on TML Journey detail and Journey Search. The dealer-app developers reuse it on Vehicle Info. |
| Rules `src/utils/fleetRegister.ts` | `previewFleetUpload`, `applyFleetUpload`, `classifyVehicle`, `canUploadFleet` (unit-tested). |
| Backend design | `fleet_vehicle` table, `customer_category()` function, `role_permission` module `FLEET`; API `GET /fleet-vehicles`, `PATCH/DELETE /fleet-vehicles/{chassisNo}`, `GET /fleet-vehicles/{chassisNo}/category`; upload via `POST /imports` kind `FLEET_LIST`. |

**Working assumptions**

1. The key is the **Chassis No (17-character VIN)**. Optional columns: Fleet Account, Valid From, Valid To, Active (Y/N), Remarks.
2. **One central list owned by TML** (not per dealer). The TML admin always holds the privilege and can grant it to
   other roles (Dealer Admin, DGM, SA, Receptionist, CRO) on the same page. Admins without it see the list read-only.
3. A vehicle is **Fleet only while its row is active and today is within Valid From / Valid To** (dates inclusive,
   either may be blank). Everything else is Individual.
4. Upload either adds / updates by chassis, or replaces the whole list (rows not in the file become Individual).

**Upload checks:** blank / invalid chassis (17 letters or digits, no I, O, Q), duplicate in the file, unreadable date
(DD-MM-YYYY, YYYY-MM-DD or an Excel date), Valid To before Valid From, Active not Y/N. Rows already on the list are
shown as "will be updated". Headers are matched loosely (e.g. *VIN*, *Chassis Number*, *Fleet Name*).

## 2. ID chain under a JC

**What the walkthrough says:** Appointment ID → Visit ID → SR ID → Pre-JC → JC, with MR linked to the JC and the
customer updates sent — all visible under the JC. Pre-JC is a new micro-service between SR and JC; the SR created at
gate-in goes straight to CRM; auto SR creation in Service Buddy continues.

**What is built**

| Where | What |
| --- | --- |
| TML Journey detail header | One-line chain (click to open), e.g. `APT-… → VIS-… → SR-… → PJC-… → JC… · 2 MR`. |
| Tab **ID Chain & Customer Updates** | A card per ID (source system, time, created / awaited / not applicable), consistency check, MRs under the JC, customer updates (channel, linked ID, message, delivery status). |
| Journey Search | Any ID in the chain (Appointment, Visit, SR, Pre-JC, MR) finds its JC — auto-detected, or "Appointment / SR / MR ID" in *Search By*. |
| Journey Dossier export | Now includes the ID chain and the Fleet / Individual category. |
| Rules `src/utils/jcIdChain.ts` | `buildIdChain`, `validateIdChain`, `chainIds` (unit-tested). |
| Backend design | `journey_id_link`, `customer_update` tables; API `GET /journeys/{jc}/id-chain`, `POST /journeys/{jc}/id-links` (each module publishes its ID), `GET /journeys/lookup?id=`. |

**Working assumptions**

1. A **walk-in has no Appointment ID** (shown as *Not applicable*). Visit, SR, Pre-JC and JC are each required, in that order.
2. The **SR** comes either from **gate-in straight into CRM** or **automatically from Service Buddy**; the source is shown.
3. The **JC number is the key**; it is reserved before JC Creation completes and shown as *awaited* until then.
4. A JC can have **several MRs**; an MR cannot exist before the JC is opened.
5. Times never go backwards along the chain; an ID belongs to one JC only.
6. Customer updates hold the **template text only** — never the customer's name or number (DPDP).
7. In production every module sends its ID with the JC number (`POST /journeys/{jc}/id-links`). Until the modules do,
   the portal derives demo IDs from the mock timeline (formats `APT-`, `VIS-`, `SR-`, `PJC-`, `MR-` are placeholders).

## 3. If the business later gives detail

| Question | Where to change |
| --- | --- |
| Fleet list per dealer instead of central | add `dealer_code` to `fleet_vehicle` + row-level security; filter on the page |
| More upload columns (e.g. fleet type, KAM) | `FLEET_TEMPLATE_HEADERS` / `previewFleetUpload` and the table |
| Real ID formats | `LINKED_ID_RE` in `jcIdChain.ts` (search detection) |
| Which customer updates are sent, by which channel | `customer_update.template_code`; the portal only displays what was sent |
