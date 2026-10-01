# BA Guide — Defining Masters Without a Deployment

Masters can be added or extended directly in the Admin portal (**Administration → Masters Maintenance**).
No code change or release is needed. There are two ways:

| You have… | Use |
| --- | --- |
| One master to add quickly | **Create New Master** (form in the portal) |
| A module's worth of masters prepared in Excel | **Import BA Workbook** |
| A field or values that were missed in an existing master | **Import BA Workbook** with *Update existing masters* (or **+ Add Custom Parameter** on that master) |

## Files

| File | Purpose |
| --- | --- |
| [`templates/TML_Master_Definition_Template.xlsx`](templates/TML_Master_Definition_Template.xlsx) | Blank template with instructions and one worked example (Tyre Brand Master). Start here. |
| [`templates/TML_Existing_Masters_Catalogue.xlsx`](templates/TML_Existing_Masters_Catalogue.xlsx) | Every master already in the system, in the same format — check it first to avoid duplicates. |

The same files can be downloaded from the portal: **Import BA Workbook → Download Template / Export Current Masters**.
Regenerate the repo copies with `npm run templates`.

## Workbook layout

**`Masters` sheet** — one row per master

| Column | Rules | Example |
| --- | --- | --- |
| Master ID | lowercase, digits, `_`; 3–31 chars; unique; also the records sheet name | `tyre_brand_master` |
| Master Name | shown in the portal | Tyre Brand Master |
| Module Code | `appointment`, `reception`, `security`, `jc_creation`, `jc_tracking`, `spd`, `thd`, `eqc`, `claim`, `bodyshop`, `ira`, `dealer_network` | `bodyshop` |
| Logical Group | `Vehicle Data`, `Dealer Network`, `Service Operations`, `Parts, Claims & Support` | Parts, Claims & Support |
| Owner | `TML_ADMIN` (OEM-governed) or `DEALER_ADMIN` (dealer-editable) | TML_ADMIN |
| Category, Description | free text | |

**`Fields` sheet** — one row per field

| Column | Rules |
| --- | --- |
| Master ID | which master the field belongs to |
| Field Key | `brand_name` style; `id` is reserved. Leave blank to derive from the label |
| Field Label | shown to users |
| Type | `text`, `number`, `select` (dropdown), `boolean` (Y/N), `date` |
| Mandatory | Y / N |
| Options | dropdown values, comma separated (at least 2) |
| Min / Max | number limits |
| Min Date / Max Date | `YYYY-MM-DD` |
| Pattern / Pattern Error Message | optional regular expression for text, e.g. `^[A-Z]{3}$` |
| Show in Dealer App | Y / N |
| Dealer Target Module | `vehicle_journey`, `job_card`, `reception`, `workshop_floor`, `general` |
| Dealer Label | optional label for dealers |
| Value Mapping | `CODE=Dealer text; CODE2=Other text` |

**Records** — one sheet per master, **named exactly as its Master ID**

- Row 1: `id` plus the field keys (field labels also work).
- `id` is optional (generated when blank). Booleans `Y`/`N`, dates `YYYY-MM-DD`.

## Importing

1. Admin portal → Masters Maintenance → **Import BA Workbook** (TML Admin view).
2. Upload the `.xlsx`.
3. Choose what happens if a master already exists:
   - **Skip it** (default) — safe for first loads.
   - **Update existing masters** — adds *new* fields and upserts records by `id`.
     Existing field definitions are never changed or removed by an import.
     For an existing record, blank cells are left unchanged, so you only need `id` + the columns you're filling.
4. Review the preview. Every problem is listed with its **sheet and row number**; nothing is imported until there are no errors.
5. Click **Import**. The change is recorded in the Audit Log and Change Log.

## Things that are checked for you

- Duplicate master IDs, field keys and record ids
- Valid module, group, owner and field types
- Dropdowns have ≥ 2 unique options; Min ≤ Max; valid date ranges and patterns
- Every record value matches its field (type, mandatory, options, range, pattern)
- Fields that point at a master not listed in the `Masters` sheet

## Not possible by import (by design)

- Changing or deleting an existing field — do it in the master's table so it's deliberate and audited
- Bay Management, Holiday Calendar, Time Slots and Dealer Registry — they have their own screens
