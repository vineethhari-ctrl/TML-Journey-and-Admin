# Bodyshop Masters

Live: **sidebar → Bodyshop Masters** (`#/admin/masters?open=bodyshop`)
Source: BA workbook `Bodyshop_Master_1.xlsx` (sheets *Inventory Capture Master* and *Ins. Doc Collection-Customer*).
Rules: `src/utils/bodyshopRules.ts` (pure, unit-tested in `src/utils/__tests__/bodyshopRules.test.ts`).

## Masters (transcribed from the Excel; blank cells kept blank)

| Master | Excel source | Rows |
| --- | --- | --- |
| Inventory Capture Master — Sections | left table (Section, Roles, Sequence Priority, Active, Service Type, BU) | 14 (7 × PV, 7 × EV) |
| Inventory Capture Master — Checkpoints | right table (Section … Service Type) | 11 |
| Insurance Document Collection — Customer | *Ins. Doc Collection-Customer* | 2 |

Also in the group: *Bodyshop Master & Facility Operations* (added by AI Studio, not from this Excel) and
*BodyShop Denting & Paint Stage Master*.

## How the dealer app uses them

1. A **Section** is shown when it is Active, its BU matches, its Service Type is *All* (or *Accident* on an accident job) and the user's role is in **Roles**. Sections are shown in **Sequence Priority** order, so Internal (3) comes before External (4).
2. A **Checkpoint** shows inside the Section with the same name, for its **Role** and Service Type. The Checkpoints sheet has no BU column, so a checkpoint applies to every BU that has its Section.
3. A row with no Checkpoint is captured at **Sub-Section** level. For example, *Cabin* needs a photo ×2 when Not OK.
4. **Video/Image**, **No. of Image Required (Max 2)** and **Applicable On** (All / Not OK) define the evidence.
5. **Insurance documents**: active rows, in Sequence order, are collected for accident jobs.

The **Inventory Capture Preview** at the top of each Bodyshop master shows this for any BU, job type and role. Its checklist lists everything that needs a BA decision.

## Gaps found in the Excel (need BA decisions)

- *Battery Information*: Section is "Internal-Accessories", which is not one of the 7 sections. Mandatory, Active, Service Type and Applicable On are blank.
- *Owner's Manual* and *Pen Drive*: Section is blank (and Pen Drive's Sub-Section is blank too). Their role is Driver, but the *Inventory* section only allows DSvAdv, so they need *Accessories* (or Inventory's roles changed).
- *Steering Controls*: one Sub-Section has three sequence numbers (4, 5, blank). Sub-Section Sequence should be the same for all its rows; use Checkpoint Sequence to order the checkpoints.
- *Accident Details, External, Inventory, Accessories, Tyre & Battery* have no checkpoints yet.
- *Insurance Copy* is captured in the Documents section but is inactive in the Insurance Document master. Keep one source.
- Insurance documents: *No. of Image Required* is blank for Insurance Copy, which is fine while it stays inactive.

## Updating

- Edit a row on screen. The checks run on save.
- Or **Import BA Workbook**: download the catalogue workbook, edit these masters' sheets, and upload. The same checks run.
