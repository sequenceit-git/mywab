import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const policies = await db.getAIPolicies(includeInactive);
    return NextResponse.json({ success: true, policies });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, title, rule_bn, rule_en, category, is_active, priority } = body;

    if (!title || !rule_bn) {
      return NextResponse.json({ success: false, message: 'Title and Bengali Rule are required' }, { status: 400 });
    }

    const newPolicy = await db.saveAIPolicy({
      type: type || 'DO',
      title,
      rule_bn,
      rule_en: rule_en || rule_bn,
      category: category || 'General',
      is_active: is_active !== undefined ? is_active : true,
      priority: priority !== undefined ? Number(priority) : 1
    });

    return NextResponse.json({ success: true, policy: newPolicy });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: 'Policy ID is required' }, { status: 400 });
    }

    const saved = await db.saveAIPolicy({ id, ...updates });
    return NextResponse.json({ success: true, policy: saved });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'Policy ID is required' }, { status: 400 });
    }

    const success = await db.deleteAIPolicy(id);
    return NextResponse.json({ success, message: 'Policy deleted successfully' });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
