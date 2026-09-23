import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/config/env';
import { supabase, supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/client';
import { baileysManager } from '@/lib/baileys';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const hostHeader = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
    const protoHeader = request.headers.get('x-forwarded-proto') || (request.url.startsWith('https') || hostHeader.includes('ngrok') ? 'https' : 'http');
    
    // Detect active base URL: if accessed via ngrok or custom domain, dynamically prioritize that host
    let activeUrl = '';
    if (hostHeader && (hostHeader.includes('ngrok') || !process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL.includes('localhost'))) {
      activeUrl = `${protoHeader}://${hostHeader}`;
    } else {
      activeUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || `${protoHeader}://${hostHeader}`;
    }
    if (!activeUrl) {
      activeUrl = env.app.url;
    }

    let activeDomain = '';
    if (hostHeader && (hostHeader.includes('ngrok') || !process.env.DOMAIN)) {
      activeDomain = hostHeader.split(':')[0];
    } else {
      activeDomain = process.env.DOMAIN || hostHeader.split(':')[0] || env.app.domain;
    }

    const client = supabaseAdmin || supabase;
    let dbConnected = false;
    let stats = {
      ordersCount: 0,
      workersCount: 0,
      conversationsCount: 0,
      faqsCount: 0,
    };

    if (isSupabaseConfigured() && client) {
      try {
        const [
          { count: ordCount, error: ordErr },
          { count: workCount, error: workErr },
          { count: convCount, error: convErr },
          { count: faqCount, error: faqErr }
        ] = await Promise.all([
          client.from('orders').select('*', { count: 'exact', head: true }),
          client.from('workers').select('*', { count: 'exact', head: true }),
          client.from('conversations').select('*', { count: 'exact', head: true }),
          client.from('faqs').select('*', { count: 'exact', head: true })
        ]);

        if (!ordErr) {
          dbConnected = true;
          stats = {
            ordersCount: ordCount || 0,
            workersCount: workCount || 0,
            conversationsCount: convCount || 0,
            faqsCount: faqCount || 0
          };
        }
      } catch (e) {
        console.error('Supabase status check error:', e);
      }
    }

    const mask = (str: string) => {
      if (!str) return 'Not Configured';
      if (str.length <= 8) return '••••••••';
      return `${str.slice(0, 4)}••••${str.slice(-4)}`;
    };

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      app: {
        domain: activeDomain,
        url: activeUrl,
        nodeEnv: process.env.NODE_ENV || 'production'
      },
      supabase: {
        isConfigured: env.supabase.isConfigured,
        connected: dbConnected,
        url: env.supabase.url || 'Not set',
        publishableKeyMasked: mask(env.supabase.anonKey),
        serviceRoleKeyMasked: mask(env.supabase.serviceRoleKey),
        stats
      },
      whatsapp: {
        provider: 'baileys',
        isConnected: baileysManager.isConnected,
        status: baileysManager.getStatus().status,
        registeredPhone: baileysManager.getStatus().registeredPhone,
        isConfigured: true,
      },
      telegram: {
        isConfigured: env.telegram.isConfigured,
        workerGroupId: env.telegram.workerGroupId || 'Not configured',
        botTokenMasked: mask(env.telegram.botToken),
        webhookUrl: `${activeUrl}/api/webhooks/telegram`
      },
      admin: {
        email: env.auth.adminEmail
      }
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
