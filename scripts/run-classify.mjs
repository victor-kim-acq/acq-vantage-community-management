#!/usr/bin/env node
/**
 * Classify all unclassified posts in the database.
 * Mirrors the /api/classify endpoint logic: batches of 10, structured tool output.
 *
 * Usage: node scripts/run-classify.mjs
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

// ── Prompts ──────────────────────────────────────────────────────────────────
function loadPrompt(filename) {
  return readFileSync(join(ROOT, 'prompts', filename), 'utf-8');
}
const systemPrompt = loadPrompt('topic_classification.md') + '\n\n' + loadPrompt('classification_edge_cases.md');

// ── Routing table (mirrors src/lib/routing.ts) ──────────────────────────────
const ROUTING = {
  paid_ads:           { repliers: ['Saulo', 'Caio'],            voiceProfile: 'A' },
  content_organic:    { repliers: ['Saulo', 'Caio'],            voiceProfile: 'A' },
  lead_gen_funnels:   { repliers: ['Saulo', 'Victor'],          voiceProfile: 'A' },
  email_outreach:     { repliers: ['Saulo', 'Victor'],          voiceProfile: 'A' },
  ai_tools:           { repliers: ['Victor'],                   voiceProfile: 'A' },
  sales_offers:       { repliers: ['Saulo', 'Caio', 'Victor'],  voiceProfile: 'A' },
  tracking_analytics: { repliers: ['Victor'],                   voiceProfile: 'A' },
  scaling_strategy:   { repliers: ['Caio'],                     voiceProfile: 'A' },
  hiring:             { repliers: ['Caio'],                     voiceProfile: 'A' },
  operations:         { repliers: ['Caio'],                     voiceProfile: 'A' },
  conversational:     { repliers: ['Samaria'],                  voiceProfile: 'B' },
};

function getRouting(topic) {
  return ROUTING[topic] || { repliers: [], voiceProfile: 'A' };
}

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
            role: { type: 'string', enum: ['giver', 'seeker', 'neutral'] },
            reasoning: { type: 'string' },
          },
          required: ['id', 'topic', 'role', 'reasoning'],
        },
      },
    },
    required: ['items'],
  },
};

const BATCH_SIZE = 10;

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Fetch unclassified posts
  const { rows: posts } = await pool.query(
    `SELECT id, title, content, post_type FROM posts WHERE topic IS NULL ORDER BY created_at DESC`
  );

  if (posts.length === 0) {
    console.log('No unclassified posts found. Nothing to do.');
    await pool.end();
    return;
  }

  console.log(`Found ${posts.length} unclassified posts. Processing in batches of ${BATCH_SIZE}...\n`);

  let totalClassified = 0;
  let totalErrors = 0;
  const topicCounts = {};
  const roleCounts = {};
  const totalBatches = Math.ceil(posts.length / BATCH_SIZE);

  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const batch = posts.slice(i, i + BATCH_SIZE);

    const userMessage = batch
      .map((p, idx) =>
        `[${idx + 1}] ID: ${p.id}\nType: ${p.post_type}\nTitle: ${p.title}\nContent: ${p.content}\n`
      )
      .join('\n---\n\n');

    process.stdout.write(`Batch ${batchNum}/${totalBatches} (${batch.length} posts)... `);

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        tools: [CLASSIFICATION_TOOL],
        tool_choice: { type: 'tool', name: 'submit_classifications' },
        messages: [{ role: 'user', content: `Classify these ${batch.length} community posts:\n\n${userMessage}` }],
      });

      const toolBlock = response.content.find(b => b.type === 'tool_use' && b.name === 'submit_classifications');
      if (!toolBlock || toolBlock.type !== 'tool_use') {
        console.log('ERROR — no tool_use in response');
        totalErrors += batch.length;
        continue;
      }

      const items = toolBlock.input.items;
      let batchOk = 0;
      let batchErr = 0;

      for (const item of items) {
        try {
          const routing = getRouting(item.topic);
          await pool.query(
            `UPDATE posts SET
              topic = $1,
              role = $2,
              classification_reasoning = $3,
              suggested_repliers = $4,
              voice_profile = $5,
              classified_at = NOW()
            WHERE id = $6`,
            [item.topic, item.role, item.reasoning, routing.repliers, routing.voiceProfile, item.id]
          );
          batchOk++;
          topicCounts[item.topic] = (topicCounts[item.topic] || 0) + 1;
          roleCounts[item.role] = (roleCounts[item.role] || 0) + 1;
        } catch (err) {
          batchErr++;
          console.error(`\n  Failed to update ${item.id}: ${err.message}`);
        }
      }

      totalClassified += batchOk;
      totalErrors += batchErr;
      console.log(`✓ ${batchOk} classified${batchErr > 0 ? `, ${batchErr} errors` : ''}`);
    } catch (err) {
      totalErrors += batch.length;
      console.log(`ERROR — ${err.message}`);
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('CLASSIFICATION COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total classified: ${totalClassified}`);
  console.log(`Total errors:     ${totalErrors}`);

  console.log('\nBy topic:');
  const sortedTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]);
  for (const [topic, count] of sortedTopics) {
    const routing = getRouting(topic);
    console.log(`  ${topic.padEnd(22)} ${String(count).padStart(4)}  → ${routing.repliers.join(', ')}`);
  }

  console.log('\nBy role:');
  for (const [role, count] of Object.entries(roleCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${role.padEnd(10)} ${String(count).padStart(4)}`);
  }

  // Verify nothing left
  const { rows: remaining } = await pool.query(`SELECT COUNT(*) as c FROM posts WHERE topic IS NULL`);
  console.log(`\nRemaining unclassified: ${remaining[0].c}`);

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
