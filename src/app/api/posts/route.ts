import { NextRequest, NextResponse } from 'next/server';
import { getPosts, getCommentsByPostId, getDraftsByPostId } from '@/lib/db';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  try {
    // Return distinct authors list if requested
    if (params.get('authors') === '1') {
      const { getDistinctAuthors } = await import('@/lib/db');
      const authorList = await getDistinctAuthors();
      return NextResponse.json({ authors: authorList });
    }

    const { posts, total } = await getPosts({
      topic: params.get('topic') || undefined,
      role: params.get('role') || undefined,
      replier: params.get('replier') || undefined,
      status: params.get('status') || undefined,
      search: params.get('search') || undefined,
      dateFrom: params.get('dateFrom') || undefined,
      dateTo: params.get('dateTo') || undefined,
      author: params.get('author') || undefined,
      limit: parseInt(params.get('limit') || '50', 10),
      offset: parseInt(params.get('offset') || '0', 10),
    });

    // If a specific post ID is requested, include comments and drafts
    const postId = params.get('postId');
    if (postId) {
      const post = posts.find(p => p.id === postId);
      if (post) {
        const [comments, drafts] = await Promise.all([
          getCommentsByPostId(postId),
          getDraftsByPostId(postId),
        ]);
        return NextResponse.json({ post, comments, drafts });
      }
    }

    return NextResponse.json({ posts, total });
  } catch (error) {
    console.error('Failed to fetch posts:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}
