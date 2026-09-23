export interface SystemStatus {
  timestamp?: string;
  app?: {
    domain?: string;
    url?: string;
    nodeEnv?: string;
  };
  supabase?: {
    isConfigured?: boolean;
    connected?: boolean;
    url?: string;
    publishableKeyMasked?: string;
    serviceRoleKeyMasked?: string;
    stats?: {
      ordersCount?: number;
      workersCount?: number;
      conversationsCount?: number;
      faqsCount?: number;
    };
  };
  whatsapp?: {
    isConfigured?: boolean;
    phoneNumberId?: string;
    verifyToken?: string;
    accessTokenMasked?: string;
    webhookUrl?: string;
  };
  telegram?: {
    isConfigured?: boolean;
    workerGroupId?: string;
    botTokenMasked?: string;
    webhookUrl?: string;
  };
  admin?: {
    email?: string;
  };
}
