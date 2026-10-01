# Bay Management — Process & Rules

Live: **Administration → Masters Maintenance → Dealer Network → Bay Management**
Approver inbox: **Administration → Bay Approvals** (`#/admin/bay-approvals`)

## Roles

| Role | Can do |
| --- | --- |
| **TML Admin** (Network planning / L1, L2 Support) | Set bay allocation per dealer + division + BU + bay type · add bays directly · activate / inactivate bays directly · approve or reject requests · set the bay status policy |
| **TML Network Manager** | Approves / rejects **additional bays** beyond the allocation |
| **Dealer (DSv) Admin** | Add bays · request additional bays · request activate / inactivate (per policy) · resubmit rejected bays · edit physical details (name, floor, lift, technicians) |

## Rules

1. **Allocation.** TML Admin sets how many bays of each type a dealer may have, per **division** and **BU** (PV / EV / CV).
   Approved bays count against it whether Active or Inactive (they physically exist).
2. **Within allocation** → a bay added by the Dealer Admin is **Approved and Active immediately**.
3. **Beyond allocation** → the Dealer Admin must give a **justification**; the bay is created as *Pending Approval* (inactive) and a request goes to the **TML Network Manager**:
   in-app inbox + bell notification + **email with a direct link** to the approval screen.
   Approve → bay becomes Active. Reject (note required) → bay stays inactive as *Rejected*; the dealer can **resubmit** with a new justification.
   Bulk uploads follow the same rule row by row.
4. **Active ⇄ Inactive.** No "inactive from / to" dates — a bay is Active or Inactive until changed. A **reason** is always recorded.
   - TML Admin (L1/L2): applies immediately.
   - Dealer Admin: sent to **TML Admin (L1/L2 Support)** for approval (email + inbox), applied only when approved.
5. **Policy switches** (TML Admin, in the Bay Management screen) because the BU has not finalised this:
   - *Dealer Admin can change bay status* — turn off to make it TML-only later.
   - *Dealer Admin status changes need TML Admin approval* — turn off to let dealers change directly.
6. **Draft → Send for Approval** (BU-accepted screen). *New Bay* can **Save as Draft** (inactive, doesn't use the allocation).
   Tick Draft or Rejected bays in the list (only those can be selected) and click **Send for Approval**:
   each bay within the allocation is approved automatically; the rest need one justification and go to the TML Network Manager.
7. Bay type, division, BU and status can't be edited directly — they're governed by the rules above. Everything is audit-logged.

## Assumptions to confirm with the BU

- "Division" = a dealer's workshop/division (e.g. *Main Workshop*, *EV Hub*); the list per dealer comes from the dealer master.
- TML Admin may add bays beyond the allocation directly (with a warning to update the allocation).
- The BU screen shows *Inactive From / Inactive To* columns; they are left out because requirement #4 removed from/to dates. Add them back if the BU wants them.
- Approval emails are **simulated** in this prototype (shown on screen and in the email log); the backend will send real emails using the same content and deep link.

## Screen layout (as accepted by the BU)

Header (Dealer Admin / TML Admin, bell with pending requests, dealer) → filters (Region and Dealer locked for Dealer Admin, Bay Type,
Bay Status, Bay Name, Approval Status, Division, BU; **Clear** / **Search**) → **Bays** list (New Bay, Bulk Upload, Send for Approval)
→ **Bay Details** (click a row: Activate / Inactivate, Send for Approval, edit physical details) → TML allocation → requests → policy.

# Non-Operational Hours & Holiday Calendar

**Masters Maintenance → Dealer Network → Non-Operational Hours & Holiday Calendar**

1. **Scope**: pick the Division (dealer — division) and Month, then **Load Calendar**.
2. **Weekly operating pattern**: Open / Close (24-hour HH:MM) or *Week Off* for each weekday. It applies to every date unless overridden.
3. **Date-specific holidays & overrides**: one row per date in the month. Tick *Holiday?*, enter the holiday name and an optional remark,
   or use *Override hours* (hover a row) for a half day. *Effective hours* are computed: holiday → hours override → weekly pattern.
4. **Past dates are locked.** **Bulk set to holiday**: "Every Saturday" (etc.) marks all remaining such dates in the loaded month.
5. Saved in the browser for this prototype; **Download CSV** exports every dealer/division's overrides.
