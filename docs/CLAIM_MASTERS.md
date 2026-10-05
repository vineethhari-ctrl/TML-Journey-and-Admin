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
| AMC / Warranty Authorization Approval Matrix | *Warranty Approval Matrix* + BA answers | 3 |
| AMC / EW Service Guideline File Master | *Master List* row 5 (no sheet yet) | 0 — pending |
| Goodwill SHQ Approver Users Master | *List of SHQ users* | 1 (test user) |

**Not masters**, as the BA remarks in *Master List* say: the Division-wise **CCM/ACCM mapping** and the **KAM users** are
handled in User Management. Their sheets contain real dealer and user details, so they are not copied into this public
repository.

The older demo masters in the same card (*AMC Products & Pricing*, *Warranty Defect & Causal Part Tagging*,
*Goodwill & Special Concession Matrix*) are not from the BA workbook.

## How the system uses them

1. **AMC / Warranty Authorization Request** — the request goes through the approval matrix level by level. A level with
   *Can Approve = Y* approves amounts **up to and including** its limit (blank limit = no upper limit); otherwise the request
   moves on. After **24 hours** the pending approver gets a **notification and an email**; nothing is escalated automatically.
   - Up to ₹20,000 → **Claim Manager** approves (or sends to CCM/ACCM).
   - Above ₹20,000 → **CCM/ACCM** cannot approve; it sends to SHQ Lead 1 or back for correction → **SHQ Lead 1** approves.
2. **Goodwill Request** — the Claim Manager picks an **Issue Description**. The mapping gives its **Issue Type** and
   **Request Category**: *Thermal Incident → Catastrophic Situation, Red*; *Engine Failure → Minor Product Failure, Amber*.
3. **Dropdowns** — Budget Allocation Purpose (yearly budget), Special Goodwill Claim (IUPR, Thrive — an identification tag on the
   Goodwill Authorization Request; it does not change the approval path) and Complaint Type (AMC / EW requests) show their
   Active values in Order.
4. **Service Guideline** — before an AMC or EW request, the Claim Manager downloads the active guideline file for the request
   type and BU.

Checks on save and on Excel import: duplicate values, one category per Issue Description, one row per approval level, and a
level that cannot approve must name who it forwards to. The health check also finds issue descriptions without a category,
categories for unknown issue descriptions, and approval limits that do not increase level by level.

## BA answers (5 Oct 2026) and what is still open

| # | Question | BA answer | Status |
| --- | --- | --- | --- |
| 1 | Levels above CCM/ACCM | AMC requests up to ₹20,000: Claim Manager approves; above ₹20,000: SHQ Lead 1 approves | **Done** — SHQ Lead 1 added as level 3 with no upper limit |
| 2 | Is exactly ₹20,000 Claim Manager? | Yes (≤ 20,000) | **Done** — limits are inclusive |
| 3 | What happens after the reminder? | Notification and email only | **Done** — no auto-escalation |
| 4 | Service Guideline PDFs | Business is preparing them | **Pending** |
| 5 | Goodwill approvers per category (Red / Amber / Green) | BA will share the colour-wise Goodwill approval hierarchy | **Pending** — a Goodwill approval master is built when it arrives |
| 6 | IUPR / Thrive approval path | Only an identification on the Goodwill Authorization Request | **Done** — no separate path |
| 7 | Keep or remove the 3 demo masters | To be discussed in the module update call | **Open** |

To confirm with the BA:
- The answer names **AMC** requests, while the sheet is titled *Warranty* Approval Matrix. Does the same matrix apply to AMC,
  Extended Warranty and Warranty requests?
- Does a request above ₹20,000 go **through CCM/ACCM** to SHQ Lead 1 (as in the sheet), or straight to SHQ Lead 1?
