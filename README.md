# TML Journey & Admin (prototype)

React 19 + TypeScript + Vite + Tailwind. All data is generated in-memory (`src/data`); there is no backend.

## Scripts

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Dev server on http://localhost:3000 |
| `npm test` | Run the test suite once (Vitest + React Testing Library) |
| `npm run test:watch` | Re-run tests on change |
| `npm run lint` | Type-check (`tsc --noEmit`) |
| `npm run build` | Production build |

## Conventions (please keep these)

- **Routing** lives in the URL hash (`#/journey/JC…`, `#/admin/users?search=…`). Use `navigate()` from `useApp()`; pages read `?search=` via `useRouteSearchParam`.
- **Pages list**: `src/config/navigation.ts` is the single source for navigable pages (command palette, access fallbacks).
- **State updates**: never call `logAudit` / `showToast` inside a `setState(prev => …)` updater — React may run updaters twice.
- **Dates**: parse app timestamps (`YYYY-MM-DD HH:MM[:SS]`) with `parseDateTime()` from `src/utils/dateUtil.ts`, not `new Date(str)` (breaks in Safari / shifts by timezone).
- **Bulk imports** go through `mergeImportedRecords()` (`src/utils/recordMerge.ts`).
- **Record ids** must be unique within a master; the editors enforce this.

## Tests

Tests live next to the code in `__tests__` folders and in `src/__tests__` (app-level flows).
Add a regression test with every bug fix.
