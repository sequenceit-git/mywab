import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get('all') === 'true';
    const faqs = await db.getFAQs(includeInactive);
    return NextResponse.json({ success: true, count: faqs.length, faqs });
  } catch (error) {
    console.error('API Error in GET /api/faqs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch FAQs' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.question_en && !body.question_bn) {
      return NextResponse.json(
        { success: false, error: 'Question is required' },
        { status: 400 }
      );
    }
    if (!body.answer_en && !body.answer_bn) {
      return NextResponse.json(
        { success: false, error: 'Answer is required' },
        { status: 400 }
      );
    }

    const savedFaq = await db.saveFAQ({
      id: body.id,
      question_en: body.question_en || body.question_bn,
      question_bn: body.question_bn || body.question_en,
      answer_en: body.answer_en || body.answer_bn,
      answer_bn: body.answer_bn || body.answer_en,
      category: body.category || 'General',
      is_active: body.is_active !== undefined ? body.is_active : true,
      created_at: body.created_at
    });

    return NextResponse.json({ success: true, faq: savedFaq });
  } catch (error) {
    console.error('API Error in POST /api/faqs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save FAQ' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'FAQ ID is required' },
        { status: 400 }
      );
    }

    const deleted = await db.deleteFAQ(id);
    return NextResponse.json({ success: deleted });
  } catch (error) {
    console.error('API Error in DELETE /api/faqs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete FAQ' },
      { status: 500 }
    );
  }
}
