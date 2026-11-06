import {
  pgTable,
  text,
  integer,
  bigint,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'
export const workspaces = pgTable('workspaces', {
  userId: text('user_id').primaryKey(),
  revision: integer('revision').notNull().default(0),
  data: jsonb('data').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
export const documents = pgTable('documents', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  size: integer('size').notNull(),
  notebookId: text('notebook_id').notNull().default(''),
  extractedText: text('extracted_text').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Identity remains the authentication source. These rows index the same Identity IDs.
export const adminAccounts = pgTable(
  'admin_accounts',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull().default(''),
    name: text('name').notNull().default(''),
    role: text('role').notNull().default('student'),
    status: text('status').notNull().default('active'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    registeredAt: timestamp('registered_at', { withTimezone: true }),
    lastLogin: timestamp('last_login', { withTimezone: true }),
    lastActive: timestamp('last_active', { withTimezone: true }),
  },
  (t) => [
    index('admin_accounts_registered_idx').on(t.registeredAt),
    index('admin_accounts_status_role_idx').on(t.status, t.role),
    index('admin_accounts_email_idx').on(t.email),
    index('admin_accounts_active_idx').on(t.lastActive),
  ],
)
export const activityEvents = pgTable(
  'activity_events',
  {
    id: text('id').primaryKey(),
    userId: text('user_id'),
    type: text('type').notNull(),
    feature: text('feature').notNull(),
    status: text('status').notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    correlationId: text('correlation_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('activity_events_time_idx').on(t.createdAt),
    index('activity_events_user_time_idx').on(t.userId, t.createdAt),
    index('activity_events_feature_time_idx').on(t.feature, t.createdAt),
    index('activity_events_type_time_idx').on(t.type, t.createdAt),
  ],
)
export const adminAudit = pgTable(
  'admin_audit',
  {
    id: text('id').primaryKey(),
    adminId: text('admin_id').notNull(),
    action: text('action').notNull(),
    targetId: text('target_id'),
    result: text('result').notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('admin_audit_time_idx').on(t.createdAt),
    index('admin_audit_admin_time_idx').on(t.adminId, t.createdAt),
  ],
)
export const adminRateLimits = pgTable('admin_rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
})
export const adminState = pgTable('admin_state', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
})

// Operational metadata only. No prompts, document names, URLs, stacks or credentials.
export const monitorEvents = pgTable(
  'monitor_events',
  {
    id: text('id').primaryKey(),
    userId: text('user_id'),
    category: text('category').notNull(),
    feature: text('feature').notNull(),
    provider: text('provider'),
    model: text('model'),
    status: text('status').notNull(),
    httpStatus: integer('http_status'),
    durationMs: integer('duration_ms'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    cachedTokens: integer('cached_tokens'),
    bytes: bigint('bytes', { mode: 'number' }),
    fileType: text('file_type'),
    code: text('code'),
    environment: text('environment').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('monitor_events_category_time_idx').on(t.category, t.createdAt),
    index('monitor_events_user_time_idx').on(t.userId, t.createdAt),
  ],
)
export const monitorIssues = pgTable(
  'monitor_issues',
  {
    id: text('id').primaryKey(),
    fingerprint: text('fingerprint').notNull().unique(),
    kind: text('kind').notNull(),
    category: text('category').notNull(),
    feature: text('feature').notNull(),
    severity: text('severity').notNull(),
    message: text('message').notNull(),
    httpStatus: integer('http_status'),
    environment: text('environment').notNull(),
    occurrences: integer('occurrences').notNull().default(1),
    readAt: timestamp('read_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeen: timestamp('last_seen', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('monitor_issues_kind_time_idx').on(t.kind, t.lastSeen)],
)
