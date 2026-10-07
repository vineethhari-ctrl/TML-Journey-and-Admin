# Employee Management (Employee / Users + Roles & Access)

Built into the two existing screens — nothing was removed.

## Employee / Users
- **List:** new columns *Designation / Expertise* and *Skills* (green = meets the role, amber "gap" = a skill or certificate is missing).
- **Employee profile (click the eye icon):** new tabs **Employment** (designation, type, status, joining date, shift,
  Service Advisor expertise), **Role & Views** (screens, landing cards, worklist tabs, columns, permissions and
  requirements of the role) and **Skills & Certificates** (level L1–L4, certificate expiry, gaps; add / remove).
- **Skills & Certificates tab:** employees × skills grid, gaps, certificates to renew, filters, Export to Excel.
- **Availability tab:** available people by skill and shift, Service Advisors by expertise, "Who can do this?" finder.
- Existing tabs (Users, Employees, Pending, Suspended, Proficiency & LMS) and the existing drawer tabs are unchanged.

## Roles & Access → Roles & Position Types
Every role in the application (`src/data/roleCatalogue.ts`): administration, dealer management, dealer front office,
dealer workshop, TML back office, read only. For each: description, modules, people, gaps, the screens / cards / tabs /
columns it sees (taken from the same rules the application uses: `utils/roleAccess.ts`, Default Views), permissions,
module permissions (Roles & Access) and the skills and certificates it needs. Export to Excel.

## Service Advisor expertise
Mechanical, Bodyshop or Both (Common LOV `ADMIN_SA_EXPERTISE`). It decides which job cards he or she can create
(`canAdviseOn`) and which skill is required (Skill Master: SA-MECH, SA-BODY).

## Data
Designations, shifts, skills, skill levels and certificates come from the generic masters (Common Masters), so the TML
Admin maintains them on screen or by Excel upload. Employee profiles are derived for every user and any edit is saved
in the browser (prototype). Production: `employee_profile`, `employee_skill`, `employee_certification`
(see `docs/backend/schema.sql`).

Code: `utils/employeeProfile.ts` (checks, pure and unit-tested), `utils/roleViews.ts`, `utils/roleAccess.ts`,
`components/administration/EmployeeProfileTabs.tsx`, `EmployeeInsightPanels.tsx`, `RoleCataloguePanel.tsx`.
