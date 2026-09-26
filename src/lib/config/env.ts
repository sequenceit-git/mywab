/**
 * Centralized Dynamic Environment Configuration
 * Evaluates dynamically on every access so changes to process.env immediately reflect
 */

export const env = {
  mongodb: {
    get uri() {
      return process.env.MONGODB_URI || '';
    },
    get isConfigured() {
      const uri = process.env.MONGODB_URI || '';
      return Boolean(uri && uri.startsWith('mongodb'));
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
    get botPhone() {
      return process.env.NEXT_PUBLIC_WHATSAPP_PHONE || '15551419791';
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
      return 'https://dsdukan.cloud';
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
      return 'dsdukan.cloud';
    },
  }
};
