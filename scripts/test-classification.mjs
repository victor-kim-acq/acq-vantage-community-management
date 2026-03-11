#!/usr/bin/env node
/**
 * Dry-run test: classify 12 known edge-case posts from the database
 * using the full classification prompt, then compare with expected results.
 *
 * Usage: node scripts/test-classification.mjs
 * Requires: POSTGRES_URL, ANTHROPIC_API_KEY env vars
 */

import pg from 'pg';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Load .env.local ─────────────────────────────────────────────────────────
const envPath = join(ROOT, '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const val = trimmed.slice(eq + 1);
    if (!process.env[key]) process.env[key] = val;
  }
}

// ── Expected results from classification_edge_cases.md ──────────────────────
const EXPECTED = [
  { title: 'How I Used AI to Rebuild My YouTube Thumbnail', author: 'Gilbert Urbina', topic: 'ai_tools', role: 'giver' },
  { title: 'How I Build Internal Tools With Claude Code', author: 'Aaron Figueroa', topic: 'ai_tools', role: 'giver' },
  { title: 'Using AI to pull all my business data into one place', author: 'Will Hetherington', topic: 'ai_tools', role: 'giver' },
  { title: 'Profitability', author: 'Hayden Nielson', topic: 'paid_ads', role: 'seeker' },
  { title: 'GHL A2P Rejection Help', author: 'Chris Kooken', topic: 'ai_tools', role: 'seeker' },
  { title: 'IOS update putting my outbound texts into spam', author: 'Tim Matthews', topic: 'lead_gen_funnels', role: 'seeker' },
  { title: 'DoorDash Clever Free Trial Hook', author: 'David Edmonson', topic: 'sales_offers', role: 'giver' },
  { title: 'Wealth Workshop', author: 'Brandon Pierpont', topic: 'scaling_strategy', role: 'seeker' },
  { title: 'Working past limiting beliefs', author: 'Anna LaGrew', topic: 'scaling_strategy', role: 'seeker' },
  { title: 'I sold my last company for 7 figures', author: 'Gabe Helguera', topic: 'content_organic', role: 'seeker' },
  { title: 'Accountability Thread', author: 'Craig Anderson', topic: 'conversational', role: 'giver' },
  { title: 'PT ecommerce marketing operator', author: 'Lane George', topic: 'hiring', role: 'seeker' },
];

// ── Load prompts ─────────────────────────────────────────────────────────────
function loadPrompt(filename) {
  return readFileSync(join(ROOT, 'prompts', filename), 'utf-8');
}

const systemPrompt = loadPrompt('topic_classification.md') + '\n\n' + loadPrompt('classification_edge_cases.md');

// ── Tool definition (mirrors src/lib/classify.ts) ───────────────────────────
const CLASSIFICATION_TOOL = {
  name: 'submit_classifications',
  description: 'Submit topic and role classifications for community posts.',
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            topic: {
              type: 'string',
              enum: [
                'paid_ads', 'content_organic', 'lead_gen_funnels', 'email_outreach',
                'ai_tools', 'sales_offers', 'tracking_analytics', 'scaling_strategy',
                'hiring', 'operations', 'conversational',
              ],
            },
            role: {
              type: 'string',
              enum: ['giver', 'seeker', 'neutral'],
            },
            reasoning: { type: 'string' },
          },
          required: ['id', 'topic', 'role', 'reasoning'],
        },
      },
    },
    required: ['items'],
  },
};

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  console.log('Searching for edge-case posts in database...\n');

  // Step 1: Find each post by partial title match
  const foundPosts = [];
  const notFound = [];

  for (const expected of EXPECTED) {
    // Use partial match on title and optionally author
    const searchTerm = expected.title;
    const res = await pool.query(
      `SELECT id, title, content, post_type, author_name FROM posts WHERE title ILIKE $1 LIMIT 1`,
      [`%${searchTerm}%`]
    );

    if (res.rows.length === 0) {
      // Try shorter search term (first 3 words)
      const shorter = searchTerm.split(' ').slice(0, 3).join(' ');
      const res2 = await pool.query(
        `SELECT id, title, content, post_type, author_name FROM posts WHERE title ILIKE $1 LIMIT 1`,
        [`%${shorter}%`]
      );
      if (res2.rows.length === 0) {
        notFound.push(expected);
        continue;
      }
      foundPosts.push({ db: res2.rows[0], expected });
    } else {
      foundPosts.push({ db: res.rows[0], expected });
    }
  }

  if (notFound.length > 0) {
    console.log(`⚠ ${notFound.length} post(s) not found in database:`);
    for (const nf of notFound) {
      console.log(`  - "${nf.title}" by ${nf.author}`);
    }
    console.log('');
  }

  if (foundPosts.length === 0) {
    console.log('No posts found. Exiting.');
    await pool.end();
    return;
  }

  console.log(`Found ${foundPosts.length}/${EXPECTED.length} posts. Sending to Anthropic for classification...\n`);

  // Step 2: Format posts for classification (single batch — all ≤12)
  const userMessage = foundPosts
    .map((p, i) =>
      `[${i + 1}] ID: ${p.db.id}\nType: ${p.db.post_type}\nTitle: ${p.db.title}\nContent: ${p.db.content}\n`
    )
    .join('\n---\n\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    tools: [CLASSIFICATION_TOOL],
    tool_choice: { type: 'tool', name: 'submit_classifications' },
    messages: [{ role: 'user', content: `Classify these ${foundPosts.length} community posts:\n\n${userMessage}` }],
  });

  // Step 3: Extract results
  const toolBlock = response.content.find(b => b.type === 'tool_use' && b.name === 'submit_classifications');
  if (!toolBlock || toolBlock.type !== 'tool_use') {
    console.error('ERROR: No tool_use block in response');
    await pool.end();
    return;
  }

  const results = toolBlock.input.items;

  // Build lookup by ID
  const resultById = {};
  for (const r of results) {
    resultById[r.id] = r;
  }

  // Step 4: Compare and display
  let matches = 0;
  let mismatches = 0;

  console.log('='.repeat(120));
  console.log(
    'Post Title'.padEnd(50) +
    'Expected'.padEnd(28) +
    'Got'.padEnd(28) +
    'Match'
  );
  console.log('='.repeat(120));

  for (const { db, expected } of foundPosts) {
    const result = resultById[db.id];
    if (!result) {
      console.log(`${db.title.substring(0, 48).padEnd(50)}  ${'(no result)'.padEnd(28)}${''.padEnd(28)}  ??`);
      mismatches++;
      continue;
    }

    const expStr = `${expected.topic} / ${expected.role}`;
    const gotStr = `${result.topic} / ${result.role}`;
    const topicMatch = result.topic === expected.topic;
    const roleMatch = result.role === expected.role;
    const isMatch = topicMatch && roleMatch;

    if (isMatch) matches++;
    else mismatches++;

    const flag = isMatch ? '  ✓' : '  ✗ MISMATCH';
    console.log(
      db.title.substring(0, 48).padEnd(50) +
      expStr.padEnd(28) +
      gotStr.padEnd(28) +
      flag
    );
    if (!isMatch) {
      console.log(`  └─ Reasoning: ${result.reasoning}`);
    }
  }

  console.log('='.repeat(120));
  console.log(`\nResults: ${matches} match, ${mismatches} mismatch out of ${foundPosts.length} tested`);

  if (mismatches === 0 && notFound.length === 0) {
    console.log('\n✓ All edge cases classified correctly!');
  } else if (mismatches === 0) {
    console.log(`\n✓ All found posts classified correctly (${notFound.length} not in DB).`);
  } else {
    console.log(`\n✗ ${mismatches} mismatch(es) detected — review above.`);
  }

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
