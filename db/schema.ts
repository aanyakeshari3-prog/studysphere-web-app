import { pgTable, text, integer, jsonb, timestamp } from 'drizzle-orm/pg-core'
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
