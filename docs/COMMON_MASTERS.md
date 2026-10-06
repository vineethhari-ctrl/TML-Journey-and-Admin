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
| Value | Technical Query | What the user picks |
| Order | 1 | Position in the dropdown |
| Parent LOV Code / Parent Value | `THD_PROGRESS` / Under Diagnosis | Dependent dropdowns only |
| Status | Active | Inactive values stay for history but are not offered |

Example from the request: field **ABC** of the **THD** module with values 1, 2, 3 → three rows with Parameter
`THD_ABC`, Values `1`, `2`, `3`, Orders 1–3.

### Naming rules (checked on save and on Excel import)

- Parameter = `<MODULE>_<FIELD>`, capitals, digits and `_` only, and it must start with the Module
  (`THD_…` for module THD). Modules: COMMON, APPOINTMENT, PND, RECEPTION, SECURITY, JC, BODYSHOP, JCT, EQC, THD, SPD,
  CLAIM, JOURNEY, IRA, ADMIN.
- A list several modules use gets the `COMMON_` prefix, e.g. `COMMON_BU` (PV, EV, CV). There is no combined
  "PV + EV" value: PV and EV are separate, so a row that applies to both BUs is entered once for PV and once for EV.
- One value once per list (per parent value for dependent lists). One Field Name and one Module per list.
- Dependent list: every row names the Parent LOV Code and a Parent Value that exists and is Active,
  e.g. `THD_PROGRESS_SUB_STATUS` rows under `THD_PROGRESS` = "Under Diagnosis".
- To retire a value set it **Inactive** (don't delete): old records keep showing it.

### Adding values or a new list

- **On screen:** open the Common LOV Master, add a row. The **LOV Catalogue** above the table lists every list with
  its values, parent and where it is used, and flags problems ("All lists OK" when clean).
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
