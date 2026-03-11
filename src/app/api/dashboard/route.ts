import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

const TEAM_MEMBERS = [
  'Saulo Castelo Branco',
  'Saulo Medeiros',
  'Caio Beleza',
  'Victor Kim',
  'Samaria Simmons',
  'Alex Hormozi',
];

const TEAM_PLACEHOLDER = TEAM_MEMBERS.map((_, i) => `$${i + 1}`).join(', ');

function getDateFilter(range: string): string {
  if (range === '30d') return "AND p.created_at >= NOW() - INTERVAL '30 days'";
  if (range === '90d') return "AND p.created_at >= NOW() - INTERVAL '90 days'";
  return ''; // all time
}

function getDateFilterSimple(range: string, alias = ''): string {
  const col = alias ? `${alias}.created_at` : 'created_at';
  if (range === '30d') return `AND ${col} >= NOW() - INTERVAL '30 days'`;
  if (range === '90d') return `AND ${col} >= NOW() - INTERVAL '90 days'`;
  return '';
}

export async function GET(request: NextRequest) {
  const range = request.nextUrl.searchParams.get('range') || 'all';
  const dateFilter = getDateFilter(range);
  const dateFilterSimple = getDateFilterSimple(range);
  const dateFilterP = getDateFilterSimple(range, 'p');
  const dateFilterC = getDateFilterSimple(range, 'c');

  try {
    // Run all queries in parallel
    const [
      headlineResult,
      postsPerWeekResult,
      activeUsersPerWeekResult,
      topicsByWeekResult,
      rolesByWeekResult,
      topicDistResult,
      seekerResponseResult,
      timeToResponseResult,
      topGiversResult,
    ] = await Promise.all([
      // Headline cards
      sql.query(`
        SELECT
          (SELECT COUNT(*) FROM posts p WHERE 1=1 ${dateFilterSimple}) as total_posts,
          (SELECT COUNT(*) FROM comments c WHERE 1=1 ${dateFilterSimple.replace('created_at', 'c.created_at')}) as total_comments,
          (SELECT COUNT(DISTINCT author_name) FROM (
            SELECT author_name FROM posts WHERE author_name IS NOT NULL ${dateFilterSimple}
            UNION
            SELECT author_name FROM comments WHERE author_name IS NOT NULL ${dateFilterSimple}
          ) u WHERE author_name NOT IN (${TEAM_PLACEHOLDER})) as unique_members,
          (SELECT COUNT(*) FROM posts WHERE created_at >= NOW() - INTERVAL '7 days') as posts_this_week,
          (SELECT COUNT(*) FROM posts WHERE created_at >= NOW() - INTERVAL '30 days') as posts_this_month,
          (SELECT COUNT(DISTINCT author_name) FROM (
            SELECT author_name FROM posts WHERE created_at >= CURRENT_DATE AND author_name NOT IN (${TEAM_PLACEHOLDER})
            UNION
            SELECT author_name FROM comments WHERE created_at >= CURRENT_DATE AND author_name NOT IN (${TEAM_PLACEHOLDER})
          ) d) as dau,
          (SELECT COUNT(DISTINCT author_name) FROM (
            SELECT author_name FROM posts WHERE created_at >= NOW() - INTERVAL '7 days' AND author_name NOT IN (${TEAM_PLACEHOLDER})
            UNION
            SELECT author_name FROM comments WHERE created_at >= NOW() - INTERVAL '7 days' AND author_name NOT IN (${TEAM_PLACEHOLDER})
          ) w) as wau,
          (SELECT COUNT(DISTINCT author_name) FROM (
            SELECT author_name FROM posts WHERE created_at >= NOW() - INTERVAL '30 days' AND author_name NOT IN (${TEAM_PLACEHOLDER})
            UNION
            SELECT author_name FROM comments WHERE created_at >= NOW() - INTERVAL '30 days' AND author_name NOT IN (${TEAM_PLACEHOLDER})
          ) m) as mau
      `, TEAM_MEMBERS),

      // Posts per week
      sql.query(`
        SELECT
          date_trunc('week', p.created_at)::date as week,
          COUNT(*) as count
        FROM posts p
        WHERE p.created_at >= '2025-08-01' ${dateFilterP}
        GROUP BY week
        ORDER BY week
      `),

      // Active users per week (excluding team)
      sql.query(`
        SELECT week, COUNT(DISTINCT author_name) as count FROM (
          SELECT date_trunc('week', created_at)::date as week, author_name
          FROM posts
          WHERE created_at >= '2025-08-01' ${dateFilterSimple}
            AND author_name NOT IN (${TEAM_PLACEHOLDER})
          UNION ALL
          SELECT date_trunc('week', created_at)::date as week, author_name
          FROM comments
          WHERE created_at >= '2025-08-01' ${dateFilterSimple}
            AND author_name NOT IN (${TEAM_PLACEHOLDER})
        ) combined
        GROUP BY week
        ORDER BY week
      `, TEAM_MEMBERS),

      // Topics by week
      sql.query(`
        SELECT
          date_trunc('week', p.created_at)::date as week,
          p.topic,
          COUNT(*) as count
        FROM posts p
        WHERE p.topic IS NOT NULL AND p.created_at >= '2025-08-01' ${dateFilterP}
        GROUP BY week, p.topic
        ORDER BY week
      `),

      // Roles by week
      sql.query(`
        SELECT
          date_trunc('week', p.created_at)::date as week,
          p.role,
          COUNT(*) as count
        FROM posts p
        WHERE p.role IS NOT NULL AND p.created_at >= '2025-08-01' ${dateFilterP}
        GROUP BY week, p.role
        ORDER BY week
      `),

      // Topic distribution
      sql.query(`
        SELECT p.topic, COUNT(*) as count
        FROM posts p
        WHERE p.topic IS NOT NULL ${dateFilterP}
        GROUP BY p.topic
        ORDER BY count DESC
      `),

      // Seeker response rate by week
      sql.query(`
        SELECT
          date_trunc('week', p.created_at)::date as week,
          COUNT(*) as total_seeker,
          COUNT(*) FILTER (WHERE p.comment_count > 0) as with_comments
        FROM posts p
        WHERE p.role = 'seeker' AND p.created_at >= '2025-08-01' ${dateFilterP}
        GROUP BY week
        ORDER BY week
      `),

      // Time to first response by week (median hours)
      sql.query(`
        WITH first_response AS (
          SELECT
            p.id as post_id,
            date_trunc('week', p.created_at)::date as week,
            EXTRACT(EPOCH FROM (MIN(c.created_at) - p.created_at)) / 3600.0 as hours_to_response
          FROM posts p
          JOIN comments c ON c.post_id = p.id AND c.author_name != p.author_name
          WHERE p.created_at >= '2025-08-01' ${dateFilterP}
          GROUP BY p.id, p.created_at
        )
        SELECT
          week,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY hours_to_response) as median_hours
        FROM first_response
        WHERE hours_to_response >= 0
        GROUP BY week
        ORDER BY week
      `),

      // Top givers (excluding team)
      sql.query(`
        SELECT
          p.author_name,
          COUNT(*) as giver_posts,
          MODE() WITHIN GROUP (ORDER BY p.topic) as primary_topic
        FROM posts p
        WHERE p.role = 'giver'
          AND p.author_name NOT IN (${TEAM_PLACEHOLDER})
          ${dateFilterP}
        GROUP BY p.author_name
        ORDER BY giver_posts DESC
        LIMIT 20
      `, TEAM_MEMBERS),
    ]);

    // Transform topics by week into pivoted format
    const topicWeekMap: Record<string, Record<string, number>> = {};
    for (const row of topicsByWeekResult.rows) {
      const week = row.week;
      if (!topicWeekMap[week]) topicWeekMap[week] = {};
      topicWeekMap[week][row.topic] = parseInt(row.count);
    }
    const topicsByWeek = Object.entries(topicWeekMap)
      .map(([week, topics]) => ({ week, ...topics }))
      .sort((a, b) => a.week.localeCompare(b.week));

    // Transform roles by week into pivoted format
    const roleWeekMap: Record<string, Record<string, number>> = {};
    for (const row of rolesByWeekResult.rows) {
      const week = row.week;
      if (!roleWeekMap[week]) roleWeekMap[week] = {};
      roleWeekMap[week][row.role] = parseInt(row.count);
    }
    const rolesByWeek = Object.entries(roleWeekMap)
      .map(([week, roles]) => ({ week, ...roles }))
      .sort((a, b) => a.week.localeCompare(b.week));

    // Seeker response rate
    const seekerResponseRate = seekerResponseResult.rows.map(row => ({
      week: row.week,
      rate: row.total_seeker > 0
        ? Math.round((parseInt(row.with_comments) / parseInt(row.total_seeker)) * 100)
        : 0,
    }));

    return NextResponse.json({
      headlines: {
        totalPosts: parseInt(headlineResult.rows[0].total_posts),
        totalComments: parseInt(headlineResult.rows[0].total_comments),
        uniqueMembers: parseInt(headlineResult.rows[0].unique_members),
        postsThisWeek: parseInt(headlineResult.rows[0].posts_this_week),
        postsThisMonth: parseInt(headlineResult.rows[0].posts_this_month),
        dau: parseInt(headlineResult.rows[0].dau),
        wau: parseInt(headlineResult.rows[0].wau),
        mau: parseInt(headlineResult.rows[0].mau),
      },
      postsPerWeek: postsPerWeekResult.rows.map(r => ({ week: r.week, count: parseInt(r.count) })),
      activeUsersPerWeek: activeUsersPerWeekResult.rows.map(r => ({ week: r.week, count: parseInt(r.count) })),
      topicsByWeek,
      rolesByWeek,
      topicDistribution: topicDistResult.rows.map(r => ({ topic: r.topic, count: parseInt(r.count) })),
      seekerResponseRate,
      timeToResponse: timeToResponseResult.rows.map(r => ({
        week: r.week,
        medianHours: parseFloat(parseFloat(r.median_hours).toFixed(1)),
      })),
      topGivers: topGiversResult.rows.map(r => ({
        name: r.author_name,
        count: parseInt(r.giver_posts),
        primaryTopic: r.primary_topic,
      })),
    });
  } catch (error) {
    console.error('Dashboard query failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load dashboard data' },
      { status: 500 }
    );
  }
}
