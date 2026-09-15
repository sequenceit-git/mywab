const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Read .env manually
const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const virtualFaqs = [
  {
    id: 'f0000000-0000-4000-8000-000000000001',
    question_en: 'Uc price list / Regular UC list / Rate card',
    question_bn: 'ইউসি প্রাইস লিস্ট / ইউসির দাম কত?',
    answer_en: 'Regular UC: 60 UC: 115 Tk, 120 UC: 230 Tk, 180 UC: 340 Tk, 325 UC: 600 Tk, 385 UC [50 RP]: 710 Tk, 660 UC: 1150 Tk, 720 UC [100 RP]: 1250 Tk, 1045 UC: 1850 Tk. Website gets 2% instant discount!',
    answer_bn: '✅ NEW UPDATED REGULAR UC LIST:\n• 60 UC : 115 Tk\n• 120 UC : 230 Tk\n• 180 UC : 340 Tk\n• 325 UC : 600 Tk\n• 385 UC [50 RP] : 710 Tk\n• 660 UC : 1150 Tk\n• 720 UC [100 RP] : 1250 Tk\n• 1045 UC : 1850 Tk\n• 1800/3850/8100 UC : লাইভ রেট জানতে ইনবক্স করুন\n🎁 ওয়েবসাইট (https://www.dsdukan.com/#) থেকে কিনলে পাচ্ছেন ২% ইনস্ট্যান্ট ডিসকাউন্ট!',
    category: 'Pricing & UC',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'f0000000-0000-4000-8000-000000000002',
    question_en: '60 uc koto tk / 60 uc price',
    question_bn: '৬০ ইউসি কত টাকা? / 60 UC দাম কত?',
    answer_en: '60 UC price is 115 Tk BDT. Only PUBG Player UID needed.',
    answer_bn: '🎮 ৬০ ইউসি (60 UC) এর দাম মাত্র ১১৫ টাকা (115 Tk)। ডেলিভারি সময় ৫–১৫ মিনিট, শুধুমাত্র Player UID প্রয়োজন।',
    category: 'Pricing & UC',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'f0000000-0000-4000-8000-000000000003',
    question_en: '325 uc koto tk / 325 uc price',
    question_bn: '৩২৫ ইউসি কত টাকা? / 325 UC দাম কত?',
    answer_en: '325 UC price is 600 Tk BDT. Only PUBG Player UID needed.',
    answer_bn: '🎮 ৩২৫ ইউসি (325 UC) এর দাম মাত্র ৬০০ টাকা (600 Tk)। শুধুমাত্র আপনার Player UID লাগবে।',
    category: 'Pricing & UC',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'f0000000-0000-4000-8000-000000000004',
    question_en: 'Prime koto tk / Prime Plus koto tk / Prime subscription',
    question_bn: 'প্রাইম কত টাকা? / প্রাইম প্লাস কত টাকা?',
    answer_en: 'Prime (1 Month): 150 Tk, Prime Plus (1 Month): 1150 Tk. Only Player UID needed!',
    answer_bn: '👑 PUBG MOBILE PRIME SUBSCRIPTION:\n• Prime (1 Month): ১৫০ টাকা (150 Tk)\n• Prime Plus (1 Month): ১১৫০ টাকা (1150 Tk)\n📌 কোনো আইডি পাসওয়ার্ড লাগবে না, শুধুমাত্র Player UID প্রয়োজন।',
    category: 'Subscriptions',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'f0000000-0000-4000-8000-000000000005',
    question_en: 'Bhai acen / Vai / Line a acen / Hlw / Hello / Hi',
    question_bn: 'ভাই আছেন? / লাইনে আছেন? / হ্যালো / হাই',
    answer_en: 'Hello! Yes, DS Dukan is online and active 24/7. How can we help you with PUBG UC or top-up today?',
    answer_bn: '👋 আসসালামু আলাইকুম! জি ভাইয়া, আমরা লাইনে আছি এবং সম্পূর্ণ অ্যাক্টিভ আছি। আপনাকে কীভাবে সাহায্য করতে পারি? কত ইউসি বা কোন প্যাকেজটি নিতে চান?',
    category: 'Greetings',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'f0000000-0000-4000-8000-000000000006',
    question_en: 'Uc nibo vaiya / UC kinbo / How to order UC',
    question_bn: 'ইউসি নিব ভাইয়া / ইউসি কিনতে চাই / কীভাবে কিনব?',
    answer_en: 'To buy UC, just tell us which package you want and provide your PUBG Player UID. Then send payment to bKash/Nagad/Rocket and share the TrxID!',
    answer_bn: '🎮 ইউসি নিতে আপনার কাঙ্ক্ষিত প্যাকেজের নাম (যেমন: ৬০ ইউসি, ৩৮৫ ইউসি, ৬৬০ ইউসি) এবং আপনার Player UID লিখে জানান। এরপর আমাদের বিকাশ/নগদ/রকেট নাম্বারে টাকা পাঠিয়ে TrxID দিলে ৫-১৫ মিনিটে টপ-আপ হয়ে যাবে!',
    category: 'Ordering',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'f0000000-0000-4000-8000-000000000007',
    question_en: 'Login uc list / ID password uc / Login top up',
    question_bn: 'লগইন ইউসি আছে কি? / আইডি পাসওয়ার্ড লাগবে?',
    answer_en: 'We only provide 100% safe direct In-Game Top-Up using PUBG Player UID. No login access or password is ever required!',
    answer_bn: '🔒 আমরা ১০০% নিরাপদ উপায়ে শুধুমাত্র আপনার Player UID দিয়ে ইন-গেম টপ-আপ করে থাকি। কোনো আইডি-পাসওয়ার্ড বা লগইন এক্সেসের কোনো প্রয়োজন নেই!',
    category: 'Security & Policy',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'f0000000-0000-4000-8000-000000000008',
    question_en: 'Website a order korci / Website order Delivery Time / Delivery dite koto somoi lagbe',
    question_bn: 'ওয়েবসাইটে অর্ডার করেছি / ডেলিভারি দিতে কত সময় লাগবে?',
    answer_en: 'Delivery time is 5 to 15 minutes. If you ordered on the website (https://www.dsdukan.com/#), please share your Order ID / UID here for instant tracking!',
    answer_bn: '⚡ আমাদের ডেলিভারি সময় সাধারণত ৫ থেকে ১৫ মিনিট (5-15 Minutes)। আপনি যদি ওয়েবসাইটে (https://www.dsdukan.com/#) অর্ডার করে থাকেন, তাহলে আপনার Order ID অথবা Player UID-টি এখানে দিন, আমরা সাথে সাথে চেক করে ডেলিভারি নিশ্চিত করছি!',
    category: 'Delivery & Website',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'f0000000-0000-4000-8000-000000000009',
    question_en: 'Payment number / bKash Nagad Rocket number / Payment accounts',
    question_bn: 'পেমেন্ট নাম্বার কি? / বিকাশ নগদ রকেট নাম্বার',
    answer_en: 'bKash (Personal): 01872239597, Rocket (Personal): 01872239597, Nagad (Personal): 01330719250.',
    answer_bn: '💳 DS Dukan পেমেন্ট নাম্বারসমূহ (Personal):\n• BKASH: 01872239597\n• ROCKET: 01872239597\n• NAGAD: 01330719250\n(Send Money বা Cash In করে TrxID বা লাস্ট ৪ সংখ্যা পাঠান)',
    category: 'Payment',
    is_active: true,
    created_at: new Date().toISOString()
  }
];

async function syncFaqs() {
  console.log('Clearing legacy clothing/physical FAQs from Supabase...');
  const { error: delErr } = await supabase.from('faqs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delErr) {
    console.error('Delete error:', delErr);
  } else {
    console.log('Successfully cleared legacy FAQs from Supabase.');
  }

  console.log('Upserting 9 new virtual PUBG UC FAQs...');
  const { data: inserted, error: insErr } = await supabase.from('faqs').upsert(virtualFaqs).select();
  if (insErr) {
    console.error('Insert error:', insErr);
  } else {
    console.log('Successfully inserted', inserted.length, 'virtual PUBG FAQs into Supabase!');
    inserted.forEach(f => console.log(`✅ [${f.category}] ${f.question_bn} (${f.question_en})`));
  }
}

syncFaqs();
