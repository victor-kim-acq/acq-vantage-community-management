import { NextRequest, NextResponse } from 'next/server';
import { updatePostStatus } from '@/lib/db';

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { postId, status, assignedTo } = body;

    if (!postId || !status) {
      return NextResponse.json({ error: 'postId and status are required' }, { status: 400 });
    }

    const validStatuses = ['pending', 'drafted', 'replied', 'skipped'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
    }

    await updatePostStatus(postId, status, assignedTo);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update status' },
      { status: 500 }
    );
  }
}
