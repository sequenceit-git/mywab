import { GAME_CATEGORIES, GameCategory, GamePackage } from '@/lib/chat/game-catalog';
import { getDbClient, isSupabaseConfigured } from '../client';
import { mockStore } from '../mock-store';

export interface PricingProduct {
  id: string;
  categoryId: string;
  categoryTitle: string;
  categoryEmoji: string;
  name: string;
  price: number;
  basePrice: number;
  profit: number;
  marginPercent: number;
  description?: string;
  updatedAt?: string;
}

// In-memory overrides store initialized from default catalog
const priceOverrides = new Map<string, { price?: number; basePrice?: number; name?: string; description?: string; updatedAt?: string }>();

export const pricingRepository = {
  /**
   * Get all products with dynamic selling price, base cost, profit, and margin
   */
  async getAllProducts(): Promise<PricingProduct[]> {
    const products: PricingProduct[] = [];

    // Check if custom prices exist in Supabase
    let dbPrices = new Map<string, { price: number; base_price: number }>();
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      try {
        const { data } = await client.from('package_pricing').select('id, price, base_price');
        if (Array.isArray(data)) {
          for (const item of data) {
            if (item.id) {
              dbPrices.set(item.id, {
                price: Number(item.price),
                base_price: Number(item.base_price || 0)
              });
            }
          }
        }
      } catch (err) {
        console.warn('Could not fetch custom prices from Supabase package_pricing table:', err);
      }
    }

    for (const cat of GAME_CATEGORIES) {
      for (const pkg of cat.packages) {
        const override = priceOverrides.get(pkg.id);
        const dbItem = dbPrices.get(pkg.id);

        const currentPrice = override?.price ?? (dbItem?.price !== undefined ? dbItem.price : pkg.price);
        const currentBasePrice = override?.basePrice ?? (dbItem?.base_price !== undefined ? dbItem.base_price : (pkg.basePrice || Math.round(pkg.price * 0.82)));
        const currentName = override?.name ?? pkg.name;
        const currentDesc = override?.description ?? pkg.description;

        const profit = Math.max(0, currentPrice - currentBasePrice);
        const marginPercent = currentPrice > 0 ? Math.round((profit / currentPrice) * 100) : 0;

        products.push({
          id: pkg.id,
          categoryId: cat.id,
          categoryTitle: cat.title,
          categoryEmoji: cat.emoji,
          name: currentName,
          price: currentPrice,
          basePrice: currentBasePrice,
          profit,
          marginPercent,
          description: currentDesc,
          updatedAt: override?.updatedAt
        });
      }
    }

    return products;
  },

  /**
   * Get categories with customized package prices
   */
  async getCategories(): Promise<GameCategory[]> {
    const allProducts = await this.getAllProducts();
    const productMap = new Map(allProducts.map(p => [p.id, p]));

    return GAME_CATEGORIES.map(cat => ({
      ...cat,
      packages: cat.packages.map(pkg => {
        const custom = productMap.get(pkg.id);
        return {
          id: pkg.id,
          name: custom?.name ?? pkg.name,
          price: custom?.price ?? pkg.price,
          basePrice: custom?.basePrice ?? (pkg.basePrice || Math.round(pkg.price * 0.82)),
          description: custom?.description ?? pkg.description
        };
      })
    }));
  },

  /**
   * Update a package selling price and base cost
   */
  async updatePackage(
    packageId: string,
    updates: {
      price?: number;
      basePrice?: number;
      name?: string;
      description?: string;
    }
  ): Promise<PricingProduct | null> {
    const now = new Date().toISOString();
    const existing = priceOverrides.get(packageId) || {};
    
    priceOverrides.set(packageId, {
      ...existing,
      ...updates,
      updatedAt: now
    });

    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      try {
        await client.from('package_pricing').upsert({
          id: packageId,
          price: updates.price,
          base_price: updates.basePrice,
          updated_at: now
        });
      } catch (err) {
        console.warn('Failed to upsert to Supabase package_pricing table (non-fatal):', err);
      }
    }

    const all = await this.getAllProducts();
    return all.find(p => p.id === packageId) || null;
  },

  /**
   * Find product by name or package ID to get cost and selling price
   */
  async findProduct(identifier: string): Promise<PricingProduct | null> {
    if (!identifier) return null;
    const clean = identifier.toLowerCase().trim();
    const all = await this.getAllProducts();

    return all.find(
      p => p.id.toLowerCase() === clean ||
           p.name.toLowerCase() === clean ||
           clean.includes(p.name.toLowerCase()) ||
           p.name.toLowerCase().includes(clean)
    ) || null;
  },

  /**
   * Reset all prices to factory defaults
   */
  async resetToDefaults(): Promise<void> {
    priceOverrides.clear();
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      try {
        await client.from('package_pricing').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (err) {
        console.warn('Could not clear Supabase package_pricing table:', err);
      }
    }
  }
};
