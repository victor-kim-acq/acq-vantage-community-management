import { NextRequest, NextResponse } from 'next/server';
import { getBuildId, fetchAllPosts, fetchCommentsForPosts } from '@/lib/skool';
import { initializeDatabase, upsertPost, upsertComment } from '@/lib/db';
import { ScrapeResult } from '@/types';

export const maxDuration = 300; // 5 minutes for Vercel

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  const hasCookie = request.cookies.get('acq_auth')?.value === 'authenticated';
  if (secret !== process.env.CRON_SECRET && !hasCookie) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const maxPages = parseInt(request.nextUrl.searchParams.get('pages') || '5', 10);
  const sinceParam = request.nextUrl.searchParams.get('since');
  const sinceDate = sinceParam ? new Date(sinceParam) : null;

  try {
    // Ensure tables exist
    await initializeDatabase();

    // Step 1: Get buildId
    const buildId = await getBuildId();

    // Step 2: Fetch posts
    let posts = await fetchAllPosts(buildId, maxPages);

    // Filter by date if specified
    if (sinceDate) {
      posts = posts.filter(p => new Date(p.createdAt) >= sinceDate);
    }

    const result: ScrapeResult = {
      postsScraped: posts.length,
      commentsScraped: 0,
      newPosts: 0,
      updatedPosts: 0,
    };

    // Step 3: Upsert posts
    for (const post of posts) {
      const isNew = await upsertPost({
        ...post,
        scrapedAt: new Date().toISOString(),
        skoolUrl: `https://www.skool.com/acq/${post.slug}`,
      });
      if (isNew) {
        result.newPosts++;
      } else {
        result.updatedPosts++;
      }
    }

    // Step 4: Fetch and upsert comments
    const commentMap = await fetchCommentsForPosts(
      posts.map(p => ({ id: p.id, commentCount: p.commentCount }))
    );

    for (const [postId, comments] of commentMap) {
      for (const comment of comments) {
        await upsertComment({ ...comment, postId });
        result.commentsScraped++;
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Scrape failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scrape failed' },
      { status: 500 }
    );
  }
}
