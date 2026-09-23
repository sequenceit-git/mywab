import { FAQ } from '@/types';
import { connectToDatabase, isDbConfigured } from '../client';
import { FaqModel } from '../models/Faq';
import { mockStore } from '../mock-store';

export const faqsRepository = {
  async getFAQs(includeInactive = false): Promise<FAQ[]> {
    if (isDbConfigured()) {
      try {
        await connectToDatabase();
        const filter = includeInactive ? {} : { is_active: true };
        const docs = await FaqModel.find(filter).sort({ created_at: -1 }).lean();
        if (docs && docs.length > 0) return docs as any;
      } catch (err) {
        console.error('[MongoDB getFAQs error]:', err);
      }
    }
    const all = Array.from(mockStore.faqs.values());
    return includeInactive ? all : all.filter(f => f.is_active);
  },

  async getFAQById(id: string): Promise<FAQ | null> {
    if (isDbConfigured()) {
      try {
        await connectToDatabase();
        const doc = await FaqModel.findOne({ id }).lean();
        if (doc) return doc as any;
      } catch (err) {
        console.error('[MongoDB getFAQById error]:', err);
      }
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

    if (isDbConfigured()) {
      try {
        await connectToDatabase();
        await FaqModel.findOneAndUpdate(
          { id },
          { $set: newFaq },
          { upsert: true, new: true }
        );
      } catch (err) {
        console.error('[MongoDB saveFAQ error]:', err);
      }
    }
    mockStore.faqs.set(id, newFaq);
    return newFaq;
  },

  async deleteFAQ(id: string): Promise<boolean> {
    if (isDbConfigured()) {
      try {
        await connectToDatabase();
        await FaqModel.deleteOne({ id });
      } catch (err) {
        console.error('[MongoDB deleteFAQ error]:', err);
      }
    }
    mockStore.faqs.delete(id);
    return true;
  }
};
