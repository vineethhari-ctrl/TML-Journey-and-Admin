# Sharing masters without a backend (stop-gap)

Every browser keeps its own copy of the masters (browser storage). Until the shared database exists:

**Publish (master owner):** Masters Maintenance → **Share → Publish all masters** → tick "test data only" → saves `published-masters.json`.
To make it live, put that file at `public/published-masters.json` (replacing the old one) and deploy. Version numbers count up; a browser on an older version gets the new one.

**Browsers:** a browser with no changes of its own switches to the new published masters silently. A browser with changes of its own shows a banner (Send my changes first / Load published masters). **Share → Back to published masters** drops local changes.

**Send changes (BAs):** **Share → Send my changes for review** saves only added / changed rows, one sheet per master in the Upload a Master format. The owner imports it on *Upload a Master*, then publishes. Changes to fields or rules are sent with the BA workbook (Export → Whole group (Excel)).

Code: `src/utils/masterPublish.ts` (file format, diff, Excel), `src/components/administration/MasterSharing.tsx` (dialogs, banner), `AppContext` (loading the published file).
**Test data only**: the site is public.
