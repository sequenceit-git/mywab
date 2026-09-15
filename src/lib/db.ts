import { supabase, supabaseAdmin, isSupabaseConfigured } from './supabase/client';
import {
  UserProfile,
  Product,
  FAQ,
  Order,
  Worker,
  OrderAssignment,
  Conversation,
  ConversationSessionState,
  Message,
  Payment,
  OrderStatus
} from '@/types';

const getDbClient = () => supabaseAdmin || supabase;

// Initial Seed Catalog for DS Dukan (PUBG Mobile Top-Up)
const DEFAULT_DS_DUKAN_PRODUCTS: Product[] = [
  { id: 'prod-uc-60', sku: 'PUBG-UC-60', name_en: '60 UC', name_bn: '৬০ ইউসি (60 UC)', description_en: 'Direct In-Game Top-Up via Player UID', description_bn: 'শুধুমাত্র Player UID দিয়ে সরাসরি টপ-আপ', price: 115, stock_qty: 9999, category: 'PUBG UC', is_active: true, created_at: new Date().toISOString() },
  { id: 'prod-uc-120', sku: 'PUBG-UC-120', name_en: '120 UC', name_bn: '১২০ ইউসি (120 UC)', description_en: 'Direct In-Game Top-Up via Player UID', description_bn: 'শুধুমাত্র Player UID দিয়ে সরাসরি টপ-আপ', price: 230, stock_qty: 9999, category: 'PUBG UC', is_active: true, created_at: new Date().toISOString() },
  { id: 'prod-uc-180', sku: 'PUBG-UC-180', name_en: '180 UC', name_bn: '১৮০ ইউসি (180 UC)', description_en: 'Direct In-Game Top-Up via Player UID', description_bn: 'শুধুমাত্র Player UID দিয়ে সরাসরি টপ-আপ', price: 340, stock_qty: 9999, category: 'PUBG UC', is_active: true, created_at: new Date().toISOString() },
  { id: 'prod-uc-325', sku: 'PUBG-UC-325', name_en: '325 UC', name_bn: '৩২৫ ইউসি (325 UC)', description_en: 'Direct In-Game Top-Up via Player UID', description_bn: 'শুধুমাত্র Player UID দিয়ে সরাসরি টপ-আপ', price: 600, stock_qty: 9999, category: 'PUBG UC', is_active: true, created_at: new Date().toISOString() },
  { id: 'prod-uc-385', sku: 'PUBG-UC-385', name_en: '385 UC [50 RP]', name_bn: '৩৮৫ ইউসি [50 RP]', description_en: 'Royale Pass 50 RP Bundle via Player UID', description_bn: 'রয়্যাল পাস ৫০ আরপি বান্ডেল', price: 710, stock_qty: 9999, category: 'PUBG UC', is_active: true, created_at: new Date().toISOString() },
  { id: 'prod-uc-660', sku: 'PUBG-UC-660', name_en: '660 UC', name_bn: '৬৬০ ইউসি (660 UC)', description_en: 'Direct In-Game Top-Up via Player UID', description_bn: 'শুধুমাত্র Player UID দিয়ে সরাসরি টপ-আপ', price: 1150, stock_qty: 9999, category: 'PUBG UC', is_active: true, created_at: new Date().toISOString() },
  { id: 'prod-uc-720', sku: 'PUBG-UC-720', name_en: '720 UC [100 RP]', name_bn: '৭২০ ইউসি [100 RP]', description_en: 'Elite Royale Pass 100 RP Bundle via Player UID', description_bn: 'এলিট রয়্যাল পাস ১০০ আরপি বান্ডেল', price: 1250, stock_qty: 9999, category: 'PUBG UC', is_active: true, created_at: new Date().toISOString() },
  { id: 'prod-uc-1045', sku: 'PUBG-UC-1045', name_en: '1045 UC', name_bn: '১০৪৫ ইউসি (1045 UC)', description_en: 'Direct In-Game Top-Up via Player UID', description_bn: 'শুধুমাত্র Player UID দিয়ে সরাসরি টপ-আপ', price: 1850, stock_qty: 9999, category: 'PUBG UC', is_active: true, created_at: new Date().toISOString() },
  { id: 'prod-uc-1800', sku: 'PUBG-UC-1800', name_en: '1800 UC', name_bn: '১৮০০ ইউসি (1800 UC)', description_en: 'Contact Admin for custom rate', description_bn: 'দাম জানতে সরাসরি ইনবক্সে বলুন', price: 3150, stock_qty: 9999, category: 'PUBG UC', is_active: true, created_at: new Date().toISOString() },
  { id: 'prod-uc-3850', sku: 'PUBG-UC-3850', name_en: '3850 UC', name_bn: '৩৮৫০ ইউসি (3850 UC)', description_en: 'Contact Admin for custom rate', description_bn: 'দাম জানতে সরাসরি ইনবক্সে বলুন', price: 6500, stock_qty: 9999, category: 'PUBG UC', is_active: true, created_at: new Date().toISOString() },
  { id: 'prod-uc-8100', sku: 'PUBG-UC-8100', name_en: '8100 UC', name_bn: '৮১০০ ইউসি (8100 UC)', description_en: 'Contact Admin for custom rate', description_bn: 'দাম জানতে সরাসরি ইনবক্সে বলুন', price: 13500, stock_qty: 9999, category: 'PUBG UC', is_active: true, created_at: new Date().toISOString() },
  
  // Growth Packs
  { id: 'prod-gp-1', sku: 'PUBG-GP-1', name_en: 'Growth Pack 1', name_bn: 'গ্রোথ প্যাক ১ (Growth Pack 1)', description_en: 'Only Player UID needed', description_bn: 'শুধুমাত্র Player UID প্রয়োজন', price: 150, stock_qty: 9999, category: 'Growth Pack', is_active: true, created_at: new Date().toISOString() },
  { id: 'prod-gp-2', sku: 'PUBG-GP-2', name_en: 'Growth Pack 2', name_bn: 'গ্রোথ প্যাক ২ (Growth Pack 2)', description_en: 'Only Player UID needed', description_bn: 'শুধুমাত্র Player UID প্রয়োজন', price: 390, stock_qty: 9999, category: 'Growth Pack', is_active: true, created_at: new Date().toISOString() },
  { id: 'prod-gp-3', sku: 'PUBG-GP-3', name_en: 'Growth Pack 3', name_bn: 'গ্রোথ প্যাক ৩ (Growth Pack 3)', description_en: 'Only Player UID needed', description_bn: 'শুধুমাত্র Player UID প্রয়োজন', price: 590, stock_qty: 9999, category: 'Growth Pack', is_active: true, created_at: new Date().toISOString() },

  // Prime Subscriptions
  { id: 'prod-prime-1m', sku: 'PUBG-PRIME-1M', name_en: 'Prime 1 Month', name_bn: 'প্রাইম ১ মাস (Prime 1 Month)', description_en: 'Only Player UID needed', description_bn: 'শুধুমাত্র Player UID প্রয়োজন', price: 150, stock_qty: 9999, category: 'Subscription', is_active: true, created_at: new Date().toISOString() },
  { id: 'prod-primeplus-1m', sku: 'PUBG-PRIMEPLUS-1M', name_en: 'Prime Plus 1 Month', name_bn: 'প্রাইম প্লাস ১ মাস (Prime Plus 1 Month)', description_en: 'Only Player UID needed', description_bn: 'শুধুমাত্র Player UID প্রয়োজন', price: 1150, stock_qty: 9999, category: 'Subscription', is_active: true, created_at: new Date().toISOString() }
];

const DEFAULT_DS_DUKAN_FAQS: FAQ[] = [
  {
    id: 'faq-1',
    question_en: 'UC price list / Regular UC list',
    question_bn: 'ইউসি প্রাইস লিস্ট / ইউসির দাম কত?',
    answer_en: 'Regular UC: 60 UC: 115 Tk, 120 UC: 230 Tk, 180 UC: 340 Tk, 325 UC: 600 Tk, 385 UC [50 RP]: 710 Tk, 660 UC: 1150 Tk, 720 UC [100 RP]: 1250 Tk, 1045 UC: 1850 Tk. Website gets 2% instant discount!',
    answer_bn: '✅ NEW UPDATED REGULAR UC LIST:\n• 60 UC : 115 Tk\n• 120 UC : 230 Tk\n• 180 UC : 340 Tk\n• 325 UC : 600 Tk\n• 385 UC [50 RP] : 710 Tk\n• 660 UC : 1150 Tk\n• 720 UC [100 RP] : 1250 Tk\n• 1045 UC : 1850 Tk\n• 1800/3850/8100 UC : লাইভ রেট জানতে ইনবক্স করুন\n🎁 ওয়েবসাইট (https://www.dsdukan.com/#) থেকে কিনলে পাচ্ছেন ২% ইনস্ট্যান্ট ডিসকাউন্ট!',
    category: 'Pricing & UC',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'faq-2',
    question_en: '60 uc koto tk / 60 uc price',
    question_bn: '৬০ ইউসি কত টাকা? / 60 UC দাম কত?',
    answer_en: '60 UC price is 115 Tk BDT. Only PUBG Player UID needed.',
    answer_bn: '🎮 ৬০ ইউসি (60 UC) এর দাম মাত্র ১১৫ টাকা (115 Tk)। ডেলিভারি ৫-১৫ মিনিট, শুধুমাত্র Player UID প্রয়োজন।',
    category: 'Pricing & UC',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'faq-3',
    question_en: '325 uc koto tk / 325 uc price',
    question_bn: '৩২৫ ইউসি কত টাকা? / 325 UC দাম কত?',
    answer_en: '325 UC price is 600 Tk BDT. Only PUBG Player UID needed.',
    answer_bn: '🎮 ৩২৫ ইউসি (325 UC) এর দাম মাত্র ৬০০ টাকা (600 Tk)। শুধুমাত্র আপনার Player UID লাগবে।',
    category: 'Pricing & UC',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'faq-4',
    question_en: 'Prime koto tk / Prime Plus koto tk / Prime subscription',
    question_bn: 'প্রাইম কত টাকা? / প্রাইম প্লাস কত টাকা?',
    answer_en: 'Prime (1 Month): 150 Tk, Prime Plus (1 Month): 1150 Tk. Only Player UID needed!',
    answer_bn: '👑 PUBG MOBILE PRIME SUBSCRIPTION:\n• Prime (1 Month): ১৫০ টাকা (150 Tk)\n• Prime Plus (1 Month): ১১৫০ টাকা (1150 Tk)\n📌 কোনো আইডি পাসওয়ার্ড লাগবে না, শুধুমাত্র Player UID প্রয়োজন।',
    category: 'Subscriptions',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'faq-5',
    question_en: 'Bhai acen / Vai / Line a acen / Hlw / Hello / Hi',
    question_bn: 'ভাই আছেন? / লাইনে আছেন? / হ্যালো / হাই',
    answer_en: 'Hello! Yes, DS Dukan is online and active 24/7. How can we help you with PUBG UC or top-up today?',
    answer_bn: '👋 আসসালামু আলাইকুম! জি ভাইয়া, আমরা লাইনে আছি এবং সম্পূর্ণ অ্যাক্টিভ আছি। আপনাকে কীভাবে সাহায্য করতে পারি? কত ইউসি বা কোন প্যাকেজটি নিতে চান?',
    category: 'Greetings',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'faq-6',
    question_en: 'Uc nibo vaiya / UC kinbo / How to order UC',
    question_bn: 'ইউসি নিব ভাইয়া / ইউসি কিনতে চাই / কীভাবে কিনব?',
    answer_en: 'To buy UC, just tell us which package you want and provide your PUBG Player UID. Then send payment to bKash/Nagad/Rocket and share the TrxID!',
    answer_bn: '🎮 ইউসি নিতে আপনার কাঙ্ক্ষিত প্যাকেজের নাম (যেমন: ৬০ ইউসি, ৩৮৫ ইউসি, ৬৬০ ইউসি) এবং আপনার Player UID লিখে জানান। এরপর আমাদের বিকাশ/নগদ/রকেট নাম্বারে টাকা পাঠিয়ে TrxID দিলে ৫-১৫ মিনিটে টপ-আপ হয়ে যাবে!',
    category: 'Ordering',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'faq-7',
    question_en: 'Login uc list / ID password uc',
    question_bn: 'লগইন ইউসি আছে কি? / আইডি পাসওয়ার্ড লাগবে?',
    answer_en: 'We only provide 100% safe direct In-Game Top-Up using PUBG Player UID. No login access or password is ever required!',
    answer_bn: '🔒 আমরা ১০০% নিরাপদ উপায়ে শুধুমাত্র আপনার Player UID দিয়ে ইন-গেম টপ-আপ করে থাকি। কোনো আইডি-পাসওয়ার্ড বা লগইন এক্সেসের কোনো প্রয়োজন নেই!',
    category: 'Security & Policy',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'faq-8',
    question_en: 'Website a order korci / Website order Delivery Time / Delivery dite koto somoi lagbe',
    question_bn: 'ওয়েবসাইটে অর্ডার করেছি / ডেলিভারি দিতে কত সময় লাগবে?',
    answer_en: 'Delivery time is 5 to 15 minutes. If you ordered on the website (https://www.dsdukan.com/#), please share your Order ID / UID here for instant tracking!',
    answer_bn: '⚡ আমাদের ডেলিভারি সময় সাধারণত ৫ থেকে ১৫ মিনিট (5-15 Minutes)। আপনি যদি ওয়েবসাইটে (https://www.dsdukan.com/#) অর্ডার করে থাকেন, তাহলে আপনার Order ID অথবা Player UID-টি এখানে দিন, আমরা সাথে সাথে চেক করে ডেলিভারি নিশ্চিত করছি!',
    category: 'Delivery & Website',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'faq-9',
    question_en: 'Payment number / bKash Nagad Rocket number',
    question_bn: 'পেমেন্ট নাম্বার কি? / বিকাশ নগদ রকেট নাম্বার',
    answer_en: 'bKash (Personal): 01872239597, Rocket (Personal): 01872239597, Nagad (Personal): 01330719250.',
    answer_bn: '💳 DS Dukan পেমেন্ট নাম্বারসমূহ (Personal):\n• BKASH: 01872239597\n• ROCKET: 01872239597\n• NAGAD: 01330719250\n(Send Money বা Cash In করে TrxID বা লাস্ট ৪ সংখ্যা পাঠান)',
    category: 'Payment',
    is_active: true,
    created_at: new Date().toISOString()
  }
];

// Clean in-memory fallback store used only when Supabase is not configured
class MockDatabaseStore {
  users: Map<string, UserProfile> = new Map();
  products: Map<string, Product> = new Map();
  faqs: Map<string, FAQ> = new Map();
  orders: Map<string, Order> = new Map();
  workers: Map<string, Worker> = new Map();
  assignments: Map<string, OrderAssignment> = new Map();
  conversations: Map<string, Conversation> = new Map();
  messages: Map<string, Message> = new Map();
  payments: Map<string, Payment> = new Map();
  sessionStates: Map<string, ConversationSessionState> = new Map();

  constructor() {
    // Seed default products & FAQs
    DEFAULT_DS_DUKAN_PRODUCTS.forEach(p => this.products.set(p.id, p));
    DEFAULT_DS_DUKAN_FAQS.forEach(f => this.faqs.set(f.id, f));
  }
}

// Global Singleton for in-memory store in dev
const globalForStore = global as unknown as { mockStore?: MockDatabaseStore };
export const mockStore = globalForStore.mockStore || new MockDatabaseStore();
if (process.env.NODE_ENV !== 'production') globalForStore.mockStore = mockStore;

// Central Database Service Facade
export const db = {
  // PRODUCTS
  async getProducts(): Promise<Product[]> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { data, error } = await client
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data && data.length > 0) return data;
      if (error) console.error('Supabase getProducts error:', error);
    }
    return Array.from(mockStore.products.values());
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
    const id = product.id || crypto.randomUUID();
    const newProd: Product = {
      id,
      sku: product.sku || `SKU-${Date.now()}`,
      name_en: product.name_en || '',
      name_bn: product.name_bn || '',
      description_en: product.description_en || null,
      description_bn: product.description_bn || null,
      price: Number(product.price) || 0,
      stock_qty: Number(product.stock_qty) || 0,
      category: product.category || 'General',
      is_active: product.is_active !== undefined ? product.is_active : true,
      created_at: new Date().toISOString()
    };

    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { error } = await client.from('products').upsert(newProd);
      if (error) console.error('Supabase saveProduct error:', error);
    } else {
      mockStore.products.set(id, newProd);
    }
    return newProd;
  },

  // FAQS
  async getFAQs(includeInactive = false): Promise<FAQ[]> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      let query = client.from('faqs').select('*').order('created_at', { ascending: true });
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
    const id = faq.id || `faq-${Date.now()}`;
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
  },

  // USERS / CUSTOMERS
  async getOrCreateUser(phone: string, name?: string, address?: string): Promise<UserProfile> {
    const cleanPhone = phone.trim();
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { data } = await client
        .from('users')
        .select('*')
        .eq('phone_number', cleanPhone)
        .single();
      
      if (data) {
        if (name && !data.name) {
          await client.from('users').update({ name, updated_at: new Date().toISOString() }).eq('id', data.id);
        }
        return data;
      }
      const newUser: UserProfile = {
        id: crypto.randomUUID(),
        phone_number: cleanPhone,
        name: name || null,
        address_profile: address ? { full_address: address } : {},
        language_pref: 'bn',
        status_tag: 'REGULAR',
        created_at: new Date().toISOString()
      };
      await client.from('users').insert(newUser);
      return newUser;
    }

    for (const u of mockStore.users.values()) {
      if (u.phone_number === cleanPhone) {
        if (name && !u.name) u.name = name;
        if (address && !u.address_profile.full_address) u.address_profile.full_address = address;
        return u;
      }
    }

    const newUser: UserProfile = {
      id: `user-${Date.now()}`,
      phone_number: cleanPhone,
      name: name || null,
      address_profile: address ? { full_address: address } : {},
      language_pref: 'bn',
      status_tag: 'REGULAR',
      created_at: new Date().toISOString()
    };
    mockStore.users.set(newUser.id, newUser);
    return newUser;
  },

  async getUserById(id: string): Promise<UserProfile | null> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { data } = await client.from('users').select('*').eq('id', id).single();
      if (data) return data;
      return null;
    }
    return mockStore.users.get(id) || null;
  },

  async getAllUsers(): Promise<UserProfile[]> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { data, error } = await client.from('users').select('*').order('created_at', { ascending: false });
      if (!error && data) return data;
      if (error) console.error('Supabase getAllUsers error:', error);
      return [];
    }
    return Array.from(mockStore.users.values());
  },

  // ORDERS
  async createOrder(params: {
    userId: string;
    items: Array<{ product_id?: string; product_name: string; unit_price: number; quantity: number }>;
    deliveryAddress?: { name?: string; phone?: string; address: string; city?: string; area?: string; notes?: string };
    deliveryPhone: string;
    customerNotes?: string | null;
    playerUid?: string;
    trxId?: string;
    paymentMethod?: string;
  }): Promise<Order> {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSeq = Math.floor(1000 + Math.random() * 9000);
    const orderIdCode = `DS-${todayStr}-${randomSeq}`;
    const orderUuid = crypto.randomUUID();

    const totalAmount = params.items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

    const user = await this.getUserById(params.userId);

    const defaultAddress = params.deliveryAddress || {
      name: user?.name || 'Customer',
      phone: params.deliveryPhone,
      address: params.playerUid ? `Player UID: ${params.playerUid}` : 'Digital Delivery',
      player_uid: params.playerUid,
      trx_id: params.trxId,
      payment_method: params.paymentMethod
    };

    const order: Order = {
      id: orderUuid,
      order_id: orderIdCode,
      user_id: params.userId,
      total_amount: totalAmount,
      status: 'PENDING_CLAIM',
      delivery_address: defaultAddress,
      delivery_phone: params.deliveryPhone,
      customer_notes: params.customerNotes || undefined,
      player_uid: params.playerUid || undefined,
      trx_id: params.trxId || undefined,
      payment_method: params.paymentMethod || 'BKASH',
      created_at: new Date().toISOString(),
      customer: user || undefined,
      items: params.items.map((item, idx) => ({
        id: crypto.randomUUID(),
        order_id: orderUuid,
        product_id: item.product_id,
        product_name: item.product_name,
        unit_price: item.unit_price,
        quantity: item.quantity,
        subtotal: item.unit_price * item.quantity
      }))
    };

    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { error: orderErr } = await client.from('orders').insert({
        id: order.id,
        order_id: order.order_id,
        user_id: order.user_id,
        total_amount: order.total_amount,
        status: order.status,
        delivery_address: {
          ...order.delivery_address,
          player_uid: order.player_uid,
          trx_id: order.trx_id,
          payment_method: order.payment_method
        },
        delivery_phone: order.delivery_phone,
        customer_notes: order.customer_notes
      });
      if (orderErr) console.error('Supabase createOrder error:', orderErr);

      if (order.items && order.items.length > 0) {
        const { error: itemErr } = await client.from('order_items').insert(order.items);
        if (itemErr) console.error('Supabase order_items error:', itemErr);
      }
    } else {
      mockStore.orders.set(order.id, order);
    }

    return order;
  },

  async getOrders(): Promise<Order[]> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { data, error } = await client
        .from('orders')
        .select(`
          *,
          customer:users(*),
          items:order_items(*),
          assignments:order_assignments(*, worker:workers(*))
        `)
        .order('created_at', { ascending: false });
      if (!error && data) {
        // Map assignments to current_worker and extract player_uid/trx_id
        return data.map((o: any) => {
          const lastAssignment = o.assignments && o.assignments.length > 0 ? o.assignments[o.assignments.length - 1] : null;
          const uidFromAddress = o.delivery_address?.address?.match(/(?:Player UID|UID)[:\s]+(\d+)/i)?.[1];
          return {
            ...o,
            player_uid: o.player_uid || o.delivery_address?.player_uid || uidFromAddress || undefined,
            trx_id: o.trx_id || o.delivery_address?.trx_id || undefined,
            payment_method: o.payment_method || o.delivery_address?.payment_method || 'bKash/Nagad/Rocket',
            current_worker: lastAssignment?.worker || undefined
          };
        });
      }
      if (error) console.error('Supabase getOrders error:', error);
      return [];
    }
    return Array.from(mockStore.orders.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  async getOrderByCode(orderIdCode: string): Promise<Order | null> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { data, error } = await client
        .from('orders')
        .select(`
          *,
          customer:users(*),
          items:order_items(*),
          assignments:order_assignments(*, worker:workers(*))
        `)
        .eq('order_id', orderIdCode)
        .single();
      if (!error && data) {
        const lastAssignment = data.assignments && data.assignments.length > 0 ? data.assignments[data.assignments.length - 1] : null;
        const uidFromAddress = data.delivery_address?.address?.match(/(?:Player UID|UID)[:\s]+(\d+)/i)?.[1];
        return {
          ...data,
          player_uid: data.player_uid || data.delivery_address?.player_uid || uidFromAddress || undefined,
          trx_id: data.trx_id || data.delivery_address?.trx_id || undefined,
          payment_method: data.payment_method || data.delivery_address?.payment_method || 'bKash/Nagad/Rocket',
          current_worker: lastAssignment?.worker || undefined
        };
      }
      return null;
    }
    for (const o of mockStore.orders.values()) {
      if (o.order_id.toLowerCase() === orderIdCode.toLowerCase()) return o;
    }
    return null;
  },

  async getOrdersByPhone(phone: string): Promise<Order[]> {
    const cleanPhone = phone.trim();
    const digitsOnly = cleanPhone.replace(/\D/g, '');
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { data, error } = await client
        .from('orders')
        .select(`
          *,
          customer:users(*),
          items:order_items(*),
          assignments:order_assignments(*, worker:workers(*))
        `)
        .or(`delivery_phone.eq.${cleanPhone},delivery_phone.eq.${digitsOnly},delivery_phone.eq.+${digitsOnly}`)
        .order('created_at', { ascending: false })
        .limit(5);
      if (!error && data) {
        return data.map((o: any) => {
          const lastAssignment = o.assignments && o.assignments.length > 0 ? o.assignments[o.assignments.length - 1] : null;
          const uidFromAddress = o.delivery_address?.address?.match(/(?:Player UID|UID)[:\s]+(\d+)/i)?.[1];
          return {
            ...o,
            player_uid: o.player_uid || o.delivery_address?.player_uid || uidFromAddress || undefined,
            trx_id: o.trx_id || o.delivery_address?.trx_id || undefined,
            payment_method: o.payment_method || o.delivery_address?.payment_method || 'bKash/Nagad/Rocket',
            current_worker: lastAssignment?.worker || undefined
          };
        });
      }
      if (error) console.error('Supabase getOrdersByPhone error:', error);
      return [];
    }
    return Array.from(mockStore.orders.values())
      .filter(o => o.delivery_phone.replace(/\D/g, '') === digitsOnly)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  // ATOMIC ORDER CLAIM (Double-Claim Prevention)
  async claimOrderAtomic(params: {
    orderIdCode: string;
    telegramUserId: number;
    workerName: string;
    telegramUsername?: string;
  }): Promise<{ success: boolean; message: string; order?: Order; worker?: Worker }> {
    const { orderIdCode, telegramUserId, workerName, telegramUsername } = params;

    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      // 1. Try Supabase RPC Stored Procedure first
      try {
        const { data, error } = await client.rpc('claim_order_atomic', {
          p_order_id_code: orderIdCode,
          p_telegram_user_id: telegramUserId,
          p_worker_name: workerName,
          p_telegram_username: telegramUsername || ''
        });

        if (!error && data && data.success) {
          const fullOrder = await this.getOrderByCode(orderIdCode);
          return { success: true, message: data.message, order: fullOrder || undefined };
        }
        if (data && !data.success && data.message && data.message.includes('already claimed')) {
          return { success: false, message: data.message };
        }
        console.warn('Supabase RPC claim_order_atomic warning/missing, attempting direct query fallback:', error || data);
      } catch (rpcErr) {
        console.warn('Supabase RPC claim_order_atomic threw exception, running direct query fallback:', rpcErr);
      }

      // 2. Direct Supabase Query Fallback
      try {
        // A. Ensure worker exists or register/update
        let workerId: string | null = null;
        let workerObj: Worker | undefined;

        const { data: existingWorker } = await client
          .from('workers')
          .select('*')
          .eq('telegram_user_id', telegramUserId)
          .maybeSingle();

        if (existingWorker) {
          workerId = existingWorker.id;
          workerObj = existingWorker;
          await client
            .from('workers')
            .update({
              full_name: workerName,
              telegram_username: telegramUsername || existingWorker.telegram_username
            })
            .eq('id', existingWorker.id);
        } else {
          const newWorker = {
            id: crypto.randomUUID(),
            telegram_user_id: telegramUserId,
            telegram_username: telegramUsername || null,
            full_name: workerName,
            role: 'WORKER',
            is_active: true,
            created_at: new Date().toISOString()
          };
          const { data: insertedWorker } = await client
            .from('workers')
            .insert(newWorker)
            .select('*')
            .single();

          if (insertedWorker) {
            workerId = insertedWorker.id;
            workerObj = insertedWorker;
          } else {
            workerId = newWorker.id;
            workerObj = newWorker as Worker;
          }
        }

        // B. Fetch order
        const { data: orderData, error: orderErr } = await client
          .from('orders')
          .select('*')
          .eq('order_id', orderIdCode)
          .single();

        if (orderErr || !orderData) {
          return { success: false, message: 'Order not found in database' };
        }

        // Allow claim if PENDING_CLAIM or PENDING_PAYMENT
        if (orderData.status !== 'PENDING_CLAIM' && orderData.status !== 'PENDING_PAYMENT') {
          // Check if already claimed by this same worker
          const { data: lastAssign } = await client
            .from('order_assignments')
            .select('*, worker:workers(*)')
            .eq('order_id', orderData.id)
            .order('claimed_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lastAssign?.worker_id === workerId || lastAssign?.worker?.telegram_user_id === telegramUserId) {
            const fullOrder = await this.getOrderByCode(orderIdCode);
            return {
              success: true,
              message: `You have already claimed order #${orderIdCode}`,
              order: fullOrder || undefined,
              worker: workerObj
            };
          }

          return {
            success: false,
            message: `Order is already in status: ${orderData.status}`
          };
        }

        // C. Update order status to CLAIMED
        await client
          .from('orders')
          .update({ status: 'CLAIMED', updated_at: new Date().toISOString() })
          .eq('id', orderData.id);

        // D. Insert assignment
        if (workerId) {
          await client
            .from('order_assignments')
            .insert({
              id: crypto.randomUUID(),
              order_id: orderData.id,
              worker_id: workerId,
              status: 'CLAIMED',
              claimed_at: new Date().toISOString()
            });
        }

        const fullOrder = await this.getOrderByCode(orderIdCode);
        return {
          success: true,
          message: `Order claimed successfully by ${workerName}`,
          order: fullOrder || undefined,
          worker: workerObj
        };
      } catch (directErr) {
        console.error('Supabase direct order claim error:', directErr);
        return { success: false, message: `Error claiming order: ${String(directErr)}` };
      }
    }

    // In-memory fallback
    const order = await this.getOrderByCode(orderIdCode);
    if (!order) {
      return { success: false, message: 'Order not found' };
    }

    if (order.status !== 'PENDING_CLAIM' && order.status !== 'PENDING_PAYMENT') {
      return {
        success: false,
        message: `Order already claimed or in status: ${order.status}`
      };
    }

    let worker: Worker | undefined;
    for (const w of mockStore.workers.values()) {
      if (w.telegram_user_id === telegramUserId) {
        worker = w;
        break;
      }
    }

    if (!worker) {
      worker = {
        id: `worker-${Date.now()}`,
        telegram_user_id: telegramUserId,
        telegram_username: telegramUsername || null,
        full_name: workerName,
        role: 'WORKER',
        is_active: true,
        created_at: new Date().toISOString(),
        total_completed_orders: 0,
        active_orders: 1
      };
      mockStore.workers.set(worker.id, worker);
    } else {
      worker.active_orders = (worker.active_orders || 0) + 1;
    }

    order.status = 'CLAIMED';
    order.updated_at = new Date().toISOString();
    order.current_worker = worker;

    const assignment: OrderAssignment = {
      id: `assign-${Date.now()}`,
      order_id: order.id,
      worker_id: worker.id,
      status: 'CLAIMED',
      claimed_at: new Date().toISOString(),
      worker: worker
    };

    if (!order.assignments) order.assignments = [];
    order.assignments.push(assignment);
    mockStore.assignments.set(assignment.id, assignment);

    return {
      success: true,
      message: `Order claimed successfully by ${workerName}`,
      order,
      worker
    };
  },

  async updateOrderStatus(orderIdCode: string, status: OrderStatus, workerTelegramId?: number): Promise<{ success: boolean; order?: Order }> {
    const order = await this.getOrderByCode(orderIdCode);
    if (!order) return { success: false };

    order.status = status;
    order.updated_at = new Date().toISOString();

    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      await client
        .from('orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('order_id', orderIdCode);
      
      if (status === 'DELIVERED') {
        await client
          .from('order_assignments')
          .update({ status: 'DELIVERED', completed_at: new Date().toISOString() })
          .eq('order_id', order.id);
      }
    }

    return { success: true, order };
  },

  async updateOrderTelegramMessageId(orderIdCodeOrId: string, messageId: number | null): Promise<void> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      await client
        .from('orders')
        .update({ telegram_message_id: messageId, updated_at: new Date().toISOString() })
        .or(`id.eq.${orderIdCodeOrId},order_id.eq.${orderIdCodeOrId}`);
    }

    for (const o of mockStore.orders.values()) {
      if (o.id === orderIdCodeOrId || o.order_id.toLowerCase() === orderIdCodeOrId.toLowerCase()) {
        o.telegram_message_id = messageId;
        break;
      }
    }
  },

  // WORKERS
  async getWorkers(): Promise<Worker[]> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      try {
        const { data: workers, error } = await client
          .from('workers')
          .select(`
            *,
            assignments:order_assignments(
              id,
              status,
              order:orders(id, status)
            )
          `)
          .order('created_at', { ascending: false });

        if (!error && workers) {
          return workers.map((w: any) => {
            const assignments = Array.isArray(w.assignments) ? w.assignments : [];
            const activeCount = assignments.filter((a: any) => {
              const currentStatus = a.order?.status || a.status;
              return ['CLAIMED', 'PROCESSING', 'OUT_FOR_DELIVERY'].includes(currentStatus);
            }).length;

            const completedCount = assignments.filter((a: any) => {
              const currentStatus = a.order?.status || a.status;
              return currentStatus === 'DELIVERED';
            }).length;

            return {
              id: w.id,
              telegram_user_id: w.telegram_user_id,
              telegram_username: w.telegram_username,
              full_name: w.full_name,
              phone_number: w.phone_number,
              role: w.role,
              is_active: w.is_active,
              created_at: w.created_at,
              active_orders: activeCount,
              total_completed_orders: completedCount
            };
          });
        }
        if (error) console.error('Supabase getWorkers join error, falling back:', error);

        // Fallback aggregation
        const { data: baseWorkers } = await client.from('workers').select('*').order('created_at', { ascending: false });
        const { data: allAssignments } = await client.from('order_assignments').select('*');
        if (baseWorkers) {
          return baseWorkers.map((w: any) => {
            const wAssignments = (allAssignments || []).filter((a: any) => a.worker_id === w.id);
            const activeCount = wAssignments.filter((a: any) => ['CLAIMED', 'PROCESSING', 'OUT_FOR_DELIVERY'].includes(a.status)).length;
            const completedCount = wAssignments.filter((a: any) => a.status === 'DELIVERED').length;
            return {
              ...w,
              active_orders: activeCount,
              total_completed_orders: completedCount
            };
          });
        }
      } catch (err) {
        console.error('Supabase getWorkers error:', err);
      }
      return [];
    }

    const orders = Array.from(mockStore.orders.values());
    const workers = Array.from(mockStore.workers.values());
    return workers.map(w => {
      const workerOrders = orders.filter(o => 
        o.current_worker?.id === w.id || 
        o.current_worker?.telegram_user_id === w.telegram_user_id ||
        o.assignments?.some(a => a.worker_id === w.id || a.worker?.telegram_user_id === w.telegram_user_id)
      );
      const activeCount = workerOrders.filter(o => ['CLAIMED', 'PROCESSING', 'OUT_FOR_DELIVERY'].includes(o.status)).length;
      const completedCount = workerOrders.filter(o => o.status === 'DELIVERED').length;
      return {
        ...w,
        active_orders: activeCount,
        total_completed_orders: completedCount
      };
    });
  },

  // CONVERSATIONS & CHAT
  getSessionState(conversationId: string): ConversationSessionState {
    const defaultState: ConversationSessionState = {
      step: 'IDLE',
      draftOrder: { items: [] },
      lastInteractionTimestamp: Date.now()
    };

    const existing = mockStore.sessionStates.get(conversationId);
    if (!existing) {
      mockStore.sessionStates.set(conversationId, defaultState);
      return defaultState;
    }

    // TTL check: 30 minutes of inactivity resets draft
    const thirtyMinutes = 30 * 60 * 1000;
    if (Date.now() - existing.lastInteractionTimestamp > thirtyMinutes) {
      mockStore.sessionStates.set(conversationId, defaultState);
      return defaultState;
    }

    return existing;
  },

  setSessionState(conversationId: string, stateUpdate: Partial<ConversationSessionState>): ConversationSessionState {
    const current = this.getSessionState(conversationId);
    const updated: ConversationSessionState = {
      ...current,
      ...stateUpdate,
      draftOrder: {
        ...current.draftOrder,
        ...(stateUpdate.draftOrder || {})
      },
      lastInteractionTimestamp: Date.now()
    };
    mockStore.sessionStates.set(conversationId, updated);
    return updated;
  },

  clearSessionDraft(conversationId: string, lastOrderId?: string): ConversationSessionState {
    const updated: ConversationSessionState = {
      step: lastOrderId ? 'ORDER_PLACED' : 'IDLE',
      draftOrder: { items: [] },
      lastOrderId: lastOrderId || undefined,
      lastInteractionTimestamp: Date.now()
    };
    mockStore.sessionStates.set(conversationId, updated);
    return updated;
  },

  async getConversations(): Promise<Conversation[]> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { data, error } = await client
        .from('conversations')
        .select('*, user:users(*), messages(*)')
        .order('last_message_at', { ascending: false });
      if (!error && data) {
        return data.map((c: any) => ({
          ...c,
          session_state: this.getSessionState(c.id),
          messages: Array.isArray(c.messages)
            ? c.messages.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            : []
        }));
      }
      if (error) console.error('Supabase getConversations error:', error);
      return [];
    }
    return Array.from(mockStore.conversations.values()).map(c => ({
      ...c,
      session_state: this.getSessionState(c.id),
      messages: Array.from(mockStore.messages.values())
        .filter(m => m.conversation_id === c.id)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    }));
  },

  async getOrCreateConversation(userId: string): Promise<Conversation> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { data } = await client
        .from('conversations')
        .select('*, user:users(*), messages(*)')
        .eq('user_id', userId)
        .single();
      if (data) {
        return {
          ...data,
          session_state: this.getSessionState(data.id),
          messages: Array.isArray(data.messages)
            ? data.messages.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            : []
        };
      }

      const newConv: Conversation = {
        id: crypto.randomUUID(),
        user_id: userId,
        channel: 'WHATSAPP',
        is_ai_active: true,
        last_message_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      };
      await client.from('conversations').insert(newConv);
      newConv.session_state = this.getSessionState(newConv.id);
      return newConv;
    }

    for (const c of mockStore.conversations.values()) {
      if (c.user_id === userId) {
        return {
          ...c,
          session_state: this.getSessionState(c.id),
          messages: Array.from(mockStore.messages.values())
            .filter(m => m.conversation_id === c.id)
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        };
      }
    }

    const newConv: Conversation = {
      id: `conv-${Date.now()}`,
      user_id: userId,
      channel: 'WHATSAPP',
      is_ai_active: true,
      last_message_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      user: mockStore.users.get(userId),
      session_state: this.getSessionState(`conv-${Date.now()}`)
    };
    mockStore.conversations.set(newConv.id, newConv);
    return newConv;
  },

  async addMessage(conversationId: string, sender: 'CUSTOMER' | 'BOT' | 'ADMIN', content: string): Promise<Message> {
    const msgId = crypto.randomUUID();
    const now = new Date().toISOString();

    const msg: Message = {
      id: msgId,
      conversation_id: conversationId,
      sender,
      content,
      created_at: now
    };

    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      await client.from('messages').insert({
        id: msg.id,
        conversation_id: msg.conversation_id,
        sender: msg.sender,
        content: msg.content
      });
      await client.from('conversations').update({ last_message_at: now }).eq('id', conversationId);
    } else {
      const conv = mockStore.conversations.get(conversationId);
      if (conv) conv.last_message_at = now;
      mockStore.messages.set(msg.id, msg);
    }

    return msg;
  },

  async setAiMode(conversationId: string, isAiActive: boolean): Promise<boolean> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      await client.from('conversations').update({ is_ai_active: isAiActive }).eq('id', conversationId);
      return true;
    }
    const conv = mockStore.conversations.get(conversationId);
    if (conv) {
      conv.is_ai_active = isAiActive;
      return true;
    }
    return false;
  },

  // ANALYTICS
  async getDashboardAnalytics() {
    const orders = await this.getOrders();
    const workers = await this.getWorkers();
    const users = await this.getAllUsers();

    const totalRevenue = orders
      .filter(o => o.status !== 'CANCELLED')
      .reduce((sum, o) => sum + Number(o.total_amount), 0);

    const pendingClaimCount = orders.filter(o => o.status === 'PENDING_CLAIM').length;
    const activeProcessingCount = orders.filter(o => ['CLAIMED', 'PROCESSING', 'OUT_FOR_DELIVERY'].includes(o.status)).length;
    const completedCount = orders.filter(o => o.status === 'DELIVERED').length;

    return {
      totalRevenue,
      totalOrders: orders.length,
      pendingClaimCount,
      activeProcessingCount,
      completedCount,
      totalCustomers: users.length,
      activeWorkers: workers.filter(w => w.is_active).length,
      recentOrders: orders.slice(0, 5)
    };
  }
};
