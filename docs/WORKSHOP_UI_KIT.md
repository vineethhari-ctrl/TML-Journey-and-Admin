# Workshop UI kit — tabs, columns, DPDP, vehicle renders

Live reference screen: **sidebar → Workshop Worklist** (`#/workshop`). Switch role in the header to see each role's behaviour.
Everything here is reusable by the dealer-app team; the screen uses test data only.

| Spec task | What to reuse | File |
| --- | --- | --- |
| TASK-01 Top tab preferences | `useTabPreferences`, `WorkshopTabBar`, `TabCustomizer` | `src/hooks/useTabPreferences.ts`, `src/components/workshop/WorkshopTabBar.tsx` |
| TASK-02 DPDP | `maskPhone`, `maskName`, `maskEmail`, `canSeeFullName`, `buildUnmaskAudit`, `sanitizeForExport`; `MaskedPhone`, `MaskedName`; `useDpdp` | `src/utils/dpdp.ts`, `src/components/dpdp/MaskedPii.tsx`, `src/hooks/useDpdp.ts` |
| TASK-03 Column customiser | `useColumnPreferences`, `ColumnCustomizer` | `src/hooks/useColumnPreferences.ts`, `src/components/workshop/ColumnCustomizer.tsx` |
| TASK-04 Vehicle render | `resolveVehicle`, `vehicleImageCandidates`, `VehicleRender` | `src/utils/vehicleAsset.ts`, `src/components/workshop/VehicleRender.tsx` |

The rules behind tabs and columns are pure functions in `src/utils/viewPreferences.ts`, so the backend can reuse them.

The screen follows the BU-accepted design from the JC Creation walkthrough:
- counter tabs, each with a coloured count, an icon and the label;
- a filter bar: All / PV / EV, Reg. Number, Phone No., Status, Critical Customer, Revisit, search, and the
  column (sliders) icon;
- an Appointments / Walk-In switch on Gate-In;
- sample grids for Today's Gate-In, My Assignment and MR Details.

## Admin control (Admin Portal → Workshop Tabs & Columns, `#/admin/workshop-policy`)

From the walkthrough: *"Needs to be in admin… which tabs should be visible to who"*. Per role, an admin sets:

- **Allowed tabs:** a tab not allowed for the role never appears, not even under "More".
- **Default layout:** which tabs are visible by default, their order, and the landing tab (★).
- **Default columns** per worklist. Locked columns are always shown; the rest go into each user's "More columns" pool.

Users personalise within this policy. A user who already personalised keeps their layout, minus any tab the admin
disallows. The policy lives in `src/data/workshopPolicy.ts` (`useWorkshopPolicy`, `policyForRole`). In the prototype
it is stored in the browser under `tml_workshop_policy_v1`; in production it comes from the backend. Every save or reset
is written to the Audit Log.

## DPDP access log (`#/admin/audit?module=DPDP`)

From the walkthrough: *"this particular data was seen by this person on this date"*. The Audit Log has a **DPDP access
log** button. It lists every `UNMASK_PII` (who revealed which vehicle's customer data, and when), every `CTI_CALL`, and
every `EXPORT_WORKLIST`, with whether the export was masked.

## Tabs (TASK-01)

- Saved under `user_pref_tabs:{userId}:{roleId}`. Until a user saves a layout, the **role preset** applies (the Service
  Advisor preset is the spec example: lands on *My Assignment*; THD, Additional Jobs & Parts and Quality Inspection hidden).
- At least **2 tabs** stay visible. Hiding the landing tab moves the landing tab to the first visible tab. A hidden tab
  cannot be the landing tab.
- Tabs beyond `maxInline` and all hidden tabs go into **More (n)** with their badge counts; hidden tabs stay reachable.
- A tab added in a later release takes its visibility from the role preset; a removed tab drops out of saved layouts.

## Columns (TASK-03)

- Saved under `user_pref_columns:{userId}:{roleId}` as one object keyed by tab (`{ gate_in: {...}, my_assignment: {...} }`).
- **Pinned columns** come from the screen preset (e.g. Vehicle No left, Action right). Users cannot hide or move them.
- Users show / hide and reorder the other columns. **Reset to Default** restores the lean preset.
- Columns added later default to visible unless the preset puts them in the hidden pool.

## Landing page cards (`#/home`)

**Home** shows the BU landing page with the module cards the role may use. Each user can hide and reorder cards with
**Customise cards**, and **Default view** puts them back. Admins choose the allowed cards and the default order per
role in *Workshop Tabs & Columns*. Built-in defaults:

| Role | Cards |
| --- | --- |
| Service Advisor | 11 cards (Security Guard hidden) |
| Receptionist | Receptionist, Appointment, Pickup & Drop, Customer Journey |
| Security Guard | Security Guard, Customer Journey |
| Driver | Pickup & Drop, Customer Journey |
| All other roles | all 12 cards |

Cards are saved under `user_pref_cards:{userId}:{roleId}` and reuse `useTabPreferences` with
`storageKey: CARD_PREF_STORAGE_KEY`.

## "Columns displayed" (every list)

Each list opens with the minimum fields from the BU screenshots. The **Columns displayed** button lets users pick and
order the fields; pinned fields stay. It is on the workshop worklists and on **TML Journey Search**. Journey Search
shows Vehicle, Customer, JC Number, Current Stage, Status and Action by default; Dealer & Workshop and Last Updated are
on demand.

## Back to the default view after logout (BU rule, 6 Oct 2026)

By default, personal layouts (cards, tabs, columns) last only for the session. They are kept in `sessionStorage` and
cleared at logout (`clearPersonalisation`), so every user starts from the default view at the next login.

The walkthrough notes asked for the opposite ("remember even after logout"). Admins can switch that on with **Keep
personal layouts after logout** in *Workshop Tabs & Columns*. Layouts then go to `localStorage` and the optional
backend adapter. The setting is in `src/utils/personalisationSettings.ts`.

## Saving preferences (local first, then backend)

`usePreferenceStore` writes to browser storage (session by default, see above) immediately and calls an optional `remote` adapter after 600 ms. On load,
the server copy replaces the local one when it is newer (`updatedAt`). Suggested backend endpoints:
`GET /me/preferences/{key}` and `PUT /me/preferences/{key}` with body `{ value, updatedAt }`.

## DPDP (TASK-02)

- **Phone:** every digit except the last 4 is masked (`+91 98201 43540` → `******3540`), with a **CTI click-to-call**
  button so the number never needs to be shown.
- **Name:** shown in full only to the **assigned Service Advisor**. Everyone else sees initials (`T*** C*** A***`).
- **Reveal:** the eye button appears only with permission **`pii.unmask`**, re-masks after 30 s, and writes an
  **`UNMASK_PII`** audit row (`userId`, `vehicleRegNo`, `actionType`, `field`, `timestamp`, `sessionIp`). The revealed
  value is never written to the log.
- **Export:** `sanitizeForExport` masks PII unless the user has the supervisor permission **`pii.export`**. Each export
  is audited.
- **Portal roles:**

  | Role | Can reveal | Plain export |
  | --- | --- | --- |
  | Service Advisor | yes | no |
  | DGM, Dealer Admin, Super Admin | yes | yes |
  | Receptionist, Security, Driver | no | no |

- Also applied to **TML Journey**: search results, journey header, and the *Export Journey Dossier* file.
- **In production,** list APIs should return only masked values. The real value should be fetched on reveal
  (`POST /customers/{id}/pii:reveal`), and the call placed by the CTI server (`POST /cti/calls`). The server stamps
  `sessionIp` and writes the audit row. The browser then never holds plain PII it was not allowed to see.

## Vehicle render (TASK-04)

1. **Resolve the vehicle:** Vehicle Master by Reg No (spaces and case ignored) → VIN, model, Variant Code (VC), colour code.
2. **Build the URL:** `/assets/vehicles/{model}/{vc}/{colour}_front_three_quarter.webp`. Each segment is lower-cased with
   `_` and spaces turned into `-`.
3. **Fall back in this order:**
   - the vehicle's colour;
   - the VC's **hero shade** (`HeroShades` map);
   - a generic model **silhouette**, drawn in SVG with no request.
4. **While loading,** a dashed SVG wireframe fills the same fixed box, so there is no layout shift.
5. **Sizes:** `card` (200×125, Vehicle Information card) and `thumb` (32×20, grid; hover shows the trim).

The demo images in `public/demo-vehicles/` are simple illustrations drawn for this repo, not Tata Motors renders. The
real renders need to be hosted by TML (DMS / CDN) under `/assets/vehicles`.
