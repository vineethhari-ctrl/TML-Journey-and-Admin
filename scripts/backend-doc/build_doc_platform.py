"""Builds build/backend-doc/TML_Platform_Backend_Design_Part3.docx for the Solution Architect (test data only).
Part 3 of the database design: configuration, devices, sessions, default views and audit coverage.
Run `npm run backend-doc` (draws the diagrams first). Needs: pip install python-docx."""
from docx.shared import RGBColor

from docx_kit import NAVY, bullets, code, para, picture, save, start, table

doc = start('TML Service Transformation · Platform backend design (part 3) · draft for review · test data only · page ')

# ------------------------------------------------------------------ title
para('TML Service Transformation', bold=True, size=12, color=RGBColor(0x0B, 0x4F, 0x8A), space_after=2)
para('Platform backend design (part 3)', bold=True, size=26, color=NAVY, space_after=2)
para('Configuration, devices, sessions, default views and audit coverage of the Admin Portal', size=14, color=RGBColor(0x47, 0x55, 0x69), space_after=10)
para('For: Solution Architect · Draft for review · 15 October 2026 · Test data only', italic=True, size=10, space_after=12)

doc.add_heading('1. In one page', level=1)
para('Parts 1 and 2 of the database design cover the masters (the generic master engine, and masters from CRM with the business control layer). '
     'Part 3 covers the screens of the Admin Portal that govern the platform itself: Configuration, Devices, Sessions and Default Views, '
     'and it makes the Audit Log complete. Today the portal keeps these in each user\'s browser; part 3 gives them a shared, governed home.')
bullets([
    ('Identity stays with TML SSO. ', 'Who a person is, passwords and password expiry belong to SSO. The database stores only what the portal itself must control: which devices may be used, which sessions are open, how long they last, and what each role sees first.'),
    ('Rules live in the database, not only in the screens. ', 'Every setting is typed and range-checked; a blocked device or a locked account ends its sessions at once; an ended session can never be reopened; a default view that would leave a user without a visible tab is refused.'),
    ('Personal layouts are not stored. ', 'BU decision of 6 October 2026: users personalise for their session only and the role default comes back at sign-out. Only the defaults per role (set by TML Admin) are stored.'),
    ('Nothing is missed in the audit. ', 'Every audit action is catalogued with who writes it (the database or the API) and whether it is security-relevant or a DPDP personal-data access. A governance view lists any action nobody catalogued; it must stay empty.'),
])
para('The design is delivered as a database script for PostgreSQL 16 (schema_platform.sql, on top of parts 1 and 2) and is proven by a self-checking test '
     '(103 checks and 56 refused wrong actions) that runs on every change together with the tests of parts 1 and 2. Section 11 lists the decisions we need from the architect.', space_after=8)

doc.add_heading('2. What part 3 covers', level=1)
table(['Admin Portal screen', 'Tables', 'API (tag in the contract)'], [
    ['Configuration', 'system_setting, system_setting_history', 'Configuration: /settings'],
    ['Devices', 'user_device, user_device_event', 'Devices & sessions: /devices'],
    ['Sessions', 'user_session, login_attempt, view user_session_status', 'Devices & sessions: /sessions, /login-attempts'],
    ['Users (locks)', 'app_user + locked_until, lock_reason, failed_login_count, password_changed_at', 'Devices & sessions (sign-in)'],
    ['Default Views', 'ui_card, ui_tab, ui_list, ui_list_column, default_view_policy, default_view_card / _tab / _column, default_view_history', 'Default views: /default-views, /ui-catalogue, /me/default-view'],
    ['Audit Log', 'audit_action_catalog, views audit_log_uncatalogued, audit_log_security', 'Notifications & audit: /audit-actions, /audit-log'],
], widths=[1.4, 3.4, 2.2])

# ------------------------------------------------------------------ configuration
doc.add_heading('3. Configuration', level=1)
para('One row per setting, with its type (number or switch), its range and unit, the portal field it maps to, and whether the portal enforces it or it is kept for reference (SSO). '
     'The only way to change a setting is set_system_setting: it checks the type and the range, refuses an idle timeout longer than the session timeout, refuses a save based on an old version '
     '(two admins never overwrite each other), keeps the history (old value, new value, who, when, why) and writes the audit.')
table(['Setting', 'Default', 'Allowed', 'Used by'], [
    ['session.timeout_minutes', '60', '5 – 1440 min', 'Sessions end this long after sign-in'],
    ['session.idle_timeout_minutes', '15', '1 – 240 min (≤ session timeout)', 'No activity for this long ends the session'],
    ['session.max_concurrent', '3', '1 – 20', 'Above it the least recently used session ends'],
    ['session.force_logout_on_password_change', 'on', 'on / off', 'SSO password change ends all sessions'],
    ['session.history_retention_days  (NEW)', '180', '30 – 3650 days', 'Housekeeping of ended sessions and sign-ins'],
    ['security.max_login_attempts', '5', '1 – 20', 'Failures in a row before the lock'],
    ['security.account_lock_minutes', '30', '1 – 1440 min', 'Automatic lock duration'],
    ['security.password_expiry_days', '90', '0 – 365 days', 'Reference only: enforced by TML SSO'],
    ['security.device_registration_required', 'on', 'on / off', 'New devices wait for approval'],
    ['notification.email_enabled / sms_enabled / in_app_enabled', 'on', 'on / off', 'Notification channels'],
    ['notification.urgent_exception_alerts', 'on', 'on / off', 'Immediate alert on critical journey exceptions'],
    ['journey.event_retention_days', '365', '30 – 3650 days', 'Journey events archive (part 4)'],
    ['journey.exception_threshold_minutes', '30', '1 – 1440 min', 'Overdue stage raises an exception (part 4)'],
    ['journey.stage_timeout_hours', '4', '1 – 168 h', 'Stage flagged as timed out (part 4)'],
    ['journey.auto_escalate_exceptions', 'on', 'on / off', 'Escalation along the escalation matrix (part 4)'],
], widths=[2.6, 0.6, 1.6, 2.2], font=9)
para('The defaults are the portal\'s current defaults. The values themselves (for example a 60-minute session for a workshop shift) are for BU to confirm; changing them later is a setting, not a release.', italic=True, size=9.5)

# ------------------------------------------------------------------ devices
doc.add_heading('4. Devices', level=1)
picture('p3.png')
bullets([
    ('Privacy by design: ', 'only a SHA-256 fingerprint of the device identifier is stored, never the identifier itself. A MAC address column exists only for managed workshop devices (MDM); browsers cannot read it.'),
    ('Approval: ', 'when "Device registration required" is on, a device seen for the first time is PENDING; the TML admins get a notification with a link to the device; the user cannot sign in from it until it is approved.'),
    ('Block: ', 'needs a reason. Blocking or deactivating a device ends its open sessions immediately. A pending device can be blocked (refused) directly.'),
    ('History: ', 'every change is kept in user_device_event (append-only) and in the audit log.'),
])

# ------------------------------------------------------------------ sessions
doc.add_heading('5. Sign-in and sessions', level=1)
picture('p1.png')
picture('p2.png')
table(['Function', 'Called by', 'What it does'], [
    ['register_device', 'API, at every sign-in', 'Recognises a known device or registers a new one (PENDING / ACTIVE); returns the device id'],
    ['start_session', 'API, after SSO', 'Checks user and device, applies the concurrent limit, opens the session, records the sign-in'],
    ['touch_session', 'API, every request', 'true = carry on; false = the session has ended (closed here if it has just timed out)'],
    ['end_session', 'API (sign-out, admin)', 'LOGOUT or TERMINATED_BY_ADMIN'],
    ['end_sessions_where', 'API (admin), database', 'Ends all open sessions of a user, a device, or everybody except the admin'],
    ['record_login_failure', 'API', 'Records a failed sign-in; locks after N in a row; returns true when it locked'],
    ['record_password_change', 'API (SSO event)', 'Ends the user\'s sessions when the setting says so'],
    ['expire_sessions', 'Scheduler, every few minutes', 'Closes timed-out and idle sessions'],
    ['purge_session_history', 'Scheduler, daily', 'Removes ended sessions and sign-ins older than the retention'],
], widths=[1.7, 1.6, 3.7])

doc.add_heading('6. Failed sign-ins and account locks', level=1)
bullets([
    'Each failed sign-in is recorded (also for a name that matches no user). The count of failures in a row is kept on the user and reset by a successful sign-in or an unlock.',
    'After the configured number (default 5) the account is LOCKED until now + lock duration (default 30 minutes). Open sessions end, the TML admins get a SECURITY notification and the audit gets a WARNING row.',
    'An automatic lock lifts itself at the first sign-in after its end time (audited "Account Unlocked"). A lock set by an admin has no end time and stays until an admin lifts it.',
    'Failures while the account is already locked or suspended are recorded but do not extend or repeat the lock.',
])
para('Note: with TML SSO most wrong passwords are seen by SSO, not by the portal. Whether SSO forwards its failures, or locks accounts itself, is decision 2 in section 11.', italic=True, size=9.5)

# ------------------------------------------------------------------ default views
doc.add_heading('7. Default views', level=1)
picture('p4.png')
para('A role\'s default view is saved in one call, from the same document the Default Views screen edits. Everything is checked before anything is written:')
code('''{"cards":   {"allowed": ["jc_tracking","eqc","customer_journey"], "order": ["eqc"], "hidden": ["customer_journey"]},
 "tabs":    {"allowed": ["gate_in","my_assignment","quality_inspection"], "order": ["quality_inspection"],
             "hidden": ["gate_in"], "landing": "quality_inspection"},
 "columns": {"gate_in": {"visible": ["vehicleNo","status"], "pinnedLeft": ["vehicleNo"]}}}''')
table(['Rule (refused otherwise)', 'Why'], [
    ['At least one landing card allowed and visible', 'A user must always have somewhere to start'],
    ['At least 2 header tabs visible (or all, when fewer are allowed)', 'Same rule as the portal (MIN_VISIBLE_TABS)'],
    ['The landing tab is allowed and visible', 'The user must land on something they can see'],
    ['Only known, active cards, tabs, lists and columns; nothing listed twice', 'A typo or a retired item never reaches users'],
    ['Ordered or hidden items must be allowed', 'No hidden "back door" to a card the role may not use'],
    ['Each list: at least one visible column; pinned columns visible; not pinned on both sides; not visible and hidden at once', 'Consistent grids'],
], widths=[3.6, 3.4])
bullets([
    ('Versions and history: ', 'every save gets the next version number, also after a reset; the full view of each version is kept (append-only), so any earlier view can be restored by saving it again.'),
    ('PII columns: ', 'customer name and phone columns are flagged in the catalogue; they are shown masked unless the role may unmask (DPDP action UNMASK_PII is audited).'),
])

# ------------------------------------------------------------------ audit
doc.add_heading('8. Audit coverage', level=1)
para('audit_action_catalog lists every action that can appear in the Audit Log: 14 written by the database itself and 39 written by the API (the actions the portal writes today). '
     'For each action it says who writes it, whether it belongs to the security review, and whether it is a DPDP personal-data access.')
table(['Written by the database (the API must not write these again)', 'Security'], [
    ['Configuration Changed', 'yes'],
    ['Device Registered / Approved / Blocked / Unblocked / Deactivated / Reactivated', 'yes'],
    ['Session Terminated / Session Terminated All / Sessions Ended', 'yes'],
    ['Account Locked (WARNING) / Account Unlocked', 'yes'],
    ['Default Views Updated / Default Views Reset', 'no'],
], widths=[5.6, 1.4])
bullets([
    ('DPDP access log: ', 'UNMASK_PII, CTI_CALL and EXPORT_WORKLIST are flagged is_dpdp, so the personal-data access log is one filter.'),
    ('Security review: ', 'the view audit_log_security (API: /audit-log?securityOnly=true) shows only security-relevant and DPDP actions.'),
    ('Governance: ', 'the view audit_log_uncatalogued lists any action in the log that nobody catalogued. It must stay empty; the tests check it.'),
    ('Who and from where: ', 'the database takes the user and the IP address from the request settings the API sets (app.user_id, app.client_ip), so every row says who did it.'),
])

# ------------------------------------------------------------------ security
doc.add_heading('9. Security and privacy', level=1)
bullets([
    'No passwords, tokens or raw device identifiers are stored: only SHA-256 hashes (device fingerprint, SSO session id).',
    'Row-level security: a Dealer Admin sees only the sessions, devices and sign-ins of their own dealer\'s people (same rule as masters and bays in part 1); TML users see all.',
    'History tables are append-only (settings, devices, default views), like the audit log of part 1.',
    'Ended sessions are final: the database refuses to reopen or change them.',
    'Suspending, locking or deactivating a user, blocking or deactivating a device, and an SSO password change all end the affected sessions inside the same transaction.',
])

# ------------------------------------------------------------------ api
doc.add_heading('10. API list', level=1)
para('The full contract (request and response shapes, errors) is in public/api-docs/openapi.yaml, under the tags Configuration, Devices & sessions and Default views.')
table(['Method and path', 'Purpose', 'Who'], [
    ['GET /settings', 'All settings with value, default, range, version', 'TML Admin'],
    ['PUT /settings/{key}', 'Change one setting (If-Match = version)', 'TML Admin'],
    ['GET /settings/{key}/history', 'Changes of a setting', 'TML Admin'],
    ['POST /sessions', 'Start a session after SSO (registers the device)', 'Every user'],
    ['GET /sessions', 'Sessions screen (ACTIVE / IDLE / TERMINATED)', 'TML Admin, Dealer Admin (own dealer)'],
    ['DELETE /sessions/current', 'Sign out', 'Every user'],
    ['POST /sessions/{id}/terminate', 'End one session', 'TML Admin, Dealer Admin'],
    ['POST /sessions/terminate', 'End all of a user, a device, or everybody', 'TML Admin'],
    ['GET /devices', 'Devices screen', 'TML Admin, Dealer Admin (own dealer)'],
    ['POST /devices/{id}/actions', 'Approve, block, unblock, deactivate, reactivate', 'TML Admin'],
    ['GET /devices/{id}/events', 'Device history', 'TML Admin'],
    ['GET /login-attempts', 'Sign-in attempts (security review)', 'TML Admin'],
    ['GET /ui-catalogue', 'Cards, tabs, lists and columns', 'TML Admin'],
    ['GET /me/default-view', 'What the signed-in user starts with', 'Every user'],
    ['GET / PUT / DELETE /default-views/{role}', 'Read, save, reset a role\'s default view', 'TML Admin'],
    ['GET /default-views/{role}/history', 'Versions of a role\'s view', 'TML Admin'],
    ['GET /audit-actions', 'The audit catalogue', 'TML Admin'],
    ['GET /audit-log?securityOnly=true', 'Security review of the audit', 'TML Admin'],
], widths=[2.3, 3.0, 1.7], font=9)

# ------------------------------------------------------------------ decisions
doc.add_heading('11. Decisions needed from the architect', level=1)
table(['#', 'Question', 'Default in this design'], [
    ['1', 'A user with several roles: which role\'s default view do they get?', 'A fixed role priority (TML_ADMIN first); the API picks the first role that has its own view, else "*"'],
    ['2', 'Does TML SSO forward failed sign-ins to the portal, or lock accounts itself?', 'The portal counts what it sees; if SSO locks itself, set the portal limit high or keep it as a second line'],
    ['3', 'Where does the device fingerprint come from?', 'A random id the portal keeps on the device (hashed); MDM device id for managed workshop devices'],
    ['4', 'Who approves dealer devices: TML Admin only, or the Dealer Admin for their own dealer?', 'TML Admin (notification goes to TML_ADMIN)'],
    ['5', 'Session values for workshop users (8-hour shifts): 60-minute session, 15-minute idle?', 'Portal defaults; BU to confirm; a setting, not a release'],
    ['6', 'Retention of ended sessions and sign-in attempts', '180 days (new setting)'],
    ['7', 'Scheduler for housekeeping (expire_sessions, purge_session_history)', 'The API\'s scheduler; pg_cron is an alternative'],
    ['8', 'Password expiry in Configuration', 'Kept for reference only (enforced_by = SSO); can be hidden'],
], widths=[0.4, 3.2, 3.4])

# ------------------------------------------------------------------ guarantees
doc.add_heading('12. What the database guarantees (tested)', level=1)
bullets([
    'A setting cannot be saved with the wrong type, outside its range, as a decimal, with an idle timeout longer than the session timeout, or over someone else\'s newer change.',
    'A new device waits for approval when required; the admins are told; a pending, blocked or inactive device, or somebody else\'s device, cannot be used to sign in.',
    'Never more open sessions than the limit; timed-out and idle sessions are closed; an ended session cannot be reopened.',
    'Blocking or deactivating a device, suspending, locking or deactivating a user, and a password change end the right sessions, with the reason and who did it.',
    '"Terminate all" keeps the admin\'s own session.',
    'The lock happens exactly after N failures in a row, lasts the configured time, lifts itself afterwards, and an admin lock stays until lifted.',
    'Dealer Admins see only their own dealer\'s sessions, devices and sign-ins.',
    'A default view that breaks any rule is refused and leaves nothing behind; versions keep counting after a reset; a retired card or column disappears from every view.',
    'Every action written by the database is catalogued and appears in the right module; nothing in the log is uncatalogued.',
])
para('Proof: schema_platform_test.sql (103 checks and 56 refused wrong actions) runs on PostgreSQL 16 after the tests of parts 1 and 2 on every change in the project.', italic=True)

doc.add_heading('13. Not covered yet', level=1)
bullets([
    'Part 4: the TML Journey tables (journey events, stages, exceptions, escalations). The journey settings above are ready for it; the tables follow once the BA teams confirm the journey masters.',
    'The SSO integration itself (token validation, role mapping from AD groups) and the scheduler: decisions for TML IT.',
    'Switching the portal screens from browser storage to these APIs.',
])
para('Files: docs/backend/schema_platform.sql (the design), schema_platform_test.sql (the tests), README.md section 14, and the API contract public/api-docs/openapi.yaml. Test data only: no real Tata Motors data is used.', italic=True, size=9.5)

save('TML_Platform_Backend_Design_Part3.docx')
