import { sql } from '@vercel/postgres';
import { Post, Comment, Draft } from '@/types';

export async function initializeDatabase() {
  await sql`
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
  `;

  await sql`
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
  `;

  await sql`
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
  `;

  // Create indexes (IF NOT EXISTS not supported for indexes in all PG versions, so use DO block)
  await sql`CREATE INDEX IF NOT EXISTS idx_posts_topic ON posts(topic)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_posts_role ON posts(role)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_posts_reply_status ON posts(reply_status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id)`;
}

export async function upsertPost(post: Omit<Post, 'topic' | 'role' | 'classificationReasoning' | 'suggestedRepliers' | 'voiceProfile' | 'replyStatus' | 'assignedTo' | 'classifiedAt'>) {
  const result = await sql`
    INSERT INTO posts (id, slug, title, content, post_type, created_at, updated_at, comment_count, upvotes, is_pinned, author_id, author_name, author_first_name, author_last_name, author_bio, scraped_at, skool_url)
    VALUES (${post.id}, ${post.slug}, ${post.title}, ${post.content}, ${post.postType}, ${post.createdAt}, ${post.updatedAt}, ${post.commentCount}, ${post.upvotes}, ${post.isPinned}, ${post.authorId}, ${post.authorName}, ${post.authorFirstName}, ${post.authorLastName}, ${post.authorBio}, NOW(), ${post.skoolUrl})
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      content = EXCLUDED.content,
      updated_at = EXCLUDED.updated_at,
      comment_count = EXCLUDED.comment_count,
      upvotes = EXCLUDED.upvotes,
      is_pinned = EXCLUDED.is_pinned,
      author_bio = EXCLUDED.author_bio,
      scraped_at = NOW()
    RETURNING (xmax = 0) AS is_new
  `;
  return result.rows[0]?.is_new as boolean;
}

export async function upsertComment(comment: Comment & { postId: string }) {
  await sql`
    INSERT INTO comments (id, post_id, content, created_at, updated_at, upvotes, parent_id, root_id, author_id, author_name, author_first_name, author_last_name, author_bio, scraped_at)
    VALUES (${comment.id}, ${comment.postId}, ${comment.content}, ${comment.createdAt}, ${comment.updatedAt}, ${comment.upvotes}, ${comment.parentId}, ${comment.rootId}, ${comment.authorId}, ${comment.authorName}, ${comment.authorFirstName}, ${comment.authorLastName}, ${comment.authorBio}, NOW())
    ON CONFLICT (id) DO UPDATE SET
      content = EXCLUDED.content,
      updated_at = EXCLUDED.updated_at,
      upvotes = EXCLUDED.upvotes,
      scraped_at = NOW()
  `;
}

export async function getUnclassifiedPosts(): Promise<Post[]> {
  const result = await sql`
    SELECT * FROM posts WHERE topic IS NULL ORDER BY created_at DESC
  `;
  return result.rows.map(rowToPost);
}

export async function updatePostClassification(
  id: string,
  topic: string,
  role: string,
  reasoning: string,
  suggestedRepliers: string[],
  voiceProfile: 'A' | 'B'
) {
  await sql`
    UPDATE posts SET
      topic = ${topic},
      role = ${role},
      classification_reasoning = ${reasoning},
      suggested_repliers = ${suggestedRepliers as unknown as string},
      voice_profile = ${voiceProfile},
      classified_at = NOW()
    WHERE id = ${id}
  `;
}

export async function getPostById(id: string): Promise<Post | null> {
  const result = await sql`SELECT * FROM posts WHERE id = ${id}`;
  if (result.rows.length === 0) return null;
  return rowToPost(result.rows[0]);
}

export async function getCommentsByPostId(postId: string): Promise<Comment[]> {
  const result = await sql`
    SELECT * FROM comments WHERE post_id = ${postId} ORDER BY created_at ASC
  `;
  return result.rows.map(rowToComment);
}

export async function saveDraft(draft: Omit<Draft, 'id' | 'generatedAt' | 'editedContent' | 'editedAt'>): Promise<Draft> {
  const result = await sql`
    INSERT INTO drafts (post_id, draft_type, content, voice_profile)
    VALUES (${draft.postId}, ${draft.draftType}, ${draft.content}, ${draft.voiceProfile})
    RETURNING *
  `;
  return rowToDraft(result.rows[0]);
}

export async function getDraftsByPostId(postId: string): Promise<Draft[]> {
  const result = await sql`
    SELECT * FROM drafts WHERE post_id = ${postId} ORDER BY generated_at DESC
  `;
  return result.rows.map(rowToDraft);
}

export async function updateDraftContent(id: number, editedContent: string) {
  await sql`
    UPDATE drafts SET edited_content = ${editedContent}, edited_at = NOW() WHERE id = ${id}
  `;
}

export async function updatePostStatus(id: string, status: string, assignedTo?: string) {
  if (assignedTo) {
    await sql`UPDATE posts SET reply_status = ${status}, assigned_to = ${assignedTo} WHERE id = ${id}`;
  } else {
    await sql`UPDATE posts SET reply_status = ${status} WHERE id = ${id}`;
  }
}

export async function getPosts(filters: {
  topic?: string;
  role?: string;
  replier?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ posts: Post[]; total: number }> {
  const conditions: string[] = ['1=1'];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (filters.topic) {
    conditions.push(`topic = $${paramIndex++}`);
    values.push(filters.topic);
  }
  if (filters.role) {
    conditions.push(`role = $${paramIndex++}`);
    values.push(filters.role);
  }
  if (filters.replier) {
    conditions.push(`$${paramIndex++} = ANY(suggested_repliers)`);
    values.push(filters.replier);
  }
  if (filters.status) {
    conditions.push(`reply_status = $${paramIndex++}`);
    values.push(filters.status);
  }
  if (filters.search) {
    conditions.push(`(title ILIKE $${paramIndex} OR content ILIKE $${paramIndex})`);
    values.push(`%${filters.search}%`);
    paramIndex++;
  }

  const where = conditions.join(' AND ');
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  // For dynamic queries with variable conditions, use sql.query
  const countResult = await sql.query(
    `SELECT COUNT(*) as total FROM posts WHERE ${where}`,
    values
  );
  const result = await sql.query(
    `SELECT * FROM posts WHERE ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    values
  );

  return {
    posts: result.rows.map(rowToPost),
    total: parseInt(countResult.rows[0].total),
  };
}

export async function getStats() {
  const result = await sql`
    SELECT
      COUNT(*) as total_posts,
      COUNT(*) FILTER (WHERE topic IS NULL) as unclassified,
      COUNT(*) FILTER (WHERE reply_status = 'pending') as pending_replies,
      COUNT(*) FILTER (WHERE reply_status = 'replied' AND classified_at > NOW() - INTERVAL '7 days') as completed_this_week
    FROM posts
  `;
  return result.rows[0];
}

// Row mappers
function rowToPost(row: Record<string, unknown>): Post {
  return {
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    content: row.content as string,
    postType: row.post_type as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    commentCount: row.comment_count as number,
    upvotes: row.upvotes as number,
    isPinned: row.is_pinned as boolean,
    authorId: row.author_id as string,
    authorName: row.author_name as string,
    authorFirstName: row.author_first_name as string,
    authorLastName: row.author_last_name as string,
    authorBio: row.author_bio as string,
    topic: row.topic as string | null,
    role: row.role as string | null,
    classificationReasoning: row.classification_reasoning as string | null,
    suggestedRepliers: row.suggested_repliers as string[] | null,
    voiceProfile: row.voice_profile as 'A' | 'B' | null,
    replyStatus: row.reply_status as Post['replyStatus'],
    assignedTo: row.assigned_to as string | null,
    scrapedAt: row.scraped_at as string,
    classifiedAt: row.classified_at as string | null,
    skoolUrl: row.skool_url as string,
  };
}

function rowToComment(row: Record<string, unknown>): Comment {
  return {
    id: row.id as string,
    postId: row.post_id as string,
    content: row.content as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    upvotes: row.upvotes as number,
    parentId: row.parent_id as string | null,
    rootId: row.root_id as string | null,
    authorId: row.author_id as string,
    authorName: row.author_name as string,
    authorFirstName: row.author_first_name as string,
    authorLastName: row.author_last_name as string,
    authorBio: row.author_bio as string,
  };
}

function rowToDraft(row: Record<string, unknown>): Draft {
  return {
    id: row.id as number,
    postId: row.post_id as string,
    draftType: row.draft_type as Draft['draftType'],
    content: row.content as string,
    voiceProfile: row.voice_profile as 'A' | 'B',
    generatedAt: row.generated_at as string,
    editedContent: row.edited_content as string | null,
    editedAt: row.edited_at as string | null,
  };
}
