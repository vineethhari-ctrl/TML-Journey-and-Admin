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

## Saving preferences (local first, then backend)

`usePreferenceStore` writes to `localStorage` immediately and calls an optional `remote` adapter after 600 ms. On load,
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
