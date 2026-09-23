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
    get provider() {
      return (process.env.WHATSAPP_PROVIDER || 'baileys').toLowerCase() as 'baileys';
    },
    get authDir() {
      return process.env.BAILEYS_AUTH_DIR || process.env.WHATSAPP_AUTH_DIR || './baileys_auth';
    },
    get botPhone() {
      return process.env.NEXT_PUBLIC_WHATSAPP_PHONE || '15551419791';
    },
    get isConfigured() {
      return true;
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
  kokos: {
    get apiToken() {
      return process.env.KOKOS_API_TOKEN || '';
    },
    get isConfigured() {
      return Boolean(process.env.KOKOS_API_TOKEN);
    },
  },
  zinipay: {
    get apiKey() {
      return process.env.ZINIPAY_API_KEY || '';
    },
    get apiUrl() {
      return (process.env.ZINIPAY_API_URL || 'https://api.zinipay.com').replace(/\/$/, '');
    },
    get isConfigured() {
      return Boolean(process.env.ZINIPAY_API_KEY);
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
