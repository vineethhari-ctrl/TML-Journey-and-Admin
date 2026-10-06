# Common Masters

Masters that several modules need are kept once, in the **Common Masters** group (Masters Maintenance → sidebar
**Common Masters**, or `#/admin/masters?open=common`). Owner: TML Admin.

| Master | What it holds |
| --- | --- |
| **Common LOV Master** (`common_lov`) | Every dropdown list (List of Values) of every module, one row per value |
| PPL & PL (Product Line) Master | Vehicle lines used by JC Creation, eQC, THD, Claims… |
| Complaint Codes Master | Complaint codes used across modules |
| Dealer Details & Network Facility Registry | Dealers used across modules |

## Common LOV Master

One row per dropdown value:

| Column | Example | Meaning |
| --- | --- | --- |
| Parameter (LOV Code) | `THD_COMPLAINT_TYPE` | Which list this value belongs to: `<MODULE>_<FIELD>` in capitals |
| Module | `THD` | Owner of the list; `COMMON` = shared by several modules |
| Field Name | Type of Complaint | Label of the dropdown on the screen |
| Display Value | Technical Query | What the user picks |
| Code (LIC) | TECHNICAL_QUERY | Language-independent code kept in records (as in Siebel); proposed from the Display Value, stays fixed when the wording changes |
| Order | 1 | Position in the dropdown |
| Parent LOV Code / Parent Value | `THD_PROGRESS` / Under Diagnosis | Dependent dropdowns only |
| Description | | Optional note |
| Status | Active | Inactive values stay for history but are not offered |

Example from the request: field **ABC** of the **THD** module with values 1, 2, 3 → three rows with Parameter
`THD_ABC`, Values `1`, `2`, `3`, Orders 1–3.

### Naming rules (checked on save and on Excel import)

- Parameter = `<MODULE>_<FIELD>`, capitals, digits and `_` only, and it must start with the Module
  (`THD_…` for module THD). Modules: COMMON, APPOINTMENT, PND, RECEPTION, SECURITY, JC, BODYSHOP, JCT, EQC, THD, SPD,
  CLAIM, JOURNEY, IRA, ADMIN.
- A list several modules use gets the `COMMON_` prefix, e.g. `COMMON_BU` (PV, EV). There is no combined "PV + EV"
  value and no CV: PV and EV are separate, so a row that applies to both BUs is entered once for PV and once for EV.
- One value once per list (per parent value for dependent lists). One Field Name and one Module per list.
- Dependent list: every row names the Parent LOV Code and a Parent Value that exists and is Active,
  e.g. `THD_PROGRESS_SUB_STATUS` rows under `THD_PROGRESS` = "Under Diagnosis".
- To retire a value set it **Inactive** (don't delete): old records keep showing it.

### Adding values or a new list

- **On screen — the List of Values screen (Siebel style):** Common Masters → Common LOV Master.
  1. Left: find the LOV Type by typing part of its name, field or a value, or filter by module.
  2. Right: the type's values in a grid — Order (arrows to move), Display Value, Code (LIC), Parent Value (dependent
     lists), Active tick box, Description. **New Value** adds a row, **Add several** takes values pasted one per line
     (e.g. from Excel), **Ctrl+B** (or the copy icon) duplicates the row you are in; the cursor lands in the copy's Display Value, type over it. Untick **Active** to retire a value. Saving a copy without changing it is refused: "Duplicate record cannot exist".
  3. **Save**. Mistakes (duplicate value or code, missing parent value, bad name) are highlighted on the cell and
     nothing is saved until fixed. **Undo changes** goes back to the saved list.
  4. **New LOV Type**: choose the Module and type the Field Name — the Parameter is proposed (`THD` + "ABC" →
     `THD_ABC`); pick "Depends on" for a dependent list; add values; Save.
  The **All lists OK** badge runs the health check over every list. **Table / Excel view** shows the plain table used
  for Excel import and export.
- **BA Excel:** the `common_lov` sheet of *TML_Existing_Masters_Catalogue.xlsx* (Masters Maintenance → Import) has
  these columns — one row per value; several lists can go in the same sheet. Import it with "Update existing masters".

### How screens and masters use a list

A master field names its list with `lovCode`, e.g. `{ key: 'bu', type: 'select', lovCode: 'COMMON_BU' }`. Its
dropdown then always shows that list's Active values in Order, so a change in the Common LOV Master reaches every
master and screen that uses it. The health check reports a field whose list does not exist.

Lists today: `COMMON_BU`, 8 THD lists (`THD_PROGRESS`, `THD_PROGRESS_SUB_STATUS`,
`THD_COMPLAINT_TYPE`, `THD_COMPLAINT_SHORT_DESC`, `THD_ACTION_TAKEN`, `THD_DELAY_REASON`, `THD_CLOSURE_ACTION`,
`THD_ATTACHMENT_TYPE`) and 4 Claims lists (`CLAIM_BUDGET_PURPOSE`, `CLAIM_SPECIAL_GOODWILL`,
`CLAIM_ISSUE_DESCRIPTION`, `CLAIM_COMPLAINT_TYPE`). They replace the 12 separate THD / Claims list masters.

### What stays a module master

Masters whose rows carry business settings beyond a value — e.g. Appointment cancellation reasons (auto-reschedule),
Gate denial reasons (escalate to), Pause reasons (dependent fields), Revisit reasons (escalate to DGM), Parts delay
reasons (auto order SAP) — stay in their module. If the business confirms some are plain lists, move them into the
Common LOV Master the same way.

Code: `src/data/commonLov.ts` (list definitions), `src/utils/commonLov.ts` (lookups, rules, health check),
`CommonLovPanel.tsx` (catalogue).

## Shortcuts for every master: Ctrl+B and Ctrl+S

Every master behaves like the List of Values screen:

- **Ctrl+B** — click in a row (or tick one row) and press it: a copy of the row appears right below, editable in place
  (amber "COPY" row), cursor in the first field. Type over what differs; press Ctrl+B again for more copies.
- **+ Add Row** — adds a new row with **every field blank** at the top of the table (no popup), so it is clear what must
  be typed. It is edited and saved exactly like a copy.
- **Esc** — on an unsaved row (a copy or a new row) removes it, the same as deleting it. Saved rows are not affected.
- **Ctrl+S** — saves all copied and new rows (the green "Save copy" button does the same); in the Add / Edit form it saves the
  record.
- **Duplicate record cannot exist** — a copy identical to an existing row (every field the same) turns red at once,
  clicking away shows the error, and Ctrl+S / Save refuse until it is changed. Editing a record without changing any
  value is refused the same way. Nothing is saved while any copy has a problem.
