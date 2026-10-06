# Master Rules (no coding)

Every master has a **Rules** button (Masters Maintenance → open a master → **Rules**). The TML Admin adds business
rules there by picking a rule type and filling in the blanks — no coding, no deployment. Dealer Admins can see the
rules but not change them.

| Rule type | What it checks | Example |
| --- | --- | --- |
| Required when… | A field must be filled when another field has certain values (or is filled) | Plant Name is required when Role is Plant |
| No duplicates | No two active rows have the same values in the chosen fields | PPL + Complaint Code must be unique |
| From ≤ To | A number or date is not greater than another | From Km ≤ To Km |
| Allowed values depend on another field | While a condition holds, a field may only take some values | When BU is EV, Powertrain may only be EV |
| Must exist in another master | The value is an active value of a field in another master | Dealer Code must exist in the Dealer Registry |
| Number between | Minimum and / or maximum | Warranty Months between 12 and 72 |
| Format | Text follows a fixed pattern (ready-made choices, or an own pattern for IT) | Dealer Code: ABC-123 |

- **Error** = the row is refused with the rule as the message; **Warning** = the row is saved and the user is told.
- An optional **message** replaces the generated sentence. Each rule can be switched **On / Off**.
- The list shows, for each rule, whether all saved rows follow it or which rows don't (rules are checked on new and
  changed rows; existing rows are never changed automatically).

## Where the rules are checked

Saving in the record form, Ctrl+S on new rows and Ctrl+B copies, the **List of Values** screen, **Upload a Master** (rows refused with the Excel
row number; warnings listed but imported), and the **BA workbook** import.

## Rules in the BA workbook

The BA workbook has an optional **Rules** sheet, one row per rule: Master ID, Rule Type (`required_if`, `unique`,
`not_greater`, `allowed_if`, `exists_in`, `range`, `pattern` — or the titles above), Field, Fields (No duplicates),
When Field, When Values, Other Field, Allowed Values, Min, Max, Format, Other Master, Other Master Field, Severity,
Message, Enabled. Fields can be given by key or by the label shown on screen; lists are comma separated. The blank BA
workbook template has three example rules. The rows in the same workbook are checked against its rules before
anything is imported.

## No AI

Rules are stored as data with the master and evaluated by ordinary code (`src/utils/masterRules.ts`). Nothing is sent
to a server or an AI service. Production: table `master_rule` in `docs/backend/schema.sql`, same evaluator on the
server.

Not covered (still code): multi-step engines such as auto-THD triggers or amount-based approval routing.
