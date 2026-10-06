# Upload a Master

One page for business users: **Administration → Upload a Master** (`#/admin/upload-master`). Drop any Excel file; the
page checks it and says what will happen. Nothing is saved until **Import**, and nothing is saved if any problem is
shown.

| Your file | What happens |
| --- | --- |
| A sheet in an **existing master's own template** (columns = the field names shown on screen; sheet named after the master, or columns that match exactly) | Every row is **added as a new row**. If the file has an **id** column (the *Current rows* download) and a row's id already exists, that row is **changed** instead; an empty cell in a changed row keeps its present value. Duplicates, wrong values and mandatory gaps are listed with the Excel row number. |
| A sheet **close to** an existing master's template but with a missing, extra or renamed column | **Error** listing the missing / extra columns, with a link to download the correct template. Nothing is imported. |
| **Any other table** with a header row | Detected as a **new master**: columns become fields (type, dropdown values and mandatory guessed from the data). Choose the master name, module and owner on the page. No coding or deployment. |
| A **BA definition workbook** (sheets *Masters* and *Fields*) | Creates / extends masters in the module named in the sheet, with their rows. |

Templates: pick any master on the page and download its **empty template** or its **current rows** (edit and upload
again). Practice files with test data are linked at the bottom of the page.

List of Values: use the Common LOV Master template (columns LOV Type (Parameter), Module, Field Name, Display Value,
Code (LIC), Order, Parent LOV Code, Parent Value, Description, Status). Several lists can be in one sheet.

Code: `src/utils/masterUpload.ts` (checks, pure and unit-tested), `src/pages/UploadMasterPage.tsx` (page).
Business rules: each master's Rules tab ([MASTER_RULES.md](MASTER_RULES.md)) is applied to the uploaded rows; a BA workbook can bring its own rules in a "Rules" sheet.
