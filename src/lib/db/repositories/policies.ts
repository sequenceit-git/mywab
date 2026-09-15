import { AIPolicy } from '@/types';
import { getDbClient, isSupabaseConfigured } from '../client';
import { mockStore } from '../mock-store';

export const policiesRepository = {
  async getAIPolicies(includeInactive = false): Promise<AIPolicy[]> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      try {
        let query = client.from('ai_policies').select('*').order('priority', { ascending: true });
        if (!includeInactive) {
          query = query.eq('is_active', true);
        }
        const { data, error } = await query;
        if (!error && data && data.length > 0) return data;
      } catch (err) {
        // Fallback gracefully
      }
    }
    const all = Array.from(mockStore.aiPolicies.values()).sort((a, b) => (a.priority || 0) - (b.priority || 0));
    return includeInactive ? all : all.filter(p => p.is_active);
  },

  async saveAIPolicy(policy: Partial<AIPolicy>): Promise<AIPolicy> {
    const id = policy.id || `policy-${Date.now()}`;
    const newPolicy: AIPolicy = {
      id,
      type: policy.type || 'DO',
      title: policy.title || '',
      rule_bn: policy.rule_bn || '',
      rule_en: policy.rule_en || '',
      category: policy.category || 'General',
      is_active: policy.is_active !== undefined ? policy.is_active : true,
      priority: policy.priority !== undefined ? policy.priority : 1,
      created_at: policy.created_at || new Date().toISOString()
    };

    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      try {
        await client.from('ai_policies').upsert(newPolicy);
      } catch (err) {
        console.error('Supabase saveAIPolicy error:', err);
      }
    }
    mockStore.aiPolicies.set(id, newPolicy);
    return newPolicy;
  },

  async deleteAIPolicy(id: string): Promise<boolean> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      try {
        await client.from('ai_policies').delete().eq('id', id);
      } catch (err) {
        console.error('Supabase deleteAIPolicy error:', err);
      }
    }
    mockStore.aiPolicies.delete(id);
    return true;
  }
};
