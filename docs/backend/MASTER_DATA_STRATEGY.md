# Master data strategy: CRM and the ST Portal

Status: **proposal for the Solution Architect.** Test data only. The classification of each master is a draft (see `TML_Masters_Pack.xlsx`, sheet *Classification*); BA leads confirm it.

## 1. Approach (from the mail of 8 Oct 2026)

| Class | Meaning | System of record | In the ST Portal |
|---|---|---|---|
| **A** | Master already in CRM, used as it is | CRM | Read-only; fetched through Solar or API |
| **B** | New business master of an ST module, not in CRM | ST Portal | Maintained with admin and governance controls |
| **C** | CRM master that Business wants to control inside ST | CRM | Read from CRM; Business enables / disables / configures records per ST function, without touching CRM |

Example of C: CRM holds many PL / PPL models; Business makes only selected models available in specific ST functions. Likely later: dealers, outlets, service packages, roles, inspection templates, dashboard configurations.

## 2. Design points

1. **Lists of values of ST masters live in the ST Portal's own Common LOV Master** (type = `MODULE_FIELD`). Each LOV type carries a source flag (ST or CRM). CRM-sourced types are read-only and synced.
2. **A new ST field may refer to an existing CRM list.** The field points to the LOV type by code (nothing is copied) and stores the stable CRM code of the value, not its display text. Extra ST-only values on a CRM list are allowed only as separately flagged "ST extension" values (to be confirmed by the architect); Business control can hide CRM values.
3. **Masters with some CRM fields and some new ST fields**: every field has a source flag. A record has a CRM part (read-only, filled by the sync, keyed by the CRM key) and an ST part (editable extension fields). A sync touches only the CRM part. Parent / dependent list links use stable codes; if CRM removes a parent value the ST record is flagged *needs review*, never silently deleted.
4. **Business control is generic.** One control table (master, record, scope, state) works for any master, so a master that Business asks to control later needs no new table and no deployment: it is an admin switch on the master. Scopes (ST functionalities) are data. Two modes per master and scope: *deny-list* (everything on, Business switches some off) and *allow-list* (everything off, Business enables chosen records, for example models). In allow-list mode a new CRM record arrives as *new, not yet enabled* for Business to review. Control changes are audited, with an optional approval step.
5. **A CRM refresh never overwrites a business choice**, because source data and control live in different tables. The portal reads one combined view: source data + control.

> **Update 9 Oct 2026:** the database design for this approach is now written and tested: `schema_masters_crm.sql` and `schema_masters_crm_test.sql` (section 3 below lists what was proposed; the file is the result). The review document with diagrams is built by `npm run backend-doc`.

## 3. What exists and what is to add (see `schema.sql`)

Exists: `master_definition`, `master_field`, `master_rule`, `master_record`, history tables, `import_job`, `audit_log`, `dealer`, users and roles, employee profile tables.

To add: `source_system`, `sync_mode`, `control_mode` on `master_definition`; CRM key and last-sync on `master_record` (CRM part / ST part); `master_control` and `control_scope`; `master_sync_run` and `master_sync_item`; source flag on LOV types and values.

## 4. Open points for the architect

- Sync frequency and whether only changes are sent.
- What happens when CRM changes or deletes a record that Business had disabled.
- Granularity of control: per ST function, per module, per dealer.
- Who approves control changes.
- Record volumes per master.
- Whether ST extension values on CRM lists are allowed.
