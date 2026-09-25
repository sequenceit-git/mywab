import { GAME_CATEGORIES, GameCategory, GamePackage } from '../../chat/game-catalog';
import { connectToDatabase, isDbConfigured } from '../client';
import { PackageModel } from '../models/Package';
import { mockStore } from '../mock-store';
import { PackagePresetAccount, PackagePresetAccountPublic } from '@/types';

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
  presetAccount?: PackagePresetAccount;
  /**
   * Per-package Kokos Activator API auto-fulfillment override.
   * true = force ON for this package, false = force OFF, undefined = inherit the global Kokos toggle.
   */
  kokosAutoFulfill?: boolean;
}

export function toPublicPresetAccount(
  preset?: PackagePresetAccount
): PackagePresetAccountPublic | undefined {
  if (!preset?.email?.trim()) return undefined;
  return {
    email: preset.email.trim(),
    password: preset.password?.trim() || '',
    hasPassword: Boolean(preset.password?.trim()),
    pin: preset.pin?.trim() || undefined,
    profileName: preset.profileName?.trim() || undefined
  };
}

export function toPublicPricingProduct(product: PricingProduct): Omit<PricingProduct, 'presetAccount'> & {
  presetAccount?: PackagePresetAccountPublic;
} {
  const { presetAccount, ...rest } = product;
  const pub = toPublicPresetAccount(presetAccount);
  return pub ? { ...rest, presetAccount: pub } : rest;
}

function parsePresetFromRow(row: { preset_account?: { email?: string; password?: string; pin?: string; profile_name?: string } }): PackagePresetAccount | undefined {
  const pa = row.preset_account;
  if (!pa?.email?.trim() || !pa?.password?.trim()) return undefined;
  return {
    email: pa.email.trim(),
    password: pa.password.trim(),
    pin: pa.pin?.trim() || undefined,
    profileName: pa.profile_name?.trim() || undefined
  };
}

// In-memory store for packages (default seeded + runtime created/edited)
const memoryPackages = new Map<string, PricingProduct>();
const deletedPackageIds = new Set<string>();
let isInitialized = false;
let lastSyncedAt = 0;
const SYNC_TTL_MS = 10 * 1000; // 10s TTL for multi-process / webhook sync

/**
 * Intelligent package sorting helper:
 * 1. Explicit sortOrder if specified
 * 2. Numeric value extracted from amount or name (e.g., 60 UC -> 60, 115 UC -> 115, 130 Coins -> 130)
 * 3. Selling price ascending
 */
export function sortPackages<T extends { name: string; amount?: string; price?: number; sortOrder?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const orderA = a.sortOrder ?? 0;
    const orderB = b.sortOrder ?? 0;
    if (orderA > 0 && orderB > 0 && orderA !== orderB) {
      return orderA - orderB;
    }

    const numA = parseFloat(String(a.amount || a.name).replace(/[^0-9.]/g, '')) || 0;
    const numB = parseFloat(String(b.amount || b.name).replace(/[^0-9.]/g, '')) || 0;
    if (numA > 0 && numB > 0 && numA !== numB) {
      return numA - numB;
    }

    return (a.price || 0) - (b.price || 0);
  });
}

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
  async ensureInitialized(forceRefresh = false): Promise<void> {
    const now = Date.now();
    if (!forceRefresh && isInitialized && (now - lastSyncedAt < SYNC_TTL_MS)) {
      return;
    }

    if (isDbConfigured()) {
      try {
        const conn = await connectToDatabase();
        if (conn) {
          const docs = await PackageModel.find().lean();

          if (docs && docs.length > 0) {
            for (const row of docs) {
              if (!row?.id) continue;

              // Repair upserts that previously wrote packages without category_id
              // (those would vanish from the Pricing category list).
              const existingMem = memoryPackages.get(row.id);
              const categoryId = row.category_id || existingMem?.categoryId || '';
              if (!categoryId) {
                console.warn(`[pricingRepository] Skipping package ${row.id}: missing category_id`);
                continue;
              }

              if (!row.category_id && existingMem?.categoryId) {
                PackageModel.updateOne(
                  { id: row.id },
                  {
                    $set: {
                      category_id: existingMem.categoryId,
                      name: row.name || existingMem.name,
                      amount: row.amount || existingMem.amount,
                      price: row.price ?? existingMem.price,
                      base_price: row.base_price ?? existingMem.basePrice,
                      is_active: row.is_active !== false,
                      sort_order: row.sort_order || existingMem.sortOrder || 0
                    }
                  }
                ).catch(err => {
                  console.warn('[pricingRepository] Failed to repair missing category_id:', err);
                });
              }

              const cat = GAME_CATEGORIES.find(c => c.id === categoryId);
              const price = Number(row.price) || 0;
              const basePrice = Number(row.base_price) || 0;
              const profit = Math.max(0, price - basePrice);
              const marginPercent = price > 0 ? Math.round((profit / price) * 100) : 0;

              memoryPackages.set(row.id, {
                id: row.id,
                categoryId,
                categoryTitle: cat?.title || existingMem?.categoryTitle || categoryId,
                categoryEmoji: cat?.emoji || existingMem?.categoryEmoji || '🎮',
                name: row.name || existingMem?.name || row.id,
                amount: row.amount || existingMem?.amount || row.name || row.id,
                price,
                basePrice,
                profit,
                marginPercent,
                description: row.description || existingMem?.description || '',
                isActive: row.is_active !== false,
                sortOrder: row.sort_order || existingMem?.sortOrder || 0,
                updatedAt: row.updated_at,
                presetAccount: parsePresetFromRow(row) || existingMem?.presetAccount,
                kokosAutoFulfill:
                  typeof row.kokos_auto_fulfill === 'boolean'
                    ? row.kokos_auto_fulfill
                    : existingMem?.kokosAutoFulfill
              });
            }
          }
        }
      } catch (err) {
        console.warn('[pricingRepository] Error syncing with MongoDB:', err);
      }
    }
    isInitialized = true;
    lastSyncedAt = Date.now();
  },

  /**
   * Get all products with dynamic selling price, base cost, profit, and margin
   */
  async getAllProducts(includeInactive = false): Promise<PricingProduct[]> {
    await this.ensureInitialized();
    const list = Array.from(memoryPackages.values()).filter(p => !deletedPackageIds.has(p.id));
    const filtered = includeInactive ? list : list.filter(p => p.isActive);
    return sortPackages(filtered);
  },

  /**
   * Get products by category
   */
  async getProductsByCategory(categoryId: string, includeInactive = false): Promise<PricingProduct[]> {
    const all = await this.getAllProducts(includeInactive);
    return sortPackages(all.filter(p => p.categoryId === categoryId));
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
    return GAME_CATEGORIES.map(cat => {
      const catPackages = sortPackages(products.filter(p => p.categoryId === cat.id));
      return {
        ...cat,
        packages: catPackages.map(p => ({
          id: p.id,
          name: p.name,
          amount: p.amount,
          price: p.price,
          basePrice: p.basePrice,
          description: p.description,
          isActive: p.isActive
        }))
      };
    });
  },

  /**
   * Synchronously get current cached categories and active packages
   */
  getCachedCategories(): GameCategory[] {
    const list = Array.from(memoryPackages.values()).filter(
      p => !deletedPackageIds.has(p.id) && p.isActive !== false
    );
    return GAME_CATEGORIES.map(cat => {
      const catPackages = sortPackages(list.filter(p => p.categoryId === cat.id));
      return {
        ...cat,
        packages: catPackages.map(p => ({
          id: p.id,
          name: p.name,
          amount: p.amount,
          price: p.price,
          basePrice: p.basePrice,
          description: p.description,
          isActive: p.isActive
        }))
      };
    });
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
    presetAccount?: PackagePresetAccount;
    kokosAutoFulfill?: boolean | null;
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
      sortOrder: 0,
      updatedAt: now,
      presetAccount: params.presetAccount,
      kokosAutoFulfill:
        params.kokosAutoFulfill === null || params.kokosAutoFulfill === undefined
          ? undefined
          : params.kokosAutoFulfill
    };

    deletedPackageIds.delete(packageId);
    memoryPackages.set(packageId, newProduct);
    lastSyncedAt = Date.now();

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
              updated_at: now,
              preset_account: newProduct.presetAccount
                ? {
                    email: newProduct.presetAccount.email,
                    password: newProduct.presetAccount.password,
                    pin: newProduct.presetAccount.pin || '',
                    profile_name: newProduct.presetAccount.profileName || ''
                  }
                : null,
              kokos_auto_fulfill: newProduct.kokosAutoFulfill === undefined ? null : newProduct.kokosAutoFulfill
            }
          },
          { upsert: true, setDefaultsOnInsert: true }
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
      presetAccount?: PackagePresetAccount | null;
      /**
       * true/false = force override for this package.
       * null = explicitly clear the override (inherit the global Kokos toggle).
       * undefined = leave the existing override untouched.
       */
      kokosAutoFulfill?: boolean | null;
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

    let nextPreset = existing.presetAccount;
    if (updates.presetAccount !== undefined) {
      nextPreset = updates.presetAccount || undefined;
    }

    let nextKokosAutoFulfill = existing.kokosAutoFulfill;
    if (updates.kokosAutoFulfill !== undefined) {
      nextKokosAutoFulfill = updates.kokosAutoFulfill === null ? undefined : updates.kokosAutoFulfill;
    }

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
      updatedAt: now,
      presetAccount: nextPreset,
      kokosAutoFulfill: nextKokosAutoFulfill
    };

    memoryPackages.set(packageId, updatedProduct);
    lastSyncedAt = Date.now();

    if (isDbConfigured()) {
      try {
        await connectToDatabase();
        await PackageModel.findOneAndUpdate(
          { id: packageId },
          {
            $set: {
              id: packageId,
              category_id: updatedProduct.categoryId,
              name: updatedProduct.name,
              amount: updatedProduct.amount,
              price: updatedProduct.price,
              base_price: updatedProduct.basePrice,
              profit: updatedProduct.profit,
              margin_percent: updatedProduct.marginPercent,
              description: updatedProduct.description || '',
              is_active: updatedProduct.isActive !== false,
              sort_order: updatedProduct.sortOrder || 0,
              updated_at: now,
              preset_account: updatedProduct.presetAccount
                ? {
                    email: updatedProduct.presetAccount.email,
                    password: updatedProduct.presetAccount.password,
                    pin: updatedProduct.presetAccount.pin || '',
                    profile_name: updatedProduct.presetAccount.profileName || ''
                  }
                : null,
              kokos_auto_fulfill:
                updatedProduct.kokosAutoFulfill === undefined ? null : updatedProduct.kokosAutoFulfill
            }
          },
          { upsert: true, setDefaultsOnInsert: true }
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
