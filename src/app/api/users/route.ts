import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode');

    if (mode === 'raw') {
      const users = await db.getUsers();
      return NextResponse.json({ success: true, users });
    }

    const leaderboard = await db.getUsersLeaderboard();
    return NextResponse.json({
      success: true,
      count: leaderboard.length,
      leaderboard
    });
  } catch (err: any) {
    console.error('[API Users GET Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch users leaderboard' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, statusTag } = body;

    if (!userId || !statusTag || !['VIP', 'REGULAR', 'FLAGGED'].includes(statusTag)) {
      return NextResponse.json(
        { success: false, error: 'Invalid userId or statusTag (VIP | REGULAR | FLAGGED)' },
        { status: 400 }
      );
    }

    const updated = await db.updateUserStatus(userId, statusTag);
    return NextResponse.json({ success: true, user: updated });
  } catch (err: any) {
    console.error('[API Users PATCH Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to update user' },
      { status: 500 }
    );
  }
}
