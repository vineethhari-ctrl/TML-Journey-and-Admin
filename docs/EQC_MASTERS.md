# Electronic Quality Check (EQC) Masters

Live: **Administration → Masters Maintenance → Electronic Quality Check (EQC)** (`#/admin/masters?open=eqc`)
Rules code: `src/utils/eqcRules.ts` (pure functions, unit-tested in `src/utils/__tests__/eqcRules.test.ts`).

## Common rules

- **Blank PPL = all PPLs.** In the form, choose **(All PPLs)**. A row for a specific PPL **overrides** the all-PPL row for that PPL.
- **Blank Km range = every odometer reading.** Only a start = "from this Km"; only an end = "up to this Km". Both ends are inclusive.
- **Active = N** rows are ignored everywhere.
- Every rule below is checked on **Insert/Update Row** and on **BA workbook import**.

## The masters

| # | Master | Fields | Business rule |
| --- | --- | --- | --- |
| 1 | Guided Check & Road Test Mandate | PPL, Complaint Code, GC Applicable, GC Mandatory, GC Mandatory Till, Road Test Mandatory, Active | One rule per PPL + Complaint Code. GC Mandatory = Y needs GC Applicable = Y. After *GC Mandatory Till*, GC stays applicable but becomes optional. |
| 2 | Guided Check Steps | PPL, Complaint Code, Step No., GC Step, GC Image 1, GC Image 2, Active | Steps shown in Step No. order. PPL-specific steps replace the all-PPL steps for that PPL. Step No. is unique per PPL + Complaint Code. |
| 3 | PTD Risk Configuration | Color Code (Orange/Red), Threshold in Hrs, Threshold in Mins, Active | Time left to PTD ≤ Red → **Red**; ≤ Orange → **Orange**; otherwise On Track; already late → Red. One active row per colour; Red must be lower than Orange. |
| 4 | DID Parameter Threshold Mapping | Parameter Name, Expected Value / Range, Unit, PPL, Active | Expected value formats: `11.8-14.5`, `>=20`, `<=4.2`, `>0`, `<5`, or a single value. One row per Parameter + PPL. |
| 5 | General Checklist | BU, Checklist Type, Checklist Item, Range Start/End Km, PPL, Active, Not OK: Photo/Audio/Video/Text | Item applies when BU matches, PPL is blank or equal, and Km is in range. An active item needs at least one Not-OK capture. |
| 6 | Schedule Checklist (Section & Sub-Section) | BU, Section, Sub-Section, PPL, Active, Not OK: Photo/Audio/Video/Text, Range Start/End Km | Same applicability as #5, shown grouped by Section. |

The earlier *Final Quality Inspection & Road Test Checklist* and *Critical Fastener Torque Verification* masters now sit in the same EQC group.

## EQC Rule Tester (top of every EQC master)

Pick **BU, PPL, Complaint Code, Odometer, Job date, PTD time left** and optionally a **DID parameter + scanned value**. It shows, from the masters as they are right now:

- GC applicable / mandatory and road test mandatory, plus which rule decided it (PPL-specific or all-PPL).
- The GC steps the technician will see.
- The PTD risk colour and the DID result (OK / NOT OK against the expected range).
- The General and Schedule checklist items that apply, with the Not-OK captures required.

The **health check** badge lists anything to fix before go-live: duplicates, Red ≥ Orange, invalid ranges, or GC marked applicable with no steps defined.

## Assumptions to confirm with the BU

- The Complaint Code format is capitals, digits and hyphens (e.g. `BRK-VIB-02`).
- The PPL list (Nexon, Nexon EV, Altroz, …) is a fixed list for now. Wire it to the PPL master when the backend exists.
- GC images are stored as a file name or URL. The upload service is a backend task.
