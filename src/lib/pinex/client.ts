/**
 * Pinex API Client (Free Fire Diamonds & Shells Auto-Fulfillment)
 * Docs Endpoint: https://sohan.pinexbot.shop/pinex/brand (POST)
 * 
 * Supports:
 * - type: "shell" (lite, lvl6, lvl10, lvl15, lvl20, lvl25, lvl30)
 * - type: "topup" (redeem vouchers to playerid)
 * - type: "uc" (UniPin vouchers)
 */

export interface PinexOrderParams {
  playerId: string;
  packageNameOrAmount: string;
  orderId: string;
  quantity?: number;
  callbackUrl?: string;
  typeOverride?: 'shell' | 'topup' | 'uc';
  productOverride?: string;
}

export interface PinexApiResponse {
  success: boolean;
  status: 'sucess' | 'failed' | 'pending' | 'error';
  orderId: string;
  type: string;
  product: string;
  nickname?: string;
  trxIdOrContent?: string;
  error?: string;
  raw?: any;
}

export class PinexClient {
  private defaultUrl = 'https://sohan.pinexbot.shop/pinex/brand';

  public getApiKey(): string {
    return (process.env.PINEX_API_KEY || '').trim().replace(/^["']|["']$/g, '');
  }

  public getEndpointUrl(): string {
    return (process.env.PINEX_API_URL || this.defaultUrl).trim().replace(/^["']|["']$/g, '');
  }

  public isConfigured(): boolean {
    return Boolean(this.getApiKey());
  }

  /**
   * Map Free Fire package name / denomination to Pinex product code and type
   */
  public resolveFreeFireProduct(packageNameOrAmount: string): {
    type: 'shell' | 'topup';
    product: string;
    quantity: number;
    description: string;
  } {
    const raw = String(packageNameOrAmount || '').toLowerCase().trim();

    // 1. Memberships / Passes
    if (raw.includes('weekly') || raw.includes('সাপ্তাহিক') || raw.includes('pass') || raw.includes('lite')) {
      return { type: 'shell', product: 'lite', quantity: 1, description: 'Free Fire Weekly Membership (Shell lite)' };
    }
    if (raw.includes('monthly') || raw.includes('মাসিক')) {
      return { type: 'shell', product: 'lvl30', quantity: 1, description: 'Free Fire Monthly Membership (Shell lvl30)' };
    }

    // 2. Direct Pinex Shell level tags
    if (raw.includes('lvl30') || raw.includes('level 30')) return { type: 'shell', product: 'lvl30', quantity: 1, description: 'Free Fire Shell Level 30' };
    if (raw.includes('lvl25') || raw.includes('level 25')) return { type: 'shell', product: 'lvl25', quantity: 1, description: 'Free Fire Shell Level 25' };
    if (raw.includes('lvl20') || raw.includes('level 20')) return { type: 'shell', product: 'lvl20', quantity: 1, description: 'Free Fire Shell Level 20' };
    if (raw.includes('lvl15') || raw.includes('level 15')) return { type: 'shell', product: 'lvl15', quantity: 1, description: 'Free Fire Shell Level 15' };
    if (raw.includes('lvl10') || raw.includes('level 10')) return { type: 'shell', product: 'lvl10', quantity: 1, description: 'Free Fire Shell Level 10' };
    if (raw.includes('lvl6') || raw.includes('level 6')) return { type: 'shell', product: 'lvl6', quantity: 1, description: 'Free Fire Shell Level 6' };

    // 3. Extract Diamond amount
    const numMatch = raw.match(/\d+/);
    const amount = numMatch ? parseInt(numMatch[0], 10) : 115;

    if (amount <= 50) {
      return { type: 'shell', product: 'lvl6', quantity: 1, description: `${amount} Diamonds (Shell lvl6)` };
    } else if (amount <= 115) {
      return { type: 'shell', product: 'lvl10', quantity: 1, description: '115 Diamonds (Shell lvl10)' };
    } else if (amount <= 240) {
      return { type: 'shell', product: 'lvl20', quantity: 1, description: '240 Diamonds (Shell lvl20)' };
    } else if (amount <= 355) {
      return { type: 'shell', product: 'lvl30', quantity: 1, description: '355 Diamonds (Shell lvl30)' };
    } else if (amount <= 610) {
      return { type: 'shell', product: 'lvl30', quantity: 2, description: '610 Diamonds (Shell lvl30 x2)' };
    } else if (amount <= 1240) {
      return { type: 'shell', product: 'lvl30', quantity: 4, description: '1240 Diamonds (Shell lvl30 x4)' };
    }

    // Default fallback to lvl10
    return { type: 'shell', product: 'lvl10', quantity: 1, description: `${amount} Diamonds (Shell lvl10)` };
  }

  /**
   * Automatically fulfill Free Fire Order via Pinex API
   */
  public async autoRedeemFreeFire(params: PinexOrderParams): Promise<PinexApiResponse> {
    const key = this.getApiKey();
    if (!key) {
      return {
        success: false,
        status: 'error',
        orderId: params.orderId,
        type: 'shell',
        product: 'unknown',
        error: 'PINEX_API_KEY is not configured in .env'
      };
    }

    const cleanPlayerId = String(params.playerId || '').replace(/\D/g, '').trim();
    if (!cleanPlayerId || cleanPlayerId.length < 4) {
      return {
        success: false,
        status: 'failed',
        orderId: params.orderId,
        type: 'shell',
        product: 'unknown',
        error: 'Invalid Free Fire Player ID. Must be numeric.'
      };
    }

    const resolved = this.resolveFreeFireProduct(params.packageNameOrAmount);
    const type = params.typeOverride || resolved.type;
    const product = params.productOverride || resolved.product;
    const quantity = params.quantity || resolved.quantity || 1;

    // Determine callback URL
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://dsdukan.cloud').replace(/\/$/, '');
    const callbackUrl = params.callbackUrl || `${appUrl}/api/system/pinex/callback`;

    const payload = {
      key,
      type,
      product,
      quantity: String(quantity),
      playerid: cleanPlayerId,
      orderid: String(params.orderId),
      url: callbackUrl
    };

    console.log(`[Pinex API Request] Dispatching Free Fire order #${params.orderId} for Player ${cleanPlayerId}:`, {
      type,
      product,
      quantity,
      url: callbackUrl
    });

    try {
      const endpoint = this.getEndpointUrl();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const responseText = await response.text();
      let responseData: any = {};

      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = { content: responseText };
      }

      console.log(`[Pinex API Response] Order #${params.orderId}:`, responseData);

      // Check if immediate response contains success or failed status
      const status = (responseData.status || '').toLowerCase();
      const isSuccess = status === 'sucess' || status === 'success' || response.ok;
      const isFailed = status === 'failed' || status === 'error';

      if (isSuccess && !isFailed) {
        return {
          success: true,
          status: 'sucess',
          orderId: params.orderId,
          type,
          product,
          nickname: responseData.nickname || undefined,
          trxIdOrContent: responseData.content || undefined,
          raw: responseData
        };
      }

      return {
        success: false,
        status: (isFailed ? 'failed' : 'pending') as any,
        orderId: params.orderId,
        type,
        product,
        error: responseData.content || responseData.error || responseData.message || 'Pinex API request failed',
        raw: responseData
      };
    } catch (err: any) {
      console.error(`[Pinex API Network Error] Order #${params.orderId}:`, err);
      return {
        success: false,
        status: 'error',
        orderId: params.orderId,
        type,
        product,
        error: err.message || 'Network error communicating with Pinex API'
      };
    }
  }
}

export const pinexClient = new PinexClient();
