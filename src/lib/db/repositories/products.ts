import { Product } from '@/types';
import { getDbClient, isSupabaseConfigured } from '../client';
import { mockStore } from '../mock-store';

export const productsRepository = {
  async getProducts(includeInactive = false): Promise<Product[]> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      let query = client.from('products').select('*').order('created_at', { ascending: false });
      if (!includeInactive) {
        query = query.eq('is_active', true);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) return data;
      if (error) console.error('Supabase getProducts error:', error);
    }
    const all = Array.from(mockStore.products.values());
    return includeInactive ? all : all.filter(p => p.is_active);
  },

  async getProductById(id: string): Promise<Product | null> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { data, error } = await client.from('products').select('*').eq('id', id).single();
      if (!error && data) return data;
    }
    return mockStore.products.get(id) || null;
  },

  async getProductBySku(sku: string): Promise<Product | null> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { data, error } = await client
        .from('products')
        .select('*')
        .eq('sku', sku)
        .single();
      if (!error && data) return data;
    }
    for (const p of mockStore.products.values()) {
      if (p.sku.toLowerCase() === sku.toLowerCase()) return p;
    }
    return null;
  },

  async saveProduct(product: Partial<Product>): Promise<Product> {
    // Generate valid UUID for PostgreSQL Supabase if new
    const isUuid = product.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(product.id);
    const id = isUuid ? product.id! : (product.id ? product.id : crypto.randomUUID());
    
    const newProd: Product = {
      id,
      sku: product.sku || `SKU-${Date.now()}`,
      name_en: product.name_en || '',
      name_bn: product.name_bn || product.name_en || '',
      description_en: product.description_en || null,
      description_bn: product.description_bn || null,
      price: product.price !== undefined ? Number(product.price) : 0,
      stock_qty: product.stock_qty !== undefined ? Number(product.stock_qty) : 9999,
      category: product.category || 'PUBG UC',
      is_active: product.is_active !== undefined ? product.is_active : true,
      created_at: product.created_at || new Date().toISOString()
    };

    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { error } = await client.from('products').upsert(newProd);
      if (error) console.error('Supabase saveProduct error:', error);
    }
    mockStore.products.set(id, newProd);
    return newProd;
  },

  async deleteProduct(id: string): Promise<boolean> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { error } = await client.from('products').delete().eq('id', id);
      if (error) console.error('Supabase deleteProduct error:', error);
    }
    mockStore.products.delete(id);
    return true;
  }
};
