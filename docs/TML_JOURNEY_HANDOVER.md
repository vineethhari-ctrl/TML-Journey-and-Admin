# TML Journey: record of everything built in this repository (handover to the other repository)

**Status as of 22 Nov 2026.** TML Journey and the KPI dashboard are being built in another repository, so this portal no longer offers
TML Journey in its menu (PR #58). The code is still here and still reachable from the Home cards and the Dashboard. This document
records everything that was built for TML Journey in this repository, so that it can be copied across. Test data only: no real Tata
Motors data is in this repository or in this document.

**How to use this document in the other repository.** Give it to whoever builds there. Section 3 lists what to copy, section 4 says
what the copied code expects from the application shell, and sections 5 to 10 describe each feature and the rules in it. The
design documents `docs/WORKSHOP_UI_KIT.md` and `docs/FLEET_AND_ID_CHAIN.md` are the detailed specifications; this document adds the
history, the file list, the tests, the backend pieces and the open points.

---

## 1. What TML Journey is made of

| # | Area | What it does | Built when |
| --- | --- | --- | --- |
| A | **Journey Search** | Find a vehicle or job card by registration, VIN, JC number, phone, name or any ID in the chain; filters by zone, region, dealer, stage, status, in workshop, pending actions; "Columns displayed" | Base: first commit (1 Oct). Changed: 6 Oct |
| B | **Vehicle Journey (detail by JC)** | Header, timeline of stages, tracker, exceptions, performance, master mapping ("Expose to Dealer App" fields), rules engine, ID chain tab, Journey Dossier export | Base: first commit (1 Oct). Changed: 6 Oct |
| C | **Workshop Worklist** | Counter tabs (Gate-In, My Assignment, MR Details and more), filter bar, personalised tabs and columns, DPDP masking, vehicle render | 6 Oct |
| D | **DPDP** | Masked phone and name, reveal with permission and audit, click-to-call, masked exports, DPDP access log | 6 Oct |
| E | **Personalisation and Default Views** | Admin sets defaults per role (cards, tabs, columns); users personalise for the session only; defaults return at logout | 6 Oct |
| F | **Home landing cards** | The 12 module cards per role, hide and reorder | 6 Oct |
| G | **Fleet flag** | Fleet or Individual badge, central fleet list uploaded by chassis number | 6 Oct |
| H | **ID chain and customer updates** | Appointment, Visit, SR, Pre-JC, JC and MR under one JC | 6 Oct |
| I | **Backend design for the above** | Database tables, API paths, settings, audit catalogue | 2 Oct, 6 Oct, 15 and 18 Oct |
| J | **Removal from the menu** | Sidebar section and command-palette entries removed | 22 Nov |

The base screens (A and B, with the timeline, tracker, exceptions and performance tabs, and the Dashboard) were already in the first
commit of this repository (`59bd209`, 1 Oct 2026, built outside this repository); they are described here from the code, not from a specification. Items C
to H were built in this repository on 6 Oct 2026 from the JC Creation walkthrough (meeting notes and BU screenshots).

## 2. Timeline of changes

| Date | Commit | Change |
| --- | --- | --- |
| 2 Oct | `4476e06` | Backend design: PostgreSQL schema and OpenAPI contract (the base for the journey tables added on 6 Oct) |
| 1 Oct | `59bd209` | First commit of this repository: Journey Search, Vehicle Journey (timeline, tracker, exceptions, performance, master mapping, rules engine) and the Dashboard already present |
| 5 Oct | `fbb7ccd` | The 12-module layout of the portal (Home cards and module structure) |
| 6 Oct | `b13508e` | Workshop Worklist: personalised tabs, column customiser, DPDP masking, vehicle render; `docs/WORKSHOP_UI_KIT.md` |
| 6 Oct | `ef6d4ac` | BU design of the worklist; admin screen for tabs and columns per role; DPDP access log in the Audit Log |
| 6 Oct | `c431bc5` | Home landing cards, "Columns displayed" (also on Journey Search), reset to default at logout |
| 6 Oct | `994499d` | Rule change: only the TML admin sets default views; every user personalises for the session only (BU rule, 6 Oct) |
| 6 Oct | `ce4cc09` | Renamed "Workshop Tabs & Columns" to "Default Views" |
| 6 Oct | `e117d28` | Fleet flag register and the ID chain under a Job Card; schema, tests and API paths; `docs/FLEET_AND_ID_CHAIN.md` |
| 15 Oct | `e029c90` | Backend part 3: default views, audit catalogue (DPDP flags), sessions, devices, journey settings |
| 22 Nov | `777f874` | TML Journey section removed from the sidebar and the command palette (PR #58) |

(Other work in these months, such as masters, bays, THD, Claims and the backend design for masters, is not part of TML Journey and is
not listed.)

## 3. Files to copy

Line counts are from 22 Nov 2026. "Adapt" means the file imports the application shell (section 4).

### 3.1 Screens
| File | Lines | Notes |
| --- | --- | --- |
| `src/pages/JourneySearchPage.tsx` | 805 | Adapt. Search, filters, "Columns displayed", DPDP masking, fleet badge |
| `src/pages/JourneyDetailPage.tsx` | 855 | Adapt. Tabs timeline, ID chain, exceptions, performance, master mapping, rules engine; Dossier export |
| `src/pages/WorkshopWorklistPage.tsx` | 394 | Adapt. Counter tabs, filter bar, grids for Gate-In, My Assignment, MR Details |
| `src/pages/WorkshopPolicyPage.tsx` | 253 | Adapt. **Default Views** admin screen (TML admin only) |
| `src/pages/HomePage.tsx` | 80 | Adapt. Landing cards; maps each card to a route (see 6.6) |
| `src/pages/FleetRegisterPage.tsx` | 311 | Adapt. Admin screen for the fleet list |
| `src/pages/AuditLogPage.tsx` | (shared) | Only the DPDP access log button and the `?module=DPDP` filter |

### 3.2 Components
| File | Lines |
| --- | --- |
| `src/components/journey/JourneyTimeline.tsx` | 220 |
| `src/components/journey/JourneyTracker.tsx` | 203 |
| `src/components/journey/JourneyExceptionsTab.tsx` | 159 |
| `src/components/journey/JourneyPerformanceTab.tsx` | 139 |
| `src/components/journey/JourneyIdChain.tsx` | 132 |
| `src/components/journey/JourneyEventModal.tsx` | 125 |
| `src/components/workshop/WorkshopTabBar.tsx` | 173 |
| `src/components/workshop/ColumnCustomizer.tsx` | 80 |
| `src/components/workshop/VehicleRender.tsx` | 81 |
| `src/components/dpdp/MaskedPii.tsx` | 88 |
| `src/components/fleet/CustomerCategoryBadge.tsx` | 31 |

### 3.3 Rules, services, hooks and data (mostly framework-free: copy as they are)
| File | Lines | What |
| --- | --- | --- |
| `src/utils/dpdp.ts` | 89 | Masking, reveal rules, unmask audit payload, export sanitising |
| `src/utils/viewPreferences.ts` | 109 | Tab and column rules (pure functions, reusable by the backend) |
| `src/utils/personalisationSettings.ts` | 33 | Clears personal layouts at logout |
| `src/utils/vehicleAsset.ts` | 54 | Vehicle image resolution and fallbacks |
| `src/utils/fleetRegister.ts` | 224 | Fleet upload checks and classification |
| `src/utils/jcIdChain.ts` | 205 | ID chain building and validation |
| `src/services/journeyService.ts` | 121 | Search, filters, search-type detection |
| `src/data/workshopPolicy.ts` | 232 | Default views: role presets, `useWorkshopPolicy`, `policyForRole` |
| `src/data/fleetRegister.ts` | 86 | Fleet list store |
| `src/hooks/useDpdp.ts` | 37 | DPDP permissions and audit for the current user |
| `src/hooks/useTabPreferences.ts` | 64 | Tab and card preferences |
| `src/hooks/useColumnPreferences.ts` | 53 | Column preferences |
| `src/hooks/usePreferenceStore.ts` | 56 | Session storage for personal layouts |

### 3.4 Types, mock data and shared pieces that these files use
- `src/types/index.ts`: `JourneyStage`, `JourneyEvent`, `JourneyException`, the `ModuleType` list, `RolePermission` (module `'TML Journey'`), device and audit types.
- `src/data/mockDataGenerator.ts`: the journey events, stages, exceptions and the demo JC `JC20260930001234` (24 mentions of journey).
- `src/utils/roleAccess.ts`: platform roles and permission codes (`pii.unmask`, `pii.export`, `journey.read`) and the route rule for `/journey*`.
- `src/utils/roleViews.ts`: the per-role views, built from the default-view policy (`policyForRole`); `src/data/roleCatalogue.ts`: the role list used by the Default Views screen.
- `src/config/navigation.ts`: the command-palette entries (the six TML Journey entries were removed on 22 Nov; restore them from `git show 777f874^:src/config/navigation.ts`).
- `public/demo-vehicles/` (illustrations drawn for this repository, not Tata Motors renders; real renders must be hosted by TML under `/assets/vehicles`).

### 3.5 Documents
`docs/WORKSHOP_UI_KIT.md` and `docs/FLEET_AND_ID_CHAIN.md` (the specifications), and the pointer to the UI kit in `README.md`.

## 4. What the copied code expects from the application shell

The pages and hooks read the application context (`useApp()`). The other repository must provide the same, or adapt the files:

| Needed | Used by |
| --- | --- |
| `currentUser`, `activeRoleId` | all pages and hooks (personal layouts are keyed by user and role) |
| `navigate`, `currentRoute` | search deep links such as `#/journey?filter=delayed`, `#/journey?search=...` |
| `canAccessRoute`, `hasPermission` | menu and route access, `pii.unmask`, `pii.export` |
| `logAudit(action, module, entity, old, new, status)` | DPDP (`UNMASK_PII`, `CTI_CALL`, `EXPORT_WORKLIST`), Default Views and Fleet changes |
| `showToast` | feedback messages |
| `serviceCases`, `vehicles`, `stages` | Journey Search and Journey Detail (mock data in this repository; the real service in production) |
| Logout hook | call `clearPersonalisation()` at logout (`UserProfileDrawer` does it here) |

Hash routes used: `#/journey`, `#/journey/{jcNumber}`, `#/workshop`, `#/home`, `#/admin/workshop-policy`, `#/admin/fleet`,
`#/admin/audit?module=DPDP`.

Browser storage keys: `tml_workshop_policy_v1` and `tml_fleet_register_v1` (local, replaced by the backend in production);
`user_pref_tabs:{userId}:{roleId}`, `user_pref_columns:{userId}:{roleId}`, `user_pref_cards:{userId}:{roleId}` (session only).

## 5. Journey Search and Vehicle Journey (A, B)

- **Search:** one box that detects what was typed (`detectSearchType`: registration, VIN, JC, phone, name, or a linked ID);
  "Search By" can force a type. Any ID in the chain (Appointment, Visit, SR, Pre-JC, MR) finds its JC.
- **Filters:** zone, region, dealer, current stage, status, in workshop only, pending actions only; shortcut filters arrive as
  `?filter=` (active vehicles, active JCs, in workshop, pending, delayed, completed, `stage_{key}`) from the Dashboard.
- **Columns displayed:** Vehicle, Customer, JC Number, Current Stage, Status and Action by default; Dealer and Workshop and Last Updated
  on demand. Pinned columns stay.
- **Detail tabs:** Timeline, ID Chain and Customer Updates, Exceptions, Performance, Master Mapping, Rules Engine.
- **Master Mapping tab and "Expose to Dealer App":** a master field marked "Show in Dealer App" with target module `vehicle_journey` is
  drawn on the Vehicle Journey page by the dynamic renderer in `JourneyDetailPage`. **This is a dependency from the masters to TML
  Journey** (see section 9).
- **Journey Dossier export:** includes the ID chain and the Fleet or Individual category, with PII masked unless the role may export it.

## 6. Workshop Worklist, DPDP, personalisation (C to F)

Full specification: `docs/WORKSHOP_UI_KIT.md`. Summary of the rules to keep:

### 6.1 Tabs
Role preset applies until the user saves a layout; at least **2** tabs stay visible; a hidden tab cannot be the landing tab; extra and
hidden tabs go under "More (n)" with their counts; a tab added later takes its visibility from the preset.

### 6.2 Columns
Pinned columns come from the screen preset (for example Vehicle No left, Action right) and cannot be hidden or moved. Users show,
hide and reorder the rest; Reset to Default restores the lean preset; new columns default to visible unless the preset hides them.

### 6.3 DPDP
- **Phone:** all but the last 4 digits masked (`+91 98201 43540` becomes `******3540`), with **click-to-call** (CTI) so the number need not be shown.
- **Name:** full name only to the assigned Service Advisor; others see initials.
- **Reveal:** only with permission **`pii.unmask`**; re-masks after 30 seconds; writes an `UNMASK_PII` audit row (user, vehicle,
  field, time, session IP). The revealed value is never written to the log.
- **Export:** masked unless the user has **`pii.export`**; every export is audited (`EXPORT_WORKLIST`).
- **Who:** Service Advisor can reveal, not export; DGM, Dealer Admin and Super Admin can reveal and export; Receptionist, Security and
  Driver can do neither.
- **DPDP access log:** `#/admin/audit?module=DPDP` lists every `UNMASK_PII`, `CTI_CALL` and `EXPORT_WORKLIST`.
- **Also applied to TML Journey:** search results, the journey header and the Dossier export.
- **Production:** list APIs return only masked values; the real value is fetched on reveal (`POST /customers/{id}/pii:reveal`) and the
  call is placed by the CTI server (`POST /cti/calls`); the server stamps the session IP and writes the audit row.

### 6.4 Vehicle render
Resolve the vehicle by registration number, then try the vehicle's colour image, then the variant's hero shade, then a generic SVG
silhouette. A dashed wireframe holds the space while loading. Sizes: card 200x125 and thumb 32x20.

### 6.5 Default Views (Admin Portal, TML admin only) and personalisation
- **Rule (BU, 6 Oct 2026):** only the TML admin sets defaults (landing cards, header tabs and their landing tab, and the columns of each
  list: Today's Gate-In, My Assignment, MR Details and Journey Search). Every logged-in user, dealer or TML, can personalise for their
  own session; the layout is kept in `sessionStorage` and **cleared at logout**, so the admin default returns. Personal layouts are
  **not** stored on a server.
- The earlier walkthrough note "remember even after logout" was replaced by this rule.
- A card or tab the role may not use never appears, not even under "More". Every save and reset is written to the Audit Log.

### 6.6 Home landing cards
12 module cards; defaults per role: Service Advisor 11 (Security Guard hidden); Receptionist 4; Security Guard 2; Driver 2; all
other roles 12. Each card opens a route: the Customer Journey card opens `/journey`, and Job Card Creation, JC Tracking,
Receptionist, Pickup and Drop and Bodyshop open `/workshop`. **If the Workshop Worklist is not copied, these cards need other targets.**

## 7. Fleet flag (G)

Specification: `docs/FLEET_AND_ID_CHAIN.md`, section 1. In short: the key is the 17-character chassis number; one central list owned by TML;
a vehicle is Fleet only while its row is active and today is within Valid From and Valid To (inclusive, either may be blank); upload
either adds and updates or replaces the whole list; the upload checks every row (chassis letters, duplicates, dates, Active Y or N) and
shows the Excel row number; the privilege to upload is held by the TML admin and can be granted to other roles on the same page. The
badge `CustomerCategoryBadge` shows "Fleet, account" or "Individual" under the customer name.

## 8. ID chain and customer updates (H)

Specification: `docs/FLEET_AND_ID_CHAIN.md`, section 2. Chain: Appointment, Visit, SR, Pre-JC, JC, with MRs under the JC and the customer
updates sent. Working assumptions that were shown on screen: a walk-in has no Appointment ID; the SR comes from gate-in into CRM or
automatically from Service Buddy; the JC number is the key and is shown as "awaited" until JC Creation completes; a JC may have several
MRs and an MR cannot exist before the JC; times never go backwards; an ID belongs to one JC; customer updates hold template text only,
never the name or number. Demo ID formats (`APT-`, `VIS-`, `SR-`, `PJC-`, `MR-`) are placeholders (`LINKED_ID_RE`).

## 9. Dependencies from other parts of this repository

| Dependency | Where | Effect if TML Journey leaves this repository |
| --- | --- | --- |
| Masters to Journey | Masters "Show in Dealer App" with target `vehicle_journey`; the Master Mapping and Rules Engine tabs; end-to-end test `admin-to-dealer` | Fields exposed to the dealer app are drawn on the Journey page, so that feature needs the page, or a new target |
| Home cards | `HomePage.tsx` maps cards to `/journey` and `/workshop` | Cards would open nothing |
| Dashboard drill-downs | `DashboardPage.tsx` opens `/journey?filter=...` and `/journey/{jc}` (11 links) | Tiles would open nothing |
| Global search | `GlobalSearchModal.tsx` opens `/journey/...` and `/journey?search=...` for vehicles and JCs | Vehicle search would open nothing |
| Notifications | demo notifications link to `/journey/JC20260930001234` | Dead links |
| Role permissions | the permission matrix has a "TML Journey" module; `roleAccess.ts` has a rule for `/journey*` | Row and rule become unused |
| Default Views | the admin screen controls the worklist and Journey Search columns | Becomes meaningless without those lists |
| Audit Log | DPDP access log, and the actions `UNMASK_PII`, `CTI_CALL`, `EXPORT_WORKLIST` | Stays useful only if DPDP applies to the screens that remain |
| Fleet | the Fleet Register admin screen and badge | The badge is shown on the Journey screens |

## 10. Backend design for TML Journey (I)

- **Part 1** (`docs/backend/schema.sql`, tests `schema_test.sql`): `fleet_vehicle`, function `customer_category()` (Fleet or Individual on a date),
  `journey_id_link` (every ID of the chain against a JC), `customer_update` (template text and channel only), the role permission module
  `FLEET`, notifications, the append-only audit log.
- **Part 3** (`docs/backend/schema_platform.sql`, tests `schema_platform_test.sql`):
  - four journey settings: `journey.event_retention_days` (365), `journey.exception_threshold_minutes` (30), `journey.stage_timeout_hours` (4),
    `journey.auto_escalate_exceptions` (on);
  - the default-view catalogue (12 cards, 9 tabs, 4 lists including `journey_search` with 8 columns, the customer column flagged as PII),
    per-role policies with versions and history, and `save_default_view`, `reset_default_view`, `effective_default_view`;
  - `audit_action_catalog` with the three DPDP actions flagged, and the views `audit_log_security` and `audit_log_uncatalogued`.
- **API contract** (`public/api-docs/openapi.yaml`): `/fleet-vehicles`, `/fleet-vehicles/{chassisNo}`, `/fleet-vehicles/{chassisNo}/category`,
  `/journeys/{jcNumber}/id-chain`, `/journeys/{jcNumber}/id-links`, `/journeys/lookup`, `/default-views/{roleId}` (+ history),
  `/ui-catalogue`, `/me/default-view`, `/audit-actions`, `/audit-log?securityOnly`, and the import kind `FLEET_LIST`.
- **Not built:** Part 4, the journey tables themselves (events, stages, exceptions, escalations). It was waiting for the BA's journey
  masters, and is now out of scope for this repository.

## 11. Tests to copy with the code

| Test | Count | Covers |
| --- | --- | --- |
| `src/utils/__tests__/dpdp.test.ts` | 5 | masking, reveal, audit payload, export |
| `src/utils/__tests__/vehicleAsset.test.ts` | 4 | image resolution and fallbacks |
| `src/utils/__tests__/viewPreferences.test.ts` | 9 | tab and column rules |
| `src/data/__tests__/workshopPolicy.test.ts` | 4 | default views per role |
| `src/utils/__tests__/personalisationSettings.test.ts` | 2 | cleared at logout |
| `src/utils/__tests__/fleetRegister.test.ts` | 8 | fleet upload and classification |
| `src/utils/__tests__/jcIdChain.test.ts` | 9 | ID chain |
| `src/services/__tests__/journeyService.test.ts` | 12 | search and filters |
| `e2e/workshop-worklist.spec.ts` | 4 | Service Advisor tabs, columns, DPDP masking and vehicle renders; Receptionist with masked names and masked export; admin sets tabs and columns per role; Journey Search masks mobile numbers |
| `e2e/personalisation.spec.ts` | 3 | Home cards (hide, reorder, survive reload, back to default after logout); TML admin sets default cards and Journey fields while dealers cannot change defaults; Journey Search lean columns and "Columns displayed" |
| `e2e/fleet-and-id-chain.spec.ts` | 2 | Fleet upload and the Fleet or Individual badge, privilege grant; ID chain with MRs and customer updates, any ID finds the JC |
| `e2e/admin-to-dealer.spec.ts` | 3 | master field exposed to the Vehicle Journey page |
| `src/__tests__/app.test.tsx` | (shared) | Journey deep links, command palette, "no TML Journey in the sidebar" |

## 12. Decisions that must travel with the code

1. **Default views are TML admin only; personal layouts are session only and never stored** (BU, 6 Oct 2026).
2. **DPDP:** masked by default; reveal only with `pii.unmask`; export masked unless `pii.export`; every reveal, call and export audited; the
   revealed value is never logged.
3. **Fleet** is one central list owned by TML; Individual unless an active, in-date row exists.
4. **Customer updates** never carry the customer's name or number.
5. **No AI at runtime** in the application (BU will not accept it).
6. **Test data only** in these repositories; the demo vehicle images are illustrations, not Tata Motors renders.
7. The Bay Operations and other BA masters are **not** part of TML Journey.

## 13. Open points for the other repository

- Where do the Home cards and the Dashboard tiles open once the Journey and Workshop pages live elsewhere?
- Does the dealer-app preview ("Expose to Dealer App", target `vehicle_journey`) move with the Journey page?
- Does Default Views stay in this repository (it also controls the home cards) or move with the worklist?
- Real ID formats for the chain, real vehicle renders (CDN), the CTI and reveal APIs, and the Journey tables (Part 4).

## 14. What changed on 22 Nov 2026 (PR #58)

Removed the "TML Journey" section from the sidebar and the six TML Journey entries from the command palette; added a test that the
sidebar has no such section. Nothing else was removed. To bring the entries back in this repository:
`git revert 777f874` (the CI runner pin in commit `9d6ac2e` is separate and should stay).
