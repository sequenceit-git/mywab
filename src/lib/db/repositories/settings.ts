import { getDbClient } from '../client';

// In-memory cache for fast, synchronous access in WhatsApp bot runtime
const settingsCache: Map<string, any> = new Map([
  ['kokos_pubg_auto_fulfill', false],
  ['kokos_fallback_to_telegram', true]
]);

let isInitialized = false;

export const settingsRepository = {
  /**
   * Initialize settings cache from database
   */
  async initSettings(): Promise<void> {
    if (isInitialized) return;
    try {
      const client = getDbClient();
      if (client) {
        const { data, error } = await client
          .from('system_settings')
          .select('key, value');

        if (!error && Array.isArray(data)) {
          for (const row of data) {
            settingsCache.set(row.key, row.value);
          }
        }
      }
      isInitialized = true;
    } catch (err) {
      console.warn('[SettingsRepository init error]:', err);
    }
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

    try {
      const client = getDbClient();
      if (client) {
        const { error } = await client
          .from('system_settings')
          .upsert({
            key,
            value,
            description: description || null,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });

        if (error) {
          console.warn(`[SettingsRepository persist error for ${key}]:`, error);
        }
      }
      return true;
    } catch (err) {
      console.error(`[SettingsRepository error updating ${key}]:`, err);
      return false;
    }
  }
};
