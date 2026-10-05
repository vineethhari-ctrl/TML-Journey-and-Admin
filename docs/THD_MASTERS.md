# THD Masters

Live: **Masters Maintenance → THD card** (every THD master shows the **THD Rule Tester**)
Source: BA workbooks `THD_Masters_List.xlsx` (one sheet per list) and `Conditions 4.xlsx` (auto-THD rules).
Data: `src/data/thdMasters.ts` · Rules: `src/utils/thdRules.ts` (unit-tested in `src/utils/__tests__/thdRules.test.ts`).

## Masters

| Master | Excel source | Rows |
| --- | --- | --- |
| THD Auto-Trigger Rules | *Conditions 4* | 8 |
| THD Critical Complaints Master | *Critical Complaints* | 1 |
| THD Progress Master | *Progress LOV* | 6 |
| THD Progress Sub-Status Master | *Progress Sub Status* (merged Progress cells filled down) | 16 |
| THD Type of Complaint Master | *Type of Complaint LOV* | 2 |
| THD Complaint Short Description Master | *Complaint Shot Description LOV* | 26 |
| THD Action Taken Master | *Action Taken LOV* | 7 |
| THD Reason for Delay Master | *Reason for Delay LOV* | 10 |
| THD Closure Action Master | *Closure Action LOV* | 3 |
| THD Attachment Type Master | *Attachment LOV* | 1 |
| THD Kms Range Filter Master | *Kms Range* (text split into From / To Km) | 2 |
| THD Vehicle Age Filter Master | *Vehicle Age* (text split into From / To years) | 2 |
| THD Assignment Users Master | the 5 user sheets, one row per user with a **Role** column | 5 (test users) |

The 5 user sheets (Tech Executive L1, RTSM, COC L2, Plant, Product Reliability) are one master. The same person can then
hold more than one role, and the dealer app filters it by Role. The names in the BA sheet are replaced by test users
because this repository is public; real users are loaded into the production database only.

The older demo masters in the THD card (*DTC Fault Code Alert & Telematics*, *THD Technical Escalation Category & Severity*,
*TIB Advisory Codes*) are not from the BA workbooks.

## How the system uses them

1. **Auto-THD** — when a job card is created or updated, the rules engine checks every active rule in *THD Auto-Trigger Rules*:

   | Rule | Raises a case when | Window | Assigned to |
   | --- | --- | --- | --- |
   | 1 Repeat Complaint | vehicle returns within the window and a complaint has the same Aggregate as the previous job card | 30 days | DET |
   | 2 Critical | a complaint in the *Critical Complaints* master (for the PPL or all PPLs) is in the job card at creation | — | DET |
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

## Questions for the BA

1. **X (rule 3) and Y (rule 4)** — the hours are still pending (*Master Required* rows 8–9).
2. **Critical Complaints by PPL** — *Conditions 4* says "PPL-CC list", but the sheet has no PPL column. An optional PPL
   column was added (blank = all PPLs). Should critical complaints be per PPL?
3. **Vehicle Age 0–1 and 0–5 overlap.** Fine for a search filter, but if these are buckets the second should be 1–5.
4. **Kms Range stops at 10,000 km.** Vehicles above that have no range. Add more ranges?
5. **Trigger points** — rule 4 says the job card *remains Open* but its Trigger Point is *Job Card Closure*. Rule 5 (Quality
   Inspection) has Trigger Point *Job Card Creation*. Please confirm.
6. **Rule 8 Assigned To** says "Tech Executive/CC". It is set up as Tech Executive L1. What is "CC"?
7. **Rule 4 delay reasons** (*Delayed Diagnosis*, *Under Investigation*) are job card delay reasons, not values of the THD
   *Reason for Delay* list. Which master holds the job card delay reasons?
8. **Not in the workbook yet**: the DET performance formula, and the graph parameters marked *Received* in *Master Required*
   (Current Status, Reason for Delay, Performance, Individual Performance, User-wise Status).
