import { NextRequest, NextResponse } from 'next/server';
import { langChainAgent } from '@/lib/ai/langchain-agent';
import { db } from '@/lib/db';
import { env } from '@/lib/config/env';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, phone = '+8801711223344', conversationId = 'demo-sim-conv' } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 });
    }

    const timestamp = new Date().toLocaleTimeString();
    const logs: Array<{ step: string; detail: string; timestamp: string; type: 'ai' | 'db' | 'telegram' | 'whatsapp' }> = [];

    logs.push({
      step: 'WhatsApp Webhook Received',
      detail: `Incoming message from ${phone}: "${message}"`,
      timestamp,
      type: 'whatsapp'
    });

    // Count existing orders to detect new creation
    const initialOrders = await db.getOrders();
    const initialOrderCount = initialOrders.length;

    logs.push({
      step: 'AI Agent Processing',
      detail: `Evaluating intent using ${env.openai.apiKey ? `OpenAI (${env.openai.model}) with LangChain Tool Calling` : 'Smart Bilingual Heuristic Engine'}`,
      timestamp,
      type: 'ai'
    });

    // Run AI Agent
    const reply = await langChainAgent.processMessage({
      phone,
      messageText: message,
      conversationId
    });

    logs.push({
      step: 'AI Response Generated',
      detail: reply.slice(0, 120) + (reply.length > 120 ? '...' : ''),
      timestamp,
      type: 'ai'
    });

    // Check if an order was created during this interaction
    const latestOrders = await db.getOrders();
    let createdOrder = null;
    if (latestOrders.length > initialOrderCount) {
      createdOrder = latestOrders[0];
      logs.push({
        step: 'Supabase Database Insert',
        detail: `New order ${createdOrder.order_id} (৳${createdOrder.total_amount}) written to 'orders' & 'order_items' tables`,
        timestamp,
        type: 'db'
      });
      logs.push({
        step: 'Telegram Worker Bot Dispatched',
        detail: `Sent interactive Claim card to Telegram group "${env.telegram.workerGroupId}" via @mywab010bot`,
        timestamp,
        type: 'telegram'
      });
    }

    return NextResponse.json({
      success: true,
      reply,
      createdOrder,
      logs
    });
  } catch (error) {
    console.error('Simulator API Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
