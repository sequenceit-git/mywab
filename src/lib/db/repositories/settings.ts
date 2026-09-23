import { connectToDatabase, isDbConfigured } from '../client';
import { SettingModel } from '../models/Setting';

// In-memory cache for fast, synchronous access in WhatsApp bot runtime
const settingsCache: Map<string, any> = new Map([
  ['kokos_pubg_auto_fulfill', false],
  ['kokos_fallback_to_telegram', true],
  ['pinex_ff_auto_fulfill', true],
  ['zinipay_auto_payment', true]
]);

let isInitialized = false;

export const settingsRepository = {
  /**
   * Initialize settings cache from database
   */
  async initSettings(): Promise<void> {
    if (isInitialized) return;
    if (isDbConfigured()) {
      try {
        const conn = await connectToDatabase();
        if (!conn) {
          isInitialized = true;
          return;
        }
        const docs = await SettingModel.find().lean();
        if (docs && Array.isArray(docs)) {
          for (const row of docs) {
            settingsCache.set(row.key, row.value);
          }
        }
        isInitialized = true;
      } catch (err) {
        console.warn('[SettingsRepository init error]:', err);
      }
    }
    isInitialized = true;
  },

  /**
   * Get a setting synchronously from cache (or defaultValue)
   */
  getCachedSetting<T = any>(key: string, defaultValue: T): T {
    if (settingsCache.has(key)) {
      return settingsCache.get(key) as T;
    }
    return defaultValue;
  },

  /**
   * Helper: Check if Kokos PUBG UID Auto-Fulfill is active
   */
  isKokosAutoFulfillEnabled(): boolean {
    return Boolean(this.getCachedSetting('kokos_pubg_auto_fulfill', false));
  },

  /**
   * Helper: Check if Pinex Free Fire Auto-Fulfill is active
   */
  isPinexAutoFulfillEnabled(): boolean {
    return Boolean(this.getCachedSetting('pinex_ff_auto_fulfill', true));
  },

  /**
   * Helper: Check if ZiniPay Automatic Payment Link & Verification is active
   */
  isZiniPayAutoPaymentEnabled(): boolean {
    return Boolean(this.getCachedSetting('zinipay_auto_payment', true));
  },

  /**
   * Get all settings as an object
   */
  async getAllSettings(): Promise<Record<string, any>> {
    await this.initSettings();
    const result: Record<string, any> = {};
    for (const [key, val] of settingsCache.entries()) {
      result[key] = val;
    }
    return result;
  },

  /**
   * Set and persist a setting
   */
  async setSetting(key: string, value: any, description?: string): Promise<boolean> {
    settingsCache.set(key, value);

    if (isDbConfigured()) {
      try {
        await connectToDatabase();
        await SettingModel.findOneAndUpdate(
          { key },
          {
            $set: {
              value,
              description: description || null,
              updated_at: new Date().toISOString()
            }
          },
          { upsert: true }
        );
        return true;
      } catch (err) {
        console.error(`[SettingsRepository error updating ${key}]:`, err);
        return false;
      }
    }
    return true;
  }
};
