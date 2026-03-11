import { Comment } from '@/types';

const SKOOL_GROUP = 'acq';
const POSTS_PER_PAGE = 10;

function getHeaders(): Record<string, string> {
  return {
    'Cookie': `auth_token=${process.env.SKOOL_AUTH_TOKEN}; client_id=${process.env.SKOOL_CLIENT_ID}`,
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': `https://www.skool.com/${SKOOL_GROUP}`,
  };
}

export async function getBuildId(): Promise<string> {
  const res = await fetch(`https://www.skool.com/${SKOOL_GROUP}`, {
    headers: getHeaders(),
  });
  const html = await res.text();
  const match = html.match(/"buildId"\s*:\s*"([^"]+)"/);
  if (!match) {
    throw new Error('Could not extract buildId from Skool homepage');
  }
  return match[1];
}

export interface SkoolPost {
  id: string;
  slug: string;
  title: string;
  content: string;
  postType: string;
  createdAt: string;
  updatedAt: string;
  commentCount: number;
  upvotes: number;
  isPinned: boolean;
  authorId: string;
  authorName: string;
  authorFirstName: string;
  authorLastName: string;
  authorBio: string;
}

export async function fetchPosts(buildId: string, page: number): Promise<SkoolPost[]> {
  const url = `https://www.skool.com/_next/data/${buildId}/${SKOOL_GROUP}.json?c=&s=newest&fl=&group=${SKOOL_GROUP}&p=${page}`;
  const res = await fetch(url, { headers: getHeaders() });

  if (!res.ok) {
    throw new Error(`Failed to fetch posts page ${page}: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const postTrees = data?.pageProps?.postTrees || [];

  return postTrees.map((tree: Record<string, unknown>) => {
    const post = tree.post as Record<string, unknown>;
    const metadata = post.metadata as Record<string, unknown>;
    const user = post.user as Record<string, unknown>;
    const userMetadata = user?.metadata as Record<string, unknown>;

    return {
      id: post.id as string,
      slug: (post.name as string) || '',
      title: (metadata?.title as string) || '',
      content: (metadata?.content as string) || '',
      postType: (post.postType as string) || '',
      createdAt: (post.createdAt as string) || '',
      updatedAt: (post.updatedAt as string) || '',
      commentCount: (metadata?.comments as number) || 0,
      upvotes: (metadata?.upvotes as number) || 0,
      isPinned: !(post.noComment as boolean),
      authorId: (user?.id as string) || '',
      authorName: `${(user?.firstName as string) || ''} ${(user?.lastName as string) || ''}`.trim(),
      authorFirstName: (user?.firstName as string) || '',
      authorLastName: (user?.lastName as string) || '',
      authorBio: (userMetadata?.bio as string) || '',
    };
  });
}

export async function fetchAllPosts(buildId: string, maxPages: number = 5): Promise<SkoolPost[]> {
  const allPosts: SkoolPost[] = [];
  const seenIds = new Set<string>();

  for (let page = 1; page <= maxPages; page++) {
    const posts = await fetchPosts(buildId, page);

    if (posts.length === 0) break;

    for (const post of posts) {
      // Deduplicate pinned posts (Skool returns them twice)
      if (seenIds.has(post.id)) continue;
      seenIds.add(post.id);
      allPosts.push(post);
    }

    // If we got fewer posts than expected, we've reached the end
    if (posts.length < POSTS_PER_PAGE) break;

    // Delay between pages
    if (page < maxPages) {
      await delay(1000);
    }
  }

  return allPosts;
}

export async function fetchComments(postId: string): Promise<Comment[]> {
  const groupId = process.env.SKOOL_GROUP_ID;
  const url = `https://api2.skool.com/posts/${postId}/comments?group-id=${groupId}&limit=25&pinned=true`;

  const res = await fetch(url, { headers: getHeaders() });

  if (!res.ok) {
    throw new Error(`Failed to fetch comments for post ${postId}: ${res.status}`);
  }

  const data = await res.json();
  const children = data?.post_tree?.children || [];
  return flattenComments(children);
}

function flattenComments(children: Record<string, unknown>[], parentId: string | null = null): Comment[] {
  const results: Comment[] = [];

  for (const child of children || []) {
    const c = child.post as Record<string, unknown>;
    if (!c) continue;

    const metadata = c.metadata as Record<string, unknown>;
    const user = c.user as Record<string, unknown>;
    const userMetadata = user?.metadata as Record<string, unknown>;

    results.push({
      id: c.id as string,
      content: (metadata?.content as string) || '',
      upvotes: (metadata?.upvotes as number) || 0,
      createdAt: c.created_at as string,
      updatedAt: c.updated_at as string,
      parentId: (c.parent_id as string) || parentId,
      rootId: (c.root_id as string) || null,
      authorId: (user?.id as string) || '',
      authorName: `${(user?.first_name as string) || ''} ${(user?.last_name as string) || ''}`.trim() || (user?.name as string) || '',
      authorFirstName: (user?.first_name as string) || '',
      authorLastName: (user?.last_name as string) || '',
      authorBio: (userMetadata?.bio as string) || '',
    });

    const subChildren = child.children as Record<string, unknown>[];
    if (subChildren?.length) {
      results.push(...flattenComments(subChildren, c.id as string));
    }
  }

  return results;
}

/**
 * Fetch comments for multiple posts with rate limiting.
 * Uses 2 concurrent requests with 600ms delays to stay under Skool's rate limit (~160 requests).
 */
export async function fetchCommentsForPosts(
  posts: { id: string; commentCount: number }[]
): Promise<Map<string, Comment[]>> {
  const postsWithComments = posts.filter(p => p.commentCount > 0);
  const results = new Map<string, Comment[]>();
  const concurrency = 2;

  for (let i = 0; i < postsWithComments.length; i += concurrency) {
    const batch = postsWithComments.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(p => fetchComments(p.id))
    );

    for (let j = 0; j < batch.length; j++) {
      const result = batchResults[j];
      if (result.status === 'fulfilled') {
        results.set(batch[j].id, result.value);
      } else {
        console.error(`Failed to fetch comments for post ${batch[j].id}:`, result.reason);
        results.set(batch[j].id, []);
      }
    }

    // Rate limit delay
    if (i + concurrency < postsWithComments.length) {
      await delay(600);
    }
  }

  return results;
}

// ── Members scraper ─────────────────────────────────────────────────────────

export interface SkoolMember {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  inviteEmail: string;
  billingEmail: string;
  bio: string;
  location: string;
  linkLinkedin: string;
  linkInstagram: string;
  linkWebsite: string;
  linkYoutube: string;
  linkFacebook: string;
  linkTwitter: string;
  myersBriggs: string;
  pictureUrl: string;
  accountCreatedAt: string;
  memberJoinedAt: string;
  lastOnlineAt: string;
  memberRole: string;
  attribution: string;
  invitedById: string;
  invitedByName: string;
  approvedById: string;
  requestLocation: string;
  surveyRevenueBracket: string;
  surveyWebsite: string;
  surveyPhone: string;
  subscriptionAmount: number | null;
  subscriptionCurrency: string;
  subscriptionInterval: string;
  subscriptionTier: string;
  stripeSubscriptionId: string;
}

function parseSurvey(surveyStr: string): { revenue?: string; website?: string; phone?: string } {
  if (!surveyStr) return {};
  try {
    const data = JSON.parse(surveyStr);
    // Survey can be an object or array of answers
    if (Array.isArray(data)) {
      const result: { revenue?: string; website?: string; phone?: string } = {};
      for (const item of data) {
        const answer = item?.answer || item?.a || '';
        const question = (item?.question || item?.q || '').toLowerCase();
        if (question.includes('revenue') || question.includes('earning') || question.includes('money')) {
          result.revenue = answer;
        } else if (question.includes('website') || question.includes('url')) {
          result.website = answer;
        } else if (question.includes('phone') || question.includes('number')) {
          result.phone = answer;
        }
      }
      return result;
    }
    return {
      revenue: data.revenue || data.revenueBracket || '',
      website: data.website || data.url || '',
      phone: data.phone || data.phoneNumber || '',
    };
  } catch {
    return {};
  }
}

function parseSubscription(mmbpStr: string): { amount?: number; currency?: string; interval?: string; tier?: string } {
  if (!mmbpStr) return {};
  try {
    const data = JSON.parse(mmbpStr);
    return {
      amount: data.amount || data.unit_amount || null,
      currency: data.currency || '',
      interval: data.recurring_interval || data.interval || '',
      tier: data.tier || data.plan || '',
    };
  } catch {
    return {};
  }
}

function parseSkoolMember(user: Record<string, unknown>): SkoolMember {
  const meta = (user.metadata || {}) as Record<string, unknown>;
  const member = (user.member || {}) as Record<string, unknown>;
  const memberMeta = (member.metadata || {}) as Record<string, unknown>;
  const aflData = (user.aflUserData || {}) as Record<string, unknown>;

  const survey = parseSurvey((memberMeta.survey as string) || '');
  const subscription = parseSubscription((memberMeta.mmbp as string) || '');

  return {
    id: (user.id as string) || '',
    slug: (user.name as string) || '',
    firstName: (user.firstName as string) || '',
    lastName: (user.lastName as string) || '',
    displayName: `${(user.firstName as string) || ''} ${(user.lastName as string) || ''}`.trim(),
    email: (user.email as string) || '',
    inviteEmail: (member.inviteEmail as string) || '',
    billingEmail: (memberMeta.mbme as string) || '',
    bio: (meta.bio as string) || '',
    location: (meta.location as string) || '',
    linkLinkedin: (meta.linkLinkedin as string) || '',
    linkInstagram: (meta.linkInstagram as string) || '',
    linkWebsite: (meta.linkWebsite as string) || '',
    linkYoutube: (meta.linkYoutube as string) || '',
    linkFacebook: (meta.linkFacebook as string) || '',
    linkTwitter: (meta.linkTwitter as string) || '',
    myersBriggs: (meta.myersBriggs as string) || '',
    pictureUrl: (meta.pictureProfile as string) || '',
    accountCreatedAt: (user.createdAt as string) || '',
    memberJoinedAt: (member.createdAt as string) || '',
    lastOnlineAt: (meta.lastOffline as string) || (memberMeta.lastOffline as string) || '',
    memberRole: (member.role as string) || '',
    attribution: (memberMeta.attrComp as string) || '',
    invitedById: (memberMeta.invitedBy as string) || '',
    invitedByName: aflData
      ? `${(aflData.firstName as string) || ''} ${(aflData.lastName as string) || ''}`.trim()
      : '',
    approvedById: (memberMeta.approvedBy as string) || '',
    requestLocation: (memberMeta.requestLocation as string) || '',
    surveyRevenueBracket: survey.revenue || '',
    surveyWebsite: survey.website || '',
    surveyPhone: survey.phone || '',
    subscriptionAmount: subscription.amount || null,
    subscriptionCurrency: subscription.currency || '',
    subscriptionInterval: subscription.interval || '',
    subscriptionTier: subscription.tier || '',
    stripeSubscriptionId: (memberMeta.msbs as string) || '',
  };
}

export async function fetchMembers(buildId: string, page: number): Promise<SkoolMember[]> {
  const url = `https://www.skool.com/_next/data/${buildId}/${SKOOL_GROUP}/-/members.json?p=${page}`;
  const res = await fetch(url, { headers: getHeaders() });

  if (!res.ok) {
    throw new Error(`Failed to fetch members page ${page}: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const users = data?.pageProps?.users || [];
  return users.map((u: Record<string, unknown>) => parseSkoolMember(u));
}

export async function fetchAllMembers(buildId: string): Promise<SkoolMember[]> {
  const allMembers: SkoolMember[] = [];
  const seenIds = new Set<string>();
  let page = 1;

  while (true) {
    const members = await fetchMembers(buildId, page);

    if (members.length === 0) break;

    for (const m of members) {
      if (seenIds.has(m.id)) continue;
      seenIds.add(m.id);
      allMembers.push(m);
    }

    page++;
    await delay(1000);
  }

  return allMembers;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
