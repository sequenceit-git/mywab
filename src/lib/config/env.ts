/**
 * Centralized Environment Configuration
 * All API keys and credentials are loaded from .env / .env.local
 */

export const env = {
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    isConfigured: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) &&
      process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('http')
    ),
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    isConfigured: Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-')),
  },
  whatsapp: {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'wapbusiness_secure_verify_token',
    apiUrl: 'https://graph.facebook.com/v21.0',
    isConfigured: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN),
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    workerGroupId: process.env.TELEGRAM_WORKER_GROUP_ID || '',
    apiUrl: `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN || ''}`,
    isConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WORKER_GROUP_ID),
  },
  auth: {
    adminEmail: process.env.ADMIN_EMAIL || 'admin@sequenceit.software',
    adminPassword: process.env.ADMIN_PASSWORD || 'admin123456',
    secret: process.env.AUTH_SECRET || 'wapbusiness_secure_session_secret_2026',
  },
  app: {
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://mywab.sequenceit.software',
    domain: process.env.DOMAIN || 'mywab.sequenceit.software',
  }
};
