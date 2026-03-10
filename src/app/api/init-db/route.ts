import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase } from '@/lib/db';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  if (body.secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await initializeDatabase();
    return NextResponse.json({ success: true, message: 'Database initialized' });
  } catch (error) {
    console.error('Database initialization failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Database initialization failed' },
      { status: 500 }
    );
  }
}
