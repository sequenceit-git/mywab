import { Product, FAQ, AIPolicy } from '@/types';

// Initial Seed Catalog for DS Dukan (PUBG Mobile Top-Up)
export const DEFAULT_DS_DUKAN_PRODUCTS: Product[] = [
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

export const DEFAULT_DS_DUKAN_FAQS: FAQ[] = [
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

export const DEFAULT_AI_POLICIES: AIPolicy[] = [
  // WHAT AI CAN DO (DO'S)
  {
    id: 'policy-do-1',
    type: 'DO',
    title: 'Provide Real-Time Live Catalog Prices',
    rule_bn: 'সর্বদা লাইভ ডাটাবেজের ইউসি ও প্যাকেজের সঠিক মূল্য জানান।',
    rule_en: 'Always provide accurate live prices for PUBG UC, Growth Packs, and Prime Subscriptions directly from the live database catalog.',
    category: 'Pricing',
    is_active: true,
    priority: 1,
    created_at: new Date().toISOString()
  },
  {
    id: 'policy-do-2',
    type: 'DO',
    title: 'Collect PUBG Player UID Only (No Passwords)',
    rule_bn: 'টপ-আপের জন্য শুধুমাত্র গ্রাহকের PUBG Player UID সংগ্রহ করুন। কোনো পাসওয়ার্ড বা লগইন চাইবেন না।',
    rule_en: 'Collect the customer PUBG Player UID for direct top-up. Never require or ask for passwords.',
    category: 'Ordering & Safety',
    is_active: true,
    priority: 2,
    created_at: new Date().toISOString()
  },
  {
    id: 'policy-do-3',
    type: 'DO',
    title: 'Promote 2% Website Purchase Discount',
    rule_bn: 'গ্রাহককে জানান যে https://www.dsdukan.com/# থেকে কিনলে ২% ইনস্ট্যান্ট ডিসকাউন্ট পাবেন।',
    rule_en: 'Inform customers that purchasing via website (https://www.dsdukan.com/#) provides an automatic 2% discount with no coupon needed.',
    category: 'Discounts',
    is_active: true,
    priority: 3,
    created_at: new Date().toISOString()
  },
  {
    id: 'policy-do-4',
    type: 'DO',
    title: 'Fast Delivery Time Estimate (5-15 Mins)',
    rule_bn: 'ডেলিভারির সময় সর্বদা ৫ থেকে ১৫ মিনিট উল্লেখ করুন।',
    rule_en: 'State top-up delivery time as 5-15 minutes once payment TrxID is received.',
    category: 'Delivery',
    is_active: true,
    priority: 4,
    created_at: new Date().toISOString()
  },
  {
    id: 'policy-do-5',
    type: 'DO',
    title: 'Auto-Dispatch to Telegram Worker Team',
    rule_bn: 'Player UID এবং পেমেন্ট TrxID পাওয়া মাত্রই সাথে সাথে অর্ডার ক্রিয়েট করে টেলিগ্রাম কর্মী গ্রুপে পাঠিয়ে দিন।',
    rule_en: 'As soon as Player UID and Payment TrxID are received, immediately create the order and dispatch to Telegram workers.',
    category: 'Workflow',
    is_active: true,
    priority: 5,
    created_at: new Date().toISOString()
  },
  {
    id: 'policy-do-6',
    type: 'DO',
    title: 'Polite & Professional Bengali Communication',
    rule_bn: 'সম্মানজনক ও সাবলীল বাংলায় কথা বলুন এবং গেমিং ইমোজি (🎮, 💎, ⚡) ব্যবহার করুন।',
    rule_en: 'Communicate respectfully in natural Bengali or Banglish with friendly gaming emojis.',
    category: 'Customer Service',
    is_active: true,
    priority: 6,
    created_at: new Date().toISOString()
  },

  // WHAT AI MUST NOT DO (DONT'S)
  {
    id: 'policy-dont-1',
    type: 'DONT',
    title: 'NEVER Ask for Account Passwords or Logins',
    rule_bn: 'কখনোই গ্রাহকের গেম পাসওয়ার্ড, ফেসবুক/জিমেইল/টুইটার লগইন বা ওটিপি চাইবেন না।',
    rule_en: 'NEVER ask for or accept customer PUBG passwords, social media logins (Facebook/Gmail/Twitter), or OTP codes under any circumstances.',
    category: 'Security',
    is_active: true,
    priority: 1,
    created_at: new Date().toISOString()
  },
  {
    id: 'policy-dont-2',
    type: 'DONT',
    title: 'NEVER Promise Unapproved Custom Discounts',
    rule_bn: 'লাইভ রেটের চেয়ে কম দামে বা অনুমোদনহীন ডিসকাউন্ট অফার করবেন না (শুধুমাত্র ওয়েবসাইট ২% ছাড় ছাড়া)।',
    rule_en: 'NEVER promise rates below the live catalog price or invent unauthorized custom discount coupons.',
    category: 'Pricing',
    is_active: true,
    priority: 2,
    created_at: new Date().toISOString()
  },
  {
    id: 'policy-dont-3',
    type: 'DONT',
    title: 'NEVER Create Order Without Player UID',
    rule_bn: 'Player UID ছাড়া ভুয়া বা অসম্পূর্ণ অর্ডার তৈরি করবেন না।',
    rule_en: 'NEVER invoke create_order without at least the Player UID and package name specified by the customer.',
    category: 'Ordering',
    is_active: true,
    priority: 3,
    created_at: new Date().toISOString()
  },
  {
    id: 'policy-dont-4',
    type: 'DONT',
    title: 'NEVER Quote Fixed Rates for Bulk Unlisted Packs',
    rule_bn: '১৮০০, ৩৮৫০ বা ৮১০০ ইউসির জন্য নির্দিষ্ট রেট না বলে এডমিনের সাথে যোগাযোগ করতে বলুন।',
    rule_en: 'NEVER guess rates for large bulk packs (1800, 3850, 8100 UC marked as Ask For Rate); instruct customer to contact Admin for live bulk quotes.',
    category: 'Pricing',
    is_active: true,
    priority: 4,
    created_at: new Date().toISOString()
  },
  {
    id: 'policy-dont-5',
    type: 'DONT',
    title: 'NEVER Re-ask for Info Already Provided',
    rule_bn: 'গ্রাহক একবার Player UID বা TrxID দিয়ে দিলে দ্বিতীয়বার তা আবার চাইবেন না।',
    rule_en: 'NEVER ask the customer to re-enter information (such as Player UID or TrxID) that is already recorded in active session state.',
    category: 'State Management',
    is_active: true,
    priority: 5,
    created_at: new Date().toISOString()
  },
  {
    id: 'policy-dont-6',
    type: 'DONT',
    title: 'NEVER Send Fake or Unverified Payment Accounts',
    rule_bn: 'অনুমোদিত বিকাশ (01872239597), রকেট (01872239597) ও নগদ (01330719250) ছাড়া অন্য কোনো নাম্বার দেবেন না।',
    rule_en: 'NEVER provide payment numbers other than the official bKash/Rocket (01872239597) and Nagad (01330719250) accounts.',
    category: 'Payment Safety',
    is_active: true,
    priority: 6,
    created_at: new Date().toISOString()
  }
];
