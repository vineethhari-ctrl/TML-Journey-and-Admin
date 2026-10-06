# THD Masters

Live: **Masters Maintenance → THD card** (every THD master shows the **THD Rule Tester**)
Source: BA workbooks `THD_Masters_List.xlsx` (one sheet per list) and `Conditions 4.xlsx` (auto-THD rules).
Data: `src/data/thdMasters.ts` · Rules: `src/utils/thdRules.ts` (unit-tested in `src/utils/__tests__/thdRules.test.ts`).

## Masters

The dropdown lists are kept in the **Common LOV Master** (see [`COMMON_MASTERS.md`](COMMON_MASTERS.md)); the rest are THD masters.

| Master | Excel source | Rows |
| --- | --- | --- |
| THD Auto-Trigger Rules | *Conditions 4* | 8 |
| THD Critical Complaints Master | *Critical Complaints* | 1 |
| Common LOV `THD_PROGRESS` | *Progress LOV* | 6 |
| Common LOV `THD_PROGRESS_SUB_STATUS` (parent `THD_PROGRESS`) | *Progress Sub Status* (merged Progress cells filled down) | 16 |
| Common LOV `THD_COMPLAINT_TYPE` | *Type of Complaint LOV* | 2 |
| Common LOV `THD_COMPLAINT_SHORT_DESC` | *Complaint Shot Description LOV* | 26 |
| Common LOV `THD_ACTION_TAKEN` | *Action Taken LOV* | 7 |
| Common LOV `THD_DELAY_REASON` | *Reason for Delay LOV* | 10 |
| Common LOV `THD_CLOSURE_ACTION` | *Closure Action LOV* | 3 |
| Common LOV `THD_ATTACHMENT_TYPE` | *Attachment LOV* | 1 |
| THD Kms Range Filter Master | *Kms Range* (text split into From / To Km) | 2 |
| THD Vehicle Age Filter Master | *Vehicle Age* (text split into From / To years) | 2 |
| THD Assignment Users Master | the 5 user sheets, one row per user with a **Role** column | 5 (test users) |

The 5 user sheets (Tech Executive L1, RTSM, COC L2, Plant, Product Reliability) are one master. The same person can then
hold more than one role, and the dealer app filters it by Role. The names in the BA sheet are replaced by test users
because this repository is public; real users are loaded into the production database only.

The older demo masters in the THD card (*DTC Fault Code Alert & Telematics*, *THD Technical Escalation Category & Severity*,
*TIB Advisory Codes*) are not from the BA workbooks.

## How the system uses them

1. **Auto-THD** — when a job card is created or updated, the rules engine checks every active rule in *THD Auto-Trigger Rules*
   (critical complaints match on **PPL + Complaint Code**):

   | Rule | Raises a case when | Window | Assigned to |
   | --- | --- | --- | --- |
   | 1 Repeat Complaint | vehicle returns within the window and a complaint has the same Aggregate as the previous job card | 30 days | DET |
   | 2 Critical | a complaint in the *Critical Complaints* master for the vehicle's PPL is in the job card at creation | — | DET |
   | 3 Critical (added later) | a critical complaint is added after creation and **X** hours have passed | **X pending** | DET |
   | 4 Delayed | job card open longer than **Y** hours with delay reason *Delayed Diagnosis* or *Under Investigation* | **Y pending** | DET |
   | 5 Quality Inspection | the Quality Inspector marks *THD Required* | — | DET |
   | 6 Escalated | an open escalated complaint exists on the chassis | — | DET |
   | 7 DTC | a critical DTC arrives from the Connected Cloud platform | — | DET |
   | 8 Unattended | a THD case is unattended by DET for more than the window | 24 hours | Tech Executive L1 |

   A rule with a blank window **never fires**. The tester shows it as *pending from business* instead.
2. **Closure form** — the five closure dropdowns show the Active values in **Order**. Choosing a **Progress** shows only its
   sub-statuses.
3. **Search filters** — Kms and Vehicle Age ranges are inclusive at both ends. A value can match more than one range.

Checks on save and on Excel import: duplicate values, To ≥ From, Plant Name for Plant users, a Time Window needs Hours/Days,
and rule 4 needs its delay reasons. The health check also finds sub-statuses whose Progress no longer exists, and a rule
assigned to Tech Executive L1 when no such user is active.

## BA answers (5 Oct 2026) and what is still open

| # | Question | BA answer | Status |
| --- | --- | --- | --- |
| 1 | X (rule 3) and Y (rule 4) hours | Asked business to share | **Pending** — rules 3 and 4 cannot fire until filled |
| 2 | Critical Complaints by PPL? | Map complaint codes per PPL, as in the CRM complaint master | **Done** — a critical complaint applies to its PPL only. E32 has no PPL in the sheet, so it is listed as pending until mapped |
| 3 | Vehicle Age 0–1 and 0–5 overlap | Ranges are as business wants; more will be shared | **Kept as is** — overlapping ranges are allowed |
| 4 | Kms Range stops at 10,000 km | Will be set as per business | **Pending** from business |
| 5 | Trigger points of rules 4 and 5 | BA will investigate and confirm | **Open** |
| 6 | "Tech Executive/CC" in rule 8 | CC = Command Centre; consider Tech Executive L1 only | **Done** — rule 8 assigns to Tech Executive L1 |
| 7 | Which master holds the job card delay reasons of rule 4? | — | **Open** (not answered) |
| 8 | Performance formula and graph parameters | Graph parameters received separately and used directly in the graphs; *Master Required* is the BA's tracker | Graphs are not masters. The DET performance formula is still **pending** (*Master Required* row 7) |
