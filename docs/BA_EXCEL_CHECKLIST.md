# BA Excel checklist — so masters import cleanly the first time

Upload: **Masters Maintenance → Smart Excel Import** (`#/admin/masters?open=smart-import`). Any layout is accepted. These rules avoid gaps:

1. **One table per master.** The first row of the table holds the column names.
2. **Two tables on one sheet?** Leave one completely empty column between them.
3. **PV and EV blocks** can repeat the header row; the repeat is skipped automatically.
4. **Yes/No columns:** Y or N. **Counts and sequences:** numbers. **Dates:** real Excel dates or YYYY-MM-DD.
5. **Fill every row fully.** Don't leave a cell blank to mean "same as above"; repeat the value instead.
6. **Limits go in the header**, e.g. `No. of Images Required (Max 2)`. The limit is then enforced.
7. **Dropdown-like columns** (BU, Role, Service Type, Status) should use the same spelling every time.
8. Optional **"Master List"** sheet with *Master Name* and *Status*. It is read as notes, not imported.

Each upload gives a gap report (blank cells, mixed numbers and text, values above a limit, duplicate rows) with Excel row numbers, so it can go straight back to the BA.
