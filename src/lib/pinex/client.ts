/**
 * Pinex API Client (Free Fire Diamonds & Shells Auto-Fulfillment)
 * Docs Endpoint: https://sohan.pinexbot.shop/pinex/brand (POST)
 * 
 * Supports:
 * - type: "shell" (lite, lvl6, lvl10, lvl15, lvl20, lvl25, lvl30)
 * - type: "topup" (redeem vouchers to playerid)
 * - type: "uc"   (UC voucher top-up; product = UC amount string e.g. "20", "36", "80")
 *
 * UC → Diamond mapping (new catalog):
 *   20 uc  →  25 dm
 *   36 uc  →  50 dm
 *   80 uc  → 115 dm
 *  160 uc  → 240 dm
 *  161 uc  → Weekly
 *  405 uc  → 610 dm
 *  800 uc  → Monthly
 *  810 uc  → 1240 dm
 * 1625 uc  → 2530 dm
 */

export interface PinexOrderParams {
  playerId: string;
  packageNameOrAmount: string;
  packageId?: string;
  orderId: string;
  quantity?: number;
  callbackUrl?: string;
  typeOverride?: 'shell' | 'topup' | 'uc';
  productOverride?: string;
}

type PinexResolvedProduct = {
  type: 'shell' | 'topup' | 'uc';
  product: string;
  quantity: number;
  description: string;
};

/**
 * Catalog SKU → Pinex product.
 * New packages use type 'uc' with the UC amount as product.
 * Weekly / Monthly / LvlUp remain on shell.
 */
const FF_SKU_MAP: Record<string, PinexResolvedProduct> = {
  // ── UC-based packages (new catalog) ──────────────────────────────────────
  pkg_ff_25:    { type: 'uc', product: '20',   quantity: 1, description: '25 Diamonds (20 UC)' },
  pkg_ff_50:    { type: 'uc', product: '36',   quantity: 1, description: '50 Diamonds (36 UC)' },
  pkg_ff_115:   { type: 'uc', product: '80',   quantity: 1, description: '115 Diamonds (80 UC)' },
  pkg_ff_240:   { type: 'uc', product: '160',  quantity: 1, description: '240 Diamonds (160 UC)' },
  pkg_ff_610:   { type: 'uc', product: '405',  quantity: 1, description: '610 Diamonds (405 UC)' },
  pkg_ff_1240:  { type: 'uc', product: '810',  quantity: 1, description: '1240 Diamonds (810 UC)' },
  pkg_ff_2530:  { type: 'uc', product: '1625', quantity: 1, description: '2530 Diamonds (1625 UC)' },

  // ── Membership / pass packages ───────────────────────────────────────────
  pkg_ff_weekly:  { type: 'uc', product: '161',  quantity: 1, description: 'Weekly Pack (161 UC)' },
  pkg_ff_monthly: { type: 'uc', product: '800',  quantity: 1, description: 'Monthly Pack (800 UC)' },
  pkg_ff_lvlup:   { type: 'shell', product: 'lite', quantity: 1, description: 'Lvl Up Pass (Shell lite)' },

  // ── Legacy packages (kept for backward-compat; fall back to nearest UC) ──
  pkg_ff_355:   { type: 'uc', product: '160',  quantity: 1, description: '355 Diamonds → 240 dm tier (160 UC)' },
  pkg_ff_480:   { type: 'uc', product: '405',  quantity: 1, description: '480 Diamonds → 610 dm tier (405 UC)' },
  pkg_ff_850:   { type: 'uc', product: '810',  quantity: 1, description: '850 Diamonds → 1240 dm tier (810 UC)' },
  pkg_ff_1090:  { type: 'uc', product: '810',  quantity: 1, description: '1090 Diamonds → 1240 dm tier (810 UC)' },
  pkg_ff_1850:  { type: 'uc', product: '1625', quantity: 1, description: '1850 Diamonds → 2530 dm tier (1625 UC)' },
  pkg_ff_5060:  { type: 'uc', product: '1625', quantity: 3, description: '5060 Diamonds (1625 UC x3)' },
  pkg_ff_10120: { type: 'uc', product: '1625', quantity: 6, description: '10120 Diamonds (1625 UC x6)' },
};

/** Diamond amount → Pinex product (used when customer sends a raw diamond number) */
const FF_AMOUNT_MAP: Record<number, PinexResolvedProduct> = {
  25:    FF_SKU_MAP.pkg_ff_25,
  50:    FF_SKU_MAP.pkg_ff_50,
  115:   FF_SKU_MAP.pkg_ff_115,
  240:   FF_SKU_MAP.pkg_ff_240,
  355:   FF_SKU_MAP.pkg_ff_355,
  480:   FF_SKU_MAP.pkg_ff_480,
  610:   FF_SKU_MAP.pkg_ff_610,
  850:   FF_SKU_MAP.pkg_ff_850,
  1090:  FF_SKU_MAP.pkg_ff_1090,
  1240:  FF_SKU_MAP.pkg_ff_1240,
  1850:  FF_SKU_MAP.pkg_ff_1850,
  2530:  FF_SKU_MAP.pkg_ff_2530,
  5060:  FF_SKU_MAP.pkg_ff_5060,
  10120: FF_SKU_MAP.pkg_ff_10120,
};

export interface PinexApiResponse {
  success: boolean;
  status: 'sucess' | 'failed' | 'pending' | 'error';
  orderId: string;
  type: string;        // 'uc' | 'shell' | 'topup'
  product: string;     // UC amount string (e.g. '20') or shell level (e.g. 'lvl6')
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
   * Map Free Fire package id / name / denomination to Pinex product code and type
   */
  public resolveFreeFireProduct(packageNameOrAmount: string, packageId?: string): PinexResolvedProduct {
    const sku = String(packageId || '').trim();
    if (sku && FF_SKU_MAP[sku]) {
      return FF_SKU_MAP[sku];
    }

    const raw = String(packageNameOrAmount || '').toLowerCase().trim();

    // Memberships / passes (check before digit parse — "Lvl Up" has no amount)
    if (raw.includes('monthly') || raw.includes('মাসিক') || raw.includes('মান্থলি')) {
      return FF_SKU_MAP.pkg_ff_monthly;
    }
    if (
      raw.includes('weekly') ||
      raw.includes('সাপ্তাহিক') ||
      raw.includes('উইকলি') ||
      raw.includes('lvl up') ||
      raw.includes('level up') ||
      raw.includes('lvlup') ||
      raw.includes('lite')
    ) {
      return FF_SKU_MAP.pkg_ff_weekly;
    }

    // Direct Pinex shell tags (admin / test names)
    if (raw.includes('lvl30') || raw.includes('level 30')) return { type: 'shell', product: 'lvl30', quantity: 1, description: 'Free Fire Shell Level 30' };
    if (raw.includes('lvl25') || raw.includes('level 25')) return { type: 'shell', product: 'lvl25', quantity: 1, description: 'Free Fire Shell Level 25' };
    if (raw.includes('lvl20') || raw.includes('level 20')) return { type: 'shell', product: 'lvl20', quantity: 1, description: 'Free Fire Shell Level 20' };
    if (raw.includes('lvl15') || raw.includes('level 15')) return { type: 'shell', product: 'lvl15', quantity: 1, description: 'Free Fire Shell Level 15' };
    if (raw.includes('lvl10') || raw.includes('level 10')) return { type: 'shell', product: 'lvl10', quantity: 1, description: 'Free Fire Shell Level 10' };
    if (raw.includes('lvl6') || raw.includes('level 6')) return { type: 'shell', product: 'lvl6', quantity: 1, description: 'Free Fire Shell Level 6' };

    const numbers = String(packageNameOrAmount || '').match(/\d+/g);
    const amount = numbers ? parseInt(numbers[numbers.length - 1], 10) : 0;
    if (amount > 0 && FF_AMOUNT_MAP[amount]) {
      return FF_AMOUNT_MAP[amount];
    }

    // Fallback: snap to nearest catalog tier
    if (amount <= 0)    return FF_SKU_MAP.pkg_ff_115;   // default
    if (amount <= 25)   return FF_AMOUNT_MAP[25];
    if (amount <= 50)   return FF_AMOUNT_MAP[50];
    if (amount <= 115)  return FF_AMOUNT_MAP[115];
    if (amount <= 240)  return FF_AMOUNT_MAP[240];
    if (amount <= 355)  return FF_AMOUNT_MAP[355];
    if (amount <= 480)  return FF_AMOUNT_MAP[480];
    if (amount <= 610)  return FF_AMOUNT_MAP[610];
    if (amount <= 850)  return FF_AMOUNT_MAP[850];
    if (amount <= 1090) return FF_AMOUNT_MAP[1090];
    if (amount <= 1240) return FF_AMOUNT_MAP[1240];
    if (amount <= 1850) return FF_AMOUNT_MAP[1850];
    if (amount <= 2530) return FF_AMOUNT_MAP[2530];
    if (amount <= 5060) return FF_AMOUNT_MAP[5060];
    if (amount <= 10120) return FF_AMOUNT_MAP[10120];

    // Very large amounts: stack 1625 UC vouchers
    return {
      type: 'uc',
      product: '1625',
      quantity: Math.max(1, Math.round(amount / 2530)),
      description: `${amount} Diamonds (1625 UC x${Math.max(1, Math.round(amount / 2530))})`
    };
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

    const resolved = this.resolveFreeFireProduct(params.packageNameOrAmount, params.packageId);
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
