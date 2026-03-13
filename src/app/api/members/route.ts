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

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const sortBy = params.get('sort') || 'engagement';
  const segmentFilter = params.get('segment') || '';
  const topicFilter = params.get('topic') || '';
  const search = params.get('search') || '';
  const attributionFilter = params.get('attribution') || '';
  const tierFilter = params.get('tier') || '';
  const joinedFrom = params.get('joinedFrom') || '';
  const joinedTo = params.get('joinedTo') || '';

  try {
    const [
      membersResult,
      postsAgg,
      commentsAgg,
      selfReplies,
      topicBreakdown,
      threadCounts,
      recentPostsResult,
    ] = await Promise.all([
      // Full member roster from members table
      sql`SELECT * FROM members`,

      // Post aggregation per author (by author_id)
      sql`
        SELECT
          author_id,
          COUNT(*) as post_count,
          SUM((comment_count * 3) + upvotes) as post_engagement,
          COUNT(*) FILTER (WHERE role = 'giver') as giver_count,
          COUNT(*) FILTER (WHERE role = 'seeker') as seeker_count,
          COUNT(*) FILTER (WHERE role = 'neutral') as neutral_count,
          COUNT(*) FILTER (WHERE topic = 'conversational') as conversational_count,
          MIN(created_at) as first_post,
          MAX(created_at) as last_post
        FROM posts
        WHERE author_id IS NOT NULL
        GROUP BY author_id
      `,

      // Comment aggregation per author
      sql`
        SELECT
          author_id,
          COUNT(*) as comment_count,
          SUM((upvotes * 2) + 1) as comment_engagement,
          MIN(created_at) as first_comment,
          MAX(created_at) as last_comment
        FROM comments
        WHERE author_id IS NOT NULL
        GROUP BY author_id
      `,

      // Self-reply count
      sql`
        SELECT c.author_id, COUNT(*) as self_reply_count
        FROM comments c
        JOIN posts p ON c.post_id = p.id AND c.author_id = p.author_id
        WHERE c.author_id IS NOT NULL
        GROUP BY c.author_id
      `,

      // Topic breakdown per author
      sql`
        SELECT author_id, topic, COUNT(*) as count
        FROM posts
        WHERE topic IS NOT NULL AND author_id IS NOT NULL
        GROUP BY author_id, topic
      `,

      // Thread count per commenter
      sql`
        SELECT author_id, COUNT(DISTINCT post_id) as thread_count
        FROM comments WHERE author_id IS NOT NULL
        GROUP BY author_id
      `,

      // Recent posts (last 5 per author)
      sql`
        SELECT author_id, id, title, created_at, topic
        FROM (
          SELECT author_id, id, title, created_at, topic,
            ROW_NUMBER() OVER (PARTITION BY author_id ORDER BY created_at DESC) as rn
          FROM posts WHERE author_id IS NOT NULL
        ) ranked WHERE rn <= 5
      `,
    ]);

    // Build lookup maps for activity data
    const postMap = new Map<string, (typeof postsAgg.rows)[0]>();
    for (const r of postsAgg.rows) postMap.set(r.author_id, r);

    const commentMap = new Map<string, (typeof commentsAgg.rows)[0]>();
    for (const r of commentsAgg.rows) commentMap.set(r.author_id, r);

    const selfReplyMap = new Map<string, number>();
    for (const r of selfReplies.rows) selfReplyMap.set(r.author_id, parseInt(r.self_reply_count));

    const topicMap = new Map<string, { topic: string; count: number }[]>();
    for (const r of topicBreakdown.rows) {
      if (!topicMap.has(r.author_id)) topicMap.set(r.author_id, []);
      topicMap.get(r.author_id)!.push({ topic: r.topic, count: parseInt(r.count) });
    }

    const threadMap = new Map<string, number>();
    for (const r of threadCounts.rows) threadMap.set(r.author_id, parseInt(r.thread_count));

    const recentPostsMap = new Map<string, { id: string; title: string; createdAt: string; topic: string | null }[]>();
    for (const r of recentPostsResult.rows) {
      if (!recentPostsMap.has(r.author_id)) recentPostsMap.set(r.author_id, []);
      recentPostsMap.get(r.author_id)!.push({ id: r.id, title: r.title, createdAt: r.created_at, topic: r.topic });
    }

    // Merge: members table is primary, enriched with activity data
    const members = [];

    for (const m of membersResult.rows) {
      const displayName = m.display_name || `${m.first_name || ''} ${m.last_name || ''}`.trim();
      if (TEAM_MEMBERS.includes(displayName)) continue;

      const pRow = postMap.get(m.id);
      const cRow = commentMap.get(m.id);

      const postCount = pRow ? parseInt(pRow.post_count) : 0;
      const commentCount = cRow ? parseInt(cRow.comment_count) : 0;
      const totalActivity = postCount + commentCount;
      const postEngagement = pRow ? parseInt(pRow.post_engagement) || 0 : 0;
      const commentEngagement = cRow ? parseInt(cRow.comment_engagement) || 0 : 0;
      const engagementScore = postEngagement + commentEngagement;

      const giverCount = pRow ? parseInt(pRow.giver_count) : 0;
      const seekerCount = pRow ? parseInt(pRow.seeker_count) : 0;
      const neutralCount = pRow ? parseInt(pRow.neutral_count) : 0;
      const conversationalCount = pRow ? parseInt(pRow.conversational_count) : 0;
      const selfReplyCount = selfReplyMap.get(m.id) || 0;

      const topics = topicMap.get(m.id) || [];
      const topicsSorted = [...topics].sort((a, b) => b.count - a.count);
      const nonConvTopics = topicsSorted.filter(t => t.topic !== 'conversational');
      const primaryTopic = nonConvTopics.length > 0 ? nonConvTopics[0].topic : null;

      const roleCounts = { giver: giverCount, seeker: seekerCount, neutral: neutralCount };
      const primaryRole = (Object.entries(roleCounts).sort((a, b) => b[1] - a[1])[0])?.[0] || null;
      const effectivePrimaryRole = totalActivity > 0 ? primaryRole : null;

      const threadCount = threadMap.get(m.id) || 0;
      const conversationalPct = postCount > 0 ? conversationalCount / postCount : 0;

      const adjustedGiverCount = Math.max(0, giverCount - selfReplyCount);
      const segment = computeSegment(totalActivity, adjustedGiverCount, seekerCount, nonConvTopics.length, topicsSorted, conversationalPct, threadCount);

      // Dates: prefer activity dates when available, fall back to member table
      const firstPost = pRow?.first_post ? new Date(pRow.first_post).toISOString() : null;
      const lastPost = pRow?.last_post ? new Date(pRow.last_post).toISOString() : null;
      const firstComment = cRow?.first_comment ? new Date(cRow.first_comment).toISOString() : null;
      const lastComment = cRow?.last_comment ? new Date(cRow.last_comment).toISOString() : null;
      const firstActive = [firstPost, firstComment].filter(Boolean).sort()[0] || m.member_joined_at || '';
      const lastActive = [lastPost, lastComment].filter(Boolean).sort().reverse()[0] || m.last_online_at || '';

      members.push({
        // Profile from members table
        authorId: m.id,
        authorName: displayName,
        authorBio: m.bio || '',
        location: m.location || '',
        pictureUrl: m.picture_url || '',
        email: m.invite_email || m.email || '',
        billingEmail: m.billing_email || '',
        memberJoinedAt: m.member_joined_at || '',
        lastOnlineAt: m.last_online_at || '',
        memberRole: m.member_role || '',
        attribution: m.attribution || '',
        invitedByName: m.invited_by_name || '',
        surveyRevenueBracket: m.survey_revenue_bracket || '',
        surveyWebsite: m.survey_website || '',
        surveyPhone: m.survey_phone || '',
        subscriptionTier: m.subscription_tier || '',
        subscriptionAmount: m.subscription_amount,
        subscriptionCurrency: m.subscription_currency || '',
        subscriptionInterval: m.subscription_interval || '',
        stripeSubscriptionId: m.stripe_subscription_id || '',
        linkLinkedin: m.link_linkedin || '',
        linkInstagram: m.link_instagram || '',
        linkWebsite: m.link_website || '',
        linkYoutube: m.link_youtube || '',
        linkFacebook: m.link_facebook || '',
        linkTwitter: m.link_twitter || '',
        myersBriggs: m.myers_briggs || '',
        // Activity data
        postCount,
        commentCount,
        totalActivity,
        firstActive,
        lastActive,
        primaryTopic,
        primaryRole: effectivePrimaryRole,
        giverCount,
        seekerCount,
        neutralCount,
        topicSpread: topicsSorted,
        engagementScore,
        segment,
        selfReplyCount,
        threadCount,
        conversationalPct,
        recentPosts: recentPostsMap.get(m.id) || [],
      });
    }

    // Apply filters
    let filtered = members;

    if (segmentFilter) {
      filtered = filtered.filter(m => m.segment.toLowerCase().replace(/ /g, '_') === segmentFilter);
    }
    if (topicFilter) {
      filtered = filtered.filter(m => m.primaryTopic === topicFilter);
    }
    if (attributionFilter) {
      filtered = filtered.filter(m => m.attribution === attributionFilter);
    }
    if (tierFilter) {
      if (tierFilter === 'free') {
        filtered = filtered.filter(m => !m.subscriptionTier || m.subscriptionTier.toLowerCase() === 'free');
      } else {
        filtered = filtered.filter(m => m.subscriptionTier.toLowerCase().includes(tierFilter.toLowerCase()));
      }
    }
    if (joinedFrom) {
      const from = new Date(joinedFrom);
      filtered = filtered.filter(m => m.memberJoinedAt && new Date(m.memberJoinedAt) >= from);
    }
    if (joinedTo) {
      const to = new Date(joinedTo);
      to.setDate(to.getDate() + 1); // include the end date
      filtered = filtered.filter(m => m.memberJoinedAt && new Date(m.memberJoinedAt) < to);
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

    // Summary stats
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const totalMembers = members.length;
    const powerGivers = members.filter(m => m.segment === 'Power Giver').length;
    const activeSeekers = members.filter(m => m.segment === 'Active Seeker').length;
    const topicSpecialists = members.filter(m => m.segment === 'Topic Specialist').length;
    const avgEngagement = totalMembers > 0
      ? Math.round(members.reduce((s, m) => s + m.engagementScore, 0) / totalMembers)
      : 0;
    const newThisMonth = members.filter(m => m.memberJoinedAt && new Date(m.memberJoinedAt) >= thirtyDaysAgo).length;
    const inviteCount = members.filter(m => m.attribution === 'invite').length;
    const directCount = members.filter(m => m.attribution === 'direct').length;
    const affiliateCount = members.filter(m => m.attribution === 'affiliate').length;

    return NextResponse.json({
      summary: {
        totalMembers, powerGivers, activeSeekers, topicSpecialists, avgEngagement,
        newThisMonth, inviteCount, directCount, affiliateCount,
      },
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

  if (totalActivity >= 10 && adjustedGiverCount > seekerCount && uniqueTopicCount >= 3) {
    return 'Power Giver';
  }

  if (totalActivity >= 5 && seekerCount > adjustedGiverCount) {
    return 'Active Seeker';
  }

  if (topicsSorted.length > 0) {
    const topTopicCount = topicsSorted[0].count;
    const totalTopicPosts = topicsSorted.reduce((s, t) => s + t.count, 0);
    if (totalTopicPosts > 0 && topTopicCount / totalTopicPosts >= 0.7) {
      return 'Topic Specialist';
    }
  }

  if (conversationalPct >= 0.4 && threadCount >= 5) {
    return 'Social Connector';
  }

  return 'General';
}
