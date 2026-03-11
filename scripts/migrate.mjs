#!/usr/bin/env node
/**
 * Database migration script.
 * Run: POSTGRES_URL="postgres://..." node scripts/migrate.mjs
 */

import pg from 'pg';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    if (!process.env[t.slice(0, eq)]) process.env[t.slice(0, eq)] = t.slice(eq + 1);
  }
}

const { Client } = pg;

const POSTGRES_URL = process.env.POSTGRES_URL;
if (!POSTGRES_URL) {
  console.error('ERROR: POSTGRES_URL environment variable is required');
  process.exit(1);
}

const client = new Client({
  connectionString: POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

const MIGRATIONS = [
  {
    name: 'Create posts table',
    sql: `
      CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        slug TEXT,
        title TEXT,
        content TEXT,
        post_type TEXT,
        created_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ,
        comment_count INTEGER DEFAULT 0,
        upvotes INTEGER DEFAULT 0,
        is_pinned BOOLEAN DEFAULT false,
        author_id TEXT,
        author_name TEXT,
        author_first_name TEXT,
        author_last_name TEXT,
        author_bio TEXT,
        topic TEXT,
        role TEXT,
        classification_reasoning TEXT,
        suggested_repliers TEXT[],
        voice_profile TEXT,
        reply_status TEXT DEFAULT 'pending',
        assigned_to TEXT,
        scraped_at TIMESTAMPTZ DEFAULT NOW(),
        classified_at TIMESTAMPTZ,
        skool_url TEXT
      )
    `,
  },
  {
    name: 'Create comments table',
    sql: `
      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        post_id TEXT REFERENCES posts(id),
        content TEXT,
        created_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ,
        upvotes INTEGER DEFAULT 0,
        parent_id TEXT,
        root_id TEXT,
        author_id TEXT,
        author_name TEXT,
        author_first_name TEXT,
        author_last_name TEXT,
        author_bio TEXT,
        scraped_at TIMESTAMPTZ DEFAULT NOW()
      )
    `,
  },
  {
    name: 'Create drafts table',
    sql: `
      CREATE TABLE IF NOT EXISTS drafts (
        id SERIAL PRIMARY KEY,
        post_id TEXT REFERENCES posts(id),
        draft_type TEXT,
        content TEXT,
        voice_profile TEXT,
        generated_at TIMESTAMPTZ DEFAULT NOW(),
        edited_content TEXT,
        edited_at TIMESTAMPTZ
      )
    `,
  },
  {
    name: 'Create indexes',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_posts_topic ON posts(topic);
      CREATE INDEX IF NOT EXISTS idx_posts_role ON posts(role);
      CREATE INDEX IF NOT EXISTS idx_posts_reply_status ON posts(reply_status);
      CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
      CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
    `,
  },
  {
    name: 'Create members table',
    sql: `
      CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY,
        slug TEXT,
        first_name TEXT,
        last_name TEXT,
        display_name TEXT,
        email TEXT,
        invite_email TEXT,
        billing_email TEXT,
        bio TEXT,
        location TEXT,
        link_linkedin TEXT,
        link_instagram TEXT,
        link_website TEXT,
        link_youtube TEXT,
        link_facebook TEXT,
        link_twitter TEXT,
        myers_briggs TEXT,
        picture_url TEXT,
        account_created_at TIMESTAMPTZ,
        member_joined_at TIMESTAMPTZ,
        last_online_at TIMESTAMPTZ,
        member_role TEXT,
        attribution TEXT,
        invited_by_id TEXT,
        invited_by_name TEXT,
        approved_by_id TEXT,
        request_location TEXT,
        survey_revenue_bracket TEXT,
        survey_website TEXT,
        survey_phone TEXT,
        subscription_amount INTEGER,
        subscription_currency TEXT,
        subscription_interval TEXT,
        subscription_tier TEXT,
        stripe_subscription_id TEXT,
        scraped_at TIMESTAMPTZ DEFAULT NOW()
      )
    `,
  },
  {
    name: 'Create members indexes',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_members_member_role ON members(member_role);
      CREATE INDEX IF NOT EXISTS idx_members_attribution ON members(attribution);
      CREATE INDEX IF NOT EXISTS idx_members_joined ON members(member_joined_at);
      CREATE INDEX IF NOT EXISTS idx_members_last_online ON members(last_online_at);
    `,
  },
];

async function migrate() {
  console.log('Connecting to database...');
  await client.connect();
  console.log('Connected.\n');

  for (const migration of MIGRATIONS) {
    console.log(`Running: ${migration.name}...`);
    await client.query(migration.sql);
    console.log(`  Done.`);
  }

  // Verify tables exist
  const result = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN ('posts', 'comments', 'drafts', 'members')
    ORDER BY table_name
  `);
  console.log(`\nTables created: ${result.rows.map(r => r.table_name).join(', ')}`);

  await client.end();
  console.log('\nMigration complete.');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
