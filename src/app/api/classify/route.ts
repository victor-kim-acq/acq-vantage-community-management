import { NextRequest, NextResponse } from 'next/server';
import { classifyPosts } from '@/lib/classify';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  const body = await request.json().catch(() => ({}));
  const authSecret = secret || body.secret;

  if (authSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await classifyPosts();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Classification failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Classification failed' },
      { status: 500 }
    );
  }
}
