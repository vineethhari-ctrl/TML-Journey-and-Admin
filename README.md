# TML Journey & Admin (prototype)

React 19 + TypeScript + Vite + Tailwind. All data is generated in-memory (`src/data`); there is no backend.

**Live prototype:** https://vineethhari-ctrl.github.io/TML-Journey-and-Admin/ — redeployed automatically on every push to `main`
(`.github/workflows/deploy-pages.yml`). Sample data only; anything entered is stored in the visitor's own browser.

## Scripts

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Dev server on http://localhost:3000 |
| `npm test` | Run the test suite once (Vitest + React Testing Library) |
| `npm run test:watch` | Re-run tests on change |
| `npm run test:e2e` | Browser end-to-end tests (Playwright) — starts the app automatically |
| `npm run lint` | Type-check (`tsc --noEmit`) |
| `npm run build` | Production build |
| `npm run templates` | Regenerate the BA Excel templates in `docs/templates` |

## Defining masters without a deployment

Masters Maintenance has **Create New Master** (form) and **Import BA Workbook** (Excel). BAs use the in-app guide
(`#/admin/masters-guide`, sidebar → *BA Guide: Masters*, source `src/pages/MasterGuidePage.tsx`) with downloads served from
`public/downloads`; repo copies and a Markdown guide are in [`docs/`](docs/BA_MASTER_GUIDE.md). `npm run templates` regenerates
both copies of the Excel files (a test fails if they are out of date).
Logic lives in `src/utils/masterWorkbook.ts` (build / parse / validate) and is covered by unit + E2E tests.

## Bay management

Allocation-driven bay governance with approvals (TML Network Manager / TML Admin), simulated email deep links and
policy switches — see [`docs/BAY_MANAGEMENT.md`](docs/BAY_MANAGEMENT.md). Rules: `src/utils/bayGovernance.ts` (pure, unit-tested);
state: `src/context/BayContext.tsx`; UI: `BayManagementConsole.tsx`, `pages/BayApprovalsPage.tsx`.

## Conventions (please keep these)

- **Routing** lives in the URL hash (`#/journey/JC…`, `#/admin/users?search=…`). Use `navigate()` from `useApp()`; pages read `?search=` via `useRouteSearchParam`.
- **Pages list**: `src/config/navigation.ts` is the single source for navigable pages (command palette, access fallbacks).
- **State updates**: never call `logAudit` / `showToast` inside a `setState(prev => …)` updater — React may run updaters twice.
- **Dates**: parse app timestamps (`YYYY-MM-DD HH:MM[:SS]`) with `parseDateTime()` from `src/utils/dateUtil.ts`, not `new Date(str)` (breaks in Safari / shifts by timezone).
- **Bulk imports** go through `mergeImportedRecords()` (`src/utils/recordMerge.ts`).
- **Record ids** must be unique within a master; the editors enforce this.

## Tests

- **Unit / integration** (`npm test`): next to the code in `__tests__` folders and in `src/__tests__` (app-level flows).
- **End-to-end** (`npm run test:e2e`): `e2e/admin-to-dealer.spec.ts` drives a real browser and checks that
  configuration made in the Admin portal reaches the dealer screens:
  1. a custom master field with value mapping appears on the Vehicle Journey page,
  2. a Rules Engine field's required/range validation is enforced on the dealer page,
  3. Dealer App Preview shows/hides fields per vehicle and blocks publishing while errors exist.

  `e2e/master-onboarding.spec.ts` covers "Create New Master" and the BA workbook import (new masters,
  a missed field added to an existing master, and rejection of a workbook with errors).
  First run on a new machine: `npx playwright install chromium`.
- **CI**: `.github/workflows/ci.yml` runs type-check, unit tests, build and E2E on every pull request and push to `main`.

Add a regression test with every bug fix. Stable selectors for E2E: `data-field-key` (dynamic dealer fields) and
`data-master-field` (master attributes on the journey page).
