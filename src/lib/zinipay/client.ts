import { env } from '../config/env';

export interface CreateInvoiceParams {
  amount: number;
  cus_name?: string;
  cus_email?: string;
  metadata?: Record<string, any>;
  redirect_url?: string;
  cancel_url?: string;
  webhook_url?: string;
}

export interface CreateInvoiceResponse {
  status: boolean;
  message?: string;
  payment_url?: string;
  invoice_id?: string;
  error?: string;
}

export interface VerifyInvoiceResponse {
  status?: 'COMPLETED' | 'PENDING' | 'FAILED' | string;
  cus_name?: string;
  cus_email?: string;
  amount?: number;
  invoice_id?: string;
  payment_method?: string;
  transaction_id?: string;
  error?: string;
  raw?: any;
}

export class ZiniPayClient {
  private get apiKey(): string {
    return env.zinipay.apiKey;
  }

  private get baseUrl(): string {
    return env.zinipay.apiUrl;
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 5);
  }

  /**
   * Helper to safely extract invoice_id from payment_url if not directly provided
   * e.g. "https://secure.zinipay.com/payment/INV-12345" -> "INV-12345"
   */
  public extractInvoiceId(paymentUrl?: string): string | undefined {
    if (!paymentUrl) return undefined;
    try {
      const url = new URL(paymentUrl);
      const segments = url.pathname.split('/').filter(Boolean);
      return segments[segments.length - 1];
    } catch {
      const parts = paymentUrl.split('/');
      return parts[parts.length - 1];
    }
  }

  /**
   * Create a hosted payment invoice on ZiniPay
   * Endpoint: POST /v1/payment/create
   */
  async createInvoice(params: CreateInvoiceParams): Promise<CreateInvoiceResponse> {
    if (!this.isConfigured()) {
      return {
        status: false,
        error: 'ZiniPay API Key not configured. Please set ZINIPAY_API_KEY in environment or admin panel.'
      };
    }

    const appUrl = env.app.url;
    const botPhone = (env.whatsapp.botPhone || '15551419791').replace(/\D/g, '');
    const defaultWpRedirectUrl = `https://wa.me/${botPhone}`;
    const redirectUrl = params.redirect_url || defaultWpRedirectUrl;
    const cancelUrl = params.cancel_url || defaultWpRedirectUrl;
    const webhookUrl = params.webhook_url || `${appUrl}/api/webhooks/zinipay`;

    const rawPhone = (params.metadata?.customer_phone || '').toString().replace(/\D/g, '');
    const rawUid = (params.metadata?.player_uid || params.cus_name || '').toString().replace(/[^a-zA-Z0-9]/g, '');
    const idTag = rawPhone || rawUid || 'guest';

    const cusName = (params.cus_name || (params.metadata?.player_uid ? `Player ${params.metadata.player_uid}` : `Customer ${idTag}`)).trim();
    const cusEmail = (params.cus_email || `customer_${idTag}@dsdukan.cloud`).trim();

    const payload: Record<string, any> = {
      amount: Math.round(params.amount),
      cus_name: cusName,
      cus_email: cusEmail,
      redirect_url: redirectUrl,
      cancel_url: cancelUrl,
      webhook_url: webhookUrl
    };

    if (rawPhone) {
      payload.cus_phone = rawPhone;
    }

    if (params.metadata && typeof params.metadata === 'object') {
      payload.metadata = params.metadata;
    }

    try {
      console.log(`[ZiniPay createInvoice] Request payload for amount ৳${payload.amount}:`, JSON.stringify(payload));
      
      const response = await fetch(`${this.baseUrl}/v1/payment/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'zini-api-key': this.apiKey,
          'zinipay-api-key': this.apiKey
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      console.log(`[ZiniPay createInvoice Response] Status ${response.status}:`, JSON.stringify(data));

      if (response.ok && data.status && data.payment_url) {
        const invoiceId = data.invoice_id || data.invoiceId || this.extractInvoiceId(data.payment_url);
        return {
          status: true,
          message: data.message || 'Invoice created successfully.',
          payment_url: data.payment_url,
          invoice_id: invoiceId
        };
      }

      return {
        status: false,
        error: data.message || data.error || 'Failed to create ZiniPay invoice.'
      };
    } catch (err: any) {
      console.error('[ZiniPay createInvoice Exception]:', err);
      return {
        status: false,
        error: err.message || String(err)
      };
    }
  }

  /**
   * Verify payment status of an invoice on ZiniPay
   * Endpoint: POST /v1/payment/verify
   */
  async verifyInvoice(invoiceId: string): Promise<VerifyInvoiceResponse> {
    if (!this.isConfigured()) {
      return {
        status: 'FAILED',
        error: 'ZiniPay API Key not configured.'
      };
    }

    const cleanInvoiceId = (invoiceId || '').trim();
    if (!cleanInvoiceId) {
      return {
        status: 'FAILED',
        error: 'Invoice ID is required for verification.'
      };
    }

    try {
      console.log(`[ZiniPay verifyInvoice] Verifying invoice: ${cleanInvoiceId}...`);

      const response = await fetch(`${this.baseUrl}/v1/payment/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'zini-api-key': this.apiKey,
          'zinipay-api-key': this.apiKey
        },
        body: JSON.stringify({
          invoice_id: cleanInvoiceId
        })
      });

      const data = await response.json();
      console.log(`[ZiniPay verifyInvoice Response]:`, JSON.stringify(data));

      if (response.ok && data) {
        return {
          status: data.status, // 'COMPLETED' | 'PENDING' | 'FAILED'
          cus_name: data.cus_name,
          cus_email: data.cus_email,
          amount: data.amount,
          invoice_id: data.invoice_id || cleanInvoiceId,
          payment_method: data.payment_method || 'bKash',
          transaction_id: data.transaction_id,
          raw: data
        };
      }

      return {
        status: 'FAILED',
        error: data.message || data.error || 'Failed to verify invoice.'
      };
    } catch (err: any) {
      console.error('[ZiniPay verifyInvoice Exception]:', err);
      return {
        status: 'FAILED',
        error: err.message || String(err)
      };
    }
  }
}

export const zinipayClient = new ZiniPayClient();
