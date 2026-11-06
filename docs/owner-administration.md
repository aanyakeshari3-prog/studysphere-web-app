# StudySphere owner administration

The admin dashboard extends the existing TanStack Start application, Netlify Identity provider, Netlify Database, and Netlify Blobs document store. It does not create another authentication system or copy student content into analytics. The student dashboard layout is preserved.

## Deployment and Owner setup

1. Identify the intended Owner's existing **Netlify Identity user ID** in the project's Identity directory. If the intended Owner does not have an account, create/confirm that account first. Never select the first registered account automatically.
2. Set `STUDYSPHERE_OWNER_USER_ID` in Netlify with **Functions/runtime scope** and the appropriate production or preview deploy context. Its value must be that exact Identity ID. Do not prefix it with `VITE_`, put it in a frontend file, or put it in source control. No new database password, API key, or Identity operator token needs to be configured by application code.
3. Deploy normally. The platform applies the two additive migrations before publishing. Do not modify or remove the existing applied workspace migration. Identity activation has been run for this implementation.
4. Sign in as the configured Owner and open `/admin`. Choose **Sync accounts** to index existing Identity accounts in bounded pages. A rate-limited sync can be resumed by clicking Sync accounts again; the server saves its next page. Start a fresh sync after a completed run to refresh the directory.
5. Open User management, select an account, and choose **Make Admin** if appropriate. Confirm with its full user ID. Application roles are enforced by the server-side account index, not browser metadata or JWT role arrays. Existing Identity role metadata is not overwritten.
6. Complete the deployment smoke checks below before opening administration to additional operators.

If the Owner variable is absent, no account receives the Owner role. The Owner cannot be changed, suspended, deleted, or demoted through the app, including by the Owner themselves. Transferring ownership requires changing the server configuration. Access to that configuration is therefore privileged. Normal admins may view reports and suspend/reactivate students; only the Owner may grant/remove Admin roles, delete other accounts, and synchronize the directory. No operator can modify themselves through account actions.

## Routes and screens

- `/admin`: overview, fixed-window summary counts, selected-range active-user and registration charts, recent timeline, feature usage, engagement, account health, and synchronization coverage.
- `/admin/users`: name/email/ID search, account filters, fixed allowlisted sorting, and server-side pagination of 25 rows.
- `/admin/users/:userId`: direct account detail link, account/security timestamps, verification, usage counts, security events, account actions, and a link to that user's activity. Details appear in an accessible dialog within the administration layout.
- `/admin/activity`: searchable activity list, type/feature/result/date filters, pagination, and safe event details. `?user=<Identity ID>` filters a single account.
- `/admin/analytics`: selected-range activity and registration charts, unique active/new/returning users, feature events/adoption, and fixed-window engagement summaries.
- `/admin/audit`: separate chronological privileged-operation log with search, type/result/date filters, pagination, and safe metadata.

The layout has its own responsive sidebar, breadcrumbs, system-notice area, profile/sign-out menu, theme controls, skeletons, empty/error states, and confirmation dialogs. All date-based reports use UTC. Student due dates still use the existing local-date helpers.

## Data model and migrations

`20261106065335_add_owner_administration` adds five tables:

- `admin_accounts`: a minimal index keyed by the original Identity ID; email, display name, provider timestamps, application role, status, and last meaningful activity. Identity remains the source of authentication and registration metadata. Deleted accounts retain an ID-only blocked tombstone to reject stale sessions.
- `activity_events`: server-generated ID/time/type/category/result, nullable verified or targeted account ID, safe numeric/boolean metadata, and optional correlation ID.
- `admin_audit`: administrator ID, action, target ID, timestamp, result, and restricted contextual metadata. The API has no update/delete operation for audit records.
- `admin_rate_limits`: persistent per-minute counters shared across function instances.
- `admin_state`: directory-sync cursor/completion and admin-login deduplication state.

`20261106065445_index_administration_queries` adds activity time/user/category/type indexes, account registration/status/role/email/last-activity indexes, and audit time/administrator indexes.

Neither migration changes existing workspace or document records. Schema generation was used; no migrations were applied manually and no production data was changed during implementation. The platform applies migrations during deployment.

## Event coverage and definitions

Workspace events are derived from differences between validated, committed server snapshots. Note creation/edit/trash/permanent deletion, task creation/edit/completion/deletion, individual flashcard creation/edit/review/deletion, notebook changes, focus-session creation, and preference changes are recorded as batches with numeric counts. Event counts represent log rows, not the sum of changed items. An initial workspace import records one initialization event rather than invented historical actions. Note-view timestamps, page loads, and identical saves do not create meaningful activity events. Client-supplied activity arrays are not used as telemetry.

Document upload/edit/delete events commit with their metadata changes. Download logging means delivery was initiated; browser completion cannot be established. AI initiation/completion/failure and AI-assisted search-term generation are recorded without source text, prompts, responses, questions, document names, or note titles. Authentication hooks record registrations, successful logins, verification changes, and deny logins/profile changes for blocked accounts. Login and password recovery in this app use the existing Identity SDK through a same-origin, IP-rate-limited server endpoint. Failed logins and requested resets are recorded without credentials or attempted email addresses in event payloads. An unknown account is deliberately unattributed; an existing account is a targeted account for those unauthenticated security requests. Such requests do not establish that the user was present. Failed events and password-reset requests do not count toward active users. Sign-out logging records a verified session's **logout request**, not a provider-confirmed global session revocation.

Activity and audit data begin when instrumentation is deployed. The directory must be synced before historical registration totals can represent all existing Identity accounts. Directory data is a snapshot plus lifecycle/request updates; changes made directly in the provider require synchronization. Sync is non-destructive and does not delete workspace data or infer external account deletion. Local-only searches are not measured. Flashcards are modeled as individual cards, not a separate flashcard-set entity, so counts are explicitly per card. Zero means zero recorded events, not proof that an uninstrumented feature was never used. There are no demo analytics numbers.

DAU is distinct successful-event users today; WAU and MAU use rolling seven/thirty-day windows. Admin-generated suspension/reactivation events are excluded from active-user metrics. Calendar registration week starts Monday and registration month starts on the first. Returning users registered before the selected range; new active users registered within it. Unknown registration dates belong only to the overall active total. Feature adoption is distinct recorded feature users divided by indexed, undeleted accounts. The fixed-window cards remain labeled as such when a report range changes. Total events means all retained events, not lifetime history.

## Security, deletion, and privacy

Every private workspace, document, and AI request checks the authenticated Identity ID and current database account status. Every admin request also verifies the database role or exact configured Owner ID. Privileged writes require same-origin requests, strict validation, and target-ID confirmation. SQL values are bound parameters; dynamic sort/filter SQL uses closed allowlists. Admin responses disable caching. Read/write limits use database counters; unauthenticated login/recovery limits hash the trusted runtime IP. No raw IP address is stored. Sensitive provider material is never returned by the admin or auth-action APIs.

Role/status changes and their audit records commit together under a transaction and mutation lock. Owner/self-protection and current operator permissions are rechecked inside that transaction. Failed privileged attempts receive safe failure audits when the database is available. A database outage fails private operations closed and returns a generic error.

Deletion first changes status to `deleting`, blocking new requests. A per-user lock waits for previously accepted workspace/document/AI operations to finish. All files under that user's Blobs prefix, the provider account, workspace, document rows, and personal activity events are then removed. Cleanup is retryable and idempotent; a failed operation leaves the account blocked and visible for Owner retry. Safe audit IDs/results are retained, while indexed personal account data is cleared. This app cannot delete exports or backups already downloaded to someone else's device, and provider/platform backup retention is governed separately.

The daily retention function removes activity older than 90 days, audit records older than 365 days, expired rate counters, and old login deduplication records. Privacy notices appear in authentication and settings. Ordinary admins cannot edit logs. Database operators remain trusted and platform/database access must be restricted separately. A database outage can also prevent recording an attempted-operation failure; the application does not claim a tamper-proof external audit ledger.

## Validation and remaining deployment checks

Automated TypeScript checking includes backend `.mts` files. The regression/security/UI suite covers anonymous rejection, forged roles, Owner protection, self-escalation, suspension checks across existing APIs, role-denial rollback, target confirmation, database failure handling, limits, bound searches/pagination, UTC validation, snapshot event privacy/baselines, account mutations, complete/retryable deletion orchestration, authentication failure/recovery logging, credential-free responses, filters, and empty states. Test doubles isolate these checks from real accounts and storage.

A local Netlify development check confirmed HTTP 200 for the admin shell/detail URL and HTTP 401 for anonymous `/api/admin`. No production build was run; the platform performs build validation.

Authenticated provider/real-database end-to-end behavior was not tested against real accounts, and no owner ID was invented or configured. After deployment, verify Owner/Admin/Student access, secure server-login cookie refresh and sign-out, signup/confirmation/recovery delivery and lifecycle events, a complete directory sync, aggregate counts against database records, date filters, suspension/reactivation with an already-open student session, and deletion of an explicitly disposable account with uploaded files. Also smoke-test existing notes, tasks, flashcards, document uploads/downloads, and AI with actual service availability. Confirm scheduled retention in the deployed environment. Visual checks at mobile/desktop widths and an accessibility/browser review remain advisable.

Direct provider sign-in attempts that bypass this app's login endpoint, local-only searches, and successful global logout/revocation are not fully observable by the app. External provider deletions are not automatically reconciled with private workspace cleanup; perform such deletions through the Owner dashboard or define a separate reconciler before relying on external deletion workflows. These limits prevent treating Phase 1 as fully production-validated solely from the local tests.
