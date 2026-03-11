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

interface MemberRow {
  authorId: string;
  authorName: string;
  authorBio: string;
  postCount: number;
  commentCount: number;
  totalActivity: number;
  firstActive: string;
  lastActive: string;
  primaryTopic: string | null;
  primaryRole: string | null;
  giverCount: number;
  seekerCount: number;
  neutralCount: number;
  topicSpread: { topic: string; count: number }[];
  engagementScore: number;
  segment: string;
  selfReplyCount: number;
  threadCount: number;
  conversationalPct: number;
  recentPosts: { id: string; title: string; createdAt: string; topic: string | null }[];
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const sortBy = params.get('sort') || 'engagement';
  const segmentFilter = params.get('segment') || '';
  const topicFilter = params.get('topic') || '';
  const search = params.get('search') || '';

  try {
    const [
      postsAgg,
      commentsAgg,
      selfReplies,
      topicBreakdown,
      threadCounts,
      recentPostsResult,
    ] = await Promise.all([
      // A: Post aggregation per author
      sql`
        SELECT
          author_id,
          author_name,
          MAX(author_bio) as author_bio,
          COUNT(*) as post_count,
          SUM((comment_count * 3) + upvotes) as post_engagement,
          COUNT(*) FILTER (WHERE role = 'giver') as giver_count,
          COUNT(*) FILTER (WHERE role = 'seeker') as seeker_count,
          COUNT(*) FILTER (WHERE role = 'neutral') as neutral_count,
          COUNT(*) FILTER (WHERE topic = 'conversational') as conversational_count,
          MIN(created_at) as first_post,
          MAX(created_at) as last_post
        FROM posts
        WHERE author_id IS NOT NULL AND author_name IS NOT NULL
        GROUP BY author_id, author_name
      `,

      // B: Comment aggregation per author
      sql`
        SELECT
          author_id,
          author_name,
          MAX(author_bio) as author_bio,
          COUNT(*) as comment_count,
          SUM((upvotes * 2) + 1) as comment_engagement,
          MIN(created_at) as first_comment,
          MAX(created_at) as last_comment
        FROM comments
        WHERE author_id IS NOT NULL AND author_name IS NOT NULL
        GROUP BY author_id, author_name
      `,

      // C: Self-reply count per author
      sql`
        SELECT
          c.author_id,
          COUNT(*) as self_reply_count
        FROM comments c
        JOIN posts p ON c.post_id = p.id AND c.author_id = p.author_id
        WHERE c.author_id IS NOT NULL
        GROUP BY c.author_id
      `,

      // D: Topic breakdown per author
      sql`
        SELECT
          author_id,
          topic,
          COUNT(*) as count
        FROM posts
        WHERE topic IS NOT NULL AND author_id IS NOT NULL
        GROUP BY author_id, topic
      `,

      // E: Distinct thread count (unique posts commented on) per commenter
      sql`
        SELECT
          author_id,
          COUNT(DISTINCT post_id) as thread_count
        FROM comments
        WHERE author_id IS NOT NULL
        GROUP BY author_id
      `,

      // F: Recent posts per author (last 5 each, using window function)
      sql`
        SELECT author_id, id, title, created_at, topic
        FROM (
          SELECT author_id, id, title, created_at, topic,
            ROW_NUMBER() OVER (PARTITION BY author_id ORDER BY created_at DESC) as rn
          FROM posts
          WHERE author_id IS NOT NULL
        ) ranked
        WHERE rn <= 5
      `,
    ]);

    // Build lookup maps
    const commentMap = new Map<string, typeof commentsAgg.rows[0]>();
    for (const row of commentsAgg.rows) {
      commentMap.set(row.author_id, row);
    }

    const selfReplyMap = new Map<string, number>();
    for (const row of selfReplies.rows) {
      selfReplyMap.set(row.author_id, parseInt(row.self_reply_count));
    }

    const topicMap = new Map<string, { topic: string; count: number }[]>();
    for (const row of topicBreakdown.rows) {
      if (!topicMap.has(row.author_id)) topicMap.set(row.author_id, []);
      topicMap.get(row.author_id)!.push({ topic: row.topic, count: parseInt(row.count) });
    }

    const threadMap = new Map<string, number>();
    for (const row of threadCounts.rows) {
      threadMap.set(row.author_id, parseInt(row.thread_count));
    }

    const recentPostsMap = new Map<string, { id: string; title: string; createdAt: string; topic: string | null }[]>();
    for (const row of recentPostsResult.rows) {
      if (!recentPostsMap.has(row.author_id)) recentPostsMap.set(row.author_id, []);
      recentPostsMap.get(row.author_id)!.push({
        id: row.id,
        title: row.title,
        createdAt: row.created_at,
        topic: row.topic,
      });
    }

    // Also gather comment-only authors (no posts)
    const postAuthorIds = new Set(postsAgg.rows.map(r => r.author_id));

    // Merge into member objects
    const members: MemberRow[] = [];

    // Process post authors
    for (const row of postsAgg.rows) {
      const aid = row.author_id;
      const cRow = commentMap.get(aid);
      const postCount = parseInt(row.post_count);
      const commentCount = cRow ? parseInt(cRow.comment_count) : 0;
      const totalActivity = postCount + commentCount;
      const postEngagement = parseInt(row.post_engagement) || 0;
      const commentEngagement = cRow ? parseInt(cRow.comment_engagement) || 0 : 0;
      const engagementScore = postEngagement + commentEngagement;

      const giverCount = parseInt(row.giver_count);
      const seekerCount = parseInt(row.seeker_count);
      const neutralCount = parseInt(row.neutral_count);
      const conversationalCount = parseInt(row.conversational_count);
      const selfReplyCount = selfReplyMap.get(aid) || 0;

      const topics = topicMap.get(aid) || [];
      const topicsSorted = [...topics].sort((a, b) => b.count - a.count);
      const nonConvTopics = topicsSorted.filter(t => t.topic !== 'conversational');
      const primaryTopic = nonConvTopics.length > 0 ? nonConvTopics[0].topic : null;

      const roleCounts = { giver: giverCount, seeker: seekerCount, neutral: neutralCount };
      const primaryRole = (Object.entries(roleCounts).sort((a, b) => b[1] - a[1])[0])?.[0] || null;

      const firstPost = row.first_post ? new Date(row.first_post).toISOString() : null;
      const lastPost = row.last_post ? new Date(row.last_post).toISOString() : null;
      const firstComment = cRow?.first_comment ? new Date(cRow.first_comment).toISOString() : null;
      const lastComment = cRow?.last_comment ? new Date(cRow.last_comment).toISOString() : null;

      const firstActive = [firstPost, firstComment].filter(Boolean).sort()[0] || firstPost || '';
      const lastActive = [lastPost, lastComment].filter(Boolean).sort().reverse()[0] || lastPost || '';

      const uniqueTopicCount = nonConvTopics.length;
      const threadCount = threadMap.get(aid) || 0;
      const conversationalPct = postCount > 0 ? conversationalCount / postCount : 0;

      // Segment assignment
      const adjustedGiverCount = giverCount - selfReplyCount; // don't count self-replies as giver activity
      const segment = computeSegment(
        totalActivity, adjustedGiverCount, seekerCount, uniqueTopicCount,
        topicsSorted, conversationalPct, threadCount
      );

      members.push({
        authorId: aid,
        authorName: row.author_name,
        authorBio: cRow?.author_bio && (!row.author_bio || (cRow.author_bio.length > row.author_bio.length))
          ? cRow.author_bio
          : row.author_bio || '',
        postCount,
        commentCount,
        totalActivity,
        firstActive,
        lastActive,
        primaryTopic,
        primaryRole,
        giverCount,
        seekerCount,
        neutralCount,
        topicSpread: topicsSorted,
        engagementScore,
        segment,
        selfReplyCount,
        threadCount,
        conversationalPct,
        recentPosts: recentPostsMap.get(aid) || [],
      });
    }

    // Add comment-only authors
    for (const cRow of commentsAgg.rows) {
      if (postAuthorIds.has(cRow.author_id)) continue;
      const aid = cRow.author_id;
      const commentCount = parseInt(cRow.comment_count);
      const commentEngagement = parseInt(cRow.comment_engagement) || 0;
      const threadCount = threadMap.get(aid) || 0;

      const segment = commentCount < 3 ? 'Lurker' : 'General';

      members.push({
        authorId: aid,
        authorName: cRow.author_name,
        authorBio: cRow.author_bio || '',
        postCount: 0,
        commentCount,
        totalActivity: commentCount,
        firstActive: cRow.first_comment ? new Date(cRow.first_comment).toISOString() : '',
        lastActive: cRow.last_comment ? new Date(cRow.last_comment).toISOString() : '',
        primaryTopic: null,
        primaryRole: null,
        giverCount: 0,
        seekerCount: 0,
        neutralCount: 0,
        topicSpread: [],
        engagementScore: commentEngagement,
        segment,
        selfReplyCount: selfReplyMap.get(aid) || 0,
        threadCount,
        conversationalPct: 0,
        recentPosts: [],
      });
    }

    // Filter out team members
    let filtered = members.filter(m => !TEAM_MEMBERS.includes(m.authorName));

    // Apply filters
    if (segmentFilter) {
      const segLabel = segmentFilter.replace(/_/g, ' ');
      filtered = filtered.filter(m => m.segment.toLowerCase().replace(/ /g, '_') === segmentFilter);
    }
    if (topicFilter) {
      filtered = filtered.filter(m => m.primaryTopic === topicFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(m => m.authorName.toLowerCase().includes(q));
    }

    // Sort
    switch (sortBy) {
      case 'activity':
        filtered.sort((a, b) => b.totalActivity - a.totalActivity);
        break;
      case 'recent':
        filtered.sort((a, b) => (b.lastActive || '').localeCompare(a.lastActive || ''));
        break;
      case 'name':
        filtered.sort((a, b) => a.authorName.localeCompare(b.authorName));
        break;
      case 'engagement':
      default:
        filtered.sort((a, b) => b.engagementScore - a.engagementScore);
        break;
    }

    // Compute summary stats
    const allNonTeam = members.filter(m => !TEAM_MEMBERS.includes(m.authorName));
    const totalMembers = allNonTeam.length;
    const powerGivers = allNonTeam.filter(m => m.segment === 'Power Giver').length;
    const activeSeekers = allNonTeam.filter(m => m.segment === 'Active Seeker').length;
    const topicSpecialists = allNonTeam.filter(m => m.segment === 'Topic Specialist').length;
    const avgEngagement = totalMembers > 0
      ? Math.round(allNonTeam.reduce((s, m) => s + m.engagementScore, 0) / totalMembers)
      : 0;

    return NextResponse.json({
      summary: { totalMembers, powerGivers, activeSeekers, topicSpecialists, avgEngagement },
      members: filtered,
    });
  } catch (error) {
    console.error('Members query failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load members' },
      { status: 500 }
    );
  }
}

function computeSegment(
  totalActivity: number,
  adjustedGiverCount: number,
  seekerCount: number,
  uniqueTopicCount: number,
  topicsSorted: { topic: string; count: number }[],
  conversationalPct: number,
  threadCount: number,
): string {
  if (totalActivity < 3) return 'Lurker';

  const totalRoleCount = adjustedGiverCount + seekerCount;

  // Power Giver: 10+ activities, majority giver, 3+ topics
  if (totalActivity >= 10 && totalRoleCount > 0 && adjustedGiverCount > seekerCount && uniqueTopicCount >= 3) {
    return 'Power Giver';
  }

  // Active Seeker: 5+ activities, majority seeker
  if (totalActivity >= 5 && seekerCount > adjustedGiverCount) {
    return 'Active Seeker';
  }

  // Topic Specialist: 70%+ activity in single topic
  if (topicsSorted.length > 0) {
    const topTopicCount = topicsSorted[0].count;
    const totalTopicPosts = topicsSorted.reduce((s, t) => s + t.count, 0);
    if (totalTopicPosts > 0 && topTopicCount / totalTopicPosts >= 0.7) {
      return 'Topic Specialist';
    }
  }

  // Social Connector: high conversational %, 5+ threads
  if (conversationalPct >= 0.4 && threadCount >= 5) {
    return 'Social Connector';
  }

  return 'General';
}
