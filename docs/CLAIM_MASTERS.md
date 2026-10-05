# Claims Masters

Live: **Masters Maintenance → Auth. Request Approval & Service Claims card** (every Claims master shows the **Claims Rule Tester**)
Source: BA workbook `Claims_Masters_List.xlsx`.
Data: `src/data/claimMasters.ts` · Rules: `src/utils/claimRules.ts` (unit-tested in `src/utils/__tests__/claimRules.test.ts`).

## Masters

| Master | Excel source | Rows |
| --- | --- | --- |
| Goodwill Budget Allocation Purpose Master | *Budget Allocation LOV* | 2 |
| Special Goodwill Claim Master | *Special claim* | 2 |
| Goodwill Issue Description Master | *Issue Description LOV* | 2 |
| Goodwill Request Category Mapping | *Goodwill Req Catagory Mapping* | 2 |
| AMC / EW Complaint Type Master | *Complaint Type LOV* | 2 |
| Warranty Authorization Approval Matrix | *Warranty Approval Matrix* | 2 |
| AMC / EW Service Guideline File Master | *Master List* row 5 (no sheet yet) | 0 — pending |
| Goodwill SHQ Approver Users Master | *List of SHQ users* | 1 (test user) |

**Not masters**, as the BA remarks in *Master List* say: the Division-wise **CCM/ACCM mapping** and the **KAM users** are
handled in User Management. Their sheets contain real dealer and user details, so they are not copied into this public
repository.

The older demo masters in the same card (*AMC Products & Pricing*, *Warranty Defect & Causal Part Tagging*,
*Goodwill & Special Concession Matrix*) are not from the BA workbook.

## How the system uses them

1. **Warranty Authorization Request** — the request goes through the approval matrix level by level. A level approves when the
   amount is **below** its limit; otherwise it forwards to the next persona. Each level gets a reminder after its Reminder hours.
   - Below ₹20,000 → **Claim Manager** approves (or sends to CCM/ACCM).
   - ₹20,000 and above → **CCM/ACCM** cannot approve; it sends to *SHQ Lead 1* or back for correction. **SHQ Lead 1 is not in
     the matrix yet**, so the tester reports these requests as having no approver.
2. **Goodwill Request** — the Claim Manager picks an **Issue Description**. The mapping gives its **Issue Type** and
   **Request Category**: *Thermal Incident → Catastrophic Situation, Red*; *Engine Failure → Minor Product Failure, Amber*.
3. **Dropdowns** — Budget Allocation Purpose (yearly budget), Special Goodwill Claim (IUPR, Thrive) and Complaint Type (AMC / EW
   requests) show their Active values in Order.
4. **Service Guideline** — before an AMC or EW request, the Claim Manager downloads the active guideline file for the request
   type and BU.

Checks on save and on Excel import: duplicate values, one category per Issue Description, one row per approval level, and a
level that cannot approve must name who it forwards to. The health check also finds issue descriptions without a category,
categories for unknown issue descriptions, and approval limits that do not increase level by level.

## Questions for the BA

1. **SHQ Lead 1 and higher levels** — limit, actions and reminder hours for every level above CCM/ACCM. Until then, requests of
   ₹20,000 and above have no approver.
2. **"Below 20,000"** — is exactly ₹20,000 approved by the Claim Manager? It is set up as *less than* ₹20,000.
3. **Reminder** — what happens after the 24-hour reminder? Auto-escalate to the next level, or only a notification?
4. **Service Guideline files** — please share the AMC and Extended Warranty guideline PDFs (per BU, with version).
5. **Goodwill approval flow** — which approver handles which category? Do SHQ users approve all goodwill requests, and KAM users
   the fleet vehicles? Is *Green* used? No issue description maps to it yet.
6. **Special Goodwill Claims (IUPR, Thrive)** — do they follow a different approval path or capture extra fields?
7. **Demo masters** — should the older *Goodwill & Special Concession Matrix*, *AMC Products & Pricing* and *Warranty Defect*
   masters be kept, replaced by BA data, or removed?
