#!/usr/bin/env node
/**
 * Scrape all members from Skool and upsert into Neon Postgres.
 * Usage: node scripts/scrape-members.mjs
 */

import pg from 'pg';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Load .env.local
const envPath = join(ROOT, '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    if (!process.env[t.slice(0, eq)]) process.env[t.slice(0, eq)] = t.slice(eq + 1);
  }
}

const SKOOL_GROUP = 'acq';
const HEADERS = {
  'Cookie': `auth_token=${process.env.SKOOL_AUTH_TOKEN}; client_id=${process.env.SKOOL_CLIENT_ID}`,
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': `https://www.skool.com/${SKOOL_GROUP}`,
};

const delay = (ms) => new Promise(r => setTimeout(r, ms));

function parseTimestamp(val) {
  if (!val) return null;
  const n = Number(val);
  if (isNaN(n)) return val; // already a date string
  // Nanosecond timestamps (>1e15) → convert to milliseconds
  const ms = n > 1e15 ? Math.floor(n / 1e6) : n > 1e12 ? n : n * 1000;
  const d = new Date(ms);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// --- Skool API ---
async function getBuildId() {
  const res = await fetch(`https://www.skool.com/${SKOOL_GROUP}`, { headers: HEADERS });
  const html = await res.text();
  const match = html.match(/"buildId"\s*:\s*"([^"]+)"/);
  if (!match) throw new Error('Could not extract buildId');
  return match[1];
}

function parseSurvey(str) {
  if (!str) return {};
  try {
    const data = JSON.parse(str);
    if (Array.isArray(data)) {
      const result = {};
      for (const item of data) {
        const answer = item?.answer || item?.a || '';
        const q = (item?.question || item?.q || '').toLowerCase();
        if (q.includes('revenue') || q.includes('earning') || q.includes('money')) result.revenue = answer;
        else if (q.includes('website') || q.includes('url')) result.website = answer;
        else if (q.includes('phone') || q.includes('number')) result.phone = answer;
      }
      return result;
    }
    return { revenue: data.revenue || '', website: data.website || '', phone: data.phone || '' };
  } catch { return {}; }
}

function parseSubscription(str) {
  if (!str) return {};
  try {
    const data = JSON.parse(str);
    return {
      amount: data.amount || data.unit_amount || null,
      currency: data.currency || '',
      interval: data.recurring_interval || data.interval || '',
      tier: data.tier || data.plan || '',
    };
  } catch { return {}; }
}

function parseMember(user) {
  const meta = user.metadata || {};
  const member = user.member || {};
  const memberMeta = member.metadata || {};
  const aflData = user.aflUserData || {};

  const survey = parseSurvey(memberMeta.survey || '');
  const sub = parseSubscription(memberMeta.mmbp || '');

  return {
    id: user.id || '',
    slug: user.name || '',
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    displayName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
    email: user.email || '',
    inviteEmail: member.inviteEmail || '',
    billingEmail: memberMeta.mbme || '',
    bio: meta.bio || '',
    location: meta.location || '',
    linkLinkedin: meta.linkLinkedin || '',
    linkInstagram: meta.linkInstagram || '',
    linkWebsite: meta.linkWebsite || '',
    linkYoutube: meta.linkYoutube || '',
    linkFacebook: meta.linkFacebook || '',
    linkTwitter: meta.linkTwitter || '',
    myersBriggs: meta.myersBriggs || '',
    pictureUrl: meta.pictureProfile || '',
    accountCreatedAt: user.createdAt || null,
    memberJoinedAt: member.createdAt || null,
    lastOnlineAt: parseTimestamp(meta.lastOffline || memberMeta.lastOffline || null),
    memberRole: member.role || '',
    attribution: memberMeta.attrComp || '',
    invitedById: memberMeta.invitedBy || '',
    invitedByName: aflData ? `${aflData.firstName || ''} ${aflData.lastName || ''}`.trim() : '',
    approvedById: memberMeta.approvedBy || '',
    requestLocation: memberMeta.requestLocation || '',
    surveyRevenueBracket: survey.revenue || '',
    surveyWebsite: survey.website || '',
    surveyPhone: survey.phone || '',
    subscriptionAmount: sub.amount || null,
    subscriptionCurrency: sub.currency || '',
    subscriptionInterval: sub.interval || '',
    subscriptionTier: sub.tier || '',
    stripeSubscriptionId: memberMeta.msbs || '',
  };
}

async function main() {
  console.log('Fetching buildId...');
  const buildId = await getBuildId();
  console.log(`buildId: ${buildId}\n`);

  const allMembers = [];
  const seenIds = new Set();
  let page = 1;

  console.log('=== FETCHING MEMBERS ===\n');

  while (true) {
    const url = `https://www.skool.com/_next/data/${buildId}/${SKOOL_GROUP}/-/members.json?p=${page}`;
    const res = await fetch(url, { headers: HEADERS });

    if (!res.ok) {
      console.log(`Page ${page}: HTTP ${res.status} — stopping.`);
      break;
    }

    const data = await res.json();
    const users = data?.pageProps?.users || [];

    if (users.length === 0) {
      console.log(`Page ${page}: empty — done.`);
      break;
    }

    let pageNew = 0;
    for (const u of users) {
      const m = parseMember(u);
      if (seenIds.has(m.id)) continue;
      seenIds.add(m.id);
      allMembers.push(m);
      pageNew++;
    }

    console.log(`Page ${page}: ${users.length} users, ${pageNew} new — total: ${allMembers.length}`);
    page++;
    await delay(1000);
  }

  console.log(`\n--- Total members to upsert: ${allMembers.length} ---\n`);

  // Connect and upsert
  const client = new pg.Client({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log('Connected to database.\n');

  let newCount = 0;
  let updatedCount = 0;

  for (let i = 0; i < allMembers.length; i++) {
    const m = allMembers[i];
    const result = await client.query(`
      INSERT INTO members (
        id, slug, first_name, last_name, display_name, email, invite_email, billing_email,
        bio, location, link_linkedin, link_instagram, link_website, link_youtube, link_facebook, link_twitter,
        myers_briggs, picture_url, account_created_at, member_joined_at, last_online_at, member_role,
        attribution, invited_by_id, invited_by_name, approved_by_id, request_location,
        survey_revenue_bracket, survey_website, survey_phone,
        subscription_amount, subscription_currency, subscription_interval, subscription_tier, stripe_subscription_id,
        scraped_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        slug=EXCLUDED.slug, first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name,
        display_name=EXCLUDED.display_name, email=EXCLUDED.email, invite_email=EXCLUDED.invite_email,
        billing_email=EXCLUDED.billing_email, bio=EXCLUDED.bio, location=EXCLUDED.location,
        link_linkedin=EXCLUDED.link_linkedin, link_instagram=EXCLUDED.link_instagram,
        link_website=EXCLUDED.link_website, link_youtube=EXCLUDED.link_youtube,
        link_facebook=EXCLUDED.link_facebook, link_twitter=EXCLUDED.link_twitter,
        myers_briggs=EXCLUDED.myers_briggs, picture_url=EXCLUDED.picture_url,
        account_created_at=EXCLUDED.account_created_at, member_joined_at=EXCLUDED.member_joined_at,
        last_online_at=EXCLUDED.last_online_at, member_role=EXCLUDED.member_role,
        attribution=EXCLUDED.attribution, invited_by_id=EXCLUDED.invited_by_id,
        invited_by_name=EXCLUDED.invited_by_name, approved_by_id=EXCLUDED.approved_by_id,
        request_location=EXCLUDED.request_location,
        survey_revenue_bracket=EXCLUDED.survey_revenue_bracket, survey_website=EXCLUDED.survey_website,
        survey_phone=EXCLUDED.survey_phone, subscription_amount=EXCLUDED.subscription_amount,
        subscription_currency=EXCLUDED.subscription_currency, subscription_interval=EXCLUDED.subscription_interval,
        subscription_tier=EXCLUDED.subscription_tier, stripe_subscription_id=EXCLUDED.stripe_subscription_id,
        scraped_at=NOW()
      RETURNING (xmax = 0) AS is_new
    `, [
      m.id, m.slug, m.firstName, m.lastName, m.displayName, m.email, m.inviteEmail, m.billingEmail,
      m.bio, m.location, m.linkLinkedin, m.linkInstagram, m.linkWebsite, m.linkYoutube, m.linkFacebook, m.linkTwitter,
      m.myersBriggs, m.pictureUrl, m.accountCreatedAt || null, m.memberJoinedAt || null, m.lastOnlineAt || null, m.memberRole,
      m.attribution, m.invitedById, m.invitedByName, m.approvedById, m.requestLocation,
      m.surveyRevenueBracket, m.surveyWebsite, m.surveyPhone,
      m.subscriptionAmount, m.subscriptionCurrency, m.subscriptionInterval, m.subscriptionTier, m.stripeSubscriptionId,
    ]);

    if (result.rows[0]?.is_new) newCount++;
    else updatedCount++;

    if ((i + 1) % 100 === 0) console.log(`  Upserted ${i + 1}/${allMembers.length}...`);
  }

  console.log(`  Upserted ${allMembers.length}/${allMembers.length} — done.\n`);

  // Summary stats
  const attrCounts = {};
  let withSub = 0;
  let withSurvey = 0;
  for (const m of allMembers) {
    const attr = m.attribution || 'unknown';
    attrCounts[attr] = (attrCounts[attr] || 0) + 1;
    if (m.stripeSubscriptionId || m.subscriptionAmount) withSub++;
    if (m.surveyRevenueBracket) withSurvey++;
  }

  console.log('=== SCRAPE COMPLETE ===');
  console.log(`Total members: ${allMembers.length}`);
  console.log(`New: ${newCount}, Updated: ${updatedCount}`);
  console.log(`\nBy attribution:`);
  for (const [attr, count] of Object.entries(attrCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${attr.padEnd(15)} ${count}`);
  }
  console.log(`\nWith subscription info: ${withSub}`);
  console.log(`With survey revenue: ${withSurvey}`);

  await client.end();
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
