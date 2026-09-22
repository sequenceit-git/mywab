/**
 * Kokos Activator API Client
 * Docs: https://docs.kokos.cc/guides/introduction
 * Endpoints:
 * - POST /redeem (Redeem from database or direct code)
 * - GET  /character (Fetch player name from PUBG Mobile / games)
 * - GET  /inventory (Check code stock across denominations)
 * - GET  /history/{id} (Fetch activation receipt)
 */

export interface KokosRedeemParams {
  playerId: string;
  denomination?: number;     // e.g. 60, 325, 660, 1800, 3850, 8100 (for DB inventory)
  codeOverride?: string;     // for direct code redemption
  gameId?: 'pubg_mobile' | 'honor_of_kings' | 'free_fire';
  requireReceipt?: boolean;  // default true
}

export interface KokosActivationReceipt {
  type: 'ActivationReceipt';
  id: number;
  createdAt: string;
  warning: boolean;
  took: number;              // ms
  playerId: string;
  code: string;
  openid?: string;
  name: string;              // Player's in-game name
  gameId: string;
  userId?: number;
  region?: string;
  productName?: string;
  amount?: number;
  uid?: string;              // MidasBuy ID
  email?: string;
  password?: string;
}

export type KokosErrorCode =
  | 'NO_ACCOUNTS_AVAILABLE'
  | 'NO_CODES_AVAILABLE'
  | 'LOGIN_FAILED'
  | 'CHARACTER_NOT_FOUND'
  | 'INVALID_ACTIVATION_RESPONSE'
  | 'CODE_USED'
  | 'INVALID_CODE'
  | 'RISK_CONTROL'
  | 'UNKNOWN'
  | 'NETWORK_ERROR'
  | 'TOKEN_NOT_CONFIGURED'
  | 'INVALID_DENOMINATION';

export interface KokosActivationError {
  errorCode: KokosErrorCode;
  message: string;
  details?: any;
}

export class KokosClient {
  private baseUrl = 'https://api.kokos.cc';

  private getToken(): string {
    return (process.env.KOKOS_API_TOKEN || '').trim();
  }

  public isConfigured(): boolean {
    return Boolean(this.getToken());
  }

  /**
   * Redeem a PUBG Mobile / supported game code
   */
  async redeemCode(params: KokosRedeemParams): Promise<{
    success: boolean;
    receipt?: KokosActivationReceipt;
    error?: KokosActivationError;
  }> {
    const token = this.getToken();
    if (!token) {
      return {
        success: false,
        error: {
          errorCode: 'TOKEN_NOT_CONFIGURED',
          message: 'Kokos API Token (KOKOS_API_TOKEN) is not configured in .env'
        }
      };
    }

    const cleanPlayerId = String(params.playerId || '').replace(/\D/g, '').trim();
    if (!cleanPlayerId) {
      return {
        success: false,
        error: {
          errorCode: 'CHARACTER_NOT_FOUND',
          message: 'Invalid player ID. Must contain digits only.'
        }
      };
    }

    const payload: Record<string, any> = {
      player_id: cleanPlayerId,
      game_id: params.gameId || 'pubg_mobile',
      require_receipt: params.requireReceipt !== false
    };

    if (params.codeOverride) {
      payload.code_override = params.codeOverride.trim();
    } else if (params.denomination) {
      payload.denomination = Number(params.denomination);
    } else {
      return {
        success: false,
        error: {
          errorCode: 'INVALID_DENOMINATION',
          message: 'Either denomination or codeOverride must be provided'
        }
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/redeem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
        // Generous timeout for redemption
        signal: AbortSignal.timeout(35000)
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data) {
        return {
          success: true,
          receipt: data as KokosActivationReceipt
        };
      }

      // Handle Kokos error responses (503 Activation Error or 422/400)
      const errCode = (data?.error_code || data?.errorCode || 'UNKNOWN') as KokosErrorCode;
      const errMsg = data?.message || data?.body?.error_code || `Activation failed with status ${response.status}`;

      return {
        success: false,
        error: {
          errorCode: errCode,
          message: errMsg,
          details: data
        }
      };
    } catch (err: any) {
      const isTimeout = err.name === 'TimeoutError' || err.message?.includes('timeout');
      return {
        success: false,
        error: {
          errorCode: isTimeout ? 'NETWORK_ERROR' : 'UNKNOWN',
          message: isTimeout ? 'Kokos API request timed out' : (err.message || 'Unknown network error'),
          details: err
        }
      };
    }
  }

  /**
   * Fetch player name & verify player ID
   */
  async getCharacter(playerId: string, gameId: string = 'pubg_mobile'): Promise<{
    success: boolean;
    name?: string;
    error?: string;
  }> {
    const token = this.getToken();
    if (!token) {
      return { success: false, error: 'KOKOS_API_TOKEN is not configured' };
    }

    const cleanPlayerId = String(playerId || '').replace(/\D/g, '').trim();
    if (!cleanPlayerId) {
      return { success: false, error: 'Invalid player ID' };
    }

    try {
      const url = new URL(`${this.baseUrl}/character`);
      url.searchParams.set('player_id', cleanPlayerId);
      url.searchParams.set('game_id', gameId);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        return { success: false, error: `Character lookup failed (${response.status})` };
      }

      const data = await response.json();
      return {
        success: true,
        name: data?.name || data?.character_name || undefined
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Character lookup network error' };
    }
  }

  /**
   * Check available database code inventory across denominations
   */
  async getInventory(): Promise<{
    success: boolean;
    inventory?: Record<string, number>;
    error?: string;
  }> {
    const token = this.getToken();
    if (!token) {
      return { success: false, error: 'KOKOS_API_TOKEN is not configured' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/database/inventory`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        // Try fallback endpoint /inventory
        const fbRes = await fetch(`${this.baseUrl}/inventory`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          signal: AbortSignal.timeout(10000)
        });

        if (fbRes.ok) {
          const data = await fbRes.json();
          return { success: true, inventory: data };
        }

        return { success: false, error: `Inventory request failed with status ${response.status}` };
      }

      const data = await response.json();
      return {
        success: true,
        inventory: data
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Inventory network error' };
    }
  }

  /**
   * Get past receipt by ID
   */
  async getReceipt(receiptId: number | string): Promise<{
    success: boolean;
    receipt?: KokosActivationReceipt;
    error?: string;
  }> {
    const token = this.getToken();
    if (!token) return { success: false, error: 'KOKOS_API_TOKEN is not configured' };

    try {
      const response = await fetch(`${this.baseUrl}/history/${receiptId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        return { success: false, error: `Failed to fetch receipt #${receiptId}` };
      }

      const data = await response.json();
      return { success: true, receipt: data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

export const kokosClient = new KokosClient();
