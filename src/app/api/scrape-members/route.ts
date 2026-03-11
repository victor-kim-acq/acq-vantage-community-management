import { NextRequest, NextResponse } from 'next/server';
import { getBuildId, fetchAllMembers } from '@/lib/skool';
import { initializeDatabase, upsertMember } from '@/lib/db';

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  const hasCookie = request.cookies.get('acq_auth')?.value === 'authenticated';
  if (secret !== process.env.CRON_SECRET && !hasCookie) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await initializeDatabase();

    const buildId = await getBuildId();
    const members = await fetchAllMembers(buildId);

    let newMembers = 0;
    let updatedMembers = 0;

    for (const member of members) {
      const isNew = await upsertMember(member);
      if (isNew) newMembers++;
      else updatedMembers++;
    }

    return NextResponse.json({
      membersScraped: members.length,
      newMembers,
      updatedMembers,
    });
  } catch (error) {
    console.error('Member scrape failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Member scrape failed' },
      { status: 500 }
    );
  }
}
