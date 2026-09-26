import type { PackagePresetAccount } from '@/types';

export interface GamePackage {
  id: string;          // Button/selection ID e.g. 'pkg_pubg_60'
  name: string;        // e.g. '60 UC'
  amount?: string;     // e.g. '60' or '60 UC' or '1 Month'
  price: number;       // Selling price e.g. 115
  basePrice?: number;  // Cost / Wholesale Base Price for profit calculation e.g. 95
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
  /** Server-side only — never exposed on WhatsApp catalog payloads */
  presetAccount?: PackagePresetAccount;
}

export interface GameCategory {
  id: string;          // e.g. 'game_pubg_uid'
  code: string;        // Short code e.g. 'pubg_uid'
  title: string;       // e.g. 'PUBG Mobile — UID'
  fullName: string;    // e.g. 'PUBG MOBILE — UID TOP UP'
  emoji: string;       // e.g. '🎮'
  requiresUid: boolean;
  inputPrompt: string; // What to ask the user for (UID, Email, QR confirmation)
  inputLabel: string;  // e.g. 'Player UID', 'Konami ID / Email', etc.
  packages: GamePackage[];
}

/** Old catalog SKUs replaced by newer packs — hidden from WhatsApp / Pricing lists */
export const RETIRED_PACKAGE_IDS = new Set([
  'pkg_kr_60',
  'pkg_kr_180',
  'pkg_kr_360',
  'pkg_kr_660',
  'pkg_kr_1200',
  'pkg_efb_and_260',
  'pkg_efb_and_1050',
  'pkg_efb_ios_260',
  'pkg_efb_ios_1050'
]);

export const GAME_CATEGORIES: GameCategory[] = [
  {
    id: 'game_pubg_uid',
    code: 'pubg_uid',
    title: 'PUBG — UID TOP UP',
    fullName: 'PUBG MOBILE — UID TOP UP',
    emoji: '🎮',
    requiresUid: true,
    inputLabel: 'Player UID',
    inputPrompt: '🎮 আপনার *PUBG Player UID* টি লিখে পাঠান (যেমন: `5123456789`):',
    packages: [
      { id: 'pkg_pubg_60', name: '60 UC', amount: '60', price: 115, basePrice: 95, description: 'Direct In-Game Top-Up' },
      { id: 'pkg_pubg_120', name: '120 UC', amount: '120', price: 230, basePrice: 190, description: 'Direct In-Game Top-Up' },
      { id: 'pkg_pubg_180', name: '180 UC', amount: '180', price: 340, basePrice: 285, description: 'Direct In-Game Top-Up' },
      { id: 'pkg_pubg_325', name: '325 UC', amount: '325', price: 600, basePrice: 495, description: 'Direct In-Game Top-Up' },
      { id: 'pkg_pubg_385', name: '385 UC [50 RP]', amount: '385', price: 710, basePrice: 590, description: 'Royale Pass 50 RP Pack' },
      { id: 'pkg_pubg_660', name: '660 UC', amount: '660', price: 1150, basePrice: 960, description: 'Direct In-Game Top-Up' },
      { id: 'pkg_pubg_720', name: '720 UC [100 RP]', amount: '720', price: 1250, basePrice: 1040, description: 'Royale Pass 100 RP Pack' },
      { id: 'pkg_pubg_1045', name: '1045 UC', amount: '1045', price: 1850, basePrice: 1550, description: 'Direct In-Game Top-Up' },
      { id: 'pkg_pubg_1800', name: '1800 UC', amount: '1800', price: 3150, basePrice: 2620, description: 'Mega Pack Top-Up' },
      { id: 'pkg_pubg_3850', name: '3850 UC', amount: '3850', price: 6500, basePrice: 5400, description: 'Super Mega Pack' }
    ]
  },
  {
    id: 'game_pubg_login',
    code: 'pubg_login',
    title: 'PUBG — LOGIN UC (QR)',
    fullName: 'PUBG MOBILE — LOGIN UC ( QR )',
    emoji: '📲',
    requiresUid: false,
    inputLabel: 'Game UID / In-Game Name',
    inputPrompt: '📲 আপনার *Game UID / Game ID* এবং *In-Game Name* লিখে পাঠান (টপ-আপের সময় আমাদের এজেন্ট QR কোড দিয়ে লগইন করে দেবেন):',
    packages: [
      { id: 'pkg_login_325', name: '300+25 UC (QR)', amount: '325', price: 520, basePrice: 420, description: 'QR Code Login Top-Up' },
      { id: 'pkg_login_660', name: '600+60 UC (QR)', amount: '660', price: 1000, basePrice: 820, description: 'QR Code Login Top-Up' },
      { id: 'pkg_login_1800', name: '1500+300 UC (QR)', amount: '1800', price: 2450, basePrice: 2000, description: 'QR Code Login Top-Up' },
      { id: 'pkg_login_3850', name: '3000+850 UC (QR)', amount: '3850', price: 4850, basePrice: 3950, description: 'QR Code Login Top-Up' },
      { id: 'pkg_login_8100', name: '6000+2100 UC (QR)', amount: '8100', price: 9400, basePrice: 7700, description: 'QR Code Login Top-Up' },
      { id: 'pkg_spec_1', name: 'Special Pack 1 (QR)', amount: 'Special 1', price: 450, basePrice: 360, description: 'Special Login QR UC' },
      { id: 'pkg_spec_2', name: 'Special Pack 2 (QR)', amount: 'Special 2', price: 890, basePrice: 710, description: 'Special Login QR UC' },
      { id: 'pkg_spec_3', name: 'Special Pack 3 (QR)', amount: 'Special 3', price: 1750, basePrice: 1400, description: 'Special Login QR UC' },
      { id: 'pkg_spec_750', name: 'Special Pack 750+ UC', amount: '750+', price: 1100, basePrice: 900, description: 'Special Login QR UC' },
      { id: 'pkg_spec_2100', name: 'Special Pack 2100+ UC', amount: '2100+', price: 2800, basePrice: 2300, description: 'Special Login QR UC' },
      { id: 'pkg_spec_4100', name: 'Special Pack 4100+ UC', amount: '4100+', price: 5200, basePrice: 4250, description: 'Special Login QR UC' },
      { id: 'pkg_spec_9100', name: 'Special Pack 9100+ UC', amount: '9100+', price: 10800, basePrice: 8800, description: 'Special Login QR UC' }
    ]
  },
  {
    id: 'game_pubg_sub',
    code: 'pubg_sub',
    title: 'PUBG — SUBSCRIPTION',
    fullName: 'PUBG MOBILE — SUBSCRIPTION PACK',
    emoji: '👑',
    requiresUid: true,
    inputLabel: 'Player UID',
    inputPrompt: '👑 আপনার *PUBG Player UID* টি লিখে পাঠান:',
    packages: [
      { id: 'pkg_sub_prime', name: 'Prime 1 Month', amount: 'Prime 1M', price: 150, basePrice: 110, description: 'Instant UID Activation' },
      { id: 'pkg_sub_prime_3m', name: 'Prime 3 Month', amount: 'Prime 3M', price: 420, basePrice: 310, description: 'Instant UID Activation' },
      { id: 'pkg_sub_prime_6m', name: 'Prime 6 Month', amount: 'Prime 6M', price: 800, basePrice: 590, description: 'Instant UID Activation' },
      { id: 'pkg_sub_prime_12m', name: 'Prime 12 Month', amount: 'Prime 12M', price: 1500, basePrice: 1100, description: 'Instant UID Activation' },
      { id: 'pkg_sub_prime_plus', name: 'Prime Plus 1 Month', amount: 'Prime Plus 1M', price: 1150, basePrice: 930, description: 'Instant UID Activation' },
      { id: 'pkg_sub_prime_plus_3m', name: 'Prime Plus 3 Month', amount: 'Prime Plus 3M', price: 3300, basePrice: 2680, description: 'Instant UID Activation' },
      { id: 'pkg_sub_prime_plus_6m', name: 'Prime Plus 6 Month', amount: 'Prime Plus 6M', price: 6200, basePrice: 5050, description: 'Instant UID Activation' },
      { id: 'pkg_sub_prime_plus_12m', name: 'Prime Plus 12 Month', amount: 'Prime Plus 12M', price: 11500, basePrice: 9400, description: 'Instant UID Activation' },
      { id: 'pkg_sub_growth_1', name: 'Growth Pack 1', amount: 'Growth 1', price: 250, basePrice: 180, description: 'Instant UID Activation' },
      { id: 'pkg_sub_growth_2', name: 'Growth Pack 2', amount: 'Growth 2', price: 500, basePrice: 370, description: 'Instant UID Activation' },
      { id: 'pkg_sub_growth_3', name: 'Growth Pack 3', amount: 'Growth 3', price: 900, basePrice: 680, description: 'Instant UID Activation' }
    ]
  },
  {
    id: 'game_pubg_kr',
    code: 'pubg_kr',
    title: 'PUBG KR — KOREAN UC',
    fullName: 'PUBG MOBILE KR — KOREAN UC (UID)',
    emoji: '🇰🇷',
    requiresUid: true,
    inputLabel: 'Player UID',
    inputPrompt: '🇰🇷 আপনার *PUBG Korean (KR) Player UID* টি লিখে পাঠান:',
    packages: [
      { id: 'pkg_kr_375', name: '375 KR UC', amount: '375', price: 700, basePrice: 575, description: 'PUBG KR UID Top-Up' },
      { id: 'pkg_kr_680', name: '680 KR UC', amount: '680', price: 1100, basePrice: 900, description: 'PUBG KR UID Top-Up' },
      { id: 'pkg_kr_1850', name: '1850 KR UC', amount: '1850', price: 2850, basePrice: 2340, description: 'PUBG KR UID Top-Up' },
      { id: 'pkg_kr_2530', name: '2530 KR UC', amount: '2530', price: 3950, basePrice: 3240, description: 'PUBG KR UID Top-Up' },
      { id: 'pkg_kr_3950', name: '3950 KR UC', amount: '3950', price: 5650, basePrice: 4630, description: 'PUBG KR UID Top-Up' },
      { id: 'pkg_kr_5800', name: '5800 KR UC', amount: '5800', price: 8450, basePrice: 6930, description: 'PUBG KR UID Top-Up' },
      { id: 'pkg_kr_8300', name: '8300 KR UC', amount: '8300', price: 10650, basePrice: 8730, description: 'PUBG KR UID Top-Up' }
    ]
  },
  {
    id: 'game_efb_android',
    code: 'efb_android',
    title: 'EFOOTBALL — ANDROID',
    fullName: 'EFOOTBALL — ANDROID COINS',
    emoji: '⚽',
    requiresUid: false,
    inputLabel: 'Konami ID / Email',
    inputPrompt: '⚽ আপনার *Konami ID (Email/Username)* লিখে পাঠান:',
    packages: [
      { id: 'pkg_efb_and_130', name: '130 Coins (Android)', amount: '130', price: 140, basePrice: 110, description: 'Android In-Game Coins' },
      { id: 'pkg_efb_and_300', name: '300 Coins (Android)', amount: '300', price: 320, basePrice: 255, description: 'Android In-Game Coins' },
      { id: 'pkg_efb_and_550', name: '550 Coins (Android)', amount: '550', price: 580, basePrice: 465, description: 'Android In-Game Coins' },
      { id: 'pkg_efb_and_750', name: '750 Coins (Android)', amount: '750', price: 780, basePrice: 625, description: 'Android In-Game Coins' },
      { id: 'pkg_efb_and_1040', name: '1040 Coins (Android)', amount: '1040', price: 1080, basePrice: 870, description: 'Android In-Game Coins' },
      { id: 'pkg_efb_and_2130', name: '2130 Coins (Android)', amount: '2130', price: 2150, basePrice: 1730, description: 'Android In-Game Coins' },
      { id: 'pkg_efb_and_3250', name: '3250 Coins (Android)', amount: '3250', price: 3280, basePrice: 2690, description: 'Android In-Game Coins' },
      { id: 'pkg_efb_and_5700', name: '5700 Coins (Android)', amount: '5700', price: 5750, basePrice: 4715, description: 'Android In-Game Coins' },
      { id: 'pkg_efb_and_12800', name: '12800 Coins (Android)', amount: '12800', price: 12550, basePrice: 10300, description: 'Android In-Game Coins' }
    ]
  },
  {
    id: 'game_efb_ios',
    code: 'efb_ios',
    title: 'EFOOTBALL — iOS COINS',
    fullName: 'EFOOTBALL — iOS COINS',
    emoji: '🍏',
    requiresUid: false,
    inputLabel: 'Konami ID / Apple ID Email',
    inputPrompt: '🍏 আপনার *Konami ID বা Apple ID Email* লিখে পাঠান:',
    packages: [
      { id: 'pkg_efb_ios_130', name: '130 Coins (iOS)', amount: '130', price: 150, basePrice: 120, description: 'iOS In-Game Coins' },
      { id: 'pkg_efb_ios_300', name: '300 Coins (iOS)', amount: '300', price: 340, basePrice: 270, description: 'iOS In-Game Coins' },
      { id: 'pkg_efb_ios_550', name: '550 Coins (iOS)', amount: '550', price: 600, basePrice: 480, description: 'iOS In-Game Coins' },
      { id: 'pkg_efb_ios_750', name: '750 Coins (iOS)', amount: '750', price: 810, basePrice: 650, description: 'iOS In-Game Coins' },
      { id: 'pkg_efb_ios_1040', name: '1040 Coins (iOS)', amount: '1040', price: 1140, basePrice: 910, description: 'iOS In-Game Coins' },
      { id: 'pkg_efb_ios_2130', name: '2130 Coins (iOS)', amount: '2130', price: 2250, basePrice: 1800, description: 'iOS In-Game Coins' },
      { id: 'pkg_efb_ios_3250', name: '3250 Coins (iOS)', amount: '3250', price: 3440, basePrice: 2750, description: 'iOS In-Game Coins' },
      { id: 'pkg_efb_ios_5700', name: '5700 Coins (iOS)', amount: '5700', price: 6000, basePrice: 4800, description: 'iOS In-Game Coins' },
      { id: 'pkg_efb_ios_12800', name: '12800 Coins (iOS)', amount: '12800', price: 13200, basePrice: 10560, description: 'iOS In-Game Coins' }
    ]
  },
  {
    id: 'game_ff',
    code: 'ff',
    title: 'FREE FIRE — DIAMONDS',
    fullName: 'FREE FIRE — DIAMONDS TOP UP',
    emoji: '🔥',
    requiresUid: true,
    inputLabel: 'Free Fire Player UID',
    inputPrompt: '🔥 আপনার *Free Fire Player UID* টি লিখে পাঠান (যেমন: `123456789`):',
    packages: [
      { id: 'pkg_ff_25', name: '25 Diamonds', amount: '25', price: 25, basePrice: 18, description: 'Direct UID Top-Up' },
      { id: 'pkg_ff_50', name: '50 Diamonds', amount: '50', price: 40, basePrice: 30, description: 'Direct UID Top-Up' },
      { id: 'pkg_ff_115', name: '115 Diamonds', amount: '115', price: 90, basePrice: 74, description: 'Direct UID Top-Up' },
      { id: 'pkg_ff_240', name: '240 Diamonds', amount: '240', price: 170, basePrice: 139, description: 'Direct UID Top-Up' },
      { id: 'pkg_ff_355', name: '355 Diamonds', amount: '355', price: 250, basePrice: 205, description: 'Direct UID Top-Up' },
      { id: 'pkg_ff_480', name: '480 Diamonds', amount: '480', price: 340, basePrice: 279, description: 'Direct UID Top-Up' },
      { id: 'pkg_ff_610', name: '610 Diamonds', amount: '610', price: 400, basePrice: 328, description: 'Direct UID Top-Up' },
      { id: 'pkg_ff_850', name: '850 Diamonds', amount: '850', price: 550, basePrice: 451, description: 'Direct UID Top-Up' },
      { id: 'pkg_ff_1090', name: '1090 Diamonds', amount: '1090', price: 720, basePrice: 590, description: 'Direct UID Top-Up' },
      { id: 'pkg_ff_1240', name: '1240 Diamonds', amount: '1240', price: 850, basePrice: 697, description: 'Direct UID Top-Up' },
      { id: 'pkg_ff_1850', name: '1850 Diamonds', amount: '1850', price: 1350, basePrice: 1107, description: 'Direct UID Top-Up' },
      { id: 'pkg_ff_2530', name: '2530 Diamonds', amount: '2530', price: 1800, basePrice: 1476, description: 'Direct UID Top-Up' },
      { id: 'pkg_ff_5060', name: '5060 Diamonds', amount: '5060', price: 3500, basePrice: 2870, description: 'Direct UID Top-Up' },
      { id: 'pkg_ff_10120', name: '10120 Diamonds', amount: '10120', price: 7000, basePrice: 5740, description: 'Direct UID Top-Up' },
      { id: 'pkg_ff_weekly', name: 'Weekly Pack', amount: 'Weekly', price: 170, basePrice: 139, description: 'Weekly Pass' },
      { id: 'pkg_ff_monthly', name: 'Monthly Pack', amount: 'Monthly', price: 800, basePrice: 656, description: 'Monthly Pass' },
      { id: 'pkg_ff_lvlup', name: 'Lvl Up Pass', amount: 'Lvl Up', price: 170, basePrice: 139, description: 'Level Up Pass' }
    ]
  },
  {
    id: 'game_movie',
    code: 'movie',
    title: 'MOVIE/ANIME — SUBS',
    fullName: 'MOVIE/ANIME — SUBSCRIPTION & PACKS',
    emoji: '🎬',
    requiresUid: false,
    inputLabel: 'Email / Gmail Account',
    inputPrompt: '🎬 আপনার *Email / Gmail অ্যাড্রেস* লিখে পাঠান (যেখানে সাবস্ক্রিপশন অ্যাকাউন্ট ও লগইন তথ্য পাঠানো হবে):',
    packages: [
      { id: 'pkg_sub_netflix', name: 'Netflix 1M (1 Screen)', amount: 'Netflix 1M', price: 320, basePrice: 230, description: '1 Month UHD Screen' },
      { id: 'pkg_sub_crunchyroll', name: 'Crunchyroll 1M (Fan)', amount: 'Crunchyroll 1M', price: 180, basePrice: 125, description: '1 Month Anime Streaming' },
      { id: 'pkg_sub_prime_vid', name: 'Prime Video 1M', amount: 'Prime 1M', price: 150, basePrice: 105, description: '1 Month Private Profile' },
      { id: 'pkg_sub_spotify', name: 'Spotify 1M Premium', amount: 'Spotify 1M', price: 120, basePrice: 85, description: '1 Month Individual' },
      { id: 'pkg_sub_youtube', name: 'YouTube 1M Premium', amount: 'YouTube 1M', price: 150, basePrice: 105, description: '1 Month Family Invite' }
    ]
  }
];

export const PAYMENT_ACCOUNTS = {
  bkash: '01872239597',
  rocket: '01872239597',
  nagad: '01330719250'
};

export function findGameCategory(identifier?: string | null): GameCategory | undefined {
  if (!identifier) return undefined;
  const raw = identifier.toLowerCase().trim();
  const clean = raw.replace(/[^\w\s\u0980-\u09FF]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean || clean.length < 2) return undefined;

  // 1. Direct code/ID exact match
  const direct = GAME_CATEGORIES.find(
    g => g.id.toLowerCase() === raw || 
         g.code.toLowerCase() === raw || 
         g.fullName.toLowerCase() === raw || 
         g.title.toLowerCase() === raw
  );
  if (direct) return direct;

  // 2. Keyword matching for specific services
  if (clean.includes('netflix') || clean.includes('নেটফ্লিক্স') || 
      clean.includes('crunchyroll') || clean.includes('ক্রাঞ্চিরোল') ||
      clean.includes('spotify') || clean.includes('স্পটিফাই') ||
      clean.includes('anime') || clean.includes('movie') || clean.includes('মুভি') ||
      clean.includes('streaming') || clean.includes('subscription') || clean.includes('সাবস্ক্রিপশন') ||
      clean.includes('prime video') || clean.includes('youtube premium')) {
    return GAME_CATEGORIES.find(g => g.id === 'game_movie');
  }

  if (clean.includes('kr') || clean.includes('korean') || clean.includes('কোরিয়ান') || clean.includes('কোরিয়ান')) {
    return GAME_CATEGORIES.find(g => g.id === 'game_pubg_kr');
  }

  if (clean.includes('special') || clean.includes('স্পেশাল')) {
    return GAME_CATEGORIES.find(g => g.id === 'game_pubg_login');
  }

  if (clean.includes('login') || clean.includes('লগইন') || clean.includes('qr') || clean.includes('কিউআর')) {
    return GAME_CATEGORIES.find(g => g.id === 'game_pubg_login');
  }

  if (clean.includes('free fire') || clean.includes('freefire') || clean.includes('ff') || 
      clean.includes('ফ্রি ফায়ার') || clean.includes('ফ্রি ফায়ার') || clean.includes('ডায়মন্ড') || clean.includes('ডায়মন্ড')) {
    return GAME_CATEGORIES.find(g => g.id === 'game_ff');
  }

  if (clean.includes('ios') || clean.includes('apple') || clean.includes('আইওএস') || clean.includes('অ্যাপল')) {
    if (clean.includes('efootball') || clean.includes('efb') || clean.includes('coin') || clean.includes('কয়েন') || clean.includes('কয়েন')) {
      return GAME_CATEGORIES.find(g => g.id === 'game_efb_ios');
    }
  }

  if (clean.includes('efootball') || clean.includes('efb') || clean.includes('pes') || 
      clean.includes('ইফুটবল') || clean.includes('কয়েন') || clean.includes('কয়েন') || clean.includes('football')) {
    return GAME_CATEGORIES.find(g => g.id === 'game_efb_android');
  }

  if (clean.includes('pubg') || clean.includes('পাবজি') || clean.includes('uc') || clean.includes('ইউসি')) {
    return GAME_CATEGORIES.find(g => g.id === 'game_pubg_uid');
  }

  // 3. Fallback partial title match
  return GAME_CATEGORIES.find(
    g => g.fullName.toLowerCase().includes(clean) || 
         clean.includes(g.title.toLowerCase())
  );
}

/**
 * Convert Bengali digits (০-৯) to English digits (0-9)
 */
function toEnDigits(str: string): string {
  const map: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
  };
  return str.replace(/[০-৯]/g, d => map[d] || d);
}

export function findPackage(game: GameCategory, identifier?: string | null): GamePackage | undefined {
  if (!identifier) return undefined;
  const raw = identifier.toLowerCase().trim();
  const normalized = toEnDigits(raw);
  const clean = normalized.replace(/[^\w\s\u0980-\u09FF\[\]\(\)\+\-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return undefined;

  const packages = (game.packages || []).filter(p => p.isActive !== false);

  // 1. Direct ID match
  const directId = packages.find(p => p.id.toLowerCase() === raw || (raw.startsWith('pkg_') && p.id.toLowerCase().includes(raw)));
  if (directId) return directId;

  // 2. Direct Name exact match (case insensitive)
  const exactName = packages.find(p => p.name.toLowerCase() === normalized || p.name.toLowerCase() === clean);
  if (exactName) return exactName;

  // 2b. Direct Amount match (e.g. typing "60" or "115" or "1 Month")
  const exactAmount = packages.find(p => p.amount && (p.amount.toLowerCase() === normalized || p.amount.toLowerCase() === clean));
  if (exactAmount) return exactAmount;

  // 3. Game-specific intelligent intent mapping:

  // A. Movie / Streaming subscriptions
  if (game.id === 'game_movie') {
    if (clean.includes('netflix') || clean.includes('নেটফ্লিক্স')) {
      return packages.find(p => p.id === 'pkg_sub_netflix');
    }
    if (clean.includes('crunchyroll') || clean.includes('ক্রাঞ্চিরোল') || clean.includes('crunchy')) {
      return packages.find(p => p.id === 'pkg_sub_crunchyroll');
    }
    if (clean.includes('prime') || clean.includes('amazon') || clean.includes('প্রাইম')) {
      return packages.find(p => p.id === 'pkg_sub_prime_vid');
    }
    if (clean.includes('spotify') || clean.includes('স্পটিফাই')) {
      return packages.find(p => p.id === 'pkg_sub_spotify');
    }
    if (clean.includes('youtube') || clean.includes('yt') || clean.includes('ইউটিউব')) {
      return packages.find(p => p.id === 'pkg_sub_youtube');
    }
  }

  // B. PUBG Subscriptions
  if (game.id === 'game_pubg_sub') {
    const isPlus = clean.includes('plus') || clean.includes('প্লাস');
    const isGrowth = clean.includes('growth') || clean.includes('গ্রোথ');
    const months =
      clean.includes('12') || clean.includes('1 year') || clean.includes('year') ? 12 :
      clean.includes('6') ? 6 :
      clean.includes('3') ? 3 :
      clean.includes('1') ? 1 : 0;

    if (isGrowth) {
      if (clean.includes('3')) return packages.find(p => p.id === 'pkg_sub_growth_3');
      if (clean.includes('2')) return packages.find(p => p.id === 'pkg_sub_growth_2');
      return packages.find(p => p.id === 'pkg_sub_growth_1');
    }
    if (isPlus) {
      if (months === 12) return packages.find(p => p.id === 'pkg_sub_prime_plus_12m');
      if (months === 6) return packages.find(p => p.id === 'pkg_sub_prime_plus_6m');
      if (months === 3) return packages.find(p => p.id === 'pkg_sub_prime_plus_3m');
      return packages.find(p => p.id === 'pkg_sub_prime_plus');
    }
    if (clean.includes('prime') || clean.includes('প্রাইম')) {
      if (months === 12) return packages.find(p => p.id === 'pkg_sub_prime_12m');
      if (months === 6) return packages.find(p => p.id === 'pkg_sub_prime_6m');
      if (months === 3) return packages.find(p => p.id === 'pkg_sub_prime_3m');
      return packages.find(p => p.id === 'pkg_sub_prime');
    }
  }

  // C. Free Fire Memberships
  if (game.id === 'game_ff') {
    if (clean.includes('weekly') || clean.includes('উইকলি') || clean.includes('সাপ্তাহিক')) {
      return packages.find(p => p.id === 'pkg_ff_weekly');
    }
    if (clean.includes('monthly') || clean.includes('মান্থলি') || clean.includes('মাসিক')) {
      return packages.find(p => p.id === 'pkg_ff_monthly');
    }
  }

  // D. Number matching across packages (e.g. "60", "385", "115", "130")
  const numbersFound = normalized.match(/\b\d+\b/g);
  if (numbersFound && numbersFound.length > 0) {
    for (const numStr of numbersFound) {
      const num = parseInt(numStr, 10);
      // Match against package amount or name containing this number (e.g. '60 UC', '385 UC [50 RP]')
      const matchedByNum = packages.find(p => {
        if (p.amount) {
          const amtNum = p.amount.match(/\b\d+\b/);
          if (amtNum && parseInt(amtNum[0], 10) === num) return true;
        }
        const pNumbers = p.name.match(/\b\d+\b/g);
        return pNumbers && pNumbers.some(pn => parseInt(pn, 10) === num);
      });
      if (matchedByNum) return matchedByNum;
    }
  }

  // E. RP matching for PUBG (e.g. "50 rp", "100 rp", "rp")
  if (clean.includes('50 rp') || clean.includes('50rp')) {
    const p50 = packages.find(p => p.name.includes('50 RP'));
    if (p50) return p50;
  }
  if (clean.includes('100 rp') || clean.includes('100rp')) {
    const p100 = packages.find(p => p.name.includes('100 RP'));
    if (p100) return p100;
  }

  // F. Fuzzy substring matching
  return packages.find(p => {
    const pNameLow = p.name.toLowerCase();
    return clean.includes(pNameLow) || pNameLow.includes(clean);
  });
}

/**
 * Format a package into a WhatsApp Interactive List row (Meta 24-char title limit, 72-char desc limit)
 * Guarantees that the price is NEVER truncated and always 100% visible!
 */
export function formatWhatsAppRow(pkg: GamePackage): { id: string; title: string; description: string } {
  const priceTag = ` • ৳${pkg.price}`; // e.g. " • ৳320" (7-8 chars)
  const maxNameLen = Math.max(8, 24 - priceTag.length); // 16-17 chars

  let name = pkg.name;
  if (name.length > maxNameLen) {
    // 1. Strip parenthetical information e.g. "Netflix 1M (1 Screen)" -> "Netflix 1M"
    const cleaned = name.replace(/\s*\([^)]*\)/g, '').trim();
    if (cleaned.length <= maxNameLen) {
      name = cleaned;
    } else {
      // 2. Remove words like "Premium", "Membership", "Diamonds", "Coins"
      const simplified = cleaned.replace(/\s*(?:Premium|Membership|Diamonds|Coins|Pass)\b/gi, '').trim();
      if (simplified.length <= maxNameLen) {
        name = simplified;
      } else {
        name = name.slice(0, maxNameLen - 2) + '..';
      }
    }
  }

  const title = `${name}${priceTag}`;
  const description = `${pkg.name} | ৳${pkg.price} Tk (${pkg.description || 'Instant Top-Up'})`.slice(0, 72);

  return {
    id: pkg.id,
    title: title.slice(0, 24),
    description
  };
}

/**
 * Format a package into a WhatsApp Quick Reply Button (Meta 20-char button title limit)
 * Guarantees price is NEVER truncated!
 */
export function formatWhatsAppButton(pkg: GamePackage): { id: string; title: string } {
  const priceTag = ` ৳${pkg.price}`; // e.g. " ৳1150" (6 chars)
  const maxNameLen = Math.max(6, 20 - priceTag.length); // 14 chars

  let name = pkg.name;
  if (name.length > maxNameLen) {
    const cleaned = name.replace(/\s*\([^)]*\)/g, '').trim();
    if (cleaned.length <= maxNameLen) {
      name = cleaned;
    } else {
      name = name.slice(0, maxNameLen - 2) + '..';
    }
  }

  return {
    id: pkg.id,
    title: `${name}${priceTag}`.slice(0, 20)
  };
}

