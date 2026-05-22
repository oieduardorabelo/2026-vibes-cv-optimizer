import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  cvContent: text('cv_content').notNull().default(''),
  parsedProfile: text('parsed_profile'),
  preferences: text('preferences'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const searches = sqliteTable('searches', {
  id: text('id').primaryKey(),
  profileId: text('profile_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  status: text('status').notNull().default('pending'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  searchId: text('search_id')
    .notNull()
    .references(() => searches.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  company: text('company').notNull().default(''),
  location: text('location').notNull().default(''),
  url: text('url').notNull().default(''),
  source: text('source').notNull().default(''),
  description: text('description').notNull().default(''),
  salary: text('salary').notNull().default(''),
  remote: integer('remote', { mode: 'boolean' }).default(false),
  matchScore: integer('match_score'),
  matchAnalysis: text('match_analysis'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})
