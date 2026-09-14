import { NextResponse } from 'next/server';
import { env } from '@/lib/config/env';
import { supabase, supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/client';

export async function GET() {
  try {
    const client = supabaseAdmin || supabase;
    let dbConnected = false;
    let stats = {
      productsCount: 0,
      ordersCount: 0,
      workersCount: 0,
      conversationsCount: 0,
      faqsCount: 0,
    };

    if (isSupabaseConfigured() && client) {
      try {
        const [
          { count: prodCount, error: prodErr },
          { count: ordCount, error: ordErr },
          { count: workCount, error: workErr },
          { count: convCount, error: convErr },
          { count: faqCount, error: faqErr }
        ] = await Promise.all([
          client.from('products').select('*', { count: 'exact', head: true }),
          client.from('orders').select('*', { count: 'exact', head: true }),
          client.from('workers').select('*', { count: 'exact', head: true }),
          client.from('conversations').select('*', { count: 'exact', head: true }),
          client.from('faqs').select('*', { count: 'exact', head: true })
        ]);

        if (!prodErr) {
          dbConnected = true;
          stats = {
            productsCount: prodCount || 0,
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
        domain: env.app.domain,
        url: env.app.url,
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
      openai: {
        isConfigured: env.openai.isConfigured,
        model: env.openai.model,
        apiKeyMasked: mask(env.openai.apiKey)
      },
      whatsapp: {
        isConfigured: env.whatsapp.isConfigured,
        phoneNumberId: env.whatsapp.phoneNumberId || 'Not configured',
        verifyToken: env.whatsapp.verifyToken,
        accessTokenMasked: mask(env.whatsapp.accessToken),
        webhookUrl: `${env.app.url}/api/webhooks/whatsapp`
      },
      telegram: {
        isConfigured: env.telegram.isConfigured,
        workerGroupId: env.telegram.workerGroupId || 'Not configured',
        botTokenMasked: mask(env.telegram.botToken),
        webhookUrl: `${env.app.url}/api/webhooks/telegram`
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
