# StudySphere

**Plan Smarter. Study Better.**

StudySphere combines its original homework planner, dashboard, timetable and focus timer with a private notes and AI study workspace. The existing Plus Jakarta Sans typography, purple identity and light/dark themes are retained.

## Workspace

Notes autosave to a signed-in account. The Tiptap editor supports headings, emphasis, highlights, lists, checklists, links, quotes and tables. Notes support tags, subject assignment, notebooks, colors, pinning, favorites, duplication, archive, trash and restoration. Notebook parents support nested organization. Collections include recently viewed, pinned, favorites and archived notes. Select several notes to create an AI study guide.

Documents support private uploads, renaming, notebook assignment, download, deletion and supported previews. PDF, DOCX and TXT text is extracted in the browser; images can be previewed and attached. Files are limited to 4 MB. PDF extraction reads up to 150 pages and 200,000 characters. Scanned PDFs and images require OCR, which is not included. Original files remain available even when text extraction fails.

The AI assistant uses real source content for summaries, explanations, writing improvements, revision notes, study guides, flashcards and interactive quizzes. Students explicitly choose Generate before content is transmitted. Flashcards can also be created manually and reviewed with Easy, Medium and Difficult ratings. Review dates and activity progress persist. Task reminders appear while the app is open; tasks can link to notes and appear on a monthly calendar.

Global search covers note content, tags, notebook names, document extracted text and flashcards, with keyword highlighting and natural-language query cleanup. An explicit AI query-expansion action includes related academic concepts without sending the workspace corpus. Vector embeddings and custom smart-collection rules are not implemented.

## Development

Use Node 22.13+ or 24 and pnpm (the repository lockfile is pnpm-lock.yaml).

```sh
pnpm install
netlify dev --port 8889
pnpm run typecheck
pnpm run lint
pnpm test
```

The Netlify development server supplies Functions, Identity and Blobs emulation. Plain Vite alone does not supply those services. Deployment configuration remains `vite build` with `dist/client` as the published directory. The deployment platform performs the production build.

## Storage, account security and migration

Netlify Identity handles sign-in, registration, email confirmation, password recovery and token refresh. Identity has been enabled for this project. New registrations normally require email confirmation. The application does not create administrator accounts or bypass confirmation.

Netlify Database stores a revisioned private workspace record per verified Identity user, containing notes, notebooks, tasks, subjects, timetable, focus sessions, flashcards, activity and preferences. Document metadata lives in a separate owned table; originals are stored in Netlify Blobs under user-specific keys. Functions derive ownership from verified Identity context, never a submitted user ID. Private responses disable caching. Concurrent saves use optimistic revision checks and show a conflict rather than replacing newer data.

Schema definitions live in `db/schema.ts`. The generated migration in `netlify/database/migrations` is applied automatically during deployment. Do not manually run schema pushes or migrations. Every schema change needs a new generated migration.

Old browser storage is preserved. After signing in, **Import browser data** explicitly merges the previous tasks, notes, subjects, timetable and focus history into that account. Importing the same IDs twice does not duplicate records. Browser storage is now only used for Identity session management, legacy imports and a user-scoped recovery draft; it is not the primary content database.

When cloud saving fails, the UI shows an error, preserves the private draft, offers retry/export/recovery and warns before leaving with unsaved changes. A conflicting draft requires an explicit recovery choice. Export includes workspace content, recovery draft and document metadata when available. Download document originals separately. Settings reset clears workspace records, while documents must be deleted from the document library.

The current workspace API transfers a bounded snapshot (up to 4 MB), and the client displays notes in batches of 30. Document and global-search collections currently load into the client. Larger installations should move to per-entity pagination and server search rather than increasing snapshot limits.

## AI setup and failures

The server-side OpenAI SDK uses Netlify AI Gateway with `gpt-4.1-mini`; no provider credentials are included in browser code. Netlify injects gateway configuration at runtime. Enable AI features in the Netlify project configuration and ensure the account has available credits. The site needs an existing production deployment. No user-entered provider keys are required.

AI errors and usage limits produce visible retry guidance without replacing original content or returning sample answers. Source text is limited to 80,000 characters per request. Generated quizzes and flashcards are validated before display or saving. Students should verify generated explanations against course materials.

## Validation

Type checking, lint and automated tests cover storage recovery, autosave across remounts, notebook and reminder persistence, note trash/restore, authenticated owner scoping, unauthorized requests, conflict responses, AI failures and source forwarding, search normalization and review scheduling. Live Gateway smoke checks verify real summaries and structured quiz/flashcard responses. Browser checks use isolated mocked account/storage responses; they do not establish that production email delivery or a not-yet-applied database migration works. Complete account-to-account and uploaded-file checks against the deployed preview after automatic migration application.
