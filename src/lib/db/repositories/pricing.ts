import { GAME_CATEGORIES, GameCategory, GamePackage } from '../../chat/game-catalog';
import { connectToDatabase, isDbConfigured } from '../client';
import { PackageModel } from '../models/Package';
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
    if (isDbConfigured()) {
      try {
        const conn = await connectToDatabase();
        if (!conn) {
          isInitialized = true;
          return;
        }
        const docs = await PackageModel.find().sort({ sort_order: 1 }).lean();

        if (docs && docs.length > 0) {
          for (const row of docs) {
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
      } catch (err) {
        console.warn('[pricingRepository] Error syncing with MongoDB:', err);
      }
    }
    isInitialized = true;
  },

  /**
   * Get all products with dynamic selling price, base cost, profit, and margin
   */
  async getAllProducts(includeInactive = false): Promise<PricingProduct[]> {
    await this.ensureInitialized();
    const list = Array.from(memoryPackages.values()).filter(p => !deletedPackageIds.has(p.id));
    return includeInactive ? list : list.filter(p => p.isActive);
  },

  /**
   * Get products by category
   */
  async getProductsByCategory(categoryId: string, includeInactive = false): Promise<PricingProduct[]> {
    const all = await this.getAllProducts(includeInactive);
    return all.filter(p => p.categoryId === categoryId);
  },

  /**
   * Get a single product by package ID
   */
  async getProductById(packageId: string): Promise<PricingProduct | null> {
    await this.ensureInitialized();
    if (deletedPackageIds.has(packageId)) return null;
    return memoryPackages.get(packageId) || null;
  },

  /**
   * Get all categories with dynamic packages list
   */
  async getCategories(includeInactive = false): Promise<GameCategory[]> {
    await this.ensureInitialized();
    const products = await this.getAllProducts(includeInactive);
    return GAME_CATEGORIES.map(cat => ({
      ...cat,
      packages: products
        .filter(p => p.categoryId === cat.id)
        .map(p => ({
          id: p.id,
          name: p.name,
          amount: p.amount,
          price: p.price,
          basePrice: p.basePrice,
          description: p.description,
          isActive: p.isActive
        }))
    }));
  },

  /**
   * Synchronously get current cached categories and active packages
   */
  getCachedCategories(): GameCategory[] {
    const list = Array.from(memoryPackages.values()).filter(p => !deletedPackageIds.has(p.id) && p.isActive);
    return GAME_CATEGORIES.map(cat => ({
      ...cat,
      packages: list
        .filter(p => p.categoryId === cat.id)
        .map(p => ({
          id: p.id,
          name: p.name,
          amount: p.amount,
          price: p.price,
          basePrice: p.basePrice,
          description: p.description,
          isActive: p.isActive
        }))
    }));
  },

  /**
   * Synchronously get a cached category by ID or code
   */
  getCachedCategory(categoryId: string): GameCategory | undefined {
    const categories = this.getCachedCategories();
    return categories.find(c => c.id === categoryId || (c as any).code === categoryId);
  },

  async getCategoryById(categoryId: string): Promise<GameCategory | undefined> {
    const categories = await this.getCategories(true);
    return categories.find(c => c.id === categoryId || (c as any).code === categoryId);
  },

  /**
   * Update price and base cost for a package
   */
  async updatePrice(
    packageId: string,
    sellingPrice: number,
    basePrice?: number
  ): Promise<PricingProduct | null> {
    await this.ensureInitialized();

    const existing = memoryPackages.get(packageId);
    if (!existing || deletedPackageIds.has(packageId)) {
      return null;
    }

    const price = Number(sellingPrice);
    const cost = basePrice !== undefined ? Number(basePrice) : existing.basePrice;
    const profit = Math.max(0, price - cost);
    const marginPercent = price > 0 ? Math.round((profit / price) * 100) : 0;
    const now = new Date().toISOString();

    existing.price = price;
    existing.basePrice = cost;
    existing.profit = profit;
    existing.marginPercent = marginPercent;
    existing.updatedAt = now;

    if (isDbConfigured()) {
      try {
        await connectToDatabase();
        await PackageModel.findOneAndUpdate(
          { id: packageId },
          {
            $set: {
              price,
              base_price: cost,
              profit,
              margin_percent: marginPercent,
              updated_at: now
            }
          },
          { upsert: true }
        );
      } catch (err) {
        console.warn('[pricingRepository] MongoDB updatePrice error:', err);
      }
    }

    return { ...existing };
  },

  /**
   * Create a new custom top-up package
   */
  async createPackage(params: {
    categoryId: string;
    name: string;
    amount: string;
    price: number;
    basePrice?: number;
    description?: string;
  }): Promise<PricingProduct> {
    await this.ensureInitialized();

    const cat = GAME_CATEGORIES.find(c => c.id === params.categoryId);
    if (!cat) {
      throw new Error(`Category "${params.categoryId}" not found`);
    }

    const slug = params.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const packageId = `${cat.id}-${slug}-${Date.now().toString(36)}`;
    const price = Number(params.price);
    const basePrice = params.basePrice !== undefined ? Number(params.basePrice) : Math.round(price * 0.82);
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

    if (isDbConfigured()) {
      try {
        await connectToDatabase();
        await PackageModel.findOneAndUpdate(
          { id: packageId },
          {
            $set: {
              id: packageId,
              category_id: cat.id,
              name: newProduct.name,
              amount: newProduct.amount,
              price: newProduct.price,
              base_price: newProduct.basePrice,
              profit: newProduct.profit,
              margin_percent: newProduct.marginPercent,
              description: newProduct.description,
              is_active: newProduct.isActive,
              sort_order: newProduct.sortOrder,
              updated_at: now
            }
          },
          { upsert: true }
        );
      } catch (err) {
        console.warn('[pricingRepository] MongoDB createPackage error:', err);
      }
    }

    return newProduct;
  },

  /**
   * Update an existing package
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

    if (isDbConfigured()) {
      try {
        await connectToDatabase();
        await PackageModel.findOneAndUpdate(
          { id: packageId },
          {
            $set: {
              name: updatedProduct.name,
              amount: updatedProduct.amount,
              price: updatedProduct.price,
              base_price: updatedProduct.basePrice,
              profit: updatedProduct.profit,
              margin_percent: updatedProduct.marginPercent,
              description: updatedProduct.description,
              is_active: updatedProduct.isActive,
              updated_at: now
            }
          },
          { upsert: true }
        );
      } catch (err) {
        console.warn('[pricingRepository] MongoDB updatePackage error:', err);
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

    if (isDbConfigured()) {
      try {
        await connectToDatabase();
        await PackageModel.deleteOne({ id: packageId });
      } catch (err) {
        console.warn('[pricingRepository] MongoDB deletePackage error:', err);
      }
    }

    return true;
  },

  /**
   * Find product by name or package ID
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

    if (isDbConfigured()) {
      try {
        await connectToDatabase();
        await PackageModel.deleteMany({});
      } catch (err) {
        console.warn('Could not clear MongoDB packages on reset:', err);
      }
    }
  }
};
