import { FAQ } from '@/types';
import { getDbClient, isSupabaseConfigured } from '../client';
import { mockStore } from '../mock-store';

export const faqsRepository = {
  async getFAQs(includeInactive = false): Promise<FAQ[]> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      let query = client.from('faqs').select('*').order('created_at', { ascending: false });
      if (!includeInactive) {
        query = query.eq('is_active', true);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) return data;
      if (error) console.error('Supabase getFAQs error:', error);
    }
    const all = Array.from(mockStore.faqs.values());
    return includeInactive ? all : all.filter(f => f.is_active);
  },

  async getFAQById(id: string): Promise<FAQ | null> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { data, error } = await client.from('faqs').select('*').eq('id', id).single();
      if (!error && data) return data;
    }
    return mockStore.faqs.get(id) || null;
  },

  async saveFAQ(faq: Partial<FAQ>): Promise<FAQ> {
    const isUuid = faq.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(faq.id);
    const id = isUuid ? faq.id! : (faq.id ? faq.id : crypto.randomUUID());
    const newFaq: FAQ = {
      id,
      question_en: faq.question_en || '',
      question_bn: faq.question_bn || faq.question_en || '',
      answer_en: faq.answer_en || '',
      answer_bn: faq.answer_bn || faq.answer_en || '',
      category: faq.category || 'General',
      is_active: faq.is_active !== undefined ? faq.is_active : true,
      created_at: faq.created_at || new Date().toISOString()
    };

    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { error } = await client.from('faqs').upsert(newFaq);
      if (error) console.error('Supabase saveFAQ error:', error);
    }
    mockStore.faqs.set(id, newFaq);
    return newFaq;
  },

  async deleteFAQ(id: string): Promise<boolean> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { error } = await client.from('faqs').delete().eq('id', id);
      if (error) console.error('Supabase deleteFAQ error:', error);
    }
    mockStore.faqs.delete(id);
    return true;
  }
};
