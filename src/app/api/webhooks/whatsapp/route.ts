import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'deprecated',
    message: 'Meta Cloud API Webhook is deprecated. Messaging is handled via Baileys direct WebSocket.'
  });
}

export async function POST() {
  return NextResponse.json({
    status: 'deprecated',
    message: 'Meta Cloud API Webhook is deprecated. Messaging is handled via Baileys direct WebSocket.'
  });
}
