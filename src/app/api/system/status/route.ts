import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/config/env';
import { connectToDatabase, isMongoConnected } from '@/lib/db/mongodb';
import { OrderModel } from '@/lib/db/models/Order';
import { WorkerModel } from '@/lib/db/models/Worker';
import { ConversationModel } from '@/lib/db/models/Conversation';
import { FaqModel } from '@/lib/db/models/Faq';

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

    let dbConnected = false;
    let stats = {
      ordersCount: 0,
      workersCount: 0,
      conversationsCount: 0,
      faqsCount: 0,
    };

    if (env.mongodb.isConfigured) {
      try {
        await connectToDatabase();
        if (isMongoConnected()) {
          dbConnected = true;
          const [ordCount, workCount, convCount, faqCount] = await Promise.all([
            OrderModel.countDocuments(),
            WorkerModel.countDocuments(),
            ConversationModel.countDocuments(),
            FaqModel.countDocuments()
          ]);
          stats = {
            ordersCount: ordCount,
            workersCount: workCount,
            conversationsCount: convCount,
            faqsCount: faqCount
          };
        }
      } catch (e) {
        console.error('MongoDB status check error:', e);
      }
    }

    const mask = (str: string) => {
      if (!str) return 'Not Configured';
      if (str.length <= 8) return '••••••••';
      return `${str.slice(0, 4)}••••${str.slice(-4)}`;
    };

    const maskUri = (uri: string) => {
      if (!uri) return 'Not Configured';
      return uri.replace(/:([^:@]+)@/, ':••••••••@');
    };

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      app: {
        domain: activeDomain,
        url: activeUrl,
        nodeEnv: process.env.NODE_ENV || 'production'
      },
      mongodb: {
        isConfigured: env.mongodb.isConfigured,
        connected: dbConnected,
        uriMasked: maskUri(env.mongodb.uri),
        stats
      },
      whatsapp: {
        isConfigured: env.whatsapp.isConfigured,
        phoneNumberId: env.whatsapp.phoneNumberId || 'Not configured',
        verifyToken: env.whatsapp.verifyToken,
        accessTokenMasked: mask(env.whatsapp.accessToken),
        webhookUrl: `${activeUrl}/api/webhooks/whatsapp`
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
