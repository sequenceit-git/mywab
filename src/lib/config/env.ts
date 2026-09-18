/**
 * Centralized Dynamic Environment Configuration
 * Evaluates dynamically on every access so changes to process.env immediately reflect
 */

export const env = {
  supabase: {
    get url() {
      return process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    },
    get anonKey() {
      return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
    },
    get serviceRoleKey() {
      return process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    },
    get isConfigured() {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
      return Boolean(url && key && url.startsWith('http'));
    },
  },
  whatsapp: {
    get phoneNumberId() {
      return process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    },
    get businessAccountId() {
      return process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';
    },
    get accessToken() {
      return process.env.WHATSAPP_ACCESS_TOKEN || '';
    },
    get verifyToken() {
      return process.env.WHATSAPP_VERIFY_TOKEN || 'wapbusiness_secure_verify_token';
    },
    get apiUrl() {
      return process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v21.0';
    },
    get isConfigured() {
      return Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);
    },
  },
  telegram: {
    get botToken() {
      return process.env.TELEGRAM_BOT_TOKEN || '';
    },
    get workerGroupId() {
      return process.env.TELEGRAM_WORKER_GROUP_ID || '';
    },
    get apiUrl() {
      return `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN || ''}`;
    },
    get isConfigured() {
      return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WORKER_GROUP_ID);
    },
  },
  auth: {
    get adminEmail() {
      return process.env.ADMIN_EMAIL || 'admin@sequenceit.software';
    },
    get adminPassword() {
      return process.env.ADMIN_PASSWORD || 'admin123456';
    },
    get secret() {
      return process.env.AUTH_SECRET || 'wapbusiness_secure_session_secret_2026';
    },
  },
  app: {
    get url() {
      if (process.env.NEXT_PUBLIC_APP_URL) {
        return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
      }
      return 'https://mywab.sequenceit.software';
    },
    get domain() {
      if (process.env.DOMAIN) return process.env.DOMAIN;
      if (process.env.NEXT_PUBLIC_APP_URL) {
        try {
          return new URL(process.env.NEXT_PUBLIC_APP_URL).host;
        } catch {
          // ignore
        }
      }
      return 'mywab.sequenceit.software';
    },
  }
};
