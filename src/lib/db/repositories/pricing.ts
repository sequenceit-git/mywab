import { GAME_CATEGORIES, GameCategory, GamePackage } from '../../chat/game-catalog';
import { getDbClient, isSupabaseConfigured } from '../client';
import { mockStore } from '../mock-store';

export interface PricingProduct {
  id: string;
  categoryId: string;
  categoryTitle: string;
  categoryEmoji: string;
  name: string;
  amount: string;
  price: number;
  basePrice: number;
  profit: number;
  marginPercent: number;
  description?: string;
  isActive: boolean;
  sortOrder?: number;
  updatedAt?: string;
}

// In-memory store for packages (default seeded + runtime created/edited)
const memoryPackages = new Map<string, PricingProduct>();
const deletedPackageIds = new Set<string>();
let isInitialized = false;

/**
 * Initialize in-memory cache with default catalog
 */
function seedDefaults() {
  memoryPackages.clear();
  deletedPackageIds.clear();

  for (const cat of GAME_CATEGORIES) {
    let order = 0;
    for (const pkg of cat.packages) {
      order++;
      const price = Number(pkg.price) || 0;
      const basePrice = Number(pkg.basePrice) || Math.round(price * 0.82);
      const profit = Math.max(0, price - basePrice);
      const marginPercent = price > 0 ? Math.round((profit / price) * 100) : 0;

      memoryPackages.set(pkg.id, {
        id: pkg.id,
        categoryId: cat.id,
        categoryTitle: cat.title,
        categoryEmoji: cat.emoji,
        name: pkg.name,
        amount: pkg.amount || pkg.name,
        price,
        basePrice,
        profit,
        marginPercent,
        description: pkg.description || '',
        isActive: pkg.isActive !== false,
        sortOrder: order,
        updatedAt: new Date().toISOString()
      });
    }
  }
}

// Initial seed
seedDefaults();

export const pricingRepository = {
  /**
   * Ensure database data is synced with memory cache
   */
  async ensureInitialized(): Promise<void> {
    if (isInitialized) return;
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      try {
        // 1. Try reading from game_packages table
        const { data: gamePkgs, error: gpErr } = await client
          .from('game_packages')
          .select('*')
          .order('sort_order', { ascending: true });

        if (!gpErr && Array.isArray(gamePkgs) && gamePkgs.length > 0) {
          for (const row of gamePkgs) {
            const cat = GAME_CATEGORIES.find(c => c.id === row.category_id);
            const price = Number(row.price) || 0;
            const basePrice = Number(row.base_price) || 0;
            const profit = Math.max(0, price - basePrice);
            const marginPercent = price > 0 ? Math.round((profit / price) * 100) : 0;

            memoryPackages.set(row.id, {
              id: row.id,
              categoryId: row.category_id,
              categoryTitle: cat?.title || row.category_id,
              categoryEmoji: cat?.emoji || '🎮',
              name: row.name,
              amount: row.amount || row.name,
              price,
              basePrice,
              profit,
              marginPercent,
              description: row.description || '',
              isActive: row.is_active !== false,
              sortOrder: row.sort_order || 0,
              updatedAt: row.updated_at
            });
          }
          isInitialized = true;
          return;
        }

        // 2. Fallback to package_pricing table if game_packages is empty
        const { data: legacyPrices, error: legErr } = await client
          .from('package_pricing')
          .select('id, price, base_price, updated_at');

        if (!legErr && Array.isArray(legacyPrices)) {
          for (const row of legacyPrices) {
            const existing = memoryPackages.get(row.id);
            if (existing) {
              const price = Number(row.price) || existing.price;
              const basePrice = Number(row.base_price) || existing.basePrice;
              existing.price = price;
              existing.basePrice = basePrice;
              existing.profit = Math.max(0, price - basePrice);
              existing.marginPercent = price > 0 ? Math.round((existing.profit / price) * 100) : 0;
              existing.updatedAt = row.updated_at || existing.updatedAt;
            }
          }
        }
      } catch (err) {
        console.warn('[pricingRepository] Error syncing with Supabase:', err);
      }
    }
    isInitialized = true;
  },

  /**
   * Get all products with dynamic selling price, base cost, profit, and margin
   */
  async getAllProducts(includeInactive = false): Promise<PricingProduct[]> {
    await this.ensureInitialized();
    const products = Array.from(memoryPackages.values()).filter(p => !deletedPackageIds.has(p.id));
    if (!includeInactive) {
      return products.filter(p => p.isActive);
    }
    return products;
  },

  /**
   * Synchronous fast access to categories with live dynamic packages for WhatsApp Bot
   */
  getCachedCategories(): GameCategory[] {
    const products = Array.from(memoryPackages.values()).filter(p => !deletedPackageIds.has(p.id) && p.isActive);

    return GAME_CATEGORIES.map(cat => {
      const catPackages = products
        .filter(p => p.categoryId === cat.id)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        .map(p => ({
          id: p.id,
          name: p.name,
          amount: p.amount,
          price: p.price,
          basePrice: p.basePrice,
          description: p.description,
          isActive: p.isActive,
          sortOrder: p.sortOrder
        }));

      return {
        ...cat,
        packages: catPackages
      };
    });
  },

  /**
   * Get dynamic category by ID (synchronous for WhatsApp Bot)
   */
  getCachedCategory(categoryId: string): GameCategory | undefined {
    const categories = this.getCachedCategories();
    return categories.find(c => c.id === categoryId || c.code === categoryId);
  },

  /**
   * Get categories with customized and newly created package lists
   */
  async getCategories(includeInactive = false): Promise<GameCategory[]> {
    await this.ensureInitialized();
    const allProducts = await this.getAllProducts(includeInactive);

    return GAME_CATEGORIES.map(cat => {
      const catPackages = allProducts
        .filter(p => p.categoryId === cat.id)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        .map(p => ({
          id: p.id,
          name: p.name,
          amount: p.amount,
          price: p.price,
          basePrice: p.basePrice,
          description: p.description,
          isActive: p.isActive,
          sortOrder: p.sortOrder
        }));

      return {
        ...cat,
        packages: catPackages
      };
    });
  },

  /**
   * Get category by ID with its dynamic packages
   */
  async getCategoryById(categoryId: string): Promise<GameCategory | undefined> {
    const categories = await this.getCategories(true);
    return categories.find(c => c.id === categoryId || c.code === categoryId);
  },

  /**
   * Create a new package under a game category
   */
  async createPackage(params: {
    categoryId: string;
    name: string;
    amount: string;
    price: number;
    basePrice: number;
    description?: string;
  }): Promise<PricingProduct> {
    await this.ensureInitialized();

    const cat = GAME_CATEGORIES.find(c => c.id === params.categoryId);
    if (!cat) {
      throw new Error(`Category not found: ${params.categoryId}`);
    }

    const cleanCode = cat.code.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const cleanAmount = params.amount.replace(/[^a-z0-9]/gi, '').toLowerCase() || Date.now().toString(36);
    let packageId = `pkg_${cleanCode}_${cleanAmount}`;
    
    // Ensure unique ID
    if (memoryPackages.has(packageId)) {
      packageId = `pkg_${cleanCode}_${cleanAmount}_${Date.now().toString(36).slice(-4)}`;
    }

    const price = Number(params.price) || 0;
    const basePrice = Number(params.basePrice) || 0;
    const profit = Math.max(0, price - basePrice);
    const marginPercent = price > 0 ? Math.round((profit / price) * 100) : 0;
    const now = new Date().toISOString();

    const newProduct: PricingProduct = {
      id: packageId,
      categoryId: cat.id,
      categoryTitle: cat.title,
      categoryEmoji: cat.emoji,
      name: params.name.trim(),
      amount: params.amount.trim(),
      price,
      basePrice,
      profit,
      marginPercent,
      description: params.description?.trim() || '',
      isActive: true,
      sortOrder: (memoryPackages.size || 0) + 1,
      updatedAt: now
    };

    deletedPackageIds.delete(packageId);
    memoryPackages.set(packageId, newProduct);

    // Persist to Supabase if configured
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      try {
        await client.from('game_packages').upsert({
          id: packageId,
          category_id: cat.id,
          name: newProduct.name,
          amount: newProduct.amount,
          price: newProduct.price,
          base_price: newProduct.basePrice,
          description: newProduct.description,
          is_active: newProduct.isActive,
          sort_order: newProduct.sortOrder,
          updated_at: now
        });
      } catch (err) {
        console.warn('[pricingRepository] Supabase createPackage error (fallback to memory):', err);
      }
    }

    return newProduct;
  },

  /**
   * Update an existing package (name, amount, price, basePrice, description, isActive)
   */
  async updatePackage(
    packageId: string,
    updates: {
      name?: string;
      amount?: string;
      price?: number;
      basePrice?: number;
      description?: string;
      isActive?: boolean;
    }
  ): Promise<PricingProduct | null> {
    await this.ensureInitialized();

    const existing = memoryPackages.get(packageId);
    if (!existing || deletedPackageIds.has(packageId)) {
      return null;
    }

    const price = updates.price !== undefined ? Number(updates.price) : existing.price;
    const basePrice = updates.basePrice !== undefined ? Number(updates.basePrice) : existing.basePrice;
    const profit = Math.max(0, price - basePrice);
    const marginPercent = price > 0 ? Math.round((profit / price) * 100) : 0;
    const now = new Date().toISOString();

    const updatedProduct: PricingProduct = {
      ...existing,
      name: updates.name !== undefined ? updates.name.trim() : existing.name,
      amount: updates.amount !== undefined ? updates.amount.trim() : existing.amount,
      price,
      basePrice,
      profit,
      marginPercent,
      description: updates.description !== undefined ? updates.description.trim() : existing.description,
      isActive: updates.isActive !== undefined ? updates.isActive : existing.isActive,
      updatedAt: now
    };

    memoryPackages.set(packageId, updatedProduct);

    // Persist to Supabase if configured
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      try {
        await client.from('game_packages').upsert({
          id: packageId,
          category_id: updatedProduct.categoryId,
          name: updatedProduct.name,
          amount: updatedProduct.amount,
          price: updatedProduct.price,
          base_price: updatedProduct.basePrice,
          description: updatedProduct.description,
          is_active: updatedProduct.isActive,
          sort_order: updatedProduct.sortOrder,
          updated_at: now
        });

        // Also update legacy table if present
        await client.from('package_pricing').upsert({
          id: packageId,
          price: updatedProduct.price,
          base_price: updatedProduct.basePrice,
          updated_at: now
        }).select();
      } catch (err) {
        console.warn('[pricingRepository] Supabase updatePackage error (fallback to memory):', err);
      }
    }

    return updatedProduct;
  },

  /**
   * Delete a package
   */
  async deletePackage(packageId: string): Promise<boolean> {
    await this.ensureInitialized();

    if (!memoryPackages.has(packageId)) {
      return false;
    }

    deletedPackageIds.add(packageId);
    memoryPackages.delete(packageId);

    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      try {
        await client.from('game_packages').delete().eq('id', packageId);
        await client.from('package_pricing').delete().eq('id', packageId);
      } catch (err) {
        console.warn('[pricingRepository] Supabase deletePackage error:', err);
      }
    }

    return true;
  },

  /**
   * Find product by name or package ID to get cost and selling price
   */
  async findProduct(identifier: string): Promise<PricingProduct | null> {
    if (!identifier) return null;
    await this.ensureInitialized();
    const clean = identifier.toLowerCase().trim();
    const all = await this.getAllProducts(true);

    return all.find(
      p => p.id.toLowerCase() === clean ||
           p.name.toLowerCase() === clean ||
           (p.amount && p.amount.toLowerCase() === clean) ||
           clean.includes(p.name.toLowerCase()) ||
           p.name.toLowerCase().includes(clean)
    ) || null;
  },

  /**
   * Reset all prices and packages to factory defaults
   */
  async resetToDefaults(): Promise<void> {
    seedDefaults();

    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      try {
        await client.from('game_packages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await client.from('package_pricing').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (err) {
        console.warn('Could not clear Supabase tables on reset:', err);
      }
    }
  }
};
